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

// ONE-TIME fix for SMPTE docs whose registered DOI was malformed at the
// registrar. Several patterns, same effect:
//
//   1. Duplicated "SMPTE." prefix:
//      docId       : SMPTE.RDD58.2021
//      actual DOI  : 10.5594/SMPTE.SMPTERDD58.2021
//
//   2. Wrong separator (dash vs dot) between parts/year:
//      docId       : SMPTE.RP163.1992
//      actual DOI  : 10.5594/SMPTE.RP163-1992
//
//   3. Manual registrar errors (assorted shape mismatches):
//      docId       : SMPTE.ST2021.2008
//      actual DOI  : 10.5594/SMPTE.ST2021M.2008
//      docId       : SMPTE.ST421.2006Am1.2007
//      actual DOI  : 10.5594/SMPTE.ST421-A1.2006
//      …etc
//
//   4. Month-precision drift — registry stores docId with -MM precision but
//      the actually-registered DOI is year-only:
//      docId       : SMPTE.ST2110-41.2024-03
//      actual DOI  : 10.5594/SMPTE.ST2110-41.2024
//
// In every case the registry currently stores a "clean" DOI form that doesn't
// resolve at doi.org. This script flips the registry's doi + href onto the
// actually-registered form and locks both fields with $meta.excludeChanges:
// true so future cross-fills can't undo the fix. The docId itself is left
// alone — it's the registry's canonical identifier, not the DOI string.
//
// Dry-run by default. Pass --apply to write.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../lib/registry');

const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const SOURCE = '_source/SMPTE/Zoho/SMPTE Standards Document Zoho Export 2026-05-21.json';

// docId (canonical) → the actual registered DOI (Zoho's malformed form).
const FIXES = {
  // Pattern 1 — duplicated "SMPTE." prefix in DOI suffix.
  'SMPTE.RDD56.2021': '10.5594/SMPTE.SMPTERDD56.2021',
  'SMPTE.RDD58.2021': '10.5594/SMPTE.SMPTERDD58.2021',
  'SMPTE.ST2110-43.2021': '10.5594/SMPTE.SMPTEST2110-43.2021',
  'SMPTE.ST377-42.2021': '10.5594/SMPTE.SMPTEST377-42.2021',
  // Pattern 2 — wrong separator between part/year (dash vs dot) in DOI suffix.
  'SMPTE.OV2067-0.2021': '10.5594/SMPTE.OV2067-0-2021',
  'SMPTE.RP163.1992': '10.5594/SMPTE.RP163-1992',
  'SMPTE.RP170.1993': '10.5594/SMPTE.RP170-1993',
  'SMPTE.RP171.1993': '10.5594/SMPTE.RP171-1993',
  'SMPTE.RP172.1993': '10.5594/SMPTE.RP172-1993',
  'SMPTE.RP191.1996': '10.5594/SMPTE.RP191-1996',
  'SMPTE.RP27-1.1989': '10.5594/SMPTE.RP27.1.1989',
  'SMPTE.RP27-2.1989': '10.5594/SMPTE.RP27.2.1989',
  'SMPTE.RP27-5.1989': '10.5594/SMPTE.RP27.5.1989',
  'SMPTE.ST11.1995': '10.5594/SMPTE.ST11-1995',
  // Pattern 3 — manual registrar errors. Mapping from canonical registry docId
  // to whatever shape the registrar actually issued.
  'SMPTE.RP2047-5.2017Am1.2018': '10.5594/SMPTE.RP2047-5Am1.2018',
  'SMPTE.RP2052-10.2010Am1.2012': '10.5594/SMPTE.RP2052-10.2010-A1',
  'SMPTE.RP210.2007': '10.5594/SMPTE.RP210.10.2007',
  'SMPTE.RP210.2012': '10.5594/SMPTE.RP210v13.2012',
  'SMPTE.RP224.2011': '10.5594/SMPTE.RP224v11.2011',
  'SMPTE.RP224.2012': '10.5594/SMPTE.RP224v12.2012',
  'SMPTE.RP38.1989': '10.5594/SMPTE.RP38.1.1989',
  'SMPTE.ST2021.2008': '10.5594/SMPTE.ST2021M.2008',
  'SMPTE.ST379.2004': '10.5594/SMPTE.ST379M.2004',
  'SMPTE.ST421.2006Am1.2007': '10.5594/SMPTE.ST421-A1.2006',
  'SMPTE.ST421.2006Am2.2011': '10.5594/SMPTE.ST421-A2.2011',
  // Pattern 4 — month-precision drift. Registry stores docId with -MM, the
  // actually-registered DOI is year-only.
  'SMPTE.OV2073-0.2023-02': '10.5594/SMPTE.OV2073-0.2023',
  'SMPTE.RDD60.2025-05': '10.5594/SMPTE.RDD60.2025',
  'SMPTE.RDD61.2025-05': '10.5594/SMPTE.RDD61.2025',
  'SMPTE.RP2110-25.2023-04': '10.5594/SMPTE.RP2110-25.2023',
  'SMPTE.RP2129.2023-08': '10.5594/SMPTE.RP2129.2023',
  'SMPTE.RP268-3.2023-08': '10.5594/SMPTE.RP268-3.2023',
  'SMPTE.ST2021-4.2023-09': '10.5594/SMPTE.ST2021-4.2023',
  'SMPTE.ST2048-1.2024-08': '10.5594/SMPTE.ST2048-1.2024',
  'SMPTE.ST2048-2.2024-08': '10.5594/SMPTE.ST2048-2.2024',
  'SMPTE.ST2048-3.2024-08': '10.5594/SMPTE.ST2048-3.2024',
  'SMPTE.ST2065-5.2023-02': '10.5594/SMPTE.ST2065-5.2023',
  'SMPTE.ST2067-203.2023-09': '10.5594/SMPTE.ST2067-203.2023',
  'SMPTE.ST2067-70.2024-08': '10.5594/SMPTE.ST2067-70.2024',
  'SMPTE.ST2067-71.2024-07': '10.5594/SMPTE.ST2067-71.2024',
  'SMPTE.ST2081-1.2023-10': '10.5594/SMPTE.ST2081-1.2023',
  'SMPTE.ST2082-1.2023-11': '10.5594/SMPTE.ST2082-1.2023',
  'SMPTE.ST2094-2.2023-04': '10.5594/SMPTE.ST2094-2.2023',
  'SMPTE.ST2094-60.2025-12': '10.5594/SMPTE.ST2094-60.2025',
  'SMPTE.ST2095-1.2023-09': '10.5594/SMPTE.ST2095-1.2023',
  'SMPTE.ST2110-30.2025-10': '10.5594/SMPTE.ST2110-30.2025',
  'SMPTE.ST2110-40.2023-12': '10.5594/SMPTE.ST2110-40.2023',
  'SMPTE.ST2110-41.2024-03': '10.5594/SMPTE.ST2110-41.2024',
  'SMPTE.ST2117-10.2024-07': '10.5594/SMPTE.ST2117-10.2024',
  'SMPTE.ST2126.2025-08': '10.5594/SMPTE.ST2126.2025',
  'SMPTE.ST2127-2.2024-03': '10.5594/SMPTE.ST2127-2-2024',
  'SMPTE.ST2134.2025-01': '10.5594/SMPTE.ST2134.2025',
  'SMPTE.ST2136-1.2026-02': '10.5594/SMPTE.ST2136-1.2026',
  'SMPTE.ST2139.2025-12': '10.5594/SMPTE.ST2139.2025',
  'SMPTE.ST268-2.2023-06': '10.5594/SMPTE.ST268-2.2023',
  'SMPTE.ST377-41.2023-04': '10.5594/SMPTE.ST377-41.2023',
  'SMPTE.ST381-3.2025-01': '10.5594/SMPTE.ST381-3.2025',
  'SMPTE.ST381-5.2023-02': '10.5594/SMPTE.ST381-5.2023',
  // Pattern 5 — library release-tag errors. The DOI itself is correct at the
  // registrar; SMPTE's library applied the wrong release tag to the docId.
  // doi/href flip to the actually-registered (correct) form; the note for
  // these entries explains the release-tag side rather than the registrar.
  'SMPTE.EG2032-4.2014': '10.5594/SMPTE.EG2032-4.2007',
  'SMPTE.OV2052-0.2014': '10.5594/SMPTE.OV2052-0.2013',
  'SMPTE.ST434.2015':    '10.5594/SMPTE.ST434.2014',
};

// Per-docId custom note overrides. Use when the default "registrar issued
// malformed DOI" narrative doesn't match the actual cause (e.g. library
// release-tag errors, where the DOI is correct but the registry's docId tag
// is wrong). The default note from lockedMeta() applies when no entry here.
const CUSTOM_NOTES = {
  'SMPTE.EG2032-4.2014': `The actually-registered DOI 10.5594/SMPTE.EG2032-4.2007 resolves to the real 2007 publication of EG2032-4. The registry's docId carries a "2014" release tag — that's a SMPTE library mistake on the release-tag side, not a registrar issue. The DOI is correct; the docId/release-tag is wrong. UPSTREAM ACTION NEEDED: SMPTE library should correct the release tag from 2014 to 2007 so the docId matches the DOI. Field locked via excludeChanges so future cross-fills can't undo the alignment between the registry's stored DOI and what actually resolves.`,
  'SMPTE.OV2052-0.2014': `The actually-registered DOI 10.5594/SMPTE.OV2052-0.2013 (per Zoho) is the correct one — it resolves to OV 2052-0:2013. The registry's docId carries a "2014" release tag, which is a SMPTE library mistake on the release-tag side, not a registrar issue. The DOI is correct; the docId/release-tag is wrong. UPSTREAM ACTION NEEDED: SMPTE library should correct the release tag from 2014 to 2013 so the docId matches the DOI. Field locked via excludeChanges so future cross-fills can't undo the alignment.`,
  'SMPTE.ST434.2015': `The actually-registered DOI 10.5594/SMPTE.ST434.2014 (per Zoho) is the correct one — it resolves to ST 434:2014. The registry's docId carries a "2015" release tag, which is a SMPTE library mistake on the release-tag side, not a registrar issue. The DOI is correct; the docId/release-tag is wrong. UPSTREAM ACTION NEEDED: SMPTE library should correct the release tag from 2015 to 2014 so the docId matches the DOI. Field locked via excludeChanges so future cross-fills can't undo the alignment.`,
};

// Per-docId extra-field corrections cascading from a library mistag. The doi
// fix alone isn't enough — fields driven off the wrong release tag (dates,
// copyright year) are also wrong and need overwriting from the canonical
// Zoho record. Each entry: { fieldPath: { value, note } }. Field path uses
// dotted notation; nested objects (status, copyright) are created as needed.
const FIELD_OVERRIDES = {
  'SMPTE.EG2032-4.2014': {
    publicationDate: {
      value: '2007-01-01',
      note: `Library mistag: this doc is the 2007 publication of EG2032-4 (per the actually-registered DOI 10.5594/SMPTE.EG2032-4.2007). The prior 2014-12-14 stored here is actually the approval date — moved to approvalDate. Field locked; UPSTREAM ACTION NEEDED on SMPTE's library side to correct the release tag.`,
    },
    approvalDate: {
      value: '2014-12-14',
      note: `Library mistag: per Zoho's record at the correct DOI, this date is the approval of EG2032-4 (a 2007 publication). It was previously stored under publicationDate by mistake. Field locked; UPSTREAM ACTION NEEDED on SMPTE's library side.`,
    },
    'copyright.year': {
      value: '2007',
      note: `Library mistag: copyright year is 2007, matching the actual publication year per the registered DOI. The registry's "2014" release tag in the docId is a library error. Field locked; UPSTREAM ACTION NEEDED on SMPTE's library side.`,
    },
  },
};

function lockedMeta(originalValue, fieldDesc, docId) {
  const customNote = docId ? CUSTOM_NOTES[docId] : null;
  const note = customNote
    || `Corrected to the actually-registered (malformed) DOI form from Zoho standards export (${SOURCE}). The DOI registrar received this DOI with a duplicated SMPTE. prefix and that's the only form that resolves at doi.org — the SMPTE-canonical form (matching this doc's docId) does NOT resolve. UPSTREAM ACTION NEEDED: SMPTE should re-register this DOI in the canonical form to match the docId; once that lands, this field can be flipped back and the excludeChanges lock removed. Field locked via excludeChanges so future cross-fills can't "fix" it back to the unresolvable canonical form before the upstream re-registration happens.`;
  return {
    source: 'manual',
    confidence: 'high',
    note,
    originalValue,
    overridden: true,
    excludeChanges: true,
    updated: NOW,
  };
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

// Dotted-path get/set with sibling-$meta handling.
function getDeep(obj, parts) {
  let cur = obj;
  for (const p of parts) { if (cur == null || typeof cur !== 'object') return undefined; cur = cur[p]; }
  return cur;
}
function getDeepMeta(obj, parts) {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[parts[i]];
  }
  if (cur == null || typeof cur !== 'object') return undefined;
  return cur[`${parts[parts.length - 1]}$meta`];
}
function setDeepWithMeta(obj, parts, value, meta) {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  cur[last] = value;
  cur[`${last}$meta`] = meta;
}

function buildOverrideMeta(originalValue, note) {
  return {
    source: 'manual', confidence: 'high', note,
    originalValue: originalValue == null ? null : originalValue,
    overridden: true, excludeChanges: true, updated: NOW,
  };
}

const docs = loadAllDocs();
const byId = new Map(docs.map((d) => [d.docId, d]));

console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log('');

const actions = [];
let alreadyCorrect = 0;
for (const [docId, actualDoi] of Object.entries(FIXES)) {
  const doc = byId.get(docId);
  if (!doc) {
    console.log(`  ❌ ${docId}: not in registry — skip`);
    continue;
  }
  const actualHref = `https://doi.org/${actualDoi}`;
  const priorDoi = doc.doi;
  const priorHref = doc.href;
  // Skip if both fields already carry the target value AND are locked. Prevents
  // re-runs from clobbering an earlier apply's $meta.originalValue.
  const doiAlready = priorDoi === actualDoi && doc.doi$meta && doc.doi$meta.excludeChanges === true;
  const hrefAlready = priorHref === actualHref && doc.href$meta && doc.href$meta.excludeChanges === true;
  if (doiAlready && hrefAlready) {
    alreadyCorrect += 1;
    console.log(`  ${docId}: already locked at target — skip`);
    continue;
  }
  console.log(`  ${docId}`);
  console.log(`    doi:  ${JSON.stringify(priorDoi)}  →  ${JSON.stringify(actualDoi)}`);
  console.log(`    href: ${JSON.stringify(priorHref)}  →  ${JSON.stringify(actualHref)}`);
  actions.push({ docId, doc, actualDoi, actualHref, priorDoi, priorHref });
}

// Walk FIELD_OVERRIDES for additional per-doc field corrections (multi-field
// library-mistag fixes). Idempotent: skip any field already at target value
// AND locked. Surfaced in the dry-run summary as "extra-field writes".
const overrideActions = [];
let overridesAlreadyCorrect = 0;
for (const [docId, fields] of Object.entries(FIELD_OVERRIDES)) {
  const doc = byId.get(docId);
  if (!doc) { console.log(`  ❌ ${docId} (override): not in registry — skip`); continue; }
  for (const [fieldPath, spec] of Object.entries(fields)) {
    const parts = fieldPath.split('.');
    const priorVal = getDeep(doc, parts);
    const priorMeta = getDeepMeta(doc, parts);
    const alreadyLocked = priorVal === spec.value && priorMeta && priorMeta.excludeChanges === true;
    if (alreadyLocked) { overridesAlreadyCorrect += 1; continue; }
    console.log(`  ${docId} [override]`);
    console.log(`    ${fieldPath}: ${JSON.stringify(priorVal)}  →  ${JSON.stringify(spec.value)}`);
    overrideActions.push({ docId, doc, fieldPath, parts, value: spec.value, note: spec.note, priorVal });
  }
}

console.log('');
console.log(`Planned writes: ${actions.length} doi/href + ${overrideActions.length} extra-field`
  + `  (already correct + locked: ${alreadyCorrect} doi/href + ${overridesAlreadyCorrect} extra-field)`);

if (!APPLY) {
  console.log('\nDry run — pass --apply to write.');
  process.exit(0);
}

// Mutate in-memory docs in one pass (covers both doi/href fixes and
// FIELD_OVERRIDES), then write each unique doc once.
const mutatedDocs = new Set();
for (const { docId, doc, actualDoi, actualHref, priorDoi, priorHref } of actions) {
  doc.doi = actualDoi;
  doc.doi$meta = lockedMeta(priorDoi, 'doi', docId);
  doc.href = actualHref;
  doc.href$meta = lockedMeta(priorHref, 'href', docId);
  mutatedDocs.add(doc);
}
for (const { doc, parts, value, note, priorVal } of overrideActions) {
  setDeepWithMeta(doc, parts, value, buildOverrideMeta(priorVal, note));
  mutatedDocs.add(doc);
}
let written = 0;
for (const doc of mutatedDocs) {
  const sorted = sortKeysDeep(doc);
  const target = docAbsPath(sorted);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(sorted, null, 2) + '\n');
  written += 1;
}
console.log(`\nApplied ${written} doc(s). Reminder: run \`npm run canonicalize\` and \`npm run validate\`, then commit.`);
