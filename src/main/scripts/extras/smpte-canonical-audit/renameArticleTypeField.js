/*
 * renameArticleTypeField.js — registry field rename articleType → contentType.
 *
 * Completes the 2026-07-09 conformance decision: values already conform to
 * the SMPTE ContentTypeEnum superset; this renames the FIELD itself so the
 * registry speaks SMPTE's dialect end-to-end. Code surfaces (templates,
 * search index, page gate, client JS, schema, site.json keys) renamed in the
 * same PR; old ?f.articleType= URLs alias to contentType in docList.js.
 *
 * Per doc: contentType = articleType, contentType$meta = articleType$meta
 * (moved verbatim — provenance history preserved, not restamped), old keys
 * deleted.
 *
 * Usage:
 *   node .../renameArticleTypeField.js            # dry-run
 *   node .../renameArticleTypeField.js --apply
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../../lib/registry');

const APPLY = process.argv.includes('--apply');

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
let candidates = 0, withMeta = 0, collisions = 0;
const toWrite = [];
for (const doc of docs) {
  if (doc.articleType === undefined && doc['articleType$meta'] === undefined) continue;
  candidates++;
  if (doc.contentType !== undefined) { collisions++; console.error(`  collision: ${doc.docId} already has contentType`); continue; }
  if (doc['articleType$meta'] !== undefined) withMeta++;
  toWrite.push(doc);
}
console.log(`[rename] docs with articleType: ${candidates} (with $meta: ${withMeta}) | collisions: ${collisions}`);

if (!APPLY) {
  console.log(`\nDry run — pass --apply to rename the field on ${toWrite.length} docs.`);
  process.exit(0);
}

let written = 0;
for (const doc of toWrite) {
  if (doc.articleType !== undefined) {
    doc.contentType = doc.articleType;
    delete doc.articleType;
  }
  if (doc['articleType$meta'] !== undefined) {
    doc['contentType$meta'] = doc['articleType$meta'];
    delete doc['articleType$meta'];
  }
  const sorted = sortKeysDeep(doc);
  fs.writeFileSync(docAbsPath(sorted), JSON.stringify(sorted, null, 2) + '\n');
  written++;
}
console.log(`\nRenamed articleType → contentType on ${written} docs.`);
console.log('Reminder: npm run canonicalize && npm run validate, then commit.');
