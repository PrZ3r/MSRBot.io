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

// keywords backfill:
//   - For every doc in the registry that has keywords, re-normalize via the project's
//     splitAndNormalizeKeywords helper (catches D-Cinema → DCinema, Subtitle → Subtitles
//     after the recent normalizer fixes, plus any historical comma-list residue).
//   - For docs in the inventory report's keywords delta list, ALSO union in the source
//     XML's keywords first (per curator: "source + curation is fine; ICS terms aren't junk").
//   - Re-normalize site.json#controlledKeywords with the updated normalizer.
//
// Dry-run by default. Pass --apply to write.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');
const { splitAndNormalizeKeywords } = require('../utils/keyword.normalize');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const REPORT = path.join(REPO_ROOT, 'src', 'main', 'reports', 'sourceInventory.smpte.json');
const SITE = path.join(REPO_ROOT, 'src', 'main', 'config', 'site.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const docs = loadJson(REGISTRY);
const report = loadJson(REPORT);
const site = loadJson(SITE);
const schema = loadJson(SCHEMA);

// Build docId → source keywords map from delta list
const sourceByDocId = new Map();
for (const u of report.update) {
  for (const d of (u.valueDeltas || [])) {
    if (d.field === 'keywords') sourceByDocId.set(u.docId, d.sourceValue || []);
  }
}

let docsWithKeywords = 0;
let docsRenormalized = 0;
let docsUnionMerged = 0;
let totalKeywordsBefore = 0;
let totalKeywordsAfter = 0;
const samples = { merge: [], renorm: [] };

for (const doc of docs) {
  if (!Array.isArray(doc.keywords) || doc.keywords.length === 0) continue;
  docsWithKeywords++;
  const before = doc.keywords;
  totalKeywordsBefore += before.length;

  const sourceKeywords = sourceByDocId.get(doc.docId) || [];
  const merged = sourceKeywords.length
    ? splitAndNormalizeKeywords([...before, ...sourceKeywords])
    : splitAndNormalizeKeywords(before);

  totalKeywordsAfter += merged.length;
  if (arraysEqual(before, merged)) continue;

  if (sourceKeywords.length) {
    docsUnionMerged++;
    if (samples.merge.length < 4) samples.merge.push({ docId: doc.docId, before, source: sourceKeywords, after: merged });
    // Update $meta — note that source XML was merged in
    const existing = doc['keywords$meta'] || {};
    doc['keywords$meta'] = {
      ...existing,
      source: 'manual',          // curator merge of registry + parsed source
      confidence: existing.confidence || 'medium',
      note: `Union of curated keywords + source XML keywords (re-normalized via splitAndNormalizeKeywords)`,
      updated: NOW,
    };
  } else {
    docsRenormalized++;
    if (samples.renorm.length < 4) samples.renorm.push({ docId: doc.docId, before, after: merged });
    // Touch updated only — source/confidence stay
    if (doc['keywords$meta']) doc['keywords$meta'].updated = NOW;
  }

  doc.keywords = merged;
}

// site.json controlledKeywords — re-run through the same normalizer
const siteKeywordsBefore = Array.isArray(site.controlledKeywords) ? site.controlledKeywords : [];
const siteKeywordsAfter = splitAndNormalizeKeywords(siteKeywordsBefore).sort((a, b) => a.localeCompare(b));
const siteKeywordsRemoved = siteKeywordsBefore.filter((k) => !siteKeywordsAfter.includes(k));
const siteKeywordsAdded = siteKeywordsAfter.filter((k) => !siteKeywordsBefore.includes(k));
site.controlledKeywords = siteKeywordsAfter;

// Validate
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== keywords backfill ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);
console.log('-- documents.json --');
console.log(`Docs with keyword arrays: ${docsWithKeywords}`);
console.log(`  - re-normalized only:    ${docsRenormalized}`);
console.log(`  - source XML union-merged: ${docsUnionMerged}`);
console.log(`Keyword entries:           ${totalKeywordsBefore} → ${totalKeywordsAfter} (${totalKeywordsAfter - totalKeywordsBefore >= 0 ? '+' : ''}${totalKeywordsAfter - totalKeywordsBefore})`);

console.log('\n-- site.json#controlledKeywords --');
console.log(`Entries:                  ${siteKeywordsBefore.length} → ${siteKeywordsAfter.length}`);
console.log(`  - removed (collapsed):  ${siteKeywordsRemoved.length}`);
console.log(`  - newly canonical:      ${siteKeywordsAdded.length}`);
if (siteKeywordsRemoved.length) console.log(`  removed sample: ${JSON.stringify(siteKeywordsRemoved.slice(0, 6))}`);
if (siteKeywordsAdded.length) console.log(`  added sample:   ${JSON.stringify(siteKeywordsAdded.slice(0, 6))}`);

console.log(`\nSchema validation: ${ok ? 'PASS' : 'FAIL'}`);
if (!ok) for (const e of validate.errors.slice(0, 10)) console.log('  -', e.dataPath, e.message);

console.log('\n-- Sample merges (registry + source union) --');
for (const s of samples.merge) {
  console.log(`  ${s.docId}`);
  console.log(`    before: ${JSON.stringify(s.before)}`);
  console.log(`    source: ${JSON.stringify(s.source)}`);
  console.log(`    after:  ${JSON.stringify(s.after)}`);
}

console.log('\n-- Sample re-normalizations (no source merge) --');
for (const s of samples.renorm) {
  console.log(`  ${s.docId}`);
  console.log(`    before: ${JSON.stringify(s.before)}`);
  console.log(`    after:  ${JSON.stringify(s.after)}`);
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
