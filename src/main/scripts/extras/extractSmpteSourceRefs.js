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

// ONE-TIME SMPTE source-reference extraction.
//
// _source/SMPTE/ is a static legacy vendor archive. Its `*-ref.xml` side-cars carry the
// real reference lists — but the live extract-smpte pipeline never reads them, so SMPTE
// `references` in the registry are almost all hand-curated. This script does what the
// IETF path does via extractRefs(): for each SMPTE doc whose registry `references` are
// still empty, it parses the sibling `-ref.xml`, records a Master Reference Index (MRI)
// sighting per reference (carrying the raw <ref> XML), and writes the RESOLVED short
// refIds into documents.json. Unresolved references are NOT written to the doc (strict
// IETF model) — they are listed in full in reports/smpteSourceRefs.unresolved.json.
//
// Runs in chunks: --offset N --limit N (docs sorted by docId for stable slicing).
// Dry-run by default. Pass --apply to write. Must run from the repo root.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
// refMap.json (inside referencing.js) and the MRI path resolve relative to cwd — pin it.
process.chdir(REPO_ROOT);

const { readRefXml } = require('../utils/extractSourceMetadata');
const { parseSourceName, doiToDocId } = require('../utils/parseSourceName');
const {
  parseRefId,
  reloadRefMap,
  mriRecordSighting,
  mriFlush,
  mriEnsureFile,
} = require('../../lib/referencing');

const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const SOURCE_DIR = path.join(REPO_ROOT, '_source', 'SMPTE');
const REFMAP = path.join(REPO_ROOT, 'src', 'main', 'input', 'refMap.json');
const UNRESOLVED_OUT = path.join(REPO_ROOT, 'src', 'main', 'reports', 'smpteSourceRefs.unresolved.json');

const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();

function argInt(name, def) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1] != null) {
    const n = parseInt(process.argv[i + 1], 10);
    if (Number.isFinite(n)) return n;
  }
  return def;
}
// --limit caps how many docs this run processes. There is no --offset: each --apply run
// recomputes the target list (registry docs with EMPTY references), so already-filled docs
// drop out automatically. Re-run `--apply --limit N` until "remaining" reaches 0.
const LIMIT = Math.max(0, argInt('--limit', Infinity));

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// --- refMap sanity: parseRefId must resolve identically to extractDocs.js -----------------
try {
  loadJson(REFMAP);
} catch (e) {
  console.error(`FATAL: cannot read ${path.relative(REPO_ROOT, REFMAP)} — ${e.message}`);
  process.exit(2);
}
const refMapPatterns = reloadRefMap();
if (!Array.isArray(refMapPatterns) || refMapPatterns.length === 0) {
  console.error('FATAL: refMap.json loaded but produced no cite→refId patterns. Aborting.');
  process.exit(2);
}

const docs = loadJson(REGISTRY);
const schema = loadJson(SCHEMA);
const docById = new Map(docs.map((d) => [d.docId, d]));
const registryDocIds = new Set(docById.keys());

// ISBN-13 digits → docId. SMPTE standards carry an `isbn` field; their ref XMLs cite each
// other via an ISBN-form DOI (objidref "10.5594/S<isbn13>"), so this index turns that DOI
// back into the canonical docId.
const docIdByIsbn = new Map();
for (const d of docs) {
  if (!d.isbn) continue;
  const digits = String(d.isbn).replace(/\D/g, '');
  if (digits.length === 13 && !docIdByIsbn.has(digits)) docIdByIsbn.set(digits, d.docId);
}

// --- reference resolution -----------------------------------------------------------------
// Legacy SMPTE designators ("SMPTE 274M-2005") carry no ST/RP/EG token, so parseRefId misses
// them. Match against the registry docId set — resolve only to a docId that already exists.
const SMPTE_TYPES = ['ST', 'RP', 'EG', 'RDD', 'OM', 'AG', 'OV'];
function resolveLegacySmpte(s) {
  const m = String(s || '').match(/\bSMPTE\s+(\d{1,4}[0-9A-Za-z-]*)/i);
  if (!m) return null;
  const segs = m[1].split('-');
  const head = segs[0].match(/^(\d{1,4})[A-Za-z]*$/);
  if (!head) return null;
  let part = null;
  let year = null;
  for (const seg of segs.slice(1)) {
    if (/^\d{4}$/.test(seg)) year = seg;
    else { const pm = seg.match(/^(\d{1,3})[A-Za-z]?$/); if (pm) part = pm[1]; }
  }
  if (!year) return null; // need an exact revision year
  const lineageNum = part ? `${head[1]}-${part}` : head[1];
  for (const type of SMPTE_TYPES) {
    const cand = `SMPTE.${type}${lineageNum}.${year}`;
    if (registryDocIds.has(cand)) return cand;
  }
  return null;
}

// parseRefId reads a hyphen-separated year as a part number when there is no colon:
// "SMPTE EG 21-1997" → SMPTE.EG21-1997. Restore the canonical .YYYY form.
function normalizeSmpteRefId(id) {
  if (typeof id !== 'string') return id;
  return id.replace(/^(SMPTE\.[A-Za-z]+\d+(?:-\d{1,3})?)-(\d{4})$/, '$1.$2');
}

function tryParse(text) {
  if (!text) return null;
  try {
    const id = parseRefId(text, '');
    if (id) return normalizeSmpteRefId(id);
    const head = String(text).split(' — ')[0];
    if (head && head !== text) {
      const id2 = parseRefId(head, '');
      if (id2) return normalizeSmpteRefId(id2);
    }
  } catch { /* ignore */ }
  return null;
}

// Resolve an objidref DOI. ISBN-form SMPTE DOIs (10.5594/S<isbn13>) map to a canonical
// docId via the registry ISBN index; everything else (journal 10.5594/J*, canonical
// 10.5594/SMPTE.* …) conforms directly via doiToDocId.
let isbnHits = 0;
function resolveObjidref(objidref) {
  const m = String(objidref).match(/\/S(\d{13})$/);
  if (m) {
    const hit = docIdByIsbn.get(m[1]);
    if (hit) { isbnHits++; return hit; }
  }
  return doiToDocId(objidref);
}

// Resolve one parsed <ref> record to a canonical short refId. Returns { refId, via }.
// Order matters: canonical SMPTE.ST*/ISO.* forms first, raw-DOI form (objidref) last.
function resolveRef(ref) {
  // 1. standardnum → canonical standard id (modern SMPTE ST/RP/EG, ISO, IEC, …)
  if (ref.standardnum) {
    const id = tryParse(ref.standardnum);
    if (id) return { refId: id, via: 'standardnum' };
  }
  // 2. legacy SMPTE designator ("SMPTE 331M-2004") matched against registry docIds —
  //    before objidref, so we prefer the canonical SMPTE.ST* form over the raw DOI form.
  const legacy = resolveLegacySmpte(ref.standardnum || ref.cite);
  if (legacy) return { refId: legacy, via: 'legacy-smpte' };
  // 3. citation text (refMap.json + standard-designator regexes)
  if (ref.cite) {
    const id = tryParse(ref.cite);
    if (id) return { refId: id, via: 'cite' };
  }
  // 4. objidref DOI — last resort (ISBN-DOI → docId via the registry ISBN index)
  if (ref.objidref) {
    const id = resolveObjidref(ref.objidref);
    if (id) return { refId: id, via: 'objidref' };
  }
  return { refId: null, via: null };
}

// --- locate every -ref.xml under _source/SMPTE/ -------------------------------------------
function* walkRefXml(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkRefXml(abs);
    else if (/-ref\.xml$/i.test(e.name)) yield abs;
  }
}

// Derive a docId for a `-ref.xml`. Standard ref XMLs carry a placeholder objid (no DOI), so
// the docId comes from the filename or an enclosing folder via parseSourceName — the same
// naming convention the audit tool uses. Journal ref XMLs also self-identify via their DOI.
function docIdFromPath(absPath) {
  // 1. the ref-XML filename itself, with the `-ref` infix stripped
  const stripped = path.basename(absPath).replace(/-ref(\.xml)$/i, '$1');
  let id = parseSourceName(stripped);
  if (id && id.docId) return id.docId;
  // 2. an enclosing folder (standard folders: smptes_st_436-1-2013, …)
  let dir = path.dirname(absPath);
  for (let i = 0; i < 5; i++) {
    id = parseSourceName(path.basename(dir));
    if (id && id.docId) return id.docId;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// docId → first -ref.xml path (vendor archives carry duplicate copies; first wins).
const refXmlByDocId = new Map();
let refXmlFilesSeen = 0;
let refXmlDupes = 0;
let refXmlNoDocId = 0;
for (const abs of walkRefXml(SOURCE_DIR)) {
  refXmlFilesSeen++;
  let docId = docIdFromPath(abs);
  if (!docId) {
    // fallback: read the side-car for its own container DOI (journal ref XMLs)
    try {
      const parsed = readRefXml(abs, parseRefId);
      if (parsed && parsed.containerDoi) docId = doiToDocId(parsed.containerDoi);
    } catch { /* ignore */ }
  }
  if (!docId) { refXmlNoDocId++; continue; }
  if (refXmlByDocId.has(docId)) { refXmlDupes++; continue; }
  refXmlByDocId.set(docId, abs);
}

// --- select target docs: in the registry, with -ref.xml, references currently empty -------
function referencesEmpty(doc) {
  const r = doc.references;
  if (!r || typeof r !== 'object') return true;
  const n = Array.isArray(r.normative) ? r.normative.length : 0;
  const b = Array.isArray(r.bibliographic) ? r.bibliographic.length : 0;
  return n === 0 && b === 0;
}

const targets = [];
const skip = { notInRegistry: 0, alreadyPopulated: 0 };
for (const [docId, refXmlPath] of refXmlByDocId) {
  const doc = docById.get(docId);
  if (!doc) { skip.notInRegistry++; continue; }
  if (!referencesEmpty(doc)) { skip.alreadyPopulated++; continue; }
  targets.push({ docId, refXmlPath });
}
targets.sort((a, b) => a.docId.localeCompare(b.docId));
const slice = targets.slice(0, LIMIT);

// --- process the slice --------------------------------------------------------------------
if (APPLY) { try { mriEnsureFile(); } catch { /* ignore */ } }

let docsFilled = 0;
let docsNoResolved = 0; // had refs, none resolved → no documents.json change
let totalRefs = 0;
let totalResolved = 0;
const viaCounts = { standardnum: 0, objidref: 0, cite: 0, 'legacy-smpte': 0 };
const unresolved = [];
const samples = [];

for (const { docId, refXmlPath } of slice) {
  const doc = docById.get(docId);
  let parsed;
  try { parsed = readRefXml(refXmlPath, parseRefId); } catch { parsed = null; }
  if (!parsed || !Array.isArray(parsed.refs) || parsed.refs.length === 0) continue;

  const resolvedByBucket = { normative: [], bibliographic: [] };
  let docResolved = 0;

  for (const ref of parsed.refs) {
    totalRefs++;
    const { refId, via } = resolveRef(ref);
    if (refId) {
      totalResolved++;
      docResolved++;
      viaCounts[via] = (viaCounts[via] || 0) + 1;
      if (!resolvedByBucket[ref.type].includes(refId)) resolvedByBucket[ref.type].push(refId);
    } else {
      unresolved.push({
        docId,
        type: ref.type,
        refXmlId: ref.id,
        cite: ref.cite || null,
        title: ref.title || null,
        rawRef: ref.rawRef,
      });
    }
    if (APPLY) {
      mriRecordSighting({
        docId,
        type: ref.type,
        refId: refId || null, // null → recorded as an MRI orphan
        cite: ref.cite || '',
        href: '',
        rawRef: ref.rawRef,
        title: ref.title || null,
        mapSource: 'smpte-ref-xml',
        mapDetail: ref.id,
      });
    }
  }

  const hasResolved = resolvedByBucket.normative.length || resolvedByBucket.bibliographic.length;
  if (!hasResolved) { docsNoResolved++; continue; }

  docsFilled++;
  if (APPLY) {
    const refs = {};
    for (const bucket of ['normative', 'bibliographic']) {
      const ids = resolvedByBucket[bucket];
      if (!ids.length) continue;
      refs[bucket] = ids;
      refs[bucket + '$meta'] = {
        source: 'parsed',
        confidence: 'high',
        note: `Extracted from sibling -ref.xml via extractSmpteSourceRefs.js`,
        updated: NOW,
      };
    }
    doc.references = refs;
  }
  if (samples.length < 5) {
    samples.push({ docId, refs: parsed.refs.length, resolved: docResolved, resolvedByBucket });
  }
}

// --- validate + report --------------------------------------------------------------------
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== SMPTE source-reference extraction ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`refMap patterns loaded: ${refMapPatterns.length}`);
console.log(`-ref.xml files scanned: ${refXmlFilesSeen} (${refXmlByDocId.size} unique docIds, ${refXmlDupes} duplicate copies, ${refXmlNoDocId} no docId)`);
console.log(`Skipped — docId not in registry: ${skip.notInRegistry}`);
console.log(`Skipped — references already populated: ${skip.alreadyPopulated}`);
console.log(`Target docs (in registry, empty references): ${targets.length}`);
const remainingAfter = Math.max(0, targets.length - slice.length);
console.log(`Batch: first ${LIMIT === Infinity ? 'all' : LIMIT} of ${targets.length} remaining targets  →  ${slice.length} docs`);
if (slice.length) console.log(`  docId range: ${slice[0].docId} … ${slice[slice.length - 1].docId}`);
console.log(`  targets still empty after this batch: ${remainingAfter}`);
console.log('');
console.log(`Docs filled (≥1 resolved ref):     ${docsFilled}`);
console.log(`Docs with refs but none resolved:  ${docsNoResolved}`);
console.log(`References: ${totalRefs} total → ${totalResolved} resolved, ${unresolved.length} unresolved`);
console.log(`  via standardnum:  ${viaCounts.standardnum}`);
console.log(`  via objidref DOI: ${viaCounts.objidref} (of which ${isbnHits} via registry ISBN index)`);
console.log(`  via cite text:    ${viaCounts.cite}`);
console.log(`  via legacy SMPTE: ${viaCounts['legacy-smpte']}`);
console.log(`\nSchema validation: ${ok ? 'PASS' : 'FAIL'}`);
if (!ok) for (const e of validate.errors.slice(0, 10)) console.log('  -', e.dataPath || e.instancePath, e.message);

console.log('\n-- Sample docs --');
for (const s of samples) {
  console.log(`  ${s.docId}  (${s.resolved}/${s.refs} resolved)`);
  for (const bucket of ['normative', 'bibliographic']) {
    const ids = s.resolvedByBucket[bucket];
    if (ids.length) console.log(`    ${bucket}: ${JSON.stringify(ids.slice(0, 6))}${ids.length > 6 ? ' …' : ''}`);
  }
}
if (unresolved.length) {
  console.log('\n-- Sample unresolved (kept out of documents.json; see unresolved report) --');
  for (const u of unresolved.slice(0, 10)) console.log(`  ${u.docId} ${u.refXmlId}: ${u.cite || u.title || '(no cite)'}`);
}

if (APPLY) {
  if (!ok) { console.error('\nRefusing to apply — validation failed.'); process.exit(2); }
  fs.writeFileSync(REGISTRY, stringify(docs, { space: '  ' }) + '\n');
  const mri = mriFlush({ force: false });
  // The unresolved report accumulates across chunked runs — merge with any prior file.
  let priorUnresolved = [];
  try { priorUnresolved = (loadJson(UNRESOLVED_OUT).unresolved) || []; } catch { /* none yet */ }
  const mergedUnresolved = [];
  const seenU = new Set();
  for (const u of [...priorUnresolved, ...unresolved]) {
    const key = `${u.docId}|${u.refXmlId}`;
    if (seenU.has(key)) continue;
    seenU.add(key);
    mergedUnresolved.push(u);
  }
  mergedUnresolved.sort((a, b) => (a.docId.localeCompare(b.docId)) || a.refXmlId.localeCompare(b.refXmlId));
  fs.writeFileSync(UNRESOLVED_OUT, JSON.stringify({
    generatedAt: NOW,
    note: 'SMPTE source references that did not resolve to a canonical refId. '
      + 'Authoritative complete record — the MRI orphans list is capped at 200. '
      + 'Accumulates across chunked runs.',
    total: mergedUnresolved.length,
    unresolved: mergedUnresolved,
  }, null, 2) + '\n');
  console.log(`\nWrote ${path.relative(REPO_ROOT, REGISTRY)} (${docsFilled} docs filled).`);
  console.log(`MRI flush: ${mri.wrote ? `updated — uniqueRefIds=${mri.uniqueRefIds}, orphans=${mri.orphanCount}` : `no change (${mri.reason})`}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, UNRESOLVED_OUT)} (${unresolved.length} this chunk, ${mergedUnresolved.length} cumulative).`);
  console.log('Reminder: run `npm run canonicalize` and `npm run validate`, commit this batch,');
  if (remainingAfter > 0) {
    console.log(`then re-run the SAME command — ${remainingAfter} targets still to fill.`);
  } else {
    console.log('All targets filled. Done.');
  }
} else {
  console.log('\nDry run — no changes written. Pass --apply to write.');
}
