/*
 * fixSmallBuckets.js — small-bucket contentType cleanup (2026-07-09 review,
 * going down the distribution small → big).
 *
 * 1. RULE: every "Message from the …" / "An Appeal from the …-President"
 *    title → info-society, regardless of current contentType. User ruling:
 *    all officer messages are society information, matching the earlier
 *    Executive-Director exclusion. Catches 53 docs beyond the editorial
 *    bucket (most mislabeled orig-research, two even toc).
 *
 * 2. Explicit fixes from the tiny-bucket review:
 *    - 'other' (10) empties entirely
 *    - J05342 "5 Studio Object Model" — numbered report section, not an oration
 *    - J09874 Fifty-Second Semi-Annual Meeting — meeting-report
 *    - J17139 The Task Force Final Report — the report itself, not an intro
 *
 * Usage:
 *   node .../fixSmallBuckets.js            # dry-run
 *   node .../fixSmallBuckets.js --apply
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../../lib/registry');

const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const VERSION = 'contenttype-fixes@v1';

const MESSAGE_RULE = /\bmessage from the\b|an appeal from the .*vice[- ]president/i;

const EXPLICIT = new Map(Object.entries({
  // 'other' bucket (empties it)
  '10.5594-J18230': 'list-staff',      // Officers 1922–1923
  '10.5594-J18231': 'list-staff',      // Committees 1922–1923
  '10.5594-J18232': 'list-staff',      // Membership List
  '10.5594-J18229': 'toc',             // Index—Transactions 1916–1923
  '10.5594-J18233': 'info-society',    // Constitution and By-Laws
  '10.5594-J01792': 'info-society',    // Journal on Microfilm
  '10.5594-J18234': 'info-society',    // President's Address (user: def info-society)
  '10.5594-J18027': 'orig-research',   // Motion Picture Standards (1917)
  '10.5594-J18028': 'orig-research',   // Motion Picture Nomenclature (1917)
  '10.5594-J18049': 'orig-research',   // Standardization (1916)
  // singleton misfits
  '10.5594-J05342': 'orig-research',   // "5 Studio Object Model" — not an oration
  '10.5594-J09874': 'meeting-report',  // Fifty-Second Semi-Annual Meeting
  '10.5594-J17139': 'orig-research',   // The Task Force Final Report
}));

const docs = loadAllDocs();
const changes = [];
const tally = {};
for (const doc of docs) {
  if (!doc.contentType) continue;
  const meta = doc['contentType$meta'];
  if (meta && meta.excludeChanges === true) continue;
  let to = null, why = null;
  if (EXPLICIT.has(doc.docId)) {
    to = EXPLICIT.get(doc.docId);
    why = 'Small-bucket review 2026-07-09 (explicit)';
  } else if (MESSAGE_RULE.test(String(doc.docTitle))) {
    to = 'info-society';
    why = "Officer-message rule 2026-07-09: all 'Message from the …' titles are society information";
  }
  if (!to || doc.contentType === to) continue;
  changes.push({ doc, from: doc.contentType, to, why });
  const k = `${doc.contentType} → ${to}`;
  tally[k] = (tally[k] || 0) + 1;
}
console.log(`[small-buckets] changes: ${changes.length}`);
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(38)} ${n}`);

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
  console.log(`\nDry run — pass --apply to write ${changes.length} fixes.`);
  process.exit(0);
}

let written = 0;
for (const { doc, from, to, why } of changes) {
  doc.contentType = to;
  doc['contentType$meta'] = {
    source: 'resolved',
    confidence: 'high',
    note: why,
    originalValue: from,
    updated: NOW,
    version: VERSION,
  };
  const sorted = sortKeysDeep(doc);
  fs.writeFileSync(docAbsPath(sorted), JSON.stringify(sorted, null, 2) + '\n');
  written++;
}
console.log(`\nApplied ${written} fixes.`);
console.log('Reminder: npm run canonicalize && npm run validate, then commit.');
