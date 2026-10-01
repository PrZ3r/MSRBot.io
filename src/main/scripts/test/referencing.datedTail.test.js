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
 * referencing.datedTail.test.js — pin for undated `Publisher.NNNN` refs.
 *
 * The docId base index stripped a trailing `.NNNN` as if it were a year.
 * For `ISO.8567` that left the base `ISO`, which matched every ISO doc, so
 * mriFlush resolved ISO 8567 / 3166 / 8601 / … to the newest ISO doc
 * (ISO.11664-5.2024) and IEC.1179 to IEC.60958.2023.
 *
 * This test pins both sides: `ISO.8567` must not resolve (and a stale bogus
 * pointer is demoted), while a genuinely dated ref like `AES3.1992` still
 * resolves to the latest edition of its base (`AES3.2009`).
 *
 *   node src/main/scripts/test/referencing.datedTail.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mri-dated-tail-test-'));
const origCwd = process.cwd();
const docsRoot = path.join(sandbox, 'src/main/data/docs');

// chdir BEFORE requiring mriStore / referencing so their module-level roots
// resolve against the sandbox rather than the real repo.
process.chdir(sandbox);
const mriStore = require(path.join(origCwd, 'src/main/lib/mriStore.js'));

const writeDoc = (rel, doc) => {
  const p = path.join(docsRoot, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ docType: 'Standard', status: { active: true }, ...doc }, null, 2) + '\n');
};
writeDoc('iso-cie/standard/ISO.11664-5.2024.json', { docId: 'ISO.11664-5.2024', docLabel: 'ISO/CIE 11664-5:2024', docTitle: 'Colorimetry', publisher: 'ISO/CIE' });
writeDoc('iso/standard/ISO.15948.2004.json', { docId: 'ISO.15948.2004', docLabel: 'ISO 15948:2004', docTitle: 'PNG', publisher: 'ISO' });
writeDoc('aes/standard/AES3.2009.json', { docId: 'AES3.2009', docLabel: 'AES3-2009', docTitle: 'Digital audio interface', publisher: 'AES' });
writeDoc('aes/standard/AES3.1992.json', { docId: 'AES3.1992', docLabel: 'AES3-1992', docTitle: 'Digital audio interface', publisher: 'AES' });

const entry = (refId, resolvedDocId) => ({
  refId,
  normalized: null,
  resolvedDocId,
  needsResolve: resolvedDocId ? null : 'known-publisher-no-doc',
  contentHash: null,
  resolution: resolvedDocId ? { sourcePresent: true, sourceDocId: resolvedDocId } : { sourcePresent: false },
  provenance: { firstSeen: '2026-01-01T00:00:00.000Z', mapSource: [], mapDetails: [] },
  rawVariants: [{ docId: 'PIN', type: 'normative', cite: 'pin', rawRef: '', title: null }]
});

mriStore.writeMri({
  version: '2.0.0',
  stats: {},
  refs: {
    // Bogus pointer left by the old base-stripping — must be demoted.
    'ISO.8567': entry('ISO.8567', 'ISO.11664-5.2024'),
    'IEC.1179': entry('IEC.1179', null),
    // Dated ref whose own edition is absent from the base candidates' latest.
    'AES3.1985': entry('AES3.1985', null)
  },
  reverse: {},
  orphans: { unmapped: [] }
});

const ref = require(path.join(origCwd, 'src/main/lib/referencing.js'));
ref.reloadDocumentsIndex();
ref.mriFlush({ force: true });

const refs = mriStore.loadMri().refs;
process.chdir(origCwd);

assert.strictEqual(refs['ISO.8567'].resolvedDocId, null, `ISO.8567 must not resolve, got '${refs['ISO.8567'].resolvedDocId}'`);
assert.strictEqual(refs['ISO.8567'].needsResolve, 'known-publisher-no-doc', 'ISO.8567 should be demoted to known-publisher-no-doc');
assert.strictEqual(refs['IEC.1179'].resolvedDocId, null, `IEC.1179 must not resolve, got '${refs['IEC.1179'].resolvedDocId}'`);
assert.strictEqual(refs['AES3.1985'].resolvedDocId, 'AES3.2009', `AES3.1985 should resolve to the latest AES3 edition, got '${refs['AES3.1985'].resolvedDocId}'`);

fs.rmSync(sandbox, { recursive: true, force: true });

console.log('referencing.datedTail.test.js — all assertions passed');
