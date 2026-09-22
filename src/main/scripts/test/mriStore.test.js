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
 * mriStore.test.js — sharded MRI store round-trip + incremental-write pin.
 *
 * Covers every MRI entry shape (resolved / known-publisher-no-doc / orphan
 * slug, with and without citationText / title / rawVariants), SMPTE J/j
 * case-sibling keys (must not collide on case-insensitive filesystems),
 * keys with path-unsafe characters, and the no-op / edit / delete paths.
 *
 *   node src/main/scripts/test/mriStore.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { shardPaths, loadMri, writeMri } = require('../../lib/mriStore');

const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mri-store-test-')), 'mri');

const variant = (docId) => ({ docId, type: 'bibliographic', cite: `cite ${docId}`, href: '', rawRef: '<ref/>', title: null });
const mri = {
  version: '2.0.0',
  stats: { uniqueRefIds: 6, resolvedCount: 1, knownPublisherNoDocCount: 1, unknownPublisherOrphanCount: 2 },
  refs: {
    // resolved canonical ref
    '10.5594-J06292': {
      refId: '10.5594-J06292', normalized: null, resolvedDocId: '10.5594-J06292', needsResolve: null, contentHash: null,
      resolution: { sourcePresent: true, sourceDocId: '10.5594-J06292', firstConfirmedSourceAt: '2026-07-06T18:12:27.484Z' },
      provenance: { firstSeen: '2026-07-06T18:12:24.508Z', mapSource: ['replay'], mapDetails: ['from-documents.json'] },
      rawVariants: [variant('10.5594-J01125')]
    },
    // J/j case sibling — a distinct ref
    '10.5594-j06292': {
      refId: '10.5594-j06292', normalized: null, resolvedDocId: null, needsResolve: 'known-publisher-no-doc', contentHash: null,
      citationText: 'lower-case sibling',
      resolution: { sourcePresent: false },
      provenance: { firstSeen: '2026-07-06T18:12:24.508Z' },
      rawVariants: [variant('SMPTE.ST2067-21.2020')]
    },
    // resolved, no rawVariants
    'RFC8446': {
      refId: 'RFC8446', normalized: null, resolvedDocId: 'RFC8446', needsResolve: null, contentHash: null,
      resolution: { sourcePresent: true, sourceDocId: 'RFC8446' },
      provenance: { firstSeen: null }
    },
    // orphan slug with title
    'orphan/10.5594-J00022/bibr1-10.5594_J00022': {
      refId: 'orphan/10.5594-J00022/bibr1-10.5594_J00022', normalized: null, resolvedDocId: null, needsResolve: 'unknown-publisher',
      contentHash: 'abc123', isOrphan: true, sourceDoc: '10.5594-J00022', sourceRefId: 'bibr1-10.5594_J00022',
      citationText: 'An orphan', title: 'Orphan title', rawRef: '<ref id="bibr1"/>',
      resolution: { sourcePresent: false }, provenance: { firstSeen: null, mapSource: ['phase-3a-extract'] },
      rawVariants: [variant('10.5594-J00022')]
    },
    // orphan whose citing doc is the J/j sibling (same dir case-insensitively)
    'orphan/10.5594-j00022/bibr1-10.5594_j00022': {
      refId: 'orphan/10.5594-j00022/bibr1-10.5594_j00022', normalized: null, resolvedDocId: null, needsResolve: 'unknown-publisher',
      contentHash: 'def456', isOrphan: true, sourceDoc: '10.5594-j00022', sourceRefId: 'bibr1-10.5594_j00022',
      rawRef: '<ref id="bibr1"/>', resolution: { sourcePresent: false }, provenance: { firstSeen: null },
      rawVariants: [variant('10.5594-j00022')]
    },
    // path-unsafe characters in the key
    'orphan/RFC1101/h:e25f0fbf': {
      refId: 'orphan/RFC1101/h:e25f0fbf', normalized: null, resolvedDocId: null, needsResolve: 'unknown-publisher',
      contentHash: null, isOrphan: true, sourceDoc: 'RFC1101', sourceRefId: 'h:e25f0fbf',
      resolution: { sourcePresent: false }, provenance: { firstSeen: null }
    }
  },
  reverse: {},
  orphans: { unmapped: [{ docId: 'X', type: 'normative', cite: 'legacy unmapped', href: '', rawRef: '', title: null }] }
};

// Shard paths: unique case-insensitively, unsafe keys hashed, readable otherwise.
const paths = shardPaths(Object.keys(mri.refs));
const folded = new Set([...paths.values()].map((p) => p.toLowerCase()));
assert.strictEqual(folded.size, paths.size, 'shard paths collide case-insensitively');
assert.strictEqual(paths.get('RFC8446'), path.join('rfc', 'RFC8446.json'));
assert.ok(/~[0-9a-f]{8}\.json$/.test(paths.get('orphan/RFC1101/h:e25f0fbf')), 'unsafe key should get a hash suffix');
assert.ok(/~[0-9a-f]{8}\.json$/.test(paths.get('10.5594-J06292')), 'J/j siblings should get hash suffixes');

// Round trip: byte-identical to the monolithic serialisation.
const first = writeMri(mri, { root });
assert.strictEqual(first.written, 6);
const back = loadMri(root);
assert.strictEqual(JSON.stringify(back, null, 2), JSON.stringify(mri, null, 2), 'round trip changed the MRI');

// No-op write: nothing rewritten (no timestamp either — the store never
// persists generatedAt, so an unchanged MRI is byte-identical on disk).
const noop = writeMri({ ...back, generatedAt: '2030-01-01T00:00:00.000Z' }, { root });
assert.deepStrictEqual([noop.changed, noop.written, noop.deleted, noop.indexChanged], [false, 0, 0, false]);
assert.ok(!('generatedAt' in loadMri(root)), 'generatedAt must not be persisted');

// Single edit: one shard, index untouched.
back.refs.RFC8446.provenance.firstSeen = '2026-09-21T00:00:00.000Z';
const edit = writeMri(back, { root });
assert.deepStrictEqual([edit.changed, edit.written, edit.deleted, edit.indexChanged], [true, 1, 0, false]);

// Delete: shard removed, empty dirs cleaned up.
delete back.refs['orphan/RFC1101/h:e25f0fbf'];
const del = writeMri(back, { root });
assert.deepStrictEqual([del.written, del.deleted], [0, 1]);
assert.ok(!fs.existsSync(path.join(root, 'refs', 'orphan', 'rfc1101')), 'empty shard dir should be removed');
assert.ok(!('orphan/RFC1101/h:e25f0fbf' in loadMri(root).refs));

// Key/refId mismatch is rejected rather than silently re-keyed.
assert.throws(() => writeMri({ refs: { A: { refId: 'B' } } }, { root: path.join(root, '..', 'bad') }), /mismatch/);

fs.rmSync(path.dirname(root), { recursive: true, force: true });
console.log('mriStore.test.js — all assertions passed');
