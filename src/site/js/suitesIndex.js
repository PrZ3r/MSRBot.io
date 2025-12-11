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

(async function () {
  try {
    // Always from /suites/_data/suites.json relative to site root
    const resp = await fetch('_data/suites.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const suites = await resp.json();

    const container = document.getElementById('suite-list');
    const searchInput = document.getElementById('suiteSearch');
    const publisherSelect = document.getElementById('suitePublisherFilter');

    if (!container) return;

    // Sort base data: by publisher then number
    suites.sort((a, b) => {
      const ap = a.publisher || '';
      const bp = b.publisher || '';
      if (ap !== bp) return ap.localeCompare(bp);
      const an = a.number || '';
      const bn = b.number || '';
      const ai = parseInt(an, 10);
      const bi = parseInt(bn, 10);
      if (!Number.isNaN(ai) && !Number.isNaN(bi)) return ai - bi;
      return an.localeCompare(bn);
    });

    // Populate publisher filter options from data
    if (publisherSelect) {
      const pubs = Array.from(
        new Set(
          suites
            .map(s => s.publisher || '')
            .filter(p => p && p.trim().length > 0)
        )
      ).sort((a, b) => a.localeCompare(b));

      // Start with "All publishers"
      publisherSelect.innerHTML = '<option value=\"\">All publishers</option>' +
        pubs.map(p => `<option value="${p}">${p}</option>`).join('');
    }

    function renderSuites(list) {
      container.innerHTML = '';
      for (const s of list) {
        const slug = s.suiteSlug || '';
        const pub = s.publisher || '';
        const num = s.number || '';
        const parts = Array.isArray(s.parts) ? s.parts : [];

        // Suite label is publisher + number (type-agnostic)
        const label = `${pub} ${num}`.trim();
        const href = slug ? `${encodeURIComponent(slug)}/` : '#';

        const el = document.createElement('div');
        el.className = 'col';
        el.innerHTML = `
          <div class="card h-100">
            <div class="card-body">
              <h2 class="h6 card-title mb-1">
                <a href="${href}" class="stretched-link text-decoration-none">${label}</a>
              </h2>
              <div class="text-muted small">
                Parts: ${parts.length ? parts.join(', ') : '–'}
              </div>
            </div>
          </div>
        `;
        container.appendChild(el);
      }
    }

    function applyFilters() {
      const term = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase();
      const pubFilter = (publisherSelect && publisherSelect.value ? publisherSelect.value : '').trim();

      const filtered = suites.filter(s => {
        const pub = s.publisher || '';
        const num = s.number || '';
        if (pubFilter && pub !== pubFilter) return false;

        if (term) {
          const haystack = `${pub} ${num}`.toLowerCase();
          return haystack.includes(term);
        }
        return true;
      });

      renderSuites(filtered);
    }

    if (searchInput) {
      searchInput.addEventListener('input', applyFilters);
    }
    if (publisherSelect) {
      publisherSelect.addEventListener('change', applyFilters);
    }

    // Initial render with no filters
    applyFilters();
  } catch (err) {
    console.error('[suitesIndex] Failed to load suites', err);
  }
})();