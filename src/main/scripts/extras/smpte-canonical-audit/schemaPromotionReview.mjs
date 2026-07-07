/*
 * schemaPromotionReview.mjs — decision-support for the deep source census.
 *
 * Consumes sourceFieldCensus.paths.json and, for every data-bearing
 * unmapped path, assigns a recommendation:
 *
 *   MAP      shape-variant of an existing schema field — add to the
 *            EXPLICIT_MAPPINGS table in sourceFieldCensus.mjs (and to
 *            whichever extractor is missing the variant)
 *   PROMOTE  new schema field worth adding
 *   SKIP     structural / formatting / boilerplate / SMPTE-internal-only
 *
 * The heuristics below encode "what would I recommend" per path.
 * Output is a review table you veto/edit before we apply any changes.
 *
 * Output:
 *   src/main/reports/smpte-canonical-audit/schemaPromotionReview.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const CENSUS = 'src/main/reports/smpte-canonical-audit/sourceFieldCensus.paths.json';
const OUT_MD = 'src/main/reports/smpte-canonical-audit/schemaPromotionReview.md';

const j = JSON.parse(fs.readFileSync(CENSUS, 'utf8'));
const data = j.paths.filter(p => p.bucket === 'unmapped' && p.samples.length > 0);

// ---- decision heuristics -----------------------------------------------
// Each entry: matcher on the last path segment (or full path), returning
// { verdict, mapsTo?, reason }. First match wins. Fall through → REVIEW.

const RULES = [
  // ==== SKIP: pure structural / formatting / boilerplate ====
  { match: p => /\/(italic|bold|sup|sub|underline|em|strong|p|break|xref|sc|graphic|fig|table|ext-link|list|list-item|inline-formula|disp-formula|mml:math)$/.test(p.path),
    verdict: 'SKIP', reason: 'inline formatting inside text' },
  { match: p => /^(publication|content_batch|article)$/i.test(p.path.split('/').pop()) && !p.path.includes('/'),
    verdict: 'SKIP', reason: 'root element' },
  { match: p => /\/(head|body|publicationinfo|articleinfo|volumeinfo|journal_metadata|journal_issue|conference_metadata|front|back|article-meta|journal-meta|title-group|contrib-group|permissions)$/.test(p.path),
    verdict: 'SKIP', reason: 'structural container' },
  { match: p => /\/depositor|\/timestamp|\/head\/timestamp/.test(p.path),
    verdict: 'SKIP', reason: 'SMPTE delivery metadata (not article data)' },
  { match: p => /\/filename(\/@|$)|self-uri/.test(p.path),
    verdict: 'SKIP', reason: 'attachment filename (PDFs live in _archive)' },
  { match: p => /\/authortype$/.test(p.path),
    verdict: 'SKIP', reason: 'boilerplate ("Author" always)' },
  { match: p => /(?:@contrib-type|@dtd-version|@lifecycle|@lang|@id|@rid|@ref-type|@corresp|@journal-id-type|@date-type|@pub-type|@publication-format|@author_type|@author_role|@author_order|@open-access|@iso-8601-date|@license-type|@specific-use|@acronymtype|@position|@orientation|@type|@datetype|@confdatetype|@keywordtype|@role|@currency)$/.test(p.path),
    verdict: 'SKIP-attr', reason: 'type-marker attribute (secondary metadata)' },
  { match: p => /\/(articleshowflag|articlenodoiflag|articlepeerreviewflag|articleplagiarizedflag|articlecoverimageflag|articlereferenceflag|doi_permission|reference_flag|articlequality|holdstatus)$/.test(p.path),
    verdict: 'SKIP', reason: 'SMPTE-internal editorial workflow flag' },
  { match: p => /(deposit|processing|delivery)/.test(p.path.toLowerCase().replace(/^content_batch/, '')) && !/publication|article|conference|issue|volume/i.test(p.path.split('/').pop()),
    verdict: 'SKIP', reason: 'delivery/batch process metadata' },

  // ==== MAP: shape variants of existing schema fields ====
  { match: p => /\/normtitle$/.test(p.path),
    verdict: 'MAP', mapsTo: 'journalTitle', reason: 'IDAMS variant of journal title (already in schema)' },
  { match: p => /\/normalized_title$/.test(p.path),
    verdict: 'MAP', mapsTo: 'journalTitle', reason: 'content_batch variant of journal title' },
  { match: p => /\/titleabbrev$/.test(p.path),
    verdict: 'MAP', mapsTo: 'journalAcronym', reason: 'IDAMS variant of journal acronym' },
  { match: p => /\/abbrev-journal-title$/.test(p.path),
    verdict: 'MAP', mapsTo: 'journalAcronym', reason: 'NLM variant of journal acronym' },
  { match: p => /\/journal-title$/.test(p.path),
    verdict: 'MAP', mapsTo: 'journalTitle', reason: 'NLM variant' },
  { match: p => /\/article-title$/.test(p.path),
    verdict: 'MAP', mapsTo: 'docTitle', reason: 'NLM variant of article title' },
  { match: p => /\/majortopic$/.test(p.path),
    verdict: 'MAP', mapsTo: 'topics', reason: 'IDAMS variant of major_topic' },
  { match: p => /\/articlejournaltopic$/.test(p.path),
    verdict: 'MAP', mapsTo: 'topics', reason: 'IDAMS journal-specific topic' },
  { match: p => /\/subject$/.test(p.path) && /subj-group/.test(p.path),
    verdict: 'MAP', mapsTo: 'topics', reason: 'NLM article-categories/subject' },
  { match: p => /\/index_terms\/term$/.test(p.path),
    verdict: 'MAP', mapsTo: 'keywords', reason: 'content_batch index terms' },
  { match: p => /\/keywordterm$/.test(p.path),
    verdict: 'MAP', mapsTo: 'keywords', reason: 'IDAMS keyword atom' },
  { match: p => /\/authorbio$/.test(p.path),
    verdict: 'MAP', mapsTo: 'authors[].bio', reason: 'IDAMS variant of author bio' },
  { match: p => /\/aff\/institution-wrap\/institution$/.test(p.path),
    verdict: 'MAP', mapsTo: 'authors[].affiliation', reason: 'NLM structured affiliation' },
  { match: p => /\/artpagenums\/@startpage$/.test(p.path),
    verdict: 'MAP', mapsTo: 'pages.first', reason: 'IDAMS start page' },
  { match: p => /\/artpagenums\/@endpage$/.test(p.path),
    verdict: 'MAP', mapsTo: 'pages.last', reason: 'IDAMS end page' },
  { match: p => /\/publicationinfo\/acronym$/.test(p.path),
    verdict: 'MAP', mapsTo: 'journalAcronym', reason: 'IDAMS publication acronym' },
  { match: p => /\/journal-title-group$/.test(p.path),
    verdict: 'SKIP', reason: 'container for journal-title (covered via child)' },
  { match: p => /\/normalized_journal_title$/.test(p.path),
    verdict: 'MAP', mapsTo: 'journalTitle', reason: 'content_batch normalized journal' },
  { match: p => /\/conference_metadata\/normalized_title$/.test(p.path),
    verdict: 'MAP', mapsTo: 'conferenceTitle', reason: 'content_batch conf title' },
  { match: p => /\/conference_metadata\/full_title$/.test(p.path),
    verdict: 'MAP', mapsTo: 'conferenceTitle', reason: 'content_batch conf title' },
  { match: p => /\/conftitle$/.test(p.path),
    verdict: 'MAP', mapsTo: 'conferenceTitle', reason: 'IDAMS conf title' },
  { match: p => /\/authorgroup\/author\/authororder$/.test(p.path),
    verdict: 'SKIP', reason: 'author order is implicit in array position' },

  // ==== PROMOTE: new schema fields — user-approved 2026-07-07 ====
  { match: p => /\/authorgroup\/author\/email$/.test(p.path) || /\/contrib\/email$/.test(p.path),
    verdict: 'PROMOTE', mapsTo: 'authors[].email', reason: 'author email (approved)' },
  { match: p => /\/authorgroup\/author\/orcid$/.test(p.path) || /\/contrib-id.*orcid/.test(p.path),
    verdict: 'PROMOTE', mapsTo: 'authors[].orcid', reason: 'author ORCID (approved)' },
  { match: p => /\/confgroup\/conflocation$/.test(p.path),
    verdict: 'PROMOTE', mapsTo: 'conferenceLocation', reason: 'geographic location of conference (approved)' },
  { match: p => /\/confgroup\/confdate$/.test(p.path),
    verdict: 'PROMOTE', mapsTo: 'conferenceDate (start/end)', reason: 'conference date range (approved)' },
  { match: p => /\/conference_metadata\/meeting_location$/.test(p.path),
    verdict: 'PROMOTE', mapsTo: 'conferenceLocation', reason: 'content_batch variant (approved)' },
  { match: p => /\/(issn|isbn)\/@mediatype$/.test(p.path) || /\/(issn|isbn)\/@publication-format$/.test(p.path),
    verdict: 'PROMOTE', mapsTo: 'issn/isbn.medium (Paper|Electronic)', reason: 'per-medium ISSN/ISBN distinction (approved)' },

  // ==== VETOED promotes — user decision 2026-07-07, keep as SKIP ====
  { match: p => /\/articlelicense$/.test(p.path) || /\/article_license_uri$/.test(p.path) || /\/permissions\/license\/license-p$/.test(p.path),
    verdict: 'SKIP', reason: 'license fields — vetoed 2026-07-07' },
  { match: p => /\/publicationinfo\/pubsourceid$/.test(p.path),
    verdict: 'SKIP', reason: 'external pub-source ID — vetoed 2026-07-07' },
  { match: p => /\/articlemancentralid$/.test(p.path),
    verdict: 'SKIP', reason: 'Manuscript Central ID — vetoed 2026-07-07' },
  { match: p => /\/keywordset\/@keywordtype$/.test(p.path),
    verdict: 'SKIP', reason: 'keyword-source tag — not promoted (attr-level detail)' },
  { match: p => /\/authorgroup\/author\/@role$/.test(p.path),
    verdict: 'SKIP', reason: 'author role attr — not promoted' },
  { match: p => /\/issue_complete_date$/.test(p.path),
    verdict: 'SKIP', reason: 'issue completion date — not promoted' },
];

// ---- classify all paths ------------------------------------------------
function decide(p) {
  for (const r of RULES) {
    if (r.match(p)) return { verdict: r.verdict, mapsTo: r.mapsTo || null, reason: r.reason };
  }
  return { verdict: 'REVIEW', mapsTo: null, reason: '(no heuristic — needs eyeballs)' };
}

const buckets = { MAP: [], PROMOTE: [], SKIP: [], 'SKIP-attr': [], REVIEW: [] };
for (const p of data) {
  const d = decide(p);
  buckets[d.verdict].push({ ...p, ...d });
}
// Sort by files desc within each bucket
for (const k of Object.keys(buckets)) buckets[k].sort((a, b) => b.files - a.files);

// Dedupe by mapsTo for PROMOTE + MAP to show cross-shape consolidation
function consolidate(rows) {
  const grouped = new Map();
  for (const r of rows) {
    const key = r.mapsTo || r.path;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(r);
  }
  return grouped;
}

// ---- MD report ---------------------------------------------------------
const md = [];
md.push('# Schema promotion review — data-bearing unmapped paths');
md.push('');
md.push(`> Generated: ${new Date().toISOString()}`);
md.push(`> Input: sourceFieldCensus.paths.json`);
md.push(`> Data-bearing unmapped paths: **${data.length}**`);
md.push('');
md.push('| verdict | paths | shape variants dedupe |');
md.push('|---|---:|---:|');
md.push(`| 🎯 PROMOTE (new schema field) | ${buckets.PROMOTE.length} | ${new Set(buckets.PROMOTE.map(r => r.mapsTo)).size} distinct |`);
md.push(`| ✅ MAP (variant of existing schema field) | ${buckets.MAP.length} | ${new Set(buckets.MAP.map(r => r.mapsTo)).size} distinct |`);
md.push(`| 🗑️ SKIP | ${buckets.SKIP.length} + ${buckets['SKIP-attr'].length} attrs | — |`);
md.push(`| ❓ REVIEW (no heuristic) | ${buckets.REVIEW.length} | — |`);
md.push('');

// PROMOTE section — consolidate by target field
md.push('## 🎯 PROMOTE — new schema fields (consolidated)');
md.push('');
md.push('| target field | example path | files | sample values |');
md.push('|---|---|---:|---|');
{
  const cons = consolidate(buckets.PROMOTE);
  const consArr = [...cons.entries()].sort((a, b) => Math.max(...b[1].map(r => r.files)) - Math.max(...a[1].map(r => r.files)));
  for (const [target, rows] of consArr) {
    const maxFiles = Math.max(...rows.map(r => r.files));
    const sample = rows[0].samples.slice(0, 3).map(s => '`' + s.slice(0, 40).replace(/`/g, '\\`').replace(/\|/g, '\\|') + '`').join(' · ');
    const paths = rows.map(r => `\`${r.path}\` (${r.files})`).join('<br>');
    md.push(`| **${target}** | ${paths} | ${maxFiles} | ${sample} |`);
  }
}
md.push('');

// MAP section — consolidate
md.push('## ✅ MAP — extractor-variant of existing schema field');
md.push('');
md.push('| target field (existing) | source paths (all shape variants) | max-files | reason |');
md.push('|---|---|---:|---|');
{
  const cons = consolidate(buckets.MAP);
  const consArr = [...cons.entries()].sort((a, b) => Math.max(...b[1].map(r => r.files)) - Math.max(...a[1].map(r => r.files)));
  for (const [target, rows] of consArr) {
    const maxFiles = Math.max(...rows.map(r => r.files));
    const paths = rows.map(r => `\`${r.path}\``).join('<br>');
    const reason = rows[0].reason;
    md.push(`| \`${target}\` | ${paths} | ${maxFiles} | ${reason} |`);
  }
}
md.push('');

// REVIEW section — the unheuristiced ones
md.push('## ❓ REVIEW — no heuristic; needs your eyeballs');
md.push('');
md.push('_(top 60 by file coverage)_');
md.push('');
md.push('| shape | path | files | samples |');
md.push('|---|---|---:|---|');
for (const r of buckets.REVIEW.slice(0, 60)) {
  const smp = r.samples.slice(0, 3).map(s => '`' + s.slice(0, 40).replace(/`/g, '\\`').replace(/\|/g, '\\|') + '`').join(' · ');
  md.push(`| \`${r.shape}\` | \`${r.path}\` | ${r.files} | ${smp} |`);
}
if (buckets.REVIEW.length > 60) md.push(`\n_… ${buckets.REVIEW.length - 60} more (see JSON)_`);
md.push('');

// SKIP: summarize only
md.push('## 🗑️ SKIP — filed for the record');
md.push('');
md.push(`- ${buckets.SKIP.length} structural / boilerplate / delivery-metadata / editorial-workflow paths`);
md.push(`- ${buckets['SKIP-attr'].length} type-marker attributes`);
md.push('');
md.push('Full list in `sourceFieldCensus.paths.json` — filter by `bucket: "unmapped"` and cross-check against your reader.');
md.push('');

fs.writeFileSync(OUT_MD, md.join('\n') + '\n');
console.log(`wrote ${OUT_MD}`);
console.log(`PROMOTE: ${buckets.PROMOTE.length} paths → ${new Set(buckets.PROMOTE.map(r=>r.mapsTo)).size} distinct targets`);
console.log(`MAP:     ${buckets.MAP.length} paths → ${new Set(buckets.MAP.map(r=>r.mapsTo)).size} distinct targets`);
console.log(`SKIP:    ${buckets.SKIP.length + buckets['SKIP-attr'].length}`);
console.log(`REVIEW:  ${buckets.REVIEW.length}`);
