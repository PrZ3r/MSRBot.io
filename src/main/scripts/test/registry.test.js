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
 * registry.js smoke tests (issue #1108).
 *
 * Pins the path-derivation invariants that the per-doc registry depends on:
 * blank-publisher routing, the gentle docId sanitizer that keeps SMPTE-style
 * docIds distinct, and the year third-shard for title-identified docTypes.
 * Self-contained — no test framework, just `node` + `assert`.
 *
 *   node src/main/scripts/test/registry.test.js   # exits non-zero on any failure
 */

const assert = require('assert');
const path = require('path');
const r = require('../../lib/registry');

// ---- slug(): aggressive, lower-case, for folder components ----
assert.strictEqual(r.slug(''),       '_unknown', 'empty slug → _unknown');
assert.strictEqual(r.slug(null),     '_unknown', 'null slug → _unknown');
assert.strictEqual(r.slug('   '),    '_unknown', 'whitespace-only slug → _unknown');
assert.strictEqual(r.slug('---'),    '_unknown', 'punctuation-only slug → _unknown');
assert.strictEqual(r.slug('SMPTE'),  'smpte');
assert.strictEqual(r.slug('A&B'),    'a-and-b', '& expands to " and "');
assert.strictEqual(r.slug('ISO/IEC'),'iso-iec');
assert.strictEqual(
  r.slug('ISO/IEC'),
  r.slug('ISO-IEC'),
  'near-duplicate publisher slugs collide on purpose so migration can flag them'
);

// ---- docIdSlug(): gentle, preserves dots/hyphens/case ----
assert.strictEqual(r.docIdSlug('SMPTE.ST274.2005'),  'SMPTE.ST274.2005', 'SMPTE-style docId passes through unchanged');
assert.strictEqual(r.docIdSlug('SMPTE.RP27-3.1989'), 'SMPTE.RP27-3.1989');
assert.strictEqual(r.docIdSlug('SMPTE.RP27.3.1989'), 'SMPTE.RP27.3.1989');
assert.notStrictEqual(
  r.docIdSlug('SMPTE.RP27-3.1989'),
  r.docIdSlug('SMPTE.RP27.3.1989'),
  'docIds differing only in . vs - must remain distinct filenames'
);
assert.strictEqual(r.docIdSlug('10.5594/J02284'),    '10.5594-J02284',  'DOI slash → dash, dots preserved');
assert.strictEqual(r.docIdSlug(''),                  '_unknown');

// ---- docPath(): publisher/docType[/year]/docIdSlug.json ----
assert.strictEqual(
  r.docPath({ publisher: 'SMPTE', docType: 'Standard', docId: 'SMPTE.ST274.2005' }),
  path.join('smpte', 'standard', 'SMPTE.ST274.2005.json'),
  'lineage docType (Standard): no year level'
);
assert.strictEqual(
  r.docPath({ publisher: 'SMPTE', docType: 'Standard', docId: 'X', publicationDate: '2020-01-01' }),
  path.join('smpte', 'standard', 'X.json'),
  'lineage docType: publicationDate does NOT add a year level'
);
assert.strictEqual(
  r.docPath({ publisher: 'SMPTE', docType: 'Journal Article', docId: '10.5594/J02284', publicationDate: '2018-03-01' }),
  path.join('smpte', 'journal-article', '2018', '10.5594-J02284.json'),
  'title-label docType: year level inserted from publicationDate'
);
assert.strictEqual(
  r.docPath({ publisher: 'AES', docType: 'Journal Article', docId: 'JAES.v2', publicationDate: '1954-04-01' }),
  path.join('aes', 'journal-article', '1954', 'JAES.v2.json'),
  'year-sharding applies across all publishers, not just SMPTE'
);
assert.strictEqual(
  r.docPath({ publisher: 'IETF', docType: 'White Paper', docId: 'X' }),
  path.join('ietf', 'white-paper', '_undated', 'X.json'),
  'title-label docType without publicationDate → _undated bucket'
);
assert.strictEqual(
  r.docPath({ publisher: '', docType: 'Specification', docId: 'SubRip.SRT' }),
  path.join('_unknown', 'specification', 'SubRip.SRT.json'),
  'blank publisher → reserved _unknown slug'
);

// ---- YEAR_SHARDED_DOCTYPES sources from site.json#titleLabelDocTypes ----
assert.ok(r.YEAR_SHARDED_DOCTYPES.has('Journal Article'), 'Journal Article must be year-sharded');
assert.ok(!r.YEAR_SHARDED_DOCTYPES.has('Standard'),       'Standard (lineage) must NOT be year-sharded');

console.log('✓ registry.js smoke tests pass');
