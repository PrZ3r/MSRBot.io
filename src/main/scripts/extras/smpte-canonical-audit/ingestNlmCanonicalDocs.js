/*
 * ingestNlmCanonicalDocs.js — Todo #2 of the canonical-audit handoff.
 *
 * Mints registry docs for the 2024+ NLM-era SMPTE canonical papers that our
 * registry never imported. The source of truth is the per-paper `content_batch`
 * PRIMARY file (IEEE content_delivery 1.6 shape) at each issue root — NOT the
 * FTXML `<article>` secondary. The primary is authoritative: it carries the DOI
 * (the FTXML `<article-id>` is frequently EMPTY even when a DOI exists), the
 * `article_sequence`, ISBN/ISSN, pages, keywords, and richer author blocks.
 *
 * Scope: every `<content_batch>` primary under both canonical repos that is NOT
 * already in the registry (all 491 are canonical-only). Journal + Conference.
 * Front-matter (advert/front-cover/toc/list-staff/…) is INCLUDED per the
 * 2026-07-10 "ingest everything" decision — those contentTypes are already in
 * site.json noPageContentTypes, so they land in the registry but render no page.
 *
 * Keying (never lowercase a DOI — canonical-audit rule):
 *   - DOI present  → docId = doi.replace(/\//g,'-')     e.g. 10.5594-JMI.2025-LZES6606
 *   - DOI-less     → ISBN/ISSN + issue coordinates + article_sequence:
 *       · conference: `<isbn>-<seq>`             (ISBN is per-event ⇒ unique)
 *       · journal   : `<issn>-v<vol>.<issue>-<seq>` (ISSN is journal-wide ⇒ needs vol/issue)
 *     See memory: project_smpte_doiless_conf_keying. Exact format is surfaced
 *     here for review; the script asserts GLOBAL docId uniqueness and refuses to
 *     stage a colliding pair.
 *
 * contentType comes straight from `<pubitype type="…">` — already conformant to
 * the registry contentTypeLabels vocab, so no remap.
 *
 * Refs are NOT handled here — the FTXML ref catalog (ftxmlRefWalker.js) routes
 * onto these docIds in a later Phase-3a-style apply, once the docs exist.
 *
 * Read-only by default: stages the proposed docs to a report for review.
 *   node …/ingestNlmCanonicalDocs.js               # dry-run → staging report
 *   node …/ingestNlmCanonicalDocs.js --apply       # saveDoc() each staged doc
 *   node …/ingestNlmCanonicalDocs.js --limit 20    # cap to N primaries
 *
 * Reports:
 *   src/main/reports/smpte-canonical-audit/nlmIngest.json   (full staged docs)
 *   src/main/reports/smpte-canonical-audit/nlmIngest.md     (summary)
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs, saveDoc } = require('../../../lib/registry');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const NOW = new Date().toISOString();
const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  if (i < 0) return 0;
  const n = parseInt(process.argv[i + 1] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
})();

const CORPORA = [
  { label: 'journal', root: '_source/SMPTE/Journal Article Repository', docType: 'Journal Article' },
  { label: 'conference', root: '_source/SMPTE/Conference Repository', docType: 'Conference Paper' },
];
const OUT_JSON = 'src/main/reports/smpte-canonical-audit/nlmIngest.json';
const OUT_MD = 'src/main/reports/smpte-canonical-audit/nlmIngest.md';

// ---- helpers -------------------------------------------------------------

function walk(dir, out = []) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && p.endsWith('.xml')) out.push(p);
  }
  return out;
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ''; } })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function norm(s) { return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); }
function tag(x, t) { const m = String(x).match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1] : ''; }
function tagText(x, t) { return norm(tag(x, t)); }
function attr(x, t, a) { const m = String(x).match(new RegExp(`<${t}\\b[^>]*\\b${a}="([^"]*)"`, 'i')); return m ? m[1] : ''; }
function all(x, re) { const o = []; let m; const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); while ((m = r.exec(x))) o.push(m); return o; }

const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
function firstMonthNum(monthText) {
  const m = String(monthText || '').toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  return m ? MONTHS[m[1]] : null;
}

// Slug the issue-folder token for path-safe use in DOI-less journal keys.
function issueFolderToken(file) {
  const m = file.match(/\/(\d{4})\/([^/]+)\//);
  return m ? `${m[1]}-${m[2]}` : 'unknown';
}

// ---- content_batch reader (journal_article | conference_article) ---------

function readContentBatch(file) {
  const xml = fs.readFileSync(file, 'utf8');
  if (!/<content_batch\b/.test(xml)) return null;
  const isConf = /<conference_article\b/.test(xml);
  const artBlock = tag(xml, isConf ? 'conference_article' : 'journal_article');
  if (!artBlock) return null;

  const doi = tagText(artBlock, 'doi');
  const seq = tagText(artBlock, 'article_sequence');
  const contentType = attr(artBlock, 'pubitype', 'type') || null;
  const title = norm(tag(artBlock, 'title'));
  const abstract = tagText(artBlock, 'abstract') || null;
  const majorTopic = tagText(artBlock, 'major_topic') || null;

  // pages
  const pagesBlock = tag(artBlock, 'pages');
  const fpage = tagText(pagesBlock, 'first_page') || tagText(artBlock, 'first_page');
  const lpage = tagText(pagesBlock, 'last_page') || tagText(artBlock, 'last_page');
  const pages = fpage && lpage ? `${fpage}–${lpage}` : (fpage || null);

  // authors — object form [{name}]
  const authors = [];
  for (const m of all(artBlock, /<person_name\b[^>]*>[\s\S]*?<\/person_name>/gi)) {
    const b = m[0];
    if (/author_type="editor"/i.test(b)) continue;
    const given = tagText(b, 'given_name');
    const surname = tagText(b, 'surname');
    const full = [given, surname].filter(Boolean).join(' ').trim();
    if (full) authors.push({ name: full });
  }

  // keywords — index_terms/term
  const keywords = all(tag(artBlock, 'index_terms'), /<term>([\s\S]*?)<\/term>/gi).map((m) => norm(m[1])).filter(Boolean);

  const copyBlock = tag(xml, 'copyright');
  const copyrightHolder = tagText(copyBlock, 'copyright_holder') || null;
  const copyrightYear = tagText(copyBlock, 'year') || null;

  let out = { file, isConf, doi: doi || null, seq: seq || null, contentType, title, abstract, majorTopic, pages, fpage: fpage || null, lpage: lpage || null, authors, keywords, copyrightHolder, copyrightYear };

  if (isConf) {
    const meta = tag(xml, 'conference_metadata');
    out.containerTitle = tagText(meta, 'conference_name') || tagText(meta, 'full_title') || null;
    out.acronym = tagText(meta, 'conference_acronym') || null;
    out.isbn = tagText(meta, 'isbn') || null;
    out.meetingLocation = tagText(meta, 'meeting_location') || null;
    const cd = xml.match(/<conference_date\b[^>]*>/i);
    out.year = cd ? (cd[0].match(/start_year="(\d{4})"/) || [])[1] || null : null;
    out.month = cd ? firstMonthNum((cd[0].match(/start_month="([^"]*)"/) || [])[1]) : null;
    out.day = cd ? ((cd[0].match(/start_day="(\d{1,2})"/) || [])[1] || null) : null;
    out.volume = tagText(tag(xml, 'conference_issue'), 'volume') || null;
    out.issue = null;
  } else {
    const meta = tag(xml, 'journal_metadata');
    out.containerTitle = tagText(meta, 'full_title') || null;
    out.abbrevTitle = tagText(meta, 'abbrev_title') || null;
    out.acronym = tagText(meta, 'journal_acronym') || null;
    out.issnPrint = (meta.match(/<issn[^>]*type="paper"[^>]*>([^<]+)<\/issn>/i) || [])[1] || null;
    out.issnElectronic = (meta.match(/<issn[^>]*type="electronic"[^>]*>([^<]+)<\/issn>/i) || [])[1] || null;
    const ji = tag(xml, 'journal_issue');
    const pd = tag(ji, 'publication_date');
    out.year = tagText(pd, 'year') || null;
    out.month = firstMonthNum(tagText(pd, 'month'));
    const jv = tag(ji, 'journal_volume');
    out.volume = tagText(jv, 'volume') || null;
    out.issue = tagText(jv, 'issue') || null;
  }
  return out;
}

// ---- doc assembly --------------------------------------------------------

function docIdFor(rec, issueToken) {
  if (rec.doi) {
    const base = rec.doi.replace(/\//g, '-');
    // Duplicate-DOI upstream error: disambiguate with issue-folder + seq so
    // neither paper squats the bare DOI-docId. Re-key once SMPTE resolves.
    return dupDois.has(rec.doi) ? `${base}__${issueToken}-${rec.seq || '0'}` : base;
  }
  // DOI-less fallback
  const seq = rec.seq || '0';
  if (rec.isConf) {
    const isbn = rec.isbn || 'noisbn';
    return `${isbn}-${seq}`;
  }
  const issn = rec.issnElectronic || rec.issnPrint || 'noissn';
  const vol = rec.volume || '0';
  const iss = rec.issue || '0';
  return `${issn}-v${vol}.${iss}-${seq}`;
}

function publicationDate(rec) {
  // Registry convention: uniform YYYY-MM-DD (day synthesized as 01 where the
  // source carries only month/year — matches all 26k existing dated docs).
  if (!rec.year) return null;
  const mm = rec.month || '01';
  const dd = (rec.day ? String(rec.day).padStart(2, '0') : '01');
  return `${rec.year}-${mm}-${dd}`;
}

function docLabel(rec, docType) {
  const parts = [];
  if (rec.acronym) parts.push(rec.acronym);
  if (rec.year) parts.push(rec.year);
  const bits = [parts.join(' ')].filter(Boolean);
  if (docType === 'Conference Paper') {
    if (rec.seq) bits.push(`Article ${rec.seq}`);
  } else {
    if (rec.volume) bits.push(`Volume ${rec.volume}`);
    if (rec.issue) bits.push(`Number ${rec.issue}`);
  }
  let label = bits.join(', ');
  if (rec.fpage && rec.lpage) label += ` (pp. ${rec.fpage} to ${rec.lpage})`;
  else if (rec.fpage) label += ` (p. ${rec.fpage})`;
  return label || (rec.title || 'Untitled');
}

const META_HI = { source: 'parsed', confidence: 'high', updated: NOW, note: 'Ingested from SMPTE canonical content_batch via ingestNlmCanonicalDocs.js' };
const META_MED = { ...META_HI, confidence: 'medium' };

function metaFor(key) {
  return /doi|docId|docType|contentType|pages|volume|number/.test(key) ? { ...META_HI } : { ...META_MED };
}

// Stamp a $meta sibling on every non-$meta sub-key of a nested object, matching
// the registry convention (issn.print$meta, copyright.holder$meta, …). Without
// this, canonicalize's ensureMeta() recurses in and back-fills those sub-fields
// with a default `source: "manual"` $meta.
function stampNested(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.endsWith('$meta')) continue;
    out[k] = v;
    out[`${k}$meta`] = metaFor(k);
  }
  return out;
}

function withMeta(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v === null || v === undefined) continue;
    if (k === 'status') { out[k] = v; continue; }
    // Nested objects (issn / isbn / copyright / publisherLocation): stamp each
    // sub-field AND keep a top-level $meta — both, as fully-canonicalized docs carry.
    out[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? stampNested(v) : v;
    out[`${k}$meta`] = metaFor(k);
  }
  return out;
}

function buildDoc(rec, docType, issueToken) {
  const docId = docIdFor(rec, issueToken);
  const doi = rec.doi;
  const pubDate = publicationDate(rec);
  const doc = {
    docId,
    docType,
    docLabel: docLabel(rec, docType),
    docTitle: rec.title || rec.contentType || 'Untitled',
    doi: doi || null,
    authors: rec.authors.length ? rec.authors : null,
    abstract: rec.abstract,
    pages: rec.pages,
    volume: rec.volume,
    number: rec.issue,
    publicationDate: pubDate,
    journalTitle: rec.containerTitle,
    abbrevTitle: rec.abbrevTitle || null,
    journalAcronym: rec.acronym || null,
    issn: rec.isConf
      ? null
      : ((rec.issnPrint || rec.issnElectronic) ? { ...(rec.issnPrint ? { print: rec.issnPrint } : {}), ...(rec.issnElectronic ? { electronic: rec.issnElectronic } : {}) } : null),
    isbn: rec.isConf && rec.isbn ? { electronic: rec.isbn } : null,
    publisher: 'SMPTE',
    publisherLocation: rec.meetingLocation ? { city: rec.meetingLocation } : null,
    contentType: rec.contentType,
    keywords: rec.keywords.length ? rec.keywords : null,
    copyright: (rec.copyrightHolder || rec.copyrightYear)
      ? { ...(rec.copyrightHolder ? { holder: rec.copyrightHolder } : {}), ...(rec.copyrightYear ? { year: rec.copyrightYear } : {}) }
      : null,
    href: doi ? `https://doi.org/${doi}` : null,
  };
  const withM = withMeta(doc);
  withM.status = { active: true, active$meta: { ...META_MED } };
  return withM;
}

// ---- run -----------------------------------------------------------------

console.log('[ingest] loading registry…');
// "Pre-existing" excludes docs THIS ingester previously wrote (identified by the
// ingest note), so a corrective re-apply re-stages and overwrites our own docs
// rather than skipping them as already-present — while still skipping genuinely
// pre-existing registry docs.
const OUR_NOTE = 'ingestNlmCanonicalDocs.js';
const isOurs = (d) => String((d['docId$meta'] || {}).note || '').includes(OUR_NOTE);
const _allDocs = loadAllDocs();
const existing = new Set(_allDocs.filter((d) => d.doi && !isOurs(d)).map((d) => String(d.doi).trim()));
const existingIds = new Set(_allDocs.filter((d) => !isOurs(d)).map((d) => d.docId));

// Pre-scan: DOIs the canonical source assigned to MORE THAN ONE distinct paper.
// (A genuine SMPTE upstream error — see the collision report / upstream register.)
// Both members of such a pair get a disambiguated docId so neither squats the
// bare DOI-docId; they're cleanly re-keyable once SMPTE fixes the duplicate.
const doiCounts = new Map();
for (const { root } of CORPORA) {
  for (const f of walk(root).filter((p) => !p.includes(`${path.sep}FTXML${path.sep}`))) {
    let head; try { head = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (!head.slice(0, 400).includes('<content_batch')) continue;
    const d = (head.match(/<doi>([^<]*)<\/doi>/i) || [])[1];
    if (d && d.trim() && !existing.has(d.trim())) doiCounts.set(d.trim(), (doiCounts.get(d.trim()) || 0) + 1);
  }
}
const dupDois = new Set([...doiCounts].filter(([, n]) => n > 1).map(([d]) => d));
if (dupDois.size) console.log(`[ingest] ${dupDois.size} DOIs assigned to >1 paper upstream — disambiguating both sides`);

const staged = [];
const collisions = [];
const dupDoiPairs = [];
const skippedInReg = { count: 0 };
const seenIds = new Map();
const byCorpus = {};
const byContentType = {};
const keyMode = { doi: 0, isbnSeq: 0, issnVolIssueSeq: 0 };

for (const { label, root, docType } of CORPORA) {
  const primaries = walk(root)
    .filter((f) => !f.includes(`${path.sep}FTXML${path.sep}`))
    .filter((f) => { try { return fs.readFileSync(f, 'utf8').slice(0, 400).includes('<content_batch'); } catch { return false; } });
  primaries.sort();
  console.log(`[ingest] ${label}: ${primaries.length} content_batch primaries`);
  byCorpus[label] = { primaries: primaries.length, staged: 0, inRegistry: 0 };

  let n = 0;
  for (const f of primaries) {
    if (LIMIT && n >= LIMIT) break;
    n++;
    let rec; try { rec = readContentBatch(f); } catch (e) { console.warn(`[ingest] read failed ${f}: ${e.message}`); continue; }
    if (!rec) continue;

    if (rec.doi && existing.has(rec.doi)) { skippedInReg.count++; byCorpus[label].inRegistry++; continue; }

    const issueToken = issueFolderToken(f);
    const doc = buildDoc(rec, docType, issueToken);
    if (rec.doi && dupDois.has(rec.doi)) {
      doc.doiCollision = rec.doi;
      doc.doiCollision$meta = { source: 'parsed', confidence: 'high', updated: NOW, note: `SMPTE assigned this DOI to >1 paper; docId disambiguated pending upstream fix.` };
      dupDoiPairs.push({ doi: rec.doi, docId: doc.docId, title: rec.title, file: f });
    }

    // key-mode tally + collision guard
    if (rec.doi) keyMode.doi++;
    else if (rec.isConf) keyMode.isbnSeq++;
    else keyMode.issnVolIssueSeq++;

    if (seenIds.has(doc.docId) || existingIds.has(doc.docId)) {
      collisions.push({ docId: doc.docId, file: f, other: seenIds.get(doc.docId) || '(existing registry doc)' });
    }
    seenIds.set(doc.docId, f);

    byContentType[rec.contentType || '?'] = (byContentType[rec.contentType || '?'] || 0) + 1;
    byCorpus[label].staged++;
    staged.push({ corpus: label, sourceFile: f, docId: doc.docId, keyMode: rec.doi ? 'doi' : (rec.isConf ? 'isbn-seq' : 'issn-vol-issue-seq'), doc });
  }
}

console.log(`[ingest] staged ${staged.length} docs | skipped in-registry ${skippedInReg.count} | collisions ${collisions.length}`);

// ---- apply / report ------------------------------------------------------

if (APPLY) {
  if (collisions.length) {
    console.error(`[ingest] REFUSING to apply — ${collisions.length} docId collisions. Resolve keying first (see report).`);
    process.exit(1);
  }
  console.log(`[ingest] APPLY: writing ${staged.length} docs…`);
  let w = 0;
  for (const s of staged) {
    saveDoc(s.doc);
    if (++w % 100 === 0) console.log(`[ingest]   …${w}/${staged.length}`);
  }
  console.log(`[ingest] wrote ${w} docs.`);
}

const summary = {
  generatedAt: NOW,
  apply: APPLY,
  limit: LIMIT || null,
  totals: { staged: staged.length, skippedInRegistry: skippedInReg.count, collisions: collisions.length, duplicateUpstreamDois: dupDois.size },
  byCorpus,
  keyMode,
  byContentType,
  duplicateDoiPairs: dupDoiPairs,
  collisions: collisions.slice(0, 50),
  staged,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2) + '\n', 'utf8');

const md = [
  '# NLM canonical new-doc ingestion — todo #2\n',
  `> Generated: ${NOW}`,
  `> Mode: **${APPLY ? 'APPLY' : 'DRY-RUN'}**${LIMIT ? ` (limit ${LIMIT})` : ''}\n`,
  '## Totals',
  `- content_batch primaries staged as new docs: **${staged.length}**`,
  `- skipped (DOI already in registry): ${skippedInReg.count}`,
  `- **docId collisions: ${collisions.length}** ${collisions.length ? '⚠️ must resolve before --apply' : '✓'}\n`,
  '## By corpus',
  '| corpus | primaries | staged | already in registry |',
  '|---|---:|---:|---:|',
  ...Object.entries(byCorpus).map(([k, v]) => `| ${k} | ${v.primaries} | ${v.staged} | ${v.inRegistry} |`),
  '',
  '## docId key mode',
  '| mode | count | example format |',
  '|---|---:|---|',
  `| DOI → dash | ${keyMode.doi} | \`10.5594-JMI.2025-LZES6606\` |`,
  `| ISBN + seq (conference DOI-less) | ${keyMode.isbnSeq} | \`978-1-61482-965-2-1\` |`,
  `| ISSN + vol.issue + seq (journal DOI-less) | ${keyMode.issnVolIssueSeq} | \`2160-2492-v133.1-1\` |`,
  '',
  '## contentType distribution (from `<pubitype>`, verbatim registry vocab)',
  '| contentType | count |',
  '|---|---:|',
  ...Object.entries(byContentType).sort(([, a], [, b]) => b - a).map(([k, v]) => `| \`${k}\` | ${v} |`),
  '',
  ...(dupDoiPairs.length ? [`## Duplicate-DOI upstream errors (${dupDois.size} DOIs → ${dupDoiPairs.length} papers)`, 'SMPTE assigned one DOI to multiple distinct papers. Both sides staged with a disambiguated docId (re-key once fixed). **→ smpte-upstream register (todo #3).**', '', '| DOI | disambiguated docId | title |', '|---|---|---|', ...dupDoiPairs.map((p) => `| \`${p.doi}\` | \`${p.docId}\` | ${(p.title || '').slice(0, 60)} |`), ''] : []),
  ...(collisions.length ? ['## ⚠️ Unresolved collisions (first 50) — must fix before --apply', '| docId | file | collides with |', '|---|---|---|', ...collisions.slice(0, 50).map((c) => `| \`${c.docId}\` | ${c.file} | ${c.other} |`), ''] : []),
  '## Notes',
  '- Source = `content_batch` PRIMARY (authoritative DOI/seq/isbn), not the FTXML secondary.',
  '- Front-matter (advert/front-cover/toc/list-staff/…) is ingested per the 2026-07-10 decision; those',
  '  contentTypes sit in `noPageContentTypes`, so they populate the registry without rendering pages.',
  '- Refs are NOT attached here — `ftxmlRefWalker.js`\'s catalog routes onto these docIds in a later pass.',
  '- Full staged doc bodies (with `$meta`) in `nlmIngest.json`.\n',
].join('\n');
fs.writeFileSync(OUT_MD, md, 'utf8');

console.log(`[ingest] ${APPLY ? 'APPLIED' : 'DRY-RUN'} — reports: ${OUT_JSON}, ${OUT_MD}`);
if (!APPLY) console.log('  review the staging report, then re-run with --apply.');
