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

console.log(`referencing.ietfBounds.test.js — ${n} cases passed`);
