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

// One-off: remove docSuite (and docSuite$meta) from all docs in documents.json.
// docSuite has been superseded by docSuiteTitle (the canonical field used by
// templates and the live extractor). Templates render docSuiteTitle only.
//
// Dry-run by default. Pass --apply to write.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const APPLY = process.argv.includes('--apply');

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

const docs = loadJson(REGISTRY);
const schema = loadJson(SCHEMA);

const removed = [];
for (const doc of docs) {
  const hadField = 'docSuite' in doc;
  const hadMeta = 'docSuite$meta' in doc;
  if (!hadField && !hadMeta) continue;
  const beforeValue = doc.docSuite;
  delete doc.docSuite;
  delete doc['docSuite$meta'];
  removed.push({ docId: doc.docId, before: beforeValue });
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== docSuite removal ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Docs touched: ${removed.length}\n`);
console.log('Sample removals (first 10):');
for (const r of removed.slice(0, 10)) {
  console.log(`  - ${r.docId.padEnd(34)} was ${JSON.stringify(r.before).slice(0, 80)}`);
}
if (removed.length > 10) console.log(`  … +${removed.length - 10} more`);
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
