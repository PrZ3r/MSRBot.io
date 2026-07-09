/*
 * fixInfoSocietyTier.js — info-society tier consolidation (2026-07-09
 * review, all groups user-approved).
 *
 * A. Precedent-following:
 *      Section Meetings → meeting-report · News / Engineering News → news ·
 *      Calendar → future-events · Ad page → advert ·
 *      Officers / Committees → list-staff
 * B. New rulings:
 *      Abstracts family (incl. Résumés/Resumenes) → summary-abstract ·
 *      Standards & RP family → content-announce ·
 *      SMPTE Marketplace → advert ·
 *      Dated Tech-Conference announcements → future-events
 *
 * Rules apply ONLY to docs currently contentType='info-society'.
 *
 * Usage:
 *   node .../fixInfoSocietyTier.js            # dry-run
 *   node .../fixInfoSocietyTier.js --apply
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
  // A — precedent
  [/^section meetings?$/i, 'meeting-report'],
  [/^news$|^engineering news$/i, 'news'],
  [/^calendar$/i, 'future-events'],
  [/^ad page/i, 'advert'],
  [/^officers\b|engineers: officers|^committees\b/i, 'list-staff'],
  // B — 2026-07-09 rulings
  [/^abstracts$|^abstracts of papers from other journals|^r(é|e)sum(é|e)s/i, 'summary-abstract'],
  [/^standards (and|&) recommended practices$|^smpte recommended practices?\b|^proposed smpte recommended practices?\b/i, 'content-announce'],
  [/^smpte marketplace/i, 'advert'],
  [/^\d+(st|nd|rd|th) smpte technical conference and equipment exhibit/i, 'future-events'],
];

const docs = loadAllDocs();
const changes = [];
const tally = {};
for (const doc of docs) {
  if (doc.contentType !== 'info-society') continue;
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
console.log(`[info-society] changes: ${changes.length}`);
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
    note: `info-society tier consolidation 2026-07-09: → ${to}`,
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
