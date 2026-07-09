/*
 * conformArticleTypeVocab.js — conform registry articleType values to the
 * SMPTE ContentTypeEnum vocabulary (2026-07-09 decision).
 *
 * The registry vocabulary becomes SMPTE's enum PLUS nine retained
 * MSRBot-finer values the user chose to keep for filter granularity:
 *   meeting-report, news, other, editorial, discussion, review-article,
 *   introduction, oration, article-commentary
 *
 * Value renames applied (registry → SMPTE enum):
 *   research-article → orig-research
 *   abstract         → summary-abstract
 *   obituary         → obit
 *   book-review      → review
 *   calendar         → future-events
 *   announcement     → content-announce
 *   correction       → errata
 *   letter           → opinion
 *   addendum         → errata
 *   reprint          → orig-research
 *
 * articleType is 100% SMPTE-populated (verified 24,209 docs), so no other
 * publisher is affected. Original value preserved in $meta.originalValue.
 *
 * Usage:
 *   node .../conformArticleTypeVocab.js            # dry-run
 *   node .../conformArticleTypeVocab.js --apply
 *
 * Report: src/main/reports/smpte-canonical-audit/articleTypeConform.md
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../../lib/registry');

const REPORTS = 'src/main/reports/smpte-canonical-audit';
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const VERSION = 'articletype-conform@v1';

const RENAMES = new Map(Object.entries({
  'research-article': 'orig-research',
  'abstract': 'summary-abstract',
  'obituary': 'obit',
  'book-review': 'review',
  'calendar': 'future-events',
  'announcement': 'content-announce',
  'correction': 'errata',
  'letter': 'opinion',
  'addendum': 'errata',
  'reprint': 'orig-research',
}));

const docs = loadAllDocs();
const changes = [];
const locked = [];
const tally = {};
for (const doc of docs) {
  const at = doc.articleType;
  if (!at || !RENAMES.has(at)) continue;
  const meta = doc['articleType$meta'];
  if (meta && meta.excludeChanges === true) { locked.push(doc.docId); continue; }
  changes.push({ doc, from: at, to: RENAMES.get(at) });
  const key = `${at} → ${RENAMES.get(at)}`;
  tally[key] = (tally[key] || 0) + 1;
}

console.log(`[conform] docs to rename: ${changes.length} | locked: ${locked.length}`);
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(40)} ${n}`);

const md = [];
md.push('# articleType vocabulary conformance — SMPTE ContentTypeEnum superset');
md.push('');
md.push(`> Generated: ${NOW}`);
md.push(`> Mode: **${APPLY ? 'APPLY' : 'DRY-RUN'}**`);
md.push('');
md.push('Registry vocabulary = SMPTE ContentTypeEnum + 9 retained MSRBot values');
md.push('(meeting-report, news, other, editorial, discussion, review-article, introduction, oration, article-commentary).');
md.push('');
md.push('| rename | docs |');
md.push('|---|---:|');
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) md.push(`| \`${k}\` | ${n} |`);
md.push(`| **total** | **${changes.length}** |`);
md.push('');
md.push(`Locked ($meta.excludeChanges): ${locked.length}`);
fs.writeFileSync(path.join(REPORTS, 'articleTypeConform.md'), md.join('\n') + '\n');
console.log(`[conform] wrote ${path.join(REPORTS, 'articleTypeConform.md')}`);

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

if (!APPLY) {
  console.log(`\nDry run — pass --apply to rename articleType on ${changes.length} docs.`);
  process.exit(0);
}

let written = 0;
for (const { doc, from, to } of changes) {
  doc.articleType = to;
  doc['articleType$meta'] = {
    source: 'resolved',
    confidence: 'high',
    note: `Vocabulary conformance to SMPTE ContentTypeEnum (2026-07-09): '${from}' renamed to '${to}'. Registry vocab = SMPTE enum + 9 retained MSRBot values.`,
    originalValue: from,
    updated: NOW,
    version: VERSION,
  };
  const sorted = sortKeysDeep(doc);
  const target = docAbsPath(sorted);
  fs.writeFileSync(target, JSON.stringify(sorted, null, 2) + '\n');
  written++;
}
console.log(`\nApplied ${written} articleType renames.`);
console.log('Reminder: npm run canonicalize && npm run validate, then commit.');
