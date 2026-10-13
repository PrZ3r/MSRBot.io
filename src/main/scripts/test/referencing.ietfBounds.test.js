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
 * referencing.ietfBounds.test.js — the classic RFC HTML fallback stops a references
 * block at the next heading outside its own section (offline; synthetic page in
 * rfc-editor.org's htmlized markup, modelled on RFC8446).
 *
 *   node src/main/scripts/test/referencing.ietfBounds.test.js
 */

const assert = require('assert');
const path = require('path');
const cheerio = require('cheerio');
const { extractRefs } = require(path.join(__dirname, '..', '..', 'lib', 'referencing.js'));

const html = `<html><body><pre>
<span class="h2"><a class="selflink" id="section-12" href="#section-12">12</a>.  References</span>

<span class="h3"><a class="selflink" id="section-12.1" href="#section-12.1">12.1</a>.  Normative References</span>

   [<a id="ref-RFC2119">RFC2119</a>]  Bradner, S., "Key words for use in RFCs to Indicate
              Requirement Levels", BCP 14, RFC 2119, March 1997.

<span class="h3"><a class="selflink" id="section-12.2" href="#section-12.2">12.2</a>.  Informative References</span>

   [<a id="ref-RFC5246">RFC5246</a>]  Dierks, T. and E. Rescorla, "The Transport Layer Security
              (TLS) Protocol Version 1.2", RFC 5246, August 2008.

<span class="grey">Rescorla                     Standards Track                   [Page 85]</span>
   [Page 85]

Acknowledgments from the First Edition (1998)

   [Holz] Ralph Holz NICTA 13 Garden St. Eveleigh 2015 NSW Australia

<span class="h2"><a class="selflink" id="appendix-A" href="#appendix-A">Appendix A</a>.  State Machine</span>

   [K_send = early data] | | v | / WAIT_SH ----+ | | Recv ServerHello
   [Skip decrypt errors] | +------&gt; WAIT_EOED -+ | | Recv

   1. If maskLen &gt; 2^32 hLen, output "mask too long" and stop.

<span class="h2"><a class="selflink" id="appendix-B" href="#appendix-B">Appendix B</a>.  Acknowledgments</span>

   [Page 85]
</pre></body></html>`;

const $ = cheerio.load(html);
const r = extractRefs($, 'RFC9999', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html });
let n = 0;
assert.deepStrictEqual(r.references.normative, ['RFC2119']); n++;
assert.deepStrictEqual(r.references.bibliographic, ['RFC5246']); n++;
const bad = (r.badRefs || []).map((b) => String(b.refText || b.cite || ''));
assert.ok(!bad.some((t) => /K_send|WAIT_|maskLen|Page 85/.test(t)), `appendix text leaked: ${JSON.stringify(bad)}`); n++;
// Unnumbered sections are unindented text in htmlized RFCs and end the block too.
assert.ok(!bad.some((t) => /Acknowledgments|Ralph Holz/.test(t)), `unnumbered section leaked: ${JSON.stringify(bad)}`); n++;

// Old RFCs (RFC2060) print entries unindented: a wrapped "Work in Progress." line is not a
// heading. A tagged unindented heading (RFC6234) still ends the block.
{
  const html2 = `<html><body><pre>
<span class="h2"><a class="selflink" id="appendix-A" href="#appendix-A">A</a>.      References</span>

[<a id="ref-ACAP">ACAP</a>] Myers, J. "ACAP -- Application Configuration Access Protocol",
Work in Progress.

[<a id="ref-CHARSET">CHARSET</a>] Reynolds, J., and J. Postel, "Assigned Numbers", STD 2,
<a href="./rfc1700">RFC 1700</a>, USC/Information Sciences Institute, October 1994.

Appendix: Changes from <a href="./rfc4634">RFC 4634</a>

   4. Replace MIT version of getopt with new code to satisfy IETF
      incoming and outgoing license restrictions.
</pre></body></html>`;
  const $2 = cheerio.load(html2);
  const r2 = extractRefs($2, 'RFC9998', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html2 });
  const all2 = [...(r2.references.normative || []), ...(r2.references.bibliographic || [])];
  assert.ok(all2.includes('RFC1700'), `entry after a wrapped line lost: ${JSON.stringify(all2)}`); n++;
  const bad2 = (r2.badRefs || []).map((b) => String(b.refText || b.cite || ''));
  assert.ok(!bad2.some((t) => /getopt/.test(t)), `change-log line leaked: ${JSON.stringify(bad2)}`); n++;
}

// Unnumbered, unanchored "Normative References" / "Informative References" headings
// (RFC5246, RFC2898): the block must not end at its own heading (blank lines before it),
// and does end at the next unindented heading ("Contact Information & About PKCS").
{
  const html3 = `<html><body><pre>
<span class="h2"><a class="selflink" id="section-9" href="#section-9">9</a>.  Security Considerations</span>

   Nothing here.


Normative References

   [<a id="ref-RFC2119">RFC2119</a>]  Bradner, S., "Key words for use in RFCs to Indicate
              Requirement Levels", BCP 14, RFC 2119, March 1997.

Informative References

   [<a id="ref-RFC5246">RFC5246</a>]  Dierks, T. and E. Rescorla, "The Transport Layer Security
              (TLS) Protocol Version 1.2", RFC 5246, August 2008.

Contact Information &amp; About PKCS

   The Public-Key Cryptography Standards are specifications produced by
   RSA Laboratories in cooperation with secure systems developers.
</pre></body></html>`;
  const $3 = cheerio.load(html3);
  const r3 = extractRefs($3, 'RFC9997', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html3 });
  assert.deepStrictEqual(r3.references.normative, ['RFC2119']); n++;
  assert.deepStrictEqual(r3.references.bibliographic, ['RFC5246']); n++;
  const bad3 = (r3.badRefs || []).map((b) => String(b.refText || b.cite || ''));
  assert.ok(!bad3.some((t) => /Public-Key Cryptography Standards are/.test(t)), `contact section leaked: ${JSON.stringify(bad3)}`); n++;
}

// A reference entry continues across a page break (RFC1700): the footer "[Page 117]",
// the NewPage divider and the running header are layout, and the continuation is not
// read again as a citation of its own.
{
  const html4 = `<html><body><pre>
REFERENCES

[<a id="ref-BBN1822">BBN1822</a>] BBN, "Specifications for the Interconnection of a Host and



<span class="grey">Reynolds &amp; Postel                                             [Page 117]</span></pre>
<hr class='noprint'/><!--NewPage--><pre class='newpage'><span id="page-118" ></span>
<span class="grey"><a href="./rfc1700">RFC 1700</a>                    Assigned Numbers                October 1994</span>


           an IMP", Report 1822, Bolt Beranek and Newman, Cambridge,
           Massachusetts, revised, December 1981.

[<a id="ref-COHEN">COHEN</a>] Cohen, D., "On Holy Wars and a Plea for Peace", IEEE Computer
           Magazine, October 1981.


PEOPLE
</pre></body></html>`;
  const $4 = cheerio.load(html4);
  const r4 = extractRefs($4, 'RFC9996', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html4 });
  const bad4 = (r4.badRefs || []).map((b) => String(b.refText || b.cite || ''));
  assert.ok(bad4.some((t) => /Host and an IMP", Report 1822/.test(t)), `entry not joined across the page break: ${JSON.stringify(bad4)}`); n++;
  assert.ok(!bad4.some((t) => /^an IMP"/.test(t)), `page-break tail read as its own citation: ${JSON.stringify(bad4)}`); n++;
  assert.ok(!bad4.some((t) => /Page 117|Assigned Numbers\s+October/.test(t)), `page footer/header leaked: ${JSON.stringify(bad4)}`); n++;
}

// RFC1052's 1988 "DRAFT-SMI" letter codes are not Internet-Drafts.
{
  const html5 = `<html><body><pre>
REFERENCES

      (6) Lee LaBarre, "Structure and Identification of Management
      Information for the Internet", DRAFT-SMI, February 1988.

      (7) Postel, J., "Internet Protocol", <a href="./rfc791">RFC 791</a>, September 1981.
</pre></body></html>`;
  const r5 = extractRefs(cheerio.load(html5), 'RFC9995', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html5 });
  const all5 = [...(r5.references.normative || []), ...(r5.references.bibliographic || [])];
  assert.ok(!all5.some((x) => /^IETF\.draft-smi$/i.test(x)), `letter code read as a draft: ${JSON.stringify(all5)}`); n++;
}

// Every line indented, headings included (RFC905): a numbered References heading ends at the
// next numbered heading at its own indent, not at the end of the document.
{
  const html6 = `<html><body><pre>
     2  REFERENCES
   
     ISO 7498  Information   processing   systems   -   Open   systems
               interconnection - Basic Reference Model
   
   
     3  DEFINITIONS
   
     [Figures 3 and 4 are omitted from this copy.] General procedures, 1983,
     "a quoted phrase that looks like a title" applies here.
</pre></body></html>`;
  const r6 = extractRefs(cheerio.load(html6), 'RFC9994', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html6 });
  assert.deepStrictEqual(r6.references.bibliographic, ['ISO.7498']); n++;
  assert.ok(!(r6.badRefs || []).some((b) => /Figures/.test(b.refText)), `body text read as a citation: ${JSON.stringify(r6.badRefs)}`); n++;
}

// Double-spaced pages (RFC878): a wrapped entry stays one entry.
{
  const filler = Array.from({ length: 220 }, (_, i) => `     Body text line ${i}.\n     `).join('\n');
  const html7 = `<html><body><pre>
${filler}
     4  REFERENCES
     
     
     [<a id="ref-1">1</a>]  J. Postel, "Address Mappings",  Request  for  Comments
     
          796, September 1981.
     
     
     
                                APPENDIX A
</pre></body></html>`;
  const r7 = extractRefs(cheerio.load(html7), 'RFC9993', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html7 });
  assert.deepStrictEqual(r7.references.bibliographic, ['RFC796']); n++;
}

// RFC675's numbered list: "3.CESU74" without a space, and a bracket that opens a wrapped line
// ("[RFC#635, …]") is part of the entry above, not a new one.
{
  const html8 = `<html><body><pre>
7.  REFERENCES

   2. CERF74

      V. Cerf, "An Assessment of ARPANET Protocols," in Proceedings of
      the Jerusalem Conference on Information Technology, July l974
      [RFC#635, INWG Note # ***].

   3.CESU74

      V. Cerf and C. Sunshine, "Protocols and Gateways for the
      Interconnection of Packet Switching Networks," January 1974.
</pre></body></html>`;
  const r8 = extractRefs(cheerio.load(html8), 'RFC9992', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html8 });
  assert.deepStrictEqual(r8.references.bibliographic, ['RFC635']); n++;
  const bad8 = (r8.badRefs || []).map((b) => b.refText);
  assert.deepStrictEqual(bad8.length, 1, JSON.stringify(bad8)); n++;
  assert.ok(/^V\. Cerf and C\. Sunshine/.test(bad8[0]), `label left on the citation: ${bad8[0]}`); n++;
}

// A running header split over two lines at a page break ("January 1980" in the grey header,
// the title on the next line, RFC761) is not part of the entry.
{
  const html9 = `<html><body><pre>
References

[<a id="ref-4">4</a>]  Dalal, Y. and C. Sunshine, "Connection Management in Transport
     Protocols," Computer Networks, Vol. 2, No. 6, pp. 454-473,
     December 1978.


<span class="grey">                                                               [Page 83]</span></pre>
<hr class='noprint'/><!--NewPage--><pre class='newpage'><span id="page-84" ></span>
<span class="grey">                                                            January 1980</span>
Transmission Control Protocol


[Page 84]
</pre></body></html>`;
  const r9 = extractRefs(cheerio.load(html9), 'RFC9991', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html9 });
  const bad9 = (r9.badRefs || []).map((b) => b.refText);
  assert.ok(bad9.length === 1 && /December 1978\.$/.test(bad9[0]), `page header in the entry: ${JSON.stringify(bad9)}`); n++;
}

// Annotated list (RFC740): the note under an entry is not part of the citation, and the list
// number goes even when the entry opens with a quote.
{
  const html10 = `<html><body><pre>
                               REFERENCES

   2. "NETRJS Remote Operator Commands", R. T. Braden.  NIC #7182,
   August 9, 1971

      This document together with References 3 and 8 define the remote
      operator (i.e. user) command language for NETRJS.

   5. "Using Network Remote Job Entry", E. F. Harslem.  RFC #307:  NIC
   #9258, February 24, 1972.
</pre></body></html>`;
  const r10 = extractRefs(cheerio.load(html10), 'RFC9990', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html10 });
  assert.deepStrictEqual(r10.references.bibliographic, ['RFC307']); n++;
  assert.deepStrictEqual((r10.badRefs || []).map((b) => b.refText), ['"NETRJS Remote Operator Commands", R. T. Braden. NIC #7182, August 9, 1971']); n++;
}

// The archive transcriber's note after the list is not a citation (RFC635), and NIC documents
// with no year are kept as orphans, without their "1)" (RFC333).
{
  const html11 = `<html><body><pre>
REFERENCES

      1) NIC document 8246, HOST/HOST PROTOCOL FOR THE ARPA NETWORK

      4) a system of interprocess communication in a resource sharing
         computer network, CACM, April, 1972.

       [ This RFC was put into machine readable form for entry ]
       [ into the online RFC archives by Roger D. Moore, with  ]

E] Formulae: On page six I have replaced symbols of the form "B subscript digit"
</pre></body></html>`;
  const r11 = extractRefs(cheerio.load(html11), 'RFC9989', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html11 });
  assert.deepStrictEqual((r11.badRefs || []).map((b) => b.refText), [
    'NIC document 8246, HOST/HOST PROTOCOL FOR THE ARPA NETWORK',
    'a system of interprocess communication in a resource sharing computer network, CACM, April, 1972.',
  ]); n++;
}

// A glossary entry named "References" is not the references section (RFC767's field list).
{
  const html12 = `<html><body><pre>
  Protocol

    The name of the coding scheme used for a medium.

  References

    The message identifiers of other messages.  Represented by a list of
    text elements, e.g. proplist:( name:"TEXT", text:"a quoted body text" )endlist 1980.

                               REFERENCES

[<a id="ref-1">1</a>]   Postel, J., "Internet Message Protocol," <a href="./rfc759">RFC 759</a>, August 1980.
</pre></body></html>`;
  const r12 = extractRefs(cheerio.load(html12), 'RFC9988', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html12 });
  assert.deepStrictEqual(r12.references.bibliographic, ['RFC759']); n++;
  assert.deepStrictEqual(r12.badRefs || [], []); n++;
}

// An unanchored References heading ends at the next real section heading (RFC1583's appendices),
// but not at an htmlized entry that became a section link (RFC756: reused number, "J. Postel,").
{
  const html13 = `<html><body><pre>
<span class="h2"><a class="selflink" id="section-1" href="#section-1">1</a>. Introduction</span>

References

    [<a id="ref-1">1</a>] Postel, J., "Internet Protocol", <a href="./rfc791">RFC 791</a>, September 1981.

<span class="h2"><a class="selflink" id="appendix-A" href="#appendix-A">A</a>. OSPF data formats</span>

            [IP address, mask]
                    Describes the collection of IP addresses contained in the range, 1994 "quoted text".
</pre></body></html>`;
  const r13 = extractRefs(cheerio.load(html13), 'RFC9987', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html13 });
  assert.deepStrictEqual(r13.references.bibliographic, ['RFC791']); n++;
  assert.deepStrictEqual(r13.badRefs || [], [], JSON.stringify(r13.badRefs)); n++;
}

// Prefixes left on orphan text: an unbracketed label before the author (RFC1392), ": " (RFC2025).
{
  const html14 = `<html><body><pre>
References

   COMER Comer, D., "Internetworking with TCP/IP: Principles, Protocols and Architecture", 1991.

   : D. W. Davies and W. L. Price, "Security for Computer Networks", Second Edition, 1989.
</pre></body></html>`;
  const r14 = extractRefs(cheerio.load(html14), 'RFC9985', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html14 });
  assert.deepStrictEqual((r14.badRefs || []).map((b) => b.refText.slice(0, 22)), ['Comer, D., "Internetwo', 'D. W. Davies and W. L.']); n++;
}

// A ditto ("---,") takes the previous entry's author (RFC2828).
{
  const html15 = `<html><body><pre>
References

   [<a id="ref-A3092">A3092</a>]  American National Standards Institute, "American National
            Standard Data Encryption Algorithm", ANSI X3.92-1981, 30 Dec 1980.

   [<a id="ref-A9017">A9017</a>]  ---, "Financial Institution Key Management (Wholesale)",
            X9.17, 4 Apr 1985.
</pre></body></html>`;
  const r15 = extractRefs(cheerio.load(html15), 'RFC9984', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html15 });
  assert.ok((r15.references.bibliographic || []).includes('ANSI.X9.17.1985'), JSON.stringify(r15.references)); n++;
}

// A capitalized file name in a NIST link is not an Internet-Draft (RFC4880); a sentence-capitalized
// real draft name still is.
{
  const html16 = `<html><body><pre>
References

   [<a id="ref-FIPS186">FIPS186</a>] Digital Signature Standard (DSS) (FIPS PUB 186-2). The latest draft is at:
              &lt; <a href="http://csrc.nist.gov/publications/drafts/fips_186-3/Draft-FIPS-186-3%20_March2006.pdf">http://csrc.nist.gov/publications/drafts/fips_186-3/Draft-FIPS-186-3%20_March2006.pdf</a> &gt;.

   [<a id="ref-AMB">AMB</a>]   Skoglund, J., "Ambisonics in an Ogg Opus Container", Draft-ietf-codec-ambisonics-00, 2016.
</pre></body></html>`;
  const r16 = extractRefs(cheerio.load(html16), 'RFC9983', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html16 });
  assert.deepStrictEqual(r16.references.bibliographic, ['NIST.FIPS.186-2', 'IETF.draft-ietf-codec-ambisonics-00']); n++;
}

// A lettered annex heading ends the references (RFC6460's "Annex B.  Changes since RFC 5430").
{
  const html17 = `<html><body><pre>
References

   [<a id="ref-RFC5430">RFC5430</a>] Salter, M., "Suite B Profile for TLS", <a href="./rfc5430">RFC 5430</a>, March 2009.

Annex B.  Changes since RFC 5430

    - A system desiring to negotiate a Suite B TLS connection at a minimum level of
      security of 128 bits MUST generate a "Supported Elliptic Curves Extension", 2012.
</pre></body></html>`;
  const r17 = extractRefs(cheerio.load(html17), 'RFC9982', { mode: 'ietf-rfc-html', recordSightings: false, htmlRaw: html17 });
  assert.deepStrictEqual(r17.badRefs || [], [], JSON.stringify(r17.badRefs)); n++;
}

console.log(`referencing.ietfBounds.test.js — ${n} cases passed`);
