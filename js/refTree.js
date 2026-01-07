/*
Copyright (c) 2025 Steve LLamb (https://github.com/SteveLLamb) and PrZ3(https://github.com/PrZ3r)

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

(function() {
  const ROOT_ID = window.MSR_REF_ROOT;
  const GRAPH_URL = (window.assetPrefix || '') + 'docs/_data/documents.json';
  const SUITES_URL = (window.assetPrefix || '') + 'suites/_data/suites.json';
  const SUITE_PREFIX = 'SUITE:';

  function isSuiteNode(id) {
    return typeof id === 'string' && id.startsWith(SUITE_PREFIX);
  }

  function suiteNodeIdFromSlug(slug) {
    return SUITE_PREFIX + String(slug || '').trim();
  }

  function suiteSlugFromNodeId(id) {
    return String(id || '').startsWith(SUITE_PREFIX) ? String(id).slice(SUITE_PREFIX.length) : '';
  }
  const MAX_DEPTH_DEFAULT = 3;

  let refGraph = null;
  let currentRoot = ROOT_ID;
  let maxDepth = MAX_DEPTH_DEFAULT;
  let docIndex = {};

  let suiteChildrenBySlug = new Map();
  let suiteMetaBySlug = new Map();

  let viewModeUp = 'levels';
  let viewModeDown = 'levels';

  let cacheUpLevels = [];
  let cacheDownLevels = [];
  let cacheUpRoutes = [];
  let cacheDownRoutes = [];

  function buildLevels(startId, direction, maxDepth) {
    const levels = [];
    const visited = new Set([startId]);
    let frontier = [startId];

    for (let depth = 1; depth <= maxDepth; depth++) {
      const next = [];
      const nodesAtDepth = new Set();

      for (const id of frontier) {
        const node = refGraph[id];
        if (!node) continue;
        const neighbors = direction === 'up'
          ? (node.refsIn || [])
          : (node.refsOut || []);
        for (const n of neighbors) {
          if (visited.has(n)) continue;
          visited.add(n);
          nodesAtDepth.add(n);
          next.push(n);
        }
      }

      if (!nodesAtDepth.size) break;
      levels.push(Array.from(nodesAtDepth).sort());
      frontier = next;
    }
    return levels;
  }

  // Build explicit route paths from a root, up to maxDepth edges.
  // For downstream, routes look like: [root, child, grandchild, ...]
  // For upstream, we'll reverse the route at render time so it reads: ancestor → ... → root.
  function buildRoutes(startId, direction, maxDepth) {
    const routes = [];
    if (!refGraph || !refGraph[startId]) return routes;

    const neighborOf = (id) => {
      const node = refGraph[id];
      if (!node) return [];
      return direction === 'up' ? (node.refsIn || []) : (node.refsOut || []);
    };

    function dfs(path, depth) {
      const current = path[path.length - 1];
      if (depth >= maxDepth) {
        routes.push([...path]);
        return;
      }

      const neighbors = neighborOf(current);
      if (!neighbors.length) {
        routes.push([...path]);
        return;
      }

      for (const n of neighbors) {
        // prevent trivial cycles within a single path; duplicates
        // across *different* branches are allowed
        if (path.includes(n)) continue;
        dfs([...path, n], depth + 1);
      }
    }

    dfs([startId], 0);
    return routes;
  }

  // --- Helpers for doc metadata rendering (label, status, icons) ---
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // TITLE_LABEL_PREF-aware label logic for list/tree nodes (matches build.js docLabels logic)
  const TITLE_LABEL_PREF = new Set(
    Array.isArray(window.MSR_TITLE_LABEL_DOC_TYPES)
      ? window.MSR_TITLE_LABEL_DOC_TYPES.map(x => String(x || '').toLowerCase())
      : []
  );

  function getLabelFor(id) {
    if (isSuiteNode(id)) {
      const slug = suiteSlugFromNodeId(id);
      const meta = suiteMetaBySlug.get(slug);
      if (meta) {
        const pub = meta.publisher ? String(meta.publisher).trim() : '';
        const title = meta.title ? String(meta.title).trim() : '';
        const num = meta.number ? String(meta.number).trim() : '';
        const label = title || [pub, num].filter(Boolean).join(' ').trim() || slug;
        const kind = meta.kind ? String(meta.kind).trim() : 'suite';
        return `${label} (All Parts)`;
      }
      return `Suite: ${slug || id}`;
    }
    const d = docIndex[id];
    if (!d) return id;

    const dt = String(d.docType || '').toLowerCase();

    // Mirror build.js docLabels logic:
    // - For docTypes in titleLabelDocTypes, prefer docTitle then docLabel.
    // - Otherwise, prefer docLabel then docTitle.
    if (TITLE_LABEL_PREF.has(dt)) {
      return d.docTitle || d.docLabel || id;
    }
    return d.docLabel || d.docTitle || id;
  }

  // Root card uses the original label behavior:
  // prefer docLabel, then docTitle, then docId.
  // It also renders both title and label explicitly.
  function getRootLabelFor(id) {
    const d = docIndex[id];
    if (!d) return id;
    return d.docLabel || d.docTitle || id;
  }

  function getStatusFor(id) {
    if (isSuiteNode(id)) return 'SUITE';
    const d = docIndex[id];
    // build.js stores the rendered status string on currentStatus
    return (d && d.currentStatus) ? String(d.currentStatus) : '';
  }

  function hasActiveProjectFor(id) {
    if (isSuiteNode(id)) return false;
    const d = docIndex[id];
    if (!d) return false;
    const work = Array.isArray(d.currentWork) ? d.currentWork : [];
    // currentWork is only populated for non-complete project/review work
    return work.length > 0;
  }

  function buildStatusIcon(statusStr, size) {
    if (!statusStr) return '';
    const s = String(statusStr);
    if (s.includes('Active')) {
      // Green check-circle for active docs (matches getstatusButton)
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" fill="#0c9c16" class="bi bi-check-circle-fill align-baseline" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>';
    }
    if (s.includes('Superseded') || s.includes('Withdrawn')) {
      // Red slash-circle for superseded/withdrawn
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" fill="#ff0000" class="bi bi-slash-circle-fill align-baseline" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-4.646-2.646a.5.5 0 0 0-.708-.708l-6 6a.5.5 0 0 0 .708.708l6-6z"/></svg>';
    }
    return '';
  }

  function buildProjectIcon(hasActiveProject, size) {
    if (!hasActiveProject) return '';
    // Yellow slash-circle icon (matches refTree header project badge)
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" fill="#F6BE00" class="bi bi-slash-circle-fill align-baseline" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-4.646-2.646a.5.5 0 0 0-.708-.708l-6 6a.5.5 0 0 0 .708.708l6-6z"/></svg>';
  }

  function renderLevels(containerId, levels, direction) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!levels.length) {
      el.innerHTML = '<p class="text-muted mb-0">No entries.</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    levels.forEach((ids, depth) => {
      const heading = document.createElement('div');
      heading.className = 'fw-semibold mb-1 mt-2 rt-level-heading rt-level-heading-' + direction;

      let label;
      if (direction === 'up') {
        if (depth === 0) {
          label = 'Level 1 — direct dependents (docs that cite this doc)';
        } else {
          label = `Level ${depth + 1} — dependents of Level ${depth}`;
        }
      } else if (direction === 'down') {
        if (depth === 0) {
          label = 'Level 1 — direct references (docs this doc cites)';
        } else {
          label = `Level ${depth + 1} — references of Level ${depth}`;
        }
      } else {
        label = `Level ${depth + 1}`;
      }

      heading.textContent = label;
      frag.appendChild(heading);

      const ul = document.createElement('ul');
      ul.className = 'list-unstyled ms-3 rt-level-list rt-level-list-' + direction;
      ids.forEach(id => {
        const li = document.createElement('li');
        const label = getLabelFor(id);
        const statusStr = getStatusFor(id);
        const statusIcon = buildStatusIcon(statusStr, 10);
        const hasProj = hasActiveProjectFor(id);
        const projIcon = buildProjectIcon(hasProj, 10);

        const isSuite = isSuiteNode(id);

        if (isSuite) {
          li.innerHTML = `
            <span class="ref-node d-inline-flex align-items-center gap-1" data-suite-node="1">
              <span>${escapeHtml(label)}</span>
            </span>
            ${statusStr ? '<span class="ms-1">[' + escapeHtml(statusStr) + ']</span>' : ''}
          `;
        } else {
          li.innerHTML = `
            <a href="../${encodeURIComponent(id)}/" class="ref-node d-inline-flex align-items-center gap-1" data-doc-id="${escapeHtml(id)}">
              <span>${escapeHtml(label)}</span></a>
              ${statusStr ? '<span class="ms-1">[' + escapeHtml(statusStr) + ']</span>' : ''}
              ${statusIcon ? '<span class="ms-1">' + statusIcon + '</span>' : ''}
              ${projIcon ? '<span class="ms-1">' + projIcon + '</span>' : ''}
          
          `;
        }
        ul.appendChild(li);
      });
      frag.appendChild(ul);
    });

    el.innerHTML = '';
    el.appendChild(frag);
  }


  // Merge route paths into a nested tree and render as a connector tree
  function buildTreeFromRoutes(routes) {
    if (!routes || !routes.length) return null;

    // Expect routes like [rootId, child, grandchild, ...]; root itself is not re-rendered here.
    const rootId = Array.isArray(routes[0]) && routes[0].length ? routes[0][0] : null;
    if (!rootId) return null;

    const root = { id: rootId, children: new Map() };

    for (const path of routes) {
      if (!Array.isArray(path) || path.length <= 1) continue;
      let node = root;
      for (let i = 1; i < path.length; i++) {
        const id = path[i];
        if (!id) continue;
        let child = node.children.get(id);
        if (!child) {
          child = { id, children: new Map() };
          node.children.set(id, child);
        }
        node = child;
      }
    }

    function toPlain(n) {
      return {
        id: n.id,
        children: Array.from(n.children.values()).map(toPlain),
      };
    }

    return toPlain(root);
  }

  function renderTree(containerId, routes, direction) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!routes || !routes.length) {
      el.innerHTML = '<p class="text-muted mb-0">No entries.</p>';
      return;
    }

    const tree = buildTreeFromRoutes(routes);
    if (!tree || !Array.isArray(tree.children) || !tree.children.length) {
      el.innerHTML = '<p class="text-muted mb-0">No entries.</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    const rootUl = document.createElement('ul');
    rootUl.className = 'rt-tree list-unstyled rt-tree-' + direction;

    function renderNode(node, parentUl) {
      const li = document.createElement('li');
      li.className = 'rt-tree-item rt-tree-item-' + direction;

      const id = node.id;
      const label = getLabelFor(id);
      const statusStr = getStatusFor(id);
      const statusIcon = buildStatusIcon(statusStr, 10);
      const hasProj = hasActiveProjectFor(id);
      const projIcon = buildProjectIcon(hasProj, 10);

      const chip = document.createElement('div');
      chip.className = 'rt-node d-inline-flex align-items-center gap-1';

      const hasChildren = node.children && node.children.length;

      const isSuite = isSuiteNode(id);

      chip.innerHTML = `
        ${hasChildren
          ? '<button type="button" class="btn btn-link btn-sm p-0 rt-node-toggle" aria-label="Toggle children" title="Toggle children">▾</button>'
          : '<span class="rt-node-toggle-spacer"></span>'}
        ${isSuite
          ? `<span class="ref-node d-inline-flex align-items-center gap-1" data-suite-node="1"><span>${escapeHtml(label)}</span></span>`
          : `<a href="../${encodeURIComponent(id)}/"
                 class="ref-node d-inline-flex align-items-center gap-1"
                 data-doc-id="${escapeHtml(id)}">
               <span>${escapeHtml(label)}</span>
             </a>`}
        ${statusStr ? '<span class="ms-1">[' + escapeHtml(statusStr) + ']</span>' : ''}
        ${(!isSuite && statusIcon) ? '<span class="ms-1">' + statusIcon + '</span>' : ''}
        ${(!isSuite && projIcon) ? '<span class="ms-1">' + projIcon + '</span>' : ''}
      `;
      li.appendChild(chip);

      if (node.children && node.children.length) {
        const childUl = document.createElement('ul');
        childUl.className = 'list-unstyled rt-tree-children rt-tree-children-' + direction;
        node.children.forEach(child => renderNode(child, childUl));
        li.appendChild(childUl);
      }

      parentUl.appendChild(li);
    }

    // Do not re-render the root node; start at its immediate children
    tree.children.forEach(child => renderNode(child, rootUl));

    el.innerHTML = '';
    el.appendChild(rootUl);
  }

  function collapseAll(panel) {
    const containerId = panel === 'up' ? 'rt-upstream' : 'rt-downstream';
    const container = document.getElementById(containerId);
    if (!container) return;
    const items = container.querySelectorAll('.rt-tree-item');
    items.forEach((li) => {
      if (li.querySelector('.rt-tree-children')) {
        li.classList.add('rt-tree-collapsed');
        const btn = li.querySelector('.rt-node-toggle');
        if (btn) {
          btn.textContent = '▸';
        }
      }
    });
  }

  function expandAll(panel) {
    const containerId = panel === 'up' ? 'rt-upstream' : 'rt-downstream';
    const container = document.getElementById(containerId);
    if (!container) return;
    const items = container.querySelectorAll('.rt-tree-item.rt-tree-collapsed');
    items.forEach((li) => {
      li.classList.remove('rt-tree-collapsed');
      const btn = li.querySelector('.rt-node-toggle');
      if (btn) {
        btn.textContent = '▾';
      }
    });
  }

  function syncCollapseControls(panel) {
    const view = panel === 'up' ? viewModeUp : viewModeDown;
    const els = document.querySelectorAll('.rt-collapse-controls[data-panel="' + panel + '"]');
    els.forEach((el) => {
      if (view === 'routes') {
        el.classList.remove('d-none');
      } else {
        el.classList.add('d-none');
      }
    });
  }

  function renderPanels() {
    // Upstream
    if (viewModeUp === 'levels') {
      renderLevels('rt-upstream', cacheUpLevels || [], 'up');
    } else {
      renderTree('rt-upstream', cacheUpRoutes || [], 'up');
    }

    // Downstream
    if (viewModeDown === 'levels') {
      renderLevels('rt-downstream', cacheDownLevels || [], 'down');
    } else {
      renderTree('rt-downstream', cacheDownRoutes || [], 'down');
    }
  }

  function renderRoot(id) {
    const el = document.getElementById('rt-root');
    if (!el) return;

    if (isSuiteNode(id)) {
      const label = getLabelFor(id);
      el.innerHTML = `
        <div class="mb-2">
          <div class="mb-1 d-flex flex-wrap align-items-center gap-1">
            <span class="fw-semibold"><span>${escapeHtml(label)}</span></span>
          </div>
          <div class="text-muted small mb-1">Suite/collection nodes are not selectable as roots.</div>
        </div>
      `;
      return;
    }

    const d = docIndex[id] || {};
    const label = getRootLabelFor(id);
    const statusStr = getStatusFor(id);
    const statusIcon = buildStatusIcon(statusStr, 12);
    const hasProj = hasActiveProjectFor(id);
    const projIcon = buildProjectIcon(hasProj, 12);

    // Use raw and escaped versions for publisher and docType
    const rawPublisher = d && d.publisher ? String(d.publisher) : '';
    const rawDocType = d && d.docType ? String(d.docType) : '';

    const publisher = rawPublisher ? escapeHtml(rawPublisher) : '';
    const docType = rawDocType ? escapeHtml(rawDocType) : '';

    // Compose suiteTitle and titleText as per instructions
    const suiteTitle = (d && (d.docSuiteTitle || d.suiteTitle) ? String(d.docSuiteTitle || d.suiteTitle) : '').trim();
    const titleText = suiteTitle
      ? `${suiteTitle} - ${d && d.docTitle ? d.docTitle : label}`
      : (d && d.docTitle ? d.docTitle : label);

    const metaLine = (publisher || docType)
      ? `<div class="text-muted small mb-1">
           ${publisher
             ? `<a class="" href="../../docs/?f.publisher=${encodeURIComponent(rawPublisher)}">${publisher}</a>`
             : ''}
           ${publisher && docType ? ' • ' : ''}
           ${docType
             ? `<a class="" href="../../docs/?f.docType=${encodeURIComponent(rawDocType)}">${docType}</a>`
             : ''}
           ${statusStr ? ' • <span class="ms-1">[' + escapeHtml(statusStr) + ']</span>' : ''}
           ${statusIcon ? '<span class="ms-1">' + statusIcon + '</span>' : ''}
           ${projIcon ? '<span class="ms-1">' + projIcon + '</span>' : ''}
         </div>`
      : '';
    el.innerHTML = `
        <div class="mb-2">
          <div class="mb-1 d-flex flex-wrap align-items-center gap-1">
            <span><code>${escapeHtml(label)}</code></span>
            <span class="fw-semibold"><a class="" href="../../docs/${id}/">${escapeHtml(titleText)}</a></span>
          </div>
          ${metaLine}
        </div>
        <section class="mt-3 d-flex justify-content-between align-items-center gap-2">
          <span class="small text-muted">
            Click a document ID below to re-center the tree on that document.
          </span>
          <span class="text-nowrap">
            <a href="../${encodeURIComponent(id)}/"
               class="btn btn-outline-secondary btn-sm">
              Set as new root
            </a>
            <button type="button"
                    class="btn btn-outline-secondary btn-sm rt-recenter ms-1"
                    data-doc-id="${escapeHtml(ROOT_ID)}">
              Reset to starting root
            </button>
          </span>
        </section>
      `;
  }

  function reroot(id) {
    currentRoot = id;
    const depthSelect = document.getElementById('rt-depth-select');
    if (depthSelect) {
      depthSelect.value = (maxDepth === Number.MAX_SAFE_INTEGER) ? 'max' : String(maxDepth);
    }

    renderRoot(id);

    const effectiveDepth = maxDepth;

    // Recompute caches for this root
    cacheUpLevels = buildLevels(id, 'up', effectiveDepth);
    cacheDownLevels = buildLevels(id, 'down', effectiveDepth);
    cacheUpRoutes = buildRoutes(id, 'up', effectiveDepth);
    cacheDownRoutes = buildRoutes(id, 'down', effectiveDepth);

    // Render according to current view modes
    renderPanels();
  }

  async function init() {
    // Load effective docs and suites/collections metadata
    const [resDocs, resSuites] = await Promise.all([
      fetch(GRAPH_URL),
      fetch(SUITES_URL).catch(() => null)
    ]);

    const docs = await resDocs.json();

    let suitesPayload = null;
    try {
      if (resSuites && resSuites.ok) suitesPayload = await resSuites.json();
    } catch (e) {
      suitesPayload = null;
    }

    // Build suite/collection maps: slug -> children docIds, slug -> meta
    suiteChildrenBySlug = new Map();
    suiteMetaBySlug = new Map();

    const suitesArr = suitesPayload && typeof suitesPayload === 'object'
      ? (Array.isArray(suitesPayload.suites) ? suitesPayload.suites : [])
      : [];
    const collectionsArr = suitesPayload && typeof suitesPayload === 'object'
      ? (Array.isArray(suitesPayload.collections) ? suitesPayload.collections : [])
      : [];

    const pushChildren = (slug, ids) => {
      const s = String(slug || '').trim();
      if (!s) return;
      const arr = suiteChildrenBySlug.get(s) || [];
      (Array.isArray(ids) ? ids : []).forEach(x => {
        if (!x) return;
        const id = String(x).trim();
        if (id) arr.push(id);
      });
      suiteChildrenBySlug.set(s, Array.from(new Set(arr)));
    };

    // Suites: prefer allPartsLatestIds if present
    for (const s of suitesArr) {
      const slug = String(s && (s.suiteSlug || s.slug) || '').trim();
      if (!slug) continue;
      suiteMetaBySlug.set(slug, {
        kind: 'suite',
        publisher: s.publisher || '',
        number: s.number || '',
        title: s.suiteTitle || s.title || s.label || ''
      });
      const ids = Array.isArray(s.allPartsLatestIds) ? s.allPartsLatestIds
        : (Array.isArray(s.docIds) ? s.docIds : []);
      pushChildren(slug, ids);
    }

    // Collections: expect docIds (fallback to allPartsLatestIds if your collection builder uses it)
    for (const c of collectionsArr) {
      const slug = String(c && (c.collectionSlug || c.suiteSlug || c.slug) || '').trim();
      if (!slug) continue;
      suiteMetaBySlug.set(slug, {
        kind: 'collection',
        publisher: c.publisher || '',
        number: c.number || '',
        title: c.collectionTitle || c.suiteTitle || c.title || c.label || ''
      });
      const ids = Array.isArray(c.docIds) ? c.docIds
        : (Array.isArray(c.allPartsLatestIds) ? c.allPartsLatestIds : []);
      pushChildren(slug, ids);
    }

    // Build adjacency map { docId: { refsOut: [], refsIn: [] } } from effective documents snapshot
    refGraph = {};
    if (Array.isArray(docs)) {
      for (const d of docs) {
        if (!d || !d.docId) continue;
        const id = String(d.docId);
        docIndex[id] = d;

        const refsResolved = d.referencesResolved || {};
        const norm = Array.isArray(refsResolved.normative) ? refsResolved.normative : [];
        const bib  = Array.isArray(refsResolved.bibliographic) ? refsResolved.bibliographic : [];

        const refsOut = [];
        for (const r of norm) {
          if (!r) continue;
          const rid = typeof r === 'string' ? r : r.id;
          const isAllParts = (r && typeof r === 'object' && r.allParts === true && r.suiteSlug);

          if (isAllParts) {
            const sid = suiteNodeIdFromSlug(r.suiteSlug);
            if (sid) {
              refsOut.push(String(sid));
              // Ensure suite node exists and points to its children
              if (!refGraph[sid]) {
                refGraph[sid] = { refsOut: [], refsIn: [] };
              }
              const kids = suiteChildrenBySlug.get(String(r.suiteSlug).trim()) || [];
              refGraph[sid].refsOut = Array.from(new Set((Array.isArray(refGraph[sid].refsOut) ? refGraph[sid].refsOut : []).concat(kids.map(x => String(x)))));
            }
          } else {
            if (rid) refsOut.push(String(rid));
          }
        }
        for (const r of bib) {
          if (!r) continue;
          const rid = typeof r === 'string' ? r : r.id;
          const isAllParts = (r && typeof r === 'object' && r.allParts === true && r.suiteSlug);

          if (isAllParts) {
            const sid = suiteNodeIdFromSlug(r.suiteSlug);
            if (sid) {
              refsOut.push(String(sid));
              // Ensure suite node exists and points to its children
              if (!refGraph[sid]) {
                refGraph[sid] = { refsOut: [], refsIn: [] };
              }
              const kids = suiteChildrenBySlug.get(String(r.suiteSlug).trim()) || [];
              refGraph[sid].refsOut = Array.from(new Set((Array.isArray(refGraph[sid].refsOut) ? refGraph[sid].refsOut : []).concat(kids.map(x => String(x)))));
            }
          } else {
            if (rid) refsOut.push(String(rid));
          }
        }

        refGraph[id] = {
          refsOut: Array.from(new Set(refsOut)),
          refsIn: [],
        };
      }
    }

    // Recompute inbound edges from outbound edges so synthetic SUITE: nodes participate correctly
    for (const k of Object.keys(refGraph)) {
      if (refGraph[k]) refGraph[k].refsIn = [];
    }
    for (const fromId of Object.keys(refGraph)) {
      const out = (refGraph[fromId] && Array.isArray(refGraph[fromId].refsOut)) ? refGraph[fromId].refsOut : [];
      for (const toId of out) {
        if (!toId) continue;
        if (!refGraph[toId]) {
          refGraph[toId] = { refsOut: [], refsIn: [] };
        }
        refGraph[toId].refsIn.push(String(fromId));
      }
    }
    for (const k of Object.keys(refGraph)) {
      const arr = (refGraph[k] && Array.isArray(refGraph[k].refsIn)) ? refGraph[k].refsIn : [];
      refGraph[k].refsIn = Array.from(new Set(arr));
    }

    reroot(ROOT_ID);

    const depthSelect = document.getElementById('rt-depth-select');
    if (depthSelect) {
      // Initialize select from current maxDepth
      depthSelect.value = (maxDepth === Number.MAX_SAFE_INTEGER) ? 'max' : String(maxDepth);
      depthSelect.addEventListener('change', (ev) => {
        const raw = ev.target.value;
        if (raw === 'max') {
          maxDepth = Number.MAX_SAFE_INTEGER;
        } else {
          const val = parseInt(raw, 10);
          if (!Number.isNaN(val) && val > 0) {
            maxDepth = val;
          } else {
            maxDepth = MAX_DEPTH_DEFAULT;
          }
        }
        reroot(currentRoot);
      });
    }

    // Ensure collapse controls visibility matches initial view mode (levels by default)
    syncCollapseControls('up');
    syncCollapseControls('down');

    // Toggle between Simple (levels) and Expanded (routes) views per panel
    document.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.rt-view-toggle');
      if (!btn) return;

      ev.preventDefault();

      const panel = btn.getAttribute('data-panel');
      const view = btn.getAttribute('data-view');
      if (!panel || !view) return;

      if (panel === 'up') {
        viewModeUp = view;
      } else if (panel === 'down') {
        viewModeDown = view;
      }

      // Optional: update active styling
      const panelButtons = document.querySelectorAll('.rt-view-toggle[data-panel="' + panel + '"]');
      panelButtons.forEach(b => {
        if (b.getAttribute('data-view') === view) {
          b.classList.add('fw-semibold');
        } else {
          b.classList.remove('fw-semibold');
        }
      });

      // Show collapse/expand controls only in Expanded (routes) view
      syncCollapseControls(panel);

      renderPanels();;
    }, { passive: false });

    document.addEventListener('click', (ev) => {
      const a = ev.target.closest('.ref-node, .rt-recenter');
      if (!a) return;
      const id = a.getAttribute('data-doc-id');
      if (!id) return;
      if (isSuiteNode(id)) return;
      ev.preventDefault();
      reroot(id);
    }, { passive: false });

    document.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.rt-collapse-toggle');
      if (!btn) return;

      ev.preventDefault();

      const panel = btn.getAttribute('data-panel');
      const action = btn.getAttribute('data-action');
      if (!panel || !action) return;

      if (action === 'collapse') {
        collapseAll(panel);
      } else if (action === 'expand') {
        expandAll(panel);
      }
    }, { passive: false });

    document.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.rt-node-toggle');
      if (!btn) return;

      ev.preventDefault();

      const li = btn.closest('.rt-tree-item');
      if (!li) return;

      const nowCollapsed = li.classList.toggle('rt-tree-collapsed');
      btn.textContent = nowCollapsed ? '▸' : '▾';
    }, { passive: false });
  }

  init().catch(err => {
    console.error('[refTree] init failed:', err);
  });
})();