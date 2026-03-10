/*
Copyright (c) 2025-26 Steve LLamb (https://github.com/SteveLLamb) and PrZ3(https://github.com/PrZ3r)

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

const fs = require('fs');

function loadJsonArray(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createIetfDiscovery({ options = {} }) {
  const seedFirst = options.seedFirst !== false;
  const filterEnabled = options.filterEnabled !== false;
  const filterPath = options.filterPath;
  const filterList = filterPath ? loadJsonArray(filterPath) : [];

  function normalizeSeedUrl(u) {
    try {
      const url = new URL(u);
      url.protocol = 'https:';
      url.hash = '';
      url.search = '';
      let s = url.toString();
      const fileLike = /\/[^/]+\.[A-Za-z0-9]{1,8}$/.test(url.pathname || '');
      if (fileLike) {
        s = s.replace(/\/$/, '');
      } else if (!s.endsWith('/')) {
        s += '/';
      }
      return s;
    } catch (_) {
      return u;
    }
  }

  function shouldFilterUrl(url) {
    if (!filterEnabled) return false;
    const normalizedUrl = normalizeSeedUrl(url);
    for (const f of filterList) {
      const rawFilter = String(f || '');
      const normalizedFilter = normalizeSeedUrl(rawFilter);
      if (normalizedFilter === normalizedUrl) return true;
      // Prefix filtering must be explicit (trailing slash), otherwise we can
      // accidentally block RFC8615 via an RFC861 entry, etc.
      if (rawFilter.endsWith('/') && normalizedUrl.startsWith(normalizedFilter)) return true;
    }
    return false;
  }

  async function discoverFromRootDocPage() {
    if (seedFirst) {
      console.log('\n🔍 IETF discovery in seed-first mode (root discovery skipped)');
      return [];
    }
    console.log('\n🔍 IETF discovery currently supports seed-first mode only');
    return [];
  }

  return {
    discoverFromRootDocPage,
    normalizeSeedUrl,
    shouldFilterUrl
  };
}

module.exports = { createIetfDiscovery };
