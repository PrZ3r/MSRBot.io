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
 * referencing.pruneOrphans.test.js — orphan pruning keeps a slug its doc cites,
 * and never "resolves" an orphan from a standard named in its TITLE.
 *
 * 10.5594-MOO-3018 cites SMPTE.ST2110 and, separately, orphan ref1 (“Overview
 * of SMPTE ST 2110 Suite of Standards”). Prune ran parseRefId on the full cite,
 * read ST2110 out of the title, saw the doc's own SMPTE.ST2110 sighting and
 * deleted the orphan — leaving the doc citing a slug missing from the MRI.
 *
 *   node src/main/scripts/test/referencing.pruneOrphans.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mri-prune-orphans-test-'));
const origCwd = process.cwd();
fs.mkdirSync(path.join(sandbox, 'src/main/data/docs'), { recursive: true });
process.chdir(sandbox);
const mriStore = require(path.join(origCwd, 'src/main/lib/mriStore.js'));

const orphan = (slug, cite) => ({
  refId: slug, isOrphan: true, sourceDoc: 'DOC.A', sourceRefId: slug.split('/').pop(),
  citationText: cite, href: null, title: null, rawRef: null, contentHash: slug,
  resolvedDocId: null, needsResolve: 'unknown-publisher',
  rawVariants: [{ docId: 'DOC.A', type: 'bibliographic', cite, href: '', rawRef: '', title: null }],
  provenance: { firstSeen: '2026-07-20T00:00:00.000Z', mapSource: ['ftxml-extract'], mapDetails: ['orphan-slug'] },
});
mriStore.writeMri({
  version: '2.0.0', stats: {}, reverse: {}, orphans: { unmapped: [] },
  refs: {
    'SMPTE.ST2110': { refId: 'SMPTE.ST2110', needsResolve: 'known-publisher-no-doc', contentHash: null, resolution: { sourcePresent: false }, provenance: { firstSeen: '2026-01-01T00:00:00.000Z', mapSource: [], mapDetails: [] }, rawVariants: [{ docId: 'DOC.A', type: 'bibliographic', cite: '', href: '', rawRef: '', title: null }] },
    // cited by DOC.A; title mentions ST 2110 → must survive
    'orphan/DOC.A/ref1': orphan('orphan/DOC.A/ref1', 'SMPTE, “Overview of SMPTE ST 2110 Suite of Standards.” [Online].'),
    // NOT cited any more, and its designator IS a sighting of DOC.A → may go
    'orphan/DOC.A/ref9': orphan('orphan/DOC.A/ref9', 'SMPTE, ST 2110, Professional Media over IP.'),
  },
});

const ref = require(path.join(origCwd, 'src/main/lib/referencing.js'));
ref.reloadDocumentsIndex();
const index = new Set(['SMPTE.ST2110||DOC.A||bibliographic', 'orphan/DOC.A/ref1||DOC.A||bibliographic']);
ref.mriPruneToSightings(index, { removeEmptyRefs: true });
ref.mriFlush({ force: true });
const refs = mriStore.loadMri().refs;
process.chdir(origCwd);
fs.rmSync(sandbox, { recursive: true, force: true });

assert.ok(refs['orphan/DOC.A/ref1'], 'a slug the doc still cites must survive (title mention is not a resolution)');
assert.ok(!refs['orphan/DOC.A/ref9'], 'an uncited orphan whose designator is now a sighting is pruned');
console.log('referencing.pruneOrphans.test.js — all assertions passed');
