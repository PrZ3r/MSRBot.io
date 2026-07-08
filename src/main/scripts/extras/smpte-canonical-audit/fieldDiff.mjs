/*
 * fieldDiff.mjs — registry vs SMPTE-canonical per-field diff.
 *
 * For every registry doc that DOI-matches a canonical article, compares:
 *   title         registry docTitle          vs canonical article title
 *   pubYear       registry publicationDate   vs canonical pubDate.year
 *   pubMonth      (only when both sides have a parseable month)
 *   authors       registry authors[]         vs canonical authors[] (names)
 *   abstract      presence + normalized-prefix comparison
 *   keywords      case-folded set comparison
 *   journalTitle  registry journalTitle      vs canonical periodical title
 *                 (era-sensitive: must reflect the name AT TIME OF PUBLICATION)
 *
 * Buckets per field:
 *   match           both present, normalized-equal
 *   drift           both present, different            ← the review list
 *   registry-only   registry has it, canonical doesn't ← push-back candidates
 *   canonical-only  canonical has it, registry doesn't ← backfill candidates
 *   both-empty
 *
 * Output:
 *   src/main/reports/smpte-canonical-audit/fieldDiff.md        (summary + capped drift lists)
 *   src/main/reports/smpte-canonical-audit/fieldDiff.json      (full machine-readable)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs } = require('../../../lib/registry');
const REPORTS = 'src/main/reports/smpte-canonical-audit';

// ---- canonical flatten (carry parent periodical/conference context) ------
const canon = new Map(); // doi -> { title, year, month, day, authors[], keywords[], abstract, journalTitle, kind }
{
  const j = JSON.parse(fs.readFileSync(path.join(REPORTS, 'canonicalLibrary.journal.json'), 'utf8'));
  const c = JSON.parse(fs.readFileSync(path.join(REPORTS, 'canonicalLibrary.conference.json'), 'utf8'));
  for (const p of j.periodicals) for (const v of p.volumes) for (const i of v.issues) for (const a of i.articles) {
    if (!a.doi) continue;
    canon.set(a.doi.trim(), {
      title: a.title, abstract: a.abstract,
      year: a.pubDate?.year ?? null, month: a.pubDate?.month ?? null, day: a.pubDate?.day ?? null,
      authors: (a.authors || []).map(x => x.name).filter(Boolean),
      keywords: a.keywords || [],
      journalTitle: p.title, kind: 'journal',
    });
  }
  for (const cf of c.conferences) for (const a of cf.articles) {
    if (!a.doi) continue;
    canon.set(a.doi.trim(), {
      title: a.title, abstract: a.abstract,
      year: a.pubDate?.year ?? null, month: a.pubDate?.month ?? null, day: a.pubDate?.day ?? null,
      authors: (a.authors || []).map(x => x.name).filter(Boolean),
      keywords: a.keywords || [],
      journalTitle: cf.title, kind: 'conference',
    });
  }
}
console.log(`[field-diff] canonical DOIs: ${canon.size}`);

// ---- normalizers ---------------------------------------------------------
function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function normText(s) {
  if (s == null) return '';
  return decodeEntities(String(s).replace(/<!--[\s\S]*?-->/g, ' '))
    .toLowerCase()
    // strip diacritics
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    // unify quotes/dashes
    .replace(/[‘’‚′']/g, "'")
    .replace(/[“”„″"]/g, '"')
    .replace(/[‐-―−-]/g, '-')
    // drop everything but word chars
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function normName(s) {
  // Order-insensitive person-name key: sorted lowercase tokens, initials collapsed
  const tokens = normText(s).split(' ').filter(Boolean)
    .map(t => (t.length === 1 ? t : t)); // keep as-is; sorting handles order
  return tokens.sort().join(' ');
}
// Loose name key: surname + first-initial (registry "J. Smith" vs canonical "John Smith")
function looseName(s) {
  const tokens = normText(s).split(' ').filter(Boolean);
  if (!tokens.length) return '';
  const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
  const first = tokens[0][0] || '';
  return `${longest}:${first}`;
}
function regAuthorName(a) {
  if (typeof a === 'string') return a;
  if (a && typeof a === 'object') return a.name || '';
  return '';
}
function monthNum(m) {
  if (m == null) return null;
  const s = String(m).trim().toLowerCase();
  if (/^\d{1,2}$/.test(s)) { const n = parseInt(s, 10); return n >= 1 && n <= 12 ? n : null; }
  const map = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  for (const [k, v] of Object.entries(map)) if (s.startsWith(k)) return v;
  return null;
}

// ---- diff ---------------------------------------------------------------
const docs = loadAllDocs();
const FIELDS = ['title', 'pubYear', 'pubMonth', 'authors', 'abstract', 'keywords', 'journalTitle'];
const tally = {};
for (const f of FIELDS) tally[f] = { match: 0, drift: 0, registryOnly: 0, canonicalOnly: 0, bothEmpty: 0 };
const drift = {};
for (const f of FIELDS) drift[f] = [];

let matched = 0;
for (const doc of docs) {
  if (!doc.doi) continue;
  const hit = canon.get(String(doc.doi).trim());
  if (!hit) continue;
  matched++;

  function bucket(field, regVal, canVal, isEqual, driftDetail) {
    const t = tally[field];
    const rHas = regVal != null && String(regVal).trim() !== '' && !(Array.isArray(regVal) && !regVal.length);
    const cHas = canVal != null && String(canVal).trim() !== '' && !(Array.isArray(canVal) && !canVal.length);
    if (!rHas && !cHas) { t.bothEmpty++; return; }
    if (rHas && !cHas) { t.registryOnly++; return; }
    if (!rHas && cHas) { t.canonicalOnly++; return; }
    if (isEqual) { t.match++; return; }
    t.drift++;
    drift[field].push({ docId: doc.docId, ...driftDetail });
  }

  // title
  bucket('title', doc.docTitle, hit.title,
    normText(doc.docTitle) === normText(hit.title),
    { registry: doc.docTitle, canonical: hit.title });

  // pubYear
  const regYear = (String(doc.publicationDate || '').match(/^(\d{4})/) || [])[1] || null;
  bucket('pubYear', regYear, hit.year,
    String(regYear) === String(hit.year),
    { registry: doc.publicationDate, canonical: `${hit.year}${hit.month ? '-' + hit.month : ''}` });

  // pubMonth — only meaningful when both sides carry one
  const regMonth = (String(doc.publicationDate || '').match(/^\d{4}-(\d{2})/) || [])[1] || null;
  const rm = monthNum(regMonth), cm = monthNum(hit.month);
  bucket('pubMonth', rm, cm, rm === cm,
    { registry: doc.publicationDate, canonical: `${hit.year}-${hit.month}` });

  // authors — loose set equality
  const regAuthors = (doc.authors || []).map(regAuthorName).filter(Boolean);
  const regSet = new Set(regAuthors.map(looseName));
  const canSet = new Set(hit.authors.map(looseName));
  const authorsEqual = regSet.size === canSet.size && [...regSet].every(x => canSet.has(x));
  bucket('authors', regAuthors, hit.authors, authorsEqual,
    { registry: regAuthors, canonical: hit.authors });

  // abstract — normalized prefix comparison (first 120 chars)
  const regAbs = normText(doc.abstract).slice(0, 120);
  const canAbs = normText(hit.abstract).slice(0, 120);
  bucket('abstract', doc.abstract, hit.abstract, regAbs === canAbs,
    { registry: String(doc.abstract || '').slice(0, 80), canonical: String(hit.abstract || '').slice(0, 80) });

  // keywords — case-folded set equality
  const regKw = new Set((doc.keywords || []).map(normText).filter(Boolean));
  const canKw = new Set((hit.keywords || []).map(normText).filter(Boolean));
  const kwEqual = regKw.size === canKw.size && [...regKw].every(x => canKw.has(x));
  bucket('keywords', doc.keywords, hit.keywords, kwEqual,
    { registry: doc.keywords, canonical: hit.keywords });

  // journalTitle — era-sensitive
  bucket('journalTitle', doc.journalTitle, hit.journalTitle,
    normText(doc.journalTitle) === normText(hit.journalTitle),
    { registry: doc.journalTitle, canonical: hit.journalTitle });
}

console.log(`[field-diff] matched docs: ${matched}`);
for (const f of FIELDS) {
  const t = tally[f];
  console.log(`  ${f.padEnd(14)} match=${String(t.match).padStart(6)} drift=${String(t.drift).padStart(6)} regOnly=${String(t.registryOnly).padStart(6)} canOnly=${String(t.canonicalOnly).padStart(6)} bothEmpty=${String(t.bothEmpty).padStart(6)}`);
}

// ---- outputs -------------------------------------------------------------
fs.writeFileSync(path.join(REPORTS, 'fieldDiff.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  matched,
  tally,
  drift,
}, null, 2) + '\n');

const md = [];
md.push('# Registry vs SMPTE-canonical field diff');
md.push('');
md.push(`> Generated: ${new Date().toISOString()}`);
md.push(`> Matched docs (DOI): **${matched}**`);
md.push('');
md.push('## Summary');
md.push('');
md.push('| field | match | drift | registry-only | canonical-only | both-empty |');
md.push('|---|---:|---:|---:|---:|---:|');
for (const f of FIELDS) {
  const t = tally[f];
  md.push(`| ${f} | ${t.match} | **${t.drift}** | ${t.registryOnly} | ${t.canonicalOnly} | ${t.bothEmpty} |`);
}
md.push('');
md.push('> `registry-only` on abstract/keywords = our enrichment (candidate push-backs to SMPTE).');
md.push('> `canonical-only` = backfill candidates into the registry.');
md.push('> `journalTitle` drift is era-sensitive — the registry must reflect the journal name AT TIME of publication, so review before assuming either side wins.');
md.push('');
for (const f of FIELDS) {
  const rows = drift[f];
  if (!rows.length) continue;
  md.push(`## Drift — ${f} (${rows.length}${rows.length > 50 ? ', first 50 shown' : ''})`);
  md.push('');
  md.push('| docId | registry | canonical |');
  md.push('|---|---|---|');
  for (const r of rows.slice(0, 50)) {
    const reg = JSON.stringify(r.registry ?? '').slice(0, 90).replace(/\|/g, '\\|');
    const can = JSON.stringify(r.canonical ?? '').slice(0, 90).replace(/\|/g, '\\|');
    md.push(`| \`${r.docId}\` | ${reg} | ${can} |`);
  }
  md.push('');
}
fs.writeFileSync(path.join(REPORTS, 'fieldDiff.md'), md.join('\n') + '\n');
console.log(`[field-diff] wrote ${path.join(REPORTS, 'fieldDiff.md')} + fieldDiff.json`);
