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

// Stage 2 backfill: apply fillables on existing schema fields where the registry is empty.
// Skip-if-populated guarded — never overwrites a registry value, only fills blanks.
// Excludes: references (complex shape — separate pass), docTitle (484 deltas — needs human review).
//
// Dry-run by default. Pass --apply to write to documents.json.
//
//   node src/main/scripts/extras/backfill.smpte.stage2.js
//   node src/main/scripts/extras/backfill.smpte.stage2.js --limit=125 --apply

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const REPORT = path.join(REPO_ROOT, 'src', 'main', 'reports', 'sourceInventory.smpte.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');

const STAGE2_FIELDS = new Set([
  'abstract',
  'group',
  'keywords',
  'pages',
  'isbn',
  'issn',
  'volume',
  'number',
  'docSuiteTitle',
]);

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : null;

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function isAbsent(v) {
  return v === undefined || v === null || v === ''
    || (Array.isArray(v) && v.length === 0)
    || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
}

function expandObjectFieldMeta(value, meta) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.endsWith('$meta')) { out[k] = v; continue; }
    out[k] = v;
    out[k + '$meta'] = { ...meta };
  }
  return out;
}

// Source XMLs sometimes concatenate multiple keywords as a single comma-separated
// string (e.g. "Image Formats, Interfaces, Television"). Split into separate items
// so each one can land in the controlled vocabulary individually. Dedupes preserved order.
function normalizeKeywordsArray(arr) {
  if (!Array.isArray(arr)) return arr;
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    if (typeof raw !== 'string') { if (!seen.has(raw)) { seen.add(raw); out.push(raw); } continue; }
    const parts = raw.split(/,\s+/).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) if (!seen.has(p)) { seen.add(p); out.push(p); }
  }
  return out;
}

const docs = loadJson(REGISTRY);
const report = loadJson(REPORT);
const schema = loadJson(SCHEMA);
const docIdx = new Map(docs.map((d, i) => [d.docId, i]));

const perFieldApplied = {};
const perFieldStomped = {};
const docsTouched = new Set();
let writesMade = 0;

for (const u of report.update) {
  if (LIMIT !== null && docsTouched.size >= LIMIT) break;
  const i = docIdx.get(u.docId);
  if (i === undefined) continue;
  const after = docs[i]; // mutate in place

  for (const f of (u.fillableFields || [])) {
    if (!STAGE2_FIELDS.has(f.field)) continue;
    if (!isAbsent(after[f.field])) {
      perFieldStomped[f.field] = (perFieldStomped[f.field] || 0) + 1;
      continue;
    }
    const value = f.field === 'keywords'
      ? normalizeKeywordsArray(f.proposedValue)
      : expandObjectFieldMeta(f.proposedValue, f.proposedMeta);
    after[f.field] = value;
    after[f.field + '$meta'] = f.proposedMeta;
    perFieldApplied[f.field] = (perFieldApplied[f.field] || 0) + 1;
    docsTouched.add(u.docId);
    writesMade++;
  }
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== Stage 2 backfill summary ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}${LIMIT !== null ? ` (limit: ${LIMIT} docs)` : ''}`);
console.log(`Docs touched: ${docsTouched.size}`);
console.log(`Total field writes: ${writesMade}\n`);

console.log('Applied per field:');
const appliedRows = Object.entries(perFieldApplied).sort((a, b) => b[1] - a[1]);
if (!appliedRows.length) console.log('  (none)');
for (const [f, n] of appliedRows) console.log(`  + ${f.padEnd(20)} ${n}`);

if (Object.keys(perFieldStomped).length) {
  console.log('\nSkipped (registry already populated — fillable-only is safe and silent):');
  for (const [f, n] of Object.entries(perFieldStomped).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${f.padEnd(20)} ${n}`);
  }
}

console.log(`\nSchema validation: ${ok ? 'PASS' : 'FAIL'}`);
if (!ok) {
  console.log('First 10 errors:');
  for (const e of validate.errors.slice(0, 10)) console.log('  -', e.dataPath, e.message);
}

if (APPLY) {
  if (!ok) { console.error('\nRefusing to apply — validation failed.'); process.exit(2); }
  fs.writeFileSync(REGISTRY, stringify(docs, { space: '  ' }) + '\n');
  console.log(`\nWrote ${path.relative(REPO_ROOT, REGISTRY)}.`);
  console.log('Reminder: run `npm run canonicalize` and `npm run validate` next.');
} else {
  console.log('\nDry run — no changes written. Pass --apply to write.');
}
