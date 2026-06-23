/*
 * migrateAuthorsToObjectForm.js — #1196.
 *
 * Two passes:
 *
 * 1. Build a per-docId affiliation/bio index from `_source/SMPTE/HIGHWIRE/`
 *    NLM article XMLs (~21k files). Per-author affiliation lives in <aff>
 *    blocks referenced by <xref rid="aff_N"> from each <contrib>. Per-author
 *    bio lives in <bio> blocks similarly cross-referenced. Matched to
 *    registry docIds via the article's <article-id pub-id-type="doi">.
 *
 * 2. Walk the registry. For every doc with string-form authors[]:
 *      - If the HIGHWIRE index has a matching entry AND author counts agree,
 *        zip registry-name + HIGHWIRE-affiliation/bio (registry name wins —
 *        preserves any manual corrections; HIGHWIRE enriches metadata).
 *      - Otherwise, shape-only migration: each string becomes { name: string }.
 *
 *    docs already in object form (e.g. the j18501 demo from PR #1191) are
 *    skipped. authors$meta gains a migration-stamp note.
 *
 * Dry-run by default + --apply (registry-mutating; user runs per convention).
 *
 *   node src/main/scripts/extras/migrateAuthorsToObjectForm.js
 *   node src/main/scripts/extras/migrateAuthorsToObjectForm.js -- --apply
 *
 * Reports:
 *   src/main/reports/authorsMigration.{json,md}
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs, saveDoc } = require('../../lib/registry');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();

const HIGHWIRE_ROOT = '_source/SMPTE/HIGHWIRE';
const OUT_JSON = 'src/main/reports/authorsMigration.json';
const OUT_MD = 'src/main/reports/authorsMigration.md';

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#x2019;|’/g, "'");
}

function stripInlineXml(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

// ---- Pass 1: build HIGHWIRE backfill index --------------------------------

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

function parseNlmArticle(xml) {
  // Each XML may have multiple <article-meta> blocks, but the typical SMPTE
  // HIGHWIRE file is one article per file. Pull all and process each.
  const blocks = xml.match(/<article-meta\b[\s\S]*?<\/article-meta>/g) || [];
  const results = [];
  for (const meta of blocks) {
    // DOI
    const doi = (meta.match(/<article-id[^>]*pub-id-type=["']doi["'][^>]*>([^<]+)<\/article-id>/i) || [])[1];
    if (!doi) continue;

    // <aff id="..."> blocks (anywhere in the article XML — sometimes outside <article-meta>)
    const affsRaw = (xml.match(/<aff\b[^>]*>[\s\S]*?<\/aff>/g) || []);
    const affs = {};
    for (const a of affsRaw) {
      const id = (a.match(/<aff[^>]*id=["']([^"']+)["']/) || [])[1];
      if (!id) continue;
      // strip <label> and any other inline markup
      const text = stripInlineXml(a.replace(/<aff[^>]*>/, '').replace(/<\/aff>$/, '').replace(/<label\b[^>]*>[\s\S]*?<\/label>/g, ''));
      if (text) affs[id] = text;
    }

    // <bio id="..."> blocks
    const biosRaw = (xml.match(/<bio\b[^>]*>[\s\S]*?<\/bio>/g) || []);
    const bios = {};
    for (const b of biosRaw) {
      const id = (b.match(/<bio[^>]*id=["']([^"']+)["']/) || [])[1];
      if (!id) continue;
      const text = stripInlineXml(b.replace(/<bio[^>]*>/, '').replace(/<\/bio>$/, ''));
      if (text) bios[id] = text;
    }

    // <contrib contrib-type="author"> blocks
    const contribs = (meta.match(/<contrib\b[^>]*contrib-type=["']author["'][^>]*>[\s\S]*?<\/contrib>/g) || []);
    const authors = [];
    for (const c of contribs) {
      const surname = stripInlineXml((c.match(/<surname\b[^>]*>([\s\S]*?)<\/surname>/) || [])[1] || '');
      const given = stripInlineXml((c.match(/<given-names\b[^>]*>([\s\S]*?)<\/given-names>/) || [])[1] || '');
      const name = [given, surname].filter(Boolean).join(' ').trim();
      if (!name) continue;

      const affRids = [...c.matchAll(/<xref\b[^>]*ref-type=["']aff["'][^>]*rid=["']([^"']+)["']/g)].map(m => m[1]);
      const bioRids = [...c.matchAll(/<xref\b[^>]*rid=["']([^"']+)["'][^>]*ref-type=["']other["']|<xref\b[^>]*ref-type=["']other["'][^>]*rid=["']([^"']+)["']/g)].map(m => m[1] || m[2]).filter(Boolean);

      const affiliation = affRids.map(rid => affs[rid]).filter(Boolean).join('; ') || undefined;
      const bio = bioRids.map(rid => bios[rid]).filter(Boolean).join('\n\n') || undefined;

      authors.push({ name, affiliation, bio });
    }
    if (authors.length) results.push({ doi, authors });
  }
  return results;
}

function doiToDocId(doi) {
  // Mirror parseSourceName's doiToDocId: replace forward slash with hyphen,
  // preserve case (SMPTE uses J* (uppercase, pre-1955 Transactions) AND j*
  // (lowercase, 2010+ MIJ) as distinct namespaces — case must survive).
  return String(doi).replace(/\//g, '-');
}

console.log('[migrate-authors] Pass 1: building HIGHWIRE backfill index…');
const xmlFiles = walkXmlFiles(HIGHWIRE_ROOT);
console.log(`[migrate-authors]   ${xmlFiles.length} XML files to scan`);

const backfill = new Map(); // docId → [{name, affiliation?, bio?}]
let filesParsed = 0, articlesParsed = 0, withAff = 0, withBio = 0;
for (const f of xmlFiles) {
  let xml; try { xml = fs.readFileSync(f, 'utf8'); } catch { continue; }
  filesParsed++;
  const articles = parseNlmArticle(xml);
  for (const art of articles) {
    articlesParsed++;
    const docId = doiToDocId(art.doi);
    // First write wins — there's effectively one canonical XML per docId.
    if (!backfill.has(docId)) backfill.set(docId, art.authors);
    if (art.authors.some(a => a.affiliation)) withAff++;
    if (art.authors.some(a => a.bio)) withBio++;
  }
  if (filesParsed % 2000 === 0) console.log(`[migrate-authors]   …${filesParsed} files`);
}
console.log(`[migrate-authors]   parsed ${filesParsed} files / ${articlesParsed} articles`);
console.log(`[migrate-authors]   backfill index size: ${backfill.size} docIds`);
console.log(`[migrate-authors]     with affiliation: ${withAff}`);
console.log(`[migrate-authors]     with bio        : ${withBio}`);

// ---- Pass 2: walk registry, migrate -------------------------------------

console.log('\n[migrate-authors] Pass 2: walking registry…');
const docs = loadAllDocs();

const counters = {
  totalDocs: docs.length,
  noAuthors: 0,
  alreadyObject: 0,
  toMigrate: 0,
  migrated: 0,
  shapeOnly: 0,
  enrichedFromHighwire: 0,
  countMismatchFallback: 0,
  affiliationsAdded: 0,
  biosAdded: 0,
  byPublisher: {},
};

const sampleBackfilled = [];
const sampleMismatch = [];

function migrateAuthors(doc) {
  const stringAuthors = doc.authors.map(a => typeof a === 'string' ? a : null);
  if (stringAuthors.some(a => a == null)) {
    // Mixed-form — defensive: should be 0 per the pre-flight audit. Skip.
    return null;
  }
  const back = backfill.get(doc.docId);
  if (back && back.length === stringAuthors.length) {
    // Counts match — enrich.
    const enriched = stringAuthors.map((name, i) => {
      const b = back[i];
      const out = { name };  // registry name wins (preserves manual corrections)
      if (b && b.affiliation) { out.affiliation = b.affiliation; counters.affiliationsAdded++; }
      if (b && b.bio) { out.bio = b.bio; counters.biosAdded++; }
      return out;
    });
    counters.enrichedFromHighwire++;
    if (sampleBackfilled.length < 5) sampleBackfilled.push({ docId: doc.docId, before: stringAuthors, after: enriched.map(e => `${e.name}${e.affiliation ? ` @ ${e.affiliation.slice(0, 40)}` : ''}`) });
    return enriched;
  }
  if (back && back.length !== stringAuthors.length) {
    // Count mismatch — don't risk wrong attribution. Shape-only.
    counters.countMismatchFallback++;
    if (sampleMismatch.length < 5) sampleMismatch.push({ docId: doc.docId, registryCount: stringAuthors.length, highwireCount: back.length });
  }
  counters.shapeOnly++;
  return stringAuthors.map(name => ({ name }));
}

const touched = [];
for (const doc of docs) {
  if (!Array.isArray(doc.authors) || doc.authors.length === 0) { counters.noAuthors++; continue; }
  const isObject = doc.authors.every(a => a && typeof a === 'object');
  if (isObject) { counters.alreadyObject++; continue; }

  const isString = doc.authors.every(a => typeof a === 'string');
  if (!isString) continue; // mixed or weird — skip defensively

  counters.toMigrate++;
  counters.byPublisher[doc.publisher || '_unknown'] = (counters.byPublisher[doc.publisher || '_unknown'] || 0) + 1;

  const newAuthors = migrateAuthors(doc);
  if (!newAuthors) continue;

  doc.authors = newAuthors;
  const existing = doc.authors$meta || {};
  doc.authors$meta = {
    ...existing,
    source: existing.source || 'parsed',
    confidence: 'high',
    note: 'Object form (schema 2.3.0) migrated from string form via migrateAuthorsToObjectForm.js' +
          (counters.enrichedFromHighwire && backfill.has(doc.docId) && backfill.get(doc.docId).length === doc.authors.length
            ? '; bio/affiliation backfilled from _source/SMPTE/HIGHWIRE/ NLM <contrib-group>+<aff>+<bio>'
            : ''),
    updated: NOW,
    version: 'authors-migrate-object-form@v1',
  };
  counters.migrated++;
  touched.push(doc);
}

console.log(`[migrate-authors]   total docs                 : ${counters.totalDocs}`);
console.log(`[migrate-authors]   no authors[]               : ${counters.noAuthors}`);
console.log(`[migrate-authors]   already object form (skip) : ${counters.alreadyObject}`);
console.log(`[migrate-authors]   to migrate                 : ${counters.toMigrate}`);
console.log(`[migrate-authors]     enriched from HIGHWIRE   : ${counters.enrichedFromHighwire}`);
console.log(`[migrate-authors]     shape-only               : ${counters.shapeOnly}`);
console.log(`[migrate-authors]     count-mismatch fallback  : ${counters.countMismatchFallback}`);
console.log(`[migrate-authors]   affiliations added         : ${counters.affiliationsAdded}`);
console.log(`[migrate-authors]   bios added                 : ${counters.biosAdded}`);

if (APPLY) {
  console.log(`\n[migrate-authors] APPLY: writing ${touched.length} docs…`);
  let n = 0;
  for (const doc of touched) {
    saveDoc(doc);
    n++;
    if (n % 1000 === 0) console.log(`[migrate-authors]   …${n}/${touched.length}`);
  }
  console.log(`[migrate-authors] APPLY complete (${n} docs written).`);
}

// ---- report -------------------------------------------------------------

const summary = {
  generatedAt: NOW,
  apply: APPLY,
  ...counters,
  sampleBackfilled,
  sampleMismatch,
  highwireIndex: {
    filesParsed,
    articlesParsed,
    docIdsIndexed: backfill.size,
    withAffiliation: withAff,
    withBio: withBio,
  },
};
fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2) + '\n', 'utf8');

const md = [
  '# Authors Migration (#1196) — string-form → object form\n',
  `> Generated at: ${NOW}`,
  `> Mode: **${APPLY ? 'APPLY' : 'dry-run'}**\n`,
  '## HIGHWIRE backfill index',
  `- XML files parsed: ${filesParsed}`,
  `- Articles indexed: ${articlesParsed}`,
  `- Distinct docIds  : ${backfill.size}`,
  `- With affiliation : ${withAff}`,
  `- With bio         : ${withBio}\n`,
  '## Migration scope',
  `- Total registry docs        : ${counters.totalDocs}`,
  `- Docs with no \`authors[]\`   : ${counters.noAuthors}`,
  `- Already object form (skip) : ${counters.alreadyObject}`,
  `- To migrate                 : **${counters.toMigrate}**\n`,
  '## Migration outcome',
  '| outcome | count |',
  '|---|---:|',
  `| enriched from HIGHWIRE (name + affiliation [+ bio]) | ${counters.enrichedFromHighwire} |`,
  `| shape-only (\`"X"\` → \`{name: "X"}\`) | ${counters.shapeOnly} |`,
  `| count-mismatch fallback (HIGHWIRE author count ≠ registry — shape-only for safety) | ${counters.countMismatchFallback} |`,
  '',
  `**Data added:** ${counters.affiliationsAdded} affiliations, ${counters.biosAdded} bios.`,
  '',
  '## By publisher (to-migrate)',
  '| publisher | count |',
  '|---|---:|',
  ...Object.entries(counters.byPublisher).sort(([, a], [, b]) => b - a).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Sample HIGHWIRE-enriched docs',
  ...sampleBackfilled.flatMap(s => [
    `\n**${s.docId}**`,
    'Before:',
    ...s.before.map(b => `- \`"${b}"\``),
    'After:',
    ...s.after.map(a => `- ${a}`),
  ]),
  '',
  '## Sample count-mismatch (shape-only fallback)',
  ...sampleMismatch.map(s => `- ${s.docId} — registry has ${s.registryCount} authors, HIGHWIRE has ${s.highwireCount}`),
  '',
].join('\n');
fs.writeFileSync(OUT_MD, md, 'utf8');

console.log(`\n[migrate-authors] reports: ${OUT_JSON}, ${OUT_MD}`);
if (!APPLY) console.log('[migrate-authors] re-run with --apply to write changes.\n');
