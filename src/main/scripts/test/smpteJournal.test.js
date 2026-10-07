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
 * smpteJournal.test.js — the local SMPTE journal library provider.
 *
 *   - merge rules: an extraction never deletes (keywords / authors unioned,
 *     nested keys kept), and a locked nested key keeps its value;
 *   - a fixture paper (content_batch + FTXML) parses to the registry shape;
 *   - no readable local source → discovery finds nothing (the run is a no-op).
 *
 *   node src/main/scripts/test/smpteJournal.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readContentBatch, nested, union, mergeAuthors } = require('../providers/smpteJournal.parse');
const { createSmpteJournalDiscovery } = require('../providers/smpteJournal.discovery');

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); n++; };

// ---- merge rules ---------------------------------------------------------
eq(union(['Manual Term', 'HDR'], ['HDR', 'PQ']), ['Manual Term', 'HDR', 'PQ'], 'keywords: hand-added kept, new appended');
eq(union(undefined, ['PQ']), ['PQ'], 'keywords: none stored');
eq(mergeAuthors([{ name: 'Ann Lee', bio: 'Ann Lee is…' }], [{ name: 'Ann Lee' }, { name: 'Bo Kim' }]),
  [{ name: 'Ann Lee', bio: 'Ann Lee is…' }, { name: 'Bo Kim' }], 'authors: stored object (bio) kept, new author appended');
eq(mergeAuthors([{ name: 'Ann Lee' }, { name: 'Hand Added' }], [{ name: 'Ann Lee' }]),
  [{ name: 'Ann Lee' }, { name: 'Hand Added' }], 'authors: never removed');

const stored = { issn: { print: '1545-0279', 'print$meta': { source: 'parsed' }, electronic: '2160-2492' } };
ok(nested(stored, 'issn', { print: '1545-0279' }) === stored.issn, 'nested: unchanged → stored object as-is ($meta kept)');
const changed = nested(stored, 'issn', { print: '9999-0000' });
ok(changed.print === '9999-0000' && changed.electronic === '2160-2492' && changed['print$meta'].originalValue === '1545-0279',
  'nested: changed key updated with originalValue; other keys kept');
const locked = { copyright: { holder: 'SMPTE', 'holder$meta': { excludeChanges: true } } };
eq(nested(locked, 'copyright', { holder: 'Someone Else' }), locked.copyright, 'nested: excludeChanges key keeps its value');

// ---- fixture paper -------------------------------------------------------
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'smpte-journal-lib-'));
const issue = path.join(lib, 'Journal Article Repository', '2026', 'SMPTEMIJTEST2026_1');
fs.mkdirSync(path.join(issue, 'FTXML'), { recursive: true });
fs.writeFileSync(path.join(issue, '01-test.xml'), `<?xml version="1.0"?>
<content_batch xmlns="http://www.ieee.org/schema/content_delivery/1.6"><body><journal>
<journal_metadata><full_title>SMPTE Motion Imaging Journal</full_title><abbrev_title>SMPTE Mot. Imag. J.</abbrev_title><journal_acronym>MIJ</journal_acronym>
<issn type="paper">1545-0279</issn><issn type="electronic">2160-2492</issn></journal_metadata>
<journal_issue><publication_date><month>July/August</month><year>2026</year></publication_date><journal_volume><volume>135</volume><issue>6</issue></journal_volume></journal_issue>
<journal_article><title>Streaming Over QUIC</title><pubitype type="orig-research"/>
<contributors><person_name><given_name>Ann</given_name><surname>Lee</surname></person_name></contributors>
<abstract>We measure &#x201C;latency&#x201D;.</abstract><index_terms><term>STREAMING</term><term>QUIC</term></index_terms>
<pages><first_page>10</first_page><last_page>19</last_page></pages><doi>10.5594/JMI.2026-TEST0001</doi><article_sequence>1</article_sequence>
</journal_article></journal></body></content_batch>`);
fs.writeFileSync(path.join(issue, 'FTXML', 'FT_01-test.xml'), '<article><back><ref-list><title>References</title>'
  + '<ref id="ref1"><label>1.</label> <mixed-citation>J. Iyengar, &#x201C;QUIC,&#x201D; IETF RFC 9000, 2021.</mixed-citation></ref>'
  + '</ref-list></back></article>');

const rec = readContentBatch(path.join(issue, '01-test.xml'));
eq([rec.doi, rec.contentType, rec.title, rec.pages, rec.volume, rec.issue, rec.month],
  ['10.5594/JMI.2026-TEST0001', 'orig-research', 'Streaming Over QUIC', '10–19', '135', '6', '07'], 'content_batch fields');
eq(rec.rawKeywords, ['STREAMING', 'QUIC'], 'index_terms read raw (conformed later)');
eq(rec.abstract, 'We measure “latency”.', 'entities decoded');

const disc = createSmpteJournalDiscovery({ sourcePath: lib, fromYear: 2025 });
eq(disc.allPrimaries().map((p) => path.basename(p.file)), ['01-test.xml'], 'discovery finds the primary, skips FTXML');

// ---- no readable source → nothing to do ----------------------------------
eq(createSmpteJournalDiscovery({ sourcePath: path.join(lib, 'missing'), fromYear: 2025 }).allPrimaries(), [], 'missing source → no papers');
const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'smpte-journal-empty-'));
fs.mkdirSync(path.join(empty, 'Journal Article Repository', '2026', 'X'), { recursive: true });
fs.writeFileSync(path.join(empty, 'Journal Article Repository', '2026', 'X', 'p.xml'), '');
eq(createSmpteJournalDiscovery({ sourcePath: empty, fromYear: 2025 }).allPrimaries(), [], '0-byte placeholders → no papers');
eq(createSmpteJournalDiscovery({ sourcePath: lib, fromYear: 2027 }).allPrimaries(), [], '--from after the newest year → no papers');

fs.rmSync(lib, { recursive: true, force: true });
fs.rmSync(empty, { recursive: true, force: true });
console.log(`smpteJournal.test.js — ${n} cases passed`);
