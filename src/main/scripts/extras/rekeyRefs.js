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

// Re-key stored citations after a parser or refMap fix.
//
// Citations written by earlier extractor runs or one-off backfills keep the refId the parser
// produced at the time. When the parser later learns to read a cite correctly, those stored
// refIds stay wrong, because nothing re-parses them. This re-derives them from the verbatim
// cite text the MRI recorded for each sighting:
//
//   --refs A,B,…        refIds to re-key. Each citing doc's sighting cite is run through
//                       parseRefId; the stored refId is replaced when the result differs.
//   --rename OLD=NEW    for citations with no cite text (replayed from documents), or after a
//                       registry merge/rename: replace OLD with NEW outright. Repeatable.
//   --apply             write the docs (default is a dry run that changes nothing).
//
// Citations whose cite parses to nothing, or back to the same refId, are reported and left.
// Each touched references[type] list records the prior list in `<type>$meta.originalValue`.
// Run `npm run canonicalize` and `npm run validate` after --apply, then rebuild the MRI.
//
// Usage:
//   node src/main/scripts/extras/rekeyRefs.js --refs SMPTE.ST336M.2007,SMPTE.RP2242
//   node src/main/scripts/extras/rekeyRefs.js --rename SMPTE.RP27.3.1989=SMPTE.RP27-3.1989 --apply

const path = require('path');
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, saveDoc } = require('../../lib/registry');
const { parseRefId } = require('../../lib/referencing');
const { loadMri } = require('../../lib/mriStore');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const listArg = (flag) => argv.flatMap((a, i) => (a === flag && argv[i + 1] ? [argv[i + 1]] : []));
const reparse = new Set(listArg('--refs').flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean));
const rename = new Map(listArg('--rename').map((v) => v.split('=').map((s) => s.trim())).filter(([a, b]) => a && b));
if (!reparse.size && !rename.size) {
  console.error('Nothing to do: pass --refs A,B,… and/or --rename OLD=NEW.');
  process.exit(1);
}

// Verbatim cite per (refId, citing docId, type), from the MRI sightings.
const mri = loadMri() || { refs: {} };
const citeOf = new Map();
for (const refId of reparse) {
  for (const v of (mri.refs[refId] && mri.refs[refId].rawVariants) || []) {
    if (v.cite) citeOf.set(`${refId}||${v.docId}||${v.type}`, { cite: v.cite, href: v.href || '' });
  }
}

const NOW = new Date().toISOString();
const changes = [];
const skipped = [];

for (const doc of loadAllDocs()) {
  const refs = doc.references;
  if (!refs || typeof refs !== 'object') continue;
  let docChanged = false;

  for (const type of Object.keys(refs)) {
    const list = refs[type];
    if (type.endsWith('$meta') || !Array.isArray(list)) continue;

    const next = list.map((refId) => {
      if (rename.has(refId)) {
        changes.push({ docId: doc.docId, type, from: refId, to: rename.get(refId), via: 'rename' });
        return rename.get(refId);
      }
      if (!reparse.has(refId)) return refId;
      const src = citeOf.get(`${refId}||${doc.docId}||${type}`);
      const parsed = src ? parseRefId(src.cite, src.href) : null;
      if (!parsed || parsed === refId) {
        skipped.push({ docId: doc.docId, type, refId, why: src ? `parses to ${parsed || 'nothing'}` : 'no cite text in MRI' });
        return refId;
      }
      changes.push({ docId: doc.docId, type, from: refId, to: parsed, via: 'parseRefId', cite: src.cite });
      return parsed;
    });

    const deduped = [...new Set(next)];
    if (JSON.stringify(deduped) !== JSON.stringify(list)) {
      refs[type] = deduped;
      const meta = refs[`${type}$meta`] || {};
      refs[`${type}$meta`] = {
        ...meta,
        note: 'Re-keyed after a citation parser fix (rekeyRefs.js)',
        originalValue: list,
        overridden: true,
        updated: NOW,
      };
      docChanged = true;
    }
  }

  if (docChanged && APPLY) saveDoc(doc);
}

for (const c of changes) {
  console.log(`${c.docId} [${c.type}] ${c.from} → ${c.to} (${c.via})${c.cite ? `  « ${c.cite.slice(0, 80)} »` : ''}`);
}
for (const s of skipped) console.log(`skip ${s.docId} [${s.type}] ${s.refId}: ${s.why}`);
const docs = new Set(changes.map((c) => c.docId)).size;
console.log(`\n${changes.length} citation(s) in ${docs} doc(s) ${APPLY ? 're-keyed' : 'would be re-keyed'}; ${skipped.length} skipped.`);
if (!APPLY) console.log('Dry run — pass --apply to write.');
