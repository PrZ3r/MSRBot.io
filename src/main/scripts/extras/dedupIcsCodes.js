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

// ONE-TIME dedup pass for existing icsCodes arrays — collapse duplicate codes
// within a single doc's icsCodes array (APTARA-extraction artifact: the source
// XML carried the same {code, description} pair multiple times for some docs).
//
// Dedup rule: first occurrence wins (preserves original order; description
// from the first entry is kept when subsequent entries differ). The $meta
// sibling is left untouched — the source/confidence/provenance for the unique
// codes is unchanged.
//
// Dry-run by default. Pass --apply to write.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../lib/registry');

const APPLY = process.argv.includes('--apply');

function dedupByCode(arr) {
  const seen = new Map();
  for (const item of arr) {
    if (!item || !item.code) continue;
    if (!seen.has(item.code)) seen.set(item.code, item);
  }
  return [...seen.values()];
}

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

const docs = loadAllDocs();
console.log(`Loaded ${docs.length} docs.`);

const changed = [];
for (const doc of docs) {
  if (!Array.isArray(doc.icsCodes) || !doc.icsCodes.length) continue;
  const before = doc.icsCodes;
  const after = dedupByCode(before);
  if (after.length === before.length) continue;
  changed.push({ docId: doc.docId, before: before.length, after: after.length, dropped: before.length - after.length, doc });
}

console.log('');
console.log(`Docs with duplicate icsCodes entries: ${changed.length}`);
if (changed.length) {
  console.log('Top 10 by duplicates dropped:');
  for (const c of [...changed].sort((a, b) => b.dropped - a.dropped).slice(0, 10)) {
    console.log(`  ${c.docId}: ${c.before} → ${c.after}  (-${c.dropped})`);
  }
}

if (!APPLY) {
  console.log('\nDry run — pass --apply to write.');
  process.exit(0);
}

let written = 0;
for (const c of changed) {
  const doc = c.doc;
  doc.icsCodes = dedupByCode(doc.icsCodes);
  const sorted = sortKeysDeep(doc);
  const target = docAbsPath(sorted);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(sorted, null, 2) + '\n');
  written += 1;
}
console.log(`\nDeduped ${written} doc(s). Reminder: run \`npm run canonicalize\` and \`npm run validate\`, then commit.`);
