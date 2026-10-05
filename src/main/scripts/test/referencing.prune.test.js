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
 * referencing.prune.test.js — mriPruneToSightings drops an uncited ref whose doc is gone.
 *
 * Prune runs before mriFlush refreshes `resolution.sourcePresent`, so it used to trust a stale
 * `true`: after CMR.ML was renamed to MOVIELABS.CMR, the uncited CMR.ML entry survived the
 * build and was counted as a missing ref. Prune now asks the registry directly.
 *
 *   node src/main/scripts/test/referencing.prune.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mri-prune-test-'));
const origCwd = process.cwd();
const docsRoot = path.join(sandbox, 'src/main/data/docs');

// chdir BEFORE requiring mriStore / referencing so their module-level roots
// resolve against the sandbox rather than the real repo.
process.chdir(sandbox);
const mriStore = require(path.join(origCwd, 'src/main/lib/mriStore.js'));

const writeDoc = (rel, doc) => {
  const p = path.join(docsRoot, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ docType: 'Registry', status: { active: true }, ...doc }, null, 2) + '\n');
};
writeDoc('movielabs/registry/_undated/MOVIELABS.CMR.json', { docId: 'MOVIELABS.CMR', docLabel: 'CMR - Movielabs', docTitle: 'COMMON METADATA RATINGS', publisher: 'Movielabs' });

const entry = (refId, sourcePresent) => ({
  refId,
  normalized: null,
  resolvedDocId: sourcePresent ? refId : null,
  needsResolve: sourcePresent ? null : 'known-publisher-no-doc',
  contentHash: null,
  resolution: sourcePresent ? { sourcePresent: true, sourceDocId: refId } : { sourcePresent: false },
  provenance: { firstSeen: '2026-01-01T00:00:00.000Z', mapSource: [], mapDetails: [] },
  rawVariants: []
});

mriStore.writeMri({
  version: '2.0.0',
  stats: {},
  refs: {
    // Renamed away: stored flag still says present, no doc and no sightings → must go.
    'CMR.ML': entry('CMR.ML', true),
    // Registered doc with no sightings: a source doc, kept.
    'MOVIELABS.CMR': entry('MOVIELABS.CMR', false)
  },
  reverse: {},
  orphans: { unmapped: [] }
});

const ref = require(path.join(origCwd, 'src/main/lib/referencing.js'));
ref.reloadDocumentsIndex();
const res = ref.mriPruneToSightings(new Set(), { removeEmptyRefs: true });
ref.mriFlush({ force: true });

const refs = mriStore.loadMri().refs;
process.chdir(origCwd);
fs.rmSync(sandbox, { recursive: true, force: true });

assert.strictEqual(res.removedRefs, 1, `expected 1 ref removed, got ${res.removedRefs}`);
assert.ok(!refs['CMR.ML'], 'uncited CMR.ML with a stale sourcePresent flag must be pruned');
assert.ok(refs['MOVIELABS.CMR'], 'registered MOVIELABS.CMR must be kept even with no sightings');

console.log('referencing.prune.test.js — all assertions passed');
