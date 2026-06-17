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
  // Library release tag missing the month suffix that Zoho carries.
  'SMPTE.OV425-0.2012':  '10.5594/SMPTE.OV425-0.2012-06',
  'SMPTE.ST2123.2021':   '10.5594/SMPTE.ST2123.2021-08',
  // Am vs Amd amendment-notation drift. Both notations are valid; Zoho uses
  // "Amd1" while the registry uses "Am1". Both DOI forms should resolve.
  'SMPTE.RDD48.2018Am1.2022':    '10.5594/SMPTE.RDD48.2018Amd1.2022',
  'SMPTE.ST2019-4.2016Am1.2024': '10.5594/SMPTE.ST2019-4.2016Amd1.2024',
  'SMPTE.ST268-2.2018Am1.2022':  '10.5594/SMPTE.ST268-2.2018Amd1.2022',
  'SMPTE.ST331.2011Am1.2023':    '10.5594/SMPTE.ST331.2011Amd1.2023',
  // Registrar used the publication month (-05) instead of the approval month
  // (-03) when minting the DOI; registry's docId is correct using the approval
  // date convention. Need to flip stored doi to what actually resolves.
  'SMPTE.ST2123.2024-03':        '10.5594/SMPTE.ST2123.2024-05',
  // ST165 — registered as 1999 by typo; correct version is 1994. Flip to the
  // actually-registered (typo) form; upstream needs to fix on SMPTE's side.
  'SMPTE.ST165.1994':            '10.5594/SMPTE.ST165.1999',
  // RP107 — Zoho carries 1995 (published label typo, doc sat 2 yr between
  // approval and publication). Align registry to Zoho's form; upstream needs
  // to correct to 1993 to match approval/registration year.
  'SMPTE.RP107.1993':            '10.5594/SMPTE.RP107.1995',
  // Pattern 6 — year-mismatch DOI registrations. DOI was registered with a
  // year that doesn't match the doc's actual version year (per the registry's
  // canonical docId). All share the same generic YEAR_MISMATCH_NOTE.
  'SMPTE.EG2059-10.2022':        '10.5594/SMPTE.EG2059-10.2023',
  'SMPTE.EG2111-1.2020':         '10.5594/SMPTE.EG2111-1.2021',
  'SMPTE.EG2111-2.2018':         '10.5594/SMPTE.EG2111-2.2019',
  'SMPTE.EG2111-3.2020':         '10.5594/SMPTE.EG2111-3.2021',
  'SMPTE.RDD29.2018':            '10.5594/SMPTE.RDD29.2019',
  'SMPTE.RP103.1994':            '10.5594/SMPTE.RP103.1995',
  'SMPTE.RP2047-1.2022':         '10.5594/SMPTE.RP2047-1.2023',
  'SMPTE.RP2047-3.2022':         '10.5594/SMPTE.RP2047-3.2023',
  'SMPTE.RP2059-15.2022':        '10.5594/SMPTE.RP2059-15.2023',
  'SMPTE.RP2110-24.2022':        '10.5594/SMPTE.RP2110-24.2023',
  'SMPTE.RP34.1997':             '10.5594/SMPTE.RP34.1998',
  'SMPTE.RP86.1990':             '10.5594/SMPTE.RP86.1991',
  'SMPTE.ST2019-1.2016Am1.2022': '10.5594/SMPTE.ST2019-1.2016Amd1.2023',
  'SMPTE.ST2022-7.2018':         '10.5594/SMPTE.ST2022-7.2019',
  'SMPTE.ST2038.2020':           '10.5594/SMPTE.ST2038.2021',
  'SMPTE.ST2059-2.2020':         '10.5594/SMPTE.ST2059-2.2021',
  'SMPTE.ST2067-202.2022':       '10.5594/SMPTE.ST2067-202.2023',
  'SMPTE.ST2067-60.2022':        '10.5594/SMPTE.ST2067-60.2023',
  'SMPTE.ST2117-1.2022':         '10.5594/SMPTE.ST2117-1.2023',
  'SMPTE.ST382.2022':            '10.5594/SMPTE.ST382.2023',
  'SMPTE.ST385.2012Am1.2022':    '10.5594/SMPTE.ST385.2012Amd1.2023',
  'SMPTE.ST429-20.2022':         '10.5594/SMPTE.ST429-20.2023',
  'SMPTE.ST429-6.2006Am1.2017':  '10.5594/SMPTE.ST429-6.2006Am1.2018',
  'SMPTE.ST430-14.2021':         '10.5594/SMPTE.ST430-14.2022',
  'SMPTE.ST430-17.2021':         '10.5594/SMPTE.ST430-17.2022',
  'SMPTE.ST435-2.2008':          '10.5594/SMPTE.ST435-2.2009',
  'SMPTE.ST55.2010':             '10.5594/SMPTE.ST55.2011',
};

// Shared note for Pattern 6 — year-mismatch DOI registrations. Used by every
// entry in the 27-doc batch below (added to CUSTOM_NOTES programmatically).
const YEAR_MISMATCH_NOTE = `Year-mismatch DOI registration: the DOI in this field is what's actually registered at doi.org and resolves, but the year in it doesn't match the doc's actual version — the registry's docId carries the canonical version year, and $meta.originalValue preserves the prior (matching) DOI form. UPSTREAM ACTION NEEDED: SMPTE should re-register the DOI with the correct year to match the docId, so the canonical form also resolves. Field locked via excludeChanges so future cross-fills can't undo the alignment between the registry's stored DOI and what currently resolves at doi.org.`;
const YEAR_MISMATCH_DOC_IDS = [
  'SMPTE.EG2059-10.2022','SMPTE.EG2111-1.2020','SMPTE.EG2111-2.2018','SMPTE.EG2111-3.2020',
  'SMPTE.RDD29.2018','SMPTE.RP103.1994','SMPTE.RP2047-1.2022','SMPTE.RP2047-3.2022',
  'SMPTE.RP2059-15.2022','SMPTE.RP2110-24.2022','SMPTE.RP34.1997','SMPTE.RP86.1990',
  'SMPTE.ST2019-1.2016Am1.2022','SMPTE.ST2022-7.2018','SMPTE.ST2038.2020','SMPTE.ST2059-2.2020',
  'SMPTE.ST2067-202.2022','SMPTE.ST2067-60.2022','SMPTE.ST2117-1.2022','SMPTE.ST382.2022',
  'SMPTE.ST385.2012Am1.2022','SMPTE.ST429-20.2022','SMPTE.ST429-6.2006Am1.2017',
  'SMPTE.ST430-14.2021','SMPTE.ST430-17.2021','SMPTE.ST435-2.2008','SMPTE.ST55.2010',
];

// Per-docId custom note overrides. Use when the default "registrar issued
// malformed DOI" narrative doesn't match the actual cause (e.g. library
// release-tag errors, where the DOI is correct but the registry's docId tag
// is wrong). The default note from lockedMeta() applies when no entry here.
const CUSTOM_NOTES = {
  'SMPTE.EG2032-4.2014': `The actually-registered DOI 10.5594/SMPTE.EG2032-4.2007 resolves to the real 2007 publication of EG2032-4. The registry's docId carries a "2014" release tag — that's a SMPTE library mistake on the release-tag side, not a registrar issue. The DOI is correct; the docId/release-tag is wrong. UPSTREAM ACTION NEEDED: SMPTE library should correct the release tag from 2014 to 2007 so the docId matches the DOI. Field locked via excludeChanges so future cross-fills can't undo the alignment between the registry's stored DOI and what actually resolves.`,
  'SMPTE.OV2052-0.2014': `The actually-registered DOI 10.5594/SMPTE.OV2052-0.2013 (per Zoho) is the correct one — it resolves to OV 2052-0:2013. The registry's docId carries a "2014" release tag, which is a SMPTE library mistake on the release-tag side, not a registrar issue. The DOI is correct; the docId/release-tag is wrong. UPSTREAM ACTION NEEDED: SMPTE library should correct the release tag from 2014 to 2013 so the docId matches the DOI. Field locked via excludeChanges so future cross-fills can't undo the alignment.`,
  'SMPTE.ST434.2015': `The actually-registered DOI 10.5594/SMPTE.ST434.2014 (per Zoho) is the correct one — it resolves to ST 434:2014. The registry's docId carries a "2015" release tag, which is a SMPTE library mistake on the release-tag side, not a registrar issue. The DOI is correct; the docId/release-tag is wrong. UPSTREAM ACTION NEEDED: SMPTE library should correct the release tag from 2015 to 2014 so the docId matches the DOI. Field locked via excludeChanges so future cross-fills can't undo the alignment.`,
  'SMPTE.OV425-0.2012': `The actually-registered DOI 10.5594/SMPTE.OV425-0.2012-06 (per Zoho) is the correct one — it resolves to OV 425-0:2012-06. The registry's docId carries a "2012" release tag missing the "-06" month suffix; that's a SMPTE library mistake on the release-tag side, not a registrar issue. The DOI is correct; the docId/release-tag is wrong. UPSTREAM ACTION NEEDED: SMPTE library should correct the release tag from 2012 to 2012-06 so the docId matches the DOI. Field locked via excludeChanges so future cross-fills can't undo the alignment.`,
  'SMPTE.ST2123.2021': `The actually-registered DOI 10.5594/SMPTE.ST2123.2021-08 (per Zoho) is the correct one — it resolves to ST 2123:2021-08. The registry's docId carries a "2021" release tag missing the "-08" month suffix; that's a SMPTE library mistake on the release-tag side, not a registrar issue. The DOI is correct; the docId/release-tag is wrong. UPSTREAM ACTION NEEDED: SMPTE library should correct the release tag from 2021 to 2021-08 so the docId matches the DOI. Field locked via excludeChanges so future cross-fills can't undo the alignment.`,
  // Am vs Amd amendment-notation drift — same canonical note pattern for all 4.
  'SMPTE.RDD48.2018Am1.2022': `Amendment notation drift: registry uses "Am1" in the docId while the actually-registered DOI per Zoho uses "Amd1" (10.5594/SMPTE.RDD48.2018Amd1.2022). Both notations are valid for "Amendment 1" — UPSTREAM ACTION NEEDED: SMPTE should register both DOI forms so they're interchangeable. Field locked via excludeChanges so future cross-fills can't toggle this back.`,
  'SMPTE.ST2019-4.2016Am1.2024': `Amendment notation drift: registry uses "Am1" in the docId while the actually-registered DOI per Zoho uses "Amd1" (10.5594/SMPTE.ST2019-4.2016Amd1.2024). Both notations are valid for "Amendment 1" — UPSTREAM ACTION NEEDED: SMPTE should register both DOI forms so they're interchangeable. Field locked via excludeChanges so future cross-fills can't toggle this back.`,
  'SMPTE.ST268-2.2018Am1.2022': `Amendment notation drift: registry uses "Am1" in the docId while the actually-registered DOI per Zoho uses "Amd1" (10.5594/SMPTE.ST268-2.2018Amd1.2022). Both notations are valid for "Amendment 1" — UPSTREAM ACTION NEEDED: SMPTE should register both DOI forms so they're interchangeable. Field locked via excludeChanges so future cross-fills can't toggle this back.`,
  'SMPTE.ST331.2011Am1.2023': `Amendment notation drift: registry uses "Am1" in the docId while the actually-registered DOI per Zoho uses "Amd1" (10.5594/SMPTE.ST331.2011Amd1.2023). Both notations are valid for "Amendment 1" — UPSTREAM ACTION NEEDED: SMPTE should register both DOI forms so they're interchangeable. Field locked via excludeChanges so future cross-fills can't toggle this back.`,
  'SMPTE.ST2123.2024-03': `Registrar mistake: the DOI 10.5594/SMPTE.ST2123.2024-05 was registered using the publication month (-05, May 2024) when it should have used the approval month (-03, March 2024) — the docId's "-03" is the correct convention. UPSTREAM ACTION NEEDED: SMPTE should re-register this DOI with the -03 suffix to match the docId, or register both forms so the canonical -03 also resolves. Field locked via excludeChanges so future cross-fills can't undo the alignment between the registry's stored DOI and what currently resolves.`,
  'SMPTE.ST165.1994': `Registrar typo: the DOI 10.5594/SMPTE.ST165.1999 (per Zoho) is what's actually registered and resolves at doi.org, but the correct version is 1994 — Zoho's Publication_Date and Copyright_Year on that record confirm 1994 is the real year. The 1999 in both the published label and DOI is a typo on SMPTE's side. UPSTREAM ACTION NEEDED: SMPTE should correct the DOI registration from 1999 to 1994 to match the docId. Field locked via excludeChanges so future cross-fills can't undo the alignment between the registry's stored DOI and what currently resolves.`,
  'SMPTE.RP107.1993': `Published-label typo: the DOI 10.5594/SMPTE.RP107.1995 (per Zoho) is what Zoho carries, but the correct version is 1993 — the doc was approved 1993-03-05 and sat unpublished until 1995-01-01; the published label retroactively used 1995 as the version year, cascading into the DOI. The docId correctly reflects the 1993 version year. UPSTREAM ACTION NEEDED: SMPTE should correct the DOI registration from 1995 to 1993 to match the docId. Field locked via excludeChanges so future cross-fills can't undo the alignment between the registry's stored DOI and what Zoho currently has.`,
};
// Wire Pattern-6 docs to share YEAR_MISMATCH_NOTE.
for (const id of YEAR_MISMATCH_DOC_IDS) CUSTOM_NOTES[id] = YEAR_MISMATCH_NOTE;

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
  'SMPTE.ST2123.2021': {
    publicationDate: {
      value: '2021-10-18',
      note: `Library mistag: this doc is ST 2123:2021-08 (per the actually-registered DOI 10.5594/SMPTE.ST2123.2021-08). Per Zoho, Publication_Date is 2021-10-18; the prior 2021-07-01 stored here is actually the approval date — moved to approvalDate. Field locked; UPSTREAM ACTION NEEDED on SMPTE's library side to add the month suffix to the release tag.`,
    },
    approvalDate: {
      value: '2021-07-01',
      note: `Library mistag: per Zoho's record at the correct DOI, this date is the approval of ST 2123:2021-08. It was previously stored under publicationDate by mistake. Field locked; UPSTREAM ACTION NEEDED on SMPTE's library side.`,
    },
    'copyright.year': {
      value: '2021',
      note: `Library mistag: copyright year is 2021, matching the actual publication year per the registered DOI. The registry was missing the value. Field locked; UPSTREAM ACTION NEEDED on SMPTE's library side.`,
    },
  },
  // The 4 Am/Amd docs all have the same cascade: registry stored approval date
  // as publicationDate; Zoho has the real Publication_Date plus the approval
  // date and copyright year that were missing.
  'SMPTE.RDD48.2018Am1.2022': {
    publicationDate: { value: '2022-05-24', note: `Library cascade: per Zoho's record at the canonical DOI, Publication_Date is 2022-05-24. The prior 2022-02-22 stored here is the approval date — moved to approvalDate.` },
    approvalDate:    { value: '2022-02-22', note: `Library cascade: per Zoho, approval date is 2022-02-22 (was previously stored as publicationDate).` },
    'copyright.year':{ value: '2022',       note: `Library cascade: copyright year is 2022 per Zoho.` },
  },
  'SMPTE.ST2019-4.2016Am1.2024': {
    publicationDate: { value: '2024-05-02', note: `Library cascade: per Zoho's record at the canonical DOI, Publication_Date is 2024-05-02. The prior 2024-03-08 stored here is the approval date — moved to approvalDate.` },
    approvalDate:    { value: '2024-03-08', note: `Library cascade: per Zoho, approval date is 2024-03-08 (was previously stored as publicationDate).` },
    'copyright.year':{ value: '2024',       note: `Library cascade: copyright year is 2024 per Zoho.` },
  },
  'SMPTE.ST268-2.2018Am1.2022': {
    publicationDate: { value: '2022-05-04', note: `Library cascade: per Zoho's record at the canonical DOI, Publication_Date is 2022-05-04. The prior 2022-02-24 stored here is the approval date — moved to approvalDate.` },
    approvalDate:    { value: '2022-02-24', note: `Library cascade: per Zoho, approval date is 2022-02-24 (was previously stored as publicationDate).` },
    'copyright.year':{ value: '2022',       note: `Library cascade: copyright year is 2022 per Zoho.` },
  },
  'SMPTE.ST331.2011Am1.2023': {
    publicationDate: { value: '2024-02-06', note: `Library cascade: per Zoho's record at the canonical DOI, Publication_Date is 2024-02-06. The prior 2023-10-10 stored here is the approval date — moved to approvalDate.` },
    approvalDate:    { value: '2023-10-10', note: `Library cascade: per Zoho, approval date is 2023-10-10 (was previously stored as publicationDate).` },
    'copyright.year':{ value: '2023',       note: `Library cascade: copyright year is 2023 per Zoho.` },
  },
  'SMPTE.ST2123.2024-03': {
    publicationDate: { value: '2024-05-09', note: `Library cascade: per Zoho's record at the registered DOI, Publication_Date is 2024-05-09. The prior 2024-03-28 stored here is the approval date — moved to approvalDate.` },
    approvalDate:    { value: '2024-03-28', note: `Library cascade: per Zoho, approval date is 2024-03-28 (was previously stored as publicationDate). The docId's -03 suffix correctly reflects this approval month.` },
    'copyright.year':{ value: '2024',       note: `Library cascade: copyright year is 2024 per Zoho.` },
  },
  // RP107.1993 — doi/href flip via FIXES to Zoho's 1995 form (with typo note).
  // publicationDate/approvalDate cascade + copyright.year still need filling.
  'SMPTE.RP107.1993': {
    publicationDate: {
      value: '1995-01-01',
      note: `Library cascade: per Zoho, Publication_Date is 1995-01-01 — the doc sat ~2 years between approval (1993-03-05) and publication (1995). The prior 1993-03-05 stored here was actually the approval date — moved to approvalDate.`,
    },
    approvalDate: {
      value: '1993-03-05',
      note: `Per Zoho: approval date is 1993-03-05 (was previously stored as publicationDate by mistake).`,
    },
    'copyright.year': {
      value: '1993',
      note: `Per Zoho: copyright year is 1993, matching the approval/registration year (not the later 1995 publication year).`,
    },
  },
  // ST165.1994 — doi/href flipped via FIXES to the registered (typo) 1999 form.
  // Additional missing fields still get filled from Zoho's record.
  'SMPTE.ST165.1994': {
    approvalDate: {
      value: '1994-01-31',
      note: `Per Zoho's record at the (typo) DOI 10.5594/SMPTE.ST165.1999, Approval_Date is 1994-01-31 — confirming the 1994 version year. Adding to fill the previously-empty field.`,
    },
    'copyright.year': {
      value: '1994',
      note: `Per Zoho's record, copyright year is 1994 — confirming the 1994 version year despite the registrar's 1999-typo DOI. Adding to fill the previously-empty field.`,
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
