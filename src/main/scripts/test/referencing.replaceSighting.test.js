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
 * referencing.replaceSighting.test.js — a corrected re-parse replaces what an
 * earlier sighting stored.
 *
 * mriRecordSighting keeps existing non-empty cite / rawRef, so the FTXML ref
 * fix (first <ref> swallowing "<ref-list><title>References</title>", label and
 * spaced punctuation in the cite) could not land through it. mriReplaceSighting
 * overwrites the (docId, type) variant, and an orphan's own citationText /
 * rawRef / contentHash when the doc minted it.
 *
 *   node src/main/scripts/test/referencing.replaceSighting.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mri-replace-test-'));
const origCwd = process.cwd();
fs.mkdirSync(path.join(sandbox, 'src/main/data/docs'), { recursive: true });

// chdir BEFORE requiring mriStore / referencing so their roots resolve to the sandbox.
process.chdir(sandbox);
const mriStore = require(path.join(origCwd, 'src/main/lib/mriStore.js'));

const badRaw = '<ref-list>\n<title>References</title>\n<ref id="ref1"><label>1.</label> <mixed-citation>R. Xu</mixed-citation></ref>';
const goodRaw = '<ref id="ref1"><label>1.</label> <mixed-citation>R. Xu</mixed-citation></ref>';
mriStore.writeMri({
  version: '2.0.0',
  stats: {},
  refs: {
    'orphan/DOC.A/ref1': {
      refId: 'orphan/DOC.A/ref1', isOrphan: true, sourceDoc: 'DOC.A', sourceRefId: 'ref1',
      citationText: 'References 1. R. Xu , “ Survey ,”', rawRef: badRaw, title: 'Survey', contentHash: 'old',
      resolvedDocId: null, needsResolve: 'unknown-publisher',
      rawVariants: [{ docId: 'DOC.A', type: 'bibliographic', cite: 'References 1. R. Xu , “ Survey ,”', href: '', rawRef: badRaw, title: 'Survey' }],
      provenance: { firstSeen: '2026-07-20T00:00:00.000Z', mapSource: ['ftxml-extract'], mapDetails: ['orphan-slug'] },
    },
  },
  reverse: {},
  orphans: { unmapped: [] },
});

const ref = require(path.join(origCwd, 'src/main/lib/referencing.js'));
const sight = { docId: 'DOC.A', type: 'bibliographic', refId: 'orphan/DOC.A/ref1', cite: 'R. Xu, “Survey,”', href: '', rawRef: goodRaw, title: 'Survey' };

// mriRecordSighting alone leaves the stale cite in place — the reason the helper exists.
ref.mriRecordSighting({ ...sight, refId: undefined });
assert.strictEqual(mriStore.loadMri().refs['orphan/DOC.A/ref1'].citationText, 'References 1. R. Xu , “ Survey ,”');

assert.strictEqual(ref.mriReplaceSighting(sight), true);
assert.strictEqual(ref.mriReplaceSighting({ ...sight, refId: 'orphan/DOC.A/ref99' }), false, 'unknown refId → false (caller mints)');
ref.mriFlush({ force: true });

const e = mriStore.loadMri().refs['orphan/DOC.A/ref1'];
process.chdir(origCwd);
fs.rmSync(sandbox, { recursive: true, force: true });

assert.strictEqual(e.citationText, 'R. Xu, “Survey,”');
assert.strictEqual(e.rawRef, goodRaw);
assert.notStrictEqual(e.contentHash, 'old');
assert.strictEqual(e.rawVariants.filter((v) => v.docId === 'DOC.A').length, 1, 'one variant per (docId, type)');
assert.strictEqual(e.rawVariants[0].cite, 'R. Xu, “Survey,”');

console.log('referencing.replaceSighting.test.js — all assertions passed');
