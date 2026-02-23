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
    for (const f of filterList) {
      if (f === url) return true;
      if (url.startsWith(f)) return true;
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
