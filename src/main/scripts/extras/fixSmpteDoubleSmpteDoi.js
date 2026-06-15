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
};

function lockedMeta(originalValue, fieldDesc) {
  return {
    source: 'manual',
    confidence: 'high',
    note: `Corrected to the actually-registered (malformed) DOI form from Zoho standards export (${SOURCE}). The DOI registrar received this DOI with a duplicated SMPTE. prefix and that's the only form that resolves at doi.org — the SMPTE-canonical form (matching this doc's docId) does NOT resolve. UPSTREAM ACTION NEEDED: SMPTE should re-register this DOI in the canonical form to match the docId; once that lands, this field can be flipped back and the excludeChanges lock removed. Field locked via excludeChanges so future cross-fills can't "fix" it back to the unresolvable canonical form before the upstream re-registration happens.`,
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

console.log('');
console.log(`Planned writes: ${actions.length}  (already correct + locked: ${alreadyCorrect})`);

if (!APPLY) {
  console.log('\nDry run — pass --apply to write.');
  process.exit(0);
}

let written = 0;
for (const { doc, actualDoi, actualHref, priorDoi, priorHref } of actions) {
  doc.doi = actualDoi;
  doc.doi$meta = lockedMeta(priorDoi, 'doi');
  doc.href = actualHref;
  doc.href$meta = lockedMeta(priorHref, 'href');
  const sorted = sortKeysDeep(doc);
  const target = docAbsPath(sorted);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(sorted, null, 2) + '\n');
  written += 1;
}
console.log(`\nApplied ${written} doc(s). Reminder: run \`npm run canonicalize\` and \`npm run validate\`, then commit.`);
