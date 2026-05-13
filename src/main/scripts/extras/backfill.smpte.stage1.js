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

// Stage 1 backfill: apply fillables on net-new schema 2.2.0 fields across all
// update[] entries in the inventory report. Net-new fields cannot conflict with
// registry data (the registry has never carried them), so this is the
// lowest-risk slice of the backfill.
//
// Dry-run by default. Pass --apply to write to documents.json.
//
//   node src/main/scripts/extras/backfill.smpte.stage1.js
//   node src/main/scripts/extras/backfill.smpte.stage1.js --apply

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const REPORT = path.join(REPO_ROOT, 'src', 'main', 'reports', 'sourceInventory.smpte.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');

const STAGE1_FIELDS = new Set([
  'standardId',
  'productNumber',
  'familyId',
  'approvalDate',
  'abbrevTitle',
  'journalAcronym',
  'articleType',
  'copyright',
  'publisherLocation',
  'icsCodes',
  'doiAliases',
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

const docs = loadJson(REGISTRY);
const report = loadJson(REPORT);
const schema = loadJson(SCHEMA);
const docIdx = new Map(docs.map((d, i) => [d.docId, i]));

const perFieldApplied = {};        // field → count of docs that received it
const perFieldStomped = {};        // field → count of skips because registry already populated
const perFieldUnexpectedDelta = {}; // field → count of unexpected deltas (should be 0 for net-new fields)
const docsTouched = new Set();
let writesMade = 0;

for (const u of report.update) {
  if (LIMIT !== null && docsTouched.size >= LIMIT) break;
  const i = docIdx.get(u.docId);
  if (i === undefined) continue;
  const before = docs[i];
  const after = before; // mutate in place
  let touchedThisDoc = false;

  for (const f of (u.fillableFields || [])) {
    if (!STAGE1_FIELDS.has(f.field)) continue;
    if (!isAbsent(after[f.field])) {
      perFieldStomped[f.field] = (perFieldStomped[f.field] || 0) + 1;
      continue;
    }
    after[f.field] = expandObjectFieldMeta(f.proposedValue, f.proposedMeta);
    after[f.field + '$meta'] = f.proposedMeta;
    perFieldApplied[f.field] = (perFieldApplied[f.field] || 0) + 1;
    docsTouched.add(u.docId);
    touchedThisDoc = true;
    writesMade++;
  }
  // No-op if this update entry had no Stage-1-relevant fillables
  if (!touchedThisDoc) {
    /* nothing to do */
  }

  // Sanity: net-new fields shouldn't appear in valueDeltas (registry can't disagree on a
  // field it's never had). If we see one, log so we can investigate — don't apply.
  for (const d of (u.valueDeltas || [])) {
    if (STAGE1_FIELDS.has(d.field)) {
      perFieldUnexpectedDelta[d.field] = (perFieldUnexpectedDelta[d.field] || 0) + 1;
    }
  }
}

// Validate the (possibly mutated) registry against the schema before writing
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== Stage 1 backfill summary ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}${LIMIT !== null ? ` (limit: ${LIMIT} docs)` : ''}`);
console.log(`Docs touched: ${docsTouched.size}`);
console.log(`Total field writes: ${writesMade}\n`);

console.log('Applied per field:');
const appliedRows = Object.entries(perFieldApplied).sort((a, b) => b[1] - a[1]);
if (!appliedRows.length) console.log('  (none)');
for (const [f, n] of appliedRows) console.log(`  + ${f.padEnd(20)} ${n}`);

if (Object.keys(perFieldStomped).length) {
  console.log('\nSkipped (registry already populated — should be rare for net-new fields):');
  for (const [f, n] of Object.entries(perFieldStomped).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${f.padEnd(20)} ${n}`);
  }
}

if (Object.keys(perFieldUnexpectedDelta).length) {
  console.log('\nUnexpected deltas on net-new fields (NOT applied — investigate):');
  for (const [f, n] of Object.entries(perFieldUnexpectedDelta).sort((a, b) => b[1] - a[1])) {
    console.log(`  ! ${f.padEnd(20)} ${n}`);
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
