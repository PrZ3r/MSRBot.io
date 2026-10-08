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
 * referencing.publisherLeadIn.test.js — designators behind a publisher lead-in parse.
 *
 * SMPTE's journal (FTXML ref lists) cites standards publisher-first: "SMPTE, ST
 * 2084:2014, “…”", "International Organization for Standardization/…
 * (ISO/IEC) 23009-1:2019", "… (ITU-R), Recommendation BT.709-6". parseRefId
 * returned null for all of them; normalizePublisherLeadIn reduces the lead-in to
 * the bare designator. Author-date and digit-bearing lead-ins must NOT change.
 *
 *   node src/main/scripts/test/referencing.publisherLeadIn.test.js
 */

const assert = require('assert');
const { parseRefId, normalizePublisherLeadIn, parseCiteDesignator, tidyCiteText, citeHref } = require('../../lib/referencing');

const cases = [
  ['SMPTE, ST 2084:2014', 'SMPTE.ST2084.2014'],
  ['SMPTE, EG 432-1: 2010', 'SMPTE.EG432-1.2010'],
  ['SMPTE, ST 2019-1: 2016', 'SMPTE.ST2019-1.2016'],
  ['SMPTE, RDD 36: 2015', 'SMPTE.RDD36.2015'],
  ['International Telecommunication Union-Radiocommunication (ITU-R), Recommendation BT.709-6', 'R-REC-BT.709-6'],
  ['International Organization for Standardization/International Electrotechnical Commission (ISO/IEC) 23009-1:2019', 'ISO.23009-1.2019'],
  ['European Telecommunication Standards Institute (ETSI) TS 103285 - V1.3.1', 'ETSI.TS-103285'],
  ['Consumer Technology Association (CTA), CTA-871.3', 'CTA.871.3'],
  ['SMPTE, ST-2022–6:2012, ', 'SMPTE.ST2022-6.2012'],
  ['SMPTE ST, 2059–1:2021 (Revision of SMPTE ST 2059–1:2015) ', 'SMPTE.ST2059-1.2021'],
  ['International Telecommunication Union-Radiocommunication (ITU-R), Recommendation BT.2100–2, ', 'R-REC-BT.2100-2'],
  ['International Telecommunication Union-Telecommunication (ITU-T), H.265 IISO/IEC 23008–2: Information technology', 'ISO.23008-2'],
  // Dash-spaced long name (PDF text): "Union – Radiocommunication"
  ['International Telecommunications Union – Radiocommunication (ITU-R), Recommendation BT.709-6, ', 'R-REC-BT.709-6'],
  ['International Telecommunication Union - Radiocommunication (ITU-R), Recommendation BT.2100-2, ', 'R-REC-BT.2100-2'],
  // Spelled-out SMPTE document type
  ['SMPTE Recommended Practice 168, ', 'SMPTE.RP168'],
  ['SMPTE Standard 2084:2014, ', 'SMPTE.ST2084.2014'],
  ['EBU Technical Document 3344, 2011', 'EBU.Tech3344.2011'],
  // ITU-T keeps "Recommendation" so the cited edition year survives (RFC9231)
  ['ITU-T, "Information technology - Procedures for the operation of object identifier registration authorities", ITU-T Recommendation X.660, July 2011, <https://www.itu.int/rec/T-REC-X.660>.', 'T-REC-X.660.2011'],
  ['ITU-T, "Information technology - Abstract Syntax Notation One (ASN.1): Specification of basic notation", ITU-T Recommendation X.680, February 2021, <https://www.itu.int/rec/T-REC-X.680>.', 'T-REC-X.680.2021'],
  // NIST SP revision stays lowercase, as NIST writes it (RFC8446 cites the DOI in text)
  ['Barker, E., "Recommendation for Pair-Wise Key Establishment Schemes Using Discrete Logarithm Cryptography", National Institute of Standards and Technology, DOI 10.6028/NIST.SP.800-56Ar3, April 2018.', 'NIST.SP.800-56Ar3'],
  ['NIST SP 800-52 Rev. 2', 'NIST.SP.800-52r2'],
  // xml2rfc's printed forms in RFC reference lists
  ['International Organization for Standardization, "Information Technology - Universal Multiple-Octet Coded Character Set (UCS)", ISO Standard 10646:2014, 2014.', 'ISO.10646.2014'],
  ['International Organization for Standardization, "Information and documentation - Digital object identifier system", ISO Standard 26324, 2012.', 'ISO.26324.2012'],
  ['American National Standards Institute, "American National Standard for Information Systems-Data Link Encryption", ANSI X3.106, 1983.', 'ANSI.X3.106.1983'],
  ['IEEE 802, "IEEE Standard for Local and Metropolitan Area Networks: Overview and Architecture", IEEE 802 Std 802(TM)-2014, 2014.', 'IEEE.STD802.2014'],
  ['IEEE, "IEEE Trial-Use Recommended Practice for Multi- Vendor Access Point Interoperability", IEEE 802 Std 802.11F(TM)-2003, 2003.', 'IEEE.STD802.11F.2003'],
  ['IEEE and The Open Group, "Portable Operating System Interface (POSIX)", The Open Group Base Specifications Issue 7, IEEE 1003.1, 2013 Edition.', 'IEEE.STD1003.1.2013'],
  ['IEEE, "IEEE Standard for Floating-Point Arithmetic", IEEE 754.', 'IEEE.STD754'],
];
let n = 0;
for (const [cite, want] of cases) { assert.strictEqual(parseRefId(cite), want, cite); n++; }

// Left alone: W3C author-date needs its long form; "CEA-608-E (ANSI)" is a designator, not a name.
for (const s of ['World Wide Web Consortium (W3C) (2004, October 28). XML Schema Part 1: Structures', 'CEA-608-E (ANSI) (2008)', 'SMPTE ST 2110-20:2017']) {
  assert.strictEqual(normalizePublisherLeadIn(s), s, s); n++;
}

// parseCiteDesignator reads only the head before the title — a title mention never links.
assert.strictEqual(parseCiteDesignator('SMPTE, ST 2084:2014, “High Dynamic Range EOTF.”'), 'SMPTE.ST2084.2014'); n++;
assert.strictEqual(parseCiteDesignator('J. Doe, “Is SMPTE ST 2110 the future of your facility?” 2019.'), null); n++;
assert.strictEqual(parseCiteDesignator('Professional Media Over Managed IP Networks, ST ST 2110–20, 2022. doi: 10.5594/SMPTE.ST2110-20.2022'), 'SMPTE.ST2110-20.2022'); n++;
assert.strictEqual(parseCiteDesignator('Joint Video Experts Team (JVET) of ITU-T SG 16 WP 3 and ISO/IEC JTC 1/SC 29, '), null, 'study group'); n++;
// Author-first: the designator after the title resolves; venues and drafts don't.
assert.strictEqual(parseCiteDesignator('R. Pantos and W. May, “HTTP Live Streaming,” IETF RFC 8216, 2017.'), 'RFC8216'); n++;
assert.strictEqual(parseCiteDesignator('J. Lapierre, “X,” presented at the SMPTE 2018 Annual Technical Conference & Exhibition, Oct. 2018.'), null, 'conference'); n++;
assert.strictEqual(parseCiteDesignator('G. Bjontegaard, “Calculation of average PSNR,” ITU-T Q.6/SG16 VCEG 13th Meeting, 2001.'), null, 'meeting'); n++;
assert.strictEqual(parseCiteDesignator('R. Pantos, “HLS 2nd ed.,” IETF Draft, 2023. draft-pantos-hls-rfc8216bis-14.'), null, 'draft'); n++;
assert.strictEqual(parseCiteDesignator('Consumer Technology Association (CTA), 2021.'), null, 'year as number'); n++;

// tidyCiteText: label dropped, tags joined without spaces, punctuation tidied.
const raw = '<ref id="ref1"><label>1.</label> <mixed-citation><string-name>R. Xu</string-name>, &#x201C;<article-title>Survey</article-title>,&#x201D; <source>IEEE Trans.</source>, <volume>16</volume> (<issue>3</issue>): <fpage>645</fpage>&#x2013;<lpage>678</lpage>, 2005.</mixed-citation></ref>';
assert.strictEqual(tidyCiteText(raw), 'R. Xu, “Survey,” IEEE Trans., 16 (3): 645–678, 2005.'); n++;

// citeHref: <uri> text, then DOI → doi.org; trailing punctuation trimmed.
assert.strictEqual(citeHref('<ref><mixed-citation>Available: <uri>https://www.fastcompany.com/90741893/x</uri>.</mixed-citation></ref>'), 'https://www.fastcompany.com/90741893/x'); n++;
assert.strictEqual(citeHref('<ref><mixed-citation><pub-id pub-id-type="doi">10.1017/atsip.2019.23</pub-id></mixed-citation></ref>'), 'https://doi.org/10.1017/atsip.2019.23'); n++;
assert.strictEqual(citeHref('<ref><mixed-citation>R. Xu, “Survey,” 2005.</mixed-citation></ref>'), ''); n++;

console.log(`referencing.publisherLeadIn.test.js — ${n} cases passed`);
