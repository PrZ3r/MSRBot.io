/*
 * ftxmlRefWalker.js — Todo #1 of the canonical-audit handoff.
 *
 * 2024+ post-IEEE issues carry NLM full-text XMLs in `FTXML/` subdirectories
 * of the canonical repos:
 *   _source/SMPTE/Journal Article Repository/<year>/<issue>/FTXML/*.xml   (213)
 *   _source/SMPTE/Conference Repository/.../<issue>/FTXML/*.xml           (76)
 * SMPTE's own importer skips these as "Aptara secondary" — the per-issue
 * `content_batch` sibling is the primary it ingests. So the FTXML files, and
 * the structured `<back><ref-list><ref><mixed-citation>` reference blocks they
 * carry, have NEVER been ingested. This walker catalogs them.
 *
 * KEY ORDERING FINDING (surfaced by this walk, contra the handoff's DOI-match
 * assumption): every FTXML article DOI is CANONICAL-ONLY — 0/211 journal and
 * 0/76 conference source articles exist in the registry. (Conference FTXML
 * carry an EMPTY `<article-id pub-id-type="doi">` — no DOI assigned yet at all.)
 * The Phase-3a extractor (extractSmpteJournalRefs.js) cited each ref FROM its
 * source registry doc; here the source docs don't exist yet, so ref routing is
 * BLOCKED ON new-doc ingestion (handoff todo #2). This walker therefore only
 * CATALOGS — it never mutates the registry or the MRI. The catalog is the
 * inventory that feeds the ingestion plan and, later, the ref-apply pass.
 *
 * What it records, per FTXML file:
 *   corpus, year, issue, path, article DOI (+ whether a registry doc owns it,
 *   exact-case per the never-lowercase-a-DOI rule), article title, ref count,
 *   refs carrying a `<pub-id pub-id-type="doi">`, and for each such ref-DOI
 *   whether the CITED work is already a registry doc (a link we could form even
 *   before the source doc lands). Each ref's contentHash is checked against the
 *   live MRI (#1229 pre-check) so the future apply pass knows how many of these
 *   citations are already known and would dedup rather than mint fresh orphans.
 *
 * Reports (delete-when-done, alongside the other canonical-audit artifacts):
 *   src/main/reports/smpte-canonical-audit/ftxmlRefCatalog.json   (full detail)
 *   src/main/reports/smpte-canonical-audit/ftxmlRefCatalog.md     (summary)
 *
 * Usage:
 *   node src/main/scripts/extras/smpte-canonical-audit/ftxmlRefWalker.js
 *   node src/main/scripts/extras/smpte-canonical-audit/ftxmlRefWalker.js --limit 20
 *
 * Read-only by construction; there is no --apply.
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs } = require('../../../lib/registry');
const { _contentHash } = require('../../../lib/referencing');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const NOW = new Date().toISOString();
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  if (idx < 0) return 0;
  const n = parseInt(process.argv[idx + 1] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
})();

const CORPORA = [
  { label: 'journal', root: '_source/SMPTE/Journal Article Repository' },
  { label: 'conference', root: '_source/SMPTE/Conference Repository' },
];

const OUT_JSON = 'src/main/reports/smpte-canonical-audit/ftxmlRefCatalog.json';
const OUT_MD = 'src/main/reports/smpte-canonical-audit/ftxmlRefCatalog.md';

// ---- registry + MRI indices ---------------------------------------------

console.log('[ftxml] loading registry…');
const docs = loadAllDocs();
// Exact-case DOI index — never lowercase a DOI join (canonical-audit rule #2).
const docByDoi = new Map();
for (const d of docs) if (d.doi) docByDoi.set(String(d.doi).trim(), d);
console.log(`[ftxml]   ${docs.length} registry docs, ${docByDoi.size} with a DOI`);

console.log('[ftxml] loading MRI contentHash set…');
const mriHashes = new Set();
try {
  const mri = JSON.parse(fs.readFileSync('src/main/reports/masterReferenceIndex.json', 'utf8'));
  for (const r of Object.values(mri.refs || {})) if (r && r.contentHash) mriHashes.add(r.contentHash);
} catch (e) {
  console.warn(`[ftxml]   MRI load skipped: ${e.message}`);
}
console.log(`[ftxml]   ${mriHashes.size} distinct MRI contentHashes`);

// ---- XML helpers (mirrors extractSmpteJournalRefs.js) --------------------

function walkXmlFiles(dir, out = []) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkXmlFiles(p, out);
    else if (e.isFile() && p.endsWith('.xml')) out.push(p);
  }
  return out;
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function stripInline(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function firstMatch(xml, re) {
  const m = xml.match(re);
  return m ? m[1] : '';
}

function articleDoi(xml) {
  return firstMatch(xml, /<article-id[^>]*pub-id-type=["']doi["'][^>]*>([^<]*)<\/article-id>/i).trim();
}

function articleTitle(xml) {
  return stripInline(firstMatch(xml, /<article-title\b[^>]*>([\s\S]*?)<\/article-title>/i));
}

function refDoi(refXml) {
  return firstMatch(refXml, /<pub-id[^>]*pub-id-type=["']doi["'][^>]*>([^<]+)<\/pub-id>/i).trim();
}

function extractRefs(xml) {
  const refList = xml.match(/<ref-list\b[\s\S]*?<\/ref-list>/);
  if (!refList) return [];
  const refs = refList[0].match(/<ref\b[^>]*>[\s\S]*?<\/ref>/g) || [];
  return refs.map((r) => {
    const refXmlId = firstMatch(r, /<ref\b[^>]*id=["']([^"']+)["']/);
    const doi = refDoi(r);
    const cite = stripInline(r.replace(/<ref\b[^>]*>|<\/ref>/g, ''));
    return { refXmlId, doi, cite, rawRef: r };
  });
}

// Pull "<year>/<issue>" out of the FTXML path for grouping in the report.
function pathParts(file) {
  const m = file.match(/\/(\d{4})\/([^/]+)\/FTXML\//);
  return { year: m ? m[1] : '', issue: m ? m[2] : '' };
}

// ---- walk ----------------------------------------------------------------

const perCorpus = {};
const files = [];

for (const { label, root } of CORPORA) {
  const xmlFiles = walkXmlFiles(root).filter((f) => f.includes(`${path.sep}FTXML${path.sep}`));
  xmlFiles.sort();
  console.log(`\n[ftxml] ${label}: ${xmlFiles.length} FTXML files`);

  const c = perCorpus[label] = {
    ftxmlFiles: xmlFiles.length,
    withArticleDoi: 0,
    emptyArticleDoi: 0,
    sourceDocInRegistry: 0,
    filesWithRefs: 0,
    totalRefs: 0,
    refsWithDoi: 0,
    refDoiTargetInRegistry: 0,
    refsKnownToMri: 0,
  };

  let processed = 0;
  for (const f of xmlFiles) {
    if (LIMIT && processed >= LIMIT) break;
    processed++;
    let xml; try { xml = fs.readFileSync(f, 'utf8'); } catch { continue; }

    const doi = articleDoi(xml);
    const { year, issue } = pathParts(f);
    const sourceDoc = doi ? docByDoi.get(doi) : null;
    if (doi) c.withArticleDoi++; else c.emptyArticleDoi++;
    if (sourceDoc) c.sourceDocInRegistry++;

    const refs = extractRefs(xml);
    if (refs.length) c.filesWithRefs++;
    c.totalRefs += refs.length;

    const refDetail = refs.map((r) => {
      const hash = _contentHash(r.rawRef);
      const knownToMri = hash ? mriHashes.has(hash) : false;
      const targetDoc = r.doi ? docByDoi.get(r.doi) : null;
      if (r.doi) c.refsWithDoi++;
      if (targetDoc) c.refDoiTargetInRegistry++;
      if (knownToMri) c.refsKnownToMri++;
      return {
        refXmlId: r.refXmlId,
        doi: r.doi || null,
        targetDocId: targetDoc ? targetDoc.docId : null,
        contentHash: hash,
        knownToMri,
        cite: r.cite.slice(0, 240),
      };
    });

    files.push({
      corpus: label,
      path: f,
      year,
      issue,
      articleDoi: doi || null,
      articleTitle: articleTitle(xml) || null,
      sourceDocId: sourceDoc ? sourceDoc.docId : null,
      sourceInRegistry: !!sourceDoc,
      refCount: refs.length,
      refs: refDetail,
    });
  }
}

// ---- report --------------------------------------------------------------

const catalog = { generatedAt: NOW, limit: LIMIT || null, perCorpus, files };
fs.writeFileSync(OUT_JSON, JSON.stringify(catalog, null, 2) + '\n', 'utf8');

const totals = Object.values(perCorpus).reduce((a, c) => {
  for (const k of Object.keys(c)) a[k] = (a[k] || 0) + c[k];
  return a;
}, {});

function corpusRow(label) {
  const c = perCorpus[label];
  return `| ${label} | ${c.ftxmlFiles} | ${c.withArticleDoi} | ${c.emptyArticleDoi} | ${c.sourceDocInRegistry} | ${c.filesWithRefs} | ${c.totalRefs} | ${c.refsWithDoi} | ${c.refDoiTargetInRegistry} | ${c.refsKnownToMri} |`;
}

const md = [
  '# FTXML reference catalog — canonical-audit todo #1\n',
  `> Generated at: ${NOW}`,
  `> Mode: **read-only catalog** (no registry / MRI writes)${LIMIT ? ` — limit ${LIMIT}` : ''}\n`,
  '## Corpus',
  '| corpus | FTXML files | w/ article DOI | empty DOI | source in registry | files w/ refs | total refs | refs w/ DOI | ref-DOI target in registry | refs already in MRI |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  corpusRow('journal'),
  corpusRow('conference'),
  `| **total** | ${totals.ftxmlFiles} | ${totals.withArticleDoi} | ${totals.emptyArticleDoi} | ${totals.sourceDocInRegistry} | ${totals.filesWithRefs} | ${totals.totalRefs} | ${totals.refsWithDoi} | ${totals.refDoiTargetInRegistry} | ${totals.refsKnownToMri} |`,
  '',
  '## Ordering finding — routing is blocked on ingestion',
  '',
  `- **${totals.sourceDocInRegistry}/${totals.ftxmlFiles}** FTXML source articles exist in the registry. Every FTXML article is`,
  '  a **canonical-only** doc (handoff todo #2): it has a per-issue `content_batch` sibling that SMPTE\'s',
  '  importer ingested, but that primary was never added to *our* registry, and the FTXML secondary',
  '  (which carries the refs) was skipped as "Aptara secondary".',
  '- The Phase-3a extractor (`extractSmpteJournalRefs.js`) attached each ref to its **source registry doc**.',
  '  Here the source docs do not exist yet, so there is nowhere to hang these refs. **Ref routing must wait',
  '  for new-doc ingestion (todo #2).** This walker only catalogs.',
  '- **Conference FTXML carry an empty `<article-id pub-id-type="doi">`** — no DOI is assigned yet, so those',
  '  source docs cannot be matched by DOI at all; ingestion will have to key them by title/issue/author.',
  '',
  '## What the refs give us today',
  '',
  `- **${totals.totalRefs}** structured references across **${totals.filesWithRefs}** files carry them; **${totals.refsWithDoi}** cite a DOI.`,
  `- **${totals.refDoiTargetInRegistry}** of those cited DOIs already resolve to a registry doc — i.e. once the source`,
  '  docs land, that many refs become direct canonical links immediately (exact-case DOI match).',
  `- **${totals.refsKnownToMri}** refs are already known to the MRI by contentHash (#1229 pre-check) — the future`,
  '  apply pass would dedup against these rather than mint fresh orphan slugs.',
  '',
  '## Next step',
  '',
  '1. Ingest the FTXML/`content_batch` canonical-only docs (todo #2) — 2024+ `<article>` NLM items can reuse',
  '   `readNlmArticleXml` in `extractSourceMetadata.js`.',
  '2. Re-run a Phase-3a-style apply over this catalog: for each source docId, attach the cataloged refs —',
  '   direct canonical link where `refDoiTargetInRegistry`, else content-hash-guarded orphan-slug mint.',
  '',
  '_Full per-file / per-ref detail in `ftxmlRefCatalog.json`._',
  '',
].join('\n');
fs.writeFileSync(OUT_MD, md, 'utf8');

console.log('\n[ftxml] catalog written:');
console.log(`  files cataloged            : ${files.length}`);
console.log(`  source docs in registry    : ${totals.sourceDocInRegistry}/${totals.ftxmlFiles}`);
console.log(`  total refs                 : ${totals.totalRefs} (${totals.refsWithDoi} with DOI)`);
console.log(`  ref-DOI target in registry : ${totals.refDoiTargetInRegistry}`);
console.log(`  refs already in MRI        : ${totals.refsKnownToMri}`);
console.log(`  reports                    : ${OUT_JSON}, ${OUT_MD}`);
