/*
 * rebucketInfoSociety.js — split the info-society catch-all into the finer
 * SMPTE enum values, and emit a review file for the paper-ish remainder.
 *
 * Pass A (writes with --apply): exact-pattern department titles
 *   — Table of Contents            → toc
 *   — Cover / Cover N              → front-cover
 *   — Editorial Board / Officers   → list-staff
 *   — Advertisement / Ad indexes   → advert
 *
 * Pass B (report only): singleton titles ≥6 words with no society keyword
 * — proposal-annotated review list (infoSocietyReview.md). Heuristic
 * proposals: Point of View/Letters → opinion, standards texts →
 * content-announce, congress/symposium write-ups → meeting-report,
 * remainder → orig-research. Nothing from Pass B is ever auto-written.
 *
 * Pass B was user-reviewed 2026-07-09 ("mostly ok") with three keep-as-
 * info-society exclusions (REVIEW_EXCLUSIONS below); approved proposals
 * write under --apply-review.
 *
 * Usage:
 *   node .../rebucketInfoSociety.js                  # dry-run + review file
 *   node .../rebucketInfoSociety.js --apply          # write Pass A (mechanical)
 *   node .../rebucketInfoSociety.js --apply-review   # write Pass B (approved proposals)
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../../lib/registry');

const REPORTS = 'src/main/reports/smpte-canonical-audit';
const APPLY = process.argv.includes('--apply');
const APPLY_REVIEW = process.argv.includes('--apply-review');
const NOW = new Date().toISOString();
const VERSION = 'contenttype-fixes@v1';

// User review 2026-07-09: these stay info-society (struck from Pass B).
function isReviewExcluded(doc) {
  if (doc.docId === '10.5594-J00417') return true;            // Who's Who on the Board of Editors
  const t = String(doc.docTitle || '');
  if (/message from the executive director/i.test(t)) return true;
  if (/HPA\s+\d{4}\s+Tech Retreat/i.test(t)) return true;
  return false;
}

const REBUCKET_PATTERNS = [
  [/— ?Table of Contents$|^Table of Contents$/i, 'toc'],
  [/— ?Cover$|^Cover [1-4]?$/i, 'front-cover'],
  [/— ?Editorial Board$|^Editorial Board$|^Officers and Governors$|^Committee Chairm[ae]n$/i, 'list-staff'],
  [/— ?Advertisement$|^Advertisers'? Index$|^Index to Advertisers$/i, 'advert'],
];

const SOC_PAT = /smpte|society|section|member|committee|convention|conference report|award|obituar|meeting|journal|editorial|president|chairman|nominat|election|constitution|bylaw|in memoriam|memorial|calendar|program|welcome|annual report|treasurer|financ|scholarship|student|exhibit|booth|register|dues|anniversar|dinner|banquet|luncheon|greeting|cover|contents|index|staff|officer|governor|resume|abstract|advertis|classified|employ|professional service|almanac|new product|current literature|book|news|highlight/i;

function proposeFor(title) {
  const t = String(title);
  if (/^point of view|^letters? to the editor|^guest editorial|^commentary/i.test(t)) return 'opinion';
  if (/american national standard|proposed american national|^international standard|^cinematography ?[—–-]|recommended practice|^proposed smpte|engineering guideline/i.test(t)) return 'content-announce';
  if (/congress|symposium|colloquium|mini-conference|montreux|international standardization:|reflections on/i.test(t)) return 'meeting-report';
  return 'orig-research';
}

const docs = loadAllDocs();
const infoSoc = docs.filter(d => d.contentType === 'info-society');

// Pass A — mechanical
const rebuckets = [];
const tallyA = {};
for (const d of infoSoc) {
  const t = String(d.docTitle || '').trim();
  for (const [re, to] of REBUCKET_PATTERNS) {
    if (re.test(t)) {
      const meta = d['contentType$meta'];
      if (!(meta && meta.excludeChanges === true)) {
        rebuckets.push({ doc: d, to });
        tallyA[to] = (tallyA[to] || 0) + 1;
      }
      break;
    }
  }
}
console.log(`[rebucket] Pass A (mechanical): ${rebuckets.length} ${JSON.stringify(tallyA)}`);

// Pass B — review list
const freq = {};
for (const d of infoSoc) { const t = String(d.docTitle || '').trim(); freq[t] = (freq[t] || 0) + 1; }
const review = [];
let excluded = 0;
for (const d of infoSoc) {
  const t = String(d.docTitle || '').trim();
  if (freq[t] !== 1) continue;
  if (t.split(/\s+/).length < 6) continue;
  if (SOC_PAT.test(t)) continue;
  if (REBUCKET_PATTERNS.some(([re]) => re.test(t))) continue;
  if (isReviewExcluded(d)) { excluded++; continue; }
  review.push({ doc: d, docId: d.docId, year: String(d.publicationDate || '').slice(0, 4), title: t, proposal: proposeFor(t) });
}
console.log(`[rebucket] review exclusions (stay info-society): ${excluded}`);
const tallyB = {};
for (const r of review) tallyB[r.proposal] = (tallyB[r.proposal] || 0) + 1;
console.log(`[rebucket] Pass B (review list): ${review.length} ${JSON.stringify(tallyB)}`);

const md = [];
md.push('# info-society review — paper-ish singletons with reclass proposals');
md.push('');
md.push(`> Generated: ${NOW} · ${review.length} rows · REVIEW ONLY, nothing auto-written`);
md.push('> Edit the proposal column (or strike rows to keep info-society), then decisions get encoded.');
md.push('');
md.push('| proposal | rows |');
md.push('|---|---:|');
for (const [k, n] of Object.entries(tallyB).sort((a, b) => b[1] - a[1])) md.push(`| ${k} | ${n} |`);
md.push('');
for (const prop of Object.keys(tallyB).sort()) {
  md.push(`## → ${prop} (${tallyB[prop]})`);
  md.push('');
  md.push('| docId | year | title |');
  md.push('|---|---|---|');
  for (const r of review.filter(x => x.proposal === prop)) {
    md.push(`| \`${r.docId}\` | ${r.year} | ${r.title.slice(0, 110).replace(/\|/g, '\\|')} |`);
  }
  md.push('');
}
fs.writeFileSync(path.join(REPORTS, 'infoSocietyReview.md'), md.join('\n') + '\n');
console.log(`[rebucket] wrote ${path.join(REPORTS, 'infoSocietyReview.md')}`);

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

if (!APPLY && !APPLY_REVIEW) {
  console.log(`\nDry run — pass --apply to write the ${rebuckets.length} Pass-A re-buckets,`);
  console.log(`          --apply-review to write the ${review.length} approved Pass-B proposals (flags combine).`);
  process.exit(0);
}

function writeChange(doc, to, note) {
  const from = doc.contentType;
  doc.contentType = to;
  doc['contentType$meta'] = {
    source: 'resolved',
    confidence: 'high',
    note,
    originalValue: from,
    updated: NOW,
    version: VERSION,
  };
  const sorted = sortKeysDeep(doc);
  fs.writeFileSync(docAbsPath(sorted), JSON.stringify(sorted, null, 2) + '\n');
}

let written = 0;
if (APPLY) {
  for (const { doc, to } of rebuckets) {
    writeChange(doc, to, `Re-bucketed from the info-society catch-all by department-title pattern ('${to}')`);
    written++;
  }
  console.log(`\nApplied ${written} Pass-A re-buckets.`);
}
let reviewWritten = 0;
if (APPLY_REVIEW) {
  for (const r of review) {
    writeChange(r.doc, r.proposal, `Reclassified from info-society by title review (2026-07-09, infoSocietyReview.md): '${r.proposal}'`);
    reviewWritten++;
  }
  console.log(`Applied ${reviewWritten} Pass-B review reclassifications.`);
}
console.log('Reminder: npm run canonicalize && npm run validate, then commit.');
