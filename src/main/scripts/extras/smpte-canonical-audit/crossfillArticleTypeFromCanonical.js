/*
 * crossfillArticleTypeFromCanonical.js — SMPTE canonical-repo audit.
 *
 * Two jobs, one walk:
 *
 * 1. BACKFILL (writes with --apply): registry docs whose articleType is
 *    'other' / empty get the canonical repos' contentType (via DOI match).
 *    Empirically the pre-2024 canonical corpus only distinguishes
 *    info-society / orig-research / tutorial — coarse, but strictly
 *    better than 'other'. Registry vocabulary already contains these
 *    values, so canonical values are written verbatim.
 *
 * 2. DRIFT REPORT (always, no writes): for docs with a real articleType,
 *    tally the (articleType, contentType) matrix; per-articleType, the
 *    majority canonical value is treated as "expected" and every doc in
 *    a minority cell is listed for human review. This surfaces the
 *    mislabels — e.g. registry 'research-article' that canonical calls
 *    'info-society' (163 docs), 'toc' that canonical calls
 *    'orig-research' (15 docs).
 *
 * Never overwrites a non-'other' articleType — except for the drift pairs
 * the user explicitly approved on 2026-07-07 (APPROVED_DRIFT_FIXES below),
 * which are written only under --apply-drift. Honors $meta.excludeChanges.
 *
 * Usage:
 *   node .../crossfillArticleTypeFromCanonical.js                # dry-run everything
 *   node .../crossfillArticleTypeFromCanonical.js --apply        # write the 'other'/empty backfills
 *   node .../crossfillArticleTypeFromCanonical.js --apply-drift  # write the approved drift fixes
 *   (flags combine)
 *
 * Reports:
 *   src/main/reports/smpte-canonical-audit/articleTypeBackfill.md
 *   src/main/reports/smpte-canonical-audit/articleTypeDrift.md
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../../lib/registry');

const REPORTS = 'src/main/reports/smpte-canonical-audit';
const APPLY = process.argv.includes('--apply');
const APPLY_DRIFT = process.argv.includes('--apply-drift');
const NOW = new Date().toISOString();
const VERSION = 'smpte-canonical-repo@v1';

// Drift pairs the user approved for update on 2026-07-07 — for docs in
// these (registry articleType → canonical contentType) cells, canonical
// wins and the registry articleType is rewritten. All other drift cells
// are registry-wins: canonical is wrong there, and those go into the
// push-back register for SMPTE instead.
const APPROVED_DRIFT_FIXES = new Set([
  'research-article||info-society',   // 163
  'abstract||info-society',           // 140
  'letter||orig-research',            //   9
  'news||orig-research',              //   6
  'review-article||orig-research',    //   3
  'introduction||orig-research',      //   1
]);

// ---- canonical doi → {contentType, title, year} -------------------------
const canon = new Map();
{
  const j = JSON.parse(fs.readFileSync(path.join(REPORTS, 'canonicalLibrary.journal.json'), 'utf8'));
  const c = JSON.parse(fs.readFileSync(path.join(REPORTS, 'canonicalLibrary.conference.json'), 'utf8'));
  for (const p of j.periodicals) for (const v of p.volumes) for (const i of v.issues) for (const a of i.articles) {
    if (a.doi) canon.set(a.doi.trim(), { contentType: a.contentType, title: a.title, year: a.pubDate ? a.pubDate.year : null });
  }
  for (const cf of c.conferences) for (const a of cf.articles) {
    if (a.doi) canon.set(a.doi.trim(), { contentType: a.contentType, title: a.title, year: a.pubDate ? a.pubDate.year : null });
  }
}
console.log(`[articleType] canonical DOIs: ${canon.size}`);

const docs = loadAllDocs();
console.log(`[articleType] registry docs: ${docs.length}`);

// ---- walk ---------------------------------------------------------------
const backfills = [];   // { doc, newType }
const driftFixes = [];  // { doc, newType, pair } — user-approved cells only
const locked = [];
const matrix = new Map();     // articleType -> Map<contentType, [docs]>
let matchedCount = 0;

for (const doc of docs) {
  if (!doc.doi) continue;
  const hit = canon.get(String(doc.doi).trim());
  if (!hit || !hit.contentType) continue;
  matchedCount++;
  const at = (doc.articleType || '').trim();
  const isJunk = at === '' || at === 'other';

  const meta = doc['articleType$meta'];
  if (meta && meta.excludeChanges === true) {
    if (isJunk) locked.push({ docId: doc.docId, registry: at, canonical: hit.contentType });
    continue;
  }

  if (isJunk) {
    backfills.push({ doc, newType: hit.contentType });
  } else {
    if (!matrix.has(at)) matrix.set(at, new Map());
    const inner = matrix.get(at);
    if (!inner.has(hit.contentType)) inner.set(hit.contentType, []);
    inner.get(hit.contentType).push({ docId: doc.docId, title: doc.docTitle, year: hit.year, canonicalTitle: hit.title });
    const pair = `${at}||${hit.contentType}`;
    if (APPROVED_DRIFT_FIXES.has(pair) && at !== hit.contentType) {
      driftFixes.push({ doc, newType: hit.contentType, pair });
    }
  }
}

console.log(`[articleType] matched via DOI: ${matchedCount}`);
console.log(`[articleType] backfill candidates ('other'/empty): ${backfills.length}`);
console.log(`[articleType] locked (excludeChanges): ${locked.length}`);

// Backfill tally by new value
const backfillByType = {};
for (const b of backfills) backfillByType[b.newType] = (backfillByType[b.newType] || 0) + 1;
console.log(`[articleType] backfill split: ${JSON.stringify(backfillByType)}`);

// ---- drift: minority cells per articleType ------------------------------
const driftRows = []; // { articleType, contentType, docs[] }
for (const [at, inner] of matrix) {
  const cells = [...inner.entries()].sort((a, b) => b[1].length - a[1].length);
  const majority = cells[0][0];
  for (const [ct, list] of cells) {
    if (ct === majority) continue;
    driftRows.push({ articleType: at, contentType: ct, majority, docs: list });
  }
}
driftRows.sort((a, b) => b.docs.length - a.docs.length);
const driftTotal = driftRows.reduce((s, r) => s + r.docs.length, 0);
console.log(`[articleType] drift docs (minority cells): ${driftTotal}`);

// ---- backfill report -----------------------------------------------------
const bf = [];
bf.push('# articleType backfill from SMPTE canonical repos');
bf.push('');
bf.push(`> Generated: ${NOW}`);
bf.push(`> Mode: **${APPLY ? 'APPLY' : 'DRY-RUN'}**`);
bf.push('');
bf.push('## Totals');
bf.push('');
bf.push(`- Registry docs matched to canonical via DOI: ${matchedCount}`);
bf.push(`- Backfill candidates (articleType 'other'/empty): **${backfills.length}**`);
for (const [t, n] of Object.entries(backfillByType).sort((a, b) => b[1] - a[1])) {
  bf.push(`  - → \`${t}\`: ${n}`);
}
bf.push(`- Locked ($meta.excludeChanges): ${locked.length}`);
bf.push('');
bf.push('## Sample (first 40 per target type)');
bf.push('');
for (const t of Object.keys(backfillByType)) {
  bf.push(`### → \`${t}\``);
  bf.push('');
  bf.push('| docId | title |');
  bf.push('|---|---|');
  for (const b of backfills.filter(x => x.newType === t).slice(0, 40)) {
    bf.push(`| \`${b.doc.docId}\` | ${String(b.doc.docTitle || '').slice(0, 90).replace(/\|/g, '\\|')} |`);
  }
  bf.push('');
}
fs.writeFileSync(path.join(REPORTS, 'articleTypeBackfill.md'), bf.join('\n') + '\n');
console.log(`[articleType] wrote ${path.join(REPORTS, 'articleTypeBackfill.md')}`);

// ---- drift report ---------------------------------------------------------
const dr = [];
dr.push('# articleType drift — registry vs SMPTE canonical (minority cells)');
dr.push('');
dr.push(`> Generated: ${NOW}`);
dr.push('> For each registry articleType, the majority canonical contentType is treated as expected;');
dr.push('> docs below sit in minority cells and need human review. **No writes are ever made from this report.**');
dr.push('');
dr.push('## Summary');
dr.push('');
dr.push('| registry articleType | canonical contentType | docs | majority (expected) |');
dr.push('|---|---|---:|---|');
for (const r of driftRows) {
  dr.push(`| \`${r.articleType}\` | \`${r.contentType}\` | ${r.docs.length} | \`${r.majority}\` |`);
}
dr.push('');
dr.push('## Per-cell doc lists');
dr.push('');
for (const r of driftRows) {
  dr.push(`### \`${r.articleType}\` → \`${r.contentType}\` (${r.docs.length})`);
  dr.push('');
  dr.push('| docId | year | registry title |');
  dr.push('|---|---|---|');
  for (const d of r.docs) {
    dr.push(`| \`${d.docId}\` | ${d.year || ''} | ${String(d.title || '').slice(0, 90).replace(/\|/g, '\\|')} |`);
  }
  dr.push('');
}
fs.writeFileSync(path.join(REPORTS, 'articleTypeDrift.md'), dr.join('\n') + '\n');
console.log(`[articleType] wrote ${path.join(REPORTS, 'articleTypeDrift.md')}`);

// ---- apply ----------------------------------------------------------------
function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

// Drift-fix tally for the console
const driftFixByPair = {};
for (const f of driftFixes) driftFixByPair[f.pair] = (driftFixByPair[f.pair] || 0) + 1;
console.log(`[articleType] approved drift fixes pending: ${driftFixes.length} ${JSON.stringify(driftFixByPair)}`);

if (!APPLY && !APPLY_DRIFT) {
  console.log(`\nDry run — pass --apply to write ${backfills.length} placeholder backfills,`);
  console.log(`          --apply-drift to write ${driftFixes.length} approved drift fixes (flags combine).`);
  process.exit(0);
}

function writeDoc(doc, newType, note, originalValue) {
  doc.articleType = newType;
  doc['articleType$meta'] = {
    source: 'parsed',
    confidence: 'high',
    note,
    originalValue,
    updated: NOW,
    version: VERSION,
  };
  const sorted = sortKeysDeep(doc);
  const target = docAbsPath(sorted);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(sorted, null, 2) + '\n');
}

let written = 0;
if (APPLY) {
  for (const { doc, newType } of backfills) {
    writeDoc(doc, newType,
      'Cross-filled from SMPTE canonical repository import (smpte-canonical-audit/canonicalLibrary.*.json); previous value was a placeholder',
      doc.articleType == null ? null : doc.articleType);
    written++;
  }
  console.log(`\nApplied ${written} placeholder backfills.`);
}
let driftWritten = 0;
if (APPLY_DRIFT) {
  for (const { doc, newType } of driftFixes) {
    writeDoc(doc, newType,
      'Drift fix approved 2026-07-07: canonical repository contentType wins over registry articleType for this pair (smpte-canonical-audit/articleTypeDrift.md)',
      doc.articleType == null ? null : doc.articleType);
    driftWritten++;
  }
  console.log(`Applied ${driftWritten} approved drift fixes.`);
}
console.log('Reminder: npm run canonicalize && npm run validate, then commit.');
