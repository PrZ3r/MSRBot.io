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

// ONE-TIME fixup. Some SMPTE source refs resolved to an undated org-lineage refId
// (ATSC.A53, ETSI.TS-101-154, EBU.Tech3250, …) although their source <ref> carries a
// <date> — because resolveSmpteSourceRefs.js fed parseRefId only the bare <standardnum>.
// This renames each such ref in documents.json to its dated form, per citing doc, using the
// year recorded in the MRI rawVariant's rawRef. Genuinely-yearless refs are left as lineage
// (the MRI resolves those to the latest revision).
//
// Writes documents.json only. Re-run `npm run build-mri` afterwards to realign the MRI.
// Dry-run by default. Pass --apply to write. Run from the repo root.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const MRI = path.join(REPO_ROOT, 'src', 'main', 'reports', 'masterReferenceIndex.json');
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// Org-lineage refIds that should carry a .YYYY but don't.
const ORG = /^(EBU\.(?:Tech|[RD])\d|AES\d|ETSI\.|ATSC\.A|CEA\.\d|CIE\.[0-9S]|TIA\.\d)/;
const DATED = /\.\d{4}(?:-\d{2})?$/;
function yearOf(rawRef) {
  const m = String(rawRef || '').match(/<year>\s*((?:19|20)\d{2})\s*<\/year>/i)
    || String(rawRef || '').match(/\b((?:19|20)\d{2})\b/);
  return m ? m[1] : null;
}

const docs = loadJson(REGISTRY);
const schema = loadJson(SCHEMA);
const refs = (loadJson(MRI).refs) || {};

// --- plan renames from MRI rawVariants: docId → [{ type, old, new }] -----------------------
const renamesByDoc = new Map();
let datable = 0;
let yearless = 0;
for (const [refId, entry] of Object.entries(refs)) {
  if (!ORG.test(refId) || DATED.test(refId)) continue;
  for (const v of entry.rawVariants || []) {
    const yr = yearOf(v.rawRef);
    if (!yr) { yearless++; continue; }
    datable++;
    if (!renamesByDoc.has(v.docId)) renamesByDoc.set(v.docId, []);
    renamesByDoc.get(v.docId).push({ type: v.type, old: refId, dated: `${refId}.${yr}` });
  }
}

// --- apply to documents.json ---------------------------------------------------------------
let docsChanged = 0;
let refsRenamed = 0;
const samples = [];
const docById = new Map(docs.map((d) => [d.docId, d]));
for (const [docId, list] of renamesByDoc) {
  const doc = docById.get(docId);
  if (!doc || !doc.references) continue;
  let changed = false;
  for (const { type, old, dated } of list) {
    const arr = doc.references[type];
    if (!Array.isArray(arr)) continue;
    const i = arr.indexOf(old);
    if (i < 0) continue;
    if (arr.includes(dated)) arr.splice(i, 1); // dated form already present → drop the dup
    else arr[i] = dated;
    changed = true;
    refsRenamed++;
    if (samples.length < 16) samples.push(`${docId} (${type}): ${old} → ${dated}`);
  }
  if (changed) {
    docsChanged++;
    for (const bucket of ['normative', 'bibliographic']) {
      if (Array.isArray(doc.references[bucket])) {
        doc.references[bucket + '$meta'] = { ...(doc.references[bucket + '$meta'] || {}), updated: NOW };
      }
    }
  }
}

// --- validate + report ---------------------------------------------------------------------
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== fix undated SMPTE source refs ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Undated-org rawVariants seen: ${datable + yearless}  (datable ${datable}, genuinely yearless ${yearless})`);
console.log(`documents.json: ${refsRenamed} ref(s) renamed across ${docsChanged} doc(s)`);
console.log(`Schema validation: ${ok ? 'PASS' : 'FAIL'}`);
if (!ok) for (const e of validate.errors.slice(0, 10)) console.log('  -', e.dataPath || e.instancePath, e.message);
console.log('\n-- Sample renames --');
for (const s of samples) console.log(`  ${s}`);

if (APPLY) {
  if (!ok) { console.error('\nRefusing to apply — validation failed.'); process.exit(2); }
  fs.writeFileSync(REGISTRY, stringify(docs, { space: '  ' }) + '\n');
  console.log(`\nWrote ${path.relative(REPO_ROOT, REGISTRY)} (${refsRenamed} refs dated).`);
  console.log('Reminder: run `npm run canonicalize && npm run validate`, then `npm run build-mri`');
  console.log('to realign the MRI to the dated refIds.');
} else {
  console.log('\nDry run — no changes written. Pass --apply to write.');
}
