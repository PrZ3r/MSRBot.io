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
  ['U.S. National Institute of Standards and Technology, "SECURE HASH STANDARD", Federal Information Processing Standard (FIPS) 180-2, August 2002.', 'NIST.FIPS.180-2'],
  ['National Institute of Standards and Technology (NIST), FIPS Publication 180-3: Secure Hash Standard, October 2008.', 'NIST.FIPS.180-3'],
  ['"Public Key Cryptography for the Financial Services Industry: The Elliptic Curve Digital Signature Algorithm (ECDSA)", American National Standards Institute (ANSI) X9.62.', 'ANSI.X9.62'],
  ['Institute of Electrical and Electronics Engineers, "Local and Metropolitan Area Networks: Port-Based Network Access Control", IEEE Standard 802.1X-2004, December 2004.', 'IEEE.STD802.1X.2004'],
  ['"Local and Metropolitan Area Networks: Port-Based Network Access Control", IEEE Standard 802.1X, December 2004.', 'IEEE.STD802.1X.2004'],
  ['IEEE, "Wireless LAN Medium Access Control (MAC) and Physical Layer (PHY) Specifications", IEEE Standard 802.11, 2003.', 'IEEE.STD802.11.2003'],
  // batch 8: SCTE, ETSI EN, ANSI designator-first, US-ASCII → INCITS (refMap)
  ['SCTE Data Standards Subcommittee, "Data-Over-Cable Service Interface Specifications: DOCSIS 1.0 Baseline Privacy Interface Specification SCTE 22-2 2002", 2002.', 'SCTE.22-2.2002'],
  ['SCTE Data Standards Subcommittee, "DOCSIS 1.1 Part 3: Operations Support System Interface ANSI/SCTE 23-3 2005", 2005.', 'SCTE.23-3.2005'],
  ['American National Standards Institute/Society of Cable and Telecommunications Engineers (ANSI/SCTE) 67 2010, "Recommended Practice for SCTE 35 Digital Program Insertion Cueing Message for Cable", 2010.', 'SCTE.67.2010'],
  ['Society of Cable Telecommunications Engineers (SCTE), ANSI/SCTE 35 2023r1, "Digital Program Insertion Cueing Message."', 'SCTE.35.2023'],
  ['SCTE 127-2007', 'SCTE.127.2007'],
  ['European Telecommunications Standard Institute, "ETSI Standard EN 300 429, Version 1.2.1: Digital Video Broadcasting (DVB), Framing structure", April 1998.', 'ETSI.EN-300-429.1998'],
  ['EN 300 001 V1.5.1 (1998-10):"European Standard (Telecommunications series) Attachments to Public Switched Telephone Network (PSTN)"', 'ETSI.EN-300-001.1998'],
  ['ANSI X3.106, "American National Standard for Information Systems-Data Link Encryption", American National Standards Institute, 1983.', 'ANSI.X3.106.1983'],
  ['American National Standards Institute, "Coded Character Set - 7-bit American Standard Code for Information Interchange", ANSI X3.4, 1986.', 'INCITS.X3.4.1986'],
  // batch 9: spelled-out FIPS, "(IEEE) Standard", ETS in parentheses, spelled-out 3GPP, SECG
  ['National Institute of Standards and Technology, U.S. Department of Commerce, "Advanced Encryption Standard", Federal Information Processing Standards Publication 197, Washington, DC, November 2001.', 'NIST.FIPS.197'],
  ['Institute for Electrical and Electronics Engineers (IEEE) Standard 1363-2000, Standard Specifications for Public Key Cryptography, January 2000.', 'IEEE.STD1363.2000'],
  ['Institute of Electrical and Electronics Engineers (IEEE) Standard 1588-2019 (Revision of IEEE Standard 1588-2008), "Precision Clock Synchronization Protocol".', 'IEEE.STD1588.2019'],
  ['European Telecommunications Standards Institute, "GSM Technical Specification GSM 03.20 (ETS 300 534): "Digital cellular telecommunication system (Phase 2)", August 1997.', 'ETSI.ETS-300-534.1997'],
  ['3rd Generation Partnership Project, "Security Architecture (Release 4)", TS 33.102, December 2001.', '3GPP.TS-33.102.200112'],
  ['Standards for Efficient Cryptography Group, SEC 1: Elliptic Curve Cryptography, Version 1.0, September 2000. http://www.secg.org', 'SECG.SEC1.v1.2000-09'],
  // batch 10: URL printed in the citation (wrapped across lines), W3C /YYYY/MM/ layout,
  // Unicode TR revision, "IEEE 1363: <title>. <date>", TIFF 6.0 (refMap)
  ['Canonical XML Version 1.0, W3C Working Draft. T. Bray, J. Clark, J. Tauber, and J. Cowan. January 19, 2000. http://www.w3.org/TR/2000/WD-xml-c14n- 20000119.html .', 'W3C.WD-xml-c14n.20000119'],
  ['XML Linking Language. Working Draft. S. DeRose, D. Orchard, B. Trafford. July 1999. http://www.w3.org/1999/07/WD-xlink-19990726', 'W3C.WD-xlink.19990726'],
  ['Extensible Stylesheet Language (XSL) Working Draft. S. Adler, J. Richman, S. Zilles. March 2000. http://www.w3.org/TR/2000/WD-xsl- 20000327/xslspec.html', 'W3C.WD-xsl.20000327'],
  ['TR15, Unicode Normalization Forms. M. Davis, M. Durst. Revision 18: November 1999. http://www.unicode.org/unicode/reports/tr15/ tr15-18.html .', 'UNICODE.STD.TR15-18'],
  ['IEEE 1363: Standard Specifications for Public Key Cryptography. August 2000.', 'IEEE.STD1363.2000'],
  ['Adobe Developers Association, TIFF (TM) Revision 6.0 - Final, June 3, 1992.', 'TIFF.r6.19920603'],
  ['World Wide Web Consortium, "Extensible Markup Language (XML) 1.0", W3C XML, February 1998.', 'W3C.xml.19980210'],
];
let n = 0;
for (const [cite, want] of cases) { assert.strictEqual(parseRefId(cite), want, cite); n++; }
// The first URL printed wins, bare "www." included: VSF TR-11's PDF, not the GitHub repo after it.
assert.strictEqual(parseRefId('VSF TR-11 - Signal Transport and Timing Considerations . www.vsf.tv/download/technicalrecommendations/VSFTR-112024-02-21-draft.pdf https://github.com/vsf-tv/gccg-api .'), null); n++;

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
