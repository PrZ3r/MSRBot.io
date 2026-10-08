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
 * reconcileIncoming.test.js — re-extract guards that keep held registry values
 * when upstream only re-renders them (offline). Cases are from the 2026-10-08
 * IETF extract run.
 *
 *   node src/main/scripts/test/reconcileIncoming.test.js
 */

const assert = require('assert');
const path = require('path');
const { reconcileIncoming, authorsEquivalent, mergeKeywords } = require(path.join(__dirname, '..', 'utils', 'reconcileIncoming.js'));

const A = (...names) => names.map((name) => ({ name }));
let n = 0;

// Authors: initials form, any order, umlaut folding, "Dr." and suffixes — same people.
const same = [
  [A('Robert T. Braden'), A('R. Braden')],
  [A('Dr. Ed Levinson'), A('E. Levinson')],
  [A('Ned Freed', 'Dr. John C. Klensin', 'Dr. Marshall T. Rose', 'Dave Crocker', 'Einar A. Stefferud'),
    A('J. Klensin', 'N. Freed', 'M. Rose', 'E. Stefferud', 'D. Crocker')],
  [A('Andy Bierman', 'Martin Björklund', 'Jürgen Schönwälder'), A('A. Bierman', 'M. Bjorklund', 'J. Schoenwaelder')],
  [A('Mitra Ardron', 'Scott D. Nelson', 'C. Parks'), A('S. Nelson', 'C. Parks', 'Mitra')],
  [A('Donald E. Eastlake 3rd'), A('D. Eastlake 3rd')],
  [A('John Preuß Mattsson', 'Mohit Sethi'), A('J. Preuß Mattsson', 'M. Sethi')],
];
for (const [held, inc] of same) { assert.ok(authorsEquivalent(held, inc), JSON.stringify(inc)); n++; }

// Real changes still go through: a different person, an added author, a new initial.
const differ = [
  [A('Robert T. Braden'), A('R. Bradner')],
  [A('Ned Freed'), A('N. Freed', 'K. Moore')],
  [A('Robert T. Braden'), A('T. Braden')],
  [[], A('R. Braden')],
];
for (const [held, inc] of differ) { assert.ok(!authorsEquivalent(held, inc), JSON.stringify(inc)); n++; }

// Keywords: never drop a held term; skip case/plural/hyphen/typo variants; add new terms.
const held = ['Security', 'Signature', 'Encryption'];
assert.strictEqual(mergeKeywords(held, ['Security', 'Signature', 'Eneryption']), held); n++;
assert.strictEqual(mergeKeywords(['MIME-MSG', 'Media', 'Types'], ['MIME-MSG', 'Media', 'Type']).length, 3); n++;
assert.strictEqual(mergeKeywords(['W-OTS', 'W-OTS+'], ['WOTS', 'WOTS+']).length, 2); n++;
assert.deepStrictEqual(mergeKeywords(['CoAP', 'IoT'], ['CoAP', 'Internet of Things']), ['CoAP', 'IoT', 'Internet of Things']); n++;
assert.deepStrictEqual(mergeKeywords(undefined, ['NNTP']), ['NNTP']); n++;
assert.deepStrictEqual(mergeKeywords(['Security'], []), ['Security']); n++;

// Whole doc: trailing slash, whitespace, list order are kept; real updates pass through.
{
  const heldDoc = {
    resolvedHref: 'https://www.rfc-editor.org/info/rfc1035',
    href: 'https://doi.org/10.17487/RFC0732',
    abstract: 'NNTP specifies a protocol.  NNTP is designed so.',
    authors: A('Robert T. Braden'),
    status: { amendedBy: ['RFC2181', 'RFC2137'], amends: ['RFC822'] },
  };
  const inc = {
    resolvedHref: 'https://www.rfc-editor.org/info/rfc1035/',
    href: 'https://doi.org/10.17487/RFC732',
    abstract: 'NNTP specifies a protocol. NNTP is designed so.',
    authors: A('R. Braden'),
    status: { amendedBy: ['RFC2137', 'RFC2181'], amends: ['RFC822', 'RFC952'] },
  };
  const kept = reconcileIncoming(heldDoc, inc);
  assert.deepStrictEqual(kept.sort(), ['abstract', 'authors', 'resolvedHref', 'status.amendedBy']); n++;
  assert.strictEqual(inc.resolvedHref, heldDoc.resolvedHref); n++;
  assert.strictEqual(inc.href, 'https://doi.org/10.17487/RFC732', 'DOI change is a real update'); n++;
  assert.deepStrictEqual(inc.status.amends, ['RFC822', 'RFC952'], 'new relation is a real update'); n++;
}

console.log(`reconcileIncoming.test.js — ${n} cases passed`);
