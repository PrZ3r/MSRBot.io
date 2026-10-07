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
 * keywordConform.test.js — the shared keyword conformer and bio placement.
 *
 * Runs against the real rules file (src/main/config/keywordDecisions.json),
 * so a rule removed by mistake fails here. A 2026-10 harness showed the rules
 * reproduce the keywords of all 526 SMPTE content_batch docs (2024–26) from
 * their raw index_terms; these cases pin the behaviors that depends on.
 *
 *   node src/main/scripts/test/keywordConform.test.js
 */

const assert = require('assert');
const { makeKeywordConformer, loadKeywordDecisions, clusterKey } = require('../../lib/keywordConform');
const { matchBios } = require('../../lib/authorBios');

const decisions = loadKeywordDecisions();
let n = 0;
const eq = (got, want, msg) => { assert.deepStrictEqual(got, want, msg); n++; };

// Shouted (content_batch index_terms): title-cased, acronyms kept, rules applied.
const shouted = makeKeywordConformer(['HDR', 'PTP', 'Video Coding'], decisions, { shouted: true });
eq(shouted.conformList(['NEURAL RADIANCE FIELDS']), ['Neural Radiance Fields'], 'shouted multi-word → title case');
eq(shouted.conformList(['QUIC', 'ABR']), ['QUIC', 'ABR'], 'short all-caps tokens are acronyms');
eq(shouted.conformList(['NHK ARCHIVES']), ['NHK Archives'], 'org acronym restored');
eq(shouted.conformList(['HIGH DYNAMIC RANGE (HDR)']), ['High Dynamic Range (HDR)'], 'acronym in parentheses restored');
eq(shouted.conformList(['APPLE VISON PRO']), ['Apple Vision Pro'], 'typo fold');
eq(shouted.conformList(['IN THE GOOD OLD DAYS', 'STREAMING']), ['Streaming'], 'prose drop');
eq(shouted.conformList(['COMMON MEDIA COMMON DATA']), ['Common Media Client Data (CMCD)'], 'garbled CMCD fold');
eq(shouted.conformList(['VMAF']), ['VMAF'], 'acronym casing');
eq(shouted.conformList(['SUBJECTIVE STUDY']), ['Subjective Study'], 'Subjective Study is a topic, not a drop');

// Mixed-case IEEE terms keep their capitals; never shouted-lowercased.
const ieee = makeKeywordConformer(['HDR'], decisions);
eq(ieee.conformList(['ITU-R BT.2100', 'TLS 1.3', 'DOCSIS']), ['ITU-R BT.2100', 'TLS 1.3', 'DOCSIS'], 'deliberate capitals kept');
eq(ieee.conformList(['PQ. HLG']), ['PQ', 'HLG'], 'split');

// Clusters: variants of an existing term land on it; new variants on one spelling.
const cl = makeKeywordConformer(['HDR'], decisions);
cl.prime([['High-dynamic Range (HDR)'], ['High Dynamic Range (HDR)'], ['100 gbit/s'], ['100Gbps'], ['100GbE']]);
eq(cl.conformList(['High-dynamic Range (HDR)']), ['HDR'], 'acronym long form → existing term');
eq(cl.conformList(['100 gbit/s', '100Gbps']), ['100GbE'], 'Ethernet rate variants → one spelling');
eq(clusterKey('SMPTE ST 2059–2'), clusterKey('ST2059-2'), 'standard spelling variants share a key');

// Bios: placed by the name the bio contains, not the source pairing.
const { assigned } = matchBios(
  [{ name: 'Yvonne Thomas' }, { name: 'Thomas Kernen' }],
  [{ name: 'Yvonne Thomas', firstname: 'Yvonne', surname: 'Thomas', bio: 'Thomas Kernen is a senior engineer.' },
   { name: 'Thomas Kernen', firstname: 'Thomas', surname: 'Kernen', bio: 'Yvonne Thomas leads the team.' }],
);
eq(assigned.get(1).startsWith('Thomas Kernen'), true, 'bio swapped back to its author');
eq(assigned.get(0).startsWith('Yvonne Thomas'), true, 'bio swapped back to its author');

console.log(`keywordConform.test.js — ${n} cases passed`);
