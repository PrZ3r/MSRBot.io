npm run canonicalize && npm run validate
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

// ONE-TIME backfill — add missing top-level $meta for nested non-container
// objects (copyright, issn, publisherLocation, …). The earlier
// crossfillSmpteFromZoho.js wrote `copyright.year` + `copyright.year$meta`
// but skipped the parent `copyright$meta`; documents.validate.js exempts only
// `status`, `references`, `workInfo` from requiring a top-level $meta, so
// every other nested parent needs one. This walks every doc and inserts the
// missing parent $meta by copying any existing inner $meta as the source of
// provenance — same source/confidence/version values, so the parent $meta
// stays in sync with whatever filled the sub-field.
//
// Dry-run by default. Pass --apply to write.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../lib/registry');

const APPLY = process.argv.includes('--apply');
const CONTAINER_FIELDS = new Set(['status', 'references', 'workInfo']);

// For a nested object, return one of its sub-field $meta entries to clone for
// the parent. Prefers the first sub-field whose $meta exists; falls back to
// undefined if none present.
function pickInnerMeta(nested) {
  for (const key of Object.keys(nested)) {
    if (key.endsWith('$meta')) continue;
    const metaKey = `${key}$meta`;
    if (nested[metaKey] && typeof nested[metaKey] === 'object') return nested[metaKey];
  }
  return undefined;
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
  const fixes = [];
  for (const key of Object.keys(doc)) {
    if (key.endsWith('$meta')) continue;
    if (CONTAINER_FIELDS.has(key)) continue;
    const val = doc[key];
    if (val == null || typeof val !== 'object' || Array.isArray(val)) continue;
    const metaKey = `${key}$meta`;
    if (doc[metaKey]) continue; // already present
    const innerMeta = pickInnerMeta(val);
    if (!innerMeta) continue; // nothing to copy from
    fixes.push({ field: key, metaKey, meta: innerMeta });
  }
  if (fixes.length) changed.push({ doc, fixes });
}

console.log('');
console.log(`Docs needing parent-$meta backfill: ${changed.length}`);
const fieldCounts = {};
for (const c of changed) for (const f of c.fixes) fieldCounts[f.field] = (fieldCounts[f.field] || 0) + 1;
if (Object.keys(fieldCounts).length) {
  console.log('By field:');
  for (const [k, v] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
}

if (!APPLY) {
  console.log('\nDry run — pass --apply to write.');
  if (changed.length) {
    console.log('\nSample (first 5):');
    for (const c of changed.slice(0, 5)) {
      console.log(`  ${c.doc.docId}: + [${c.fixes.map((f) => `${f.field}$meta`).join(', ')}]`);
    }
  }
  process.exit(0);
}

let written = 0;
for (const { doc, fixes } of changed) {
  for (const { metaKey, meta } of fixes) {
    doc[metaKey] = { ...meta };
  }
  const sorted = sortKeysDeep(doc);
  const target = docAbsPath(sorted);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(sorted, null, 2) + '\n');
  written += 1;
}
console.log(`\nApplied ${written} doc(s). Reminder: run \`npm run canonicalize\` and \`npm run validate\`, then commit.`);
