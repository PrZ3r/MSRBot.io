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

// testing versioning

const axios = require('axios');
const { resolveUrlAndInject, urlReachable } = require('./url.resolve.js');
const { getPrLogPath } = require('./utils/prLogPath');
const { logSmart, heartbeat } = require('./utils/logSmart');
const prLogPath = getPrLogPath();
const cheerio = require('cheerio');
const dayjs = require('dayjs');
const fs = require('fs');
const { execSync } = require('child_process');
const { getProvider, listProviders } = require('./providers');

// --- Hashing for extractor script versioning ---
const crypto = require('crypto');
// Fingerprint this extractor build by commit; stamped into $meta.version on create/change only.
const SCRIPT_VERSION = (() => {
  // 1) Prefer CI-provided SHA (e.g., GitHub Actions)
  const envSha = (process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').trim();
  if (envSha) return `extractDocs.js@commit:${envSha.slice(0, 12)}`;
  try {
    // 2) Try local git (works in dev and most runners with .git present)
    const gitHash = execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (gitHash) return `extractDocs.js@commit:${gitHash}`;
  } catch (_) {
    // ignore and fall through
  }
  try {
    // 3) Last-resort fallback to file-content fingerprint
    const fileHash = crypto.createHash('sha256')
      .update(fs.readFileSync(__filename))
      .digest('hex')
      .slice(0, 12);
    return `extractDocs.js@script:${fileHash}`;
  } catch {
    return 'extractDocs.js@commit:unknown';
  }
})();

// Generate timestamp string in format YYYYMMDD-HHmmss
const timestamp = dayjs().format('YYYYMMDD-HHmmss');
const fullDetailsPath = `src/main/logs/extract-runs/pr-log-full-${timestamp}.log`;
const badRefsLatestPath = `src/main/reports/badRefs.latest.json`;
// Raw URL (kept for logging/diagnostics)
const detailsFileRawUrl = `https://raw.githubusercontent.com/PrZ3r/MSRBot.io/main/${fullDetailsPath}`;

const { parseRefId, extractRefs, mapRefByCite, mriFlush, mriEnsureFile, mriPruneToSightings } = require('../lib/referencing');

// Guard to avoid double logging/flushing MRI on multiple exit signals
let _mriFlushedOnce = false;
let _mriPreFlushed = false;  
let _mriPreFlushResult = null;

// Ensure MRI file exists even if this run skips all documents
try { mriEnsureFile(); } catch (_) {}

// Ensure MRI is flushed at process end — even if all docs were filtered/skipped.
// This writes only when _dirty=true (i.e., sightings recorded) or the file is missing.
function _flushMRIOnExit(label) {
  try {
    if (_mriFlushedOnce) return;

    // Reuse pre-flush result if present; otherwise do a real flush now
    const res = (_mriPreFlushed && _mriPreFlushResult) ? _mriPreFlushResult : mriFlush({ force: false });

    if (res.wrote) {
      _mriFlushedOnce = true;
      console.log(`🧠 MRI updated (${label}) — uniqueRefIds=${res.uniqueRefIds}, orphans=${res.orphanCount}: ${res.path}`);
      // Minimal PR note for MRI-only or MRI-also updates
      try {
        const line = `\n### 🧠 MRI updated (${label}) — uniqueRefIds=${res.uniqueRefIds}, orphans=${res.orphanCount}`;
        fs.appendFileSync(prLogPath, line + '\n', 'utf8');
        fs.appendFileSync(fullDetailsPath, line + '\n', 'utf8');
      } catch (e2) {
        console.warn(`⚠️ Failed to append MRI update to PR log: ${e2.message}`);
      }
      return;
    }

    if (label !== 'exit') {
      if (res.reason === 'timestamp-only') {
        console.log(`🧠 MRI skipped write (${label}) — only generatedAt would have changed`);
        try {
          const prLine = `\n### 🧠 MRI skipped write (${label}) — only generatedAt would have changed`;
          fs.appendFileSync(prLogPath, prLine, 'utf8');
          fs.appendFileSync(fullDetailsPath, prLine + '\n', 'utf8');
        } catch (e) {
          console.warn(`⚠️ Failed to append MRI update to PR log: ${e.message} (${prLogPath})`);
        }
      } else {
        console.log(`🧠 MRI unchanged (${label}) — ${res.reason || 'no delta'}`);
      }
    }
  } catch (e) {
    console.warn(`⚠️ MRI flush failed (${label}): ${e.message}`);
  }
}

process.on('beforeExit', () => _flushMRIOnExit('beforeExit'));
process.on('exit',       () => _flushMRIOnExit('exit'));
process.on('SIGINT',  () => { _flushMRIOnExit('SIGINT');  process.exit(130); });
process.on('SIGTERM', () => { _flushMRIOnExit('SIGTERM'); process.exit(143); });

function cliArgValue(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  if (!next || next.startsWith('--')) return fallback;
  return next;
}

// --- Cache busting helper for CDN/proxy refresh ---
const NO_CACHE_HEADERS = { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' };
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

const providerArg = cliArgValue('--provider', null);
if (!providerArg) {
  console.error('❌ Missing required --provider <key>.');
  process.exit(1);
}
const providerKey = providerArg.toLowerCase().trim();
  const activeProvider = getProvider(providerKey, {
    axios,
    cheerio,
    dayjs,
    urlReachable,
    extractRefs,
    mapRefByCite,
    parseRefId,
    withNoCache,
    NO_CACHE_HEADERS,
    onBadRefs: (refs) => { if (Array.isArray(refs) && refs.length) badRefs.push(...refs); }
  });
if (!activeProvider) {
  console.error(`❌ Unknown provider "${providerKey}". Supported: ${listProviders().join(', ')}`);
  process.exit(1);
}

const discovery = activeProvider.discovery;
const { discoverFromRootDocPage, normalizeSeedUrl, shouldFilterUrl } = discovery;

async function urlExistsNoRedirect(url) {
  try {
    const res = await axios.head(url, { maxRedirects: 0, validateStatus: null });
    return res.status === 200;
  } catch {
    return false;
  }
}

function mergeMetaConfig(base, override) {
  const out = { ...base };
  for (const src of Object.keys(override || {})) {
    const baseMap = base[src] || {};
    const overMap = override[src] || {};
    out[src] = { ...baseMap, ...overMap };
  }
  return out;
}

const baseMetaConfig = {
  parsed: {
    default: { confidence: 'high', note: 'Extracted directly from source content' }
  },
  inferred: {
    default: { confidence: 'medium', note: 'Inferred from URL or release context' }
  },
  resolved: {
    default: { confidence: 'high', note: 'Calculated or verified value' }
  },
  manual: {
    default: { confidence: 'medium' }
  },
  unknown: {
    default: { confidence: 'unknown', note: 'Source unknown' }
  }
};

const metaConfig = mergeMetaConfig(baseMetaConfig, activeProvider.metaConfig || {});

const badRefs = [];

function buildMriSightingIndexFromDocs(docs = []) {
  const idx = new Set();
  for (const d of (Array.isArray(docs) ? docs : [])) {
    const docId = String(d?.docId || '').trim();
    if (!docId) continue;
    const refs = d?.references && typeof d.references === 'object' ? d.references : {};
    for (const [key, type] of [['normative', 'normative'], ['bibliographic', 'bibliographic']]) {
      const arr = Array.isArray(refs[key]) ? refs[key] : [];
      for (const refIdRaw of arr) {
        const refId = String(refIdRaw || '').trim();
        if (!refId) continue;
        idx.add(`${refId}||${docId}||${type}`);
      }
    }
  }
  return idx;
}

function refsAreDifferent(a, b) {
  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  if (aSorted.length !== bSorted.length) return true;
  return aSorted.some((val, idx) => val !== bSorted[idx]);
}

function getMetaDefaults(source, field) {
  const srcMap = metaConfig[source] || metaConfig.unknown;
  return srcMap[field] || srcMap[`status.${field}`] || srcMap.default || metaConfig.unknown.default;
}

function injectMeta(doc, field, source, mode, oldValue) {
  const defaults = getMetaDefaults(source, field);
  const noteOverride = (doc && doc.__metaNotes && typeof doc.__metaNotes[field] === 'string')
    ? doc.__metaNotes[field]
    : '';
  const flagOverride = (doc && doc.__metaFlags && typeof doc.__metaFlags[field] === 'object')
    ? doc.__metaFlags[field]
    : null;
  const meta = {
    source,
    confidence: defaults.confidence,
    note: noteOverride || defaults.note,
    updated: new Date().toISOString(),
    originalValue: oldValue === undefined ? null : oldValue,
    sourceUrl: doc.__sourceUrl,
    version: SCRIPT_VERSION
  };
  if (flagOverride) {
    if (typeof flagOverride.reviewRequired === 'boolean') {
      meta.reviewRequired = flagOverride.reviewRequired;
      if (flagOverride.reviewRequired && meta.confidence === 'high') {
        meta.confidence = 'medium';
      }
    }
    if (typeof flagOverride.flag === 'string' && flagOverride.flag.trim()) {
      meta.flag = flagOverride.flag.trim();
    }
  }
  if (mode === 'update' && oldValue !== undefined && oldValue !== doc[field]) {
    meta.overridden = true;
  }
  doc[`${field}$meta`] = meta;
}

function attachMetaSourceUrl(target, sourceUrl) {
  if (!target || typeof target !== 'object') return;
  if (!sourceUrl) return;
  try {
    Object.defineProperty(target, '__sourceUrl', {
      value: sourceUrl,
      enumerable: false,
      configurable: true,
      writable: true
    });
  } catch (_) {}
}

function buildScopedMetaNotes(notes, prefix) {
  const out = {};
  if (!notes || typeof notes !== 'object') return out;
  const p = `${prefix}.`;
  for (const [k, v] of Object.entries(notes)) {
    if (typeof v !== 'string') continue;
    if (!k.startsWith(p)) continue;
    out[k.slice(p.length)] = v;
  }
  return out;
}

function buildScopedMetaFlags(flags, prefix) {
  const out = {};
  if (!flags || typeof flags !== 'object') return out;
  const p = `${prefix}.`;
  for (const [k, v] of Object.entries(flags)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    if (!k.startsWith(p)) continue;
    out[k.slice(p.length)] = { ...v };
  }
  return out;
}

function attachMetaNotes(target, notes) {
  if (!target || typeof target !== 'object') return;
  if (!notes || typeof notes !== 'object') return;
  try {
    Object.defineProperty(target, '__metaNotes', {
      value: notes,
      enumerable: false,
      configurable: true,
      writable: true
    });
  } catch (_) {}
}

function attachMetaFlags(target, flags) {
  if (!target || typeof target !== 'object') return;
  if (!flags || typeof flags !== 'object') return;
  try {
    Object.defineProperty(target, '__metaFlags', {
      value: flags,
      enumerable: false,
      configurable: true,
      writable: true
    });
  } catch (_) {}
}

// --- LOCKING HELPERS ($meta.excludeOverwrite / $meta.excludeChanges) ---
// Read adjacent meta for a dot path (e.g., "status.active" -> parent["active$meta"])
function _getAdjacentMeta(root, path) {
  const parts = String(path).split('.');
  let obj = root;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj && obj[parts[i]];
    if (!obj || typeof obj !== 'object') return null;
  }
  const key = parts[parts.length - 1];
  const metaKey = key + '$meta';
  return (obj && typeof obj === 'object') ? obj[metaKey] || null : null;
}

// Should we allow updating this path? True = allowed, False = locked
function canUpdateFieldWithMetaGuard(doc, path, { allowOverride = false } = {}) {
  if (allowOverride) return true;
  const meta = _getAdjacentMeta(doc, path);
  if (!meta || typeof meta !== 'object') return true;
  // Lock semantics: either flag name is accepted; if true, block writes.
  if (meta.excludeOverwrite === true || meta.excludeChanges === true) return false;
  return true;
}

// Central updater that blocks when the adjacent $meta has excludeOverwrite / excludeChanges.
// Also refreshes descriptive $meta.source / $meta.updated ONLY when a change succeeds.
function updateFieldGuarded(doc, path, newValue, {
  incomingSource = 'unknown',
  allowOverride = false,
  log = true
} = {}) {
  // Resolve parent + key
  const parts = String(path).split('.');
  let parent = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    parent = parent?.[parts[i]];
    if (!parent || typeof parent !== 'object') {
      return { updated: false, reason: 'no-parent' };
    }
  }
  const key = parts[parts.length - 1];
  const metaKey = key + '$meta';
  const meta = parent?.[metaKey] || null;

  // Hard lock from adjacent $meta
  const locked = !allowOverride && !!(meta && (meta.excludeOverwrite === true || meta.excludeChanges === true));
  if (locked) {
    const lockType = meta.excludeOverwrite === true ? 'excludeOverwrite' : 'excludeChanges';
    console.log(`🔒 skipped update: ${path} — locked by ${lockType} in $meta`);
    return { updated: false, reason: 'locked' };
  }

  // Avoid churn
  const oldValue = parent[key];
  const same = JSON.stringify(oldValue) === JSON.stringify(newValue);
  if (same) return { updated: false, reason: 'no-change' };

  // Apply
  parent[key] = newValue;

  // Refresh descriptive meta only when base field changed and meta exists
  if (meta && typeof meta === 'object') {
    if (meta.source !== incomingSource) meta.source = incomingSource;
    try { meta.updated = new Date().toISOString(); } catch (_) {}
    // Stamp extractor version only on successful value change (no per-run churn)
    meta.version = SCRIPT_VERSION;
  }

  return { updated: true, oldValue, newValue };
}

function mdEscape(val) {
  if (val === null || val === undefined) return String(val);
  const s = String(val);
  // Minimal, safe escapes so GitHub won’t parse as Markdown/links
  return s
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/#/g, '\\#')
    .replace(/\|/g, '\\|')
    .replace(/!/g, '\\!');
}

function injectMetaForDoc(doc, source, mode, changedFieldsMap = {}) {
  const resolvedFields = ['docId', 'docLabel', 'doi', 'href', 'resolvedHref', 'repo'];
  const resolvedStatusFields = ['active', 'latestVersion', 'superseded'];

  for (const field of Object.keys(doc)) {
    const value = doc[field];
    // Skip $meta fields themselves and any undefined values
    if (field.endsWith('$meta')) continue;
    if (value === undefined) continue;
    if (typeof value !== 'object' || Array.isArray(value)) {
      const fieldSource = resolvedFields.includes(field) ? 'resolved' : source;
      injectMeta(doc, field, fieldSource, mode, changedFieldsMap[field]);
    }
  }

  if (doc.status && typeof doc.status === 'object') {
    for (const sField of Object.keys(doc.status)) {
      if (sField.endsWith('$meta')) continue;
      const sVal = doc.status[sField];
      if (sVal === undefined || typeof sVal === 'object') continue;
      const fieldSource = resolvedStatusFields.includes(sField) ? 'resolved' : source;
      injectMeta(doc.status, sField, fieldSource, mode, changedFieldsMap[`status.${sField}`]);
    }
  }
}

const { extractFromSeedDoc, extractFromUrl } = activeProvider.parser;

// Main async block
(async () => {
  //const urls = require('../input/urls.json');
  let urls = await discoverFromRootDocPage(); // already filtered via filterDiscoveredDocs()
  // --- Optional: merge in seed URLs (union) ---
  const seedPath = activeProvider.seedPath;
  const seedSet = new Set();
  let seedsAdded = 0, seedsSkipped = 0;
  if (fs.existsSync(seedPath)) {
    try {
      const rawSeeds = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
      if (Array.isArray(rawSeeds)) {
        for (const raw of rawSeeds) {
          const seed = normalizeSeedUrl(raw);
          if (!seed) continue;
          if (shouldFilterUrl(seed)) {
            seedsSkipped++;
            continue;
          }
          if (!urls.includes(seed)) {
            urls.push(seed);
            seedsAdded++;
          }
          seedSet.add(seed);
        }
      }
    } catch (e) {
      console.warn(`⚠️ Failed to read/parse ${seedPath}: ${e.message}`);
    }
  }
  console.log(`\n📂 Processing ${urls.length} ${activeProvider.label} URLs... (seeds added: ${seedsAdded}, seeds skipped: ${seedsSkipped})`);
  
  const results = [];

  for (const url of urls) {
    try {
      const docs = seedSet.has(url)
        ? await extractFromSeedDoc(url)
        : await extractFromUrl(url);
      results.push(...docs);
    } catch (e) {
      console.error(`❌ Failed to process ${url}:`, e.message);
    }
  }

  const outputPath = 'src/main/data/documents.json';
  let existingDocs = [];

  if (fs.existsSync(outputPath)) {
    const raw = fs.readFileSync(outputPath, 'utf-8');
    try {
      const parsed = JSON.parse(raw);
      existingDocs = Array.isArray(parsed) ? parsed : parsed.documents || [];
    } catch (err) {
      console.error('Failed to parse existing documents.json:', err.message);
    }
  }

  const newDocs = [];
  const updatedDocs = [];
  const skippedDocs = [];

logSmart(`\n🛠 Beginning document merge/update phase... (${results.length} documents to check)`);
let processed = 0;

for (const doc of results) {
    let hasRefChanges = false;
    let addedRefs = { normative: [], bibliographic: [] };
    let removedRefs = { normative: [], bibliographic: [] };
    let duplicateNormRemoved = false;
    let duplicateBibRemoved = false;

    const index = existingDocs.findIndex(d => d.docId === doc.docId);
    logSmart(`  Checking ${doc.docId}...`);
    
    if (index === -1) {
      await resolveUrlAndInject(doc, 'href');
      const sourceType = doc.__inferred ? 'inferred' : 'parsed';
      attachMetaSourceUrl(doc, doc.__sourceUrl);
      attachMetaNotes(doc, doc.__metaNotes || {});
      attachMetaFlags(doc, doc.__metaFlags || {});
      attachMetaSourceUrl(doc.status, doc.__sourceUrl);
      attachMetaNotes(doc.status, buildScopedMetaNotes(doc.__metaNotes, 'status'));
      attachMetaFlags(doc.status, buildScopedMetaFlags(doc.__metaFlags, 'status'));
      attachMetaSourceUrl(doc.references, doc.__sourceUrl);
      attachMetaNotes(doc.references, buildScopedMetaNotes(doc.__metaNotes, 'references'));
      attachMetaFlags(doc.references, buildScopedMetaFlags(doc.__metaFlags, 'references'));
       if (doc.repo && !(await urlExistsNoRedirect(doc.repo))) {
        delete doc.repo;
      }
      injectMetaForDoc(doc, sourceType, 'new');
      if (doc.references) {
        // Drop empty reference arrays on new inserts so canonicalize does not
        // inject manual $meta for parser-empty placeholders.
        if (Array.isArray(doc.references.normative) && doc.references.normative.length === 0) {
          delete doc.references.normative;
          delete doc.references['normative$meta'];
        }
        if (Array.isArray(doc.references.bibliographic) && doc.references.bibliographic.length === 0) {
          delete doc.references.bibliographic;
          delete doc.references['bibliographic$meta'];
        }

        const hasNorm = Array.isArray(doc.references.normative) && doc.references.normative.length > 0;
        const hasBibl = Array.isArray(doc.references.bibliographic) && doc.references.bibliographic.length > 0;
        if (!hasNorm && !hasBibl) {
          delete doc.references;
        } else {
          if (hasNorm) injectMeta(doc.references, 'normative', sourceType, 'new', []);
          if (hasBibl) injectMeta(doc.references, 'bibliographic', sourceType, 'new', []);
        }
      }
      if (doc.revisionOf) {
        injectMeta(doc, 'revisionOf', sourceType, 'new', []);
      }
      // Only persist non-empty status arrays and their $meta; drop empties to avoid JSON noise
      const newStatusArrays = [
        { field: 'amendedBy', source: sourceType },
        { field: 'supersededBy', source: 'resolved' },
        { field: 'supersedes', source: sourceType },
        { field: 'amends', source: sourceType },
        { field: 'errataUrl', source: sourceType }
      ];
      for (const { field, source } of newStatusArrays) {
        if (!doc.status || !Array.isArray(doc.status[field])) continue;
        if (doc.status[field].length > 0) {
          injectMeta(doc.status, field, source, 'new', []);
        } else {
          delete doc.status[field];
          delete doc.status[`${field}$meta`];
        }
      }
      if (doc.status && typeof doc.status.supersededDate === 'string') {
        injectMeta(doc.status, 'supersededDate', 'resolved', 'new', null);
      }
      if (doc.status && doc.status.withdrawnNotice && doc.status['withdrawnNotice$meta'] && doc.__withdrawnNoticeSuffix) {
        // Normalize: strip any existing reachability suffix(es) before adding the current one
        const NOTE_SUFFIX_RE = /\s+—\s+(?:verified reachable|link unreachable at extraction)(?:\s+—\s+(?:verified reachable|link unreachable at extraction))*\s*$/;
        const currentNote = doc.status['withdrawnNotice$meta'].note || getMetaDefaults('parsed', 'status.withdrawnNotice').note;
        const baseNote = (currentNote || '').replace(NOTE_SUFFIX_RE, '') || getMetaDefaults('parsed', 'status.withdrawnNotice').note;
        const normalized = `${baseNote} — ${doc.__withdrawnNoticeSuffix}`;
        doc.status['withdrawnNotice$meta'].note = normalized;
      }
      logSmart(`   ➕ Adding ${doc.docId} (new document)`);
      newDocs.push(doc);
      existingDocs.push(doc);
      processed++;
      heartbeat(processed, results.length);
    } else {
      await resolveUrlAndInject(doc, 'href');
      if (doc.repo && !(await urlExistsNoRedirect(doc.repo))) {
        delete doc.repo;
      }
      const existingDoc = existingDocs[index];
      attachMetaSourceUrl(existingDoc, doc.__sourceUrl);
      attachMetaNotes(existingDoc, doc.__metaNotes || {});
      attachMetaFlags(existingDoc, doc.__metaFlags || {});
      attachMetaSourceUrl(existingDoc.status, doc.__sourceUrl);
      attachMetaNotes(existingDoc.status, buildScopedMetaNotes(doc.__metaNotes, 'status'));
      attachMetaFlags(existingDoc.status, buildScopedMetaFlags(doc.__metaFlags, 'status'));
      attachMetaSourceUrl(existingDoc.references, doc.__sourceUrl);
      attachMetaNotes(existingDoc.references, buildScopedMetaNotes(doc.__metaNotes, 'references'));
      attachMetaFlags(existingDoc.references, buildScopedMetaFlags(doc.__metaFlags, 'references'));
      let changedFields = [];
      const oldValues = { ...existingDoc, status: { ...(existingDoc.status || {}) } };
      const newValues = { ...doc, status: { ...(doc.status || {}) } };

      const oldRefs = {
        normative: (existingDoc.references && existingDoc.references.normative) || [],
        bibliographic: (existingDoc.references && existingDoc.references.bibliographic) || []
      };
      const newRefs = {
        normative: (doc.references && doc.references.normative) || [],
        bibliographic: (doc.references && doc.references.bibliographic) || []
      };

      if (doc.references) {
        addedRefs = {
          normative: newRefs.normative.filter(ref => !oldRefs.normative.includes(ref)),
          bibliographic: newRefs.bibliographic.filter(ref => !oldRefs.bibliographic.includes(ref))
        };

        removedRefs = {
          normative: oldRefs.normative.filter(ref => !newRefs.normative.includes(ref)),
          bibliographic: oldRefs.bibliographic.filter(ref => !newRefs.bibliographic.includes(ref))
        };

        if (oldRefs.normative.length > new Set(oldRefs.normative).size) {
          duplicateNormRemoved = true;
        }

        if (oldRefs.bibliographic.length > new Set(oldRefs.bibliographic).size) {
          duplicateBibRemoved = true;
        }

        if (duplicateNormRemoved || duplicateBibRemoved) {
          if (!changedFields.includes('references')) {
            changedFields.push('references');
          }
        }

        hasRefChanges =
          addedRefs.normative.length > 0 || addedRefs.bibliographic.length > 0 ||
          removedRefs.normative.length > 0 || removedRefs.bibliographic.length > 0;

        if (hasRefChanges && !changedFields.includes('references')) {
          changedFields.push('references');
        }

        const normChanged = refsAreDifferent(newRefs.normative, oldRefs.normative);
        const biblChanged = refsAreDifferent(newRefs.bibliographic, oldRefs.bibliographic);
        const refsChanged = normChanged || biblChanged;

        if (refsChanged) {
          const hasNormNew = Array.isArray(newRefs.normative) && newRefs.normative.length > 0;
          const hasBiblNew = Array.isArray(newRefs.bibliographic) && newRefs.bibliographic.length > 0;

          const fieldSource = doc.__inferred ? 'inferred' : 'parsed';

          if (!hasNormNew && !hasBiblNew) {
            // Guarded delete of entire references object
            if (canUpdateFieldWithMetaGuard(existingDoc, 'references')) {
              delete existingDoc.references;
              delete newValues.references;
            }
          } else {
            // Ensure container
            if (!existingDoc.references) existingDoc.references = {};
            attachMetaSourceUrl(existingDoc.references, doc.__sourceUrl);
            attachMetaNotes(existingDoc.references, buildScopedMetaNotes(doc.__metaNotes, 'references'));
            attachMetaFlags(existingDoc.references, buildScopedMetaFlags(doc.__metaFlags, 'references'));

            if (hasNormNew && normChanged) {
              const resNorm = updateFieldGuarded(existingDoc, 'references.normative', newRefs.normative, { incomingSource: fieldSource, log: true });
              if (resNorm.updated) {
                if (!newValues.references) newValues.references = {};
                newValues.references.normative = newRefs.normative;
                injectMeta(existingDoc.references, 'normative', fieldSource, 'update', oldRefs.normative || []);
              }
            } else if (!hasNormNew && Array.isArray(oldRefs.normative)) {
              if (canUpdateFieldWithMetaGuard(existingDoc, 'references.normative')) {
                delete existingDoc.references.normative;
                delete existingDoc.references['normative$meta'];
              }
            }

            if (hasBiblNew && biblChanged) {
              const resBibl = updateFieldGuarded(existingDoc, 'references.bibliographic', newRefs.bibliographic, { incomingSource: fieldSource, log: true });
              if (resBibl.updated) {
                if (!newValues.references) newValues.references = {};
                newValues.references.bibliographic = newRefs.bibliographic;
                injectMeta(existingDoc.references, 'bibliographic', fieldSource, 'update', oldRefs.bibliographic || []);
              }
            } else if (!hasBiblNew && Array.isArray(oldRefs.bibliographic)) {
              if (canUpdateFieldWithMetaGuard(existingDoc, 'references.bibliographic')) {
                delete existingDoc.references.bibliographic;
                delete existingDoc.references['bibliographic$meta'];
              }
            }

            // Clean container if both arrays gone
            const hasAny =
              (existingDoc.references && Array.isArray(existingDoc.references.normative) && existingDoc.references.normative.length) ||
              (existingDoc.references && Array.isArray(existingDoc.references.bibliographic) && existingDoc.references.bibliographic.length);
            if (!hasAny) {
              if (canUpdateFieldWithMetaGuard(existingDoc, 'references')) {
                delete existingDoc.references;
                delete newValues.references;
              }
            }
          }
        }
      }

      // Update document fields if there are changes
      for (const key of Object.keys(doc)) {
        const oldVal = oldValues[key];
        const newVal = doc[key];
        const isEqual = typeof newVal === 'object'
          ? JSON.stringify(oldVal) === JSON.stringify(newVal)
          : oldVal === newVal;

        if (!isEqual) {
          if (key === 'references') {
            continue; 
          }

          const resolvedFields = ['docId', 'docLabel', 'doi', 'href', 'resolvedHref', 'repo'];
          const resolvedStatusFields = ['active', 'latestVersion', 'superseded'];

          if (key === 'status') {
            if (!existingDoc.status || typeof existingDoc.status !== 'object') {
              existingDoc.status = {};
            }
            attachMetaSourceUrl(existingDoc.status, doc.__sourceUrl);
            attachMetaNotes(existingDoc.status, buildScopedMetaNotes(doc.__metaNotes, 'status'));
            attachMetaFlags(existingDoc.status, buildScopedMetaFlags(doc.__metaFlags, 'status'));

            const statusFields = [
              'active',
              'latestVersion',
              'superseded',
              'stage',
              'state',
              'stabilized',
              'stabilizedDate',
              'withdrawn',
              'withdrawnDate',
              'withdrawnNotice',
              'amended',
              'amendedDate',
              'draft',
              'publicCd',
              'reaffirmed',
              'reaffirmDate',
              'unknown',
              'statusNote',
              'errataExist',
              'supersededDate',
              'versionless'
            ];
            for (const field of statusFields) {
              if (newVal[field] !== undefined) {
                const oldStatusVal = existingDoc.status[field];
                const fieldSource = resolvedStatusFields.includes(field) ? 'resolved' : 'parsed';
                const res = updateFieldGuarded(existingDoc, `status.${field}`, newVal[field], { incomingSource: fieldSource, log: true });
                if (res.updated) {
                  injectMeta(existingDoc.status, field, fieldSource, 'update', oldStatusVal);
                  if (!changedFields.includes('status')) changedFields.push('status');
                }
              }
            }
            // Handle amendedBy (array) separately
            if (Array.isArray(newVal.amendedBy)) {
              const oldAB = Array.isArray(oldValues?.status?.amendedBy) ? oldValues.status.amendedBy : [];
              const newAB = newVal.amendedBy;
              const same = JSON.stringify(oldAB) === JSON.stringify(newAB);
              if (!same) {
                if (newAB.length > 0) {
                  const resAB = updateFieldGuarded(existingDoc, 'status.amendedBy', newAB, { incomingSource: 'parsed', log: true });
                  if (resAB.updated) {
                    injectMeta(existingDoc.status, 'amendedBy', 'parsed', 'update', oldAB);
                    if (!changedFields.includes('status')) changedFields.push('status');
                  }
                } else {
                  if (canUpdateFieldWithMetaGuard(existingDoc, 'status.amendedBy')) {
                    delete existingDoc.status.amendedBy;
                    delete existingDoc.status['amendedBy$meta'];
                    if (!changedFields.includes('status')) changedFields.push('status');
                  }
                }
              }
            }

            const statusArrayFields = [
              { field: 'supersededBy', source: 'resolved' },
              { field: 'supersedes', source: 'parsed' },
              { field: 'amends', source: 'parsed' },
              { field: 'errataUrl', source: 'parsed' }
            ];
            for (const { field, source } of statusArrayFields) {
              if (!Array.isArray(newVal[field])) continue;
              const oldArr = Array.isArray(oldValues?.status?.[field]) ? oldValues.status[field] : [];
              const newArr = newVal[field];
              const sameArr = JSON.stringify(oldArr) === JSON.stringify(newArr);
              if (sameArr) continue;

              if (newArr.length > 0) {
                const resArr = updateFieldGuarded(existingDoc, `status.${field}`, newArr, { incomingSource: source, log: true });
                if (resArr.updated) {
                  injectMeta(existingDoc.status, field, source, 'update', oldArr);
                  if (!changedFields.includes('status')) changedFields.push('status');
                }
              } else if (canUpdateFieldWithMetaGuard(existingDoc, `status.${field}`)) {
                delete existingDoc.status[field];
                delete existingDoc.status[`${field}$meta`];
                if (!changedFields.includes('status')) changedFields.push('status');
              }
            }
            const newWN = newVal.withdrawnNotice;
            const oldWN = oldValues?.status?.withdrawnNotice;
            if (newWN !== undefined) {
              // Only modify meta when the base field actually changes (to avoid PR noise)
              if (newWN !== oldWN) {
                if (!existingDoc.status['withdrawnNotice$meta']) {
                  injectMeta(existingDoc.status, 'withdrawnNotice', 'parsed', 'update', oldWN);
                }
                if (doc.__withdrawnNoticeSuffix) {
                  // Normalize: remove any trailing reachability suffix(es) and then add the current one exactly once
                  const NOTE_SUFFIX_RE = /\s+—\s+(?:verified reachable|link unreachable at extraction)(?:\s+—\s+(?:verified reachable|link unreachable at extraction))*\s*$/;
                  const currentNote = existingDoc.status['withdrawnNotice$meta'].note || getMetaDefaults('parsed', 'status.withdrawnNotice').note;
                  const baseNote = (currentNote || '').replace(NOTE_SUFFIX_RE, '') || getMetaDefaults('parsed', 'status.withdrawnNotice').note;
                  const normalized = `${baseNote} — ${doc.__withdrawnNoticeSuffix}`;
                  if (existingDoc.status['withdrawnNotice$meta'].note !== normalized) {
                    existingDoc.status['withdrawnNotice$meta'].note = normalized;
                  }
                }
                if (!changedFields.includes('status')) changedFields.push('status');
              }
            }
          } else if (key === 'revisionOf') {
            const oldList = Array.isArray(oldVal) ? oldVal.map(String) : [];
            const newList = Array.isArray(newVal) ? newVal.map(String) : [];

            // Merge and dedupe
            const merged = Array.from(new Set([...oldList, ...newList]));

            if (JSON.stringify(merged) !== JSON.stringify(oldList)) {
              const fieldSource = doc.__inferred ? 'inferred' : 'parsed';
              const resRev = updateFieldGuarded(existingDoc, key, merged, { incomingSource: fieldSource, log: true });
              if (resRev.updated) {
                newValues[key] = merged;
                injectMeta(existingDoc, key, fieldSource, 'update', oldList);
                changedFields.push(key);
              }
            }

            newValues[key] = existingDoc[key];

          } else {
            const fieldSource = resolvedFields.includes(key) ? 'resolved' : 'parsed';
            const resGen = updateFieldGuarded(existingDoc, key, newVal, { incomingSource: fieldSource, log: true });
            if (resGen.updated) {
              injectMeta(existingDoc, key, fieldSource, 'update', oldVal);
              changedFields.push(key);
            }
          }
        }
      }
      
      if (
        changedFields.length > 0 ||
        hasRefChanges ||
        duplicateNormRemoved ||
        duplicateBibRemoved
      ) {
        logSmart(`   ↻ Updating ${doc.docId} (fields: ${changedFields.length ? changedFields.join(', ') : 'references only'})`);
        updatedDocs.push({
          docId: doc.docId,
          fields: changedFields,
          addedRefs: {
            normative: [...addedRefs.normative],
            bibliographic: [...addedRefs.bibliographic]
          },
          removedRefs: {
            normative: [...removedRefs.normative],
            bibliographic: [...removedRefs.bibliographic]
          },
          duplicateNormRemoved,
          duplicateBibRemoved,
          oldValues,
          newValues
        });
        processed++;
        heartbeat(processed, results.length);
      } else {
        logSmart(`   ⤼ Skipped duplicate document`);
        skippedDocs.push(doc.docId);
        processed++;
        heartbeat(processed, results.length);
      }
    }
  }
  
  logSmart(`\n✅ Merge/update phase complete — processed ${processed}/${results.length}`);

  // Sort documents by docId
  existingDocs.sort((a, b) => a.docId.localeCompare(b.docId));

  // Write sorted documents to file
  fs.writeFileSync(
    outputPath,
    JSON.stringify(existingDocs, null, 2) + '\n'
  );

  console.log(`✅ Added ${newDocs.length} new documents.`);
  console.log(`🔁 Updated ${updatedDocs.length} documents.`);
  if (skippedDocs.length > 0) {
    console.log(`⚠️ Skipped ${skippedDocs.length} duplicate document(s):`);
    skippedDocs.forEach(docId => {
      console.log(`- ${docId}`);
    });
  }

  // Keep MRI variants aligned with current documents truth during extract runs,
  // so extract-time sightings do not create transient entries later pruned by
  // buildMasterReferenceIndex.
  try {
    const sightIdx = buildMriSightingIndexFromDocs(existingDocs);
    const pr = mriPruneToSightings(sightIdx, { removeEmptyRefs: true });
    if ((pr.removedVariants || 0) > 0 || (pr.removedRefs || 0) > 0 || (pr.removedOrphans || 0) > 0) {
      console.log(`🧹 MRI prune during extract: -${pr.removedVariants || 0} variants, -${pr.removedRefs || 0} refs, -${pr.removedOrphans || 0} orphans`);
    }
  } catch (e) {
    console.warn(`⚠️ MRI prune during extract failed: ${e.message}`);
  }

  const formatBadRefText = (raw) => String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/^\[\s*\d{1,4}\s*\]\s*/u, '')
    .replace(/^\d{1,4}\s*\]\s*/u, '')
    .replace(/^\[\s*([A-Za-z][A-Za-z0-9_.:-]{0,31})\s*\]\s*/u, '$1 ')
    .replace(/^([A-Za-z][A-Za-z0-9_.:-]{0,31})\s*\]\s*/u, '$1 ')
    .replace(/\s*\[\s*$/u, '')
    .replace(/\s*\]\s*$/u, '')
    .trim();

  if (badRefs.length > 0) {
    console.log('🚫 Unparseable References Found:');
    badRefs.forEach(ref => {
      console.log(`- From ${ref.docId} (${ref.type}):`);
      console.log(`  - cite: ${formatBadRefText(ref.refText)}`);
      if (ref.href) console.log(`  - href: ${ref.href}`);
    });
  }

  // Persist badRefs so unresolved citations can be backfilled later without
  // relying only on PR body/log excerpts.
  try {
    const nowIso = new Date().toISOString();
    const badRefItems = badRefs.map((ref) => ({
      provider: providerKey,
      docId: String(ref.docId || '').trim(),
      type: String(ref.type || '').trim(),
      cite: formatBadRefText(ref.refText),
      href: String(ref.href || '').trim()
    })).filter((item) => {
      const cite = String(item.cite || '').trim();
      const href = String(item.href || '').trim();
      if (!cite && !href) return false;
      // Final write-time guard: if a citation is now resolvable (by parser or
      // refMap mapping), do not persist it in badRefs.latest.json.
      try {
        if (parseRefId(cite, href)) return false;
      } catch {}
      try {
        if (mapRefByCite(cite)) return false;
      } catch {}
      return true;
    });

    let existingItems = [];
    try {
      if (fs.existsSync(badRefsLatestPath)) {
        const existingPayload = JSON.parse(fs.readFileSync(badRefsLatestPath, 'utf-8'));
        const existingList = Array.isArray(existingPayload?.badRefs) ? existingPayload.badRefs : [];
        existingItems = existingList.map((item) => ({
          provider: String(item?.provider || '').trim().toLowerCase(),
          docId: String(item?.docId || '').trim(),
          type: String(item?.type || '').trim(),
          cite: String(item?.cite || '').trim(),
          href: String(item?.href || '').trim()
        })).filter((item) => item.provider && item.docId && item.type && item.cite);
      }
    } catch (readErr) {
      console.warn(`⚠️ Failed to read existing bad refs snapshot for merge: ${readErr.message}`);
    }

    const preservedOtherProviders = existingItems.filter((item) => item.provider !== providerKey);
    const merged = [...preservedOtherProviders, ...badRefItems];
    const normalizeBadRefCiteForKey = (cite) => String(cite || '')
      // Collapse local citation keys like "Huelsing13a " when followed by author text.
      // Keep base labels like "Huelsing13".
      .replace(/^[A-Za-z][A-Za-z0-9_.:-]{0,23}\d{2,4}[a-z]\s+(?=[A-Z][A-Za-z'`-]{1,63},\s)/u, '')
      .trim();
    const dedupe = new Map();
    for (const item of merged) {
      const citeKey = normalizeBadRefCiteForKey(item.cite).toLowerCase();
      const key = [
        item.provider,
        item.docId,
        item.type.toLowerCase(),
        citeKey,
        item.href.toLowerCase()
      ].join('||');
      if (!dedupe.has(key)) dedupe.set(key, item);
    }
    const mergedItems = [...dedupe.values()];
    const payload = {
      generatedAt: nowIso,
      sourcePath: outputPath,
      total: mergedItems.length,
      badRefs: mergedItems
    };
    fs.mkdirSync('src/main/reports', { recursive: true });
    fs.writeFileSync(badRefsLatestPath, JSON.stringify(payload, null, 2) + '\n');
    console.log(`📄 Bad refs latest snapshot saved: ${badRefsLatestPath}`);
  } catch (e) {
    console.warn(`⚠️ Failed to write bad refs reports: ${e.message}`);
  }

  if (newDocs.length === 0 && updatedDocs.length === 0) {
  // Consider MRI-only updates: flush first
  let mriRes = { wrote: false };
  try {
    mriRes = mriFlush({ force: false }) || { wrote: false };
  } catch (e) {
    console.warn(`⚠️ MRI flush check failed: ${e.message}`);
  }

  if (!mriRes.wrote) {
    console.log('\nℹ️ No new or updated documents — skipping PR creation.');
    process.exit(0);
  } else {
    // Minimal PR log note; PR creation continues
    try {

      _mriPreFlushed = true;
      _mriPreFlushResult = mriRes;
    } catch (e) {
      console.warn(`⚠️ Failed to append MRI update to PR log: ${e.message}`);
    }
  }
}

  // --- PR log summary capping and full details file creation ---

  // Helper to slice with remainder count
  function sliceWithRemainder(arr, max) {
    return { shown: arr.slice(0, max), hidden: Math.max(0, arr.length - max) };
  }

  // NEW: placeholder token that the workflow will replace with the PR /files#diff-<blob> link
  const DETAILS_DIFF_TOKEN = '__PR_DETAILS_DIFF_LINK__';

  // Format full details for Added
  function formatAddedDocFull(doc) {
    return `- ${doc.docId}`;
  }
  // Format full details for Updated
  function formatUpdatedDocFull(doc) {
    const lines = [`#### ${doc.docId} (updated fields: ${doc.fields.join(', ')})`];

    // Log field updates with old and new values
    doc.fields.forEach(field => {
      const oldVal = doc.oldValues[field];
      const newVal = doc.newValues[field];
      const formatVal = (val) => {
        if (val === undefined) return '`undefined`';
        if (val === null) return '`null`';
        if (typeof val === 'object') return '`' + mdEscape(JSON.stringify(val)) + '`';
        return '`' + mdEscape(String(val)) + '`';
      };

      if (field === 'status') {
        const oldStatus = doc.oldValues.status || {};
        const newStatus = doc.newValues.status || {};
        const statusFields = [
          'active',
          'latestVersion',
          'superseded',
          'stage',
          'state',
          'stabilized',
          'withdrawn',
          'withdrawnNotice',
          'amended',
          'supersededDate'
        ];
        const diffs = statusFields
          .filter(k => oldStatus[k] !== newStatus[k])
          .map(k => `${k}: ${formatVal(oldStatus[k])} → ${formatVal(newStatus[k])}`);
        // Also report amendedBy (array) changes
        const oldAB = Array.isArray(oldStatus.amendedBy) ? oldStatus.amendedBy : [];
        const newAB = Array.isArray(newStatus.amendedBy) ? newStatus.amendedBy : [];
        const amendedByChanged = JSON.stringify(oldAB) !== JSON.stringify(newAB);
        if (amendedByChanged) {
          diffs.push(`amendedBy: ${formatVal(oldAB)} → ${formatVal(newAB)}`);
        }
        // Also report supersededBy (array) changes
        const oldSB = Array.isArray(oldStatus.supersededBy) ? oldStatus.supersededBy : [];
        const newSB = Array.isArray(newStatus.supersededBy) ? newStatus.supersededBy : [];
        const supersededByChanged = JSON.stringify(oldSB) !== JSON.stringify(newSB);
        if (supersededByChanged) {
          diffs.push(`supersededBy: ${formatVal(oldSB)} → ${formatVal(newSB)}`);
        }
        if (diffs.length > 0) lines.push(`  - status changed: \r\n${diffs.join('\r\n')}`);
      } else if (field === 'revisionOf') {
        lines.push(`  - revisionOf changed: ${formatVal(oldVal || [])} → ${formatVal(newVal || [])}`);
      } else if (field === 'references') {
        // skip — refs summarized below
      } else {
        lines.push(`  - ${field}: ${formatVal(oldVal)} → ${formatVal(newVal)}`);
      }
    });

    // Added references
    const norm = doc.addedRefs.normative;
    const bibl = doc.addedRefs.bibliographic;
    if (norm.length || bibl.length) {
    if (norm.length) lines.push(`  - ➕ Normative Ref(s) added:\r\n ${norm.join('\r')}`);
    if (bibl.length) lines.push(`  - ➕ Bibliographic Ref(s) added:\r\n ${bibl.join('\r')}`);
    }

    // Removed references
    if (doc.removedRefs.normative.length) lines.push(`  - ➖ Normative Ref(s) removed:\r\n ${doc.removedRefs.normative.join('\r')}`);
    if (doc.removedRefs.bibliographic.length) lines.push(`  - ➖ Bibliographic Ref(s) removed:\r\n ${doc.removedRefs.bibliographic.join('\r')}`);

    if (doc.duplicateNormRemoved || doc.duplicateBibRemoved) {
      const types = [];
      if (doc.duplicateNormRemoved) types.push('normative');
      if (doc.duplicateBibRemoved) types.push('bibliographic');
      lines.push(`  - 🔄 Duplicate ${types.join('/')} reference(s) removed`);
    }
    return lines.join('\n');
  }

  // Prepare full details lines
  const fullDetailsLines = [];
  fullDetailsLines.push(`### 🆕 Added ${newDocs.length} new document(s):`);
  fullDetailsLines.push(...newDocs.map(formatAddedDocFull));
  fullDetailsLines.push('');
  fullDetailsLines.push(`### 🔁 Updated ${updatedDocs.length} existing document(s):`);
  updatedDocs.forEach(doc => {
    fullDetailsLines.push(formatUpdatedDocFull(doc));
  });
  fullDetailsLines.push('');
  fullDetailsLines.push(`### ⚠️ Skipped ${skippedDocs.length} duplicate(s)`);
  skippedDocs.forEach(docId => {
    fullDetailsLines.push(`- ${docId}`);
  });
  fullDetailsLines.push('');
  // Add unparseable refs if any
  if (badRefs.length > 0) {
    fullDetailsLines.push('### 🚫 Unparseable References Found:\n');
    badRefs.forEach(ref => {
      fullDetailsLines.push(`- From ${ref.docId} (${ref.type}):`);
      fullDetailsLines.push(`  - cite: ${formatBadRefText(ref.refText)}`);
      if (ref.href) fullDetailsLines.push(`  - href: ${ref.href}`);
    });
    fullDetailsLines.push('');
  }

  // Write full details file
  fs.mkdirSync('src/main/logs/extract-runs', { recursive: true });
  fs.writeFileSync(fullDetailsPath, fullDetailsLines.join('\n'));

  // Cap summary for PR log
  const MAX_SUMMARY = 20;
  const addedSlice = sliceWithRemainder(newDocs, MAX_SUMMARY);
  const updatedSlice = sliceWithRemainder(updatedDocs, MAX_SUMMARY);

  // Build PR body lines — use TOKEN for the link target
  const prLines = [];
  prLines.push(`### 🆕 Added ${newDocs.length} new document(s):`);
  prLines.push(...addedSlice.shown.map(formatAddedDocFull));
  if (addedSlice.hidden > 0) {
    prLines.push(`…and ${addedSlice.hidden} more — [full list here](${DETAILS_DIFF_TOKEN})`);
  }
  prLines.push('');
  prLines.push(`### 🔁 Updated ${updatedDocs.length} existing document(s):`);
  updatedSlice.shown.forEach(doc => {
    prLines.push(formatUpdatedDocFull(doc));
  });
  if (updatedSlice.hidden > 0) {
    prLines.push(`…and ${updatedSlice.hidden} more — [full list here](${DETAILS_DIFF_TOKEN})`);
  }
  prLines.push('');
  prLines.push(`### ⚠️ Skipped ${skippedDocs.length} duplicate(s)`);
  prLines.push('');
  // Add unparseable refs summary to PR log if present
  if (badRefs.length > 0) {
    prLines.push('### 🚫 Unparseable References Found:\n');
    badRefs.forEach(ref => {
      prLines.push(`- From ${ref.docId} (${ref.type}):`);
      prLines.push(`  - cite: ${formatBadRefText(ref.refText)}`);
      if (ref.href) prLines.push(`  - href: ${ref.href}`);
    });
    prLines.push('');
  }

  fs.writeFileSync(prLogPath, prLines.join('\n'));
  console.log(`\n📄 PR log updated: ${prLogPath}`);
  console.log(`📄 Full PR log details saved: ${fullDetailsPath}`);
  console.log(`🔗 Full details (raw): ${detailsFileRawUrl}`);

})();
