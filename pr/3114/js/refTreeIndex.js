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

(function () {
  var form = document.getElementById('rt-search-form');
  var input = document.getElementById('rt-docid');
  var errorEl = document.getElementById('rt-search-error');
  var resultsEl = document.getElementById('rt-search-results');

  // Search lookup rows [docId, docLabel, title] (built at build time, #2555).
  // The most-connected list is static HTML; the lookup loads on first use.
  var registryDocs = null;
  var registryPromise = null;

  function normalizeCompact(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[–—\-]+/g, '-') // normalize dashes
      .replace(/\./g, '');
  }

  // Simple HTML-escape helper for safe rendering
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function loadLookup() {
    if (registryPromise) return registryPromise;
    registryPromise = fetch('_data/lookup.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (rows) {
        registryDocs = (Array.isArray(rows) ? rows : []).map(function (r) {
          return { docId: r[0], docLabel: r[1] || '', title: r[2] || '' };
        });
        return registryDocs;
      })
      .catch(function (err) {
        console.error('[refTreeIndex] Failed to load lookup.json:', err);
        registryDocs = [];
        return registryDocs;
      });
    return registryPromise;
  }

  function clearSearchMessages() {
    if (errorEl) {
      errorEl.classList.add('d-none');
      errorEl.textContent = '';
    }
    if (resultsEl) {
      resultsEl.innerHTML = '';
      resultsEl.classList.add('d-none');
    }
  }

  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove('d-none');
  }

  function showSuggestions(query, matches) {
    if (!resultsEl) return;
    if (!matches || !matches.length) {
      resultsEl.innerHTML = '<div class="text-muted fst-italic">Try a different docId, label, or part of the title.</div>';
      resultsEl.classList.remove('d-none');
      return;
    }

    var html = '<div class="fw-semibold mb-1">Multiple matches found for "<span class="fst-italic">' +
      escapeHtml(query) +
      '</span>":</div>';
    html += '<ul class="list-unstyled mb-0">';
    matches.slice(0, 10).forEach(function (m) {
      html += '<li class="mb-1">';
      html += '<a href="../reftree/' + encodeURIComponent(m.id) + '/">' +
        escapeHtml(m.label || m.id) +
        '</a>';
      if (m.title) {
        html += '<div class="text-muted small">' + escapeHtml(m.title) + '</div>';
      }
      html += '</li>';
    });
    if (matches.length > 10) {
      html += '<li class="mt-2">';
      html += '<button type="button" id="rt-show-all" class="btn btn-outline-secondary btn-sm">';
      html += 'Show all ' + matches.length + ' matches';
      html += '</button>';
      html += '</li>';
    }
    html += '</ul>';
    resultsEl.innerHTML = html;
    resultsEl.classList.remove('d-none');

    var btn = resultsEl.querySelector('#rt-show-all');
    if (btn) {
      btn.addEventListener('click', function () {
        var fullHtml = '<div class="fw-semibold mb-1">Showing all ' +
          matches.length + ' matches for "<span class="fst-italic">' +
          escapeHtml(query) +
          '</span>":</div>';
        fullHtml += '<ul class="list-unstyled mb-0">';
        matches.forEach(function (m) {
          fullHtml += '<li class="mb-1">';
          fullHtml += '<a href="../reftree/' + encodeURIComponent(m.id) + '/">' +
            escapeHtml(m.label || m.id) +
            '</a>';
          if (m.title) {
            fullHtml += '<div class="text-muted small">' + escapeHtml(m.title) + '</div>';
          }
          fullHtml += '</li>';
        });
        fullHtml += '</ul>';
        resultsEl.innerHTML = fullHtml;
      });
    }
  }

  function scoreDocAgainstQuery(doc, query, queryCompact) {
    var id = String(doc.docId || '');
    var displayTitle = doc.title;
    var label = String(doc.docLabel || displayTitle || id);
    var title = String(displayTitle || '');

    var idLower = id.toLowerCase();
    var labelLower = label.toLowerCase();
    var titleLower = title.toLowerCase();
    var idCompact = normalizeCompact(id);
    var labelCompact = normalizeCompact(label);
    var titleCompact = normalizeCompact(title);

    // Exact-style matches first
    if (idLower === query) return 100;
    if (labelLower === query) return 95;
    if (titleLower === query) return 90;

    // Compact matches (handles spaces vs dots vs dashes)
    if (idCompact === queryCompact) return 85;
    if (labelCompact === queryCompact) return 80;
    if (titleCompact === queryCompact) return 78;

    // Substring matches in label/title
    if (labelLower.indexOf(query) !== -1) return 70;
    if (titleLower.indexOf(query) !== -1) return 65;

    // Substring match in docId as a weaker signal
    if (idLower.indexOf(query) !== -1) return 60;

    return 0;
  }

  function findBestMatches(rawQuery) {
    if (!Array.isArray(registryDocs) || !registryDocs.length) return [];

    var q = String(rawQuery || '').trim().toLowerCase();
    if (!q) return [];

    var qCompact = normalizeCompact(q);
    var scored = [];

    for (var i = 0; i < registryDocs.length; i++) {
      var d = registryDocs[i];
      if (!d || !d.docId) continue;
      var displayTitle = d.title;
      var s = scoreDocAgainstQuery(d, q, qCompact);
      if (s > 0) {
        scored.push({
          score: s,
          id: d.docId,
          label: d.docLabel || displayTitle || d.docId,
          title: displayTitle
        });
      }
    }

    if (!scored.length) return [];

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id);
    });

    return scored;
  }

  function handleSearchSubmit(evt) {
    evt.preventDefault();
    if (!input) return;

    var raw = (input.value || '').trim();
    clearSearchMessages();

    if (!raw) {
      showError('Please enter something to search');
      return;
    }

    loadLookup().then(function () {
      if (!Array.isArray(registryDocs) || !registryDocs.length) {
        showError('Registry data is not available yet. Try again after the page finishes loading.');
        return;
      }

      var matches = findBestMatches(raw);
      if (!matches.length) {
        showError('No matching documents found.');
        showSuggestions(raw, []);
        return;
      }

      // If there is exactly one clear match, go straight to it.
      if (matches.length === 1 || (matches[0].score >= 90 && (matches.length === 1 || matches[0].score > matches[1].score))) {
        var targetId = matches[0].id;
        var target = encodeURIComponent(targetId) + '/';
        window.location.assign(target);
        return;
      }

      // Otherwise, present choices to the user and avoid 404s.
      showSuggestions(raw, matches);
    });
  }

  if (form && input) {
    form.addEventListener('submit', handleSearchSubmit);
    input.addEventListener('focus', loadLookup, { once: true });
  }
})();