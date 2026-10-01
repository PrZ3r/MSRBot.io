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
 * manualProvider.test.js — the manual extraction provider (providers/manual.*).
 *
 * A record goes in; the test checks the doc that comes out without running the
 * full extractDocs pipeline: citations mapped by the real parseRefId, one MRI
 * sighting per parsed citation, unparsed citations handed to onBadRefs (orphans),
 * an explicit refId logged as a judgment call, self-references dropped, and the
 * per-field provenance hints kept off the serialized doc.
 *
 *   node src/main/scripts/test/manualProvider.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseRefId } = require(path.join(__dirname, '..', '..', 'lib', 'referencing.js'));
const { createManualDiscovery } = require(path.join(__dirname, '..', 'providers', 'manual.discovery.js'));
const { createManualParser } = require(path.join(__dirname, '..', 'providers', 'manual.parse.js'));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-provider-test-'));
const input = path.join(dir, 'records.json');
fs.writeFileSync(input, JSON.stringify({ records: [{
  docId: 'CST.RT999.2026', docLabel: 'CST-RT-999-2026', docTitle: 'Test', docType: 'Recommendation', publisher: 'CST',
  language: 'fr', status: { active: true },
  sourceUrl: 'https://example.org/doc.pdf',
  metaSources: { docTitle: 'inferred', 'status.active': 'inferred' },
  metaSourceUrls: { href: 'https://example.org/list' },
  metaFlags: { docTitle: { reviewRequired: true } },
  citations: {
    normative: [
      { cite: 'ISO 26 428 – 3 – D-Cinema Distribution Master – Part 3' },
      { cite: 'La norme Afnor NF S27-100:2014' },
      { cite: 'Une charte éditée par un régulateur' },
      { cite: 'Subtitle Specification for DLP Cinema', refId: 'TI.DLP-CCC.1.1-rC.2005' },
      { cite: 'CST RT 999 – 2026' }
    ],
    bibliographic: [{ cite: 'SMPTE ST 428-7:2014 Digital Cinema Distribution Master – Subtitle' }]
  }
}] }));

const sightings = [];
const bad = [];
const discovery = createManualDiscovery({ inputPath: input });
const parser = createManualParser({
  discovery,
  parseRefId,
  mriRecordSighting: (s) => sightings.push(s),
  onBadRefs: (refs) => bad.push(...refs)
});

(async () => {
  const keys = await discovery.discoverFromRootDocPage();
  assert.deepStrictEqual(keys, ['manual:0']);
  const [doc] = await parser.extractFromUrl(keys[0]);

  assert.deepStrictEqual(doc.references.normative, ['ISO.26428-3', 'AFNOR.NFS27-100.2014', 'TI.DLP-CCC.1.1-rC.2005']);
  assert.deepStrictEqual(doc.references.bibliographic, ['SMPTE.ST428-7.2014']);
  assert.strictEqual(bad.length, 1, 'one unparsed citation goes to onBadRefs');
  assert.strictEqual(bad[0].refText, 'Une charte éditée par un régulateur');
  assert.strictEqual(sightings.length, 4, 'one sighting per mapped citation (self-reference dropped)');
  assert.ok(sightings.find((s) => s.refId === 'TI.DLP-CCC.1.1-rC.2005').mapSource === 'manual:explicit');
  assert.ok(sightings.find((s) => s.refId === 'ISO.26428-3').mapSource.startsWith('manual:'));

  // provenance hints are present but never serialized
  assert.strictEqual(doc.__metaSources.docTitle, 'inferred');
  assert.strictEqual(doc.status.__metaSources.active, 'inferred');
  assert.strictEqual(doc.__metaSourceUrls.href, 'https://example.org/list');
  const json = JSON.stringify(doc);
  for (const k of ['__', 'citations', 'metaSources', 'sourceUrl']) assert.ok(!json.includes(`"${k}`), `serialized doc must not contain ${k}`);

  // a record missing a required field is rejected up front
  fs.writeFileSync(input, JSON.stringify({ records: [{ docId: 'X', docTitle: 'x' }] }));
  await assert.rejects(createManualDiscovery({ inputPath: input }).discoverFromRootDocPage(), /missing docLabel/);

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('manualProvider.test.js — all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
