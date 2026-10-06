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
 * referencing.smpteOrphans.test.js — parseRefId on SMPTE cites that used to come back null.
 *
 * Cases are verbatim citations from SMPTE ST 2067-21:2026-07, ST 2094-50:2026-08, ST 2053:2011
 * and SMPTE journal articles: CTA designators, ICC specifications, W3C author-date cites,
 * GitHub repository hrefs, refMap entries for software and MovieLabs pages, and the SMPTE
 * misparses from the missing-ref audit (#2242): "336M", suite part 0 as OV, RP 27.N parts.
 * The last block pins forms that must not change.
 *
 *   node src/main/scripts/test/referencing.smpteOrphans.test.js
 */

const assert = require('assert');
const path = require('path');
const { parseRefId } = require(path.join(__dirname, '..', '..', 'lib', 'referencing.js'));

const cases = [
  // CTA
  ['CTA 861-G', '', 'CTA.861-G'],
  ['ANSI/CTA-861-G (2016)', '', 'CTA.861-G.2016'],
  ['[8] ANSI/CTA-608-E S-2019 , “ Line 21 Data Services ,” 2019 .', '', 'CTA.608-ES.2019'],
  ['[43] Consumer Technology Association (CTA) , “ CTA Specification, Web Application Video Ecosystem - Content Specification, CTA-5001-D ,” 2021 .', '', 'CTA.5001-D.2021'],
  ['CTA-2045', '', 'CTA.2045'],
  // ICC
  ['Specification ICC.1:2022', 'https://www.color.org/specification/ICC.1-2022-05.pdf', 'ICC.1.2022'],
  ['ICC specification', 'https://www.color.org/specification/ICC.1-2022-05.pdf', 'ICC.1.2022'],
  // W3C author-date
  ['World Wide Web Consortium (W3C) (2004, October 28). XML Schema Part 1: Structures (Second Edition)', '', 'W3C.xmlschema-1.20041028'],
  ['World Wide Web Consortium (W3C) (2004, October 28). XML Schema Part 2: Datatypes (Second Edition)', '', 'W3C.xmlschema-2.20041028'],
  ['World Wide Web Consortium (W3C) (2004, February 4). Extensible Markup Language (XML) 1.0 (Third Edition)', '', 'W3C.xml.20040204'],
  // GitHub repository href
  ['OpenJPH', 'https://github.com/aous72/OpenJPH', 'GITHUB.aous72.OpenJPH'],
  // refMap
  ['Kakadu', 'https://kakadusoftware.com/documentation-downloads/', 'KAKADUSOFTWARE.COM'],
  ['OpenJPEG', 'https://www.openjpeg.org/', 'OPENJPEG.ORG'],
  ['MovieLabs Best Practice: SDR to HDR Conversion', 'https://www.movielabs.com/ngvideo/MovieLabs_Mapping_BT.709_to_HDR10_v1.0.pdf', 'MOVIELABS.BT709-HDR10.v1.0'],
  // SMPTE misparses from the missing-ref audit (#2242, group C)
  ['SMPTE ST 336M:2007 — Data Coding Protocol Using Key-Length-Value', '', 'SMPTE.ST336.2007'],
  ['SMPTE RP 160M-1991, Three-Channal Parallel Analog Component High-Definition Video Interface.', '', 'SMPTE.RP160.1991'],
  ['SMPTE ST 2081-0:2015 — 6 Gb/s Signal/Data Serial Interface — Roadmap for the SMPTE 2081 Document Suite', '', 'SMPTE.OV2081-0.2015'],
  ['SMPTE 2082-0:2015 — 12G-SDI Bit-Serial Interfaces — Roadmap for the SMPTE 2082 Document Suite', '', 'SMPTE.OV2082-0.2015'],
  ['SMPTE ST 2022-7: 2013 . Seamless Protection Switching of SMPTE ST 2022 IP Datagrams .', '', 'SMPTE.ST2022-7.2013'],
  ['SMPTE 299-2009 — 24-Bit Digital Audio Format for SMPTE 292 Bit-Serial Interface', '', 'SMPTE.ST299-1.2009'],
  ['SMPTE RP 27.3-1989 — Specifications for Safe Action and Safe Title Area Test Pattern for Television Systems', '', 'SMPTE.RP27-3.1989'],
  ['[SMPTE RP 2242] — SMPTE Labels Register', '', 'SMPTE.RP224'],
  // Group D decisions (#2242): bare ANSI/SMPTE numbers are standards; ".N" is a revision
  // for ST 305 and RP 210, a part for ST 363 and RP 27
  ['ANSI/SMPTE 40–1991, Motion-Picture Film (35-mm)-Photographic Audio Records-Release Prints', '', 'SMPTE.ST40.1991'],
  ['ANSI/SMPTE 139–1986 (R1991), Motion-Picture Film (35-mm)-Perforated KS', '', 'SMPTE.ST139.1986'],
  ['SMPTE 305.2M-2000 — Television — Serial Data Transport Interface (SDTI)', '', 'SMPTE.ST305.2000'],
  ['SMPTE 305.2M-2002 — Television — Serial Data Transport Interface (SDTI)', '', 'SMPTE.ST305.2002'],
  ['SMPTE 3052M-2000, Television — Serial Data Transport Interface (SDTI)', '', 'SMPTE.ST305.2000'],
  ['SMPTE 210.4-2002 — Metadata Dictionary Registry of Metadata Element Descriptions', '', 'SMPTE.RP210.2002'],
  ['SMPTE RP 210.1–2001 — Metadata Dictionary', '', 'SMPTE.RP210.2001'],
  ['SMPTE ST 363.2-2002 — Television — Declarative Data Essence, Content Level 1 [Appendix D for JFIF]', '', 'SMPTE.ST363-2.2002'],
  // En dash before the year; leading zeros (but AG ids are zero-padded)
  ['2. SMPTE 292M– 1998 , “Bit-Serial Digital Interface for High-Definition Television”', '', 'SMPTE.ST292.1998'],
  ['10) SMPTE 0352–2010, “Video Payload Identification Codes for Serial Digital Interfaces”', '', 'SMPTE.ST352.2010'],
  ['12. SMPTE RDD 09-2009 MXF Interoperability Specification of Sony MPEG Long GOP Products', '', 'SMPTE.RDD9.2009'],
  // ST 291-1:2011 revises "ST 291:2010"; a cite of "ST 291-1:2010" means that document
  ['SMPTE ST 291-1:2010 — Ancillary Data Packet and Space Formatting', '', 'SMPTE.ST291.2010'],
  ['SMPTE ST 291-1:2011 — Ancillary Data Packet and Space Formatting', '', 'SMPTE.ST291-1.2011'],
  // ECR: Engineering Committee Recommendation (predecessor of EGs)
  ['SMPTE ECR 1-1978', '', 'SMPTE.ECR1.1978'],
  // Must not change
  ['SMPTE AG-02', 'https://doc.smpte-doc.org/ag-02/main/', 'SMPTE.AG02'],
  ['ANSI/SCTE 127 2007', '', 'SCTE.127.2007'],
  ['SMPTE ST 2067-21:2026-07', '', 'SMPTE.ST2067-21.2026-07'],
  ['ANSI/SMPTE 259M-1997', '', 'SMPTE.ST259.1997'],
  ['CEA-608-E (ANSI) (2008)', '', 'CEA.608.2008'],
  ['World Wide Web Consortium (W3C) (2010, May 1). Some Unknown Note', '', null],
  ['See the repository', 'https://github.com/SMPTE/st2067-21/blob/main/schema.xsd', null],
];

let failed = 0;
for (const [cite, href, want] of cases) {
  const got = parseRefId(cite, href);
  try {
    assert.strictEqual(got, want);
  } catch {
    failed++;
    console.error(`✗ ${JSON.stringify(cite)} → ${got} (want ${want})`);
  }
}
if (failed) {
  console.error(`referencing.smpteOrphans: ${failed}/${cases.length} failed`);
  process.exit(1);
}
console.log(`referencing.smpteOrphans: ${cases.length} cases passed`);
