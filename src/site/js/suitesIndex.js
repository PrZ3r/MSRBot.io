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

// Suites index: cards are rendered at build time (src/main/lib/sitePages.js,
// issue #2555); this script filters them by text, publisher and kind.
(function () {
  const container = document.getElementById('suite-list');
  const searchInput = document.getElementById('suiteSearch');
  const publisherSelect = document.getElementById('suitePublisherFilter');
  const kindSelect = document.getElementById('suiteKindFilter');
  const emptyEl = document.getElementById('suite-list-empty');
  if (!container) return;
  const cards = Array.from(container.children);

  function applyFilters() {
    const term = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase();
    const pub = publisherSelect ? publisherSelect.value.trim() : '';
    const kind = kindSelect ? kindSelect.value.trim() : '';
    let shown = 0;
    for (const card of cards) {
      const ok = (!pub || card.getAttribute('data-publisher') === pub)
        && (!kind || card.getAttribute('data-kind') === kind)
        && (!term || (card.getAttribute('data-search') || '').includes(term));
      card.classList.toggle('d-none', !ok);
      if (ok) shown++;
    }
    if (emptyEl) emptyEl.classList.toggle('d-none', shown > 0);
  }

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (publisherSelect) publisherSelect.addEventListener('change', applyFilters);
  if (kindSelect) kindSelect.addEventListener('change', applyFilters);
  applyFilters();
})();
