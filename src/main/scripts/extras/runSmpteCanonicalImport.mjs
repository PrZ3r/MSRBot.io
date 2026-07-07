/*
 * runSmpteCanonicalImport.mjs — SMPTE canonical-repo audit, Part 2.
 *
 * Runs SMPTE's own importer (smpte-journal-library, BSD-licensed) against
 * our _source/SMPTE/{Journal Article Repository, Conference Repository}
 * trees and dumps the resulting canonical Periodicals + Conferences object
 * trees to JSON. This gives us the SMPTE-authoritative view of every
 * article they consider valid.
 *
 * Behavior worth knowing:
 *   - The importer skips <article> NLM-shape files as "Aptara secondary
 *     articles" — they're duplicates of the <content_batch> version.
 *   - It parses <publication> (pre-2024 IDAMS) and <content_batch>
 *     (2024-2026 IEEE wind-down) into a shared Article model.
 *   - Requires @xmldom/xmldom + xpath from smpte-journal-library's own
 *     node_modules; we import their importLibrary.mjs by absolute path
 *     so Node resolves those deps in-place.
 *
 * Output:
 *   src/main/reports/canonicalLibrary.journal.json
 *   src/main/reports/canonicalLibrary.conference.json
 *   src/main/reports/canonicalLibrary.summary.md
 *
 * Usage:
 *   node src/main/scripts/extras/runSmpteCanonicalImport.mjs
 *   node src/main/scripts/extras/runSmpteCanonicalImport.mjs --lib-path <path>
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

// Locate smpte-journal-library. Default is a sibling of PrZ3r/ under
// Repos/SMPTE/. Override with --lib-path if you cloned it elsewhere.
const DEFAULT_LIB = path.resolve(REPO_ROOT, '../../SMPTE/smpte-journal-library/src/library/js/importLibrary.mjs');
function argStr(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] != null ? process.argv[i + 1] : def;
}
const LIB_ENTRY = path.resolve(argStr('--lib-path', DEFAULT_LIB));

const SOURCES = [
  { key: 'journal', dir: path.join(REPO_ROOT, '_source/SMPTE/Journal Article Repository') },
  { key: 'conference', dir: path.join(REPO_ROOT, '_source/SMPTE/Conference Repository') },
];

// Quick existence checks so we fail fast with a useful message
try { await fs.access(LIB_ENTRY); }
catch { console.error(`SMPTE library not found at ${LIB_ENTRY}\nPass --lib-path <path-to-importLibrary.mjs>`); process.exit(1); }
for (const s of SOURCES) {
  try { await fs.access(s.dir); }
  catch { console.error(`Source not found: ${s.dir}`); process.exit(1); }
}

// Dynamic-import their entry point (Node resolves their deps via their
// node_modules because the import URL sits inside their tree).
console.log(`[canonical-import] loading ${LIB_ENTRY}`);
const { load } = await import(LIB_ENTRY);

// Minimal logger. Their loader logs per-500-articles + per-error.
const errors = [];
function makeLogger(key) {
  return {
    log: (m) => console.log(`  [${key}] ${m}`),
    warn: (m) => { console.warn(`  [${key}] WARN ${m}`); errors.push({ key, level: 'warn', message: String(m) }); },
    info: (m) => console.log(`  [${key}] ${m}`),
    error: (m) => { console.error(`  [${key}] ERROR ${m}`); errors.push({ key, level: 'error', message: String(m) }); },
  };
}

// Serialize their Periodicals / Conferences trees to plain JSON.
// Class members are private (`_x`); accessors are exposed via getters.
// Instead of reflecting, walk the shape explicitly so the output is
// stable and diffable.

function serializeAuthor(a) {
  return { name: a.name ?? null };
}
function serializePubDate(d) {
  if (!d) return null;
  return { year: d.year ?? null, month: d.month ?? null, day: d.day ?? null };
}
function serializeArticle(a) {
  return {
    number: a.number ?? null,
    title: a.title ?? null,
    doi: a.doi ?? null,
    abstract: a.abstract ?? null,
    contentType: a.contentType ? a.contentType._name : null,
    pubDate: serializePubDate(a.pubDate),
    authors: [...a.authorIterator()].map(serializeAuthor),
    keywords: [...a.keywordIterator()],
    mainPath: a.mainPath ?? null,
    isOpenAccess: a.isOpenAccess ?? null,
  };
}
function serializeIssue(i) {
  return {
    identifier: i.identifier ?? null,
    date: serializePubDate(i.date),
    articles: [...i.articleIterator()].map(serializeArticle),
  };
}
function serializeVolume(v) {
  return {
    number: v.number ?? null,
    year: v.year ?? null,
    issues: [...v.issueIterator()].map(serializeIssue),
  };
}
function serializePeriodical(p) {
  return {
    title: p.title ?? null,
    pISSN: p.pISSN ?? null,
    eISSN: p.eISSN ?? null,
    volumes: [...p.volumeIterator()].map(serializeVolume),
  };
}
function serializePeriodicals(ps) {
  return { periodicals: [...ps.periodicalIterator()].map(serializePeriodical) };
}
function serializeConference(c) {
  return {
    title: c.title ?? null,
    doi: c.doi ?? null,
    pubDate: serializePubDate(c.pubDate),
    articles: [...c.articleIterator()].map(serializeArticle),
  };
}
function serializeConferences(cs) {
  return { conferences: [...cs.conferenceIterator()].map(serializeConference) };
}

// Count articles for the summary
function countPeriodicalArticles(dump) {
  let n = 0;
  for (const p of dump.periodicals || []) for (const v of p.volumes || []) for (const i of v.issues || []) n += (i.articles || []).length;
  return n;
}
function countConferenceArticles(dump) {
  let n = 0;
  for (const c of dump.conferences || []) n += (c.articles || []).length;
  return n;
}

// Run each source
const results = [];
for (const { key, dir } of SOURCES) {
  console.log(`\n[canonical-import] loading ${key} from ${dir}`);
  const t0 = Date.now();
  const library = await load(dir, makeLogger(key));
  if (!library) { console.error(`  load returned null for ${key}`); continue; }
  const dump = key === 'conference' ? serializeConferences(library.conferences) : serializePeriodicals(library.periodicals);
  const count = key === 'conference' ? countConferenceArticles(dump) : countPeriodicalArticles(dump);
  const outPath = `src/main/reports/canonicalLibrary.${key}.json`;
  await fs.writeFile(outPath, JSON.stringify(dump, null, 2) + '\n');
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[canonical-import] ${key}: ${count} articles serialized in ${dt}s → ${outPath}`);
  results.push({ key, dir, count, outPath, seconds: dt });
}

// Summary
const errsByKey = {};
for (const e of errors) { errsByKey[e.key] = (errsByKey[e.key] || 0) + 1; }
const md = [];
md.push('# SMPTE canonical-library import — summary');
md.push('');
md.push(`> Generated: ${new Date().toISOString()}`);
md.push(`> Library entry: \`${LIB_ENTRY}\``);
md.push('');
md.push('## Per-corpus results');
md.push('');
md.push('| corpus | articles | errors/warnings | seconds | output |');
md.push('|---|---:|---:|---:|---|');
for (const r of results) {
  md.push(`| ${r.key} | ${r.count} | ${errsByKey[r.key] || 0} | ${r.seconds} | \`${r.outPath}\` |`);
}
md.push('');
if (errors.length) {
  md.push('## First 20 errors/warnings');
  md.push('');
  for (const e of errors.slice(0, 20)) {
    md.push(`- \`${e.key}\` **${e.level}**: ${e.message}`);
  }
  md.push('');
}
md.push('## Notes');
md.push('');
md.push('- The `<article>` NLM-shape files (2024+ post-IEEE dupes) are deliberately skipped by the importer.');
md.push('- Article-level fields captured: number, title, doi, abstract, contentType, pubDate, authors[], keywords[], mainPath, isOpenAccess.');
md.push('- Structural fields (Periodical→Volume→Issue→Article for journal; Conference→Article for conference) preserved in the dump.');
await fs.writeFile('src/main/reports/canonicalLibrary.summary.md', md.join('\n') + '\n');
console.log(`\n[canonical-import] wrote src/main/reports/canonicalLibrary.summary.md`);
