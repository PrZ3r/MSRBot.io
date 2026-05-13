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

// One-off backfill test for 10.5594-J08011 from sourceInventory.smpte.json.
// Dry-run by default — prints planned diff + schema validation result.
// Pass --apply to actually write to src/main/data/documents.json.
//
// Invocation:
//   node src/main/scripts/extras/backfill.smpte.J08011.js          # dry-run
//   node src/main/scripts/extras/backfill.smpte.J08011.js --apply  # write

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const REPORT = path.join(REPO_ROOT, 'src', 'main', 'reports', 'sourceInventory.smpte.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');

const TARGET_DOCID = '10.5594-J08011';
const APPLY = process.argv.includes('--apply');

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function isAbsent(v) {
  return v === undefined || v === null || v === ''
    || (Array.isArray(v) && v.length === 0)
    || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
}

// For object-shaped fields (copyright/issn/publisherLocation), inject per-leaf $meta
// alongside each scalar inside the object so canonicalize doesn't have to fill defaults.
// Each leaf shares the same provenance as the container — they came from the same XML extraction.
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

const idx = docs.findIndex((d) => d.docId === TARGET_DOCID);
if (idx === -1) {
  console.error(`Doc not in registry: ${TARGET_DOCID}`);
  process.exit(1);
}
const update = report.update.find((u) => u.docId === TARGET_DOCID);
if (!update) {
  console.error(`Doc not in update bucket of report: ${TARGET_DOCID}`);
  process.exit(1);
}

const before = docs[idx];
const after = JSON.parse(JSON.stringify(before));

const applied = [];
const skipped = [];

// 1. Apply fillables (registry empty → source has)
for (const f of update.fillableFields) {
  if (!isAbsent(after[f.field])) {
    skipped.push({ field: f.field, reason: 'registry already populated (skip to avoid stomp)', currentValue: after[f.field] });
    continue;
  }
  // Expand object-shaped values (copyright/issn/publisherLocation) so each leaf carries its own $meta.
  // Scalars and arrays pass through unchanged. The container itself also gets a top-level $meta.
  after[f.field] = expandObjectFieldMeta(f.proposedValue, f.proposedMeta);
  after[f.field + '$meta'] = f.proposedMeta;
  applied.push({ field: f.field, value: after[f.field] });
}

// 2. Skip the publisher delta intentionally (registry 'SMPTE' is project convention)
for (const d of update.valueDeltas) {
  skipped.push({
    field: d.field,
    reason: "value delta — keeping registry convention (e.g., 'SMPTE' short form)",
    currentValue: d.registryValue,
    proposedValue: d.sourceValue,
  });
}

// 3. Schema validation
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate([after]);

console.log(`=== Backfill plan for ${TARGET_DOCID} ===\n`);
console.log(`Applied (${applied.length} field${applied.length === 1 ? '' : 's'}):`);
for (const a of applied) {
  const v = JSON.stringify(a.value);
  console.log(`  + ${a.field.padEnd(20)} = ${v.length > 110 ? v.slice(0, 110) + '…' : v}`);
}
console.log(`\nSkipped (${skipped.length} field${skipped.length === 1 ? '' : 's'}):`);
for (const s of skipped) {
  console.log(`  - ${s.field.padEnd(20)} (${s.reason})`);
  if (s.currentValue !== undefined) console.log(`      currentValue:  ${JSON.stringify(s.currentValue)}`);
  if (s.proposedValue !== undefined) console.log(`      proposedValue: ${JSON.stringify(s.proposedValue)}`);
}
console.log(`\nSchema validation: ${ok ? 'PASS' : 'FAIL'}`);
if (!ok) {
  console.log('Errors:');
  for (const e of validate.errors.slice(0, 10)) console.log('  -', e.dataPath, e.message);
}

if (APPLY) {
  if (!ok) {
    console.error('\nRefusing to apply — schema validation failed.');
    process.exit(2);
  }
  docs[idx] = after;
  fs.writeFileSync(REGISTRY, stringify(docs, { space: '  ' }) + '\n');
  console.log(`\nApplied to ${path.relative(REPO_ROOT, REGISTRY)}.`);
} else {
  console.log('\n=== Diff (added keys only) ===');
  const newKeys = Object.keys(after).filter((k) => !(k in before)).sort();
  for (const k of newKeys) {
    if (k.endsWith('$meta')) continue; // hide $meta in summary diff (still applied)
    const v = JSON.stringify(after[k]);
    console.log(`  + ${k}: ${v.length > 140 ? v.slice(0, 140) + '…' : v}`);
  }
  console.log(`\n+ ${newKeys.length} new keys (${newKeys.filter(k => !k.endsWith('$meta')).length} fields × 2 incl. $meta companions)`);
  console.log('\nDry run — no changes written. Pass --apply to write.');
}
