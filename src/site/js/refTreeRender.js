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
 * refTreeRender.js — reference-tree graph walks and HTML rendering, shared by
 * the build (src/main/scripts/build.js renders each /reftree/{docId}/ page's
 * root card and Level 1 lists as static HTML) and the browser (refTree.js
 * renders deeper levels and the Expanded view from /reftree/_data/ref-graph.json).
 * One renderer keeps the static and client-rendered markup identical.
 *
 * Graph payload (built by src/main/lib/refGraph.js):
 *   { v: 1, nodes: [[id, label, status, flags, extra], ...], out: [[toIndex, ...], ...] }
 *   label/status are 0 when empty (label falls back to id). flags: FLAG_*.
 *   extra: MRI cite text (FLAG_EXTERNAL) or the resolved node's index (FLAG_RESOLVED).
 *   Only nodes with a tree page (registry, not FLAG_NOPAGE) render as links.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RefTreeRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FLAG_REGISTRY = 1;   // doc is in the registry
  const FLAG_PROJECT = 2;    // doc has open project/review work
  const FLAG_SUITE = 4;      // synthetic SUITE:{slug} node (all-parts reference)
  const FLAG_EXTERNAL = 8;   // not in the registry, but MRI has a citation for it
  const FLAG_RESOLVED = 16;  // MRI resolves this ref to another doc (extra = index)
  const FLAG_NOPAGE = 32;    // registry doc without a /reftree/ page (page-gated contentType)

  const SUITE_PREFIX = 'SUITE:';
  // Depth 3 on open; up to 6 on request. The graph saturates by about depth 6
  // (the densest docs reach ~16k nodes), so deeper adds almost nothing.
  const DEFAULT_DEPTH = 3;
  const MAX_DEPTH = 6;

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isSuiteNode(id) {
    return typeof id === 'string' && id.startsWith(SUITE_PREFIX);
  }

  /**
   * Decode the graph payload into { view(id), out(id), in(id) }.
   * view(id) → { id, label, status, inRegistry, project, suite, external, cite, resolvedId }.
   */
  function decodeGraph(payload) {
    const nodes = (payload && payload.nodes) || [];
    const outIdx = (payload && payload.out) || [];
    const ids = nodes.map(n => n[0]);
    const byId = new Map();
    const outs = new Map();
    const ins = new Map();
    nodes.forEach((n, i) => {
      const flags = n[3] || 0;
      byId.set(n[0], {
        id: n[0],
        label: n[1] || n[0],
        status: n[2] || '',
        inRegistry: !!(flags & FLAG_REGISTRY),
        hasPage: !!(flags & FLAG_REGISTRY) && !(flags & FLAG_NOPAGE),
        project: !!(flags & FLAG_PROJECT),
        suite: !!(flags & FLAG_SUITE),
        external: !!(flags & FLAG_EXTERNAL),
        cite: (flags & FLAG_EXTERNAL) && typeof n[4] === 'string' ? n[4] : '',
        resolvedId: (flags & FLAG_RESOLVED) && typeof n[4] === 'number' ? ids[n[4]] : null,
      });
    });
    outIdx.forEach((targets, i) => {
      if (!Array.isArray(targets) || !targets.length) return;
      const from = ids[i];
      const list = targets.map(t => ids[t]);
      outs.set(from, list);
      for (const to of list) {
        if (!ins.has(to)) ins.set(to, []);
        ins.get(to).push(from);
      }
    });
    return {
      view: id => byId.get(id) || unknownView(id),
      out: id => outs.get(id) || [],
      in: id => ins.get(id) || [],
    };
  }

  function unknownView(id) {
    return { id, label: id, status: '', inRegistry: false, hasPage: false, project: false, suite: isSuiteNode(id), external: false, cite: '', resolvedId: null };
  }

  /** Breadth-first levels: levels[k] = sorted ids first reached at depth k+1. */
  function buildLevels(graph, startId, direction, maxDepth) {
    const neighbors = direction === 'up' ? graph.in : graph.out;
    const levels = [];
    const visited = new Set([startId]);
    let frontier = [startId];
    for (let depth = 1; depth <= maxDepth; depth++) {
      const next = [];
      for (const id of frontier) {
        for (const n of neighbors(id)) {
          if (visited.has(n)) continue;
          visited.add(n);
          next.push(n);
        }
      }
      if (!next.length) break;
      levels.push(next.slice().sort());
      frontier = next;
    }
    return levels;
  }

  // Build a reference tree from a root, expanding each node's subtree at most ONCE
  // (per-node dedup). A node reached again — via another branch or a cycle — is shown as
  // a compact leaf (dedup:true) and not re-expanded. This keeps the tree O(V+E) instead of
  // O(number-of-root-to-leaf-paths), which exploded on the dense ref graph.
  function buildTreeDedup(graph, startId, direction, maxDepth) {
    const neighbors = direction === 'up' ? graph.in : graph.out;
    const expanded = new Set();
    function build(id, depth) {
      const node = { id, children: [] };
      if (depth >= maxDepth) return node;
      if (expanded.has(id)) { node.dedup = true; return node; }
      expanded.add(id);
      for (const n of neighbors(id).slice().sort()) {
        if (n === startId) continue; // don't loop back through the root
        node.children.push(build(n, depth + 1));
      }
      return node;
    }
    return build(startId, 0);
  }

  function statusIcon(statusStr, size) {
    const s = String(statusStr || '');
    if (s.includes('Active')) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" fill="#0c9c16" class="bi bi-check-circle-fill align-baseline" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>';
    }
    if (s.includes('Superseded') || s.includes('Withdrawn')) {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" fill="#ff0000" class="bi bi-slash-circle-fill align-baseline" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-4.646-2.646a.5.5 0 0 0-.708-.708l-6 6a.5.5 0 0 0 .708.708l6-6z"/></svg>';
    }
    return '';
  }

  function projectIcon(hasProject, size) {
    if (!hasProject) return '';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" fill="#F6BE00" class="bi bi-slash-circle-fill align-baseline" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-4.646-2.646a.5.5 0 0 0-.708-.708l-6 6a.5.5 0 0 0 .708.708l6-6z"/></svg>';
  }

  const wrap = (html) => html ? '<span class="ms-1">' + html + '</span>' : '';
  const statusTag = (s) => s ? '<span class="ms-1">[' + escapeHtml(s) + ']</span>' : '';
  const citeTag = (c) => c ? '<cite class="ms-1">' + escapeHtml(c) + '</cite>' : '';
  const EXTERNAL_BADGE = '<span class="badge text-bg-info ms-1">EXTERNAL</span>';
  const MISSING_BADGE = '<span class="badge text-bg-warning ms-1">NOT IN REGISTRY</span>';
  const treeHref = (id) => '../' + encodeURIComponent(id) + '/';

  // Only docs with their own tree page link to it; anything else is plain text.
  function docLink(id, label, muted, linked) {
    const cls = 'ref-node d-inline-flex align-items-center gap-1' + (muted ? ' text-muted fst-italic' : '');
    const inner = '<span>' + escapeHtml(label) + '</span>';
    return linked
      ? '<a href="' + treeHref(id) + '" class="' + cls + '" data-doc-id="' + escapeHtml(id) + '">' + inner + '</a>'
      : '<span class="' + cls + '">' + inner + '</span>';
  }

  function suiteChip(label) {
    return '<span class="ref-node d-inline-flex align-items-center gap-1" data-suite-node="1"><span>' +
      escapeHtml(label) + '</span></span>';
  }

  /** Inline HTML for one node (shared by the Simple and Expanded views). */
  function nodeHtml(graph, id) {
    const v = graph.view(id);
    if (v.suite) return suiteChip(v.label) + statusTag(v.status);
    if (v.resolvedId) {
      // MRI resolves this ref to a registry doc: render (and link) that doc.
      const r = graph.view(v.resolvedId);
      return docLink(r.id, r.label, false, r.hasPage) + statusTag(r.status) + wrap(statusIcon(r.status, 10));
    }
    // MRI-known external ref: unlinked (there's no tree page). Show its citation;
    // keep a real identifier as text, but not an internal orphan/… slug.
    if (v.external) {
      const showId = !v.cite || !id.startsWith('orphan/');
      return (showId ? docLink(id, v.label, true, false) : '') + citeTag(v.cite) + EXTERNAL_BADGE;
    }
    return docLink(id, v.label, !v.inRegistry, v.hasPage) +
      statusTag(v.status) +
      (v.inRegistry ? '' : MISSING_BADGE) +
      wrap(statusIcon(v.status, 10)) +
      wrap(projectIcon(v.project, 10));
  }

  function levelHeading(depth, direction) {
    if (direction === 'up') {
      return depth === 0 ? 'Level 1 — direct dependents (docs that cite this doc)'
        : 'Level ' + (depth + 1) + ' — dependents of Level ' + depth;
    }
    return depth === 0 ? 'Level 1 — direct references (docs this doc cites)'
      : 'Level ' + (depth + 1) + ' — references of Level ' + depth;
  }

  /** Simple view: one heading + list per level. */
  function renderLevelsHtml(graph, levels, direction) {
    if (!levels.length) return '<p class="text-muted mb-0">No entries.</p>';
    let html = '';
    levels.forEach((ids, depth) => {
      html += '<div class="fw-semibold mb-1 mt-2 rt-level-heading rt-level-heading-' + direction + '">' +
        escapeHtml(levelHeading(depth, direction)) + '</div>';
      html += '<ul class="list-unstyled ms-3 rt-level-list rt-level-list-' + direction + '">';
      for (const id of ids) html += '<li>' + nodeHtml(graph, id) + '</li>';
      html += '</ul>';
    });
    return html;
  }

  /** Expanded view: the dedup'd route tree, without the root itself. */
  function renderTreeHtml(graph, tree, direction) {
    if (!tree || !tree.children || !tree.children.length) return '<p class="text-muted mb-0">No entries.</p>';
    function renderNode(node) {
      const hasChildren = node.children && node.children.length;
      let html = '<li class="rt-tree-item rt-tree-item-' + direction + '"><div class="rt-node d-inline-flex align-items-center gap-1">' +
        (hasChildren
          ? '<button type="button" class="btn btn-link btn-sm p-0 rt-node-toggle" aria-label="Toggle children" title="Toggle children">▾</button>'
          : '<span class="rt-node-toggle-spacer"></span>') +
        nodeHtml(graph, node.id) +
        (node.dedup ? '<span class="rt-dedup text-muted ms-1" title="Subtree already expanded above">⤴</span>' : '') +
        '</div>';
      if (hasChildren) {
        html += '<ul class="list-unstyled rt-tree-children rt-tree-children-' + direction + '">' +
          node.children.map(renderNode).join('') + '</ul>';
      }
      return html + '</li>';
    }
    return '<ul class="rt-tree list-unstyled rt-tree-' + direction + '">' + tree.children.map(renderNode).join('') + '</ul>';
  }

  return {
    FLAG_REGISTRY, FLAG_PROJECT, FLAG_SUITE, FLAG_EXTERNAL, FLAG_RESOLVED, FLAG_NOPAGE,
    SUITE_PREFIX, DEFAULT_DEPTH, MAX_DEPTH,
    escapeHtml, isSuiteNode, decodeGraph, buildLevels, buildTreeDedup,
    statusIcon, projectIcon, nodeHtml, renderLevelsHtml, renderTreeHtml,
  };
});
