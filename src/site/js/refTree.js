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

// Reference tree page. The build renders the root card and Level 1 of both
// panels as static HTML (issue #2555); this script loads the build-time graph
// (/reftree/_data/ref-graph.json) and renders deeper levels, the Expanded
// (routes) view and the depth selector with the same renderer
// (refTreeRender.js). Clicking a node opens that node's own tree page.
(function () {
  const R = window.RefTreeRender;
  const ROOT_ID = window.MSR_REF_ROOT;
  const GRAPH_URL = (window.assetPrefix || '') + 'reftree/_data/ref-graph.json';

  let graph = null;
  let maxDepth = R.MAX_DEPTH;
  const viewMode = { up: 'levels', down: 'levels' };
  const panelId = { up: 'rt-upstream', down: 'rt-downstream' };

  function renderPanel(dir) {
    const el = document.getElementById(panelId[dir]);
    if (!el || !graph) return;
    el.innerHTML = viewMode[dir] === 'levels'
      ? R.renderLevelsHtml(graph, R.buildLevels(graph, ROOT_ID, dir, maxDepth), dir)
      : R.renderTreeHtml(graph, R.buildTreeDedup(graph, ROOT_ID, dir, maxDepth), dir);
  }

  function renderPanels() {
    renderPanel('up');
    renderPanel('down');
  }

  function setCollapsed(dir, collapsed) {
    const container = document.getElementById(panelId[dir]);
    if (!container) return;
    container.querySelectorAll('.rt-tree-item').forEach((li) => {
      if (!li.querySelector('.rt-tree-children')) return;
      li.classList.toggle('rt-tree-collapsed', collapsed);
      const btn = li.querySelector('.rt-node-toggle');
      if (btn) btn.textContent = collapsed ? '▸' : '▾';
    });
  }

  function syncCollapseControls(dir) {
    document.querySelectorAll('.rt-collapse-controls[data-panel="' + dir + '"]').forEach((el) => {
      el.classList.toggle('d-none', viewMode[dir] !== 'routes');
    });
  }

  function setControlsEnabled(enabled) {
    document.querySelectorAll('.rt-view-toggle, #rt-depth-select').forEach((el) => { el.disabled = !enabled; });
  }

  async function init() {
    setControlsEnabled(false);
    const res = await fetch(GRAPH_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + GRAPH_URL);
    graph = R.decodeGraph(await res.json());
    setControlsEnabled(true);
    renderPanels();

    const depthSelect = document.getElementById('rt-depth-select');
    if (depthSelect) {
      depthSelect.value = String(maxDepth);
      depthSelect.addEventListener('change', (ev) => {
        const val = parseInt(ev.target.value, 10);
        // Hard cap at MAX_DEPTH — deeper trees overload the page on the dense
        // ref graph; to explore further, open a node's own tree.
        maxDepth = (!Number.isNaN(val) && val > 0) ? Math.min(val, R.MAX_DEPTH) : R.MAX_DEPTH;
        renderPanels();
      });
    }

    syncCollapseControls('up');
    syncCollapseControls('down');

    document.addEventListener('click', (ev) => {
      const viewBtn = ev.target.closest('.rt-view-toggle');
      if (viewBtn) {
        ev.preventDefault();
        const dir = viewBtn.getAttribute('data-panel');
        const view = viewBtn.getAttribute('data-view');
        if (!panelId[dir] || !view) return;
        viewMode[dir] = view;
        document.querySelectorAll('.rt-view-toggle[data-panel="' + dir + '"]').forEach((b) => {
          b.classList.toggle('fw-semibold', b.getAttribute('data-view') === view);
        });
        syncCollapseControls(dir);
        renderPanel(dir);
        return;
      }
      const collapseBtn = ev.target.closest('.rt-collapse-toggle');
      if (collapseBtn) {
        ev.preventDefault();
        const dir = collapseBtn.getAttribute('data-panel');
        if (panelId[dir]) setCollapsed(dir, collapseBtn.getAttribute('data-action') === 'collapse');
        return;
      }
      const nodeBtn = ev.target.closest('.rt-node-toggle');
      if (nodeBtn) {
        ev.preventDefault();
        const li = nodeBtn.closest('.rt-tree-item');
        if (!li) return;
        const nowCollapsed = li.classList.toggle('rt-tree-collapsed');
        nodeBtn.textContent = nowCollapsed ? '▸' : '▾';
      }
    }, { passive: false });
  }

  init().catch((err) => {
    console.error('[refTree] init failed:', err);
    const note = document.getElementById('rt-graph-note');
    if (note) {
      note.textContent = 'Deeper levels could not be loaded; showing direct references only.';
      note.classList.remove('d-none');
    }
  });
})();
