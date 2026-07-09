'use strict';

/**
 * Page gate — contentType-based exclusion of rendered site pages.
 *
 * Documents whose `contentType` is listed in `siteConfig.noPageContentTypes`
 * are gated: they get no rendered HTML detail page, no reference-tree page,
 * no sitemap entry, and no row in the browse/search index. They remain fully
 * present in the API JSON (`/api/documents.json`, `/api/doc/{id}.json`) and in
 * the registry data — the gate only suppresses generated pages, not data.
 *
 * contentType is only ever set on journal-article docs, so standards, RPs,
 * EGs and other doc types are never affected by this gate.
 */

/** Build a normalized (lowercased, trimmed) Set of gated contentType values. */
function noPageContentTypeSet(siteConfig) {
  const list = siteConfig && Array.isArray(siteConfig.noPageContentTypes)
    ? siteConfig.noPageContentTypes
    : [];
  return new Set(
    list.map(t => String(t || '').toLowerCase().trim()).filter(Boolean)
  );
}

/**
 * True when `doc` should NOT get a rendered page.
 * @param {object} doc - a document record
 * @param {Set<string>|object} setOrConfig - a Set from noPageContentTypeSet(),
 *        or a siteConfig object (a Set is built on the fly).
 */
function isPageGated(doc, setOrConfig) {
  if (!doc) return false;
  const set = setOrConfig instanceof Set
    ? setOrConfig
    : noPageContentTypeSet(setOrConfig);
  if (set.size === 0) return false;
  const at = String(doc.contentType || '').toLowerCase().trim();
  return at !== '' && set.has(at);
}

module.exports = { noPageContentTypeSet, isPageGated };
