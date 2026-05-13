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

// One-off: re-canonicalize keyword vocabulary across documents.json AND
// site.json#controlledKeywords using the project's `splitAndNormalizeKeywords` helper.
// This handles:
//   - splitting comma-/semicolon-separated strings into individual entries
//   - normalizing case + acronyms via the ACRONYM_MAP in keyword.normalize.js
//     (e.g. "Robotics And Control Systems" → "Robotics and Control Systems")
//   - de-duping within each doc's array and within controlledKeywords
//
// Dry-run by default. Pass --apply to write.
//
//   node src/main/scripts/extras/normalize.keywords.canonical.js
//   node src/main/scripts/extras/normalize.keywords.canonical.js --apply

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');
const { splitAndNormalizeKeywords } = require('../utils/keyword.normalize');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const SITE = path.join(REPO_ROOT, 'src', 'main', 'config', 'site.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const APPLY = process.argv.includes('--apply');

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const docs = loadJson(REGISTRY);
const site = loadJson(SITE);
const schema = loadJson(SCHEMA);

const docsTouched = [];
let docKeywordsBefore = 0;
let docKeywordsAfter = 0;

for (const d of docs) {
  if (!Array.isArray(d.keywords) || d.keywords.length === 0) continue;
  const before = d.keywords;
  const after = splitAndNormalizeKeywords(before);
  docKeywordsBefore += before.length;
  docKeywordsAfter += after.length;
  if (arraysEqual(before, after)) continue;
  const removedTokens = before.filter((b) => !after.includes(b));
  const addedTokens = after.filter((a) => !before.includes(a));
  docsTouched.push({ docId: d.docId, before, after, removedTokens, addedTokens });
  d.keywords = after;
}

// site.json controlledKeywords — re-normalize and dedupe
let siteBefore = Array.isArray(site.controlledKeywords) ? site.controlledKeywords : [];
let siteAfter = splitAndNormalizeKeywords(siteBefore).sort((a, b) => a.localeCompare(b));
const siteRemoved = siteBefore.filter((b) => !siteAfter.includes(b));
const siteAdded = siteAfter.filter((a) => !siteBefore.includes(a));
const siteChanged = !arraysEqual(siteBefore, siteAfter);
site.controlledKeywords = siteAfter;

// Validate the (possibly mutated) registry
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== Keyword canonical normalization ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

console.log('-- documents.json --');
console.log(`Docs with keywords: ${docs.filter((d) => Array.isArray(d.keywords) && d.keywords.length).length}`);
console.log(`Docs touched:       ${docsTouched.length}`);
console.log(`Keyword entries:    ${docKeywordsBefore} → ${docKeywordsAfter} (${docKeywordsAfter - docKeywordsBefore >= 0 ? '+' : ''}${docKeywordsAfter - docKeywordsBefore})`);

console.log('\n-- site.json#controlledKeywords --');
console.log(`Entries:    ${siteBefore.length} → ${siteAfter.length} (${siteAfter.length - siteBefore.length >= 0 ? '+' : ''}${siteAfter.length - siteBefore.length})`);
console.log(`Re-cased / removed (dedup or normalize-collapsed): ${siteRemoved.length}`);
console.log(`Newly canonical added:                              ${siteAdded.length}`);
if (siteRemoved.length) {
  console.log('  Removed (sample 10):');
  for (const r of siteRemoved.slice(0, 10)) console.log(`    - "${r}"`);
}
if (siteAdded.length) {
  console.log('  Added (sample 10):');
  for (const a of siteAdded.slice(0, 10)) console.log(`    + "${a}"`);
}

console.log(`\nSchema validation: ${ok ? 'PASS' : 'FAIL'}`);
if (!ok) {
  console.log('First 10 errors:');
  for (const e of validate.errors.slice(0, 10)) console.log('  -', e.dataPath, e.message);
}

console.log('\nSample doc changes (first 8):');
for (const t of docsTouched.slice(0, 8)) {
  console.log(`  ${t.docId}`);
  if (t.removedTokens.length) for (const r of t.removedTokens) console.log(`    - "${r}"`);
  if (t.addedTokens.length) for (const a of t.addedTokens) console.log(`    + "${a}"`);
}

if (APPLY) {
  if (!ok) { console.error('\nRefusing to apply — validation failed.'); process.exit(2); }
  fs.writeFileSync(REGISTRY, stringify(docs, { space: '  ' }) + '\n');
  fs.writeFileSync(SITE, JSON.stringify(site, null, 2) + '\n');
  console.log(`\nWrote ${path.relative(REPO_ROOT, REGISTRY)} and ${path.relative(REPO_ROOT, SITE)}.`);
  console.log('Reminder: run `npm run canonicalize` and `npm run validate` next.');
} else {
  console.log('\nDry run — no changes written. Pass --apply to write.');
}
