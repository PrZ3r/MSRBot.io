/*
 * fixSummaryAbstractPapers.js — flip mislabeled papers to orig-research.
 *
 * Two user-reviewed fixes (2026-07-09):
 *
 * 1. All docs with contentType 'summary-abstract' (1,501 Conference Paper +
 *    3 Journal Article) are canonical-confirmed orig-research. The HIGHWIRE
 *    pipeline had labeled them 'abstract' — an artifact of that delivery,
 *    not what the documents are; the vocab conformance carried it into
 *    'summary-abstract'.
 *
 * 2. 10.5594-M001489 ("Gamut Mapping for Digital Cinema"): canonical says
 *    info-society, which is WRONG (clearly a technical paper) — user
 *    override to orig-research. Also a push-back item: canonical mislabel.
 *
 * Usage:
 *   node .../fixSummaryAbstractPapers.js            # dry-run
 *   node .../fixSummaryAbstractPapers.js --apply
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../../lib/registry');

const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const VERSION = 'contenttype-fixes@v1';

const OVERRIDES = new Map([
  ['10.5594-M001489', { to: 'orig-research', note: 'User override 2026-07-09: technical paper; canonical info-society label is wrong (push-back item)' }],
]);

// Title-review exceptions (2026-07-09): summary-abstract docs whose titles
// show they are NOT research papers. Everything else in the summary-abstract
// set flips to orig-research.
const TITLE_EXCEPTIONS = new Map([
  // Panel discussions + transcripts → discussion
  ...['10.5594-M00194', '10.5594-M00417', '10.5594-M00427', '10.5594-M00453',
      '10.5594-M00562', '10.5594-M00585', '10.5594-M00642', '10.5594-M00666',
      '10.5594-M00691', '10.5594-M00707', '10.5594-M00822', '10.5594-M00933',
      '10.5594-M001286'].map(id => [id, 'discussion']),
  // Keynotes / addresses / remarks → oration
  ...['10.5594-M001229', '10.5594-M001230', '10.5594-M00667', '10.5594-M00520']
      .map(id => [id, 'oration']),
  // Tutorials → tutorial
  ...['10.5594-M001483', '10.5594-M001568', '10.5594-M00242', '10.5594-M00715']
      .map(id => [id, 'tutorial']),
  // Forewords / prefaces / introductions → introduction
  ...['10.5594-M00093', '10.5594-M00176', '10.5594-M00195', '10.5594-M001118',
      '10.5594-M001276', '10.5594-M00196', '10.5594-M001277'].map(id => [id, 'introduction']),
]);

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

const docs = loadAllDocs();
const changes = [];
for (const doc of docs) {
  const field = doc.contentType !== undefined ? 'contentType' : (doc.articleType !== undefined ? 'articleType' : null);
  if (!field) continue;
  const cur = doc[field];
  const meta = doc[`${field}$meta`];
  if (meta && meta.excludeChanges === true) continue;
  if (cur === 'summary-abstract') {
    const exc = TITLE_EXCEPTIONS.get(doc.docId);
    if (exc) {
      changes.push({ doc, field, from: cur, to: exc, note: `Title review 2026-07-09: not a research paper — reclassified '${exc}'` });
    } else {
      changes.push({ doc, field, from: cur, to: 'orig-research', note: 'Canonical-confirmed full paper (summary-abstract set is orig-research in the SMPTE canonical repos); HIGHWIRE-era abstract label was a delivery artifact' });
    }
  } else if (OVERRIDES.has(doc.docId)) {
    const o = OVERRIDES.get(doc.docId);
    if (cur !== o.to) changes.push({ doc, field, from: cur, to: o.to, note: o.note });
  }
}
const tally = {};
for (const c of changes) tally[`${c.from} → ${c.to}`] = (tally[`${c.from} → ${c.to}`] || 0) + 1;
console.log(`[fix] docs to update: ${changes.length}`);
for (const [k, n] of Object.entries(tally)) console.log(`  ${k.padEnd(40)} ${n}`);
// which field name is live?
const fieldNames = new Set(changes.map(c => c.field));
console.log(`[fix] writing to field(s): ${[...fieldNames].join(', ')}`);

if (!APPLY) {
  console.log(`\nDry run — pass --apply to write ${changes.length} fixes.`);
  process.exit(0);
}

let written = 0;
for (const { doc, field, from, to, note } of changes) {
  doc[field] = to;
  doc[`${field}$meta`] = {
    source: 'resolved',
    confidence: 'high',
    note,
    originalValue: from,
    updated: NOW,
    version: VERSION,
  };
  const sorted = sortKeysDeep(doc);
  fs.writeFileSync(docAbsPath(sorted), JSON.stringify(sorted, null, 2) + '\n');
  written++;
}
console.log(`\nApplied ${written} contentType fixes.`);
console.log('Reminder: npm run canonicalize && npm run validate, then commit.');
