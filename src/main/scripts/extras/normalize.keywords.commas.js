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

// One-off: walk documents.json and split any keyword that's actually a comma-separated
// list (e.g. "Image Formats, Interfaces, Television" → 3 items) into separate keywords.
// Dedupes within each doc's keyword array, preserves order, leaves the existing $meta intact.
//
// Dry-run by default. Pass --apply to write.
//
//   node src/main/scripts/extras/normalize.keywords.commas.js
//   node src/main/scripts/extras/normalize.keywords.commas.js --apply

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const APPLY = process.argv.includes('--apply');

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function splitKeywords(arr) {
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

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const docs = loadJson(REGISTRY);
const schema = loadJson(SCHEMA);

const docsTouched = [];
let keywordsBefore = 0;
let keywordsAfter = 0;

for (const d of docs) {
  if (!Array.isArray(d.keywords) || d.keywords.length === 0) continue;
  const before = d.keywords;
  const after = splitKeywords(before);
  keywordsBefore += before.length;
  keywordsAfter += after.length;
  if (arraysEqual(before, after)) continue;
  docsTouched.push({
    docId: d.docId,
    before,
    after,
    splits: before.filter((k) => typeof k === 'string' && /,\s+/.test(k)),
  });
  d.keywords = after;
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== Keyword comma-split normalization ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Docs with keyword arrays: ${docs.filter((d) => Array.isArray(d.keywords) && d.keywords.length).length}`);
console.log(`Docs touched: ${docsTouched.length}`);
console.log(`Total keyword entries before: ${keywordsBefore}`);
console.log(`Total keyword entries after:  ${keywordsAfter}`);
console.log(`Net change:                   ${keywordsAfter - keywordsBefore > 0 ? '+' : ''}${keywordsAfter - keywordsBefore}`);
console.log(`\nSchema validation: ${ok ? 'PASS' : 'FAIL'}`);
if (!ok) {
  console.log('First 10 errors:');
  for (const e of validate.errors.slice(0, 10)) console.log('  -', e.dataPath, e.message);
}

console.log('\nSample (first 10 changes):');
for (const t of docsTouched.slice(0, 10)) {
  console.log(`  ${t.docId}`);
  for (const k of t.splits) {
    const replaced = k.split(/,\s+/).map((s) => s.trim()).filter(Boolean);
    console.log(`    "${k}" → ${replaced.map((s) => `"${s}"`).join(', ')}`);
  }
}

if (APPLY) {
  if (!ok) { console.error('\nRefusing to apply — validation failed.'); process.exit(2); }
  fs.writeFileSync(REGISTRY, stringify(docs, { space: '  ' }) + '\n');
  console.log(`\nWrote ${path.relative(REPO_ROOT, REGISTRY)}.`);
  console.log('Reminder: run `npm run canonicalize` and `npm run validate` next.');
} else {
  console.log('\nDry run — no changes written. Pass --apply to write.');
}
