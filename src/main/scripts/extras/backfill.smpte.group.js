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

// group triage: 2 applies, 179 locks.
//
// Curator-confirmed SMPTE committee history:
//   - smpte-27c-tc absorbed smpte-20f-tc, smpte-21dc-tc, smpte-25css-tc.
//     Registry's 27c-tc is the modern merged committee; source XML has pre-merge codes.
//   - smpte-24tb-tc was split into smpte-10e-tc + smpte-32nf-tc.
//     Registry has the post-split correct committee; source XML has pre-split 24tb-tc.
//   - 2 docs (ST2094-2.2017, ST410.2008) registry was wrong; source's 31fs-tc is correct.
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

// 2 applies — registry was wrong, source is correct
const APPLY_DOCIDS = new Set(['SMPTE.ST2094-2.2017', 'SMPTE.ST410.2008']);

const LOCK_REASONS = {
  // src committee → reason for locking (registry stays)
  'smpte-20f-tc':  'Committee history: 20f-tc absorbed into 27c-tc. Registry has the modern merged committee',
  'smpte-21dc-tc': 'Committee history: 21dc-tc absorbed into 27c-tc. Registry has the modern merged committee',
  'smpte-25css-tc': 'Committee history: 25css-tc absorbed into 27c-tc. Registry has the modern merged committee',
  'smpte-24tb-tc': 'Committee history: 24tb-tc was split into 10e-tc + 32nf-tc. Registry has the post-split correct committee',
  'smpte-10e-tc':   'Lock per curator review of committee history',
};
const APPLY_REASON = 'Registry was wrong; source XML\'s smpte-31fs-tc is correct (curator-confirmed)';

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

const docs = loadJson(REGISTRY);
const report = loadJson(REPORT);
const schema = loadJson(SCHEMA);
const docIdx = new Map(docs.map((d, i) => [d.docId, i]));

const applied = [];
const locked = [];
const errors = [];
const transitions = new Map();

for (const u of report.update) {
  for (const d of (u.valueDeltas || [])) {
    if (d.field !== 'group') continue;
    const i = docIdx.get(u.docId);
    if (i === undefined) { errors.push({ docId: u.docId, error: 'not in registry' }); continue; }
    const doc = docs[i];

    if (APPLY_DOCIDS.has(u.docId)) {
      // APPLY: source wins
      const before = doc.group;
      doc.group = d.sourceValue;
      doc.group$meta = {
        ...(doc.group$meta || {}),
        source: 'parsed',
        confidence: 'high',
        note: APPLY_REASON,
        updated: NOW,
        originalValue: before,
        overridden: true,
      };
      applied.push({ docId: u.docId, before, after: d.sourceValue });
    } else {
      // LOCK: registry wins per committee history
      const reason = LOCK_REASONS[d.sourceValue] || 'Lock per curator review';
      const existing = doc.group$meta || {};
      doc.group$meta = {
        ...existing,
        excludeChanges: true,
        note: existing.note ? `${existing.note} | TRIAGE: ${reason}` : `TRIAGE: ${reason}`,
        updated: NOW,
      };
      locked.push({ docId: u.docId, reg: d.registryValue, src: d.sourceValue, reason });
    }
    const k = d.registryValue + ' → ' + d.sourceValue;
    transitions.set(k, (transitions.get(k) || 0) + 1);
  }
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const ok = validate(docs);

console.log('=== group triage ===\n');
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Applied: ${applied.length}, Locked: ${locked.length}, Errors: ${errors.length}\n`);

console.log('Applied (source wins — registry was wrong):');
for (const a of applied) console.log(`  ✓ ${a.docId.padEnd(30)} ${a.before} → ${a.after}`);

console.log(`\nLocked transitions:`);
for (const [k, n] of [...transitions.entries()].sort((a, b) => b[1] - a[1])) {
  // applied count is folded in by docId membership above; show the transition counts
  const isAppliedTransition = [...applied].some((a) => `${a.before} → ${a.after}` === k);
  const label = isAppliedTransition ? '(some applied)' : '(all locked)';
  console.log(`  ${n.toString().padStart(4)} × ${k}  ${label}`);
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
