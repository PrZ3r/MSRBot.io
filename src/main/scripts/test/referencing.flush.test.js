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
 * referencing.flush.test.js — mriFlush regression pin.
 *
 * mriFlush's "resolution truth" branch used to treat
 * _findSourceDocIdForRefId(e.refId) (refId-as-its-own-docId lookup) as the
 * sole authority on resolvedDocId. That clobbered every N-to-1 slug→docId
 * pointer on every build — e.g. the IETF extractor maps the draft
 * `IETF.draft-ietf-tls-rfc8446bis-03` to `RFC8446`; flush saw the refId
 * itself wasn't a registered docId, decided "no source present", and reset
 * the entry to `resolvedDocId: null, needsResolve: known-publisher-no-doc`.
 *
 * Regression originally surfaced in PR #1201. This test pins the corrected
 * behaviour: an extractor-set resolvedDocId pointing at a still-registered
 * doc survives a flush.
 *
 *   node src/main/scripts/test/referencing.flush.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Sandbox: temp dir laid out like the real repo so referencing.js's
// process.cwd()-resolved MRI_PATH and docs root hit our fixtures.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mri-flush-test-'));
const origCwd = process.cwd();
const docsRoot = path.join(sandbox, 'src/main/data/docs');
const mriPath = path.join(sandbox, 'src/main/reports/masterReferenceIndex.json');
fs.mkdirSync(path.join(docsRoot, 'ietf/rfc'), { recursive: true });
fs.mkdirSync(path.dirname(mriPath), { recursive: true });

// Minimal registry doc — what _findSourceDocIdForRefId / _hasDocIdOrBase look up.
fs.writeFileSync(
  path.join(docsRoot, 'ietf/rfc/RFC8446.json'),
  JSON.stringify({ docId: 'RFC8446', docLabel: 'IETF RFC 8446', docTitle: 'TLS 1.3', docType: 'Standard', publisher: 'IETF', status: { active: true } }, null, 2) + '\n'
);

// Minimal MRI with an entry whose refId is NOT itself a registered docId
// but whose resolvedDocId IS — the N-to-1 pointer mapping flush must respect.
fs.writeFileSync(mriPath, JSON.stringify({
  version: '2.0.0',
  generatedAt: '2026-01-01T00:00:00.000Z',
  stats: { uniqueRefIds: 1, resolvedCount: 1, knownPublisherNoDocCount: 0, unknownPublisherOrphanCount: 0 },
  refs: {
    'IETF.draft-ietf-tls-rfc8446bis-03': {
      refId: 'IETF.draft-ietf-tls-rfc8446bis-03',
      normalized: null,
      resolvedDocId: 'RFC8446',
      needsResolve: null,
      contentHash: 'pinned',
      resolution: { sourcePresent: false },
      provenance: {
        firstSeen: '2026-01-01T00:00:00.000Z',
        mapSource: ['ietf-rfc-html-fallback'],
        mapDetails: ['rfc-text']
      },
      rawVariants: []
    }
  },
  reverse: {},
  orphans: { unmapped: [] }
}, null, 2) + '\n');

process.chdir(sandbox);

// Require referencing AFTER chdir so the module-level MRI_PATH resolves
// against the sandbox rather than the real repo.
const ref = require(path.join(origCwd, 'src/main/lib/referencing.js'));

// Force a fresh documents index read against the sandbox layout.
ref.reloadDocumentsIndex();

// Flush should reconcile, not clobber. force:true ensures a write even if
// resolution.sourcePresent didn't change (the entry currently has it false).
const result = ref.mriFlush({ force: true });
assert.ok(result, 'mriFlush returned no result');

const after = JSON.parse(fs.readFileSync(mriPath, 'utf8'));
const entry = after.refs && after.refs['IETF.draft-ietf-tls-rfc8446bis-03'];
assert.ok(entry, 'entry missing from MRI after flush');

assert.strictEqual(
  entry.resolvedDocId,
  'RFC8446',
  `regression: mriFlush clobbered N-to-1 pointer — expected resolvedDocId='RFC8446', got '${entry.resolvedDocId}'`
);
assert.strictEqual(
  entry.needsResolve,
  null,
  `entry resolves via pointer, so needsResolve should be null, got '${entry.needsResolve}'`
);

// Counterpoint: a stale extractor-set resolvedDocId pointing at a doc that's
// NO LONGER in the registry should be demoted to known-publisher-no-doc.
// Run in a child process — referencing.js caches the loaded MRI in module
// scope so a same-process re-test against a rewritten MRI file would just
// re-flush the cached in-memory copy.
process.chdir(origCwd);

const { execFileSync } = require('child_process');
const stalePath = path.join(sandbox, 'stale-test.js');
fs.writeFileSync(stalePath, `
const fs = require('fs');
const path = require('path');
const sandbox = ${JSON.stringify(sandbox)};
process.chdir(sandbox);
const docsRoot = path.join(sandbox, 'src/main/data/docs');
fs.rmSync(docsRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(docsRoot, 'ietf/rfc'), { recursive: true });
fs.writeFileSync(
  path.join(docsRoot, 'ietf/rfc/RFC8446.json'),
  JSON.stringify({ docId: 'RFC8446', docLabel: 'IETF RFC 8446', docTitle: 'TLS 1.3', docType: 'Standard', publisher: 'IETF', status: { active: true } }, null, 2) + '\\n'
);
const mriPath = path.join(sandbox, 'src/main/reports/masterReferenceIndex.json');
fs.writeFileSync(mriPath, JSON.stringify({
  version: '2.0.0',
  generatedAt: '2026-01-01T00:00:00.000Z',
  stats: {},
  refs: {
    'IETF.draft-bogus-00': {
      refId: 'IETF.draft-bogus-00',
      normalized: null,
      resolvedDocId: 'RFC9999',
      needsResolve: null,
      contentHash: 'stale',
      resolution: { sourcePresent: false },
      provenance: { firstSeen: '2026-01-01T00:00:00.000Z', mapSource: [], mapDetails: [] },
      rawVariants: [{ docId: 'PIN', type: 'normative', cite: 'pin', rawRef: '', title: null }]
    }
  },
  reverse: {},
  orphans: { unmapped: [] }
}, null, 2) + '\\n');
const ref = require(${JSON.stringify(path.join(origCwd, 'src/main/lib/referencing.js'))});
ref.reloadDocumentsIndex();
ref.mriFlush({ force: true });
const stale = JSON.parse(fs.readFileSync(mriPath, 'utf8')).refs['IETF.draft-bogus-00'];
if (!stale) { console.error('stale entry missing post-flush'); process.exit(2); }
const ok = stale.resolvedDocId === null && stale.needsResolve === 'known-publisher-no-doc';
console.log(JSON.stringify({ resolvedDocId: stale.resolvedDocId, needsResolve: stale.needsResolve }));
process.exit(ok ? 0 : 3);
`);
const childOut = execFileSync(process.execPath, [stalePath], { encoding: 'utf8' });
const childResult = JSON.parse(childOut.trim());
assert.strictEqual(childResult.resolvedDocId, null, 'stale pointer should be cleared');
assert.strictEqual(childResult.needsResolve, 'known-publisher-no-doc', 'stale entry should be demoted');

fs.rmSync(sandbox, { recursive: true, force: true });

console.log('referencing.flush.test.js — all assertions passed');
