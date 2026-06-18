/*
Copyright (c) 2025-26 PrZ3 LLC (d/b/a [PrZ3](https://github.com/PrZ3r))

Redistribution and use in source and binary forms, with or without modification, 
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

3. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or
   other materials provided with the distribution.

4. Neither the name of the copyright holder nor the names of its contributors may
   be used to endorse or promote products derived from this software without specific 
   prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND 
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE 
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL 
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR 
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER 
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR 
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF 
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/**
 * Prune MRI to keep only sightings present in the given index.
 * @param {Set<string>} index - Set of keys `${refId}||${docId}||${type}` representing current truth.
 * @param {object} opts - Options: { removeEmptyRefs?: boolean }
 * @returns {{ removedVariants: number, removedRefs: number }}
 */
function mriPruneToSightings(index, opts = {}) {
  // index: Set of keys `${refId}||${docId}||${type}` representing CURRENT truth
  const removeEmptyRefs = opts.removeEmptyRefs !== false; // default true
  const mri = _loadMRI();
  let removedVariants = 0;
  let removedRefs = 0;

  for (const [refId, entry] of Object.entries(mri.refs || {})) {
    const before = Array.isArray(entry.rawVariants) ? entry.rawVariants.length : 0;
    if (before) {
      const kept = [];
      for (const v of entry.rawVariants) {
        const key = `${refId}||${v.docId || ''}||${v.type || ''}`;
        if (index.has(key)) kept.push(v); else removedVariants++;
      }
      if (kept.length !== before) {
        entry.rawVariants = kept;
        _dirty = true;
      }
    }

    // Optionally drop the entire refId if it has no variants and isn't a source doc itself
    const hasAny = Array.isArray(entry.rawVariants) && entry.rawVariants.length > 0;
    const isSource = !!(entry.resolution && entry.resolution.sourcePresent);
    if (removeEmptyRefs && !hasAny && !isSource) {
      delete mri.refs[refId];
      removedRefs++;
      _dirty = true;
    }
  }

  // Recompute stats
  mri.stats.uniqueRefIds = Object.keys(mri.refs || {}).length;

  // Orphan pruning — operate on both legacy unmapped[] entries AND new
  // slug-keyed refs[] entries (isOrphan===true). Drops orphans whose source
  // doc is gone, OR whose citation can now be resolved to a canonical refId
  // present as a sighting elsewhere.
  let removedOrphans = 0;

  // Build a quick set of docIds present in current truth for fast lookups
  const presentDocIds = new Set();
  for (const key of index) {
    const parts = String(key).split('||');
    if (parts.length >= 3 && parts[1]) presentDocIds.add(parts[1]);
  }

  function tryResolveOrphan(docId, cite, href, type) {
    if (!docId || !presentDocIds.has(docId)) return { docGone: true, nowResolved: false };
    let nowResolved = false;
    try {
      const rid = parseRefId(cite || '', href || '');
      if (rid) {
        const key = `${rid}||${docId}||${type || ''}`;
        if (index.has(key)) nowResolved = true;
      }
    } catch {}
    return { docGone: false, nowResolved };
  }

  // 1. Legacy unmapped[] (should mostly be empty post-migration, but keep for safety)
  if (mri.orphans && Array.isArray(mri.orphans.unmapped)) {
    const keptOrphans = [];
    for (const o of mri.orphans.unmapped) {
      const { docGone, nowResolved } = tryResolveOrphan(o && o.docId, o && o.cite, o && o.href, o && o.type);
      if (docGone || nowResolved) {
        removedOrphans++;
        _dirty = true;
      } else {
        keptOrphans.push(o);
      }
    }
    if (keptOrphans.length !== mri.orphans.unmapped.length) {
      mri.orphans.unmapped = keptOrphans;
    }
  }

  // 2. New slug-keyed orphans in refs[]
  for (const [slug, entry] of Object.entries(mri.refs || {})) {
    if (!entry || !entry.isOrphan) continue;
    const { docGone, nowResolved } = tryResolveOrphan(entry.sourceDoc, entry.citationText, entry.href, (entry.rawVariants && entry.rawVariants[0] && entry.rawVariants[0].type) || null);
    if (docGone || nowResolved) {
      delete mri.refs[slug];
      removedOrphans++;
      _dirty = true;
    }
  }

  if (process.env.DEBUG || process.env.MSR_DEBUG) {
    console.log(`🧹 MRI prune: removedVariants=${removedVariants}, removedRefs=${removedRefs}, removedOrphans=${typeof removedOrphans === 'number' ? removedOrphans : 0}`);
  }

  return { removedVariants, removedRefs, removedOrphans: typeof removedOrphans === 'number' ? removedOrphans : 0 };
}

// referencing.js — shared helpers for building references from HTML
// Centralizes refMap pattern loading, cite→refId mapping, and DOM extraction

const fs = require('fs');
const path = require('path');

// ---- document registry presence index (for quick source checks) ----
// The registry is a directory of per-doc files (issue #1108); loadAllDocs()
// globs + parses them no matter where Node is launched from.
const { loadAllDocs } = require('./registry');

// Retained for debug logging only.
function _getDocsPath() {
  return path.resolve(process.cwd(), 'src/main/data/docs');
}
let _docIdIndex = null; // Set<string> of docIds from the registry
let _docBaseIndex = null; // Map<string base, string[]> of docIds by base
const DATED_TAIL_RE = /\.(?:\d{8}|\d{4}(?:-\d{2}){0,2})$/; // .YYYY | .YYYY-MM | .YYYY-MM-DD | .YYYYMMDD

function _loadDocumentsIndex() {
  if (_docIdIndex && _docBaseIndex) return _docIdIndex;
  try {
    _docIdIndex = new Set();
    _docBaseIndex = new Map();

    const addId = (id) => {
      if (!id || typeof id !== 'string') return;
      _docIdIndex.add(id);
      const base = id.replace(DATED_TAIL_RE, '');
      if (base) {
        const arr = _docBaseIndex.get(base) || [];
        if (!arr.includes(id)) arr.push(id);
        _docBaseIndex.set(base, arr);
      }
    };

    for (const d of loadAllDocs()) {
      if (d && typeof d === 'object') {
        if (typeof d.docId === 'string') addId(d.docId);
        if (typeof d.docBase === 'string') addId(d.docBase);
      }
    }
  } catch {
    _docIdIndex = new Set();
    _docBaseIndex = new Map();
  }
  return _docIdIndex;
}

function _hasDocId(id) {
  if (!id) return false;
  const idx = _loadDocumentsIndex();
  return idx.has(String(id));
}

function _dateRankFromId(id) {
  // Return a numeric rank for comparing dated ids; higher = newer. Undated -> -Infinity.
  if (!id || typeof id !== 'string') return Number.NEGATIVE_INFINITY;
  const m = id.match(/\.(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$|\.(\d{8})$/);
  if (!m) return Number.NEGATIVE_INFINITY;
  if (m[4]) { // YYYYMMDD
    return parseInt(m[4], 10);
  }
  const y = parseInt(m[1], 10);
  const mo = m[2] ? parseInt(m[2], 10) : 0;
  const d = m[3] ? parseInt(m[3], 10) : 0;
  return y * 10000 + mo * 100 + d;
}

function _findSourceDocIdForRefId(refId) {
  if (!refId) return null;
  _loadDocumentsIndex();
  const id = String(refId);
  // 1) exact id present
  if (_docIdIndex && _docIdIndex.has(id)) return id;
  // 2) base match: choose the latest dated docId for the same base
  const base = id.replace(DATED_TAIL_RE, '');
  let arr = _docBaseIndex ? _docBaseIndex.get(base) : null;

  // Fallback: if base map is empty (e.g., index built from array without docBase fields),
  // derive candidates by scanning all docIds that start with `${base}.` or `${base}-`
  if ((!arr || arr.length === 0) && _docIdIndex && _docIdIndex.size) {
    const dotPrefix = `${base}.`;
    const dashPrefix = `${base}-`;
    arr = [];
    for (const cand of _docIdIndex) {
      if (
        cand === base ||
        cand.startsWith(dotPrefix) ||
        cand.startsWith(dashPrefix)
      ) {
        arr.push(cand);
      }
    }
  }

  if (arr && arr.length) {
    // Prefer exact base if present, else highest date rank
    let best = null;
    let bestRank = Number.NEGATIVE_INFINITY;
    for (const cand of arr) {
      if (cand === base) return cand; // exact base id present
      const r = _dateRankFromId(cand);
      if (r > bestRank) {
        bestRank = r;
        best = cand;
      }
    }
    // If all ranks were -Infinity (unparseable dates), just pick the first candidate
    return best || arr[0] || null;
  }
  return null;
}

function _hasDocIdOrBase(id) {
  return !!_findSourceDocIdForRefId(id);
}

function reloadDocumentsIndex() {
  _docIdIndex = null;
  _docBaseIndex = null;
  return _loadDocumentsIndex();
}

// ---- refMap pattern loading / normalization ----

// ---- Master Reference Index (MRI) helpers ----
const MRI_PATH = path.resolve(process.cwd(), 'src/main/reports/masterReferenceIndex.json');
let _mri = null;
let _dirty = false;

function _initEmptyMRI() {
  return {
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    stats: { uniqueRefIds: 0, resolvedCount: 0, knownPublisherNoDocCount: 0, unknownPublisherOrphanCount: 0 },
    refs: {},
    reverse: {},
    // Kept for backwards-compat with consumers that still read this shape;
    // new orphans are written as `refs[orphan/<sourceDoc>/<refXmlId>]` slug
    // entries, not pushed into this list.
    orphans: { unmapped: [] }
  };
}

// Stable short hash of a normalised raw <ref> XML — used to group orphans that
// represent the same citation across multiple source docs. Drops per-sighting
// `<ref id="X">` attribute + whitespace + case so equivalent citations collide.
function _contentHash(rawRef) {
  const crypto = require('crypto');
  const norm = String(rawRef || '')
    .replace(/<ref\s+id="[^"]+"/g, '<ref')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!norm) return null;
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 16);
}

// Extract the `<ref id="X">` value from a raw ref block — used as the per-doc
// component of source-anchored orphan slugs.
function _refXmlIdOf(rawRef) {
  const m = String(rawRef || '').match(/<ref\s+id="([^"]+)"/);
  return m ? m[1] : null;
}

// Minimal HTML entity decode for the handful of entities APTARA / NLM XML
// commonly carries (em-dash, ampersand, smart quotes). Avoids a full XML
// dependency just to synthesise a citation string.
function _decodeXmlEntities(s) {
  return String(s == null ? '' : s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; }
    })
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(parseInt(n, 10)); } catch { return ''; }
    });
}

// Synthesise a human-readable citation string from raw `<ref>` XML when the
// extractor didn't carry an explicit cite text. Handles both APTARA
// (`<ref_authorgrp><ref_author><init>/<ref_surname>`, `<ref_articletitle>`,
// `<ref_pubtitle>`, `<standardnum>`, `<repno>`, `<edition>`, `<publishername>`,
// `<volume>`, `<startpage>/<endpage>`, `<date><month>/<year>`) and NLM
// (`<element-citation>`/`<name><surname><given-names>`, `<article-title>`,
// `<source>`, `<publisher-name>`, `<volume>`, `<fpage>/<lpage>`, `<year>`)
// shapes — both surface during SMPTE source-ref + NLM journal-article
// extraction. Returns null when there's nothing structured to compose.
function synthesizeCiteFromRawRef(rawRef) {
  if (!rawRef || typeof rawRef !== 'string') return null;
  const s = rawRef.replace(/\s+/g, ' ');

  const get = (tag) => {
    const m = s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
    if (!m) return '';
    return _decodeXmlEntities(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  };

  // Authors — try APTARA `<ref_author>` first, then NLM `<name>` / `<string-name>`.
  const authors = [];
  const aptaraBlocks = s.match(/<ref_author>[\s\S]*?<\/ref_author>/g) || [];
  for (const block of aptaraBlocks) {
    const init = (block.match(/<init>([^<]+)<\/init>/) || [])[1] || '';
    const surname = (block.match(/<ref_surname>([^<]+)<\/ref_surname>/) || [])[1] || '';
    if (surname.trim()) {
      authors.push(_decodeXmlEntities(`${init.trim()} ${surname.trim()}`.trim()));
    }
  }
  if (authors.length === 0) {
    const nlmBlocks = s.match(/<(?:name|string-name)[^>]*>[\s\S]*?<\/(?:name|string-name)>/g) || [];
    for (const block of nlmBlocks) {
      const surname = (block.match(/<surname>([^<]+)<\/surname>/) || [])[1] || '';
      const given = (block.match(/<given-names>([^<]+)<\/given-names>/) || [])[1] || '';
      if (surname.trim()) {
        authors.push(_decodeXmlEntities(`${given.trim()} ${surname.trim()}`.trim()));
      }
    }
  }

  const parts = [];

  // Standards refs lead with their identifier number.
  const standardNum = get('standardnum');
  if (standardNum) parts.push(standardNum);

  if (authors.length) parts.push(authors.join(', '));

  const articleTitle = get('ref_articletitle') || get('article-title');
  if (articleTitle) parts.push(`"${articleTitle}"`);

  const pubTitle = get('ref_pubtitle') || get('source');
  if (pubTitle) parts.push(pubTitle);

  const repNo = get('repno');
  if (repNo) parts.push(repNo);

  const edition = get('edition');
  if (edition) parts.push(edition);

  const publisher = get('publishername') || get('publisher-name');
  if (publisher) parts.push(publisher);

  const volume = get('volume');
  if (volume) parts.push(`vol. ${volume}`);

  const startPage = get('startpage') || get('fpage');
  const endPage = get('endpage') || get('lpage');
  if (startPage) {
    if (endPage && endPage !== startPage) parts.push(`pp. ${startPage}–${endPage}`);
    else parts.push(`p. ${startPage}`);
  }

  const month = get('month');
  const year = get('year');
  if (year) parts.push(month ? `${month} ${year}` : year);

  return parts.length ? parts.join(', ').trim() : null;
}

function _stableSort(arr, keyFn) {
  return arr
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      const ka = keyFn(a.v);
      const kb = keyFn(b.v);
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      return a.i - b.i;
    })
    .map(x => x.v);
}

function _loadMRI() {
  if (_mri) return _mri;
  try {
    if (fs.existsSync(MRI_PATH)) {
      const raw = fs.readFileSync(MRI_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      _mri = parsed && typeof parsed === 'object' ? parsed : _initEmptyMRI();
    } else {
      // ensure folder exists
      fs.mkdirSync(path.dirname(MRI_PATH), { recursive: true });
      _mri = _initEmptyMRI();
    }
  } catch {
    _mri = _initEmptyMRI();
  }
  return _mri;
}

function _ensureRef(refId) {
  const mri = _loadMRI();
  if (!mri.refs[refId]) {
    mri.refs[refId] = {
      refId,
      normalized: null,
      resolvedDocId: null,
      needsResolve: 'known-publisher-no-doc',
      contentHash: null,
      resolution: null,
      provenance: { firstSeen: null, mapSource: [], mapDetails: [] },
      rawVariants: []
    };
  }
  return mri.refs[refId];
}

function _dedupeVariants(arr) {
  const seen = new Set();
  const out = [];
  for (const r of arr) {
    const key = [
      r.docId,
      r.type,
      (r.cite || '').trim(),
      (r.href || '').trim(),
      (r.rawRef || '').trim(),
      (r.title || '').trim()
    ].join('||');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

function _dedupeStrings(arr) {
  const s = new Set();
  const out = [];
  for (const v of arr) {
    if (!s.has(v)) {
      s.add(v);
      out.push(v);
    }
  }
  return out;
}

function _normalizeRawRef(value) {
  let s = (typeof value === 'string' ? value : (value == null ? '' : String(value)))
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';

  // Drop numeric list/cite wrappers, but preserve named cite tokens.
  // "4 ] ..." -> "..."
  // "[4] ..." -> "..."
  // "GIF ] ..." -> "GIF ..."
  // "[GIF] ..." -> "GIF ..."
  s = s
    .replace(/^\[\s*\d{1,4}\s*\]\s*/u, '')
    .replace(/^\d{1,4}\s*\]\s*/u, '')
    .replace(/^\[\s*([A-Za-z][A-Za-z0-9_.:-]{0,31})\s*\]\s*/u, '$1 ')
    .replace(/^([A-Za-z][A-Za-z0-9_.:-]{0,31})\s*\]\s*/u, '$1 ')
    .trim();

  // Drop trailing orphan brackets left by some extracted cite wrappers.
  s = s.replace(/\s*\[\s*$/u, '').replace(/\s*\]\s*$/u, '').trim();

  return s;
}

function mriRecordSighting({ docId, type, refId, cite, href, mapSource, mapDetail, rawRef, title }) {
  const mri = _loadMRI();

  _dirty = true;

  // Keep MRI aligned with documents.json reference semantics:
  // do not record self-references (e.g., RFC2049 citing "this document").
  if (refId && docId && String(refId).trim().toUpperCase() === String(docId).trim().toUpperCase()) {
    return;
  }

  if (refId) {
    const entry = _ensureRef(refId);
    // provenance
    if (!entry.provenance.firstSeen) {
      entry.provenance.firstSeen = new Date().toISOString();
    }
    if (mapSource) {
      entry.provenance.mapSource = _dedupeStrings([...(entry.provenance.mapSource || []), String(mapSource)]);
    }
    if (mapDetail) {
      const details = [...(entry.provenance.mapDetails || []), String(mapDetail)];
      entry.provenance.mapDetails = _dedupeStrings(details);
    }
    // resolution/source presence: note if this refId exists as a source doc in documents.json
    entry.resolution = entry.resolution || {};
    // Tentative hint; final truth set in mriFlush after documents.json is finalized
    if (typeof entry.resolution.sourcePresent !== 'boolean') {
      entry.resolution.sourcePresent = _hasDocIdOrBase(refId);
    }
    // variants (merge by (docId,type); never overwrite filled fields with blanks)
    entry.rawVariants = entry.rawVariants || [];
    const norm = v => (typeof v === 'string' ? v : (v == null ? '' : String(v)));
    const newVar = {
      docId,
      type,
      cite: norm(cite),
      href: norm(href),
      rawRef: _normalizeRawRef(rawRef),
      title: title == null ? '' : String(title)
    };

    let merged = false;
    for (let i = 0; i < entry.rawVariants.length; i++) {
      const v = entry.rawVariants[i] || {};
      if (v.docId === newVar.docId && v.type === newVar.type) {
        const out = { ...v };
        // Enrich field-wise: prefer existing non-empty; fill from new when existing is empty
        out.cite   = (out.cite && out.cite.trim().length)     ? out.cite   : newVar.cite;
        out.href   = (out.href && out.href.trim().length)     ? out.href   : newVar.href;
        out.rawRef = (out.rawRef && out.rawRef.trim().length) ? out.rawRef : newVar.rawRef;
        // title can legitimately be null; treat empty-string as missing
        const oldTitle = (out.title == null || String(out.title).trim() === '') ? '' : String(out.title);
        const newTitle = (newVar.title == null || String(newVar.title).trim() === '') ? '' : String(newVar.title);
        out.title = oldTitle || newTitle || null;

        // Only mark dirty if something actually changed
        const changed = (
          out.cite !== v.cite ||
          out.href !== v.href ||
          out.rawRef !== v.rawRef ||
          (out.title || null) !== (v.title || null)
        );
        if (changed) {
          entry.rawVariants[i] = out;
        }
        merged = true;
        break;
      }
    }
    if (!merged) {
      // Normalize empty fields to '' except title→null for consistency
      const v = { ...newVar, title: (newVar.title && newVar.title.trim().length) ? newVar.title : null };
      entry.rawVariants.push(v);
    }
    // Final safety: collapse any accidental dupes
    entry.rawVariants = _dedupeVariants(entry.rawVariants);
  } else {
    // orphan — parser couldn't form a canonical refId. Mint a source-anchored
    // slug (`orphan/<sourceDoc>/<suffix>`) and write as a first-class refs[]
    // entry so it's citable from doc.references[] and queryable like any other
    // ref. contentHash lets resolveOrphans.js group sightings of the same raw
    // citation across multiple source docs.
    //
    // Suffix preference, in order:
    //   1. `<ref id="X">` attribute when raw XML carries one (PR #1111-style
    //      SMPTE source-ref extraction).
    //   2. `h:<contentHash[:8]>` derived from cite text when there's no raw
    //      XML but we have a citation string (extractDocs badRefs from HTML/
    //      free-text providers like IETF/W3C). Stable across re-runs because
    //      the hash is content-deterministic, not random.
    const refXmlIdValue = _refXmlIdOf(rawRef);
    let suffix = refXmlIdValue || null;
    if (!suffix && (cite || href)) {
      const seed = String(cite || '') + '|' + String(href || '');
      suffix = `h:${_contentHash(seed).slice(0, 8)}`;
    }
    if (docId && suffix) {
      const slug = `orphan/${docId}/${suffix}`;
      const refXmlId = refXmlIdValue || suffix; // keep sourceRefId meaningful for either path
      if (!mri.refs[slug]) {
        // If the extractor passed no cite text but raw XML carries enough
        // structure to synthesise one, do it now — orphan slug renderers
        // (refTree, docId page) read citationText, not rawRef.
        const synthCite = cite || synthesizeCiteFromRawRef(rawRef);
        mri.refs[slug] = {
          refId: slug,
          isOrphan: true,
          sourceDoc: docId,
          sourceRefId: refXmlId,
          citationText: synthCite || null,
          href: href || null,
          title: title || null,
          rawRef: rawRef || null,
          // Hash from rawRef when present (canonical for XML-source orphans);
          // fall back to cite+href seed so cite-only orphans (extractDocs
          // badRefs etc.) still get a stable contentHash for cross-sighting
          // dedup at resolve-time.
          contentHash: rawRef
            ? _contentHash(rawRef)
            : _contentHash(String(cite || '') + '|' + String(href || '')),
          resolvedDocId: null,
          needsResolve: 'unknown-publisher',
          rawVariants: [{ docId, type, cite, href, rawRef, title }],
          provenance: {
            firstSeen: new Date().toISOString(),
            mapSource: mapSource ? [String(mapSource)] : ['orphan-mint'],
            mapDetails: mapDetail ? [String(mapDetail)] : [],
          },
        };
      } else {
        // Same slug seen again — should be rare (same doc, same refXmlId). Merge variants idempotently.
        const ent = mri.refs[slug];
        ent.rawVariants = ent.rawVariants || [];
        const exists = ent.rawVariants.some((v) => v && v.docId === docId && v.type === type);
        if (!exists) ent.rawVariants.push({ docId, type, cite, href, rawRef, title });
      }
    } else {
      // Can't mint a deterministic slug (missing docId or <ref id="...">) — fall
      // back to the legacy unmapped[] path so we don't drop the citation entirely.
      // resolveOrphans.js / a future cleanup can lift these once they have enough
      // anchor data to slug-ify.
      mri.orphans = mri.orphans || { unmapped: [] };
      const orphan = { docId, type, cite, href, rawRef, title };
      const key = JSON.stringify(orphan);
      const exists = (mri.orphans.unmapped || []).some(x => JSON.stringify(x) === key);
      if (!exists) (mri.orphans.unmapped ||= []).push(orphan);
    }
  }

  // stats
  const keys = Object.keys(mri.refs);
  mri.stats.uniqueRefIds = keys.length;
}

mriFlush
function mriFlush(opts = {}) {
  const { force = false } = opts;
  const mri = _loadMRI();
  const fileExists = fs.existsSync(MRI_PATH);
  const shouldWrite = force || _dirty || !fileExists;

  // Ensure documents index reflects the final state of this run
  try { reloadDocumentsIndex(); } catch {}

  // Optionally, print debug info about which documents.json path was used
  if (process.env.DEBUG || process.env.MSR_DEBUG) {
    try { console.log(`🔎 Using documents.json at: ${_getDocsPath()}`); } catch {}
  }

  // --- Check if only generatedAt changed, so we can skip writing and log a distinct reason
  if (!force && fileExists) {
    // Prepare comparable objects for diff, ignoring generatedAt
    let existing = null;
    try {
      existing = JSON.parse(fs.readFileSync(MRI_PATH, 'utf-8'));
    } catch {}
    if (existing) {
      // Prepare baseOut and existingComparable (without generatedAt)
      const sortedRefsKeys = Object.keys(mri.refs || {}).sort();
      const refsOut = {};
      for (const k of sortedRefsKeys) {
        const e = mri.refs[k];
        const sortedVariants = _stableSort(e.rawVariants || [], v => `${v.docId}||${v.type}||${(v.cite || '').toLowerCase()}`);
        const sortedMapSource = (e.provenance?.mapSource || []).slice().sort();
        const sortedMapDetails = (e.provenance?.mapDetails || []).slice(); // keep order

        // Final authority: check documents.json (docId and docBase) now that it should be finalized
        const matchDocId = e.isOrphan ? null : _findSourceDocIdForRefId(e.refId);
        const present = !!matchDocId;
        e.resolution = e.resolution || {};
        const prevPresent = !!e.resolution.sourcePresent;
        const prevDoc = e.resolution.sourceDocId || null;
        if (present !== prevPresent || matchDocId !== prevDoc) {
          e.resolution.sourcePresent = present;
          e.resolution.sourceDocId = matchDocId || null;
          if (present && !e.resolution.firstConfirmedSourceAt) {
            e.resolution.firstConfirmedSourceAt = new Date().toISOString();
          }
          _dirty = true;
        }
        // Keep slug-schema fields in sync with resolution truth.
        if (present) {
          if (e.resolvedDocId !== matchDocId) { e.resolvedDocId = matchDocId; _dirty = true; }
          if (e.needsResolve !== null) { e.needsResolve = null; _dirty = true; }
        } else if (e.resolvedDocId !== null || (e.needsResolve == null && !e.isOrphan)) {
          // Canonical-form refs with no source doc → known-publisher-no-doc.
          // Orphan slugs stay as unknown-publisher (their needsResolve is set on mint).
          if (!e.isOrphan) {
            if (e.resolvedDocId !== null) { e.resolvedDocId = null; _dirty = true; }
            if (e.needsResolve !== 'known-publisher-no-doc') { e.needsResolve = 'known-publisher-no-doc'; _dirty = true; }
          }
        }

        refsOut[k] = {
          refId: e.refId,
          normalized: e.normalized || null,
          resolvedDocId: e.resolvedDocId || null,
          needsResolve: e.needsResolve || null,
          contentHash: e.contentHash || null,
          isOrphan: e.isOrphan || undefined,
          sourceDoc: e.sourceDoc || undefined,
          sourceRefId: e.sourceRefId || undefined,
          citationText: e.citationText || undefined,
          href: e.href || undefined,
          title: e.title || undefined,
          rawRef: e.rawRef || undefined,
          resolution: e.resolution || null,
          provenance: {
            firstSeen: e.provenance?.firstSeen || null,
            mapSource: sortedMapSource.length ? sortedMapSource : undefined,
            mapDetails: sortedMapDetails.length ? sortedMapDetails : undefined
          },
          rawVariants: sortedVariants.length ? sortedVariants : undefined
        };
      }
      const resolvedCount = Object.values(refsOut).filter((r) => !!r.resolvedDocId).length;
      const knownPubBacklog = Object.values(refsOut).filter((r) => r.needsResolve === 'known-publisher-no-doc').length;
      const unknownPubOrphans = Object.values(refsOut).filter((r) => r.needsResolve === 'unknown-publisher').length;
      const baseOut = {
        // Hard-bump to v2 — the on-disk schema (resolvedDocId, needsResolve,
        // contentHash, slug-keyed orphan refs[]) is no longer v1.0.0, and we
        // don't want stale `version: "1.0.0"` strings lingering in the file
        // after migration. If we ever cut v3 this becomes a version()-aware step.
        version: '2.0.0',
        // omit generatedAt for comparison
        stats: {
          uniqueRefIds: Object.keys(refsOut).length,
          resolvedCount,
          knownPublisherNoDocCount: knownPubBacklog,
          unknownPublisherOrphanCount: unknownPubOrphans,
        },
        refs: refsOut,
        reverse: mri.reverse || {},
        orphans: {
          unmapped: (mri.orphans?.unmapped || []).slice(0, 200)
        }
      };
      // Build comparable version of existing (without generatedAt)
      const { generatedAt, ...existingComparable } = existing;
      if (JSON.stringify(existingComparable) === JSON.stringify(baseOut)) {
        _dirty = false;
        return {
          path: MRI_PATH,
          wrote: false,
          reason: 'timestamp-only',
          uniqueRefIds: baseOut.stats.uniqueRefIds,
          orphanCount: baseOut.orphans.unmapped.length
        };
      }
    }
  }

  if (!shouldWrite) {
    return { path: MRI_PATH, wrote: false, reason: 'unchanged', uniqueRefIds: Object.keys(mri.refs || {}).length, orphanCount: (mri.orphans?.unmapped || []).length };
  }

  // Sort keys/arrays for stable diffs
  const sortedRefsKeys = Object.keys(mri.refs || {}).sort();
  const refsOut = {};
  for (const k of sortedRefsKeys) {
    const e = mri.refs[k];
    const sortedVariants = _stableSort(e.rawVariants || [], v => `${v.docId}||${v.type}||${(v.cite || '').toLowerCase()}`);
    const sortedMapSource = (e.provenance?.mapSource || []).slice().sort();
    const sortedMapDetails = (e.provenance?.mapDetails || []).slice(); // keep order

    // Final authority: check documents.json (docId and docBase) now that it should be finalized
    const matchDocId = e.isOrphan ? null : _findSourceDocIdForRefId(e.refId);
    const present = !!matchDocId;
    e.resolution = e.resolution || {};
    const prevPresent = !!e.resolution.sourcePresent;
    const prevDoc = e.resolution.sourceDocId || null;
    if (present !== prevPresent || matchDocId !== prevDoc) {
      e.resolution.sourcePresent = present;
      e.resolution.sourceDocId = matchDocId || null;
      if (present && !e.resolution.firstConfirmedSourceAt) {
        e.resolution.firstConfirmedSourceAt = new Date().toISOString();
      }
      _dirty = true;
    }
    // Sync slug-schema fields with resolution truth.
    if (present) {
      if (e.resolvedDocId !== matchDocId) { e.resolvedDocId = matchDocId; _dirty = true; }
      if (e.needsResolve !== null) { e.needsResolve = null; _dirty = true; }
    } else if (!e.isOrphan) {
      if (e.resolvedDocId !== null) { e.resolvedDocId = null; _dirty = true; }
      if (e.needsResolve !== 'known-publisher-no-doc') { e.needsResolve = 'known-publisher-no-doc'; _dirty = true; }
    }

    refsOut[k] = {
      refId: e.refId,
      normalized: e.normalized || null,
      resolvedDocId: e.resolvedDocId || null,
      needsResolve: e.needsResolve || null,
      contentHash: e.contentHash || null,
      isOrphan: e.isOrphan || undefined,
      sourceDoc: e.sourceDoc || undefined,
      sourceRefId: e.sourceRefId || undefined,
      citationText: e.citationText || undefined,
      href: e.href || undefined,
      title: e.title || undefined,
      rawRef: e.rawRef || undefined,
      resolution: e.resolution || null,
      provenance: {
        firstSeen: e.provenance?.firstSeen || null,
        mapSource: sortedMapSource.length ? sortedMapSource : undefined,
        mapDetails: sortedMapDetails.length ? sortedMapDetails : undefined
      },
      rawVariants: sortedVariants.length ? sortedVariants : undefined
    };
  }
  const resolvedCount = Object.values(refsOut).filter((r) => !!r.resolvedDocId).length;
  const knownPubBacklog = Object.values(refsOut).filter((r) => r.needsResolve === 'known-publisher-no-doc').length;
  const unknownPubOrphans = Object.values(refsOut).filter((r) => r.needsResolve === 'unknown-publisher').length;
  const out = {
    version: '2.0.0',
    generatedAt: mri.generatedAt || new Date().toISOString(),
    stats: {
      uniqueRefIds: Object.keys(refsOut).length,
      resolvedCount,
      knownPublisherNoDocCount: knownPubBacklog,
      unknownPublisherOrphanCount: unknownPubOrphans,
    },
    refs: refsOut,
    reverse: mri.reverse || {},
    orphans: {
      unmapped: (mri.orphans?.unmapped || []).slice(0, 200)
    }
  };
  if (shouldWrite) {
    out.generatedAt = new Date().toISOString();
  }
  fs.mkdirSync(path.dirname(MRI_PATH), { recursive: true });
  fs.writeFileSync(MRI_PATH, JSON.stringify(out, null, 2) + '\n');

  _dirty = false;
  return { path: MRI_PATH, wrote: true, uniqueRefIds: Object.keys(refsOut).length, orphanCount: out.orphans.unmapped.length };
}

function mriEnsureFile() {
  // Will write if file is missing; otherwise no-op thanks to dirty guard
  return mriFlush({ force: false });
}
let _patternIndex = null;
let _refMapLoadError = null;

function _normalizePatterns(val) {
  if (Array.isArray(val)) return val.filter(v => typeof v === 'string' && v.trim().length > 0);
  if (typeof val === 'string' && val.trim().length > 0) return [val];
  return [];
}

function _buildPatternIndex(refMap) {
  const out = [];
  if (!refMap || typeof refMap !== 'object') return out;
  const byCitePatterns = refMap.byCitePatterns || {};
  for (const [refId, patternsVal] of Object.entries(byCitePatterns)) {
    const patterns = _normalizePatterns(patternsVal);
    if (!patterns.length) continue;
    for (const pat of patterns) {
      const m = pat.match(/^\s*\/(.*)\/([a-z]*)\s*$/i);
      if (m) {
        const body = m[1];
        const flags = m[2] || 'i';
        try { out.push({ type: 'regex', re: new RegExp(body, flags), refId }); } catch {/* ignore bad regex */}
      } else {
        const key = String(pat).replace(/\s+/g, ' ').trim().toLowerCase();
        if (key) out.push({ type: 'plain', key, refId });
      }
    }
  }
  return out;
}

function _lazyLoadPatternIndex() {
  if (_patternIndex) return _patternIndex;
  try {
    const refMapPath = path.resolve(process.cwd(), 'src/main/input/refMap.json');
    const raw = fs.readFileSync(refMapPath, 'utf-8');
    const refMap = JSON.parse(raw);
    _patternIndex = _buildPatternIndex(refMap);
  } catch (e) {
    _refMapLoadError = e;
    _patternIndex = [];
  }
  return _patternIndex;
}

function reloadRefMap() {
  _patternIndex = null;
  _refMapLoadError = null;
  return _lazyLoadPatternIndex();
}

// ---- cite→refId helpers ----
function mapRefByCiteDiag(text) {
  if (!text) return { refId: null, mapSource: null, mapDetail: null };
  const idx = _lazyLoadPatternIndex();
  const raw = String(text);
  const norm = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  // plain first
  for (const p of idx) {
    if (p.type === 'plain' && p.key === norm) {
      return { refId: p.refId, mapSource: 'plain', mapDetail: `=${norm}` };
    }
  }
  // regex next
  for (const p of idx) {
    if (p.type === 'regex') {
      try {
        if (p.re.test(raw)) return { refId: p.refId, mapSource: 'regex', mapDetail: p.re.toString() };
      } catch {}
    }
  }
  return { refId: null, mapSource: null, mapDetail: null };
}

function mapRefByCite(text) {
  if (!text) return null;
  const idx = _lazyLoadPatternIndex();
  const norm = String(text).replace(/\s+/g, ' ').trim().toLowerCase();
  // 1) plain exact matches first (normalized)
  for (const p of idx) {
    if (p.type === 'plain' && p.key === norm) return p.refId;
  }
  // 2) regex patterns
  for (const p of idx) {
    if (p.type === 'regex') { try { if (p.re.test(text)) return p.refId; } catch {} }
  }
  return null;
}

// Main parser: derive a canonical refId from a citation text + optional href
function parseRefId(text, href = '', opts = {}) {
  const wantDiag = !!opts.wantDiag;
  // allow explicit cite→refId normalization via refMap.json
  const diag = mapRefByCiteDiag(text);
  if (diag.refId) return wantDiag ? { refId: diag.refId, diag } : diag.refId;

  // --- ALLPARTS hinting from cite text ---
  // Some sources explicitly cite a standard as "(all parts)". Preserve that intent
  // by emitting a pseudo-id with the `.ALLPARTS` suffix (used downstream for suite linking).
  const allPartsHint = /\(\s*all\s+parts\s*\)|\ball\s+parts\b/i.test(String(text || ''));
  if (allPartsHint) {
    // Prefer ISO/IEC style numeric extraction from the cite string.
    // Examples:
    //   "ISO 80000 (all parts)" -> ISO.80000.ALLPARTS
    //   "ISO/IEC 15444-1 (all parts)" -> ISO.15444-1.ALLPARTS
    const mIso = String(text || '').match(/\bISO(?:\s*\/\s*IEC|\/IEC)?\s+([0-9]{3,6}(?:-[0-9A-Za-z]+)*)\b/i);
    if (mIso && mIso[1]) {
      const refId = `ISO.${mIso[1]}.ALLPARTS`;
      return wantDiag ? { refId, diag: { mapSource: 'cite', mapDetail: 'allparts:iso' } } : refId;
    }
  }

  // W3C dated stage docs under /TR/YYYY/, e.g.:
  // - .../TR/2017/REC-foo-20170101
  // - .../TR/2017/CR-referrer-policy-20170126
  // - .../TR/2016/WD-CSP3-20160913
  if (/w3\.org\/TR\/\d{4}\/([A-Za-z]+)-([^\/?#]+)-(\d{8})(?:\/)?(?:[?#].*)?$/i.test(href)) {
    const [, stageRaw, shortnameRaw, yyyymmdd] = href.match(/w3\.org\/TR\/\d{4}\/([A-Za-z]+)-([^\/?#]+)-(\d{8})/i);
    const stage = String(stageRaw || '').toUpperCase();
    const shortname = String(shortnameRaw || '').toLowerCase();
    const refId = stage === 'REC'
      ? `W3C.${shortname}.${yyyymmdd}`
      : `W3C.${stage}-${shortname}.${yyyymmdd}`;
    return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: 'w3c:dated-stage' } } : refId;
  }
  // W3C dated REC tokens in cite text (no href available), e.g.:
  // "W3C Recommendation REC-xmlschema-1-20041028"
  if (/\bREC-([A-Za-z0-9._-]+)-(\d{8})\b/i.test(text)) {
    const [, shortname, yyyymmdd] = text.match(/\bREC-([A-Za-z0-9._-]+)-(\d{8})\b/i);
    { const refId = `W3C.${String(shortname).toLowerCase()}.${yyyymmdd}`; return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'w3c:dated-REC-cite' } } : refId; }
  }
  // xml2rfc bibxml4 W3C dated entries (e.g., reference.W3C.REC-ldp-20150226.xml)
  if (/reference\.W3C\.([A-Za-z]+)-([A-Za-z0-9._-]+)-(\d{8})\.xml(?:[?#].*)?$/i.test(href)) {
    const [, stage, shortname, yyyymmdd] = href.match(/reference\.W3C\.([A-Za-z]+)-([A-Za-z0-9._-]+)-(\d{8})\.xml/i);
    const stageNorm = String(stage).toUpperCase();
    const refId = stageNorm === 'REC'
      ? `W3C.${shortname}.${yyyymmdd}`
      : `W3C.${stageNorm}-${shortname}.${yyyymmdd}`;
    return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: 'w3c:bibxml4-dated' } } : refId;
  }
  // W3C undated shortname
  if (/w3\.org\/TR\/([^\/?#]+)\/?(?:[?#].*)?$/i.test(href)) {
    const [, shortname] = href.match(/w3\.org\/TR\/([^\/?#]+)\/?(?:[?#].*)?$/i);
    const s = String(shortname || '').trim();
    const mRec = s.match(/^REC-(.+)$/i);
    const normalized = (mRec?.[1] || s).toLowerCase();
    { const refId = `W3C.${normalized}`; return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: mRec ? 'w3c:shortname-rec' : 'w3c:shortname' } } : refId; }
  }

  // SMPTE DOI/HREF-first canonical parsing.
  // Prefer explicit DOI tokens (including amendment suffixes) when present.
  // Examples:
  // - https://doi.org/10.5594/SMPTE.RP2057.2011
  // - https://doi.org/10.5594/SMPTE.RP2057.2011Am1.2013
  // - .../SMPTE.ST2067-201.2026
  {
    const hrefStr = String(href || '').trim();
    const doiToken = hrefStr.match(/\b10\.5594\/(SMPTE\.(?:ST|RP|RDD|EG|AG|OV|OM)[A-Za-z0-9-]*(?:\.\d{4}(?:-\d{2})?)?(?:Am\d+\.\d{4})?)\b/i);
    if (doiToken?.[1]) {
      const refId = String(doiToken[1]).replace(/\s+/g, '');
      return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: 'smpte:doi-token' } } : refId;
    }
    const pubToken = hrefStr.match(/\bSMPTE\.(?:ST|RP|RDD|EG|AG|OV|OM)[A-Za-z0-9-]*(?:\.\d{4}(?:-\d{2})?)?(?:Am\d+\.\d{4})?\b/i);
    if (pubToken?.[0]) {
      const refId = String(pubToken[0]).replace(/\s+/g, '');
      return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: 'smpte:href-token' } } : refId;
    }
  }

  // ECMA canonical pages / cites.
  // Preferred suffix: YYYYMM if month is known, else YYYY, else edition.
  {
    const mHref = href.match(/ecma-international\.org\/ecma-(\d+)(?:\/(\d+)(?:\.\d+)?)?/i);
    const mText = String(text || '').match(/ECMA[-\s]?(\d+)(?:,\s*(\d+)(?:st|nd|rd|th)\s+edition)?/i);
    const num = (mHref && mHref[1]) || (mText && mText[1]);
    const edition = (mHref && mHref[2]) || (mText && mText[2]) || '';
    if (num) {
      const monthMap = {
        jan: '01', january: '01',
        feb: '02', february: '02',
        mar: '03', march: '03',
        apr: '04', april: '04',
        may: '05',
        jun: '06', june: '06',
        jul: '07', july: '07',
        aug: '08', august: '08',
        sep: '09', sept: '09', september: '09',
        oct: '10', october: '10',
        nov: '11', november: '11',
        dec: '12', december: '12'
      };
      const s = String(text || '');
      let y = '';
      let mm = '';
      const monthYear = s.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b[\s,.-]*(\d{4})\b/i);
      if (monthYear) {
        y = monthYear[2];
        mm = monthMap[String(monthYear[1]).toLowerCase()] || '';
      } else {
        const isoMonth = s.match(/\b(\d{4})-(\d{2})\b/);
        if (isoMonth) {
          y = isoMonth[1];
          mm = isoMonth[2];
        } else {
          const yearOnly = s.match(/\b(19|20)\d{2}\b/);
          if (yearOnly) y = yearOnly[0];
        }
      }

      const suffix = (y && mm) ? `${y}${mm}` : (y || edition);
      const refId = `ECMA.${num}${suffix ? `.${suffix}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: mHref ? 'href' : 'regex', mapDetail: 'ecma-canonical' } } : refId;
    }
  }

  // Handle multi-part cite strings split by '|', prefer ISO/IEC slice if present
  const parts = String(text).split('|').map(p => p.trim());
  text = parts.find(p => /ISO\/IEC|ISO/.test(p)) || parts[0];

  // SMPTE (ST/RP/RDD/EG/AG/OV), optional part, optional year[:YYYY or YYYY-MM]
  {
    // part is 1-3 digits NOT followed by another digit, so a hyphen-separated year
    // ("SMPTE EG 21-1993") is read as the year, not as part "1993"/"199".
    const smpteRe = /SMPTE\s+(ST|RP|RDD|EG|AG|OV)[\s\u00A0\u2010-\u2015\-]+(\d+[A-Za-z]?)(?:-(\d{1,3})(?!\d))?(?:[:\u2010-\u2015-]\s*(\d{4})(?:-(\d{2}))?)?/i;
    const m = text.match(smpteRe);
    if (m) {
      const [, type, numRaw, part, year, month] = m;
      const num = String(numRaw).toUpperCase();
      const lineage = `SMPTE.${type.toUpperCase()}${part ? `${num}-${part}` : num}`;
      if (year) {
        const y = parseInt(year, 10);
        const suffix = (y >= 2023 && month) ? `${year}-${month}` : year;
        { const refId = `${lineage}.${suffix}`; return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'smpte-designator' } } : refId; }
      }
      { const refId = `${lineage}`; return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'smpte-designator' } } : refId; }
    }
  }

  // Legacy SMPTE designators with no ST/RP/EG type token:
  //   "SMPTE 259M-2006", "SMPTE 299M-2004", "ANSI/SMPTE 244M-1995", "SMPTE 145-2004"
  // The M-suffixed (or bare) number is always a Standard — RP/EG/AG/OM/RDD/OV always carry
  // their type token (handled by the block above) — so emit SMPTE.ST<num>[-part].<year>.
  {
    const m = text.match(/(?:\bANSI\s*\/\s*)?\bSMPTE\s+(\d{1,4})(?:\.(\d+))?(M)?\b(?:-(\d{1,2})(?=[-:\s,]|$))?(?:[-:\s]\s*(\d{4}))?/i);
    if (m && (m[3] || m[5])) { // require an M suffix or a year — don't match bare prose
      const num = m[1];
      const part = m[2] || m[4]; // dotted ("305.2M") or hyphenated ("2016-1:2008") part
      const year = m[5];
      const lineage = `SMPTE.ST${part ? `${num}-${part}` : num}`;
      const refId = year ? `${lineage}.${year}` : lineage;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'smpte-legacy-designator' } } : refId;
    }
  }

  // 3GPP Technical Specifications
  // Examples:
  // - "3GPP Technical Specification 33.501, July 2021."
  // - "3GPP Draft Technical Specification 24.501, June 2021."
  // - "3GPP TS 33.501, September 2024."
  {
    const src = String(text || '');
    const has3gpp = /\b3GPP\b/i.test(src);
    // Direct form: "3GPP TS 33.501" or "3GPP Technical Specification 33.501"
    const direct = src.match(/\b3GPP\s+(?:(?:Draft\s+)?Technical\s+Specification|TS)\s+(\d{2})\.(\d{3})\b/i);
    // Split form: "3GPP, ... TS 33.501, ..." (3GPP appears earlier, TS appears later)
    const split = has3gpp ? src.match(/\bTS\s+(\d{2})\.(\d{3})\b/i) : null;
    const m3gpp = direct || split;
    if (m3gpp?.[1] && m3gpp?.[2] && has3gpp) {
      const spec = `${m3gpp[1]}.${m3gpp[2]}`;
      const monthMap = {
        jan: '01', january: '01',
        feb: '02', february: '02',
        mar: '03', march: '03',
        apr: '04', april: '04',
        may: '05',
        jun: '06', june: '06',
        jul: '07', july: '07',
        aug: '08', august: '08',
        sep: '09', sept: '09', september: '09',
        oct: '10', october: '10',
        nov: '11', november: '11',
        dec: '12', december: '12'
      };
      let suffix = '';
      const monthYear = src.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b[\s,.-]*(\d{4})\b/i);
      if (monthYear?.[1] && monthYear?.[2]) {
        const mm = monthMap[String(monthYear[1]).toLowerCase()] || '';
        suffix = mm ? `${monthYear[2]}${mm}` : String(monthYear[2]);
      } else {
        const y = src.match(/\b(19|20)\d{2}\b/);
        if (y?.[0]) suffix = String(y[0]);
      }
      const refId = `3GPP.TS-${spec}${suffix ? `.${suffix}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: direct ? '3gpp-ts-direct' : '3gpp-ts-split' } } : refId;
    }
  }

  // Unicode Standard and Unicode Technical Reports
  if (/unicode\.org\/versions\/Unicode(\d+(?:\.\d+)+)\/?/i.test(href)) {
    const [, version] = href.match(/unicode\.org\/versions\/Unicode(\d+(?:\.\d+)+)\/?/i);
    { const refId = `UNICODE.STD.${version}`; return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: 'unicode:version-url' } } : refId; }
  }
  if (/unicode\.org\/reports\/tr(\d+)\/tr\1-(\d+)(?:\.html?)?/i.test(href)) {
    const [, tr, rev] = href.match(/unicode\.org\/reports\/tr(\d+)\/tr\1-(\d+)(?:\.html?)?/i);
    { const refId = `UNICODE.STD.TR${tr}-${rev}`; return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: 'unicode:tr-url' } } : refId; }
  }
  if (/unicode\.org\/faq\/utf_bom(?:\.html?)?/i.test(href)) {
    { const refId = 'UNICODE.UTF.BOM'; return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: 'unicode:utf-bom-url' } } : refId; }
  }
  if (/The\s+Unicode\s+Standard/i.test(text) && /\bVersion\s+(\d+(?:\.\d+)+)\b/i.test(text)) {
    const [, version] = text.match(/\bVersion\s+(\d+(?:\.\d+)+)\b/i);
    { const refId = `UNICODE.STD.${version}`; return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'unicode:standard-version' } } : refId; }
  }

  // Issue trackers (href-first, no refMap required)
  try {
    const u = new URL(href);
    if (/^bugzilla\.mozilla\.org$/i.test(u.hostname) && /^\/show_bug\.cgi$/i.test(u.pathname)) {
      const bugId = String(u.searchParams.get('id') || '').trim();
      const c = (u.hash || '').match(/^#c(\d+)$/i);
      if (/^\d+$/.test(bugId)) {
        const refId = `MOZ.Bugzilla.${bugId}${c?.[1] ? `.c${c[1]}` : ''}`;
        return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: 'mozilla-bugzilla' } } : refId;
      }
    }
  } catch {}

  // RFC
  if (/RFC\s*(\d+)/i.test(text)) {
    { const refId = `RFC${parseInt(text.match(/RFC\s*(\d+)/i)[1], 10)}`; return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'rfc-number' } } : refId; }
  }

  // IEN (Internet Experiment Note) references, commonly hosted by RFC Editor.
  // Examples:
  // - "IEN-116 ... August 1979"
  // - https://www.rfc-editor.org/ien/ien116.txt
  {
    const ienFromHref = String(href || '').match(/\/ien\/ien(\d+)\.txt\b/i);
    const ienFromText = String(text || '').match(/\bIEN[-\s]?(\d+)\b/i);
    const ienNum = ienFromHref?.[1] || ienFromText?.[1] || '';
    if (ienNum) {
      const refId = `ISI.IEN${parseInt(ienNum, 10)}`;
      return wantDiag ? { refId, diag: { mapSource: ienFromHref ? 'href' : 'regex', mapDetail: 'isi-ien' } } : refId;
    }
  }

  // U.S. Patent references
  // Examples:
  // - "U.S. Patent No. 5,724,428"
  // - "US Patent No 5835600"
  // - "U.S. Patent #5,848,159"  (the "#" / "&#x0023;" form)
  // Canonical docId format in this repo is "US########".
  {
    const patentMatch = String(text || '').match(/\b(?:U\.?\s*S\.?|US)\s+Patent(?:\s+No\.?)?\s*[##]?\s*(\d[\d,\s]{5,})\b/i);
    if (patentMatch?.[1]) {
      const digits = String(patentMatch[1]).replace(/[^\d]/g, '');
      if (digits.length >= 6) {
        const refId = `US${digits}`;
        return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'us-patent-cite' } } : refId;
      }
    }
  }

  // NIST via DOI href
  if (/10\.6028\/NIST\.(.+)/i.test(href)) {
    const [, id] = href.match(/10\.6028\/NIST\.(.+)/i);
    { const refId = `NIST.${id}`; return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: 'nist-doi' } } : refId; }
  }
  // NIST FIPS (strip optional PUB)
  if (/NIST\s+FIPS\s+(?:PUB\s+)?(\d+)(-\d+)?/i.test(text)) {
    const [, num, rev] = text.match(/NIST\s+FIPS\s+(?:PUB\s+)?(\d+)(-\d+)?/i);
    { const refId = `NIST.FIPS.${num}${rev || ''}`; return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'nist-fips' } } : refId; }
  }
  // FIPS references that don't include contiguous "NIST FIPS" tokens, e.g.:
  // "National Institute ... (NIST). FIPS PUB 46-2: ..."
  if (/\bFIPS[\s-]+(?:PUB[\s-]+)?(\d+)(-\d+)?\b/i.test(text)) {
    const [, num, rev] = text.match(/\bFIPS[\s-]+(?:PUB[\s-]+)?(\d+)(-\d+)?\b/i);
    { const refId = `NIST.FIPS.${num}${rev || ''}`; return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'fips-generic' } } : refId; }
  }
  // FIPS structure in hrefs .../fips/186/2/...
  if (/csrc\.nist\.gov\/.+\/fips\/(\d+)(?:\/(\d+))?/i.test(href)) {
    const m = href.match(/fips\/(\d+)(?:\/(\d+))?/i);
    const num = m[1];
    const rev = m[2] ? `-${m[2]}` : '';
    { const refId = `NIST.FIPS.${num}${rev}`; return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: 'nist-fips-path' } } : refId; }
  }
  // NIST Special Publications in CSRC paths, e.g.:
  // - https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final
  {
    const m = String(href || '').match(/csrc\.nist\.gov\/publications\/detail\/sp\/(800-[0-9A-Za-z-]+)(?:\/rev-?([0-9]+))?/i);
    if (m?.[1]) {
      const sp = String(m[1]).toUpperCase();
      const rev = m[2] ? `r${m[2]}` : '';
      const refId = `NIST.SP.${sp}${rev}`;
      return wantDiag ? { refId, diag: { mapSource: 'href', mapDetail: 'nist-sp-path' } } : refId;
    }
  }
  // NIST SP references in citation text when DOI/path are absent, e.g.:
  // - "NIST 800-67, Rev. 2"
  // - "NIST SP 800-56A Rev. 3"
  {
    const src = String(text || '');
    const m = src.match(/\bNIST\b[\s\S]{0,120}?\b(?:SP|Special\s+Publication)?\s*(800-[0-9A-Za-z-]+)\b/i);
    if (m?.[1]) {
      const sp = String(m[1]).toUpperCase();
      const revMatch = src.match(/\bRev\.?\s*([0-9]+)\b/i);
      const rev = revMatch?.[1] ? `r${revMatch[1]}` : '';
      const refId = `NIST.SP.${sp}${rev}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'nist-sp-text' } } : refId;
    }
  }

  // Generic DOI normalization fallback.
  // Keep this after RFC/NIST-specific logic so canonical RFC/NIST mappings win.
  {
    const doiSource = `${String(text || '')} ${String(href || '')}`;
    const doiMatch = doiSource.match(/\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i);
    if (doiMatch?.[1]) {
      const raw = String(doiMatch[1] || '')
        .trim()
        .replace(/[>,.;:]+$/g, '');
      const normalized = raw
        .replace(/\//g, '-')
        .replace(/[()]/g, '_')
        .replace(/[^A-Za-z0-9._-]/g, '_');
      if (normalized) {
        const refId = normalized;
        return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'doi-generic' } } : refId;
      }
    }
  }

  // Generic ISBN normalization fallback.
  {
    const isbnSource = String(text || '');
    const isbnMatch = isbnSource.match(/\bISBN(?:-1[03])?(?:[.:]|\s)*([0-9Xx][0-9Xx\-\s]{8,24}[0-9Xx])\b/i);
    if (isbnMatch?.[1]) {
      const digits = String(isbnMatch[1] || '').replace(/[^0-9Xx]/g, '').toUpperCase();
      if (digits.length === 10 || digits.length === 13) {
        const refId = `ISBN.${digits}`;
        return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'isbn-generic' } } : refId;
      }
    }
  }

  // IEEE standards (generic)
  // Examples:
  // - "IEEE Std 1363a-2004"
  // - "IEEE Std 1003.1 -1988/Int, 1992 edition" (explicit refMap may still override)
  // - "IEEE 754:2008"
  {
    const src = String(text || '');
    const stdMatch = src.match(/\bIEEE\s+Std\.?\s*([0-9]{2,5}(?:\.[0-9A-Za-z]+)?[A-Za-z]?)(?:\s*[-:]\s*(\d{4})(?:\/[A-Za-z0-9.-]+)?)?/i);
    const genericMatch = src.match(/\bIEEE\s+([0-9]{2,5}(?:\.[0-9A-Za-z]+)?[A-Za-z]?)\s*[:\-]\s*(\d{4})\b/i);
    const m = stdMatch || genericMatch;
    if (m?.[1]) {
      const designator = String(m[1] || '').replace(/\s+/g, '').toUpperCase();
      const year = String(m[2] || '').trim() || ((src.match(/\b(19|20)\d{2}\b/) || [])[0] || '');
      if (designator) {
        const refId = `IEEE.STD${designator}${year ? `.${year}` : ''}`;
        return wantDiag
          ? { refId, diag: { mapSource: 'regex', mapDetail: stdMatch ? 'ieee-std' : 'ieee-generic' } }
          : refId;
      }
    }
  }

  // ITU-T / historical CCITT recommendations
  // Examples:
  // - "CCITT Recommendation X.509 (1988)"
  // - "CCITT Recommendation T.30 ... (1988)"
  // - "Fascicle III.4 - Recommendation G.711 ... 1972"
  // - "Recommendations X.400 - X.420 (1988 version)"
  {
    const yearMatch = String(text || '').match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : '';

    const range = String(text || '').match(/\bRecommendations?\s+([A-Z])\.(\d{1,4})\s*[-\u2013\u2014]\s*\1\.(\d{1,4})\b/i);
    if (range) {
      const series = String(range[1] || '').toUpperCase();
      const hi = parseInt(range[3], 10);
      const refId = `T-REC-${series}.${hi}${year ? `.${year}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'itut-range' } } : refId;
    }

    const rec = String(text || '').match(/\b(?:CCITT|ITU-?T)?[^\n\r]{0,80}?\bRecommendation(?:s)?\s+([A-Z])\.(\d{1,4})(?:-(\d+))?\b/i)
      || String(text || '').match(/\b([A-Z])\.(\d{1,4})(?:-(\d+))?\b(?=[^\n\r]{0,80}\bRecommendation\b)/i);
    if (rec) {
      const series = String(rec[1] || '').toUpperCase();
      const num = parseInt(rec[2], 10);
      const part = rec[3] ? `-${parseInt(rec[3], 10)}` : '';
      const refId = `T-REC-${series}.${num}${part}${year ? `.${year}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'itut-recommendation' } } : refId;
    }
  }

  // ITU-R / ITU-T recommendations carrying the sector token (broader than the block above,
  // which only catches the classic "Recommendation X.nnn" form). Matches a <standardnum> or
  // the designator embedded in prose.
  //   "ITU-R BT.601-5 (10/95)"        → R-REC-BT.601-5
  //   "Recommendation ITU-T G.694.2"  → T-REC-G.694.2
  //   "ITU-R TF.457-1"                → R-REC-TF.457-1
  {
    const m = String(text || '').match(/\b(?:Recommendation\s+)?ITU[-\s]?([RT])\s+(?:Rec(?:ommendation)?\.?\s+)?([A-Z]{1,2})\.?\s*(\d+(?:\.\d+)?)(?:-(\d+))?/i);
    if (m) {
      const sector = m[1].toUpperCase();
      const series = m[2].toUpperCase();
      const rev = m[4] ? `-${m[4]}` : '';
      const refId = `${sector}-REC-${series}.${m[3]}${rev}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'itu-recommendation' } } : refId;
    }
  }

  // ANSI committee standards: "ANSI S4.40-1992", "ANSI PH5.4-1970", "ANSI S4.6-1982 (R1992)".
  // (ANSI/SMPTE co-designations are handled by the legacy-SMPTE block — slash, not space.)
  {
    const m = String(text || '').match(/\bANSI\s+([A-Z]{1,4}\d{0,3})\.(\d+(?:\.\d+)?[A-Za-z]?)[\s‐-―-]+(\d{4})/i);
    if (m) {
      const refId = `ANSI.${m[1].toUpperCase()}.${m[2].toUpperCase()}.${m[3]}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'ansi-designator' } } : refId;
    }
  }

  // ANSI co-designations — drop the "ANSI/" and resolve to the inner org:
  //   "ANSI/SCTE 127 2007" → SCTE.127.2007    "ANSI/ASTM D638M-91" → ASTM.D638M.1991
  //   "ANSI/ASME B1.1-1989" → ASME.B1.1.1989  "ANSI/AIIM MS34-1990" → AIIM.MS34.1990
  {
    const m = String(text || '').match(/\bANSI[\/\s]([A-Z]{2,6})\s+([A-Z]{0,4}\d[\w.]*?)[\s‐-―-]+((?:19|20)?\d{2})\b/i);
    if (m) {
      const yr = m[3].length === 2 ? `19${m[3]}` : m[3];
      const refId = `${m[1].toUpperCase()}.${m[2].toUpperCase()}.${yr}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'ansi-codesignation' } } : refId;
    }
  }

  // AES (Audio Engineering Society): "AES3-2003", "AES3-3:2009" (part 3), "AES3-4-2009",
  // "AES11-2009 (r2014)" → AES3.2003 / AES3-3.2009
  {
    const m = String(text || '').match(/\bAES[-\s]?(\d{1,4}[A-Za-z]?)(?:-(\d{1,2}))?[\s:‐-―-]+(\d{4})/i);
    if (m) {
      const num = m[2] ? `${m[1].toUpperCase()}-${m[2]}` : m[1].toUpperCase();
      const refId = `AES${num}.${m[3]}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'aes-designator' } } : refId;
    }
  }

  // EBU (European Broadcasting Union): "EBU R48-1988", "EBU D84-1999",
  // "EBU Tech. 3250-E — Specification of … Third Edition 2004" → EBU.R48.1988 / EBU.Tech3250.2004
  // (year scanned from anywhere in the cite — it often trails the title, not the designator)
  {
    const m = String(text || '').match(/\bEBU\s+(?:Tech(?:nical)?\.?\s*(\d{1,4}[a-z]?)|([RD]\d{1,4}[A-Za-z]?))/i);
    if (m) {
      const series = m[1] ? `Tech${m[1]}` : m[2].toUpperCase();
      const y = (String(text || '').match(/\b(?:19|20)\d{2}\b/) || [])[0];
      const refId = `EBU.${series}${y ? `.${y}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'ebu-designator' } } : refId;
    }
  }

  // CIE: "CIE 15:2004", "CIE S001 (1986)", "CIE Publication 15.2 (1986)" → CIE.015.2004
  // (numeric CIE numbers zero-padded to 3 digits; an edition suffix like ".2" is dropped —
  //  the year distinguishes editions, matching registry docIds like CIE.015.2004)
  {
    const m = String(text || '').match(/\bCIE\s+(?:Publication\s+|Pub\.?\s+)?(S?\d{1,4})(?:\.\d+)?\b/i);
    if (m) {
      let num = m[1].toUpperCase();
      if (/^\d+$/.test(num)) num = num.padStart(3, '0');
      const y = (String(text || '').match(/\b(?:19|20)\d{2}\b/) || [])[0];
      const refId = `CIE.${num}${y ? `.${y}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'cie-designator' } } : refId;
    }
  }

  // IEEE standards: "IEEE Standard 1588-2008", "IEEE 802-1990", "... P754-2008" → IEEE.STD1588.2008
  {
    const m = String(text || '').match(/\bIEEE\s+(?:Std\.?\s+|Standard\s+(?:for\s+[^\n]{0,40}?)?)?P?(\d{2,4})(?:\.(\d+))?[\s‐-―-]+(\d{4})/i);
    if (m) {
      const refId = `IEEE.STD${m[1]}${m[2] ? `.${m[2]}` : ''}.${m[3]}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'ieee-designator' } } : refId;
    }
  }

  // ETSI: "ETSI TS 101 154", "ETSI ETS-300706", "ETSI EN 300 743" → ETSI.TS-101-154[.year]
  {
    const m = String(text || '').match(/\bETSI\s+(TS|TR|EN|ES|ETS|ETR)[\s‐-―-]+(\d[\d\s‐-―-]*\d)/i);
    if (m) {
      const num = m[2].replace(/[\s‐-―-]+/g, '-');
      const y = (String(text || '').match(/\b(?:19|20)\d{2}\b/) || [])[0];
      const refId = `ETSI.${m[1].toUpperCase()}-${num}${y ? `.${y}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'etsi-designator' } } : refId;
    }
  }

  // ARIB: "ARIB STD-B11", "ARIB TR-B4" → ARIB.STD-B11
  {
    const m = String(text || '').match(/\bARIB\s+(STD|TR)[\s‐-―-]*B[\s‐-―-]*(\d+)/i);
    if (m) {
      const refId = `ARIB.${m[1].toUpperCase()}-B${m[2]}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'arib-designator' } } : refId;
    }
  }

  // ATSC: "ATSC A/53", "ATSC A/65C" → ATSC.A53[.year]
  {
    const m = String(text || '').match(/\bATSC\s+A\/?\s*(\d+[A-Z]?)/i);
    if (m) {
      const y = (String(text || '').match(/\b(?:19|20)\d{2}\b/) || [])[0];
      const refId = `ATSC.A${m[1].toUpperCase()}${y ? `.${y}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'atsc-designator' } } : refId;
    }
  }

  // TIA: "TIA-232 (2002)", "TIA-604-5-E-2015" → TIA.232[.year]
  {
    const m = String(text || '').match(/\bTIA[\s‐-―-](\d{2,4}(?:-\d+)?)/i);
    if (m) {
      const y = (String(text || '').match(/\b(?:19|20)\d{2}\b/) || [])[0];
      const refId = `TIA.${m[1].toUpperCase()}${y ? `.${y}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'tia-designator' } } : refId;
    }
  }

  // EIA: "EIA-189-A", "EIA RS-170" → EIA.189-A / EIA.RS-170
  {
    const m = String(text || '').match(/\bEIA[\s‐-―-]+(RS[\s‐-―-]?\d+|\d{2,4}[\s‐-―-]?[A-Z]?)/i);
    if (m) {
      const id = m[1].replace(/[\s‐-―-]+/g, '-').toUpperCase().replace(/-+$/, '');
      return wantDiag
        ? { refId: `EIA.${id}`, diag: { mapSource: 'regex', mapDetail: 'eia-designator' } }
        : `EIA.${id}`;
    }
  }

  // DVB: "DVB-A010" → DVB.A010  (DVB/ETSI forms resolve via the ETSI block above)
  {
    const m = String(text || '').match(/\bDVB[\s‐-―-]([A-Z]?\d{2,4}[A-Za-z]?)\b/i);
    if (m) {
      const refId = `DVB.${m[1].toUpperCase()}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'dvb-designator' } } : refId;
    }
  }

  // CEA / ANSI-CEA (Consumer Electronics Association): "CEA-608-E (ANSI) (2008)", "CEA-708"
  // → CEA.608.2008  (revision letter dropped — the year distinguishes, matching registry docIds)
  {
    const m = String(text || '').match(/\b(?:ANSI[\/-])?CEA[\s‐-―-](\d{2,4})(?:[\s‐-―-][A-Z])?\b/i);
    if (m) {
      const y = (String(text || '').match(/\b(?:19|20)\d{2}\b/) || [])[0];
      const refId = `CEA.${m[1]}${y ? `.${y}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'cea-designator' } } : refId;
    }
  }

  // FCC (US Federal Communications Commission): "FCC 08-255-2008" → FCC.08-255.2008
  {
    const m = String(text || '').match(/\bFCC\s+(\d+(?:-\d+)*)[\s‐-―-]+((?:19|20)\d{2})\b/i);
    if (m) {
      const refId = `FCC.${m[1]}.${m[2]}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'fcc-designator' } } : refId;
    }
  }

  // ISO marker-first legacy forms seen in older RFCs:
  // e.g., "[ISO-10744] ... ISO/IEC 10744:1992 ..." or
  // "[ISO-8879] ... Part 1 ... 1987".
  {
    const mIsoMarker = String(text || '').match(/\bISO-([0-9]{3,6})\b/i);
    if (mIsoMarker) {
      const base = String(mIsoMarker[1] || '');
      const mIsoDesignator = String(text || '').match(
        /\bISO(?:\s*\/\s*IEC|\/IEC)?\s+([0-9]{3,6}(?:-[0-9A-Za-z]+)*)\s*:\s*((?:19|20)\d{2})\b/i
      );
      if (mIsoDesignator?.[1] && mIsoDesignator?.[2]) {
        const designator = String(mIsoDesignator[1]);
        const year = parseInt(mIsoDesignator[2], 10);
        // If the inline ISO/IEC designator matches the marker lineage,
        // preserve its specificity (e.g., 7498-1 -> ISO.7498-1.1994).
        if (designator === base || designator.startsWith(`${base}-`)) {
          const refId = `ISO.${designator}.${year}`;
          return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'iso-marker+designator' } } : refId;
        }
        // If the marker and designator disagree (legacy RFC quirk), keep marker base
        // but trust the explicit year from the designator (e.g., ISO-8879 vs ISO 8859-1:1987).
        const partMatch = String(text || '').match(/\bPart\s+([0-9]{1,3})\b/i);
        const part = partMatch ? `-${parseInt(partMatch[1], 10)}` : '';
        const refId = `ISO.${base}${part}.${year}`;
        return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'iso-marker-mismatch' } } : refId;
      }

      const partMatch = String(text || '').match(/\bPart\s+([0-9]{1,3})\b/i);
      const years = [...String(text || '').matchAll(/\b((?:19|20)\d{2})\b/g)]
        .map(m => parseInt(m[1], 10))
        .filter(y => String(y) !== base);
      const year = years.length ? Math.max(...years) : null;
      if (year) {
        const part = partMatch ? `-${parseInt(partMatch[1], 10)}` : '';
        const refId = `ISO.${base}${part}.${year}`;
        return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'iso-marker-legacy' } } : refId;
      }
    }
  }

  // ISO/IEC family — scan all occurrences and prefer matches that include year suffixes.
  const pickBestStdMatch = (re) => {
    const matches = [...String(text || '').matchAll(re)];
    if (!matches.length) return null;
    const scored = matches.map((m) => {
      const base = String(m[1] || '').trim();
      const suffix = String(m[2] || '');
      const years = suffix ? [...suffix.matchAll(/(\d{4})/g)].map((ym) => parseInt(ym[1], 10)) : [];
      const year = years.length ? Math.max(...years) : null;
      const specificity = base.includes('-') ? 1 : 0;
      const score = (year ? 100000 : 0) + (year || 0) + specificity;
      return { base, year, score };
    }).filter((v) => v.base);
    if (!scored.length) return null;
    scored.sort((a, b) => b.score - a.score);
    return scored[0];
  };

  {
    const best = pickBestStdMatch(/\bISO\s*\/\s*(?:IEC|CIE)\s+(?:(?:DIS|FDIS|CD|FCD|WD|PDTR|PDTS|CDV)[\s\/]+)?([\d\-]+)(:[\dA-Za-z+:\.-]+)?/ig);
    if (best) {
      const refId = `ISO.${best.base}${best.year ? `.${best.year}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'iso|iec designator' } } : refId;
    }
  }
  {
    const best = pickBestStdMatch(/\bISO(?!\s*\/\s*IEC|\/IEC)\s+(?:(?:DIS|FDIS|CD|FCD|WD|PDTR|PDTS|CDV)[\s\/]+)?([\d\-]+)(:[\dA-Za-z+:\.-]+)?/ig);
    if (best) {
      const refId = `ISO.${best.base}${best.year ? `.${best.year}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'iso designator' } } : refId;
    }
  }
  {
    const best = pickBestStdMatch(/\bISO-(\d+(?:-\d+)+)(:[\dA-Za-z+:\.-]+)?/ig);
    if (best) {
      const refId = `ISO.${best.base}${best.year ? `.${best.year}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'iso-hyphen-part designator' } } : refId;
    }
  }
  {
    const best = pickBestStdMatch(/\bISO-([\d\-]+)(:[\dA-Za-z+:\.-]+)?/ig);
    if (best) {
      const refId = `ISO.${best.base}${best.year ? `.${best.year}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'iso-hyphen designator' } } : refId;
    }
  }
  {
    const best = pickBestStdMatch(/\bIEC\s+([\d\-]+)(:[\dA-Za-z+:\.-]+)?/ig);
    if (best) {
      const refId = `IEC.${best.base}${best.year ? `.${best.year}` : ''}`;
      return wantDiag ? { refId, diag: { mapSource: 'regex', mapDetail: 'iec designator' } } : refId;
    }
  }

  return wantDiag ? { refId: null, diag: { mapSource: null, mapDetail: null } } : null;
}

// Extract references from a cheerio-loaded doc
// Returns: { references: {normative?, bibliographic?}, badRefs: [...] }
// opts.mode:
// - 'default' (legacy HTML list extraction)
// - 'ietf-xml' (xml2rfc references extraction)
// - 'ietf-rfc-html' (RFC HTML references sections)
function extractRefs($, currentDocId, opts = {}) {
  const mode = String(opts.mode || 'default').toLowerCase();
  const recordSightings = opts.recordSightings !== false;
  const out = { references: {}, badRefs: [], flags: [] };
  const parserDiag = {
    anchoredMarkers: 0,
    plainMarkers: 0,
    numberedItems: 0,
    proseBlocksTotal: 0,
    proseBlocksSkippedForAnchor: 0
  };

  function recordSighting(payload) {
    if (!recordSightings) return;
    mriRecordSighting(payload);
  }

  // Final guard: if a "bad ref" now resolves via parser/refMap, suppress it.
  // This prevents cases where one extraction path emits badRefs while another
  // path resolves the same citation in the same run.
  function suppressResolvableBadRefs() {
    if (!Array.isArray(out.badRefs) || !out.badRefs.length) return;
    const dedupe = new Set();
    out.badRefs = out.badRefs.filter((r) => {
      const docId = String(r?.docId || '').trim();
      const type = String(r?.type || '').trim();
      const refText = String(r?.refText || '').trim();
      const href = String(r?.href || '').trim();
      if (!refText && !href) return false;
      try {
        if (parseRefId(refText, href)) return false;
      } catch {}
      try {
        if (mapRefByCite(refText)) return false;
      } catch {}
      const key = [docId.toLowerCase(), type.toLowerCase(), refText.toLowerCase(), href.toLowerCase()].join('||');
      if (dedupe.has(key)) return false;
      dedupe.add(key);
      return true;
    });
  }

  function resolveXmlRefId(citeCandidates = [], hrefCandidates = []) {
    const cites = [...new Set(citeCandidates.map(v => String(v || '').trim()).filter(Boolean))];
    const hrefs = [...new Set(hrefCandidates.map(v => String(v || '').trim()).filter(Boolean))];
    const conciseCites = cites.filter(c => c.length <= 120);

    // 1) IETF draft shortcut
    // Prefer href-derived draft tokens when present (more authoritative than
    // wrapped/prose cite text), then fall back to cite-derived tokens.
    {
      const extractDraftTokens = (values = []) => {
        const out = [];
        for (const v of values) {
          const src = String(v || '').replace(/\s*-\s*/g, '-');
          const m = src.match(/\b(draft-[A-Za-z0-9._-]+)\b/i);
          if (!m?.[1]) continue;
          const token = String(m[1] || '')
            .replace(/[)\],.;:]+$/g, '')
            .replace(/\.(?:txt|xml|html?|pdf)$/i, '')
            .toLowerCase();
          // Reject false positives from generic filenames such as
          // "...preliminary-draft-4.pdf".
          if (/^draft-\d+(?:\.\d+)?$/.test(token)) continue;
          if (!/^draft-[a-z0-9]/i.test(token)) continue;
          out.push(token);
        }
        return out;
      };
      const pickLongest = (arr = []) => {
        const uniq = [...new Set(arr)];
        uniq.sort((a, b) => b.length - a.length);
        return uniq[0] || '';
      };
      const hrefToken = pickLongest(extractDraftTokens(hrefs));
      if (hrefToken) return `IETF.${hrefToken}`;
      const citeToken = pickLongest(extractDraftTokens(cites));
      if (citeToken) return `IETF.${citeToken}`;
    }

    // 2) canonical parser (cite + href), prioritize full cite variants first so
    // marker-only tokens (e.g., "ISO-8879") do not short-circuit richer text.
    for (const href of [...hrefs, '']) {
      for (const cite of [...cites, '']) {
        try {
          const parsed = parseRefId(cite, href);
          if (parsed && String(parsed).trim()) return String(parsed).trim();
        } catch {}
      }
    }
    // 2b) concise-only retry (cheap fallback)
    for (const href of [...hrefs, '']) {
      for (const cite of [...conciseCites, '']) {
        try {
          const parsed = parseRefId(cite, href);
          if (parsed && String(parsed).trim()) return String(parsed).trim();
        } catch {}
      }
    }

    // 3) direct RFC token shortcuts (fallback)
    for (const c of conciseCites) {
      const m = c.match(/^RFC(\d{3,5})$/i) || c.match(/\bRFC\s*[-\/\s]?(\d{3,5})\b/i);
      if (m?.[1]) return `RFC${parseInt(m[1], 10)}`;
    }
    for (const h of hrefs) {
      const m = h.match(/reference\.RFC\.(\d{3,5})\.xml/i) || h.match(/\/rfc(\d{3,5})\b/i);
      if (m?.[1]) return `RFC${parseInt(m[1], 10)}`;
    }

    // 4) explicit refMap cite mapping fallback
    for (const cite of cites) {
      const mapped = mapRefByCite(cite);
      if (mapped && String(mapped).trim()) return String(mapped).trim();
    }
    return null;
  }

  if (mode === 'ietf-rfc-html') {
    const sanitizeRfcHtmlHrefs = (hrefList = []) => (
      [...new Set(
        hrefList
          .map(v => String(v || '').trim())
          .filter(Boolean)
          // Ignore same-document anchors (e.g., #appendix-A.2); they are not external refs.
          .filter(h => !h.startsWith('#'))
      )]
    );
    const isOrdinalMarker = (markerRaw) => /^\d+(?:\.\d+)?$/.test(String(markerRaw || '').trim());
    const isRfcMarker = (markerRaw) => /^RFC[\s._-]*0*\d{1,5}$/i.test(String(markerRaw || '').trim());
    const trimRfcRefTail = (textRaw) => {
      const text = String(textRaw || '').replace(/\s+/g, ' ').trim();
      if (!text) return '';
      // Guard against spillover into post-reference sections when parsing the last ref in a block.
      // Do not trim on generic "Appendix" tokens because many valid references cite
      // "Appendix X.Y of ...", which must remain parseable.
      const tailStopRe = /\b(?:ACKNOWLEDGEMENTS?|AUTHORS?'?\s+ADDRESSES?|AUTHOR'?S\s+ADDRESS(?:ES)?|CHAIR,\s*EDITOR,\s*AND\s+AUTHORS?'?\s+ADDRESSES?|APPENDIX\s+[A-Z0-9]+(?:\s*(?:--|[-–—:])\s*)?\s*REFERENCE\s+IMPLEMENTATION|CHANGES?\s+FROM\s+RFC\s*\d{3,5})\b[\s\S]*$/i;
      return text.replace(tailStopRe, '').trim();
    };
    const normalizeMarker = (markerRaw) => {
      const marker = String(markerRaw || '')
        .trim()
        .replace(/^ref-/i, '')
        .replace(/^\[\s*([^\]]+?)\s*\]$/, '$1')
        .trim();
      const rfcMatch = marker.match(/^RFC[\s._-]*0*([0-9]{1,5})$/i);
      if (rfcMatch?.[1]) return `RFC${parseInt(rfcMatch[1], 10)}`;
      return marker;
    };
    const addRef = (key, refId) => {
      if (!refId) return;
      if (!out.references[key]) out.references[key] = [];
      out.references[key].push(refId);
    };
    const parsedMarkers = new Set();
    const parsedDtKeys = new Set();

    const parseStructuredDlReferences = (sectionKey, $root) => {
      if (!$root || !$root.length) return;
      $root.find('dl.references dt').each((_, dtEl) => {
        const $dt = $(dtEl);
        const markerRaw = String($dt.attr('id') || $dt.text() || '').trim();
        const marker = normalizeMarker(markerRaw);
        if (!marker) return;

        const dtGlobalIndex = $('dt').index(dtEl);
        const dtKey = `${sectionKey}::${dtGlobalIndex}::${marker}`;
        if (parsedDtKeys.has(dtKey)) return;
        parsedDtKeys.add(dtKey);
        parsedMarkers.add(marker);

        const $dds = $dt.nextUntil('dt').filter('dd');
        const $ctx = $dds.length ? $dds : $dt.parent();
        const ctxTextRaw = ($ctx.text() || '').replace(/\s+/g, ' ').trim();
        const ctxText = trimRfcRefTail(ctxTextRaw);
        const hrefs = sanitizeRfcHtmlHrefs(
          $ctx.find('a[href]')
            .map((__, linkEl) => String($(linkEl).attr('href') || '').trim())
            .get()
        );
        const markerText = marker.replace(/[_-]+/g, ' ').trim();
        const markerIsOrdinal = isOrdinalMarker(marker);
        const markerIsRfc = isRfcMarker(marker);
        const refId = markerIsRfc
          ? normalizeMarker(marker)
          : resolveXmlRefId(
            [
              ctxText,
              `${markerText} ${ctxText}`.trim(),
              ...(markerIsOrdinal ? [] : [marker, markerText])
            ],
            hrefs
          );

        if (refId) {
          addRef(sectionKey, refId);
          recordSighting({
            docId: currentDocId,
            type: sectionKey,
            refId,
            cite: marker,
            href: hrefs[0] || '',
            mapSource: 'ietf-rfc-html',
            mapDetail: 'dl.references dt/dd',
            rawRef: ctxText || marker,
            title: null
          });
        } else {
          out.badRefs.push({
            docId: currentDocId,
            type: sectionKey,
            refText: ctxText || markerText || marker,
            href: hrefs[0] || ''
          });
        }
      });
    };

    const isModernRfcHtml =
      $('meta[name="generator"][content*="xml2rfc" i]').length > 0
      || $('link[rel="alternate"][type="application/rfc+xml"]').length > 0
      || $('dl.references dt[id]').length > 0;

    if (isModernRfcHtml) {
      const parseByHeading = (headingSelector, key) => {
        $(headingSelector).each((_, hEl) => {
          const $section = $(hEl).closest('section');
          if ($section.length) parseStructuredDlReferences(key, $section);
        });
      };
      parseByHeading('h3#name-normative-references', 'normative');
      parseByHeading('h3#name-informative-references', 'bibliographic');

      // ID/text fallbacks for modern-ish markup variants.
      $('section').each((_, secEl) => {
        const $sec = $(secEl);
        const secId = String($sec.attr('id') || '').toLowerCase();
        const headText = $sec.children('h2,h3').first().text().replace(/\s+/g, ' ').trim().toLowerCase();
        if (/normative-references/.test(secId) || /normative references/.test(headText)) {
          parseStructuredDlReferences('normative', $sec);
        } else if (/informative-references/.test(secId) || /informative references/.test(headText)) {
          parseStructuredDlReferences('bibliographic', $sec);
        }
      });

      // Some RFCs keep all refs under a single "References" section with no split.
      const splitPresent =
        (Array.isArray(out.references.normative) && out.references.normative.length > 0)
        || (Array.isArray(out.references.bibliographic) && out.references.bibliographic.length > 0);
      if (!splitPresent) {
        $('h2#name-references').each((_, hEl) => {
          const $section = $(hEl).closest('section');
          if ($section.length) parseStructuredDlReferences('bibliographic', $section);
        });
        $('section').each((_, secEl) => {
          const $sec = $(secEl);
          const secId = String($sec.attr('id') || '').toLowerCase();
          const headText = $sec.children('h2,h3').first().text().replace(/\s+/g, ' ').trim().toLowerCase();
          if (/references/.test(secId) || /^references(?: and (?:bibliography|citations))?$/.test(headText)) {
            parseStructuredDlReferences('bibliographic', $sec);
          }
        });
      }
    }

    const sectionDefs = [
      {
        key: 'normative',
        selectors: [
          'section#normative-references',
          'section[id*="normative"]'
        ]
      },
      {
        key: 'bibliographic',
        selectors: [
          'section#informative-references',
          'section[id*="informative"]'
        ]
      }
    ];

    for (const def of sectionDefs) {
      for (const sel of def.selectors) {
        $(sel).each((_, secEl) => {
          const $sec = $(secEl);
          $sec.find('a[id^="ref-"]').each((__, aEl) => {
            const $a = $(aEl);
            const rawId = String($a.attr('id') || '').trim();
            if (!rawId) return;

            const marker = normalizeMarker(rawId.replace(/^ref-/i, ''));
            parsedMarkers.add(marker);
            const markerText = marker.replace(/[_-]+/g, ' ').trim();
            const $ctx = $a.closest('li, p, dt, dd, div').first();
            const ctxTextRaw = (($ctx.length ? $ctx.text() : $a.parent().text()) || '')
              .replace(/\s+/g, ' ')
              .trim();
            const ctxText = ctxTextRaw;
            const hrefs = sanitizeRfcHtmlHrefs(
              ($ctx.length ? $ctx.find('a[href]') : $a.parent().find('a[href]'))
                .map((___, linkEl) => String($(linkEl).attr('href') || '').trim())
                .get()
            );

            const markerIsOrdinal = isOrdinalMarker(marker);
            const citeCandidates = [
              ctxText,
              ...(markerIsOrdinal ? [] : [marker, markerText]),
              String($a.text() || '').trim()
            ];
            // If the anchor id itself is an RFC marker (e.g., ref-RFC 1327),
            // prefer that explicit target over incidental RFC links in the
            // citation prose (e.g., "... ISO 10021 and RFC 822 ...").
            const refId = isRfcMarker(marker)
              ? normalizeMarker(marker)
              : resolveXmlRefId(citeCandidates, hrefs);

            if (refId) {
              addRef(def.key, refId);
              recordSighting({
                docId: currentDocId,
                type: def.key,
                refId,
                cite: marker || markerText || ctxText,
                href: hrefs[0] || '',
                mapSource: 'ietf-rfc-html',
                mapDetail: rawId,
                rawRef: ctxText || marker || null,
                title: null
              });
            } else {
              out.badRefs.push({
                docId: currentDocId,
                type: def.key,
                refText: ctxText || markerText || marker,
                href: hrefs[0] || ''
              });
            }
          });
        });
      }
    }

    // Fallback for classic RFC HTML layout (preformatted refs with ref-* anchors).
    // Run even when structured parsing found some refs, to pick up markers split by page breaks.
    {
      const raw = String(opts.htmlRaw || $.html() || '');
      const findHeadingPositions = (re) => {
        const pos = [];
        let m;
        while ((m = re.exec(raw)) !== null) pos.push(m.index);
        return pos;
      };
      // Prefer true RFC heading markup (span.h2/h3 + section selflink) over text fallbacks.
      const normHeadingRe = /<span[^>]*class=["'][^"']*\bh[23]\b[^"']*["'][^>]*>\s*<a[^>]*\bid=["']section-[^"']+["'][^>]*>[^<]*<\/a>\.?(?:\s|&nbsp;)*Normative\s+References(?:\s|&nbsp;)*<\/span>/ig;
      const infoHeadingRe = /<span[^>]*class=["'][^"']*\bh[23]\b[^"']*["'][^>]*>\s*<a[^>]*\bid=["']section-[^"']+["'][^>]*>[^<]*<\/a>\.?(?:\s|&nbsp;)*Informative\s+References(?:\s|&nbsp;)*<\/span>/ig;
      const refsHeadingRe = /<span[^>]*class=["'][^"']*\bh[23]\b[^"']*["'][^>]*>\s*<a[^>]*\bid=["']section-[^"']+["'][^>]*>[^<]*<\/a>(?:\s|&nbsp;|<a[^>]*>[^<]*<\/a>)*\.?(?:\s*(?:--|[-–—:])\s*)?(?:\s|&nbsp;)*References(?:\s+and\s+(?:Bibliography|Citations))?(?:\s|&nbsp;)*<\/span>/ig;
      // Appendix-style reference headings are common in older RFC HTML renderings.
      const refsHeadingAppendixRe = /<span[^>]*class=["'][^"']*\bh[23]\b[^"']*["'][^>]*>\s*<a[^>]*\bid=["']appendix-[^"']+["'][^>]*>[^<]*<\/a>\.?(?:\s|&nbsp;)*(?:Appendix(?:es)?(?:\s+[A-Z0-9]+)?(?:\s*(?:--|[-–—:])\s*)?)?References(?:\s+and\s+(?:Bibliography|Citations))?(?:\s|&nbsp;)*<\/span>/ig;
      // Some RFCs place citations under appendix headings such as
      // "Appendix E: Recommended reading".
      const recommendedReadingAppendixRe = /<span[^>]*class=["'][^"']*\bh[23]\b[^"']*["'][^>]*>\s*<a[^>]*\bid=["']appendix-[^"']+["'][^>]*>[^<]*<\/a>\.?(?:\s|&nbsp;)*(?:Appendix(?:es)?(?:\s+[A-Z0-9]+)?(?:\s*(?:--|[-–—:])\s*)?)?Recommended\s+reading(?:\s|&nbsp;)*<\/span>/ig;
      // Plain-text heading fallbacks (line-start only). These are strict to avoid
      // matching prose mentions of "references" elsewhere in the document body.
      const normHeadingLineRe = /(?:^|\n)\s*(?:\d+(?:\.\d+)?)?\.?\s*Normative\s+References\s*(?=\n|$)/ig;
      const infoHeadingLineRe = /(?:^|\n)\s*(?:\d+(?:\.\d+)?)?\.?\s*Informative\s+References\s*(?=\n|$)/ig;
      const refsHeadingLineRe = /(?:^|\n)\s*(?:\d+(?:\.\d+)?)?\.?\s*References(?:\s+and\s+(?:Bibliography|Citations))?\s*(?=\n|$)/ig;
      const refsHeadingAppendixLineRe = /(?:^|\n)\s*Appendix(?:es)?\s+[A-Z0-9]+(?:\s*(?:--|[-–—:])\s*)?\s*References(?:\s+and\s+(?:Bibliography|Citations))?\s*(?=\n|$)/ig;
      const recommendedReadingAppendixLineRe = /(?:^|\n)\s*Appendix(?:es)?\s+[A-Z0-9]+(?:\s*(?:--|[-–—:])\s*)?\s*Recommended\s+reading\s*(?=\n|$)/ig;
      // Older RFC pages can use a preformatted bibliography header instead of "References":
      // <hr class='noprint'/><!--NewPage--><pre class='newpage'>... Bibliography ... BIBLIOGRAPHY ...
      // Keep this strict to avoid treating incidental prose as a reference boundary.
      const bibliographyPreHeadingRe = /<hr[^>]*class=["'][^"']*\bnoprint\b[^"']*["'][^>]*>\s*<!--\s*NewPage\s*-->\s*<pre[^>]*class=["'][^"']*\bnewpage\b[^"']*["'][^>]*>[\s\S]{0,1400}?(?:^|\n)\s*Bibliography\s*(?:\n|$)[\s\S]{0,900}?(?:^|\n)\s*BIBLIOGRAPHY\s*(?:\n|$)/gim;

      let normPositions = findHeadingPositions(normHeadingRe);
      let infoPositions = findHeadingPositions(infoHeadingRe);
      const bibliographyPrePositions = findHeadingPositions(bibliographyPreHeadingRe);
      let refsPositions = findHeadingPositions(refsHeadingRe);
      refsPositions = refsPositions.concat(findHeadingPositions(refsHeadingAppendixRe));
      refsPositions = refsPositions.concat(findHeadingPositions(recommendedReadingAppendixRe));
      if (!normPositions.length) normPositions = findHeadingPositions(normHeadingLineRe);
      if (!infoPositions.length) infoPositions = findHeadingPositions(infoHeadingLineRe);
      if (!refsPositions.length) refsPositions = findHeadingPositions(refsHeadingLineRe);
      refsPositions = refsPositions.concat(findHeadingPositions(refsHeadingAppendixLineRe));
      refsPositions = refsPositions.concat(findHeadingPositions(recommendedReadingAppendixLineRe));
      refsPositions = refsPositions.concat(bibliographyPrePositions);
      // When we have the strict old-RFC bibliography preformatted heading and
      // no explicit normative/informative split, prefer that boundary over any
      // earlier generic "References" hits (e.g., table-of-contents lines).
      if (bibliographyPrePositions.length && !normPositions.length && !infoPositions.length) {
        const firstBibPos = Math.min(...bibliographyPrePositions);
        refsPositions = refsPositions.filter((p) => p >= firstBibPos);
        if (!refsPositions.length) refsPositions = [firstBibPos];
      }
      refsPositions = Array.from(new Set(refsPositions)).sort((a, b) => a - b);
      const hasNorm = normPositions.length > 0;
      const hasInfo = infoPositions.length > 0;
      const hasRefs = refsPositions.length > 0;
      const lastAtOrBefore = (arr, pos) => {
        let out = -1;
        for (const p of arr) {
          if (p <= pos && p > out) out = p;
        }
        return out;
      };
      const bounds = [];
      for (const p of normPositions) bounds.push({ pos: p, key: 'normative' });
      for (const p of infoPositions) bounds.push({ pos: p, key: 'bibliographic' });
      if (!bounds.length && refsPositions.length) {
        for (const p of refsPositions) bounds.push({ pos: p, key: 'bibliographic' });
      }
      bounds.sort((a, b) => a.pos - b.pos);
      const firstRefSectionPos = bounds.length ? bounds[0].pos : -1;
      const allSectionHeadingPositions = [];
      {
        const sectionHeadingRe = /<span[^>]*>\s*<a[^>]*\bid=["'](?:section|appendix)-[^"']+["'][^>]*>/ig;
        let hm;
        while ((hm = sectionHeadingRe.exec(raw)) !== null) {
          allSectionHeadingPositions.push(hm.index);
        }
      }
      const classifyPosByBounds = (pos) => {
        for (let i = 0; i < bounds.length; i++) {
          const start = bounds[i].pos;
          const end = i + 1 < bounds.length ? bounds[i + 1].pos : raw.length;
          if (pos >= start && pos < end) return bounds[i].key;
        }
        return null;
      };
      const boundEndForPos = (pos) => {
        for (let i = 0; i < bounds.length; i++) {
          const start = bounds[i].pos;
          const end = i + 1 < bounds.length ? bounds[i + 1].pos : raw.length;
          if (pos >= start && pos < end) return end;
        }
        return raw.length;
      };
      const nextSectionHeadingPos = (pos) => {
        for (const p of allSectionHeadingPositions) {
          if (p > pos) return p;
        }
        return raw.length;
      };
      const nextPageBreakPos = (pos) => {
        const rel = raw.slice(pos);
        const markers = [
          /<!--\s*NewPage\s*-->/i,
          /<hr[^>]*class=["'][^"']*\bnoprint\b[^"']*["'][^>]*>/i,
          /<span[^>]*class=["'][^"']*\bgrey\b[^"']*["'][^>]*>/i
        ];
        let best = -1;
        for (const re of markers) {
          const m = re.exec(rel);
          if (!m) continue;
          const idx = pos + m.index;
          if (best < 0 || idx < best) best = idx;
        }
        return best >= 0 ? best : raw.length;
      };
      const nextLineRefMarkerPos = (pos) => {
        // Find next bracketed ref marker at line start (plain or anchor), e.g.:
        // [Dyer 87] ...  or  [<a id="ref-IEN-116">IEN-116</a>] ...
        const rel = raw.slice(pos + 1);
        const m = /(?:^|\n)\s*\[(?:\s*<a[^>]*id=["']ref-[^"']+["'][^>]*>\s*)?[^\]\n<]{1,96}(?:\s*<\/a>)?\s*\]/i.exec(rel);
        if (!m) return raw.length;
        return pos + 1 + m.index;
      };

      const re = /<a[^>]+id=["']ref-([^"']+)["'][^>]*>/ig;
      const anchors = [];
      let m;
      while ((m = re.exec(raw)) !== null) {
        anchors.push({
          marker: normalizeMarker(String(m[1] || '').trim()),
          index: m.index,
          end: re.lastIndex
        });
      }
      parserDiag.anchoredMarkers += anchors.length;
      const anchoredResolvedRanges = [];
      for (let i = 0; i < anchors.length; i++) {
        const marker = anchors[i].marker;
        if (!marker) continue;

        const pos = anchors[i].index;
        if (firstRefSectionPos >= 0 && pos < firstRefSectionPos) continue;
        let key = classifyPosByBounds(pos);
        if (!key) continue;
        // Rules:
        // 1) If Normative/Informative headings exist, use nearest preceding one for each anchor.
        // 2) If neither exists and only References exists, refs go to bibliographic.
        if (!key && (hasNorm || hasInfo)) {
          const nPos = lastAtOrBefore(normPositions, pos);
          const iPos = lastAtOrBefore(infoPositions, pos);
          if (nPos >= 0 || iPos >= 0) {
            key = nPos > iPos ? 'normative' : 'bibliographic';
          }
        } else if (!key && hasRefs) {
          const rPos = lastAtOrBefore(refsPositions, pos);
          if (rPos >= 0) key = 'bibliographic';
        }

        // If we cannot confidently place the anchor in a refs block, skip it.
        if (!key) continue;
        const nextStart = (i + 1 < anchors.length) ? anchors[i + 1].index : raw.length;
        // Start scanning for the next marker after this anchor, so we don't
        // immediately match the current marker line and drop its citation text.
        const nextBracketMarker = nextLineRefMarkerPos(anchors[i].end);
        const sectionEnd = boundEndForPos(pos);
        const headingEnd = nextSectionHeadingPos(pos);
        const pageBreakEnd = nextPageBreakPos(pos);
        const chunkEnd = Math.min(nextStart, nextBracketMarker, sectionEnd, headingEnd, pageBreakEnd);
        const chunk = raw.slice(anchors[i].index, chunkEnd);
        // Treat each anchored marker as a single reference block. If multiple
        // prose references follow without markers, only parse the first paragraph
        // here; remaining blocks are handled by prose fallback below.
        const anchorChunk = chunk.split(/\n\s*\n+/)[0] || chunk;
        const hrefs = sanitizeRfcHtmlHrefs([...anchorChunk.matchAll(/href=["']([^"']+)["']/ig)]
          .map(hm => String(hm[1] || '').trim())
        );
        const chunkText = anchorChunk
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const cleanedChunkText = trimRfcRefTail(chunkText);
        const markerText = marker.replace(/[_-]+/g, ' ').trim();
        const markerIsOrdinal = isOrdinalMarker(marker);
        const markerIsRfc = isRfcMarker(marker);
        const refId = markerIsRfc
          ? normalizeMarker(marker)
          : resolveXmlRefId(
            [
              cleanedChunkText || chunkText,
              ...(markerIsOrdinal ? [] : [marker, markerText]),
              ...(markerIsRfc ? [`RFC ${marker.replace(/^RFC/i, '')}`] : []),
            ],
            hrefs
          );
        if (refId) {
          addRef(key, refId);
          if (markerIsRfc) {
            anchoredResolvedRanges.push({ start: anchors[i].index, end: chunkEnd });
          }
          recordSighting({
            docId: currentDocId,
            type: key,
            refId,
            cite: marker,
            href: hrefs[0] || '',
            mapSource: 'ietf-rfc-html-fallback',
            mapDetail: 'ref-anchor',
            rawRef: cleanedChunkText || chunkText || marker,
            title: null
          });
        } else {
          out.badRefs.push({
            docId: currentDocId,
            type: key,
            refText: cleanedChunkText || chunkText || marker,
            href: hrefs[0] || ''
          });
        }
      }

      // Plain unanchored bracket-marker fallback within reference bounds only.
      // Examples: [Dyer 87], [Quarterman 86]
      // Intentionally excludes markers that start with '<' to avoid grammar
      // constructs like [<TTL>] and other non-citation syntax.
      const plainMarkerRe = /(^|\n)(\s*)\[(?!\s*<)([^\]\n<>{]{1,96})\]\s*/ig;
      const plainSeen = new Set();
      for (let b = 0; b < bounds.length; b++) {
        const start = bounds[b].pos;
        const end = b + 1 < bounds.length ? bounds[b + 1].pos : raw.length;
        if (end <= start) continue;

        const sectionSlice = raw.slice(start, end);
        let pm;
        while ((pm = plainMarkerRe.exec(sectionSlice)) !== null) {
          const prefixLen = (pm[1] ? pm[1].length : 0) + (pm[2] ? pm[2].length : 0);
          const absPos = start + pm.index + prefixLen;
          let markerText = String(pm[3] || '').replace(/\s+/g, ' ').trim();
          if (!markerText) continue;
          // Skip numeric-only markers; these are often list ordinals and too ambiguous.
          if (/^\d+(?:\.\d+)?$/.test(markerText)) continue;

          const key = classifyPosByBounds(absPos);
          if (!key) continue;

          const dedupeKey = `${key}@@${absPos}@@${markerText.toLowerCase()}`;
          if (plainSeen.has(dedupeKey)) continue;
          plainSeen.add(dedupeKey);
          parserDiag.plainMarkers += 1;

          const nextMarkerStart = nextLineRefMarkerPos(absPos);
          const sectionEnd = boundEndForPos(absPos);
          const headingEnd = nextSectionHeadingPos(absPos);
          const pageBreakEnd = nextPageBreakPos(absPos);
          const chunkEnd = Math.min(nextMarkerStart, sectionEnd, headingEnd, pageBreakEnd);
          if (chunkEnd <= absPos) continue;

          const chunk = raw.slice(absPos, chunkEnd);
          const hrefs = sanitizeRfcHtmlHrefs([...chunk.matchAll(/href=["']([^"']+)["']/ig)]
            .map(hm => String(hm[1] || '').trim())
          );
          const chunkText = chunk
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const cleanedChunkText = trimRfcRefTail(chunkText);

          const refId = resolveXmlRefId([cleanedChunkText || chunkText, markerText], hrefs);
          if (refId) {
            addRef(key, refId);
            recordSighting({
              docId: currentDocId,
              type: key,
              refId,
              cite: markerText,
              href: hrefs[0] || '',
              mapSource: 'ietf-rfc-html-fallback',
              mapDetail: 'ref-bracket',
              rawRef: cleanedChunkText || chunkText || markerText,
              title: null
            });
          } else {
            out.badRefs.push({
              docId: currentDocId,
              type: key,
              refText: cleanedChunkText || chunkText || markerText,
              href: hrefs[0] || ''
            });
          }
        }
        plainMarkerRe.lastIndex = 0;
      }

      // Numbered list fallback for older RFC HTML pages where reference entries
      // are plain numbered lines (e.g., "1. ...") without ref-* anchors.
      for (let b = 0; b < bounds.length; b++) {
        const start = bounds[b].pos;
        const end = b + 1 < bounds.length ? bounds[b + 1].pos : raw.length;
        if (end <= start) continue;
        const key = bounds[b].key;
        const sectionSlice = raw.slice(start, end);
        const numberedRe = /(?:^|\n)\s{0,8}(\d{1,3})\.\s{1,6}([\s\S]*?)(?=(?:\n\s{0,8}\d{1,3}\.\s{1,6})|$)/g;
        let nm;
        while ((nm = numberedRe.exec(sectionSlice)) !== null) {
          const markerNo = String(nm[1] || '').trim();
          const chunk = String(nm[0] || '').trim();
          if (!chunk) continue;
          parserDiag.numberedItems += 1;
          const hrefs = sanitizeRfcHtmlHrefs([...chunk.matchAll(/href=["']([^"']+)["']/ig)]
            .map((hm) => String(hm[1] || '').trim())
          );
          const chunkText = chunk
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const cleanedChunkText = trimRfcRefTail(chunkText);
          if (!cleanedChunkText) continue;

          const refId = resolveXmlRefId([cleanedChunkText], hrefs);
          if (refId) {
            addRef(key, refId);
            recordSighting({
              docId: currentDocId,
              type: key,
              refId,
              cite: markerNo ? `[${markerNo}]` : cleanedChunkText,
              href: hrefs[0] || '',
              mapSource: 'ietf-rfc-html-fallback',
              mapDetail: 'ref-numbered',
              rawRef: cleanedChunkText,
              title: null
            });
          } else {
            // Only emit as badRef when numbered text looks citation-like;
            // this avoids appendix/procedure step leakage (e.g., examples).
            const looksCitationLike = /\b(19|20)\d{2}\b/.test(cleanedChunkText)
              || /\bRFC\s*[0-9]{3,5}\b/i.test(cleanedChunkText)
              || /\b(?:ISO|IEC|IEEE|STD|IETF|draft-ietf)\b/i.test(cleanedChunkText)
              || /["“][^"”]{8,}["”]/.test(cleanedChunkText)
              || /\b[A-Z][A-Za-z'`.-]+,\s*[A-Z]\./.test(cleanedChunkText);
            if (looksCitationLike) {
              out.badRefs.push({
                docId: currentDocId,
                type: key,
                refText: cleanedChunkText,
                href: hrefs[0] || ''
              });
            }
          }
        }
      }

      // Prose-block fallback for older RFC pages where references are plain
      // paragraph-like entries separated by blank lines (no markers/numbering).
      for (let b = 0; b < bounds.length; b++) {
        const start = bounds[b].pos;
        const end = b + 1 < bounds.length ? bounds[b + 1].pos : raw.length;
        if (end <= start) continue;
        const key = bounds[b].key;
        const sectionSlice = raw.slice(start, end);
        const sectionHeadText = sectionSlice
          .slice(0, 600)
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/ig, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const recommendedReadingBound = /\bRecommended\s+reading\b/i.test(sectionHeadText);
        // Split prose references by blank lines and by likely author-start lines.
        // Older RFC HTML sometimes omits blank lines between adjacent references.
        const blocks = sectionSlice
          .split(/\n\s*\n+/)
          .flatMap((chunk) => String(chunk || '').split(/(?=\n\s*[A-Z][A-Za-z'`.-]+,\s*[A-Z]\.)/));
        const proseSeen = new Set();
        for (const blockRaw of blocks) {
          const block = String(blockRaw || '');
          if (!block.trim()) continue;
          parserDiag.proseBlocksTotal += 1;
          const blockTextForStop = block
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/ig, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          // Stop parsing this reference bound once we hit obvious post-reference headings.
          const appendixHeading =
            /^APPENDIX(?:ES)?\b/i.test(blockTextForStop)
            // Older RFC HTML often embeds appendix headings with selflink markup
            // and page header text before "Appendix ...", so anchor-id detection
            // is a reliable boundary signal.
            || /\bid=["']appendix-[^"']+["']/i.test(block)
            // Catch inline appendix headings even when not at column 0.
            || /\bAppendix(?:es)?\s+[A-Z0-9]+\b\s*(?:\.|:|--|-)/i.test(blockTextForStop);
          if (/^(?:\d+(?:\.\d+)?)?\s*\.?\s*AUTHOR'?S?\s+ADDRESS(?:ES)?\b/i.test(blockTextForStop)
            || /^(?:\d+(?:\.\d+)?)?\s*\.?\s*CHAIR,\s*EDITOR,\s*AND\s+AUTHORS?'?\s+ADDRESSES?\b/i.test(blockTextForStop)
            || /^(?:\d+(?:\.\d+)?)?\s*\.?\s*ACKNOWLEDGEMENTS?\b/i.test(blockTextForStop)
            || (appendixHeading && !recommendedReadingBound)
            || /^(?:[A-Z]\s*\.\s*)?Changes?\s+(?:since|from)\s+RFC\s*\d{3,5}\b/i.test(blockTextForStop)) {
            break;
          }
          // Skip entries already handled by marker-based and numbered fallbacks.
          if (/\[\s*(?:<a[^>]*id=["']ref-[^"']+["'][^>]*>)?/i.test(block)) {
            parserDiag.proseBlocksSkippedForAnchor += 1;
            continue;
          }
          if (/(?:^|\n)\s{0,8}\d{1,3}\.\s{1,6}/.test(block)) continue;

          const hrefs = sanitizeRfcHtmlHrefs([...block.matchAll(/href=["']([^"']+)["']/ig)]
            .map((hm) => String(hm[1] || '').trim())
          );
          const chunkText = block
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/ig, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const cleanedChunkText = trimRfcRefTail(chunkText);
          if (!cleanedChunkText || cleanedChunkText.length < 28) continue;
          if (/^references?(?:\s+and\s+(?:bibliography|citations))?$/i.test(cleanedChunkText)) continue;

          const seenKey = cleanedChunkText.toLowerCase();
          if (proseSeen.has(seenKey)) continue;
          proseSeen.add(seenKey);

          const refId = resolveXmlRefId([cleanedChunkText], hrefs);
          if (refId) {
            addRef(key, refId);
            recordSighting({
              docId: currentDocId,
              type: key,
              refId,
              cite: cleanedChunkText,
              href: hrefs[0] || '',
              mapSource: 'ietf-rfc-html-fallback',
              mapDetail: 'ref-prose',
              rawRef: cleanedChunkText,
              title: null
            });
          } else {
            // Only emit as badRef when it looks citation-like to limit noise.
            const looksCitationLike = /\b(19|20)\d{2}\b/.test(cleanedChunkText)
              || /\bRFC\s*[0-9]{3,5}\b/i.test(cleanedChunkText)
              || /\b(?:ISO|IEC|IEEE|STD)\b/i.test(cleanedChunkText)
              || /["“][^"”]{8,}["”]/.test(cleanedChunkText);
            if (looksCitationLike) {
              out.badRefs.push({
                docId: currentDocId,
                type: key,
                refText: cleanedChunkText,
                href: hrefs[0] || ''
              });
            }
          }
        }
      }

      // Secondary fallback: parse RFC numbers directly from reference-section text ranges.
      // This catches cases where ref-* anchor ids are missing/altered across page breaks.
      const addRfcFromSlice = (slice, key, sliceStart = 0) => {
        if (!slice || !key) return;
        const matchSlice = String(slice || '')
          .replace(/<span[^>]*class=["'][^"']*\bgrey\b[^"']*["'][^>]*>[\s\S]*?<\/span>/ig, (m) => ' '.repeat(m.length))
          .replace(/<!--\s*NewPage\s*-->/ig, (m) => ' '.repeat(m.length))
          .replace(/<hr[^>]*class=["'][^"']*\bnoprint\b[^"']*["'][^>]*>/ig, (m) => ' '.repeat(m.length));
        // Stop RFC-token harvesting once we leave the references body.
        const postRefStopRe = /<span[^>]*class=["'][^"']*\bh2\b[^"']*["'][^>]*>\s*<a[^>]*\bid=["'](?:section|appendix)-[^"']+["'][^>]*>[^<]*<\/a>\.?(?:\s|&nbsp;)*(?:Security\s+Considerations|Acknowledgements?|Author'?s?\s+Address(?:es)?|Chair,\s*Editor,\s*and\s+Authors?'?\s+Addresses?)\b[\s\S]*$/i;
        const appendixChangesRe = /\bAppendix\b[\s\S]{0,120}\bchanges\s+since\s+RFC\s*\d{3,5}\b[\s\S]*$/i;
        const appendixChangesFromRe = /\bAppendix\b[\s\S]{0,120}\bchanges\s+from\s+RFC\s*\d{3,5}\b[\s\S]*$/i;
        const appendixDeltaHeadingRe = /<span[^>]*class=["'][^"']*\bh[23]\b[^"']*["'][^>]*>\s*<a[^>]*\bid=["']appendix-[^"']+["'][^>]*>[^<]*<\/a>\.?(?:\s|&nbsp;)*(?:Changes?\s+(?:since|from)\s+(?:<a[^>]*>\s*)?RFC\s*\d{3,5}(?:\s*<\/a>)?)\b[\s\S]*$/i;
        const genericChangesDeltaRe = /\bChanges?\s+(?:since|from)\s+RFC\s*\d{3,5}\b[\s\S]*$/i;
        const trimmedSlice = matchSlice
          .replace(postRefStopRe, (m) => ' '.repeat(m.length))
          .replace(appendixChangesRe, (m) => ' '.repeat(m.length))
          .replace(appendixChangesFromRe, (m) => ' '.repeat(m.length))
          .replace(appendixDeltaHeadingRe, (m) => ' '.repeat(m.length))
          .replace(genericChangesDeltaRe, (m) => ' '.repeat(m.length));
        const isInsideAnchoredResolvedRange = (relIdx) => {
          const absIdx = sliceStart + relIdx;
          return anchoredResolvedRanges.some((r) => absIdx >= r.start && absIdx < r.end);
        };
        const pushId = (id) => {
          if (!id) return;
          if (String(id) === String(currentDocId)) return;
          addRef(key, id);
          recordSighting({
            docId: currentDocId,
            type: key,
            refId: id,
            cite: id,
            href: '',
            mapSource: 'ietf-rfc-html-fallback',
            mapDetail: 'rfc-text',
            rawRef: id,
            title: null
          });
        };
        const set = new Set();
        let rm;
        const bracketRe = /\[\s*(?:<a[^>]*>)?\s*RFC\s*([0-9]{3,5})\s*(?:<\/a>)?\s*\]/ig;
        while ((rm = bracketRe.exec(trimmedSlice)) !== null) {
          if (isInsideAnchoredResolvedRange(rm.index)) continue;
          set.add(`RFC${parseInt(rm[1], 10)}`);
        }
        const hrefRe = /href=["'][^"']*\/rfc([0-9]{3,5})(?:[.#?/"'][^"']*)?["']/ig;
        while ((rm = hrefRe.exec(trimmedSlice)) !== null) {
          if (isInsideAnchoredResolvedRange(rm.index)) continue;
          set.add(`RFC${parseInt(rm[1], 10)}`);
        }
        const bareRe = /\bRFC\s*([0-9]{3,5})\b/ig;
        while ((rm = bareRe.exec(trimmedSlice)) !== null) {
          if (isInsideAnchoredResolvedRange(rm.index)) continue;
          set.add(`RFC${parseInt(rm[1], 10)}`);
        }
        for (const id of set) pushId(id);
      };

      for (let i = 0; i < bounds.length; i++) {
        const start = bounds[i].pos;
        const end = i + 1 < bounds.length ? bounds[i + 1].pos : raw.length;
        if (end <= start) continue;
        const slice = raw.slice(start, end);
        addRfcFromSlice(slice, bounds[i].key, start);
      }
    }

    const mixedRefLayoutRisk =
      parserDiag.anchoredMarkers > 0
      && parserDiag.proseBlocksTotal > 0
      && parserDiag.proseBlocksSkippedForAnchor > 0;
    if (mixedRefLayoutRisk) {
      out.flags.push({
        scope: 'references.bibliographic',
        code: 'MIXED_REF_LAYOUT_RISK',
        detail: `anchored=${parserDiag.anchoredMarkers} proseBlocks=${parserDiag.proseBlocksTotal} skippedAnchorBlocks=${parserDiag.proseBlocksSkippedForAnchor}`
      });
    }

    if (Array.isArray(out.references.normative)) {
      out.references.normative = [...new Set(out.references.normative)];
      if (!out.references.normative.length) delete out.references.normative;
    }
    if (Array.isArray(out.references.bibliographic)) {
      out.references.bibliographic = [...new Set(out.references.bibliographic)];
      if (!out.references.bibliographic.length) delete out.references.bibliographic;
    }
    if (Array.isArray(out.references.normative) && Array.isArray(out.references.bibliographic)) {
      const normSet = new Set(out.references.normative);
      out.references.bibliographic = out.references.bibliographic.filter(id => !normSet.has(id));
      if (!out.references.bibliographic.length) delete out.references.bibliographic;
    }
    // Suppress low-signal fallback artifacts (ordinal markers only, no href),
    // which otherwise surface as empty cite lines in extractor PR logs.
    out.badRefs = out.badRefs.filter((r) => {
      const href = String(r?.href || '').trim();
      const text = String(r?.refText || '').trim();
      if (href) return true;
      if (!text) return false;
      if (/^\[?\s*\d+(?:\.\d+)?\s*\]?$/.test(text)) return false;
      const normalized = text
        .toLowerCase()
        .replace(/^\[\s*\*\s*\]\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (normalized === 'non-ascii character') return false;
      // Cross-reference-only placeholders (e.g., "MIME See [Base64]") are not
      // standalone citations and should not be emitted as unresolved bad refs.
      if (/^[a-z0-9._-]+\s*\]?\s+see\s+\[\s*[a-z0-9._-]+\s*\]?$/i.test(normalized)) return false;
      return true;
    });
    suppressResolvableBadRefs();
    return out;
  }

  if (mode === 'ietf-xml') {
    const xmlRaw = String(opts.xmlRaw || '');
    const entityMap = new Map();
    const entityBySystem = new Map();
    const entityRe = /<!ENTITY\s+([A-Za-z0-9._:-]+)\s+SYSTEM\s+["']([^"']+)["']\s*>/g;
    let em;
    while ((em = entityRe.exec(xmlRaw)) !== null) {
      const name = String(em[1] || '').trim();
      const systemUrl = String(em[2] || '').trim();
      if (!name || !systemUrl) continue;
      entityMap.set(name, systemUrl);
      entityBySystem.set(systemUrl, name);
      try {
        const u = new URL(systemUrl);
        u.hash = '';
        if (u.searchParams.has('nocache')) u.searchParams.delete('nocache');
        entityBySystem.set(u.toString(), name);
      } catch {}
    }

    const classifyBucket = (titleRaw) => {
      const t = String(titleRaw || '').toLowerCase();
      if (t.includes('normative')) return 'normative';
      if (t.includes('informative') || t.includes('bibliographic')) return 'bibliographic';
      return null;
    };

    const addRef = (key, refId) => {
      if (!refId) return;
      if (!out.references[key]) out.references[key] = [];
      out.references[key].push(refId);
    };

    const escapeRx = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    $('references').each((_, referencesEl) => {
      const $references = $(referencesEl);
      const titleRaw = String($references.attr('title') || '').trim();
      const key = classifyBucket($references.attr('title') || '');
      if (!key) return;

      const sectionXml = String($.xml(referencesEl) || '');

      // Entity tokens: &RFC2119; or &ldp;
      const tokens = [];
      const tokenRe = /&([A-Za-z0-9._:-]+);/g;
      let tm;
      while ((tm = tokenRe.exec(sectionXml)) !== null) {
        tokens.push(String(tm[1] || '').trim());
      }
      // Some XML parsers strip unresolved entity tokens from sectionXml.
      // Fall back to raw XML section keyed by <references title="...">.
      if (xmlRaw && titleRaw) {
        const sectionRe = new RegExp(
          `<references\\b[^>]*title\\s*=\\s*["']${escapeRx(titleRaw)}["'][^>]*>([\\s\\S]*?)<\\/references>`,
          'ig'
        );
        let sm;
        while ((sm = sectionRe.exec(xmlRaw)) !== null) {
          const rawSectionBody = String(sm[1] || '');
          let rm;
          while ((rm = tokenRe.exec(rawSectionBody)) !== null) {
            tokens.push(String(rm[1] || '').trim());
          }
          tokenRe.lastIndex = 0;
        }
      }
      const xmlBuiltins = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);
      for (const tokenRaw of [...new Set(tokens)]) {
        const token = String(tokenRaw || '').trim();
        if (!token) continue;
        if (xmlBuiltins.has(token.toLowerCase())) continue;
        const href = entityMap.get(token) || '';
        const refId = resolveXmlRefId([token, `RFC ${token.replace(/^RFC/i, '')}`], [href]);
        if (refId) {
          addRef(key, refId);
          recordSighting({
            docId: currentDocId,
            type: key,
            refId,
            cite: token,
            href,
            mapSource: 'xml-entity',
            mapDetail: token,
            rawRef: token,
            title: null
          });
        } else {
          out.badRefs.push({ docId: currentDocId, type: key, refText: token, href });
        }
      }

      // xml2rfc includes
      $references.find('*').each((__, el) => {
        const tagName = String(el?.tagName || '').toLowerCase();
        if (!(tagName === 'include' || tagName.endsWith(':include'))) return;
        const href = String($(el).attr('href') || '').trim();
        if (!href) return;
        const token = entityBySystem.get(href) || '';
        const refId = resolveXmlRefId(token ? [token, `RFC ${token.replace(/^RFC/i, '')}`] : [], [href]);
        if (refId) {
          addRef(key, refId);
          recordSighting({
            docId: currentDocId,
            type: key,
            refId,
            cite: token || '',
            href,
            mapSource: 'xml-include',
            mapDetail: tagName,
            rawRef: href,
            title: null
          });
        } else {
          out.badRefs.push({ docId: currentDocId, type: key, refText: token || '', href });
        }
      });

      // Explicit <reference ...>
      $references.find('reference').each((__, refEl) => {
        const $ref = $(refEl);
        const anchor = String($ref.attr('anchor') || '').trim();
        const href = String($ref.attr('target') || '').trim();
        const titleText = String($ref.find('front > title').first().text() || '').trim();
        const dateEl = $ref.find('front > date').first();
        const dateMonth = String(dateEl.attr('month') || '').trim();
        const dateYear = String(dateEl.attr('year') || '').trim();
        const dateDay = String(dateEl.attr('day') || '').trim();
        const dateText = [dateMonth, dateDay, dateYear].filter(Boolean).join(' ').trim();
        const seriesVals = $ref.find('seriesInfo').map((___, si) => {
          const $si = $(si);
          return String($si.attr('value') || '').trim();
        }).get().filter(Boolean);
        const cites = [
          dateText ? `${titleText} ${dateText}` : '',
          titleText,
          dateText,
          ...seriesVals,
          ...seriesVals.map(v => `IETF ${v}`),
          anchor
        ];
        const refId = resolveXmlRefId(cites, [href]);
        if (refId) {
          addRef(key, refId);
          recordSighting({
            docId: currentDocId,
            type: key,
            refId,
            cite: titleText || anchor || '',
            href,
            mapSource: 'xml-reference',
            mapDetail: anchor || null,
            rawRef: String($.xml(refEl) || ''),
            title: titleText || null
          });
        } else {
          out.badRefs.push({ docId: currentDocId, type: key, refText: titleText || anchor || '', href });
        }
      });
    });

    if (Array.isArray(out.references.normative)) {
      out.references.normative = [...new Set(out.references.normative)];
      if (!out.references.normative.length) delete out.references.normative;
    }
    if (Array.isArray(out.references.bibliographic)) {
      out.references.bibliographic = [...new Set(out.references.bibliographic)];
      if (!out.references.bibliographic.length) delete out.references.bibliographic;
    }
    suppressResolvableBadRefs();
    return out;
  }

  const sections = [
    { id: 'normative-references', key: 'normative' },
    { id: 'bibliography', key: 'bibliographic' }
    // W3C occasionally uses 'informative-references'; add here if needed
  ];

  for (const s of sections) {
    const list = [];
    $(`#sec-${s.id} ul li`).each((_, el) => {
      const cite = $(el).find('cite');
      const refText = cite.text();
      const href = $(el).find('a.ext-ref').attr('href') || '';
      // Collect rawRef (entire LI text) and title (text between <cite> and <a>)
      const rawRef = $(el).text().replace(/\s+/g, ' ').trim();
      const $clone = $(el).clone();
      const citeOnly = $clone.find('cite').text() || '';
      $clone.find('a').remove();
      $clone.find('cite').remove();
      let midText = $clone.text().replace(/\s+/g, ' ').trim();
      // Drop leading comma/space and any trailing "url: ..." segment
      midText = midText.replace(/^,?\s*/, '').replace(/\burl:\s*.*$/i, '').trim();
      const titleText = midText || null;
      const parsed = parseRefId(refText, href, { wantDiag: true });
      const refId = parsed && parsed.refId ? parsed.refId : null;
      if (refId) {
        if (Array.isArray(refId)) {
          for (const r of refId) {
            list.push(r);
            recordSighting({
              docId: currentDocId,
              type: s.key,
              refId: r,
              cite: refText,
              href,
              mapSource: parsed.diag?.mapSource,
              mapDetail: parsed.diag?.mapDetail,
              rawRef,
              title: titleText
            });
          }
        } else {
          list.push(refId);
          recordSighting({
            docId: currentDocId,
            type: s.key,
            refId,
            cite: refText,
            href,
            mapSource: parsed.diag?.mapSource,
            mapDetail: parsed.diag?.mapDetail,
            rawRef,
            title: titleText
          });
        }
      } else {
        out.badRefs.push({ docId: currentDocId, type: s.key, refText, href });
        recordSighting({
          docId: currentDocId,
          type: s.key,
          refId: null,
          cite: refText,
          href,
          mapSource: null,
          mapDetail: null,
          rawRef,
          title: titleText
        });
      }
    });
    if (list.length > 0) out.references[s.key] = list;
  }
  suppressResolvableBadRefs();
  return out;
}

module.exports = {
  mapRefByCite,
  parseRefId,
  extractRefs,
  reloadRefMap,
  reloadDocumentsIndex,
  // MRI helpers
  mriRecordSighting,
  mriFlush,
  mriEnsureFile,
  mriPruneToSightings,
  synthesizeCiteFromRawRef
};
