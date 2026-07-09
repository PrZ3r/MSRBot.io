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

// meeting-report tier review 2026-07-09: listings → future-events; Almanac
// consolidates with the 57 already in info-society. Progress-Committee
// reports and Technical-Conference entries stay meeting-report per review.
const TITLE_RULES = [
  [/^forthcoming professional meetings/i, 'future-events'],
  [/^meetings of other societies/i, 'future-events'],
  [/^smpte almanac/i, 'info-society'],
];

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
  // opinion-tier review 2026-07-09: Welcome Letter = officer letter.
  // (Other flagged opinions + errata questions reviewed and LEFT as-is.)
  '10.5594-J17569': 'info-society',    // 142nd Tech Conference: Welcome Letter
  // obit-tier review 2026-07-09: standards text misfiled under obituaries
  '10.5594-J03238': 'content-announce', // Cinematography — A-Chain Frequency Response (standard)
  // toc-tier strays (29 pre-rebucket HIGHWIRE 'toc' labels), classified 2026-07-09:
  // covers
  '10.5594-J00802C1': 'front-cover', '10.5594-J08010C1': 'front-cover',
  '10.5594-J09469C1': 'front-cover', '10.5594-J09686C1': 'front-cover',
  '10.5594-J18041C1': 'front-cover', '10.5594-J18047C1': 'front-cover',
  '10.5594-j18363C1': 'front-cover', '10.5594-j18438C1': 'front-cover',
  // journal editorial columns
  '10.5594-J008023': 'editorial', '10.5594-J09686208': 'editorial', '10.5594-j184382': 'editorial',
  // membership / sustaining-member pages
  '10.5594-j18364': 'info-society', '10.5594-j18439': 'info-society',
  '10.5594-j18373': 'info-society', '10.5594-j18374': 'info-society',
  '10.5594-j18457': 'info-society', '10.5594-j18458': 'info-society',
  // 2014 MIJ progress-report issue: industry committee reports + section meetings
  '10.5594-j18366': 'meeting-report', '10.5594-j18441': 'meeting-report',
  '10.5594-j18365': 'meeting-report', '10.5594-j18443': 'meeting-report',
  '10.5594-j18444': 'meeting-report', '10.5594-j18445': 'meeting-report',
  '10.5594-j18447': 'meeting-report', '10.5594-j18448': 'meeting-report',
  '10.5594-j18453': 'meeting-report', '10.5594-j18454': 'meeting-report',
  // singles
  '10.5594-j18440': 'orig-research',  // Making Do with More: Next Generation Workflow
  '10.5594-j18455': 'obit',           // Obituary
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
  } else {
    for (const [re, target] of TITLE_RULES) {
      if (re.test(String(doc.docTitle).trim())) { to = target; why = `Title-rule 2026-07-09 (meeting-report tier review): → ${target}`; break; }
    }
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
