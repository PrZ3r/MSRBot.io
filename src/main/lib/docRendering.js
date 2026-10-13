'use strict';

/**
 * Doc rendering config — how documents are filed, labelled, cited and browsed
 * (src/main/config/docRendering.json), plus the citation templates
 * (src/main/templates/citations/<style>.<variant>.hbs).
 *
 *   docTypes:     { "Book": { "titleLabel": true, "nonLineage": true } }
 *     titleLabel — cited and listed title-first; the registry files these
 *                  docs under a {year}/ folder (src/main/lib/registry.js).
 *     nonLineage — not part of an edition lineage (no supersession chain);
 *                  citations carry authors, publisher and year.
 *   contentTypes: { "advert": { "label": "Advertisement", "noPage": true } }
 *     label      — the display name for the contentType.
 *     noPage     — no rendered doc page and not in the browse/search index.
 *   facets:       the hand-curated keyword chips on the doc list (minDocs/add/remove).
 *
 * loadDocRendering() returns the flat lists the build, registry and indexes
 * read (nonLineageDocTypes, titleLabelDocTypes, contentTypeLabels,
 * noPageContentTypes, facetKeywordCuration) and `citations`
 * ({ style: { variant: template source } }).
 */

const fs = require('fs');
const path = require('path');

const DOC_RENDERING_PATH = path.join(__dirname, '..', 'config', 'docRendering.json');
const CITATIONS_DIR = path.join(__dirname, '..', 'templates', 'citations');

// <style>.<variant>.hbs → { style: { variant: source } }. A template file ends
// with one newline that is not part of the citation, so it is dropped.
function loadCitationTemplates(dir = CITATIONS_DIR) {
  const out = {};
  for (const f of fs.readdirSync(dir).sort()) {
    const m = /^([^.]+)\.([^.]+)\.hbs$/.exec(f);
    if (!m) continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\n$/, '');
    (out[m[1]] = out[m[1]] || {})[m[2]] = src;
  }
  return out;
}

function loadDocRendering(file = DOC_RENDERING_PATH, citationsDir = CITATIONS_DIR) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const docTypes = data.docTypes || {};
  const contentTypes = data.contentTypes || {};
  const flagged = (map, flag) => Object.keys(map).filter((k) => map[k] && map[k][flag]);
  const contentTypeLabels = {};
  for (const [k, v] of Object.entries(contentTypes)) if (v && v.label) contentTypeLabels[k] = v.label;
  return {
    nonLineageDocTypes: flagged(docTypes, 'nonLineage'),
    titleLabelDocTypes: flagged(docTypes, 'titleLabel'),
    contentTypeLabels,
    noPageContentTypes: flagged(contentTypes, 'noPage'),
    facetKeywordCuration: data.facets || {},
    citations: loadCitationTemplates(citationsDir),
  };
}

module.exports = { DOC_RENDERING_PATH, CITATIONS_DIR, loadDocRendering, loadCitationTemplates };
