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
'use strict';

/**
 * refGraph.js — the citation graph behind the /reftree/ pages, built once per
 * build (issue #2555) instead of in every visitor's browser.
 *
 * Edges come from each doc's `referencesResolved` (normative + bibliographic).
 * An all-parts reference (`{ allParts: true, suiteSlug }`) becomes a synthetic
 * `SUITE:{slug}` node whose out-edges are the suite's latest parts (or a
 * collection's docs), from the suites payload (build/suites/_data/suites.json).
 *
 * encodeRefGraph() returns the compact payload decoded by
 * src/site/js/refTreeRender.js (see its header for the format).
 */

const R = require('../../site/js/refTreeRender');

function refTargetId(r) {
  if (!r) return '';
  if (typeof r === 'string') return r;
  if (r.allParts === true && r.suiteSlug) return R.SUITE_PREFIX + String(r.suiteSlug).trim();
  return r.id ? String(r.id) : '';
}

/** slug → { label, children } for suites and collections. */
function suiteNodes(suitesPayload) {
  const map = new Map();
  const p = suitesPayload && typeof suitesPayload === 'object' ? suitesPayload : {};
  const add = (slug, title, pub, num, ids) => {
    const s = String(slug || '').trim();
    if (!s) return;
    const label = String(title || '').trim() || [pub, num].filter(Boolean).join(' ').trim() || s;
    const prev = map.get(s);
    const children = new Set(prev ? prev.children : []);
    (Array.isArray(ids) ? ids : []).forEach(x => { const id = String(x || '').trim(); if (id) children.add(id); });
    map.set(s, { label: prev ? prev.label : `${label} (All Parts)`, children: Array.from(children) });
  };
  for (const s of Array.isArray(p.suites) ? p.suites : []) {
    if (!s) continue;
    add(s.suiteSlug || s.slug, s.suiteTitle || s.title || s.label, s.publisher, s.number,
      Array.isArray(s.allPartsLatestIds) ? s.allPartsLatestIds : s.docIds);
  }
  for (const c of Array.isArray(p.collections) ? p.collections : []) {
    if (!c) continue;
    add(c.collectionSlug || c.suiteSlug || c.slug, c.collectionTitle || c.suiteTitle || c.title || c.label, c.publisher, c.number,
      Array.isArray(c.docIds) ? c.docIds : c.allPartsLatestIds);
  }
  return map;
}

/** Tree/list label: title-first for titleLabelDocTypes, else label-first (matches build.js docLabels). */
function nodeLabel(d, titleFirst) {
  if (titleFirst.has(String(d.docType || '').toLowerCase())) return d.docTitle || d.docLabel || d.docId;
  return d.docLabel || d.docTitle || d.docId;
}

/**
 * Build the adjacency map.
 * @returns {{ out: Map<string,string[]>, in: Map<string,string[]> }}
 */
function buildRefGraph(docs, suitesPayload) {
  const suites = suiteNodes(suitesPayload);
  const out = new Map();
  const addOut = (from, to) => {
    if (!out.has(from)) out.set(from, new Set());
    out.get(from).add(to);
  };
  for (const d of Array.isArray(docs) ? docs : []) {
    if (!d || !d.docId) continue;
    const rr = d.referencesResolved || {};
    const refs = [
      ...(Array.isArray(rr.normative) ? rr.normative : []),
      ...(Array.isArray(rr.bibliographic) ? rr.bibliographic : []),
    ];
    for (const r of refs) {
      const to = refTargetId(r);
      if (!to) continue;
      addOut(String(d.docId), to);
      if (R.isSuiteNode(to)) {
        const s = suites.get(to.slice(R.SUITE_PREFIX.length));
        for (const kid of s ? s.children : []) addOut(to, kid);
      }
    }
  }
  const outArr = new Map();
  const inArr = new Map();
  for (const [from, set] of out) {
    const list = Array.from(set);
    outArr.set(from, list);
    for (const to of list) {
      if (!inArr.has(to)) inArr.set(to, []);
      inArr.get(to).push(from);
    }
  }
  return { out: outArr, in: inArr, suites };
}

/**
 * Compact payload for the client: every node with an edge (plus MRI-resolved
 * targets), its display fields, and out-edges as node indexes.
 * @param {object} opts
 * @param {object[]} opts.docs - built docs (referencesResolved, currentStatus, currentWork)
 * @param {object} opts.suitesPayload - { suites, collections }
 * @param {object} opts.citeMap - api/mri-cite-map.json: refId → { cite, resolvedDocId }
 * @param {string[]} opts.titleLabelDocTypes
 * @param {(doc: object) => boolean} [opts.hasPage] - false for docs without a tree page
 */
function encodeRefGraph({ docs, suitesPayload, citeMap = {}, titleLabelDocTypes = [], hasPage = () => true }) {
  const graph = buildRefGraph(docs, suitesPayload);
  const titleFirst = new Set(titleLabelDocTypes.map(x => String(x || '').toLowerCase()));
  const byId = new Map((docs || []).filter(d => d && d.docId).map(d => [String(d.docId), d]));

  const ids = new Set([...graph.out.keys(), ...graph.in.keys()]);
  for (const id of Array.from(ids)) {
    const m = !byId.has(id) && citeMap[id];
    if (m && m.resolvedDocId) ids.add(String(m.resolvedDocId));
  }
  const order = Array.from(ids).sort();
  const index = new Map(order.map((id, i) => [id, i]));

  const nodes = order.map(id => {
    if (R.isSuiteNode(id)) {
      const slug = id.slice(R.SUITE_PREFIX.length);
      const s = graph.suites.get(slug);
      return [id, s ? s.label : `Suite: ${slug}`, 'SUITE', R.FLAG_SUITE];
    }
    const d = byId.get(id);
    if (d) {
      const label = nodeLabel(d, titleFirst);
      const flags = R.FLAG_REGISTRY |
        (Array.isArray(d.currentWork) && d.currentWork.length ? R.FLAG_PROJECT : 0) |
        (hasPage(d) ? 0 : R.FLAG_NOPAGE);
      return [id, label === id ? 0 : label, d.currentStatus ? String(d.currentStatus) : 0, flags];
    }
    const m = citeMap[id];
    if (m && m.resolvedDocId && index.has(String(m.resolvedDocId))) {
      return [id, 0, 0, R.FLAG_RESOLVED, index.get(String(m.resolvedDocId))];
    }
    if (m) return [id, 0, 0, R.FLAG_EXTERNAL, m.cite || ''];
    return [id, 0, 0, 0];
  });
  const outIdx = order.map(id => (graph.out.get(id) || []).map(t => index.get(t)).sort((a, b) => a - b));
  // Trailing nodes without out-edges need no entry.
  while (outIdx.length && !outIdx[outIdx.length - 1].length) outIdx.pop();
  return { v: 1, nodes, out: outIdx };
}

/** Static root card for /reftree/{docId}/ (a registry doc). */
function renderRootCard(d) {
  const esc = R.escapeHtml;
  const label = d.docLabel || d.docTitle || d.docId;
  const suiteTitle = String(d.docSuiteTitle || d.suiteTitle || '').trim();
  const titleText = suiteTitle ? `${suiteTitle} - ${d.docTitle || label}` : (d.docTitle || label);
  const status = d.currentStatus ? String(d.currentStatus) : '';
  const icon = R.statusIcon(status, 12);
  const proj = R.projectIcon(Array.isArray(d.currentWork) && d.currentWork.length > 0, 12);
  const pub = d.publisher ? String(d.publisher) : '';
  const type = d.docType ? String(d.docType) : '';
  const meta = (pub || type)
    ? '<div class="text-muted small mb-1">' +
      (pub ? `<a href="../../docs/?f.publisher=${encodeURIComponent(pub)}">${esc(pub)}</a>` : '') +
      (pub && type ? ' • ' : '') +
      (type ? `<a href="../../docs/?f.docType=${encodeURIComponent(type)}">${esc(type)}</a>` : '') +
      (status ? ` • <span class="ms-1">[${esc(status)}]</span>` : '') +
      (icon ? `<span class="ms-1">${icon}</span>` : '') +
      (proj ? `<span class="ms-1">${proj}</span>` : '') +
      '</div>'
    : '';
  return '<div class="mb-2"><div class="mb-1 d-flex flex-wrap align-items-center gap-1">' +
    `<span><code>${esc(label)}</code></span>` +
    `<span class="fw-semibold"><a href="../../docs/${encodeURIComponent(d.docId)}/">${esc(titleText)}</a></span>` +
    '</div>' + meta + '</div>' +
    '<p class="small text-muted mt-3 mb-0">Click a document below to open its own reference tree.</p>';
}

// "suiteTitle — docTitle" when the doc belongs to a suite.
function displayTitle(d) {
  const suiteTitle = d.docSuiteTitle || d.suiteTitle || '';
  const base = d.docTitle || d.title || '';
  return suiteTitle && base ? `${suiteTitle} — ${base}` : (base || suiteTitle || '');
}

/**
 * /reftree/ index data: the search lookup rows ([docId, docLabel, title]) and
 * the most-connected docs (upstream = referencedBy, downstream = references).
 * Docs without a tree page (`hasPage` false) are left out.
 */
function refTreeIndexData(docs, hasPage = () => true, topN = 10) {
  const lookup = [];
  const scored = [];
  for (const d of Array.isArray(docs) ? docs : []) {
    if (!d || !d.docId || !hasPage(d)) continue;
    const id = String(d.docId);
    const title = displayTitle(d);
    lookup.push([id, d.docLabel || 0, title || 0]);
    const rr = d.referencesResolved || {};
    const upstream = Array.isArray(d.referencedBy) ? d.referencedBy.length : 0;
    const downstream = (Array.isArray(rr.normative) ? rr.normative.length : 0) + (Array.isArray(rr.bibliographic) ? rr.bibliographic.length : 0);
    if (upstream + downstream) scored.push({ id, label: d.docLabel || title || id, title, upstream, downstream, total: upstream + downstream });
  }
  scored.sort((a, b) => (b.total - a.total) || a.id.localeCompare(b.id));
  return { lookup, mostConnected: scored.slice(0, topN) };
}

/** Static <li>s for the most-connected list. */
function mostConnectedHtml(items) {
  const esc = R.escapeHtml;
  if (!items.length) return '<li class="text-muted small">No connected documents found.</li>';
  return items.map(it => '<li class="mb-2">' +
    `<a class="d-inline-block" href="${encodeURIComponent(it.id)}/">${esc(it.label)}</a>` +
    (it.title ? `<div class="text-muted small">${esc(it.title)}</div>` : '') +
    `<div class="text-muted small">${it.upstream} upstream • ${it.downstream} downstream</div>` +
    '</li>').join('\n');
}

module.exports = { buildRefGraph, encodeRefGraph, suiteNodes, nodeLabel, renderRootCard, refTreeIndexData, mostConnectedHtml };
