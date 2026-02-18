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
const { createSmpteDiscovery } = require('./providers/smpte.discovery');
const { createSmpteParser } = require('./providers/smpte.parse');

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
// Raw URL (kept for logging/diagnostics)
const detailsFileRawUrl = `https://raw.githubusercontent.com/PrZ3r/MSRBot.io/main/${fullDetailsPath}`;

const { parseRefId, extractRefs, mapRefByCite, mriFlush, mriEnsureFile } = require('../lib/referencing');

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

// Normalize titles by removing a leading "SMPTE" token (and common punctuation/spaces)
function stripLeadingSmpte(title) {
  if (!title) return title;
  return String(title).replace(/^\s*SMPTE\s*[:\-–—]?\s*/i, '').trim();
}

// Strip leading designator up to the first comma.
// Example: "ST 2098-1, Immersive Audio — Immersive Audio Metadata"
// => "Immersive Audio — Immersive Audio Metadata"
function stripLeadingDesignatorComma(t) {
  if (!t) return t;
  const s = String(t).trim();
  const idx = s.indexOf(',');
  if (idx === -1) return s;
  return s.slice(idx + 1).trim();
}

// Split on first em/en dash (— or –). Fallback: spaced hyphen " - ".
// Returns { suiteTitle, title }.
// Example: "Immersive Audio — Immersive Audio Metadata"
// => { suiteTitle: "Immersive Audio", title: "Immersive Audio Metadata" }
function splitSuiteTitleOnDash(t) {
  if (!t) return { suiteTitle: null, title: t };
  const s = String(t).trim();

  const m = s.match(/^(.*?)\s*[—–]\s*(.+)$/);
  if (m) return { suiteTitle: m[1].trim() || null, title: m[2].trim() };

  const m2 = s.match(/^(.*?)\s-\s(.+)$/);
  if (m2) return { suiteTitle: m2[1].trim() || null, title: m2[2].trim() };

  return { suiteTitle: null, title: s };
}

const typeMap = {
        AG: 'Administrative Guideline',
        OM: 'Operations Manual',
        ST: 'Standard',
        RP: 'Recommended Practice',
        EG: 'Engineering Guideline',
        RDD: 'Registered Disclosure Document',
        OV: 'Overview Document'
      };

function cliArgValue(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  if (!next || next.startsWith('--')) return fallback;
  return next;
}

const providerArg = cliArgValue('--provider', null);
if (!providerArg) {
  console.error('❌ Missing required --provider <key>. Example: --provider smpte');
  process.exit(1);
}
const providerKey = providerArg.toLowerCase().trim();

const providerConfigs = {
  smpte: {
    label: 'SMPTE',
    seedPath: 'src/main/input/seedUrls.smpte.json',
    discoveryFactory: () => createSmpteDiscovery({
      axios,
      cheerio,
      options: {
        rootUrl: 'https://pub.smpte.org/doc/',
        filterEnabled: true,
        filterPath: 'src/main/input/filterList.smpte.json'
      }
    }),
    parserFactory: ({ onBadRefs }) => createSmpteParser({
      axios,
      cheerio,
      dayjs,
      urlReachable,
      extractRefs,
      mapRefByCite,
      typeMap,
      stripLeadingSmpte,
      stripLeadingDesignatorComma,
      splitSuiteTitleOnDash,
      extractScopeAbstract,
      withNoCache,
      NO_CACHE_HEADERS,
      onBadRefs
    })
  }
};

const activeProvider = providerConfigs[providerKey];
if (!activeProvider) {
  console.error(`❌ Unknown provider "${providerKey}". Supported: ${Object.keys(providerConfigs).join(', ')}`);
  process.exit(1);
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

const discovery = activeProvider.discoveryFactory();
const { discoverFromRootDocPage, normalizeSeedUrl, shouldFilterUrl } = discovery;

async function urlExistsNoRedirect(url) {
  try {
    const res = await axios.head(url, { maxRedirects: 0, validateStatus: null });
    return res.status === 200;
  } catch {
    return false;
  }
}

const metaConfig = {
  parsed: {
    abstract: { confidence: 'high', note: 'Parsed from HTML sec-scope section' },
    docNumber: { confidence: 'high', note: 'Parsed from HTML pubNumber meta tag' },
    docPart: { confidence: 'high', note: 'Parsed from HTML pubPart meta tag' },
    docSuiteTitle: { confidence: 'high', note: 'Parsed from HTML pubSuiteTitle meta tag, or derived from wrapper title for PDF releases' },
    docTitle: { confidence: 'high', note: 'Parsed from HTML pubTitle, or derived from wrapper title for PDF releases' },
    docType: { confidence: 'high', note: 'Publication type parsed from HTML' },
    group: { confidence: 'high', note: 'Working group parsed from HTML pubTC meta tag' },
    publicationDate: { confidence: 'high', note: 'Parsed from HTML pubDateTime meta tag' },
    releaseTag: { confidence: 'high', note: 'Release tag parsed from URL folder structure' },
    publisher: { confidence: 'high', note: 'Parsed from HTML publisher meta tag' },
    'status.stage': { confidence: 'high', note: 'Stage parsed from HTML pubStage meta tag' },
    'status.state': { confidence: 'high', note: 'State parsed from HTML pubState meta tag' },
    'status.amended': { confidence: 'high', note: 'Parsed from wrapper #amendments' },
    'status.amendedBy': { confidence: 'high', note: 'Parsed from wrapper #amendment' },
    'status.stabilized': { confidence: 'high', note: 'Parsed from wrapper #state' },
    'status.withdrawn': { confidence: 'high', note: 'Parsed from wrapper #state' },
    'status.withdrawnNotice': { confidence: 'high', note: 'Parsed from wrapper #withdrawal-statement' },
    references: { confidence: 'high', note: 'Parsed from HTML references sections' },
    revisionOf: { confidence: 'high', note: 'Parsed from HTML pubRevisionOf meta tag' },
    default: { confidence: 'high', note: 'Extracted directly from HTML' }
  },

  inferred: {
    docNumber: { confidence: 'medium', note: 'Inferred from root folder name' },
    docPart: { confidence: 'medium', note: 'Inferred from root folder name' },
    docSuiteTitle: { confidence: 'low', note: 'Not available for inferred releases' },
    docTitle: { confidence: 'low', note: 'Not available for inferred releases' },
    docType: { confidence: 'medium', note: 'Inferred from release folder name' },
    group: { confidence: 'low', note: 'Unknown in inferred release' },
    publicationDate: { confidence: 'medium', note: 'Inferred from release folder name' },
    releaseTag: { confidence: 'high', note: 'Release tag inferred from URL folder structure' },
    publisher: { confidence: 'high', note: 'Static: SMPTE' },
    'status.stage': { confidence: 'medium', note: 'Inferred from release folder name' },
    'status.state': { confidence: 'low', note: 'Unknown in inferred release' },
    references: { confidence: 'low', note: 'Unknown in inferred release' },
    revisionOf: { confidence: 'low', note: 'Unknown in inferred releases' },
    default: { confidence: 'medium', note: '' }
  },

  resolved: {
    docId: { confidence: 'high', note: 'Calculated from parsed/inferred metadata' },
    docLabel: { confidence: 'high', note: 'Constructed from parsed/inferred typenumber/number/date' },
    doi: { confidence: 'medium', note: 'Constructed from parsed/inferred type/date' },
    href: { confidence: 'high', note: 'URL generated and verified via redirect resolution' },
    resolvedHref: { confidence: 'high', note: 'Final URL resolved via URL redirect verification' },
    repo: { confidence: 'high', note: 'Calculated from parsed or inferred publication type/number/part and verified to exist' },
    'status.active': { confidence: 'high', note: 'Calculated from the releaseTag(s) and other status values' },
    'status.latestVersion': { confidence: 'high', note: 'Calculated from the releaseTag(s)' },
    'status.superseded': { confidence: 'high', note: 'Calculated from the releaseTag(s)' },
    'status.supersededBy': { confidence: 'high', note: 'Calculated from the releaseTag(s)' },
    'status.supersededDate': { confidence: 'high', note: 'Calculated as the publication date of the next base release (from releaseTag)' },
    default: { confidence: 'high', note: 'Calculated or verified value' }
  },

  manual: {
    default: { confidence: 'medium' }
  },

  unknown: {
    default: { confidence: 'unknown', note: 'Source unknown' }
  }
};

const badRefs = [];

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
  const meta = {
    source,
    confidence: defaults.confidence,
    note: defaults.note,
    updated: new Date().toISOString(),
    originalValue: oldValue === undefined ? null : oldValue,
    sourceUrl: doc.__sourceUrl,
    version: SCRIPT_VERSION
  };
  if (mode === 'update' && oldValue !== undefined && oldValue !== doc[field]) {
    meta.overridden = true;
  }
  doc[`${field}$meta`] = meta;
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

function normalizeInlineText(input) {
  if (input === null || input === undefined) return null;
  // Cheerio already strips tags with .text(), but we still normalize whitespace and weird NBSPs.
  const s = String(input)
    .replace(/\u00a0/g, ' ')      // nbsp
    .replace(/\s+/g, ' ')        // collapse all whitespace
    .trim();
  return s || null;
}

// Extract the "Scope" section (id is always sec-scope) and use it as a plain-text abstract.
// - Grabs all <p> children under #sec-scope
// - Flattens to plain text (no HTML)
// - Joins multiple paragraphs with "\n"
function extractScopeAbstract($) {
  try {
    const $scope = $('#sec-scope');
    if (!$scope || !$scope.length) return null;

    const paras = [];
    $scope.find('p').each((_, p) => {
      const t = normalizeInlineText($(p).text());
      if (t) paras.push(t);
    });

    if (paras.length) return paras.join('\n');

    // Fallback: if there are no <p> tags for some reason, take the section text.
    return normalizeInlineText($scope.text());
  } catch (_) {
    return null;
  }
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

const parser = activeProvider.parserFactory({
  onBadRefs: (refs) => { if (Array.isArray(refs) && refs.length) badRefs.push(...refs); }
});
const { extractFromSeedDoc, extractFromUrl } = parser;

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
       if (doc.repo && !(await urlExistsNoRedirect(doc.repo))) {
        delete doc.repo;
      }
      injectMetaForDoc(doc, sourceType, 'new');
      if (doc.references) {
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
      // Only persist non-empty arrays and their $meta; drop empties to avoid JSON noise
      if (doc.status && Array.isArray(doc.status.amendedBy)) {
        if (doc.status.amendedBy.length > 0) {
          injectMeta(doc.status, 'amendedBy', sourceType, 'new', []);
        } else {
          delete doc.status.amendedBy;
          delete doc.status['amendedBy$meta'];
        }
      }
      if (doc.status && Array.isArray(doc.status.supersededBy)) {
        if (doc.status.supersededBy.length > 0) {
          injectMeta(doc.status, 'supersededBy', 'resolved', 'new', []);
        } else {
          delete doc.status.supersededBy;
          delete doc.status['supersededBy$meta'];
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
            // Handle supersededBy (array) similarly
            if (Array.isArray(newVal.supersededBy)) {
              const oldSB = Array.isArray(oldValues?.status?.supersededBy) ? oldValues.status.supersededBy : [];
              const newSB = newVal.supersededBy;
              const sameSB = JSON.stringify(oldSB) === JSON.stringify(newSB);
              if (!sameSB) {
                if (newSB.length > 0) {
                  const resSB = updateFieldGuarded(existingDoc, 'status.supersededBy', newSB, { incomingSource: 'resolved', log: true });
                  if (resSB.updated) {
                    injectMeta(existingDoc.status, 'supersededBy', 'resolved', 'update', oldSB);
                    if (!changedFields.includes('status')) changedFields.push('status');
                  }
                } else {
                  if (canUpdateFieldWithMetaGuard(existingDoc, 'status.supersededBy')) {
                    delete existingDoc.status.supersededBy;
                    delete existingDoc.status['supersededBy$meta'];
                    if (!changedFields.includes('status')) changedFields.push('status');
                  }
                }
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

  if (badRefs.length > 0) {
    console.log('🚫 Unparseable References Found:');
    badRefs.forEach(ref => {
      console.log(`- From ${ref.docId} (${ref.type}):`);
      console.log(`  - cite: ${ref.refText}`);
      if (ref.href) console.log(`  - href: ${ref.href}`);
    });
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
      fullDetailsLines.push(`  - cite: ${ref.refText}`);
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
      prLines.push(`  - cite: ${ref.refText}`);
      if (ref.href) prLines.push(`  - href: ${ref.href}`);
    });
    prLines.push('');
  }

  fs.writeFileSync(prLogPath, prLines.join('\n'));
  console.log(`\n📄 PR log updated: ${prLogPath}`);
  console.log(`📄 Full PR log details saved: ${fullDetailsPath}`);
  console.log(`🔗 Full details (raw): ${detailsFileRawUrl}`);

})();
