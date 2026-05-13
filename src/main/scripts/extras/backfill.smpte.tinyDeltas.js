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

// One-off: apply the 3 cherry-picked corrections from the small-count delta review
// (docType x2, doi x1) and lock the 25 reviewed-but-skipped fields with
// $meta.excludeChanges = true so future audit runs surface them in
// excludedDeltas[] (curator-locked) rather than re-flagging as fresh deltas.
//
// Dry-run by default. Pass --apply to write.
//
//   node src/main/scripts/extras/backfill.smpte.tinyDeltas.js
//   node src/main/scripts/extras/backfill.smpte.tinyDeltas.js --apply

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();

// --- Decisions from manual triage of the small-count delta batch -------------
// "apply" = write the source value over registry; "lock" = mark $meta.excludeChanges=true.
const DECISIONS = [
  // -- docType: 2 journals where source's "Journal Article" is the right convention
  { action: 'apply', docId: '10.5594-J07544', field: 'docType', value: 'Journal Article',
    reason: 'Standardize journal article docType (was "Technical Journal")' },
  { action: 'apply', docId: '10.5594-M00395', field: 'docType', value: 'Journal Article',
    reason: 'Standardize journal article docType (was "White Paper")' },

  // -- doi: registry has wrong DOI prefix (10.1093 = Oxford UP); source has correct 10.5594
  { action: 'apply', docId: '10.5594-J08349', field: 'doi', value: '10.5594/J08349',
    reason: 'Correct copy-paste error: registry had 10.1093 (Oxford UP) prefix' },

  // -- doi fillables: 3 records missing the explicit doi field; proposed values match the docId
  { action: 'apply', docId: '10.5594-J14711',     field: 'doi', value: '10.5594/J14711',
    reason: 'Fill missing doi (matches existing docId)' },
  { action: 'apply', docId: 'SMPTE.ST291.2010',   field: 'doi', value: '10.5594/SMPTE.ST291.2010',
    reason: 'Fill missing doi (matches existing docId)' },
  { action: 'apply', docId: 'SMPTE.ST291.2011',   field: 'doi', value: '10.5594/SMPTE.ST291.2011',
    reason: 'Fill missing doi (matches existing docId)' },

  // -- docType: 10 OV docs locked (registry "Overview Document" correctly classifies the OV prefix)
  { action: 'lock', docId: 'SMPTE.OV2021-0.2013', field: 'docType', reason: 'OV prefix → Overview Document; XML mapping too generic' },
  { action: 'lock', docId: 'SMPTE.OV2036-0.2012', field: 'docType', reason: 'OV prefix → Overview Document; XML mapping too generic' },
  { action: 'lock', docId: 'SMPTE.OV2048-0.2011', field: 'docType', reason: 'OV prefix → Overview Document; XML mapping too generic' },
  { action: 'lock', docId: 'SMPTE.OV2048-0.2012', field: 'docType', reason: 'OV prefix → Overview Document; XML mapping too generic' },
  { action: 'lock', docId: 'SMPTE.OV2052-0.2010', field: 'docType', reason: 'OV prefix → Overview Document; XML mapping too generic' },
  { action: 'lock', docId: 'SMPTE.OV299-0.2010',  field: 'docType', reason: 'OV prefix → Overview Document; XML mapping too generic' },
  { action: 'lock', docId: 'SMPTE.OV425-0.2011',  field: 'docType', reason: 'OV prefix → Overview Document; XML mapping too generic' },
  { action: 'lock', docId: 'SMPTE.OV425-0.2012',  field: 'docType', reason: 'OV prefix → Overview Document; XML mapping too generic' },
  { action: 'lock', docId: 'SMPTE.OV425-0.2014',  field: 'docType', reason: 'OV prefix → Overview Document; XML mapping too generic' },
  { action: 'lock', docId: 'SMPTE.OV435-0.2012',  field: 'docType', reason: 'OV prefix → Overview Document; XML mapping too generic' },

  // -- docType: 3 RP docs locked (registry "Recommended Practice")
  { action: 'lock', docId: 'SMPTE.RP2021-9.2017', field: 'docType', reason: 'RP prefix → Recommended Practice; XML mapping too generic' },
  { action: 'lock', docId: 'SMPTE.RP21.2015',     field: 'docType', reason: 'RP prefix → Recommended Practice; XML mapping too generic' },
  { action: 'lock', docId: 'SMPTE.RP91.2014',     field: 'docType', reason: 'RP prefix → Recommended Practice; XML mapping too generic' },

  // -- abstract: 8 docs locked (registry has full content; source has cosmetic / amendment-boilerplate variants)
  { action: 'lock', docId: 'SMPTE.ST2067-20.2016',          field: 'abstract', reason: 'Cosmetic difference; registry preferred' },
  { action: 'lock', docId: 'SMPTE.ST430-2.2017',            field: 'abstract', reason: 'Cosmetic difference; registry preferred' },
  { action: 'lock', docId: 'SMPTE.ST430-3.2012',            field: 'abstract', reason: 'Cosmetic difference; registry preferred' },
  { action: 'lock', docId: 'SMPTE.ST430-4.2008Am1.2011',    field: 'abstract', reason: 'Source has only boilerplate "amends X"; registry has full abstract' },
  { action: 'lock', docId: 'SMPTE.ST430-6.2010',            field: 'abstract', reason: 'Cosmetic; registry preferred (skipped per triage)' },
  { action: 'lock', docId: 'SMPTE.ST430-7.2008',            field: 'abstract', reason: 'Cosmetic difference; registry preferred' },
  { action: 'lock', docId: 'SMPTE.ST430-7.2008Am1.2011',    field: 'abstract', reason: 'Source has only boilerplate "amends X"; registry has full abstract' },
  { action: 'lock', docId: 'SMPTE.ST430-9.2008Am1.2011',    field: 'abstract', reason: 'Source has only boilerplate "amends X"; registry has full abstract' },

  // -- docNumber: ST422 leading-zero stripped (registry convention); ST425-3 source misidentified
  { action: 'lock', docId: 'SMPTE.ST422.2013',  field: 'docNumber', reason: 'Registry strips leading zero by convention' },
  { action: 'lock', docId: 'SMPTE.ST425-3.2015', field: 'docNumber', reason: 'Source XML reports docNumber=334 — source is misidentified, INVESTIGATE later' },

  // -- docPart: same ST425-3 misidentification
  { action: 'lock', docId: 'SMPTE.ST425-3.2015', field: 'docPart', reason: 'Source XML reports docPart=2 — source is misidentified, INVESTIGATE later' },

  // -- publisher: SMPTE short-form is registry convention
  { action: 'lock', docId: '10.5594-J08011', field: 'publisher', reason: '"SMPTE" short-form is registry-wide convention' },
];

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

const docs = loadJson(REGISTRY);
const schema = loadJson(SCHEMA);
const docIdx = new Map(docs.map((d, i) => [d.docId, i]));

const applied = [];
const locked = [];
const errors = [];

for (const decision of DECISIONS) {
  const i = docIdx.get(decision.docId);
  if (i === undefined) {
    errors.push({ ...decision, error: 'docId not found in registry' });
    continue;
  }
  const doc = docs[i];
  const metaKey = decision.field + '$meta';

  if (decision.action === 'apply') {
    const before = doc[decision.field];
    doc[decision.field] = decision.value;
    // Update $meta to record the curator decision
    doc[metaKey] = {
      ...(doc[metaKey] || {}),
      source: 'manual',
      confidence: 'high',
      note: decision.reason,
      updated: NOW,
      originalValue: before === undefined ? null : before,
      overridden: true,
    };
    applied.push({ docId: decision.docId, field: decision.field, before, after: decision.value });
  } else if (decision.action === 'lock') {
    // Lock — set excludeChanges on existing $meta (or create one if missing)
    const existing = doc[metaKey] || {};
    doc[metaKey] = {
      ...existing,
      excludeChanges: true,
      // Preserve existing source/confidence; add a triage note
      note: existing.note ? `${existing.note} | TRIAGE: ${decision.reason}` : `TRIAGE: ${decision.reason}`,
      updated: NOW,
    };
    locked.push({ docId: decision.docId, field: decision.field, reason: decision.reason });
  }
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== Tiny-deltas backfill ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Decisions: ${DECISIONS.length} (apply=${applied.length}, lock=${locked.length}, errors=${errors.length})\n`);

console.log(`Applied (${applied.length}):`);
for (const a of applied) {
  console.log(`  ✓ ${a.docId.padEnd(30)} ${a.field.padEnd(12)} ${JSON.stringify(a.before)} → ${JSON.stringify(a.after)}`);
}

console.log(`\nLocked with excludeChanges=true (${locked.length}):`);
for (const l of locked) {
  console.log(`  🔒 ${l.docId.padEnd(30)} ${l.field.padEnd(12)} ${l.reason}`);
}

if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  ✗ ${e.docId} ${e.field} — ${e.error}`);
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
