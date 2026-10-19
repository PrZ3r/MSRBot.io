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
 * build.reference-api.js — reference endpoints next to the documents API
 * (#1170, #2037, #2038):
 *
 *   build/api/by-publisher.json        index of the full-record slices
 *       (build/api/by-publisher/{publisher}.json and …/{publisher}/{docType}.json,
 *       written by build.assemble-registry.js)
 *   build/api/groups.json              groups registry (src/main/data/groups.json)
 *   build/api/projects.json            projects registry (src/main/data/projects.json)
 *   build/api/by-doc.json              reverse index: docId → { groups, projects }
 *   build/api/publishers.json          publisher slug, name, URL, logo, aliases, doc counts by docType
 *   build/api/vocabulary.json          controlled keywords, docTypes, contentTypes (filter values)
 *
 * Publisher and docType slugs come from slug() in src/main/lib/registry.js, the
 * same scheme as the slices and /api/search/. No build timestamps, so the files
 * are byte-stable across rebuilds when the data hasn't changed.
 *
 *   node src/main/scripts/build.reference-api.js   # standalone
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs, slug } = require('../lib/registry');

const API_ROOT = path.resolve('build', 'api');
const API_VERSION = '1.0.0';
const SCHEMA = '/api/schemas/reference.schema.json';

const readJson = (p) => JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

const sortedObject = (obj) => Object.fromEntries(Object.keys(obj).sort().map(k => [k, obj[k]]));
const sortedUnique = (arr) => Array.from(new Set(arr)).sort();

/** publisher slug → { publisher, total, docTypes: docType slug → { docType, total } } */
function countByPublisher(docs) {
  const pubs = {};
  for (const d of docs) {
    const ps = slug(d.publisher);
    const ts = slug(d.docType);
    const p = pubs[ps] || (pubs[ps] = { publisher: d.publisher || null, total: 0, docTypes: {} });
    p.total++;
    const t = p.docTypes[ts] || (p.docTypes[ts] = { docType: d.docType || null, total: 0 });
    t.total++;
  }
  return pubs;
}

function byPublisherIndex(counts) {
  const publishers = {};
  for (const ps of Object.keys(counts).sort()) {
    const p = counts[ps];
    const docTypes = {};
    for (const ts of Object.keys(p.docTypes).sort()) {
      docTypes[ts] = { ...p.docTypes[ts], path: `/api/by-publisher/${ps}/${ts}.json` };
    }
    publishers[ps] = { publisher: p.publisher, total: p.total, path: `/api/by-publisher/${ps}.json`, docTypes };
  }
  return {
    $schema: SCHEMA,
    apiVersion: API_VERSION,
    note: 'Full records (without $meta) per publisher and per publisher + docType. Each file is a JSON array of documents. Fetch /api/doc/{docId}.json for one record with $meta provenance.',
    total: Object.values(counts).reduce((n, p) => n + p.total, 0),
    publishers,
  };
}

function publishersPayload(counts, config) {
  const entries = config.publishers || {};
  const bySlug = {};
  for (const [name, p] of Object.entries(entries)) {
    bySlug[slug(name)] = { publisher: name, url: p.url || null, logo: p.logo ? `/${String(p.logo).replace(/^\/+/, '')}` : null, aliases: (p.aliases || []).slice().sort() };
  }
  const publishers = {};
  for (const ps of sortedUnique([...Object.keys(bySlug), ...Object.keys(counts)])) {
    const c = counts[ps];
    const cfg = bySlug[ps] || { publisher: c.publisher, url: null, logo: null, aliases: [] };
    const docTypes = {};
    for (const t of Object.values(c ? c.docTypes : {})) docTypes[t.docType] = t.total;
    publishers[ps] = { ...cfg, total: c ? c.total : 0, docTypes: sortedObject(docTypes) };
  }
  return {
    $schema: SCHEMA,
    apiVersion: API_VERSION,
    note: 'Every publisher in the registry or in publishers.json. The slug keys match /api/by-publisher/ and /api/search/. total is 0 for configured publishers with no documents yet.',
    total: Object.keys(publishers).length,
    publishers,
  };
}

function vocabularyPayload(docs, keywords, rendering) {
  const docTypes = {};
  for (const d of docs) if (d.docType) docTypes[d.docType] = (docTypes[d.docType] || 0) + 1;
  const contentTypes = {};
  for (const [value, ct] of Object.entries(rendering.contentTypes || {})) {
    contentTypes[value] = { label: ct.label || value, page: ct.noPage !== true };
  }
  return {
    $schema: SCHEMA,
    apiVersion: API_VERSION,
    note: 'Valid filter values. keywords: the controlled vocabulary every document keyword is drawn from. docTypes: each docType with its document count. contentTypes: journal-article content types (page: false means those documents have no /docs/ page but stay in the API).',
    keywords: (keywords.terms || []).slice(),
    docTypes: sortedObject(docTypes),
    contentTypes: sortedObject(contentTypes),
  };
}

/** docId → { groups, projects }: a doc's own group, plus each project that names it and that project's group. */
function byDocIndex(docs, projects) {
  const out = {};
  const entry = (id) => out[id] || (out[id] = { groups: [], projects: [] });
  for (const d of docs) if (d.docId && d.group) entry(d.docId).groups.push(String(d.group));
  for (const p of projects) {
    const ids = [...(Array.isArray(p.docAffected) ? p.docAffected : []), ...(p.newDoc ? [p.newDoc] : [])];
    for (const id of ids) {
      const e = entry(String(id));
      e.projects.push(String(p.projectId));
      if (p.assignedGroup) e.groups.push(String(p.assignedGroup));
    }
  }
  const sorted = {};
  for (const id of Object.keys(out).sort()) sorted[id] = { groups: sortedUnique(out[id].groups), projects: sortedUnique(out[id].projects) };
  return {
    $schema: SCHEMA,
    apiVersion: API_VERSION,
    note: 'Reverse index for documents with an owning group or project work. groups: the document\'s own group plus the groups of projects that name it; projects: projects whose docAffected or newDoc names it. Project data can be incomplete or stale (see /api/projects.json).',
    total: Object.keys(sorted).length,
    documents: sorted,
  };
}

function emitReferenceApi(docs = loadAllDocs()) {
  const groups = readJson('src/main/data/groups.json');
  const projects = readJson('src/main/data/projects.json');
  const counts = countByPublisher(docs);

  writeJson(path.join(API_ROOT, 'by-publisher.json'), byPublisherIndex(counts));
  writeJson(path.join(API_ROOT, 'groups.json'), {
    $schema: SCHEMA, apiVersion: API_VERSION, sourcePath: 'src/main/data/groups.json',
    note: 'Groups registry; each item follows /api/schemas/groups.schema.json.',
    total: groups.length, groups,
  });
  writeJson(path.join(API_ROOT, 'projects.json'), {
    $schema: SCHEMA, apiVersion: API_VERSION, sourcePath: 'src/main/data/projects.json',
    note: 'Projects registry; each item follows /api/schemas/projects.schema.json. Hand-maintained: some projectLink URLs are not public and docAffected can lag the registry (issue #523).',
    total: projects.length, projects,
  });
  writeJson(path.join(API_ROOT, 'by-doc.json'), byDocIndex(docs, projects));
  writeJson(path.join(API_ROOT, 'publishers.json'), publishersPayload(counts, readJson('src/main/config/publishers.json')));
  writeJson(path.join(API_ROOT, 'vocabulary.json'), vocabularyPayload(docs, readJson('src/main/config/controlledKeywords.json'), readJson('src/main/config/docRendering.json')));
  console.log(`[api] Wrote reference endpoints (by-publisher.json, groups.json=${groups.length}, projects.json=${projects.length}, by-doc.json, publishers.json=${Object.keys(counts).length} with docs, vocabulary.json)`);
}

module.exports = { emitReferenceApi, API_VERSION, byDocIndex, byPublisherIndex, publishersPayload, vocabularyPayload, countByPublisher };

if (require.main === module) {
  emitReferenceApi();
}
