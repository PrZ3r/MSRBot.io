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

/*
 * registry.js — single point of access to the per-doc document registry.
 *
 * The source of truth is a directory of one-JSON-file-per-document, sharded by
 * publisher / docType:
 *
 *   src/main/data/docs/{publisher}/{docType}/{docId}.json
 *
 * A year third-shard is inserted for non-lineage docTypes (those not tracked in
 * the Master Suite Index — Journal Article, Book, White Paper, etc.). Such docs
 * have no suite/lineage, so they are browsed by year rather than by suite:
 *
 *   src/main/data/docs/{publisher}/{docType}/{year}/{docId}.json
 *
 * The monolithic documents.json, per-publisher/type slices, and the per-docId
 * API are all build artifacts assembled from loadAllDocs() — never hand-edited.
 */

const fs = require('fs');
const path = require('path');

const DOCS_ROOT = path.resolve('src/main/data/docs');

// Year third-shard: docTypes identified by title (literature browsed by year)
// rather than by docId — Book, Journal Article, Patent, White Paper, etc. The
// single source of truth is site.json's titleLabelDocTypes list; a doc of such
// a docType gets a {publisher}/{docType}/{year}/{docId}.json shard. Editing
// that list and re-running `npm run canonicalize` re-homes affected docs.
const SITE_CONFIG = require('../config/site.json');
const YEAR_SHARDED_DOCTYPES = new Set(
  Array.isArray(SITE_CONFIG.titleLabelDocTypes) ? SITE_CONFIG.titleLabelDocTypes : []
);

/**
 * slug(value) — the one deterministic, filesystem-safe slug used for every path
 * component (publisher, docType, docId). Pure: never consults site.json.
 * Blank / unresolvable input maps to the reserved "_unknown" slug.
 */
function slug(value) {
  const s = String(value == null ? '' : value).trim();
  if (s === '') return '_unknown';
  const out = s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
  return out === '' ? '_unknown' : out;
}

/**
 * docIdSlug(docId) — filename component for a doc. Unlike slug(), this is a
 * *gentle* sanitizer: SMPTE-style docIds (`SMPTE.ST274.2005`) are already
 * filesystem-safe, so case, dots and hyphens are preserved — only path-unsafe
 * characters (slashes, whitespace, etc.) are replaced. This keeps docIds that
 * differ only in `.` vs `-` (e.g. `SMPTE.RP27-3.1989` vs `SMPTE.RP27.3.1989`)
 * as distinct files. Blank input maps to the reserved "_unknown" slug.
 */
function docIdSlug(value) {
  const s = String(value == null ? '' : value).trim();
  if (s === '') return '_unknown';
  const out = s
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '');
  return out === '' ? '_unknown' : out;
}

function isYearSharded(doc) {
  return YEAR_SHARDED_DOCTYPES.has(String(doc.docType == null ? '' : doc.docType).trim());
}

function yearOf(doc) {
  const m = String(doc.publicationDate || '').match(/^(\d{4})/);
  return m ? m[1] : '_undated';
}

/**
 * docPath(doc) — registry-relative path for a doc, derived purely from its own
 * publisher / docType / docId fields (decision 2: the in-file field is the
 * source of truth for placement).
 */
function docPath(doc) {
  const parts = [slug(doc.publisher), slug(doc.docType)];
  if (isYearSharded(doc)) parts.push(yearOf(doc));
  parts.push(`${docIdSlug(doc.docId)}.json`);
  return path.join(...parts);
}

/** Absolute path for a doc under DOCS_ROOT. */
function docAbsPath(doc) {
  return path.join(DOCS_ROOT, docPath(doc));
}

/** Recursively collect every *.json file path under a directory. */
function walkJsonFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return out;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * loadAllDocs() — glob + parse every per-doc file, returning the array in the
 * same in-memory shape (and docId sort order) tools used with documents.json.
 */
function loadAllDocs() {
  const docs = walkJsonFiles(DOCS_ROOT).map((file) => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse registry file ${file}: ${err.message}`);
    }
  });
  // Sort by docId case-sensitive — SMPTE registers `10.5594/J*` and
  // `10.5594/j*` as distinct DOIs pointing to different articles, so the
  // registry intentionally keeps both forms at separate positions. Matches
  // the case-sensitive sort-order invariant in documents.validate.js.
  docs.sort((a, b) => {
    const A = String(a.docId);
    const B = String(b.docId);
    return A < B ? -1 : A > B ? 1 : 0;
  });
  return docs;
}

// Lazily-built docId -> absolute file path index (memoized; invalidated on write).
let _index = null;

function buildIndex() {
  const map = new Map();
  for (const file of walkJsonFiles(DOCS_ROOT)) {
    try {
      const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (doc && doc.docId != null) map.set(String(doc.docId), file);
    } catch {
      /* parse errors surface via loadAllDocs/validate */
    }
  }
  return map;
}

function getIndex() {
  if (!_index) _index = buildIndex();
  return _index;
}

/** Invalidate the docId index after a mutation. */
function invalidateIndex() {
  _index = null;
}

/** loadDoc(docId) — single-doc read; null if absent. */
function loadDoc(docId) {
  const file = getIndex().get(String(docId));
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * saveDoc(doc) — single-doc write, routed to the shard path derived from the
 * doc's own fields. If the doc already lives at a different path (publisher /
 * docType / docId changed), the stale file is removed (re-homed).
 * Returns { path, created, rehomed }.
 */
function saveDoc(doc) {
  const target = docAbsPath(doc);
  const prior = getIndex().get(String(doc.docId));
  const rehomed = !!prior && path.resolve(prior) !== path.resolve(target);
  const created = !prior;

  if (rehomed) {
    try { fs.unlinkSync(prior); } catch { /* already gone */ }
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');

  // Incrementally update the index rather than invalidating it. getIndex()
  // above already materialized _index, so we patch the single affected entry
  // (docId -> new path) in place. Blowing the whole index away here forced the
  // *next* saveDoc() to re-walk and re-parse the entire ~26k-file corpus, which
  // turned any save loop (e.g. url.normalize --apply) into O(docs × corpus) and
  // wedged CI for hours. Patching one key keeps a save loop O(docs).
  _index.set(String(doc.docId), target);
  return { path: target, created, rehomed };
}

module.exports = {
  DOCS_ROOT,
  YEAR_SHARDED_DOCTYPES,
  slug,
  docIdSlug,
  docPath,
  docAbsPath,
  isYearSharded,
  yearOf,
  loadAllDocs,
  loadDoc,
  saveDoc,
  invalidateIndex,
  walkJsonFiles,
};
