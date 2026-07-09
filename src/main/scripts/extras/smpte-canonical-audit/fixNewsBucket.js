/*
 * fixNewsBucket.js — news-tier consolidation (2026-07-09 review).
 *
 * A. Precedent-following moves out of news:
 *      Section Reports/Meetings → meeting-report · Advertisers Index →
 *      advert · membership pages / Information for Authors / Biographical
 *      Notes / Employment Service / Professional Services / Classified /
 *      Books-Booklets-Brochures / Current Literature / New Members →
 *      info-society
 * B. Split-brain resolution: New Products (& Developments) belongs in
 *      news — info-society's copies move INTO news.
 * C. Event content: Advance Program + Exhibit Directory → future-events.
 * D. Paper-ish singletons: review list (newsReview.md) with proposals —
 *      never auto-written until approved.
 *
 * Usage:
 *   node .../fixNewsBucket.js            # dry-run + D review list
 *   node .../fixNewsBucket.js --apply    # write A+B+C
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../../lib/registry');

const REPORTS = 'src/main/reports/smpte-canonical-audit';
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const VERSION = 'contenttype-fixes@v1';

// Rules applied to docs currently in `news`
const NEWS_RULES = [
  [/^section (reports?|meetings?)/i, 'meeting-report'],
  [/^advertisers'? index$|^index to advertisers$/i, 'advert'],
  [/membership application|membership renewal invoice|sustaining members$/i, 'info-society'],
  [/^information for authors/i, 'info-society'],
  [/^biographical notes?/i, 'info-society'],
  [/^employment service/i, 'info-society'],
  [/^professional services/i, 'info-society'],
  [/^classified/i, 'info-society'],
  [/^books,? booklets,? (and )?brochures/i, 'info-society'],
  [/^current literature/i, 'info-society'],
  [/^new members$/i, 'info-society'],
  [/^advance program/i, 'future-events'],
  [/^exhibit directory/i, 'future-events'],
];
// Split-brain: New Products titles anywhere in info-society come INTO news
const NEW_PRODUCTS = /^new products?( & developments| and developments|: \(and developments\))?$/i;

const docs = loadAllDocs();
const changes = [];
const tally = {};
function queue(doc, to, why) {
  const meta = doc['contentType$meta'];
  if (meta && meta.excludeChanges === true) return;
  if (doc.contentType === to) return;
  changes.push({ doc, from: doc.contentType, to, why });
  const k = `${doc.contentType} → ${to}`;
  tally[k] = (tally[k] || 0) + 1;
}

for (const doc of docs) {
  if (!doc.contentType) continue;
  const t = String(doc.docTitle || '').trim();
  if (doc.contentType === 'news') {
    for (const [re, to] of NEWS_RULES) {
      if (re.test(t)) { queue(doc, to, `news-tier consolidation 2026-07-09: → ${to}`); break; }
    }
  } else if (doc.contentType === 'info-society' && NEW_PRODUCTS.test(t)) {
    queue(doc, 'news', 'news-tier consolidation 2026-07-09: New Products is news (split-brain resolution)');
  }
}
console.log(`[news] A+B+C changes: ${changes.length}`);
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(38)} ${n}`);

// D. paper-ish singleton review list
const SOC_PAT = /news|smpte|society|section|member|committee|convention|award|obituar|meeting|journal|editorial|president|nominat|election|in memoriam|calendar|program|annual report|treasurer|financ|scholarship|student|exhibit|register|dues|anniversar|dinner|banquet|greeting|cover|contents|index|staff|officer|governor|resume|abstract|advertis|classified|employ|professional service|almanac|new product|current literature|book|highlight|people|obit|elect|appoint|named|honors|honored|retires|joins|dies|death/i;
function proposeFor(t) {
  if (/^report of|— ?a report$|^the .* conference — a report/i.test(t)) return 'meeting-report';
  if (/(conference|symposium|congress|convention).*(\b\d{1,2}\s*[-–]|\bjanuary|february|march|april|may|june|july|august|september|october|november|december)/i.test(t)) return 'future-events';
  return 'orig-research';
}
const newsNow = docs.filter(d => d.contentType === 'news' && !changes.some(c => c.doc === d));
const freq = {};
for (const d of newsNow) { const t = String(d.docTitle || '').trim(); freq[t] = (freq[t] || 0) + 1; }
const review = [];
for (const d of newsNow) {
  const t = String(d.docTitle || '').trim();
  if (freq[t] !== 1) continue;
  if (t.split(/\s+/).length < 6) continue;
  if (SOC_PAT.test(t)) continue;
  review.push({ docId: d.docId, year: String(d.publicationDate || '').slice(0, 4), title: t, proposal: proposeFor(t) });
}
const tallyD = {};
for (const r of review) tallyD[r.proposal] = (tallyD[r.proposal] || 0) + 1;
console.log(`[news] D review list: ${review.length} ${JSON.stringify(tallyD)}`);

const md = [];
md.push('# news review — paper-ish singletons with reclass proposals');
md.push('');
md.push(`> Generated: ${NOW} · ${review.length} rows · REVIEW ONLY`);
md.push('');
for (const prop of Object.keys(tallyD).sort()) {
  md.push(`## → ${prop} (${tallyD[prop]})`);
  md.push('');
  md.push('| docId | year | title |');
  md.push('|---|---|---|');
  for (const r of review.filter(x => x.proposal === prop)) {
    md.push(`| \`${r.docId}\` | ${r.year} | ${r.title.slice(0, 110).replace(/\|/g, '\\|')} |`);
  }
  md.push('');
}
fs.writeFileSync(path.join(REPORTS, 'newsReview.md'), md.join('\n') + '\n');
console.log(`[news] wrote ${path.join(REPORTS, 'newsReview.md')}`);

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
  console.log(`\nDry run — pass --apply to write the ${changes.length} A+B+C moves.`);
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
console.log(`\nApplied ${written} moves.`);
console.log('Reminder: npm run canonicalize && npm run validate, then commit.');
