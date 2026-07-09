/*
 * fixOrigResearchTier.js — inverse scan of orig-research (2026-07-09
 * review): society/departmental content hiding among papers.
 *
 * User rulings: Full Issue PDF → toc · Additional Reading Online →
 * info-society · Awards Presentation → awards (first use of the enum
 * value) · everything else follows tier precedents. Multi-part paper
 * series (Stability of Cellulose Ester…) confirmed genuine and untouched.
 *
 * Rules apply ONLY to docs currently contentType='orig-research'.
 *
 * Usage:
 *   node .../fixOrigResearchTier.js            # dry-run
 *   node .../fixOrigResearchTier.js --apply
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../../lib/registry');

const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const VERSION = 'contenttype-fixes@v1';

const RULES = [
  // committee / progress-report machinery → meeting-report
  [/^section (meetings?|reports?)$/i, 'meeting-report'],
  [/^report of (the )?.*committee/i, 'meeting-report'],
  [/^progress committee report/i, 'meeting-report'],
  [/^progress in the motion picture industry/i, 'meeting-report'],
  [/^(motion pictures|television|education|educational|international|engineering report|photoinstrumentation)$/i, 'meeting-report'],
  [/^engineering committees activities/i, 'meeting-report'],
  [/^international standardization/i, 'meeting-report'],
  [/^board of governors$/i, 'meeting-report'],
  // standards texts / listings → content-announce
  [/^standards (and|&) recommended practices$/i, 'content-announce'],
  [/^proposed smpte standards?$/i, 'content-announce'],
  // front-matter → introduction
  [/^foreword$|^preface$/i, 'introduction'],
  // memorial
  [/^obituar(y|ies)$/i, 'obit'],
  // awards — first use of the enum value
  [/^awards presentation/i, 'awards'],
  // whole-issue compilation docs → toc (user ruling)
  [/^full issue pdf$/i, 'toc'],
  // society departments → info-society
  [/^current literature/i, 'info-society'],
  [/^information for authors$/i, 'info-society'],
  [/^smpte biographical sketch/i, 'info-society'],
  [/^sustaining members/i, 'info-society'],
  [/^employment service$/i, 'info-society'],
  [/^society announcements?\b/i, 'info-society'],
  [/^welcome by the president/i, 'info-society'],
  [/^classified membership list$/i, 'info-society'],
  [/^additional reading online$/i, 'info-society'],
];

const docs = loadAllDocs();
const changes = [];
const tally = {};
for (const doc of docs) {
  if (doc.contentType !== 'orig-research') continue;
  const meta = doc['contentType$meta'];
  if (meta && meta.excludeChanges === true) continue;
  const t = String(doc.docTitle || '').trim();
  for (const [re, to] of RULES) {
    if (!re.test(t)) continue;
    changes.push({ doc, from: doc.contentType, to });
    const k = `→ ${to}`;
    tally[k] = (tally[k] || 0) + 1;
    break;
  }
}
console.log(`[orig-research] changes: ${changes.length}`);
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} ${n}`);

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
  console.log(`\nDry run — pass --apply to write ${changes.length} moves.`);
  process.exit(0);
}

let written = 0;
for (const { doc, from, to } of changes) {
  doc.contentType = to;
  doc['contentType$meta'] = {
    source: 'resolved',
    confidence: 'high',
    note: `orig-research inverse-scan 2026-07-09: departmental/society content → ${to}`,
    originalValue: from,
    updated: NOW,
    version: VERSION,
  };
  const sorted = sortKeysDeep(doc);
  fs.writeFileSync(docAbsPath(sorted), JSON.stringify(sorted, null, 2) + '\n');
  written++;
}
console.log(`\nApplied ${written} moves.`);
console.log('Reminder: npm run canonicalize && npm run validate, then commit.');
