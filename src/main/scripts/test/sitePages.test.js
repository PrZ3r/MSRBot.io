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
 * sitePages.test.js — build-time page data (#2555): the ref graph payload and
 * its renderer (src/main/lib/refGraph.js, src/site/js/refTreeRender.js), and
 * portal resolution (src/main/lib/sitePages.js).
 */

const assert = require('assert');
const { encodeRefGraph, refTreeIndexData } = require('../../lib/refGraph');
const R = require('../../../site/js/refTreeRender');
const { resolvePortalDocs, portalDocsTable, suitePage } = require('../../lib/sitePages');

let n = 0;
const eq = (got, want, msg) => { assert.deepStrictEqual(got, want, msg); n++; };
const ok = (v, msg) => { assert.ok(v, msg); n++; };

// --- ref graph
const docs = [
  { docId: 'A', docLabel: 'Doc A', currentStatus: 'Active', referencesResolved: { normative: ['B', { id: 'orphan/A/x' }], bibliographic: [{ allParts: true, suiteSlug: 's1' }] }, referencedBy: [] },
  { docId: 'B', docLabel: 'Doc B', currentStatus: 'Superseded', referencesResolved: { normative: ['C', 'GONE'] }, referencedBy: ['A'] },
  { docId: 'C', docLabel: 'Doc C', contentType: 'gated', referencesResolved: {} },
  { docId: 'P1', docLabel: 'Part 1', referencesResolved: {} },
];
const suitesPayload = { suites: [{ suiteSlug: 's1', suiteTitle: 'Suite One', allPartsLatestIds: ['P1'] }], collections: [] };
const citeMap = { 'orphan/A/x': { cite: 'Some Author, “A Paper,” 1950.', resolvedDocId: null } };
const payload = encodeRefGraph({ docs, suitesPayload, citeMap, hasPage: d => d.contentType !== 'gated' });
const g = R.decodeGraph(JSON.parse(JSON.stringify(payload)));

eq(g.out('A').slice().sort(), ['B', 'SUITE:s1', 'orphan/A/x'], 'A out-edges (all-parts ref becomes a SUITE node)');
eq(g.out('SUITE:s1'), ['P1'], 'suite node points at its latest parts');
eq(g.in('P1'), ['SUITE:s1'], 'in-edges derived from out-edges');
eq(R.buildLevels(g, 'A', 'down', 3), [['B', 'SUITE:s1', 'orphan/A/x'], ['C', 'GONE', 'P1']], 'levels walk the graph');
eq(R.buildLevels(g, 'C', 'up', 2), [['B'], ['A']], 'upstream levels');
eq(g.view('SUITE:s1').label, 'Suite One (All Parts)', 'suite label');

const html = (id) => R.nodeHtml(g, id);
ok(html('B').includes('href="../B/"'), 'registry doc with a page links to its tree');
ok(!html('C').includes('href='), 'page-gated doc is not linked');
ok(!html('GONE').includes('href=') && html('GONE').includes('NOT IN REGISTRY'), 'missing doc: plain text + badge');
ok(!html('orphan/A/x').includes('href=') && !html('orphan/A/x').includes('orphan/A/x'), 'external ref: no link, no orphan id');
ok(html('orphan/A/x').includes('A Paper') && html('orphan/A/x').includes('EXTERNAL'), 'external ref: cite + badge');

const tree = R.buildTreeDedup(g, 'A', 'down', 3);
eq(tree.children.map(c => c.id), ['B', 'SUITE:s1', 'orphan/A/x'], 'tree children sorted');

const idx = refTreeIndexData(docs, d => d.contentType !== 'gated');
eq(idx.lookup.map(r => r[0]), ['A', 'B', 'P1'], 'lookup skips docs without a tree page');
eq(idx.mostConnected[0].id, 'A', 'most-connected ranks by refs in + out');

// --- portals
const pdocs = [
  { docId: 'X1', docLabel: 'X 1', publisher: 'SMPTE', docSuiteTitle: 'Fam', status: { latestVersion: true, active: true } },
  { docId: 'X2', docLabel: 'X 2', publisher: 'SMPTE', docSuiteTitle: 'Fam', status: { latestVersion: false } },
  { docId: 'Y1', docLabel: 'Y 1', publisher: 'ISO', abstract: 'about D-Cinema things', status: { latestVersion: true } },
  { docId: 'Z1', docLabel: 'Z 1', publisher: 'AES', status: { latestVersion: true } },
];
const portal = {
  items: [
    { docId: 'Z1' },
    { latestOnly: true, match: { publisher: 'SMPTE', suiteTitle: 'Fam' } },
    { latestOnly: true, match: { keyword: 'DCinema' } },
  ],
  filter: [{ docId: 'Y1' }, { docId: 'Z1' }],
};
eq(resolvePortalDocs(portal, pdocs).map(d => d.docId), ['Z1', 'X1'], 'items in order, latestOnly, filter removes unpinned, pinned stays');
const table = portalDocsTable(resolvePortalDocs(portal, pdocs));
eq(table.count, 2, 'portal table row count');
ok(table.rowsHtml.indexOf('X1') < table.rowsHtml.indexOf('Z1'), 'rows sorted by label');

// --- suites
const byId = new Map(docs.map(d => [d.docId, d]));
const page = suitePage({ kind: 'suite', publisher: 'SMPTE', number: '1', suiteTitle: 'Suite One', parts: ['1'], allPartsLatestIds: ['P1'], latestPerPart: { 1: { docId: 'P1' } } }, { byId, docs, aliases: {} });
eq(page.label, 'SMPTE 1 — Suite One', 'suite label');
ok(page.rowsHtml.includes('../../docs/P1/') && page.rowsHtml.includes('<td class="part-col">1</td>'), 'suite row links the part');

console.log(`sitePages.test.js — ${n} assertions passed`);
