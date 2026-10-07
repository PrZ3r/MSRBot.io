/*
 * idamsIngest.js — mint the SMPTE IDAMS `<publication>` docs the registry
 * never had: Journal Articles 2016–2023 and Conference Papers 2015–2023.
 *
 * Earlier passes read other shapes (HIGHWIRE NLM + APTARA to 2015,
 * content_batch/FTXML from 2024 — ingestNlmCanonicalDocs.js). Nothing read the
 * IDAMS shape, so ~2.3k articles under _source/SMPTE/{Journal Article,
 * Conference} Repository were never minted. This reads every <publication>
 * article whose DOI (exact, case-sensitive) is not in the registry.
 *
 * Fields follow the neighbouring 2010–2015 docs (docLabel shape, volume/number,
 * publisherLocation) plus what this source adds: keywords (conformed like
 * idamsFieldBackfill.js), authors with affiliation / ORCID / bio (bios placed
 * by the name they contain — the source mis-pairs them), conference titles.
 *
 * contentType: SMPTE's <contenttype>, corrected where it contradicts the
 * registry's settled rulings —
 *   1. title precedent: an identical title already carried by ≥3 registry
 *      docs with ≥80% agreement ("Ad Page" → advert, 42/42)
 *   2. RULES below — the canonical-audit rulings for titles with no precedent
 * Every correction keeps SMPTE's value in contentType$meta.originalValue.
 *
 *   node …/idamsIngest.js                # dry-run → report
 *   node …/idamsIngest.js --apply        # write docs + controlledKeywords
 *   node …/idamsIngest.js --apply --limit 500   # write the next 500 new docs
 *   node …/idamsIngest.js --json         # also dump every staged doc (~24 MB, not committed)
 *
 * Re-runs re-stage docs this script wrote (docId$meta note) and overwrite them.
 *
 * Reports:
 *   src/main/reports/smpte-canonical-audit/idamsIngest.md
 *   src/main/reports/smpte-canonical-audit/idamsIngest.json  (--json only: staged docs)
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, saveDoc, docAbsPath } = require('../../../lib/registry');
const {
  readAllArticles, makeKeywordConformer, matchBios, loadDecisions, preIdamsVocab, pruneUnusedVocab,
} = require('./idamsPublication');

const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  const n = i < 0 ? 0 : parseInt(process.argv[i + 1] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
})();
const NOW = new Date().toISOString();
const VERSION = 'smpte-idams-publication@v1';
const OUR_NOTE = 'idamsIngest.js';
const SITE_PATH = 'src/main/config/site.json';
const REPORTS = 'src/main/reports/smpte-canonical-audit';
const OUT_MD = path.join(REPORTS, 'idamsIngest.md');
const OUT_JSON = path.join(REPORTS, 'idamsIngest.json');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ORCID = /^\d{4}-\d{4}-\d{4}-\d{3}[0-9X]$/;

// ---- contentType corrections ---------------------------------------------
const titleKey = (s) => String(s || '').toLowerCase().replace(/\s+\d+$/, '')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Canonical-audit rulings for titles with no registry precedent
// (fixInfoSocietyTier / fixSmallBuckets / rebucketInfoSociety, 2026-07-09).
const RULES = [
  [/^exclusive\b.*\babstracts?$/i, 'summary-abstract'],
  [/\bmessage from the\b|^(update|report) from the .*\b(vice[- ]president|president|executive director)\b/i, 'info-society'],
  [/\bofficers$/i, 'list-staff'],
  [/^smpte\b.*\bcover\s*[2-4]$/i, 'advert'],
  [/^smpte\b.*\bcover$/i, 'front-cover'],
  [/\bad(\s+page)?$/i, 'advert'],
  [/\btable of contents$/i, 'toc'],
  [/^in memoriam\b/i, 'obit'],
  [/^errat(a|um)$/i, 'errata'],
];

// ---- registry ------------------------------------------------------------
const isOurs = (d) => String((d['docId$meta'] || {}).note || '').includes(OUR_NOTE);
const allDocs = loadAllDocs();
const existing = allDocs.filter((d) => !isOurs(d));
const existingDois = new Set(existing.filter((d) => d.doi).map((d) => String(d.doi).trim()));
const existingIdsLower = new Map(existing.map((d) => [d.docId.toLowerCase(), d.docId]));
const oursOnDisk = new Set(allDocs.filter(isOurs).map((d) => d.docId));

const precedent = new Map(); // titleKey → Map(contentType → n)
for (const d of existing) {
  if (!/^(Journal Article|Conference Paper)$/.test(d.docType) || !d.contentType) continue;
  const k = titleKey(d.docTitle);
  if (!k) continue;
  if (!precedent.has(k)) precedent.set(k, new Map());
  const m = precedent.get(k);
  m.set(d.contentType, (m.get(d.contentType) || 0) + 1);
}
function correctContentType(title, canonical) {
  const p = precedent.get(titleKey(title));
  if (p) {
    const total = [...p.values()].reduce((a, b) => a + b, 0);
    const [top, n] = [...p].sort((a, b) => b[1] - a[1])[0];
    if (total >= 3 && n / total >= 0.8) return top === canonical ? { value: top, how: null } : { value: top, how: `title precedent ${n}/${total}` };
  }
  for (const [re, to] of RULES) if (re.test(String(title || '').trim())) return to === canonical ? { value: to, how: null } : { value: to, how: `rule ${re.source}` };
  return { value: canonical, how: null };
}

// ---- source --------------------------------------------------------------
const { articles, files } = readAllArticles();
const site = JSON.parse(fs.readFileSync(SITE_PATH, 'utf8'));
// Conform against the vocabulary without the IDAMS passes, so a re-run folds
// away spellings an earlier run added.
const { conformList, inVocab, prime, merges, totals: kwTotals } = makeKeywordConformer(preIdamsVocab(site, allDocs), loadDecisions(REPORTS));

const candidates = articles.filter((a) => a.doi && !existingDois.has(a.doi));
// Same DOI in more than one file (re-exports): identical title → one doc.
const byDoi = new Map();
const dupDoi = [];
for (const a of candidates) {
  const prev = byDoi.get(a.doi);
  if (!prev) { byDoi.set(a.doi, a); continue; }
  if (titleKey(prev.title) === titleKey(a.title)) {
    // keep the richer copy
    const score = (x) => (x.abstract ? 2 : 0) + x.keywords.length + x.authors.length;
    if (score(a) > score(prev)) byDoi.set(a.doi, a);
  } else dupDoi.push({ doi: a.doi, a: prev.title, b: a.title, files: [prev.rel, a.rel] });
}
for (const d of dupDoi) byDoi.delete(d.doi);
// Same corpus as idamsFieldBackfill.js, so both passes land a cluster on one spelling.
prime(articles.map((a) => a.keywords));

// ---- doc assembly --------------------------------------------------------
const meta = (rel, extra = {}) => ({
  source: 'parsed',
  confidence: 'high',
  note: `Ingested from SMPTE IDAMS <publication> (_source/SMPTE/${rel}) via ${OUR_NOTE}`,
  updated: NOW,
  version: VERSION,
  ...extra,
});
function stampNested(obj, rel) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) { out[k] = v; out[`${k}$meta`] = meta(rel); }
  return out;
}

const ctChanges = [];
const bioRealigned = [];
const bioUnmatched = [];
const newVocab = new Map();

function buildDoc(a) {
  const isConf = a.docType === 'Conference Paper';
  const p = a.pub;
  const year = (isConf ? p.confYear : null) || a.year || p.volumeYear;
  const month = (isConf ? p.confMonth : null) || a.month;
  const day = isConf && p.confDay ? String(p.confDay).padStart(2, '0') : '01';
  const monthName = month ? MONTH_NAMES[Number(month) - 1] : null;

  let docLabel;
  if (isConf) docLabel = `SMPTE Meetings and Conferences ( ${[monthName, year].filter(Boolean).join(' ')})`;
  else docLabel = `${p.title} ( Volume: ${p.volume}, Issue: ${p.issue}, ${[a.monthRange ? null : monthName, year].filter(Boolean).join(' ')})`;

  const authors = a.authors.filter((x) => x.name).map((x) => {
    const o = { name: x.name };
    if (x.affiliation) o.affiliation = x.affiliation;
    if (x.orcid && ORCID.test(x.orcid)) o.orcid = x.orcid;
    return o;
  });
  if (authors.length && a.authors.some((x) => x.bio)) {
    const { assigned, unmatched, realigned } = matchBios(authors, a.authors);
    for (const [i, bio] of assigned) authors[i].bio = bio;
    for (const r of realigned) bioRealigned.push({ doi: a.doi, ...r });
    if (unmatched.length) bioUnmatched.push({ doi: a.doi, unmatched });
  }

  const keywords = a.keywords.length ? conformList(a.keywords) : [];
  for (const t of keywords) if (!inVocab(t)) newVocab.set(t, (newVocab.get(t) || 0) + 1);

  const ct = correctContentType(a.title, a.contentType);
  if (ct.how) ctChanges.push({ doi: a.doi, title: a.title, from: a.contentType, to: ct.value, how: ct.how });

  const pages = a.startpage && a.endpage && a.startpage !== a.endpage ? `${a.startpage}–${a.endpage}` : (a.startpage || null);
  const fields = {
    docId: a.doi.replace(/\//g, '-'),
    docType: a.docType,
    docLabel,
    docTitle: a.title || 'Untitled',
    doi: a.doi,
    href: `https://doi.org/${a.doi}`,
    publisher: 'SMPTE',
    publicationDate: year ? `${year}-${month || '01'}-${day}` : null,
    contentType: ct.value,
    authors: authors.length ? authors : null,
    abstract: a.abstract,
    keywords: keywords.length ? keywords : null,
    pages,
    volume: isConf ? year : p.volume,
    number: isConf ? month : p.issue,
    journalTitle: isConf ? p.confTitle : p.title,
    abbrevTitle: isConf ? null : p.titleAbbrev,
    journalAcronym: isConf ? null : p.acronym,
  };
  const doc = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined) continue;
    doc[k] = v;
    doc[`${k}$meta`] = k === 'contentType' && ct.how
      ? meta(a.rel, { note: `SMPTE <contenttype> "${a.contentType}" corrected by ${ct.how} — ${OUR_NOTE}`, originalValue: a.contentType })
      : meta(a.rel);
  }
  const nested = {
    issn: !isConf && (p.issnPrint || p.issnElectronic) ? { ...(p.issnPrint ? { print: p.issnPrint } : {}), ...(p.issnElectronic ? { electronic: p.issnElectronic } : {}) } : null,
    isbn: isConf && (p.isbnPrint || p.isbnElectronic) ? { ...(p.isbnPrint ? { print: p.isbnPrint } : {}), ...(p.isbnElectronic ? { electronic: p.isbnElectronic } : {}) } : null,
    publisherLocation: p.city ? { city: p.city, ...(p.country ? { country: p.country } : {}) } : null,
    copyright: {
      holder: a.copyrightHolder || p.copyrightHolder || 'Society of Motion Picture and Television Engineers, Inc.',
      year: a.copyrightYear || year,
    },
  };
  for (const [k, v] of Object.entries(nested)) {
    if (!v) continue;
    doc[k] = stampNested(v, a.rel);
    doc[`${k}$meta`] = meta(a.rel);
  }
  doc.status = { active: true, active$meta: meta(a.rel) };
  return doc;
}

const staged = [];
const collisions = [];
const seen = new Map();
for (const a of [...byDoi.values()].sort((x, y) => x.rel.localeCompare(y.rel))) {
  const doc = buildDoc(a);
  const lower = doc.docId.toLowerCase();
  if (existingIdsLower.has(lower)) { collisions.push({ docId: doc.docId, other: existingIdsLower.get(lower), rel: a.rel }); continue; }
  if (seen.has(lower)) { collisions.push({ docId: doc.docId, other: seen.get(lower), rel: a.rel }); continue; }
  seen.set(lower, doc.docId);
  staged.push({ doc, rel: a.rel });
}

// ---- facet-chip impact ---------------------------------------------------
// Mirrors build.search-index.js deriveChips(): exact-count ≥ minDocs ∪ portal
// keywords ∪ curation.add − curation.remove.
const curation = site.facetKeywordCuration || {};
const minDocs = Number.isFinite(curation.minDocs) ? curation.minDocs : 30;
const portalKw = new Set();
try {
  const raw = fs.readFileSync('src/main/data/portals.json', 'utf8');
  for (const m of raw.matchAll(/"keyword"\s*:\s*"([^"]+)"/g)) portalKw.add(m[1]);
  for (const m of raw.matchAll(/"keywords"\s*:\s*\[([^\]]*)\]/g)) for (const km of m[1].matchAll(/"([^"]+)"/g)) portalKw.add(km[1]);
} catch { /* no portals */ }
const removeLower = new Set((curation.remove || []).map((x) => String(x).toLowerCase()));
function chipsFor(docs) {
  const exact = new Map();
  for (const d of docs) for (const k of new Set(d.keywords || [])) exact.set(k, (exact.get(k) || 0) + 1);
  const chips = new Set([...exact].filter(([, n]) => n >= minDocs).map(([k]) => k));
  for (const k of portalKw) chips.add(k);
  for (const k of curation.add || []) chips.add(k);
  for (const k of [...chips]) if (removeLower.has(k.toLowerCase())) chips.delete(k);
  return { chips, exact };
}
const chipsBefore = chipsFor(existing).chips;
const { chips: chipsAfter, exact: countsAfter } = chipsFor([...existing, ...staged.map((s) => s.doc)]);
const newChips = [...chipsAfter].filter((k) => !chipsBefore.has(k)).map((k) => [k, countsAfter.get(k) || 0]).sort((x, y) => y[1] - x[1]);

// ---- tallies -------------------------------------------------------------
const tally = (f) => staged.reduce((m, s) => { const k = f(s.doc); m[k] = (m[k] || 0) + 1; return m; }, {});
const byYear = tally((d) => `${d.docType} ${String(d.publicationDate || '????').slice(0, 4)}`);
const byCt = tally((d) => `${d.docType} · ${d.contentType}`);
const has = (f) => staged.filter((s) => f(s.doc)).length;
const coverage = {
  abstract: has((d) => d.abstract),
  authors: has((d) => d.authors),
  bios: staged.reduce((n, s) => n + (s.doc.authors || []).filter((x) => x.bio).length, 0),
  keywords: has((d) => d.keywords),
  pages: has((d) => d.pages),
};

// ---- apply ---------------------------------------------------------------
let written = 0;
if (APPLY) {
  if (collisions.length) {
    console.error(`[idams-ingest] REFUSING to apply — ${collisions.length} docId collisions (see report).`);
    process.exit(1);
  }
  for (const s of staged) {
    const fresh = !oursOnDisk.has(s.doc.docId) && !fs.existsSync(docAbsPath(s.doc));
    if (LIMIT && fresh && written >= LIMIT) continue;
    saveDoc(s.doc);
    if (fresh) written++;
  }
  // Exact match (the validator compares exactly); then drop spellings no doc
  // carries any more.
  const listed = new Set(site.controlledKeywords || []);
  const missing = [...newVocab.keys()].filter((t) => !listed.has(t));
  site.controlledKeywords = [...(site.controlledKeywords || []), ...missing];
  const pruned = pruneUnusedVocab(site, loadAllDocs());
  site.controlledKeywords = Array.from(new Set(site.controlledKeywords)).sort((x, y) => x.localeCompare(y));
  fs.writeFileSync(SITE_PATH, JSON.stringify(site, null, 2) + '\n', 'utf8');
  console.log(`[idams-ingest] wrote ${written} new docs${LIMIT ? ` (limit ${LIMIT})` : ''} · +${missing.length} controlledKeywords · −${pruned} unused`);
}

// ---- reports -------------------------------------------------------------
if (process.argv.includes('--json')) fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: NOW, apply: APPLY, staged: staged.map((s) => ({ source: s.rel, doc: s.doc })) }, null, 1) + '\n', 'utf8');

const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|');
const rows = (o) => Object.entries(o).sort((x, y) => x[0].localeCompare(y[0])).map(([k, v]) => `| ${k} | ${v} |`);
const ctGroups = new Map();
for (const c of ctChanges) {
  const k = `${c.from} → ${c.to} | ${titleKey(c.title)} | ${c.how}`;
  ctGroups.set(k, (ctGroups.get(k) || 0) + 1);
}
const residual = new Map(); // non-research, uncorrected: contentType | title → n
for (const s of staged) {
  const d = s.doc;
  if (d.contentType === 'orig-research' || (d['contentType$meta'] || {}).originalValue) continue;
  const k = `${d.contentType} | ${titleKey(d.docTitle)}`;
  residual.set(k, (residual.get(k) || 0) + 1);
}
const md = [
  '# IDAMS ingest — SMPTE docs never in the registry',
  '',
  `> ${APPLY ? 'APPLY' : 'DRY-RUN'}${LIMIT ? ` (limit ${LIMIT})` : ''} · ${NOW}`,
  `> Source: ${files} <publication> files · ${articles.length} articles · ${candidates.length} with a DOI not in the registry`,
  '',
  '## Totals',
  '',
  `- staged: **${staged.length}** docs${APPLY ? ` · written this run: ${written}` : ''}`,
  `- docId collisions (incl. case-only): **${collisions.length}** ${collisions.length ? '⚠️ apply refused until resolved' : '✓'}`,
  `- same DOI, different title in two files: ${dupDoi.length} (left out — listed below)`,
  `- coverage: abstract ${coverage.abstract} · authors ${coverage.authors} (${coverage.bios} bios) · keywords ${coverage.keywords} · pages ${coverage.pages}`,
  `- keywords: IDAMS fold ${kwTotals.idamsFold} · vocab ${kwTotals.vocab} · fold ${kwTotals.fold} · typo-fix ${kwTotals.fix} · variant→vocab ${kwTotals.variant} · new ${kwTotals.normalize} · dropped ${kwTotals.drop} · **${newVocab.size}** new controlledKeywords`,
  `- bios realigned to the author they name: ${bioRealigned.length} · unplaced: ${bioUnmatched.reduce((n, u) => n + u.unmatched.length, 0)}`,
  `- contentType corrections: ${ctChanges.length}`,
  `- new facet chips (count ≥${minDocs} ∪ portals ∪ curation.add − remove, before → after): ${newChips.length ? newChips.map(([k, n]) => `${k} (${n})`).join(', ') : 'none'}`,
  '',
  '## By year',
  '',
  '| docType year | docs |',
  '|---|---:|',
  ...rows(byYear),
  '',
  '## contentType',
  '',
  '| docType · contentType | docs |',
  '|---|---:|',
  ...rows(byCt),
  '',
  '## contentType corrections',
  '',
  '| n | SMPTE → registry \\| title \\| why |',
  '|---:|---|',
  ...[...ctGroups].sort((x, y) => y[1] - x[1]).map(([k, n]) => `| ${n} | ${esc(k).replace(/\\\|/g, '·')} |`),
  '',
  '## Non-research docs kept at SMPTE\'s value (review)',
  '',
  '| n | contentType · title |',
  '|---:|---|',
  ...[...residual].sort((x, y) => y[1] - x[1]).map(([k, n]) => `| ${n} | ${esc(k).replace(/\\\|/g, '·')} |`),
  '',
  '## Realigned bios',
  '',
  '| DOI | source author | → bio lands on |',
  '|---|---|---|',
  ...bioRealigned.map((r) => `| \`${r.doi}\` | ${esc(r.from)} | ${esc(r.to)} |`),
  '',
  '## Unplaced bios',
  '',
  ...bioUnmatched.map((u) => `- \`${u.doi}\`: ${esc(u.unmatched.map((x) => `${x.source} (${x.reason})`).join(' · '))}`),
  '',
  '## Same DOI, different title',
  '',
  ...dupDoi.map((d) => `- \`${d.doi}\`: "${esc(d.a)}" (${d.files[0]}) vs "${esc(d.b)}" (${d.files[1]})`),
  '',
  '## Collisions',
  '',
  ...collisions.map((c) => `- \`${c.docId}\` vs existing \`${c.other}\` (${c.rel})`),
  '',
  '## Keyword merges',
  '',
  'Each landing term, then the source spellings folded into it (docs). **Bold** = an existing vocabulary term.',
  '',
  ...[...merges()].sort((x, y) => y[1].reduce((n, [, c]) => n + c, 0) - x[1].reduce((n, [, c]) => n + c, 0))
    .map(([to, from]) => `- ${inVocab(to) ? `**${esc(to)}**` : esc(to)} ← ${from.sort((x, y) => y[1] - x[1]).map(([t, n]) => `${esc(t)} (${n})`).join(' · ')}`),
  '',
  '## New controlledKeywords terms',
  '',
  ...[...newVocab].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([t, n]) => `- ${esc(t)}${n > 1 ? ` (${n})` : ''}`),
  '',
];
fs.writeFileSync(OUT_MD, md.join('\n'), 'utf8');

console.log(`[idams-ingest] ${APPLY ? 'APPLIED' : 'DRY-RUN'} — staged ${staged.length} · collisions ${collisions.length} · dup-DOI ${dupDoi.length} · ct-corrections ${ctChanges.length} · new vocab ${newVocab.size} · new chips ${newChips.length}`);
console.log(`  report: ${OUT_MD}${process.argv.includes('--json') ? `, ${OUT_JSON}` : ''}`);
