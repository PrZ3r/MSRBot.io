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

// Portal pages are rendered at build time (src/main/lib/sitePages.js, issue
// #2555). This script handles the More/Less toggles and filters/sorts the
// static docs table using each row's data-* keys.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // Abstract (same semantics as suites) and resource description toggles.
  document.addEventListener('click', function (e) {
    const abs = e.target.closest('.suite-abstract-toggle');
    if (abs) {
      const container = abs.closest('.suite-abstract');
      if (!container) return;
      const full = container.getAttribute('data-state') !== 'full';
      const shortSpan = container.querySelector('.suite-abstract-short');
      const fullSpan = container.querySelector('.suite-abstract-full');
      if (shortSpan) shortSpan.classList.toggle('d-none', full);
      if (fullSpan) fullSpan.classList.toggle('d-none', !full);
      container.setAttribute('data-state', full ? 'full' : 'short');
      abs.textContent = full ? 'Less' : 'More';
      return;
    }
    const res = e.target.closest('.portal-resource-toggle');
    if (res) {
      const container = res.closest('.portal-resource-descwrap');
      if (!container) return;
      const full = container.getAttribute('data-state') !== 'full';
      const desc = container.querySelector('.portal-resource-desc');
      if (desc) desc.classList.toggle('is-expanded', full);
      container.setAttribute('data-state', full ? 'full' : 'short');
      res.textContent = full ? 'Less' : 'More';
    }
  });

  const body = $('portal-docs-body');
  if (!body) return;
  const rows = Array.from(body.querySelectorAll('tr'));
  const searchInput = $('portalDocSearch');
  const publisherSelect = $('portalPublisherFilter');
  const typeSelect = $('portalTypeFilter');
  const sortSelect = $('portalSort');
  const countEl = $('portal-doc-count');
  const emptyEl = $('portal-docs-empty');

  const base = { sensitivity: 'base' };
  const numeric = { numeric: true, sensitivity: 'base' };
  const attr = (row, k) => row.getAttribute('data-' + k) || '';
  const normalize = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

  function compare(key) {
    if (key === 'published') {
      // YYYY-MM-DD strings; unknown dates sort last.
      return (a, b) => {
        const ad = attr(a, 'published');
        const bd = attr(b, 'published');
        if (!ad || !bd) return (!ad && !bd) ? 0 : (!ad ? 1 : -1);
        return ad.localeCompare(bd);
      };
    }
    const field = { title: 'title', doctype: 'doctype', publisher: 'publisher', status: 'status' }[key];
    if (field) return (a, b) => attr(a, field).localeCompare(attr(b, field), undefined, base);
    return (a, b) => attr(a, 'label').localeCompare(attr(b, 'label'), undefined, numeric);
  }

  function apply() {
    const term = normalize(searchInput && searchInput.value);
    const pub = publisherSelect ? publisherSelect.value.trim() : '';
    const type = typeSelect ? typeSelect.value.trim() : '';
    const [key, dir] = String((sortSelect && sortSelect.value) || 'label:asc').split(':');
    const cmp = compare(key);
    const sorted = rows.slice().sort((a, b) => (dir === 'desc' ? -cmp(a, b) : cmp(a, b)));
    let shown = 0;
    for (const row of sorted) {
      const ok = (!pub || attr(row, 'publisher') === pub)
        && (!type || attr(row, 'doctype') === type)
        && (!term || attr(row, 'search').includes(term));
      row.classList.toggle('d-none', !ok);
      if (ok) shown++;
      body.appendChild(row);
    }
    if (countEl) countEl.textContent = 'Showing ' + shown + ' / ' + rows.length + ' docs';
    if (emptyEl) emptyEl.classList.toggle('d-none', shown > 0);
  }

  if (searchInput) searchInput.addEventListener('input', apply);
  [publisherSelect, typeSelect, sortSelect].forEach((el) => { if (el) el.addEventListener('change', apply); });
})();
