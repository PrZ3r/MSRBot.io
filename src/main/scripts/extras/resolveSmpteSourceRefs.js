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

// Report-driven resolution of SMPTE source references left unresolved by
// extractSmpteSourceRefs.js. Reads reports/smpteSourceRefs.unresolved.json and tries to
// resolve each entry; for every newly-resolved ref it:
//   - appends the canonical refId to the citing doc's documents.json `references` bucket
//   - records an MRI sighting (carrying the raw <ref> XML)
//   - drops the entry from smpteSourceRefs.unresolved.json
//
// v1 resolution strategy — SAFE ONLY: exact, 1:1, normalized title match against the
// registry docTitle index. Ambiguous titles (>1 doc) and self-references are skipped.
// (parseRefId is intentionally NOT used here — on this set it produced junk refIds like
// W3C.ORG.) ITU/ANSI/journal resolution is a later pass that re-feeds this same script.
//
// Dry-run by default. Pass --apply to write. Must run from the repo root.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT); // MRI path resolves relative to cwd
const { parseRefId, reloadRefMap, mriRecordSighting, mriFlush, mriEnsureFile } = require('../../lib/referencing');
reloadRefMap();

const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const UNRESOLVED = path.join(REPO_ROOT, 'src', 'main', 'reports', 'smpteSourceRefs.unresolved.json');
const REFMAP_CANDIDATES = path.join(REPO_ROOT, 'src', 'main', 'reports', 'refMap.candidates.json');

const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function normTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’“”]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const docs = loadJson(REGISTRY);
const schema = loadJson(SCHEMA);
const docById = new Map(docs.map((d) => [d.docId, d]));

// Registry docTitle index: normalized title → [docId, …]
const titleIdx = new Map();
for (const d of docs) {
  const t = normTitle(d.docTitle);
  if (!t) continue;
  if (!titleIdx.has(t)) titleIdx.set(t, []);
  titleIdx.get(t).push(d.docId);
}

const report = loadJson(UNRESOLVED);
const entries = Array.isArray(report.unresolved) ? report.unresolved : [];

// --- resolve ------------------------------------------------------------------------------
// Append a refId to a doc's references bucket (creating references/bucket/$meta as needed).
function addRef(doc, type, refId) {
  doc.references = doc.references || {};
  const bucket = (doc.references[type] = doc.references[type] || []);
  if (bucket.includes(refId)) return false;
  bucket.push(refId);
  const metaKey = type + '$meta';
  const existing = doc.references[metaKey];
  doc.references[metaKey] = existing
    ? { ...existing, updated: NOW }
    : { source: 'parsed', confidence: 'medium',
        note: 'Resolved from sibling -ref.xml via resolveSmpteSourceRefs.js',
        updated: NOW };
  return true;
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}
// The <standardnum> element from the raw <ref> XML — the most conformed input for parseRefId.
// SMPTE ref XMLs sometimes drop the "SMPTE" word ("ST 299-1:2009") — restore it so the SMPTE
// parser fires (context-safe: these are SMPTE source ref XMLs).
function standardnumOf(rawRef) {
  const m = String(rawRef || '').match(/<standardnum>([^<]+)<\/standardnum>/i);
  if (!m) return null;
  let sn = decodeEntities(m[1]).trim();
  if (/^(ST|RP|EG|RDD|AG|OM|OV)\b/i.test(sn) && !/^SMPTE\b/i.test(sn)) sn = `SMPTE ${sn}`;
  return sn;
}
// The first <online-cite> URL — used as the href arg to parseRefId (W3C/Unicode URL resolvers).
function onlineCiteOf(rawRef) {
  const m = String(rawRef || '').match(/<online-cite[^>]*>([^<]+)<\/online-cite>/i);
  return m ? decodeEntities(m[1]).trim() : null;
}
// <idnum idnumtype="ISBN"> → canonical ISBN-13 refId (ISBN.<13 digits>). Books carry no
// standardnum/DOI, so ISBN is their identifier. ISBN-10 is upconverted to ISBN-13.
function isbnRefIdOf(rawRef) {
  const m = String(rawRef || '').match(/<idnum\s+idnumtype="ISBN"[^>]*>([^<]+)<\/idnum>/i);
  if (!m) return null;
  const v = decodeEntities(m[1]).replace(/^\s*ISBN\s*(?:1[03])?\s*:?\s*/i, '');
  const raw = v.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (raw.length === 13) return `ISBN.${raw}`;
  if (raw.length === 10) {
    const core = `978${raw.slice(0, 9)}`;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += (i % 2 ? 3 : 1) * Number(core[i]);
    return `ISBN.${core}${(10 - (sum % 10)) % 10}`;
  }
  return null;
}
// Patent designator text for a reftype="patent" ref (from <patentnum> or a patent <ref_pubtitle>).
function patentOf(rawRef) {
  if (!/reftype="patent"/i.test(rawRef || '')) return null;
  let m = String(rawRef).match(/<patentnum>([^<]+)<\/patentnum>/i);
  if (!m) m = String(rawRef).match(/<ref_pubtitle>([^<]*Patent[^<]*)<\/ref_pubtitle>/i);
  return m ? decodeEntities(m[1]).trim() : null;
}
// Reject obviously-bad refIds — self-references and generic org ids (e.g. W3C.ORG).
function qualityOk(refId, citingDocId) {
  if (!refId || typeof refId !== 'string') return false;
  if (refId === citingDocId) return false;
  if (/\.ORG$/i.test(refId)) return false;
  return true;
}
// Resolve one unresolved entry → { refId, via }. Order: standardnum (most conformed) →
// online-cite URL as href (W3C/Unicode URL resolvers — structural, safe) → exact title match.
// Free-text cite-scanning is intentionally NOT used — it mis-grabs designators from prose.
// via: 'standardnum' | 'url' | 'isbn' | 'patent' | 'titlematch' | 'ambiguous' | null.
function resolveEntry(u) {
  const sn = standardnumOf(u.rawRef);
  if (sn) {
    let id = null;
    try { id = parseRefId(sn, ''); } catch { /* ignore */ }
    if (qualityOk(id, u.docId)) return { refId: id, via: 'standardnum' };
  }
  const url = onlineCiteOf(u.rawRef);
  if (url) {
    let id = null;
    try { id = parseRefId('', url); } catch { /* ignore */ } // empty text → only URL resolvers fire
    if (qualityOk(id, u.docId)) return { refId: id, via: 'url' };
  }
  const isbn = isbnRefIdOf(u.rawRef);
  if (qualityOk(isbn, u.docId)) return { refId: isbn, via: 'isbn' };
  const pat = patentOf(u.rawRef);
  if (pat) {
    let id = null;
    try { id = parseRefId(pat, ''); } catch { /* ignore */ }
    if (qualityOk(id, u.docId)) return { refId: id, via: 'patent' };
  }
  const t = normTitle(u.title);
  if (t) {
    const matches = titleIdx.get(t);
    if (matches && matches.length === 1 && qualityOk(matches[0], u.docId)) {
      return { refId: matches[0], via: 'titlematch' };
    }
    if (matches && matches.length > 1) return { refId: null, via: 'ambiguous' };
  }
  return { refId: null, via: null };
}

if (APPLY) { try { mriEnsureFile(); } catch { /* ignore */ } }

let resolved = 0;
const viaCount = { standardnum: 0, url: 0, isbn: 0, patent: 0, titlematch: 0 };
const refMapCandidates = {}; // refId → [cite patterns] proposed for refMap.json
let skippedAmbiguous = 0;
let skippedDup = 0;
const stillUnresolved = [];
const samples = [];

for (const u of entries) {
  const { refId, via } = resolveEntry(u);
  if (!refId) {
    if (via === 'ambiguous') skippedAmbiguous++;
    stillUnresolved.push(u);
    continue;
  }
  const doc = docById.get(u.docId);
  if (!doc) { stillUnresolved.push(u); continue; }

  resolved++;
  viaCount[via] = (viaCount[via] || 0) + 1;
  // ISBN-resolved books: propose a refMap entry (book title → ISBN refId) so future
  // title-only citations of the same book resolve. Curated file — written as candidates.
  if (via === 'isbn') {
    const cite = String(u.cite || u.title || '').replace(/[“”"]/g, '').trim();
    if (cite) (refMapCandidates[refId] = refMapCandidates[refId] || []).push(cite);
  }
  if (samples.length < 14) {
    const probe = (standardnumOf(u.rawRef) || u.title || '').slice(0, 46);
    samples.push(`${u.docId} ${u.refXmlId} (${via}): "${probe}" → ${refId}`);
  }
  if (APPLY) {
    if (!addRef(doc, u.type, refId)) skippedDup++;
    mriRecordSighting({
      docId: u.docId,
      type: u.type,
      refId,
      cite: u.cite || '',
      href: '',
      rawRef: u.rawRef || '',
      title: u.title || null,
      mapSource: 'smpte-ref-resolve',
      mapDetail: `${u.refXmlId || ''}:${via}`,
    });
  }
}

// --- validate -----------------------------------------------------------------------------
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

// --- report -------------------------------------------------------------------------------
console.log('=== SMPTE source-reference resolution (standardnum + title) ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Unresolved entries read: ${entries.length}`);
console.log('');
console.log(`Resolved: ${resolved}`);
console.log(`  via standardnum (parseRefId):   ${viaCount.standardnum}`);
console.log(`  via online-cite URL (href):     ${viaCount.url}`);
console.log(`  via ISBN (idnum):               ${viaCount.isbn}`);
console.log(`  via patent number:              ${viaCount.patent}`);
console.log(`  via exact 1:1 title match:      ${viaCount.titlematch}`);
console.log(`  skipped — ambiguous title (>1 doc): ${skippedAmbiguous}`);
if (skippedDup) console.log(`  note — refId already on the doc:   ${skippedDup}`);
console.log(`Still unresolved after this pass:    ${stillUnresolved.length}`);
console.log(`\nSchema validation: ${ok ? 'PASS' : 'FAIL'}`);
if (!ok) for (const e of validate.errors.slice(0, 10)) console.log('  -', e.dataPath || e.instancePath, e.message);

console.log('\n-- Sample resolutions --');
for (const s of samples) console.log(`  ${s}`);

if (APPLY) {
  if (!ok) { console.error('\nRefusing to apply — validation failed.'); process.exit(2); }
  fs.writeFileSync(REGISTRY, stringify(docs, { space: '  ' }) + '\n');
  const mri = mriFlush({ force: false });
  fs.writeFileSync(UNRESOLVED, JSON.stringify({
    generatedAt: NOW,
    note: 'SMPTE source references that did not resolve to a canonical refId. '
      + 'Authoritative complete record. Trimmed as resolveSmpteSourceRefs.js resolves entries.',
    total: stillUnresolved.length,
    unresolved: stillUnresolved,
  }, null, 2) + '\n');
  console.log(`\nWrote ${path.relative(REPO_ROOT, REGISTRY)} (${resolved} refs resolved).`);
  console.log(`MRI flush: ${mri.wrote ? `updated — uniqueRefIds=${mri.uniqueRefIds}, orphans=${mri.orphanCount}` : `no change (${mri.reason})`}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, UNRESOLVED)} (${stillUnresolved.length} still unresolved).`);
  const candCount = Object.keys(refMapCandidates).length;
  if (candCount) {
    fs.writeFileSync(REFMAP_CANDIDATES, JSON.stringify({
      generatedAt: NOW,
      note: 'Proposed refMap.json byCitePatterns additions (book title → ISBN refId). '
        + 'Review and merge into src/main/input/refMap.json.',
      byCitePatterns: refMapCandidates,
    }, null, 2) + '\n');
    console.log(`Wrote ${path.relative(REPO_ROOT, REFMAP_CANDIDATES)} (${candCount} refMap candidates — review & merge).`);
  }
  console.log('Reminder: run `npm run canonicalize` and `npm run validate`, then commit.');
} else {
  console.log('\nDry run — no changes written. Pass --apply to write.');
}
