/*
 * idamsFieldBackfill.js — keywords + author bios from the raw IDAMS source.
 *
 * Reads the raw SMPTE `<publication>` XML under _source/SMPTE/ (Journal Article
 * Repository + Conference Repository), NOT the canonicalLibrary.*.json dump —
 * the dump drops keywordset / authorbio from the historical shape.
 *
 * Fills, on registry docs matched by EXACT `doi` (case-sensitive — J vs j):
 *
 *   1. keywords  registry empty, source has articleinfo/keywordset terms.
 *                Terms are CDATA-unwrapped with inline markup (<italic>) and
 *                entities stripped, then conformed the keywordConformIngest
 *                way: vocab casing → fold → normalizeKeyword(). Drops come from
 *                keywordVocabDecisions.json. Terms new to the vocabulary are
 *                added to site.json controlledKeywords on --apply (the
 *                validator gates doc.keywords ⊆ controlledKeywords).
 *   2. bios      no registry author has a bio yet, source authors do. Each
 *                source bio lands on the registry author it matches by name
 *                (full name, else surname + first initial; unique matches
 *                only). Unmatched bios are reported, never guessed.
 *
 * Fields whose `$meta.excludeChanges === true` are never touched.
 *
 *   node …/idamsFieldBackfill.js            # dry-run → report
 *   node …/idamsFieldBackfill.js --apply    # write docs + controlledKeywords
 *
 * Report: src/main/reports/smpte-canonical-audit/idamsFieldBackfill.md
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, saveDoc } = require('../../../lib/registry');
const { SOURCE_ROOT, REPOS, readAllArticles, makeKeywordConformer, matchBios } = require('./idamsPublication');

const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const VERSION = 'smpte-idams-publication@v1';
const SITE_PATH = 'src/main/config/site.json';
const REPORTS = 'src/main/reports/smpte-canonical-audit';
const DECISIONS_PATH = path.join(REPORTS, 'keywordVocabDecisions.json');
const OUT_MD = path.join(REPORTS, 'idamsFieldBackfill.md');

const { articles, files: filesScanned } = readAllArticles();
const source = new Map(); // doi → article with keywords or bios
for (const a of articles) {
  if (a.doi && (a.keywords.length || a.authors.some((x) => x.bio))) source.set(a.doi, a);
}
console.log(`[idams] ${filesScanned} <publication> files scanned · ${source.size} articles with keywords or bios`);

const site = JSON.parse(fs.readFileSync(SITE_PATH, 'utf8'));
const decisions = JSON.parse(fs.readFileSync(DECISIONS_PATH, 'utf8'));
const { conformList, inVocab, prime, totals: howTotals } = makeKeywordConformer(site, decisions);

// ---- walk registry -------------------------------------------------------
const isLocked = (doc, key) => (doc[`${key}$meta`] || {}).excludeChanges === true;
const docs = loadAllDocs();
const byDoi = new Map();
for (const d of docs) if (d.doi) byDoi.set(String(d.doi).trim(), d);

const kwChanges = [];
const bioChanges = [];
prime([...source].filter(([doi]) => byDoi.has(doi)).map(([, a]) => a.keywords));
const bioUnmatched = [];
const bioRealigned = [];
const newVocab = new Map(); // term → doc count
const tally = {
  sourceNotInRegistry: 0, kwAlreadyPresent: 0, kwLocked: 0, kwEmptyAfterConform: 0,
  bioAlreadyPresent: 0, bioLocked: 0, bioNoRegAuthors: 0, bioNoneMatched: 0,
};

for (const [doi, s] of source) {
  const doc = byDoi.get(doi);
  if (!doc) { tally.sourceNotInRegistry++; continue; }

  if (s.keywords.length) {
    if (Array.isArray(doc.keywords) && doc.keywords.length) tally.kwAlreadyPresent++;
    else if (isLocked(doc, 'keywords')) tally.kwLocked++;
    else {
      const out = conformList(s.keywords);
      if (!out.length) tally.kwEmptyAfterConform++;
      else {
        for (const t of out) if (!inVocab(t)) newVocab.set(t, (newVocab.get(t) || 0) + 1);
        kwChanges.push({ doc, raw: s.keywords, after: out, rel: s.rel });
      }
    }
  }

  if (s.authors.some((a) => a.bio)) {
    const reg = Array.isArray(doc.authors) ? doc.authors : [];
    if (!reg.length) tally.bioNoRegAuthors++;
    else if (reg.some((a) => a && typeof a === 'object' && a.bio)) tally.bioAlreadyPresent++;
    else if (isLocked(doc, 'authors')) tally.bioLocked++;
    else {
      const { assigned, unmatched, realigned } = matchBios(reg, s.authors);
      for (const r of realigned) bioRealigned.push({ docId: doc.docId, ...r });
      if (unmatched.length) bioUnmatched.push({ docId: doc.docId, reg: reg.map((a) => a && a.name), unmatched });
      if (!assigned.size) tally.bioNoneMatched++;
      else {
        const after = reg.map((a, i) => (assigned.has(i) ? { ...a, bio: assigned.get(i) } : a));
        bioChanges.push({ doc, after, count: assigned.size, rel: s.rel });
      }
    }
  }
}

const kwDocTypes = {};
for (const c of kwChanges) kwDocTypes[c.doc.docType] = (kwDocTypes[c.doc.docType] || 0) + 1;
const bioDocTypes = {};
for (const c of bioChanges) bioDocTypes[c.doc.docType] = (bioDocTypes[c.doc.docType] || 0) + 1;
const biosWritten = bioChanges.reduce((n, c) => n + c.count, 0);

// ---- apply ---------------------------------------------------------------
if (APPLY) {
  const byDoc = new Map();
  for (const c of kwChanges) byDoc.set(c.doc.docId, c.doc);
  for (const c of bioChanges) byDoc.set(c.doc.docId, c.doc);
  for (const c of kwChanges) {
    c.doc.keywords = c.after;
    c.doc['keywords$meta'] = {
      source: 'parsed',
      confidence: 'high',
      note: 'Keywords from SMPTE IDAMS <publication> articleinfo/keywordset (raw _source XML), conformed via controlledKeywords / keywordVocabDecisions folds + normalizeKeyword() — idamsFieldBackfill.js',
      updated: NOW,
      version: VERSION,
    };
  }
  for (const c of bioChanges) {
    const prev = c.doc['authors$meta'] || {};
    c.doc.authors = c.after;
    c.doc['authors$meta'] = {
      ...prev,
      note: `${prev.note ? `${prev.note}; ` : ''}bios backfilled from SMPTE IDAMS <publication> authorgroup/author/authorbio (placed on the author each bio names) — idamsFieldBackfill.js`,
      updated: NOW,
      version: VERSION,
    };
  }
  for (const doc of byDoc.values()) saveDoc(doc);

  const missing = [...newVocab.keys()].filter((t) => !(site.controlledKeywords || []).some((k) => k.toLowerCase() === t.toLowerCase()));
  const adds = (decisions.adds || []).filter((a) => !(site.controlledKeywords || []).some((k) => k.toLowerCase() === a.toLowerCase()));
  if (missing.length || adds.length) {
    site.controlledKeywords = Array.from(new Set([...(site.controlledKeywords || []), ...missing, ...adds]))
      .sort((a, b) => a.localeCompare(b));
    fs.writeFileSync(SITE_PATH, JSON.stringify(site, null, 2) + '\n', 'utf8');
  }
  console.log(`[idams] wrote ${byDoc.size} docs · +${missing.length + adds.length} controlledKeywords`);
}

// ---- report --------------------------------------------------------------
const esc = (s) => String(s).replace(/\|/g, '\\|');
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';
const md = [
  '# IDAMS field backfill — keywords + author bios',
  '',
  `> ${APPLY ? 'APPLY' : 'DRY-RUN'} · ${NOW}`,
  `> Source: raw \`${SOURCE_ROOT}/{${REPOS.map((r) => r.repo).join(',')}}\` <publication> XML · joined on exact \`doi\``,
  '',
  '## Totals',
  '',
  `- <publication> files scanned: ${filesScanned}; articles with keywords or bios: ${source.size}`,
  `- source articles with no registry doc: ${tally.sourceNotInRegistry} (the 2016–2023 coverage gap — minted by idamsIngest.js)`,
  `- **keywords**: ${kwChanges.length} docs to fill (${fmt(kwDocTypes)}) · already had keywords ${tally.kwAlreadyPresent} · locked ${tally.kwLocked} · empty after conform ${tally.kwEmptyAfterConform}`,
  `  - term mapping: vocab ${howTotals.vocab} · fold ${howTotals.fold} · typo-fix ${howTotals.fix} · variant→vocab ${howTotals.variant} · new ${howTotals.normalize} · dropped ${howTotals.drop}`,
  `  - terms new to controlledKeywords: **${newVocab.size}** (added on --apply)`,
  `- **bios**: ${bioChanges.length} docs / ${biosWritten} bios to fill (${fmt(bioDocTypes)}) · already had bios ${tally.bioAlreadyPresent} · locked ${tally.bioLocked} · no registry authors ${tally.bioNoRegAuthors} · no bio matched ${tally.bioNoneMatched}`,
  `  - realigned (source paired bio with the wrong author; text match wins): ${bioRealigned.length}`,
  `  - docs with ≥1 unmatched source bio: ${bioUnmatched.length} (${bioUnmatched.reduce((n, u) => n + u.unmatched.length, 0)} bios)`,
  '',
  '## Keyword fills',
  '',
  '| docId | source terms | → registry keywords |',
  '|---|---|---|',
  ...kwChanges.map((c) => `| \`${c.doc.docId}\` | ${esc(c.raw.join(' · '))} | ${esc(c.after.join(' · '))} |`),
  '',
  '## New controlledKeywords terms',
  '',
  'Review for the long-tail drop/fold list before --apply (keywordVocabDecisions.json `drops` / `folds`).',
  '',
  ...[...newVocab.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, n]) => `- ${esc(t)}${n > 1 ? ` (${n})` : ''}`),
  '',
  '## Bio fills (first 40)',
  '',
  '| docId | authors | bio filled for |',
  '|---|---|---|',
  ...bioChanges.slice(0, 40).map((c) => `| \`${c.doc.docId}\` | ${c.after.length} | ${esc(c.after.filter((a) => a && a.bio).map((a) => a.name).join(' · '))} |`),
  '',
  '## Realigned bios (source paired the bio with a different author — bio text names the registry author)',
  '',
  '| docId | source author | → bio lands on |',
  '|---|---|---|',
  ...bioRealigned.map((r) => `| \`${r.docId}\` | ${esc(r.from)} | ${esc(r.to)} |`),
  '',
  '## Unmatched source bios (review — never written)',
  '',
  '| docId | registry authors | unmatched source author (candidates) |',
  '|---|---|---|',
  ...bioUnmatched.map((u) => `| \`${u.docId}\` | ${esc(u.reg.join(' · '))} | ${esc(u.unmatched.map((x) => `${x.source} (${x.reason})`).join(' · '))} |`),
  '',
];
fs.writeFileSync(OUT_MD, md.join('\n'), 'utf8');

console.log(`[idams] ${APPLY ? 'APPLIED' : 'DRY-RUN'} — keywords ${kwChanges.length} docs (+${newVocab.size} vocab) · bios ${bioChanges.length} docs / ${biosWritten} bios · unmatched-bio docs ${bioUnmatched.length}`);
console.log(`  report: ${OUT_MD}`);
if (!APPLY) console.log('  re-run with --apply, then npm run canonicalize && npm run validate.');
