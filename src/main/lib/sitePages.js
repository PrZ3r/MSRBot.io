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
 * sitePages.js — build-time HTML for list pages that used to render in the
 * browser from the full documents.json (issue #2555): suite and collection
 * pages, the suites index, and portal pages. Pages ship complete HTML (for
 * crawlers and no-JS readers); their scripts only filter and sort it.
 *
 * Functions take the built docs (with status / currentStatus) and return HTML
 * strings for the templates' {{{…}}} slots.
 */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const str = (x) => String(x == null ? '' : x).trim();

// Abstract text as HTML: escaped, each newline a paragraph break.
function abstractHtml(text) {
  return esc(String(text).replace(/\\n/g, '\n')).replace(/\n/g, '<br><br>');
}

const ABSTRACT_TRUNCATE_CHARS = 280;

/** Abstract block with a More/Less toggle for long text (toggle handled by the page script). */
function abstractBlock(text) {
  const raw = str(text);
  if (!raw) return '';
  if (raw.length <= ABSTRACT_TRUNCATE_CHARS && !raw.includes('\n')) {
    return `<div class="small text-muted suite-abstract fst-italic">${abstractHtml(raw)}</div>`;
  }
  // Flatten newlines in the preview so "…" and More don't start a new paragraph.
  const flat = raw.replace(/\s*\n+\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const cut = flat.slice(0, ABSTRACT_TRUNCATE_CHARS).replace(/\s+\S*$/, '').trim();
  return '<div class="small text-muted suite-abstract fst-italic" data-state="short">' +
    `<span class="suite-abstract-short">${abstractHtml((cut || flat) + '…')}</span>` +
    `<span class="suite-abstract-full d-none">${abstractHtml(raw)}</span>` +
    '<button type="button" class="btn btn-link btn-sm p-0 ms-1 suite-abstract-toggle">More</button>' +
    '</div>';
}

function statusFlags(d) {
  const st = d && d.status && typeof d.status === 'object' ? d.status : {};
  const tokens = [];
  if (st.active === true) tokens.push('Active');
  if (st.withdrawn === true) tokens.push('Withdrawn');
  if (st.superseded === true) tokens.push('Superseded');
  if (st.stabilized === true) tokens.push('Stabilized');
  return { st, tokens };
}

function isLatestDoc(d) {
  const st = d && d.status && typeof d.status === 'object' ? d.status : {};
  if (typeof st.latestVersion === 'boolean') return st.latestVersion;
  if (typeof d.isLatestAny === 'boolean') return d.isLatestAny;
  return false;
}

const labelCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// ---------------------------------------------------------------- suites

/** Label shown on suite cards and suite page headings. */
function suiteLabel(rec) {
  const pub = str(rec.publisher);
  const num = rec.kind === 'suite' ? str(rec.number) : '';
  const title = rec.kind === 'collection' ? str(rec.collectionTitle || rec.suiteTitle) : str(rec.suiteTitle);
  const head = `${pub}${num ? ` ${num}` : ''}`;
  return title ? `${head} — ${title}` : head;
}

/** Publisher matcher for collections: alias → canonical, else first part of "ISO/IEC". */
function publisherMatcher(aliases) {
  const lower = {};
  for (const [a, c] of Object.entries(aliases || {})) lower[String(a).toLowerCase()] = String(c);
  return (pubRaw) => {
    const input = str(pubRaw);
    if (!input) return '';
    const canon = lower[input.toLowerCase()];
    if (canon) return canon.trim();
    return input.includes('/') ? input.split('/')[0].trim() : input;
  };
}

function docPublisher(d) {
  const p = d && (d.publisher || d.docPublisher || d.publisherName);
  if (p) return p;
  const m = String(d && d.docId || '').match(/^([A-Za-z0-9/+-]+)\./);
  return m ? m[1] : '';
}

/** Latest docs of a collection: same (normalized) publisher + docSuiteTitle. */
function collectionDocs(rec, docs, normPub) {
  const wantPub = normPub(rec.publisher);
  const wantTitle = str(rec.collectionTitle || rec.suiteTitle);
  if (!wantPub || !wantTitle) return [];
  return docs
    .filter(d => {
      if (!d || !d.docId) return false;
      if (normPub(docPublisher(d)) !== wantPub) return false;
      if (str(d.docSuiteTitle || d.suiteTitle) !== wantTitle) return false;
      const st = d.status || {};
      if (typeof st.latestVersion === 'boolean') return st.latestVersion === true;
      if (typeof st.active === 'boolean') return st.active === true;
      return true;
    })
    .sort((a, b) => labelCollator.compare(String(a.docLabel || a.docId), String(b.docLabel || b.docId)));
}

function suiteDocRow(id, d, partKey, docsPrefix) {
  const { st, tokens } = statusFlags(d);
  const label = d && d.docLabel ? d.docLabel : id;
  const title = d && (d.docTitle || d.title) ? (d.docTitle || d.title) : '';
  return `<tr class="${st.withdrawn === true ? 'suite-row-withdrawn' : ''}">` +
    (partKey !== null ? `<td class="part-col">${esc(partKey || '—')}</td>` : '') +
    '<td>' +
      `<div><a href="${docsPrefix}${encodeURIComponent(id)}/" class="text-decoration-none">${esc(label)}</a></div>` +
      (title ? `<div class="small text-muted">${esc(title)}</div>` : '') +
      abstractBlock(d && d.abstract) +
    '</td>' +
    `<td class="status-col"><span class="status-badge">${esc(tokens.join(' · ') || '—')}</span></td>` +
    `<td class="pubdate-col">${esc((d && d.publicationDate) || '—')}</td>` +
    '</tr>';
}

/**
 * Body of one suite/collection page.
 * @returns {{ label, metaText, baseHtml, rowsHtml, isCollection }}
 */
function suitePage(rec, { byId, docs, aliases, docsPrefix = '../../docs/' }) {
  const isCollection = rec.kind === 'collection';
  const pub = str(rec.publisher);
  const flags = [];
  if (rec.hasActiveBase) flags.push('has active base');
  if (rec.hasWithdrawn) flags.push(isCollection ? 'some docs withdrawn' : 'some parts withdrawn');
  if (rec.hasStabilized) flags.push('stabilized');
  const parts = !isCollection && Array.isArray(rec.parts) ? rec.parts : [];
  const lineageCount = Array.isArray(rec.lineages) ? rec.lineages.length : 0;
  const metaText = [
    `${pub} ${rec.kind}`,
    isCollection
      ? (lineageCount ? `${lineageCount} doc${lineageCount > 1 ? 's' : ''}` : 'no docs')
      : (parts.length ? `${parts.length} part${parts.length > 1 ? 's' : ''}` : 'no explicit parts'),
    flags.length ? flags.join(' · ') : null,
  ].filter(Boolean).join(' · ');

  let baseHtml = '';
  let rowsHtml;
  if (isCollection) {
    const list = collectionDocs(rec, docs, publisherMatcher(aliases));
    rowsHtml = list.length
      ? list.map(d => suiteDocRow(d.docId, d, null, docsPrefix)).join('\n')
      : '<tr><td colspan="4" class="text-muted small">No documents found for this collection.</td></tr>';
  } else {
    if (rec.noPartLatestId) {
      const d = byId.get(rec.noPartLatestId);
      const title = d && (d.docTitle || d.title) ? (d.docTitle || d.title) : '';
      baseHtml = `<p class="mb-1"><a href="${docsPrefix}${encodeURIComponent(rec.noPartLatestId)}/" class="text-decoration-none">${esc((d && d.docLabel) || rec.noPartLatestId)}</a></p>` +
        (title ? `<p class="small text-muted mb-0">${esc(title)}</p>` : '');
    }
    const partOf = {};
    for (const [partKey, info] of Object.entries(rec.latestPerPart || {})) {
      if (partKey && info && info.docId) partOf[info.docId] = partKey;
    }
    const ids = Array.isArray(rec.allPartsLatestIds) ? rec.allPartsLatestIds : [];
    rowsHtml = ids.map(id => suiteDocRow(id, byId.get(id), partOf[id] || '', docsPrefix)).join('\n');
  }
  return { label: suiteLabel(rec), metaText, baseHtml, rowsHtml, isCollection };
}

/** Suites index: sorted cards (with data-* for the filter script) + publisher <option>s. */
function suiteCards(payload) {
  const items = [...(payload.suites || []), ...(payload.collections || [])];
  items.sort((a, b) => {
    const ap = a.publisher || '';
    const bp = b.publisher || '';
    if (ap !== bp) return ap.localeCompare(bp);
    const an = a.number || '';
    const bn = b.number || '';
    if (an && bn) {
      const ai = parseInt(an, 10);
      const bi = parseInt(bn, 10);
      if (!Number.isNaN(ai) && !Number.isNaN(bi)) return ai - bi;
      return String(an).localeCompare(String(bn));
    }
    return String(a.suiteTitle || a.collectionTitle || '').localeCompare(String(b.suiteTitle || b.collectionTitle || ''));
  });
  const cardsHtml = items.map(s => {
    const isCollection = s.kind === 'collection';
    const slug = isCollection ? (s.collectionSlug || '') : (s.suiteSlug || '');
    const title = isCollection ? (s.collectionTitle || s.suiteTitle || '') : (s.suiteTitle || '');
    const parts = Array.isArray(s.parts) ? s.parts : [];
    const lineageCount = Array.isArray(s.lineages) ? s.lineages.length : 0;
    const search = `${s.publisher || ''} ${s.number || ''} ${title}`.toLowerCase();
    return `<div class="col" data-publisher="${esc(s.publisher || '')}" data-kind="${s.kind}" data-search="${esc(search)}">` +
      '<div class="card h-100"><div class="card-body">' +
      '<h2 class="h6 card-title mb-1 d-flex align-items-start justify-content-between gap-2">' +
      `<a href="${slug ? `${encodeURIComponent(slug)}/` : '#'}" class="stretched-link text-decoration-none">${esc(suiteLabel(s))}</a>` +
      `<span class="badge bg-info-subtle text-info-emphasis ms-2">${isCollection ? 'Collection' : 'Suite'}</span>` +
      '</h2>' +
      `<div class="text-muted small">${isCollection ? `Docs: ${lineageCount || '–'}` : `Parts: ${parts.length ? esc(parts.join(', ')) : '–'}`}</div>` +
      '</div></div></div>';
  }).join('\n');
  const pubs = Array.from(new Set(items.map(s => str(s.publisher)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const publisherOptions = pubs.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  return { cardsHtml, publisherOptions, count: items.length };
}

// ---------------------------------------------------------------- portals

const normPub = (p) => str(p).toUpperCase();
const normPubList = (f) => (f == null ? [] : (Array.isArray(f) ? f : [f]).map(normPub).filter(Boolean));
// Lowercase, alphanumerics only, so "D-Cinema" matches "DCinema".
const normSearch = (s) => str(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

function textIncludes(haystack, needle) {
  const h = str(haystack);
  const n = str(needle);
  if (!h || !n) return false;
  if (h.toLowerCase().includes(n.toLowerCase())) return true;
  const h2 = normSearch(h);
  const n2 = normSearch(n);
  return !!h2 && !!n2 && h2.includes(n2);
}

function toSearchString(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(toSearchString).filter(Boolean).join(' ');
  if (typeof v === 'object') return Object.values(v).map(toSearchString).filter(Boolean).join(' ');
  return String(v);
}

function docMatchesKeyword(d, keyword) {
  const k = str(keyword);
  if (!k || !d) return false;
  return [
    d.docId, d.docLabel, d.docTitle, d.docSuiteTitle, d.abstract,
    d.publisher, d.docType, d.docTypeAbr, d.publicationDate,
    d.searchText, d.keywords, d.subjects, d.tags, d.summary, d.scope,
  ].map(toSearchString).filter(Boolean).some(h => textIncludes(h, k));
}

function applyMatchRule(docs, match) {
  const m = match || {};
  const pubs = normPubList(m.publisher);
  const suiteTitle = str(m.suiteTitle);
  const keyword = str(m.keyword);
  return docs.filter(d => {
    if (!d) return false;
    if (pubs.length && !pubs.includes(normPub(d.publisher))) return false;
    if (suiteTitle && str(d.docSuiteTitle) !== suiteTitle) return false;
    if (keyword && !docMatchesKeyword(d, keyword)) return false;
    return true;
  });
}

function ruleHits(docs, rule) {
  let hits = applyMatchRule(docs, rule.match);
  if (rule.latestOnly) hits = hits.filter(isLatestDoc);
  return hits;
}

/**
 * Docs a portal lists: `items` in order (pinned docIds, then `match` rules),
 * minus `filter` exclusions (pinned docIds always stay).
 */
function resolvePortalDocs(portal, docs) {
  const items = Array.isArray(portal.items) ? portal.items : [];
  const filters = Array.isArray(portal.filter) ? portal.filter : [];
  const byId = new Map(docs.filter(d => d && d.docId).map(d => [String(d.docId), d]));
  const pinned = new Set(items.filter(it => it && it.docId).map(it => str(it.docId)).filter(Boolean));
  const out = [];
  const seen = new Set();
  const add = (d) => {
    const id = d && d.docId ? String(d.docId) : '';
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(d);
  };
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    if (it.docId) {
      const d = byId.get(str(it.docId));
      if (d) add(d);
    } else if (it.match) {
      const hits = ruleHits(docs, it).sort((a, b) =>
        str(a.publisher).localeCompare(str(b.publisher)) ||
        str(a.docSuiteTitle).localeCompare(str(b.docSuiteTitle)) ||
        str(a.docLabel || a.docId).localeCompare(str(b.docLabel || b.docId)));
      hits.forEach(add);
    }
  }
  if (!filters.length) return out;
  const exclude = new Set();
  for (const it of filters) {
    if (!it || typeof it !== 'object') continue;
    if (it.docId) exclude.add(str(it.docId));
    else if (it.match) ruleHits(docs, it).forEach(d => exclude.add(String(d.docId)));
  }
  return out.filter(d => pinned.has(String(d.docId)) || !exclude.has(String(d.docId)));
}

function portalSectionsHtml(portal) {
  const sections = (Array.isArray(portal.sections) ? portal.sections : [])
    .map(s => ({ t: esc(s && s.title), b: esc(s && s.body) }))
    .filter(s => s.t || s.b);
  if (!sections.length) return '';
  return '<div class="card"><div class="card-header"><h2 class="h5 mb-0">Overview</h2></div><div class="card-body">' +
    sections.map((s, i) =>
      `<div class="${i === sections.length - 1 ? 'mb-0' : 'mb-3'}">` +
      (s.t ? `<h3 class="h6 mb-1">${s.t}</h3>` : '') +
      (s.b ? `<p class="mb-0 portal-prewrap">${s.b}</p>` : '') +
      '</div>').join('') +
    '</div></div>';
}

function portalResourcesHtml(portal) {
  const resources = Array.isArray(portal.resources) ? portal.resources : [];
  if (!resources.length) return '';
  const groups = new Map();
  for (const r of resources) {
    const kind = str(r && r.kind) || 'Resources';
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(r);
  }
  const base = { sensitivity: 'base' };
  const kinds = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, undefined, base));
  let html = '<div class="card"><div class="card-header"><h2 class="h5 mb-0">Resources</h2></div><div class="card-body"><div class="row g-3">';
  kinds.forEach((kind, idx) => {
    const list = groups.get(kind).sort((a, b) => {
      const at = str(a && a.title) || str(a && a.href);
      const bt = str(b && b.title) || str(b && b.href);
      return at.localeCompare(bt, undefined, base) || str(a && a.href).localeCompare(str(b && b.href), undefined, base);
    });
    let label = kind.charAt(0).toUpperCase() + kind.slice(1);
    if (!label.endsWith('s')) label += 's';
    const cid = `portalResourcesKind${idx}-c`;
    html += '<div class="col-12 col-lg-4"><div class="card portal-resource-card h-100"><div class="card-header">' +
      '<h3 class="h6 mb-0 d-flex justify-content-between align-items-center">' +
      `<button class="btn btn-link p-0 text-decoration-none" type="button" data-bs-toggle="collapse" data-bs-target="#${cid}" aria-expanded="true" aria-controls="${cid}">${esc(label)}</button>` +
      `<span class="text-muted small">${list.length}</span></h3></div>` +
      `<div id="${cid}" class="collapse show portal-resource-collapse"><div class="card-body pt-2"><ul class="list-group list-group-flush">`;
    for (const r of list) {
      const title = esc(r && r.title);
      const href = esc((r && r.href) || '#');
      const desc = str(r && r.description);
      html += '<li class="list-group-item">' +
        `<div class="fw-semibold"><a href="${href}" target="_blank" rel="noopener noreferrer">${title || href}</a></div>`;
      if (desc) {
        html += '<div class="portal-resource-descwrap" data-state="short">' +
          `<div class="portal-resource-desc small text-muted">${esc(desc).replace(/\n/g, '<br><br>')}</div>` +
          (desc.length > 160 || desc.includes('\n') ? '<button type="button" class="btn btn-link btn-sm p-0 ms-1 portal-resource-toggle">More</button>' : '') +
          '</div>';
      }
      html += '</li>';
    }
    html += '</ul></div></div></div></div>';
  });
  return html + '</div></div></div>';
}

const docStatusText = (d) => str(d.currentStatus || (d.status && d.status.latestVersion ? 'Latest' : ''));

/**
 * Portal docs table: rows sorted by label, each carrying data-* sort/filter
 * keys for portals.js, plus the publisher/type <option>s.
 */
function portalDocsTable(docs, { docsPrefix = '../docs/' } = {}) {
  const list = docs.slice().sort((a, b) => labelCollator.compare(str(a.docLabel || a.docId), str(b.docLabel || b.docId)));
  const rowsHtml = list.map(d => {
    const { st, tokens } = statusFlags(d);
    const label = str(d.docLabel || d.docId);
    const title = str(d.docTitle || d.docSuiteTitle);
    const statusSort = docStatusText(d);
    const abstract = str(d.abstract || d.summary || d.scope);
    const search = normSearch([label, d.docId, title, d.docSuiteTitle, d.publisher, statusSort, abstract].map(toSearchString).join(' '));
    const attrs = {
      'data-label': label, 'data-title': title, 'data-doctype': str(d.docType), 'data-published': str(d.publicationDate),
      'data-status': statusSort, 'data-publisher': str(d.publisher), 'data-search': search,
    };
    return `<tr class="${st.withdrawn === true || st.superseded === true ? 'suite-row-withdrawn' : ''}" ` +
      Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ') + '>' +
      `<td><a class="text-decoration-none" href="${docsPrefix}${encodeURIComponent(String(d.docId))}/">${esc(label)}</a></td>` +
      `<td><div>${esc(title)}</div>${abstractBlock(abstract)}</td>` +
      `<td>${esc(d.docType || '—')}</td>` +
      `<td class="text-nowrap">${esc(d.publicationDate || '—')}</td>` +
      `<td class="status-col"><span class="status-badge">${esc(tokens.join(' · ') || statusSort || '—')}</span></td>` +
      `<td>${esc(d.publisher || '')}</td>` +
      '</tr>';
  }).join('\n');
  const options = (key) => Array.from(new Set(list.map(d => str(d[key])).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  return { rowsHtml, count: list.length, publisherOptions: options('publisher'), typeOptions: options('docType') };
}

module.exports = {
  esc, abstractBlock, statusFlags, isLatestDoc,
  suiteLabel, suitePage, suiteCards, collectionDocs, publisherMatcher,
  resolvePortalDocs, portalSectionsHtml, portalResourcesHtml, portalDocsTable,
};
