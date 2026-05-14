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

// docSuiteTitle backfill from docTitle deltas where the source is a
// "<suite-prefix> — <registry-docTitle>" concatenation. Extracts the prefix,
// strips the leading "For " (per curator: not part of the suite name), and
// writes to docSuiteTitle (only when registry's docSuiteTitle is currently empty).
// Leaves docTitle alone — registry already has the correct doc-specific title.
//
// Excludes the 14 unsplittable substring cases (typos / suffixes / different titles)
// — those need separate review.
//
// Dry-run by default. Pass --apply to write.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const REPORT = path.join(REPO_ROOT, 'src', 'main', 'reports', 'sourceInventory.smpte.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();

const SEPARATORS = [' — ', ' – ', ' - ', ' : '];

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function isAbsent(v) {
  return v === undefined || v === null || v === ''
    || (Array.isArray(v) && v.length === 0)
    || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
}

// SMPTE document designator pattern (e.g. "SMPTE ST 297", "SMPTE EG 14:2005").
// These are doc references, not suite titles — skip rather than misroute.
const DESIGNATOR_RX = /^SMPTE\s+(ST|RP|EG|AG|OM|TSP|RDD|OR|OV)\s+\d+/i;

// Try to extract <prefix> + <sep> + <registryDocTitle> from sourceDocTitle.
// Returns the extracted prefix (with leading "For " stripped) or null.
// Returns null if the extracted prefix looks like a SMPTE designator (belongs in
// relatedDocs/docSuite, not docSuiteTitle).
function extractSuitePrefix(sourceDocTitle, registryDocTitle) {
  if (!sourceDocTitle || !registryDocTitle) return null;
  let prefix = null;
  for (const sep of SEPARATORS) {
    const tail = sep + registryDocTitle;
    if (sourceDocTitle.endsWith(tail)) { prefix = sourceDocTitle.slice(0, -tail.length).trim(); break; }
  }
  // Fallback — registry title appears at end without explicit separator
  if (prefix === null && sourceDocTitle.endsWith(registryDocTitle)) {
    prefix = sourceDocTitle.slice(0, -registryDocTitle.length).trim();
  }
  if (prefix === null) return null;
  // Strip leading "For " — per SMPTE convention "For Television" → "Television"
  const stripped = prefix.replace(/^for\s+/i, '').trim();
  if (!stripped) return null;
  if (DESIGNATOR_RX.test(stripped)) return null; // doc reference, not a suite title
  return stripped;
}

const docs = loadJson(REGISTRY);
const report = loadJson(REPORT);
const schema = loadJson(SCHEMA);
const docIdx = new Map(docs.map((d, i) => [d.docId, i]));

const applied = [];
const skippedAlreadyPopulated = [];
const skippedUnsplittable = [];
const errors = [];
const prefixCounts = new Map();

for (const u of report.update) {
  for (const d of (u.valueDeltas || [])) {
    if (d.field !== 'docTitle') continue;
    if (!d.registryValue || !d.sourceValue) continue;
    // Only consider substring-pattern deltas (source contains registry as substring)
    if (!d.sourceValue.includes(d.registryValue)) continue;

    const i = docIdx.get(u.docId);
    if (i === undefined) { errors.push({ docId: u.docId, error: 'not in registry' }); continue; }
    const doc = docs[i];

    // Skip docs where docSuiteTitle is already populated (don't clobber existing)
    if (!isAbsent(doc.docSuiteTitle)) {
      skippedAlreadyPopulated.push({ docId: u.docId, existing: doc.docSuiteTitle });
      continue;
    }

    const prefix = extractSuitePrefix(d.sourceValue, d.registryValue);
    if (!prefix) {
      skippedUnsplittable.push({ docId: u.docId, src: d.sourceValue, reg: d.registryValue });
      continue;
    }

    doc.docSuiteTitle = prefix;
    doc['docSuiteTitle$meta'] = {
      source: 'parsed',
      confidence: 'high',
      note: `Extracted from source XML <title> as the prefix before " — ${d.registryValue}", with leading "For " stripped per SMPTE convention${d.sourceMetaPath ? ` (from ${d.sourceMetaPath})` : ''}`,
      updated: NOW,
    };
    applied.push({ docId: u.docId, prefix });
    prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
  }
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== docSuiteTitle backfill (from docTitle substring deltas) ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Applied:                     ${applied.length}`);
console.log(`Skipped (already populated): ${skippedAlreadyPopulated.length}`);
console.log(`Skipped (unsplittable):      ${skippedUnsplittable.length}`);
console.log(`Errors:                      ${errors.length}\n`);

console.log('Top extracted suite prefixes:');
for (const [prefix, n] of [...prefixCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${n.toString().padStart(3)} × ${JSON.stringify(prefix)}`);
}

console.log('\nSample applied (first 8):');
for (const a of applied.slice(0, 8)) {
  console.log(`  ${a.docId.padEnd(34)} docSuiteTitle = ${JSON.stringify(a.prefix)}`);
}

if (skippedAlreadyPopulated.length) {
  console.log(`\nSkipped because docSuiteTitle already populated (sample 5):`);
  for (const s of skippedAlreadyPopulated.slice(0, 5)) {
    console.log(`  ${s.docId.padEnd(34)} existing = ${JSON.stringify(s.existing).slice(0, 80)}`);
  }
}

if (errors.length) {
  console.log(`\nErrors:`); for (const e of errors) console.log(`  ✗ ${e.docId} — ${e.error}`);
}

console.log(`\nSchema validation: ${ok ? 'PASS' : 'FAIL'}`);
if (!ok) for (const e of validate.errors.slice(0, 10)) console.log('  -', e.dataPath, e.message);

if (APPLY) {
  if (!ok) { console.error('\nRefusing to apply — validation failed.'); process.exit(2); }
  fs.writeFileSync(REGISTRY, stringify(docs, { space: '  ' }) + '\n');
  console.log(`\nWrote ${path.relative(REPO_ROOT, REGISTRY)}.`);
  console.log('Reminder: run `npm run canonicalize` and `npm run validate` next.');
} else {
  console.log('\nDry run — no changes written. Pass --apply to write.');
}
