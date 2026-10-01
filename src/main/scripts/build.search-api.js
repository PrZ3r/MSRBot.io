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
 * build.search-api.js — compact search index for machine/AI consumers (#2036).
 *
 * Chat-assistant fetch tools truncate files beyond roughly 100 KB, so the
 * registry's full slices (0.4–57 MB) can't be searched by topic from a chat.
 * This emits small, complete shards instead:
 *
 *   build/api/search/index.json            (small: start here)
 *       publisher → { index, total, docTypes: { docType → { count, shards } } }
 *   build/api/search/{publisher}.json      (per-publisher shard list)
 *       docType → shards [{ path, count, first, last }]
 *   build/api/search/{publisher}/{docType}[-{n}].json
 *       { publisher, docType, shard, of, count, first, last, docs: [row…] }
 *
 * Rows cover CURRENT editions: superseded docs are skipped when a successor
 * (status.supersededBy) is in the registry, and kept (status "…,superseded")
 * when none is, so every document MSRBot holds is represented by at least one
 * row. A number with no row in a fully read shard is therefore not in MSRBot.
 * Row shape:
 *   { id, label, title, keywords, status, date }
 * Rows are natural-sorted by docId and split so each shard stays under
 * MAX_SHARD_BYTES; `first`/`last` let a client pick the shard for a number
 * range. No build timestamps, so shards are byte-stable across rebuilds.
 *
 *   node src/main/scripts/build.search-api.js   # standalone
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs, slug } = require('../lib/registry');

const SEARCH_ROOT = path.resolve('build', 'api', 'search');
const API_VERSION = '2.0.0';
// Chat fetch tools truncated suites.json near ~100 KB, and an agent asking for
// verbatim matches reported ~50 KB shards as cut off; 25 KB leaves real margin.
const MAX_SHARD_BYTES = 25 * 1024;

const byDocId = (a, b) => a.id.localeCompare(b.id, 'en', { numeric: true, sensitivity: 'base' });

function statusOf(st) {
  if (!st || typeof st !== 'object') return 'unknown';
  const flags = [];
  if (st.withdrawn === true) flags.push('withdrawn');
  else if (st.active === true) flags.push('active');
  else flags.push('inactive');
  if (st.stabilized === true) flags.push('stabilized');
  if (st.amended === true) flags.push('amended');
  if (st.superseded === true) flags.push('superseded');
  return flags.join(',');
}

function rowOf(doc) {
  const row = {
    id: String(doc.docId),
    label: typeof doc.docLabel === 'string' ? doc.docLabel : null,
    title: typeof doc.docTitle === 'string' ? doc.docTitle : null,
  };
  // Non-English documents only, so English rows stay the same size.
  if (typeof doc.docTitleOriginal === 'string' && doc.docTitleOriginal) row.titleOriginal = doc.docTitleOriginal;
  if (typeof doc.language === 'string' && doc.language && doc.language !== 'en') row.lang = doc.language;
  if (doc.translatedBy === 'msrbot') row.translatedBy = 'msrbot';
  if (Array.isArray(doc.keywords) && doc.keywords.length) row.keywords = doc.keywords.filter((k) => typeof k === 'string');
  row.status = statusOf(doc.status);
  if (typeof doc.publicationDate === 'string' && doc.publicationDate) row.date = doc.publicationDate;
  return row;
}

/** Split sorted rows into chunks whose serialized size stays under MAX_SHARD_BYTES. */
function chunk(rows) {
  const out = [];
  let cur = [];
  let bytes = 0;
  for (const r of rows) {
    const n = Buffer.byteLength(JSON.stringify(r)) + 1;
    if (cur.length && bytes + n > MAX_SHARD_BYTES) {
      out.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(r);
    bytes += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data) + '\n');
}

function emitSearchApi(docs = loadAllDocs()) {
  fs.rmSync(SEARCH_ROOT, { recursive: true, force: true });

  // publisher slug -> { name, types: Map(type slug -> { name, rows[] }) }
  const ids = new Set(docs.filter((d) => d && d.docId).map((d) => String(d.docId)));
  const hasSuccessorInRegistry = (doc) =>
    (Array.isArray(doc.status.supersededBy) ? doc.status.supersededBy : []).some((id) => ids.has(String(id)));

  const pubs = new Map();
  for (const doc of docs) {
    if (!doc || !doc.docId) continue;
    if (doc.status && doc.status.superseded === true && hasSuccessorInRegistry(doc)) continue;
    const pub = slug(doc.publisher);
    if (!pubs.has(pub)) pubs.set(pub, { name: doc.publisher || null, types: new Map() });
    const types = pubs.get(pub).types;
    const type = slug(doc.docType);
    if (!types.has(type)) types.set(type, { name: doc.docType || null, rows: [] });
    types.get(type).rows.push(rowOf(doc));
  }

  const index = {
    $schema: '/api/schemas/search.schema.json',
    apiVersion: API_VERSION,
    note: 'Current editions (superseded excluded when the successor is in MSRBot; otherwise kept and marked superseded), so every document MSRBot holds has a row. Pick a publisher, fetch its index (shard list with first/last docId ranges), then fetch the shards you need. Fetch /api/doc/{id}.json for the full record.',
    maxShardBytes: MAX_SHARD_BYTES,
    total: 0,
    publishers: {},
  };
  let shardCount = 0;

  for (const pub of [...pubs.keys()].sort()) {
    const { name, types } = pubs.get(pub);
    const pubIndex = {
      $schema: '/api/schemas/search.schema.json',
      apiVersion: API_VERSION,
      publisher: name,
      total: 0,
      docTypes: {},
    };
    const summary = { publisher: name, index: `/api/search/${pub}.json`, total: 0, docTypes: {} };
    for (const type of [...types.keys()].sort()) {
      const { name: typeName, rows } = types.get(type);
      rows.sort(byDocId);
      const chunks = chunk(rows);
      const shards = chunks.map((docsInShard, i) => {
        const file = chunks.length === 1 ? `${type}.json` : `${type}-${i + 1}.json`;
        const meta = {
          path: `/api/search/${pub}/${file}`,
          count: docsInShard.length,
          first: docsInShard[0].id,
          last: docsInShard[docsInShard.length - 1].id,
        };
        writeJson(path.join(SEARCH_ROOT, pub, file), {
          apiVersion: API_VERSION,
          publisher: name,
          docType: typeName,
          shard: i + 1,
          of: chunks.length,
          count: meta.count,
          first: meta.first,
          last: meta.last,
          docs: docsInShard,
        });
        shardCount += 1;
        return meta;
      });
      pubIndex.docTypes[type] = { docType: typeName, count: rows.length, shards };
      summary.docTypes[type] = { docType: typeName, count: rows.length, shards: shards.length };
      pubIndex.total += rows.length;
    }
    summary.total = pubIndex.total;
    writeJson(path.join(SEARCH_ROOT, `${pub}.json`), pubIndex);
    index.publishers[pub] = summary;
    index.total += summary.total;
  }

  writeJson(path.join(SEARCH_ROOT, 'index.json'), index);
  console.log(`[search-api] Wrote ${shardCount} shard(s) for ${index.total} current docs under build/api/search/`);
  return { shardCount, total: index.total };
}

module.exports = { emitSearchApi, SEARCH_ROOT, MAX_SHARD_BYTES };

if (require.main === module) {
  emitSearchApi();
}
