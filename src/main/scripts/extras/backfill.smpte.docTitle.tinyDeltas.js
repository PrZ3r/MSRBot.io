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

// docTitle small-deltas batch:
//   - Apply 4 typo corrections (source's value is correct) AND lock with
//     excludeChanges so future automated extractions don't re-introduce the
//     typo.
//   - Punctuation (17) and parenthetical (1) deltas held for separate review.
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
const NOW = new Date().toISOString();

// Apply each correction AND lock with excludeChanges (so future re-extraction
// can't re-introduce the typo).
const APPLIES = [
  { docId: 'SMPTE.EG40.2016',    value: 'Conversion of Time Values between SMPTE ST 12-1 Time Code, MPEG-2 PCR Time Base and Absolute Time', reason: 'Fix typo "Absoute" → "Absolute"; lock against re-extraction' },
  { docId: 'SMPTE.RP211.2000',   value: 'Implementation of 24P, 25P and 30P Segmented Frames for 1920 × 1080 Production Format',                reason: 'Use × glyph in resolution; lock against re-extraction' },
  { docId: 'SMPTE.ST299-1.2009', value: '24-Bit Digital Audio Format for SMPTE 292 Bit-Serial Interface',                                       reason: 'Designator: "292M" → "292"; lock against re-extraction' },
  { docId: 'SMPTE.ST381-4.2017', value: 'Mapping AAC Compressed Audio into the MXF Generic Container',                                          reason: 'Fix typo "Compresed" → "Compressed"; lock against re-extraction' },
];

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

const docs = loadJson(REGISTRY);
const schema = loadJson(SCHEMA);
const docIdx = new Map(docs.map((d, i) => [d.docId, i]));

const applied = [], errors = [];

for (const a of APPLIES) {
  const i = docIdx.get(a.docId);
  if (i === undefined) { errors.push({ docId: a.docId, error: 'not in registry' }); continue; }
  const doc = docs[i];
  const before = doc.docTitle;
  doc.docTitle = a.value;
  doc['docTitle$meta'] = {
    ...(doc['docTitle$meta'] || {}),
    source: 'manual',
    confidence: 'high',
    note: a.reason,
    updated: NOW,
    originalValue: before === undefined ? null : before,
    overridden: true,
    excludeChanges: true,
  };
  applied.push({ docId: a.docId, before, after: a.value, reason: a.reason });
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== docTitle tiny-deltas batch ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Applied+Locked: ${applied.length}, Errors: ${errors.length}\n`);

console.log(`Applied AND locked (source-correction + excludeChanges):`);
for (const a of applied) {
  console.log(`  ✓🔒 ${a.docId}`);
  console.log(`      before: ${JSON.stringify(a.before).slice(0, 110)}`);
  console.log(`      after:  ${JSON.stringify(a.after).slice(0, 110)}`);
  console.log(`      reason: ${a.reason}`);
}

if (errors.length) {
  console.log(`\nErrors:`); for (const e of errors) console.log(`  ✗ ${e.docId} — ${e.error}`);
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
