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

// publicationDate triage:
//   1. Lock all 80 publicationDate deltas (registry matches releaseTag — gospel).
//   2. Preserve the source XML's date in a new `depositDate` field with provenance, so
//      future tooling (DOI reconciliation etc.) can reason about the IEEE Xplore deposit
//      date separately from the actual publication date.
//   3. Lock the 2 publicationDate fillables (no releaseTag in registry, source year-only)
//      with reviewRequired flag.
//
// Rationale: 80/80 publicationDate deltas have registry exactly matching the doc's
// releaseTag date. Source XML's <publication_date> is consistently 1-3 months later,
// indicating it represents SMPTE's IEEE Xplore deposit/registration date rather than
// the actual publication. We preserve that signal as a separate field rather than discarding it.
//
// Dry-run by default. Pass --apply to write.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const stringify = require('json-stable-stringify');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const REPORT = path.join(REPO_ROOT, 'src', 'main', 'reports', 'sourceInventory.smpte.json');
const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();

const LOCK_DELTA_REASON = "Registry matches releaseTag (gospel); source XML date appears to be SMPTE-IEEE Xplore deposit date, not publication";
const LOCK_FILLABLE_REASON = "INVESTIGATE: no releaseTag in registry; source has year-only — insufficient to fill confidently";

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

const docs = loadJson(REGISTRY);
const report = loadJson(REPORT);
const schema = loadJson(SCHEMA);
const docIdx = new Map(docs.map((d, i) => [d.docId, i]));

const lockedDeltas = [];
const lockedFillables = [];
const errors = [];

let depositDatesWritten = 0;

for (const u of report.update) {
  // 1. Lock every publicationDate delta + write source value to depositDate
  for (const d of (u.valueDeltas || [])) {
    if (d.field !== 'publicationDate') continue;
    const i = docIdx.get(u.docId);
    if (i === undefined) { errors.push({ docId: u.docId, error: 'not in registry' }); continue; }
    const doc = docs[i];
    const metaKey = 'publicationDate$meta';
    const existing = doc[metaKey] || {};
    doc[metaKey] = {
      ...existing,
      excludeChanges: true,
      note: existing.note ? `${existing.note} | TRIAGE: ${LOCK_DELTA_REASON}` : `TRIAGE: ${LOCK_DELTA_REASON}`,
      updated: NOW,
    };
    // Preserve the source XML's date as depositDate (only if not already set)
    if (d.sourceValue && doc.depositDate === undefined) {
      doc.depositDate = d.sourceValue;
      doc.depositDate$meta = {
        source: 'parsed',
        confidence: 'high',
        note: `Source XML <publication_date> — appears to be SMPTE/IEEE Xplore deposit date, distinct from actual publicationDate${d.sourceMetaPath ? ` (from ${d.sourceMetaPath})` : ''}`,
        updated: NOW,
      };
      depositDatesWritten++;
    }
    lockedDeltas.push({ docId: u.docId, reg: d.registryValue, src: d.sourceValue });
  }

  // 2. Lock the 2 publicationDate fillables (no releaseTag → can't fill confidently)
  for (const f of (u.fillableFields || [])) {
    if (f.field !== 'publicationDate') continue;
    const i = docIdx.get(u.docId);
    if (i === undefined) { errors.push({ docId: u.docId, error: 'not in registry' }); continue; }
    const doc = docs[i];
    const metaKey = 'publicationDate$meta';
    const existing = doc[metaKey] || {};
    doc[metaKey] = {
      ...existing,
      excludeChanges: true,
      reviewRequired: true,
      note: existing.note ? `${existing.note} | TRIAGE: ${LOCK_FILLABLE_REASON}` : `TRIAGE: ${LOCK_FILLABLE_REASON}`,
      updated: NOW,
    };
    lockedFillables.push({ docId: u.docId, proposed: f.proposedValue });
  }
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== publicationDate triage ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);
console.log(`depositDate fields written: ${depositDatesWritten}`);
console.log(`\nLocked deltas (${lockedDeltas.length}):`);
for (const d of lockedDeltas.slice(0, 10)) console.log(`  🔒 ${d.docId.padEnd(34)} reg=${d.reg}  src=${d.src}`);
if (lockedDeltas.length > 10) console.log(`  … +${lockedDeltas.length - 10} more`);

console.log(`\nLocked fillables (${lockedFillables.length}):`);
for (const f of lockedFillables) console.log(`  🔒 ${f.docId.padEnd(34)} proposed=${f.proposed}  (no releaseTag — INVESTIGATE)`);

if (errors.length) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  ✗ ${e.docId} — ${e.error}`);
}

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
