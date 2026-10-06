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

/*
 * scanRevisionOf.test.js — the front-page "Revision of" parser (offline; no PDF fetch).
 *
 * Lines are as extracted from real pub.smpte.org PDFs.
 *
 *   node src/main/scripts/test/scanRevisionOf.test.js
 */

const assert = require('assert');
const path = require('path');
const { findRevision } = require(path.join(__dirname, '..', 'extras', 'scanRevisionOf.js'));

const page = (...lines) => [lines.join('\n')];
const cases = [
  // ST 259:2008: designator on the next line
  [page('Page 1 of 18 pages', 'SMPTE 259M-2008', 'Revision of', 'SMPTE 259M-2006 SMPTE STANDARD'), 'SMPTE.ST259.2008', 'SMPTE.ST259.2006'],
  // RP 87:1999: no "SMPTE", run-on into the doc's own designator
  [page('Revision of RP 87-1995 RP 87-1999 SMPTE RECOMMENDED PRACTICE'), 'SMPTE.RP87.1999', 'SMPTE.RP87.1995'],
  // RP 210:2007: dotted revision of RP 210
  [page('Revision of RP 210.8-2004 Copyright © 2007 by THE SOCIETY OF MOTION PICTURE'), 'SMPTE.RP210.2007', 'SMPTE.RP210.2004'],
  // ST 12-2:2008: a different document (RP 188) is the predecessor
  [page('Revision of RP 188-1999 SMPTE STANDARD for Television —'), 'SMPTE.ST12-2.2008', 'SMPTE.RP188.1999'],
  // ST 17:1998: ANSI co-designation
  [page('Revision of ANSI/SMPTE 17M-1992 SMPTE 17M-1998'), 'SMPTE.ST17.1998', 'SMPTE.ST17.1992'],
  // ST 247:2003: the PDF text layer dropped the number; fall back to the doc's own
  [page('Revision of ANSI/SMPTE 1993 Copyright © 2003 by THE SOCIETY OF'), 'SMPTE.ST247.2003', 'SMPTE.ST247.1993'],
  // ST 428-3:2006: "AES3-1992" in running text is not SMPTE 3
  [page('revision of AES3-1992) 3 Definition of terms Left: A loudspeaker position'), 'SMPTE.ST428-3.2006', null],
  // RDD 44:2017: only its own designator follows the phrase
  [page('Revision of', 'SMPTE RDD 44:2017 SMPTE REGISTERED DISCLOSURE DOCUMENT'), 'SMPTE.RDD44.2017', null],
  // EG 1:1990: an ECR predecessor (not SMPTE ST 1)
  [page('Revision of ECR 1-1978 EG 1-1990 SMPTE ENGINEERING GUIDELINE'), 'SMPTE.EG1.1990', 'SMPTE.ECR1.1978'],
  // ST 97:2004: text layer mangled "ANSI/SMPTE" into "ANSMPTE"
  [page('Revision of ANSMPTE 97-1999 Copyright © 2004 by THE SOCIETY OF'), 'SMPTE.ST97.2004', 'SMPTE.ST97.1999'],
  // An unknown prefix before a bare number is not a SMPTE standard
  [page('Revision of XYZ 4-1980 SMPTE STANDARD'), 'SMPTE.ST9.1990', null],
  // A table-of-contents entry is not the revision line
  [page('Revision Notes ............................ 12', 'no predecessor here'), 'SMPTE.ST1.2000', null],
];

// ST 12-1:2008 names three predecessors
{
  const hit = findRevision(page('Revision of SMPTE 12M-1999, RP 159-1995 and RP 164-1996SMPTE STANDARD'), 'SMPTE.ST12-1.2008');
  assert.deepStrictEqual(hit.predecessors, ['SMPTE.ST12.1999', 'SMPTE.RP159.1995', 'SMPTE.RP164.1996']);
}

let failed = 0;
for (const [pages, self, want] of cases) {
  const hit = findRevision(pages, self);
  const got = hit ? hit.predecessor : null;
  try { assert.strictEqual(got, want); } catch {
    failed++;
    console.error(`✗ ${self}: got ${got}, want ${want}`);
  }
}
if (failed) { console.error(`scanRevisionOf: ${failed}/${cases.length} failed`); process.exit(1); }
console.log(`scanRevisionOf: ${cases.length} cases passed`);
