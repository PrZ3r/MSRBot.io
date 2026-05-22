'use strict';

/**
 * Page gate — articleType-based exclusion of rendered site pages.
 *
 * Documents whose `articleType` is listed in `siteConfig.noPageArticleTypes`
 * are gated: they get no rendered HTML detail page, no reference-tree page,
 * no sitemap entry, and no row in the browse/search index. They remain fully
 * present in the API JSON (`/api/documents.json`, `/api/doc/{id}.json`) and in
 * the registry data — the gate only suppresses generated pages, not data.
 *
 * articleType is only ever set on journal-article docs, so standards, RPs,
 * EGs and other doc types are never affected by this gate.
 */

/** Build a normalized (lowercased, trimmed) Set of gated articleType values. */
function noPageArticleTypeSet(siteConfig) {
  const list = siteConfig && Array.isArray(siteConfig.noPageArticleTypes)
    ? siteConfig.noPageArticleTypes
    : [];
  return new Set(
    list.map(t => String(t || '').toLowerCase().trim()).filter(Boolean)
  );
}

/**
 * True when `doc` should NOT get a rendered page.
 * @param {object} doc - a document record
 * @param {Set<string>|object} setOrConfig - a Set from noPageArticleTypeSet(),
 *        or a siteConfig object (a Set is built on the fly).
 */
function isPageGated(doc, setOrConfig) {
  if (!doc) return false;
  const set = setOrConfig instanceof Set
    ? setOrConfig
    : noPageArticleTypeSet(setOrConfig);
  if (set.size === 0) return false;
  const at = String(doc.articleType || '').toLowerCase().trim();
  return at !== '' && set.has(at);
}

module.exports = { noPageArticleTypeSet, isPageGated };
