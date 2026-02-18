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

function createSmpteDiscovery({ axios, cheerio, options = {} }) {
  const rootUrl = options.rootUrl;
  const filterEnabled = options.filterEnabled !== false;
  const filterPath = options.filterPath;
  if (!rootUrl) throw new Error('createSmpteDiscovery requires options.rootUrl');
  if (!filterPath) throw new Error('createSmpteDiscovery requires options.filterPath');
  const filterList = loadJsonArray(filterPath);
  const suiteMap = new Map();
  const noCacheHeaders = { 'Cache-Control': 'no-cache', Pragma: 'no-cache' };

  function normalizeSeedUrl(u) {
    try {
      const url = new URL(u);
      url.protocol = 'https:';
      url.hash = '';
      url.search = '';
      let s = url.toString();
      if (!s.endsWith('/')) s += '/';
      return s;
    } catch (_) {
      return u;
    }
  }

  function withNoCache(u) {
    try {
      const url = new URL(u);
      const q = url.search ? '&' : '';
      url.search += `${q}nocache=${Date.now()}`;
      return url.toString();
    } catch (_) {
      return u + (u.includes('?') ? '&' : '?') + `nocache=${Date.now()}`;
    }
  }

  function shouldFilterUrl(url) {
    if (!filterEnabled) return false;
    for (const f of filterList) {
      if (f === url) return true;
      if (url.startsWith(f)) return true;
      if (suiteMap.has(f)) {
        const children = suiteMap.get(f) || [];
        if (children.some(child => child === url || url.startsWith(child))) return true;
      }
    }
    return false;
  }

  function printUrlsSuiteWithChildren(label, urls) {
    if (!urls.length) return;

    console.groupCollapsed(
      `${label}: ${urls.length}  (Suites: ${urls.filter(u => suiteMap.has(u)).length}, Docs: ${urls.filter(u => !suiteMap.has(u)).length})`
    );

    const printed = new Set();

    const emit = (url) => {
      const isSuite = suiteMap.has(url);
      let reason = '';
      for (const [suiteUrl, children] of suiteMap.entries()) {
        if (children.includes(url)) {
          reason = ` (Doc within ${label.toLowerCase().includes('queued') ? 'queued' : 'filtered'} suite: ${suiteUrl})`;
          break;
        }
      }
      console.log(`    - ${url}${isSuite ? ' [SUITE]' : ''}${reason}`);
      printed.add(url);
    };

    for (const url of urls) {
      if (printed.has(url)) continue;

      if (suiteMap.has(url)) {
        emit(url);
        const children = suiteMap.get(url) || [];
        for (const child of children) {
          if (urls.includes(child) && !printed.has(child)) emit(child);
        }
      } else {
        let skip = false;
        for (const [suiteUrl, children] of suiteMap.entries()) {
          if (children.includes(url) && urls.includes(suiteUrl)) {
            skip = true;
            break;
          }
        }
        if (!skip) emit(url);
      }
    }

    console.groupEnd();
  }

  function filterDiscoveredDocs(allDocs) {
    const queued = [];
    const filtered = [];

    for (const { url: docUrl, suite } of allDocs) {
      if (!filterEnabled) {
        queued.push(docUrl);
        continue;
      }

      const inList = filterList.some(f => {
        if (f === docUrl) return true;
        if (suite && f === suite) return true;
        if (docUrl.startsWith(f)) return true;
        return false;
      });

      if (inList) filtered.push(docUrl);
      else queued.push(docUrl);
    }

    if (filterEnabled) {
      const filteredSuites = filterList.filter(f => suiteMap.has(f));
      for (const suiteUrl of filteredSuites) {
        const children = suiteMap.get(suiteUrl) || [];
        for (const childUrl of children) {
          if (!filtered.includes(childUrl) && queued.includes(childUrl)) {
            filtered.push(childUrl);
            const idx = queued.indexOf(childUrl);
            if (idx !== -1) queued.splice(idx, 1);
          }
        }
      }
    }

    const suiteCount = allDocs.filter(d => suiteMap.has(d.url)).length;
    const docCount = allDocs.length - suiteCount;
    console.log('\n\n📊 Discovery Filtering Stats (URLs):');
    console.log(`  Total found: ${allDocs.length}  (Suites: ${suiteCount}, Docs: ${docCount})`);
    printUrlsSuiteWithChildren('  Queued', queued);
    printUrlsSuiteWithChildren('  Filtered', filtered);

    return queued;
  }

  async function discoverFromRootDocPage() {
    console.log(`\n🔍 Fetching SMPTE root doc list: ${rootUrl}`);

    const res = await axios.get(withNoCache(rootUrl), { headers: noCacheHeaders });
    const $ = cheerio.load(res.data);

    const allDocs = [];
    const topLevel = [];

    $('li.doc > div > a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('/doc/')) topLevel.push(new URL(href, rootUrl).href);
    });

    for (const url of topLevel) {
      try {
        const page = await axios.get(url);
        const $page = cheerio.load(page.data);

        if ($page('ul.versions').length) {
          console.log(`📄 DOC: ${url}`);
          allDocs.push({ url, suite: null });
        } else if ($page('ul.docs').length) {
          console.log(`📚 SUITE: ${url}`);
          const children = [];
          $page('ul.docs li.doc a').each((i, el) => {
            const href = $page(el).attr('href');
            if (href && href.startsWith('/doc/')) {
              const childUrl = new URL(href, rootUrl).href;
              console.log(`   ↳ Found doc in suite: ${childUrl}`);
              children.push(childUrl);
              allDocs.push({ url: childUrl, suite: url });
            }
          });
          suiteMap.set(url, children);
          allDocs.push({ url, suite: null });
        } else {
          console.log(`❓ UNKNOWN TYPE: ${url}`);
        }
      } catch (err) {
        console.warn(`⚠️ Failed to inspect ${url}: ${err.message}`);
      }
    }

    console.log(`🔍 Discovered ${allDocs.length} doc URLs from root (after suite expansion)`);
    return filterDiscoveredDocs(allDocs);
  }

  return {
    discoverFromRootDocPage,
    normalizeSeedUrl,
    shouldFilterUrl
  };
}

module.exports = { createSmpteDiscovery };
