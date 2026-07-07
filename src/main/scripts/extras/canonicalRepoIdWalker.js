/*
 * canonicalRepoIdWalker.js — SMPTE canonical-repo audit, Part 1.
 *
 * Walks _source/SMPTE/{Journal Article Repository, Conference Repository}
 * and, for each XML file, extracts just enough identity to cross-check
 * against the registry: doi, title, articleType, publicationYear, and a
 * secondary id (idamsid | article-id).
 *
 * Handles three shapes:
 *   <publication>   — IEEE IDAMS DTD          (pre-2024, ~97% of corpus)
 *   <content_batch> — IEEE content-delivery   (2024-2026 IEEE wind-down)
 *   <article>       — NLM JATS                (2024+ post-IEEE)
 *
 * Regex-based (no XML parser dep). Robust enough for leaf-text fields;
 * a real parser can replace this once we decide to ingest.
 *
 * Output:
 *   src/main/reports/canonicalRepoIds.journal.csv
 *   src/main/reports/canonicalRepoIds.conference.csv
 *   src/main/reports/canonicalRepoIds.summary.md
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const REPORTS = 'src/main/reports';
const REPOS = [
  { key: 'journal', dir: '_source/SMPTE/Journal Article Repository' },
  { key: 'conference', dir: '_source/SMPTE/Conference Repository' },
];

// ---- shape detection ----------------------------------------------------
function detectShape(xml) {
  const m = xml.match(/<([a-zA-Z][a-zA-Z_0-9-]*)/g) || [];
  for (const tag of m) {
    const name = tag.slice(1);
    if (name === 'publication') return 'publication';
    if (name === 'content_batch') return 'content_batch';
    if (name === 'article') return 'article';
  }
  return 'unknown';
}

// ---- per-shape extractors ----------------------------------------------
// Return { doi, title, articleType, year, articleId }.

function cdata(s) {
  if (s == null) return null;
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return (m ? m[1] : s).trim() || null;
}
function firstMatch(re, s) { const m = re.exec(s); return m ? m[1] : null; }

function extractPublication(xml) {
  // IEEE IDAMS. Fields live inside a single <article> ... <articleinfo> block.
  const artBlock = firstMatch(/<article>([\s\S]*?)<\/article>/, xml) || xml;
  const doi = cdata(firstMatch(/<articledoi>([\s\S]*?)<\/articledoi>/, artBlock));
  const title = cdata(firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/, artBlock));
  const articleType = cdata(firstMatch(/<contenttype>([\s\S]*?)<\/contenttype>/, artBlock));
  const articleId = cdata(firstMatch(/<idamsid>([\s\S]*?)<\/idamsid>/, artBlock));
  // Prefer OriginalPub year; fall back to ePub year.
  let year = firstMatch(/<date\s+datetype="OriginalPub">[\s\S]*?<year>(\d{4})<\/year>/, artBlock);
  if (!year) year = firstMatch(/<date\s+datetype="ePub">[\s\S]*?<year>(\d{4})<\/year>/, artBlock);
  return { doi, title, articleType, year, articleId };
}

function extractContentBatch(xml) {
  // Fields live inside <journal_article>.
  const artBlock = firstMatch(/<journal_article>([\s\S]*?)<\/journal_article>/, xml) || xml;
  const doi = cdata(firstMatch(/<doi>([\s\S]*?)<\/doi>/, artBlock));
  const title = cdata(firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/, artBlock));
  const articleType = firstMatch(/<pubitype\s+type="([^"]+)"/, artBlock);
  // publication_date lives in journal_issue, not the article; fall back to /year in whole file.
  let year = firstMatch(/<publication_date>[\s\S]*?<year>(\d{4})<\/year>/, xml);
  if (!year) year = firstMatch(/<year>(\d{4})<\/year>/, xml);
  const articleId = null; // no separate id in this shape
  return { doi, title, articleType, year, articleId };
}

function extractNlmArticle(xml) {
  // NLM JATS shape. One <article> root, one article per file.
  const front = firstMatch(/<front>([\s\S]*?)<\/front>/, xml) || xml;
  const doi = firstMatch(/<article-id\s+pub-id-type="doi">([\s\S]*?)<\/article-id>/, front);
  const title = cdata(firstMatch(/<article-title[^>]*>([\s\S]*?)<\/article-title>/, front));
  // article-type comes off the root element
  const articleType = firstMatch(/<article\s+[^>]*article-type="([^"]+)"/, xml);
  // Prefer <pub-date pub-type="ppub"> then epub then any
  let year = firstMatch(/<pub-date[^>]*pub-type="ppub"[^>]*>[\s\S]*?<year>(\d{4})<\/year>/, front);
  if (!year) year = firstMatch(/<pub-date[^>]*pub-type="epub"[^>]*>[\s\S]*?<year>(\d{4})<\/year>/, front);
  if (!year) year = firstMatch(/<pub-date[^>]*>[\s\S]*?<year>(\d{4})<\/year>/, front);
  const articleId = firstMatch(/<article-id\s+pub-id-type="publisher-id">([\s\S]*?)<\/article-id>/, front);
  return { doi, title, articleType, year, articleId };
}

// ---- walker -------------------------------------------------------------
function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const ent of ents) {
    if (ent.name === '.DS_Store') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) { walk(full, out); continue; }
    if (!ent.isFile() || !/\.xml$/i.test(ent.name)) continue;
    let xml;
    try { xml = fs.readFileSync(full, 'utf8'); }
    catch (e) { console.error(`  read failed ${full}: ${e.message}`); continue; }
    const shape = detectShape(xml);
    let rec;
    if (shape === 'publication') rec = extractPublication(xml);
    else if (shape === 'content_batch') rec = extractContentBatch(xml);
    else if (shape === 'article') rec = extractNlmArticle(xml);
    else { out.push({ path: full, shape, doi: null, title: null, articleType: null, year: null, articleId: null }); continue; }
    out.push({ path: full, shape, ...rec });
  }
}

// ---- CSV --------------------------------------------------------------
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v).replace(/\r?\n/g, ' ').trim();
  if (/[",]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCsv(rows) {
  const header = 'path,shape,doi,title,articleType,year,articleId';
  const body = rows.map(r =>
    [r.path, r.shape, r.doi, r.title, r.articleType, r.year, r.articleId].map(csvEscape).join(',')
  ).join('\n');
  return header + '\n' + body + '\n';
}

// ---- main --------------------------------------------------------------
const summary = [];
for (const { key, dir } of REPOS) {
  console.log(`[canonical-walker] walking ${dir}…`);
  const rows = [];
  walk(dir, rows);
  console.log(`[canonical-walker]   ${rows.length} XML files`);
  // shape + coverage tally
  const shapes = {};
  let doiCount = 0, titleCount = 0;
  for (const r of rows) {
    shapes[r.shape] = (shapes[r.shape] || 0) + 1;
    if (r.doi) doiCount++;
    if (r.title) titleCount++;
  }
  const outPath = path.join(REPORTS, `canonicalRepoIds.${key}.csv`);
  fs.writeFileSync(outPath, toCsv(rows));
  console.log(`[canonical-walker]   wrote ${outPath}`);
  summary.push({ key, dir, total: rows.length, shapes, doiCount, titleCount });
}

// ---- summary --------------------------------------------------------
const md = [];
md.push('# SMPTE canonical-repo ID walker — summary');
md.push('');
md.push(`> Generated: ${new Date().toISOString()}`);
md.push('');
md.push('## Per-repo totals');
md.push('');
md.push('| repo | files | with DOI | with title | shapes |');
md.push('|---|---:|---:|---:|---|');
for (const s of summary) {
  const shapeStr = Object.entries(s.shapes).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`).join(' · ');
  md.push(`| ${s.key} | ${s.total} | ${s.doiCount} (${Math.round(s.doiCount/s.total*100)}%) | ${s.titleCount} (${Math.round(s.titleCount/s.total*100)}%) | ${shapeStr} |`);
}
md.push('');
md.push('## Files without DOI (candidates for review)');
md.push('');
for (const s of summary) {
  const missing = s.total - s.doiCount;
  md.push(`- **${s.key}**: ${missing} files. See CSV rows where \`doi\` is empty.`);
}
md.push('');
md.push('## Outputs');
md.push('');
md.push('- `src/main/reports/canonicalRepoIds.journal.csv`');
md.push('- `src/main/reports/canonicalRepoIds.conference.csv`');
md.push('- (this file) `src/main/reports/canonicalRepoIds.summary.md`');
fs.writeFileSync(path.join(REPORTS, 'canonicalRepoIds.summary.md'), md.join('\n') + '\n');
console.log(`[canonical-walker] wrote ${path.join(REPORTS, 'canonicalRepoIds.summary.md')}`);
