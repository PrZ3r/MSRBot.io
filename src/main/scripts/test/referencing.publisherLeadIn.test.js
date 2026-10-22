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
  // batch 12: RSA Laboratories PKCS (registry form RSA.PKCSn.vX.YYYY), NIST SP 500 series,
  // UCS Part 1 1993 and US-ASCII 1968 (refMap)
  ['RSA Laboratories, "PKCS #7: RSA Cryptographic Message Syntax Standard," version 1.5, November 1993.', 'RSA.PKCS7.v1.5.1993'],
  ['RSA Laboratories. PKCS #1 v2.0: RSA Encryption Standard. October 1998.', 'RSA.PKCS1.v2.0.1998'],
  ['PKCS #1: RSA Encryption Standard, RSA Data Security, Inc., 3 June 1991, Version 1.4.', 'RSA.PKCS1.v1.4.1991'],
  ['NIST. Special Publication 500-202: Stable Implementation Agreements for Open Systems Interconnection Protocols. Version 5, Edition 1, Part 12. December 1995.', 'NIST.SP.500-202'],
  ['ISO/IEC, Information Technology - Universal Multiple-Octet Coded Character Set (UCS) - Part 1: Architecture and Basic Multilingual Plane, May 1993, with amendments.', 'ISO.10646-1.1993'],
  ['"USA Standard Code for Information Interchange," X3.4. American National Standards Institute: New York (1968).', 'INCITS.X3.4.1968'],
  // batch 14: ISO "International Standard NNNN", FIPS PUB in parentheses, RFC1502's titles (refMap)
  ['Information processing systems - Open Systems Interconnection, "Specification of Abstract Syntax Notation One (ASN.1)", International Organization for Standardization, International Standard 8824, December 1987.', 'ISO.8824.1987'],
  ['Federal Information Processing Standards Publication (FIPS PUB) 81, DES Modes of Operation, 1980 December 2.', 'NIST.FIPS.81'],
  ['Federal Information Processing Standards Publication (FIPS PUB) 46-1, Data Encryption Standard, Reaffirmed 1988 January 22.', 'NIST.FIPS.46-1'],
  ['Code for the representation of names of languages. 1988 version.', 'ISO.639.1988'],
  // batch 16: Internet-Draft anchors (xml2rfc bibxml includes) and draft names in citations
  ['I-D.ietf-core-coap-tcp-tls', 'IETF.draft-ietf-core-coap-tcp-tls'],
  ['Rescorla, E., "The Datagram Transport Layer Security (DTLS) Protocol Version 1.3", Work in Progress, Internet-Draft, draft-ietf-tls-dtls13-39, 2 November 2020.', 'IETF.draft-ietf-tls-dtls13-39'],
];
let n = 0;
for (const [cite, want] of cases) { assert.strictEqual(parseRefId(cite), want, cite); n++; }
// PKCS only with RSA as publisher: papers about PKCS #1 are not the standard.
assert.strictEqual(parseRefId('J. Manger. A Chosen Ciphertext Attack on RSA Optimal Asymmetric Encryption Padding (OAEP) as Standardized in PKCS #1 v2.0. In J. Kilian, editor, Advances in Cryptology - Crypto 2001.'), null); n++;
// Same UCS title as China's GB 13000.1, which must not map to ISO 10646-1.
assert.strictEqual(parseRefId('"Information Technology: Universal Multiple-Octet Coded Character Set(UCS) Part 1: Architecture and Basic Multilingual Plane", GB13000.1'), null); n++;
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

// Old RFCs spell the series out or use "#": RFC878, RFC675; RFCs below 100 too.
assert.strictEqual(parseRefId('J. Reynolds and J. Postel, "Assigned Numbers", Request For Comments 870, October 1983.'), 'RFC870'); n++;
assert.strictEqual(parseRefId('V. Cerf, "An Assessment of ARPANET Protocols," July l974 [RFC#635, INWG Note # ***].'), 'RFC635'); n++;
assert.strictEqual(parseRefId('Cerf, V., "ASCII format for Network Interchange", STD 80, RFC 20, October 1969.'), 'RFC20'); n++;

// A bit rate is not a year: "2048 kbit/s" (RFC1406).
assert.strictEqual(parseRefId('CCITT Specifications Volume III, Recommendation G.732, Characteristics Of Primary PCM Multiplex Equipment Operating at 2048 kbit/s, July 1988.'), 'T-REC-G.732.1988'); n++;

// A quoted title between an IEEE designator and the date (RFC1209); ISO's stage written out (RFC1547,
// RFC1510); an addendum is not the standard (RFC1189).
assert.strictEqual(parseRefId('Institute of Electrical & Electronic Engineers, Inc. IEEE Standard 802.6, "Distributed Queue Dual Bus (DQDB) Subnetwork of a Metropolitan Area Network (MAN) Standard", December 1990.'), 'IEEE.STD802.6.1990'); n++;
assert.strictEqual(parseRefId('ISO International Standard (IS) 3309, "Data Communications - High-level Data Link Control Procedures - Frame Structure", 1979.'), 'ISO.3309.1979'); n++;
assert.strictEqual(parseRefId('International Organization for Standardization, "ISO Information Processing Systems - Data Communication High-Level Data Link Control Procedure - Frame Structure", IS 3309, October 1984, 3rd Edition.'), 'ISO.3309.1984'); n++;
assert.strictEqual(parseRefId('ISO IS 9595 1989: DAD1: "CMIS Add/Remove Addendum".'), null); n++;

// "International Standard NNNN" with ISO elsewhere in the cite (RFC935); a part after an en dash
// (SMPTE journal); "IEEE Standards 802-1990" (RFC1490); a draft stays unresolved.
assert.strictEqual(parseRefId('International Standard 7809, "Data Communication - High-level data link control procedures - Consolidation of classes of procedures", ISO, 1984.'), 'ISO.7809.1984'); n++;
assert.strictEqual(parseRefId('Information Technology, "Generic Coding of Moving Pictures and Associated Audio Information: Systems," ISO/IEC International Standard 13818\u20131, Second ed., Dec. 2000.'), 'ISO.13818-1.2000'); n++;
assert.strictEqual(parseRefId('IEEE, "IEEE Standard for Local and Metropolitan Area Networks: Overview and architecture", IEEE Standards 802-1990.'), 'IEEE.STD802.1990'); n++;
assert.strictEqual(parseRefId('Draft International Standard 8802.2, "Local Area Network Standards, Logical Link Control", ISO, 1984 (draft).'), null); n++;

// OSF's DCE "Request for Comments" series is not the IETF's (RFC1510; IETF RFC26 was never issued).
assert.strictEqual(parseRefId('Pato, J., "Using Pre-Authentication to Avoid Password Guessing Attacks", Open Software Foundation DCE Request for Comments 26, December 1992.'), null); n++;

// "American National Standards Institute" spelled out with a bare X-series designator (RFC2828).
assert.strictEqual(parseRefId('American National Standards Institute, "Financial Institution Key Management (Wholesale)", X9.17, 4 Apr 1985.'), 'ANSI.X9.17.1985'); n++;
assert.strictEqual(parseRefId('RSA Laboratories, "PKCS #7: Cryptographic Message Syntax Standard", ver. 1.5, RSA Laboratories Technical Note, 1 Nov 1993.'), 'RSA.PKCS7.v1.5.1993'); n++;

// A bare "ITU" lead-in with no "Recommendation" (RFC3108); the year comes after the designator.
assert.strictEqual(parseRefId('ITU Q.931, Digital Subscriber Signaling System No. 1: Network Layer.'), 'T-REC-Q.931'); n++;
assert.strictEqual(parseRefId('ITU Q.1901, Bearer Independent Call Control Protocol.'), 'T-REC-Q.1901'); n++;
assert.strictEqual(parseRefId('ITU E.164 - The International Public Telecommunication Numbering Plan E.164/I.331 (May 1997)'), 'T-REC-E.164.1997'); n++;

// ANSI X-series with no year (RFC1767), a placeholder year (RFC2459), and "International
// Standards … International Standards Organization" (RFC2030).
assert.strictEqual(parseRefId('ANSI X12.6 Applications Control Structures for Electronic Data Interchange, Washington D.C.: DISA'), 'ANSI.X12.6'); n++;
assert.strictEqual(parseRefId('ANSI X9.57-199x, Public Key Cryptography For The Financial Services Industry: Certificate Management, Working Draft, June 1996.'), 'ANSI.X9.57'); n++;
assert.strictEqual(parseRefId('International Standards 8602 - Information Processing Systems - OSI: Connectionless Transport Protocol Specification. International Standards Organization, December 1986.'), 'ISO.8602.1986'); n++;

// ISO/IEC Technical Reports keep TR in the ID (iso.org: "ISO/IEC TR 9577:1990"); a draft doesn't resolve.
assert.strictEqual(parseRefId('ISO/IEC TR 9577:1990(E), "Information technology - Protocol Identification in the network layer", 1990-10-15.'), 'ISO.TR9577.1990'); n++;
assert.strictEqual(parseRefId('ISO/IEC, "Information Technology - OSI Routeing Framework", Technical Report 9575, ISO/IEC JTC 1, Switzerland, 1989.'), 'ISO.TR9575.1989'); n++;
assert.strictEqual(parseRefId('J. Samuelsson, Working Draft ISO/IEC TR 23008-14 Conversion and Coding Practices for HDR/WCG, 2016.'), null); n++;

// Undated IEEE 802 lead-ins (RFC3819) and a two-level designator (RFC4067); a co-designation stays ISO.
assert.strictEqual(parseRefId('IEEE 802.11 Wireless LAN standard. http://standards.ieee.org/'), 'IEEE.STD802.11'); n++;
assert.strictEqual(parseRefId('IEEE 802.1AB, "Station and Media Access Control Connectivity Discovery"'), 'IEEE.STD802.1AB'); n++;
assert.strictEqual(parseRefId('IEEE, "IEEE Standard for information technology - LAN/MAN - Part 15.1: WPANs", IEEE Standard 802.15.1, 2002.'), 'IEEE.STD802.15.1.2002'); n++;
assert.strictEqual(parseRefId('IEEE 802.3/ISO 8802-3 Information processing systems - Local area networks - Part 3'), 'ISO.8802-3'); n++;
// ITU-T spelled out with "X.509(2000)" (RFC4523); a wrapped ISO part number (RFC4510).
assert.strictEqual(parseRefId('International Telecommunication Union - Telecommunication Standardization Sector, "The Directory: Authentication Framework", X.509(2000).'), 'T-REC-X.509.2000'); n++;
assert.strictEqual(parseRefId('X509-4th ITU-T Recommendation X.509 (2000) | ISO/IEC 9594- 8:2001, "The Directory".'), 'ISO.9594-8.2001'); n++;

// Never an ID ending in a hyphen, and "ISO 7-bit" is not ISO 7 (RFC1345, RFC1502).
assert.strictEqual(parseRefId('MPEG-2 Specification: ISO/IEC 13818-Parts 1, 2, 3.'), 'ISO.13818'); n++;
assert.strictEqual(parseRefId('Danish Standard DS 2089, Application of ISO 7-bit coded character set, February 1974.'), null); n++;

// ITU-T lead-in, title, then the number (RFC3672, RFC2128); IEEE catalogue titles (RFC7273).
assert.strictEqual(parseRefId('ITU-T, "The Directory -- Models," X.501, 1993.'), 'T-REC-X.501.1993'); n++;
assert.strictEqual(parseRefId('ITU-T Recommendation "Digital subscriber Signalling System No. 1 (DSS 1) - ISDN user-network interface layer 3 specification for basic call control", Rec. Q.931(I.451), May 1998.'), 'T-REC-Q.931.1998'); n++;
assert.strictEqual(parseRefId('IEEE, "1588-2008 - IEEE Standard for a Precision Clock Synchronization Protocol", July 2008.'), 'IEEE.STD1588.2008'); n++;
assert.strictEqual(parseRefId('IEEE, "802.1AS-2011 - IEEE Standard for Local and Metropolitan Area Networks - Timing", 2011.'), 'IEEE.STD802.1AS.2011'); n++;
assert.strictEqual(parseRefId('IEEE Standards Association, "IEEE 802.1AR Secure Device Identifier", December 2009.'), 'IEEE.STD802.1AR.2009'); n++;

// Batch 11 review: INCITS.NNN:YYYY (RFC3821), FIPS singular (RFC5091), bare SP after NIST (RFC5289),
// a wrapped W3C TR name (RFC5122), an IEEE project number (RFC8422).
assert.strictEqual(parseRefId('Fibre Channel Backbone (FC-BB), ANSI INCITS.342:2001, December 12, 2001.'), 'INCITS.342.2001'); n++;
assert.strictEqual(parseRefId('National Institute of Standards and Technology, "Digital Signature Standard," Federal Information Processing Standard 186-2, August 2002.'), 'NIST.FIPS.186-2'); n++;
assert.strictEqual(parseRefId('National Institute of Standards and Technology, "Recommendation for Block Cipher Modes of Operation", SP 800-38A, December 2001.'), 'NIST.SP.800-38A'); n++;
assert.strictEqual(parseRefId('Raggett, D., "HTML 4.0 Specification", W3C REC REC- html40-19980424, April 1998.'), 'W3C.html40.19980424'); n++;
assert.strictEqual(parseRefId('IEEE, "Standard Specifications for Public Key Cryptography", IEEE Std P1363.'), 'IEEE.STD1363'); n++;

// Relations batch 2: ANSI T1 spelled out (RFC4805), "ISO/IEC Standard N" (RFC7826, J09590 en dash),
// WHATWG living standards by host or name (RFC8089, RFC8187).
assert.strictEqual(parseRefId('American National Standard for Telecommunications -- Carrier-to-Customer Installation - DS1 Metallic Interface, T1.403, February 1989.'), 'ANSI.T1.403.1989'); n++;
assert.strictEqual(parseRefId('American National Standard for Telecommunications -- Digital Hierarchy DS1-- Layer 1 In-Service Digital Transmission Performance Monitoring, T1.231.02, October 2003.'), 'ANSI.T1.231.02.2003'); n++;
assert.strictEqual(parseRefId('ANSI-T1.403 American National Standard for Telecommunications -- Carrier-to-Customer Installation - DS1 Metallic Interface, T1.403, February 1989.'), 'ANSI.T1.403.1989'); n++;
assert.strictEqual(parseRefId('International Organization for Standardization, "Data elements and interchange formats", ISO/IEC Standard 8601, December 2000.'), 'ISO.8601.2000'); n++;
assert.strictEqual(parseRefId('ISO/IEC Standard 13818&#x2013;1, <source>Systems</source>.'), 'ISO.13818-1'); n++;
assert.strictEqual(parseRefId('WHATWG, "URL Living Standard", January 2017, < https://url.spec.whatwg.org/ >.'), 'WHATWG.URL'); n++;
assert.strictEqual(parseRefId('WhatWG, "XMLHttpRequest", < https://xhr.spec.whatwg.org/ >.'), 'WHATWG.XHR'); n++;

// Relations batch 3: PKCS with a date but no version (RFC4387), not a paper about PKCS (RFC3218);
// 3GPP "Technical Specification N" and TR (RFC9599, RFC9522) but not an ETSI-numbered TR;
// "…, ITU G.7713.3, January 2003" (RFC3475); "ANSI/INCITS 357:2002" (RFC4172).
assert.strictEqual(parseRefId('PKCS #11 Cryptographic Token Interface Standard, RSA Laboratories, December 1999.'), 'RSA.PKCS11.v2.10.1999'); n++;
assert.strictEqual(parseRefId('RSA Laboratories, PKCS #11, 2003.'), 'RSA.PKCS11'); n++;
assert.strictEqual(parseRefId('Bleichenbacher, D., B. Kaliski, and J. Staddon, "Recent Results on PKCS #1: RSA Encryption Standard", RSA Laboratories Bulletin 7, 1998.'), null); n++;
assert.strictEqual(parseRefId('3GPP, "UTRAN overall description", Technical Specification 25.401.'), '3GPP.TS-25.401'); n++;
assert.strictEqual(parseRefId('3GPP, "Study on access traffic steering", Release 16, 3GPP TR 23.793, December 2018.'), '3GPP.TR-23.793.201812'); n++;
assert.notStrictEqual(String(parseRefId('ETSI TR 126 928 V16.0.0 (2020-11) - 5G; Extended Reality (XR) in 5G (3GPP TR 26.928 version 16.0.0 Release 16)')).slice(0, 4), '3GPP'); n++;
assert.strictEqual(parseRefId('Distributed Call and Connection Management signalling using GMPLS CR-LDP, ITU G.7713.3, Januray 2003.'), 'T-REC-G.7713.3.2003'); n++;
assert.strictEqual(parseRefId('ANSI/INCITS 357:2002, "Fibre Channel Virtual Interface Architecture Mapping Protocol (FC-VI)", July 2000.'), 'INCITS.357.2002'); n++;

// INCITS by its own number (RFC3980); a placeholder year stays undated (RFC7143); project numbers stay orphans.
assert.strictEqual(parseRefId('INCITS 373-2003, Fibre Channel Framing and Signaling Interface (FC-FS).'), 'INCITS.373.2003'); n++;
assert.strictEqual(parseRefId('INCITS Technical Committee T10, "SCSI Primary Commands - 4", ANSI INCITS 513-201x.'), 'INCITS.513'); n++;
assert.strictEqual(parseRefId('Fibre Channel Protocol - 4 (FCP-4), INCITS Project 1828-D, Technical Committee T10 (www.t10.org).'), null); n++;

// Cited-RFC batch 1: "US FIPS197" (RFC3607), "ANSI Std. X3.139-1987" (RFC2816), "X3.269:1996",
// ANSI T1 by the ANSI token (RFC3946), "FIPS, …, publication 180-1" (RFC4782), IEEE 802 dated by a
// trailing year (RFC5087), "ITU, …, Recommendation, I.255.3" (RFC4190), W3C CR/WD tokens and a
// wrapped date (RFC4661, RFC5022), 3GPP GSM-era numbers (RFC4957); ANSI not read from an ISO cite
// or a quoted title.
assert.strictEqual(parseRefId('"Advanced Encryption Standard", US FIPS197, November, 2001.'), 'NIST.FIPS.197'); n++;
assert.strictEqual(parseRefId('Fiber Distributed Data Interface MAC, ANSI Std. X3.139-1987.'), 'ANSI.X3.139.1987'); n++;
assert.strictEqual(parseRefId('8. [FCP] ANSI NCITS. SCSI-3 Fibre Channel Protocol [ANSI X3.269:1996].'), 'ANSI.X3.269.1996'); n++;
assert.strictEqual(parseRefId('"Synchronous Optical Network (SONET): Basic Description", ANSI T1.105, October 2000.'), 'ANSI.T1.105.2000'); n++;
assert.strictEqual(parseRefId('"Secure Hash Standard", FIPS, U.S. Department of Commerce, Washington, D.C., publication 180-1, April 1995.'), 'NIST.FIPS.180-1'); n++;
assert.strictEqual(parseRefId('IEEE 802.1Q, IEEE Standards for Local and Metropolitan Area Networks -- Virtual Bridged Local Area Networks (2003)'), 'IEEE.STD802.1Q.2003'); n++;
assert.strictEqual(parseRefId('IEEE 802 Liaison letter to Bert Wijnen and Bernard Aboba, July 26, 2004.'), null); n++;
assert.strictEqual(parseRefId('ITU, "Multi-Level Precedence and Preemption Service, ITU, Recommendation, I.255.3, July, 1990.'), 'T-REC-I.255.3.1990'); n++;
assert.strictEqual(parseRefId('Bray, T., "XML 1.0 (Second Edition)", W3C CR CR-xml11-20011006, October 2000.'), 'W3C.xml11.20011006'); n++;
assert.strictEqual(parseRefId('Jacobs, I., "CSS2 Specification", W3C REC REC-CSS2- 19980512, May 1998.'), 'W3C.css2.19980512'); n++;
assert.strictEqual(parseRefId('"GPRS Service description; Stage 2", 3GPP TS 03.60 version 7.9.0 Release 98.'), '3GPP.TS-03.60'); n++;
assert.strictEqual(parseRefId('ISO-C "Programming languages -- C", ISO/IEC 9899:1990, International Organization for Standardization. This is effectively the same as ANSI C standard X3.159-1989.'), 'ISO.9899.1990'); n++;

// Cited-RFC batch 2: IEEE 802 catalogue numbers (RFC4837, RFC5184, RFC5677), ITU-T quoted number
// and "G.G." typo (RFC5757, RFC6004), "NIST SP800- 38B" (RFC6218), "FIP PUBS 188" (RFC6274);
// an "SP800-67" label doesn't override the cite's revision.
assert.strictEqual(parseRefId('IEEE, "Institute of Electrical and Electronic Engineers, 802.1D-2004, IEEE Standard for Local and metropolitan area networks"'), 'IEEE.STD802.1D.2004'); n++;
assert.strictEqual(parseRefId('IEEE, "802.11-2007 IEEE Standard for LAN/MAN - Specific requirements Part 11: Wireless LAN"'), 'IEEE.STD802.11.2007'); n++;
assert.strictEqual(parseRefId('"IEEE Standard for Local and Metropolitan Area Networks - Part 21: Media Independent Handover Services", IEEE LAN/MAN Std 802.21-2008, January 2009, http://www.ieee802.org/21/private/Published%20Spec/ 802.21-2008.pdf'), 'IEEE.STD802.21.2008'); n++;
assert.strictEqual(parseRefId('ITU-T Recommendation, "G.114 - One-way transmission time", Telecommunication Union Standardization Sector, 05/2003.'), 'T-REC-G.114.2003'); n++;
assert.strictEqual(parseRefId('ITU-T G.G.8011.1/Y.1307.1, "Ethernet private line service", August 2004.'), 'T-REC-G.8011.1'); n++;
assert.strictEqual(parseRefId('Dworkin, M., "The CMAC Mode for Authentication", NIST SP800- 38B, May 2005.'), 'NIST.SP.800-38B'); n++;
assert.strictEqual(parseRefId('FIPS, "Standard Security Label for Information Transfer", Federal Information Processing Standards Publication. FIP PUBS 188, 1994.'), 'NIST.FIPS.188'); n++;

// Cited-RFC batch 3: IEEE 802 designator after the title (RFC6325), not a revision draft; IEEE 754 with
// a quoted title (RFC6397); LAN/MAN Standard with a comma date (RFC4831); ITU designator leading
// (RFC4326, RFC4847); ETSI/ATSC designator leading (RFC4259); "3GPP TS33.402" (RFC5836).
assert.strictEqual(parseRefId('"IEEE Standard for Local and metropolitan area networks / Media Access Control (MAC) Bridges", 802.1D-2004, 9 June 2004.'), 'IEEE.STD802.1D.2004'); n++;
assert.strictEqual(parseRefId('"IEEE Standard for Local and metropolitan area networks / Port Based Network Access Control", 802.1X-REV Draft 2.9, 3 September 2008.'), null); n++;
assert.strictEqual(parseRefId('IEEE 754, "IEEE Standard for Floating-Point Arithmetic", August 2008.'), 'IEEE.STD754.2008'); n++;
assert.strictEqual(parseRefId('IEEE, "Port-based Access Control", IEEE LAN/MAN Standard 802.1x, June, 2001.'), 'IEEE.STD802.1X.2001'); n++;
assert.strictEqual(parseRefId('I.363.5, "B-ISDN ATM Adaptation Layer specification: Type 5 AAL", International Telecommunication Union, (ITU-T), 1996.'), 'T-REC-I.363.5.1996'); n++;
assert.strictEqual(parseRefId('Y.1312 - Layer 1 Virtual Private Network Generic requirements and architecture elements, ITU-T Recommendation, September 2003.'), 'T-REC-Y.1312.2003'); n++;
assert.strictEqual(parseRefId('TR 101 162, "Digital Video Broadcasting (DVB); Allocation of Service Information (SI) codes for DVB systems", European Telecommunications Standards Institute (ETSI).'), 'ETSI.TR-101-162'); n++;
assert.strictEqual(parseRefId('A/54A, "Guide to the use of the ATSC Digital Television Standard", Advanced Television Systems Committee (ATSC), Doc. A/54A, 4 December 2003.'), 'ATSC.A54A.2003'); n++;
assert.strictEqual(parseRefId('3GPP, "Security aspects of non-3GPP accesses (Release 8)", 3GPP TS33.402 V8.3.1, 2009.'), '3GPP.TS-33.402.2009'); n++;

// Weekly run 2026-10-20: SECG as publisher (RFC7401), NIST Interagency Report (RFC7970),
// "ANSI/INCITS, 350-2003" (RFC8881), "TS.29.281" (RFC9301).
assert.strictEqual(parseRefId('SECG, "Recommended Elliptic Curve Domain Parameters", SEC 2 Version 2.0, January 2010.'), 'SECG.SEC2.v2.2010-01'); n++;
assert.strictEqual(parseRefId('Cheikes, B., "Common Platform Enumeration: Naming Specification Version 2.3", NIST Interagency Report 7695, August 2011.'), 'NIST.IR.7695'); n++;
assert.strictEqual(parseRefId('Snively, R., "Fibre Channel Protocol for SCSI, 2nd Version (FCP-2)", ANSI/INCITS, 350-2003, October 2003.'), 'INCITS.350.2003'); n++;
assert.strictEqual(parseRefId('3GPP, "GPRS Tunnelling Protocol User Plane (GTPv1-U)", TS.29.281, June 2022.'), '3GPP.TS-29.281.202206'); n++;

// Cited-RFC batch 4: IEEE designator closing the cite (RFC8520, RFC8180), "Std. 802.1AX-2008" (RFC7209),
// designator inside the quoted title (RFC4968), "1588-2008 IEEE Standard" (RFC6669), ITU spelled with the
// designator opening the title (RFC6632), 'ISO/IEC, "Standard 13818-1' (RFC6776), ANSI/ASHRAE Standard;
// an ASHRAE addenda package stays an orphan.
assert.strictEqual(parseRefId('IEEE, "IEEE Standard for Local and Metropolitan Area Networks-- Station and Media Access Control Connectivity Discovery", IEEE 802.1AB.'), 'IEEE.STD802.1AB'); n++;
assert.strictEqual(parseRefId('IEEE, "IEEE Standard for Low-Rate Wireless Networks", IEEE 802.15.4, &lt; http://ieeexplore.ieee.org/document/7460875/ &gt;.'), 'IEEE.STD802.15.4'); n++;
assert.strictEqual(parseRefId('IEEE, "IEEE Standard for Local and metropolitan area networks - Link Aggregation", Std. 802.1AX-2008, IEEE Computer Society, November 2008.'), 'IEEE.STD802.1AX.2008'); n++;
assert.strictEqual(parseRefId('"IEEE, Virtual Bridged Local Area Networks, IEEE 802.1Q", May 2003.'), 'IEEE.STD802.1Q.2003'); n++;
assert.strictEqual(parseRefId('IEEE, "1588-2008 IEEE Standard for a Precision Clock Synchronization Protocol for Networked Measurement and Control Systems", March 2008.'), 'IEEE.STD1588.2008'); n++;
assert.strictEqual(parseRefId('International Telecommunication Union, "X.700: Management Framework For Open Systems Interconnection (OSI) For CCITT Applications", September 1992.'), 'T-REC-X.700.1992'); n++;
assert.strictEqual(parseRefId('ISO/IEC, "Standard 13818-1, Information technology -- Generic coding of moving pictures and associated audio information: Systems", October 2007.'), 'ISO.13818-1'); n++;
assert.strictEqual(parseRefId('ASHRAE, "BACnet-A Data Communication Protocol for Building Automation and Control Networks", ANSI/ASHRAE Standard 135-2016, January 2016.'), 'ASHRAE.135.2016'); n++;
assert.strictEqual(parseRefId('ANSI/ASHRAE, "Addenda: BACnet", ANSI/ASHRAE Addenda an, at, au to ANSI/ASHRAE Standard 135-2012, July 2014.'), null); n++;

// Cited-RFC batch 5: wrapped W3C date with a hyphenated short name (RFC5105), "Recommedation" typo
// (RFC5431), 3GPP "Specification 24.182" (RFC8859).
assert.strictEqual(parseRefId('Eastlake, D., "Exclusive XML Canonicalization Version 1.0", W3C REC REC-xml-exc-c14n- 20020718, July 2002.'), 'W3C.xml-exc-c14n.20020718'); n++;
assert.strictEqual(parseRefId('ITU-T Recommedation Y.2111, "Resource and admission control functions in Next Generation Networks", September 2006.'), 'T-REC-Y.2111.2006'); n++;
assert.strictEqual(parseRefId('3GPP, "IP Multimedia Subsystem (IMS) Customized Ringing Signal (CRS); Protocol specification", Specification 24.183, September 2016.'), '3GPP.TS-24.183.201609'); n++;

// DOI case: one spelling per document. IEEE suffixes uppercase, Springer BF/BFb, NIST series and part
// letter uppercase with pt/r/upd lowercase. SMPTE DOIs keep their case (J and j are different documents).
assert.strictEqual(parseRefId('Diffie, W. and M. Hellman, "New directions in cryptography", DOI 10.1109/tit.1976.1055638, November 1976.'), '10.1109-TIT.1976.1055638'); n++;
assert.strictEqual(parseRefId('Lamport, L., "x", DOI 10.1007/bfb0055716.'), '10.1007-BFb0055716'); n++;
assert.strictEqual(parseRefId('NIST, "Advanced encryption standard (AES)"', 'https://doi.org/10.6028/nist.fips.197'), 'NIST.FIPS.197'); n++;
assert.strictEqual(parseRefId('NIST, "AES"', 'https://doi.org/10.6028/NIST.FIPS.197-upd1'), 'NIST.FIPS.197-upd1'); n++;
assert.strictEqual(parseRefId('Barker, E., "Recommendation for pair-wise key-establishment"', 'https://doi.org/10.6028/nist.sp.800-56ar3'), 'NIST.SP.800-56Ar3'); n++;
assert.strictEqual(parseRefId('Barker, E. and NIST, "Recommendation for key management:part 1 - general", NIST Special Publication 800-57pt1r5'), 'NIST.SP.800-57pt1r5'); n++;
assert.strictEqual(parseRefId('X, 10.5594/smpte.st2067-21.2023'), '10.5594-smpte.st2067-21.2023'); n++;

// Weekly cited run (#2708): ETSI Group Specifications, IEC TR, ITU "Recomendation"/"Series H H.239"/
// 'ITU-T, "G.8013: …"', a 3GPP DynaReport link, "1588-2008 Standard" without IEEE, and an IEEE closing
// designator dated by its linked page. ITU/IEEE standard pages only fill cites no text rule reads, and an
// "Accessed:" date is never the edition.
assert.strictEqual(parseRefId('ETSI NFV ISG, "Network Functions Virtualisation (NFV); Terminology for Main Concepts in NFV", ETSI GS NFV 003 V1.2.1 NFV 003, December 2014.'), 'ETSI.GS-NFV-003.2014'); n++;
assert.strictEqual(parseRefId('ETSI NFV ISG, "…; Report on SDN Usage in NFV Architectural Framework", ETSI GS NFV-EVE 005 V1.1.1 NFV-EVE 005, December 2015.'), 'ETSI.GS-NFV-EVE-005.2015'); n++;
assert.strictEqual(parseRefId('International Electrotechnical Commission, "Communication networks and systems for power utility automation - Part 90-12: Wide area network engineering guidelines", IEC TR 61850-90-12, July 2015.'), 'IEC.TR61850-90-12'); n++;
assert.strictEqual(parseRefId('J. Samuelsson, Working Draft ISO/IEC TR 23008-14 Conversion and Coding Practices for HDR/WCG Video, 2016.'), null); n++;
assert.strictEqual(parseRefId('ITU-T, "Time and phase synchronization aspects of packet networks", ITU-T Recomendation G.8271/Y.1366, July 2016.'), 'T-REC-G.8271.2016'); n++;
assert.strictEqual(parseRefId('ITU-T, "Infrastructure of audiovisual services - Systems aspects; Role management and additional media channels for H.300-series terminals", Series H H.239, July 2003.'), 'T-REC-H.239.2003'); n++;
assert.strictEqual(parseRefId('ITU-T, "G.8013: Operations, administration and maintenance (OAM) functions and mechanisms for Ethernet-based networks", August 2015.'), 'T-REC-G.8013.2015'); n++;
assert.strictEqual(parseRefId('3GPP, "Technical Specification Group Core Network and Terminals; Mobile radio interface Layer 3 specification; Core network protocols; Stage 3 (Release 18)", version 18.4.0, September 2023, <https://www.3gpp.org/DynaReport/24008.htm>.', 'https://www.3gpp.org/DynaReport/24008.htm'), '3GPP.TS-24.008.202309'); n++;
assert.strictEqual(parseRefId('IEEE, "1588-2008 Standard for a Precision Clock Synchronization Protocol for Networked Measurement and Control Systems", March 2008.'), 'IEEE.STD1588.2008'); n++;
assert.strictEqual(parseRefId('IEEE, "IEEE Standard for a Transport Protocol for Time-Sensitive Applications in Bridged Local Area Networks", IEEE Standard 1722, &lt; https://standards.ieee.org/findstds/ standard/1722-2016.html &gt;.', 'https://standards.ieee.org/findstds/standard/1722-2016.html'), 'IEEE.STD1722.2016'); n++;
assert.strictEqual(parseRefId('IEEE, "IEEE Standard for Local and Metropolitan Area Networks--Bridges and Bridged Networks", <https://standards.ieee.org/standard/802_1Q-2018.html>.', 'https://standards.ieee.org/standard/802_1Q-2018.html'), 'IEEE.STD802.1Q.2018'); n++;
assert.strictEqual(parseRefId('IEEE, "IEEE Standard for Local and Metropolitan Area Networks - Secure Device Identity", August 2018, <https://standards.ieee.org/ieee/802.1AR/6995/>.', 'https://standards.ieee.org/ieee/802.1AR/6995/'), 'IEEE.STD802.1AR.2018'); n++;
assert.strictEqual(parseRefId('International Telecommunications Union, "Advanced video coding for generic audiovisual services", January 2012, &lt; http://www.itu.int/rec/T-REC-H.264 &gt;.', 'http://www.itu.int/rec/T-REC-H.264'), 'T-REC-H.264.2012'); n++;
assert.strictEqual(parseRefId('"H.264/AVC: Advanced Video Coding for Generic Audiovisual Services." Accessed: Nov. 19, 2022. [Online]. Available: https://www.itu.int/rec/T-REC-H.264', 'https://www.itu.int/rec/T-REC-H.264'), 'T-REC-H.264'); n++;
assert.strictEqual(parseRefId('ITU, "V.42bis: Data compression procedures", http://www.itu.int/rec/T-REC-V.42bis , January 1990.', 'http://www.itu.int/rec/T-REC-V.42bis'), null); n++;
assert.strictEqual(parseRefId('180-1, FIPS., "Secure Hash Standard", April 2005.'), 'NIST.FIPS.180-1'); n++;
assert.strictEqual(parseRefId('IEEE1722 IEEE, "1722-2001 - IEEE Standard for Layer 2 Transport Protocol for Time Sensitive Applications in a Bridged Local Area Network", May 2011, &lt; http://standards.ieee.org/findstds/ standard/1722-2011.html &gt;.', 'http://standards.ieee.org/findstds/standard/1722-2011.html'), 'IEEE.STD1722.2001'); n++;

// Cited run batch 7: ETSI leading with the TS number after the title (RFC4598).
assert.strictEqual(parseRefId('ETSI, "Digital Audio Compression (AC-3, Enhanced AC-3) Standard", TS 102 366, February 2005.'), 'ETSI.TS-102-366.2005'); n++;

// Cited run batch 8: ETSI Group Report (RFC8192); ISO's publicly available standard file name (RFC7927).
assert.strictEqual(parseRefId('ETSI, "Network Functions Virtualization (NFV); Use Cases", ETSI GR NFV 001 V1.2.1, May 2017.'), 'ETSI.GR-NFV-001.2017'); n++;
assert.strictEqual(parseRefId('ISO, "Information Processing Systems -- Open Systems Interconnection -- Basic Reference Model -- Part 4: Management Framework", November 1989, &lt; http://standards.iso.org/ittf/PubliclyAvailableStandards/ s014258_ISO_IEC_7498-4_1989(E).zip&gt;.', 'http://standards.iso.org/ittf/PubliclyAvailableStandards/'), 'ISO.7498-4.1989'); n++;

console.log(`referencing.publisherLeadIn.test.js — ${n} cases passed`);
