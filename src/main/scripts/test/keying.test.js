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
 * keying.test.js — SMPTE docIds key to a lineage (publisher / type / number / part).
 *
 * An unkeyed docId lands in the MSI as UNKEYED and files an issue (#2374: SMPTE.ECR1.1978).
 *
 *   node src/main/scripts/test/keying.test.js
 */

const assert = require('assert');
const path = require('path');
const { keyFromDocId } = require(path.join(__dirname, '..', '..', 'lib', 'keying.js'));

const cases = [
  ['SMPTE.ECR1.1978', { type: 'ECR', number: '1', part: null }],
  ['SMPTE.ST259.2008', { type: 'ST', number: '259', part: null }],
  ['SMPTE.ST377-1.2009', { type: 'ST', number: '377', part: '1' }],
  ['SMPTE.EG1.1990', { type: 'EG', number: '1', part: null }],
  ['SMPTE.OV2081-0.2015', { type: 'OV', number: '2081', part: '0' }],
  ['SMPTE.RDD9.2009', { type: 'RDD', number: '9', part: null }],
];

for (const [docId, want] of cases) {
  const k = keyFromDocId(docId) || {};
  assert.deepStrictEqual({ type: k.type, number: k.number, part: k.part }, want, `${docId} keyed as ${JSON.stringify(k)}`);
  assert.strictEqual(k.publisher, 'SMPTE', `${docId} publisher`);
}
console.log(`keying.test.js — ${cases.length} cases passed`);
