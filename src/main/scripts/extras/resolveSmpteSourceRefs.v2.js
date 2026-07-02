/*
 * resolveSmpteSourceRefs.v2.js — Phase 1a resolver pass.
 *
 * PR #1111 extracted Standards-doc references from `_source/SMPTE/*-ref.xml`
 * sidecars, resolved what it could (~1,326 refs), and dropped the rest as
 * "unresolved" into `src/main/reports/smpteSourceRefs.unresolved.json` (961
 * entries). Those refs were never cited from the source doc's `references[]`
 * — silent data loss. 602 of the 961 are from Standards-family source docs.
 *
 * This pass re-tries each Standards-source unresolved entry through:
 *   1. vol+pages SMPTE-self-cite (against the now-ingested journal corpus)
 *   2. parseRefId(<standardnum>, <online-cite> URL)
 *   3. mapRefByCite(cite | title)
 *   4. exact title match against the registry (the conservative v1 path)
 *   5. fall-through: mint an orphan slug via mriRecordSighting
 *
 * Under MRI v2, even the slug-fallback yields a useful outcome: the slug
 * lands in the source doc's `references[]`, MRI carries the raw XML for
 * future graduation, and the doc page renders the ref inline as
 * `<cite>citation text</cite>` with an EXTERNAL badge instead of silently
 * dropping it.
 *
 *   node src/main/scripts/extras/resolveSmpteSourceRefs.v2.js [--apply]
 *
 * Dry-run by default. With `--apply`:
 *   - touched source docs get re-written via saveDoc() (per-doc shards)
 *   - MRI flushed
 *   - resolved entries dropped from smpteSourceRefs.unresolved.json
 *   - per-entry result report written to
 *     src/main/reports/smpteSourceRefs.v2.{json,md}
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT); // MRI path resolves relative to cwd

const { loadAllDocs, saveDoc } = require('../../lib/registry');
const {
  parseRefId,
  mapRefByCite,
  reloadRefMap,
  mriRecordSighting,
  mriFlush,
  mriEnsureFile,
} = require('../../lib/referencing');

reloadRefMap();
mriEnsureFile();

const UNRESOLVED_PATH = path.join(REPO_ROOT, 'src/main/reports/smpteSourceRefs.unresolved.json');
const OUT_JSON = path.join(REPO_ROOT, 'src/main/reports/smpteSourceRefs.v2.json');
const OUT_MD = path.join(REPO_ROOT, 'src/main/reports/smpteSourceRefs.v2.md');

const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();

const STANDARDS_TYPES = new Set([
  'Standard',
  'Engineering Guideline',
  'Recommended Practice',
  'Registered Disclosure Document',
  'Specification',
  'Technical Specification',
  'Administrative Guideline',
]);

// ---- load registry + build indices --------------------------------------

console.log('[phase-1a] loading registry…');
const docs = loadAllDocs();
const docById = new Map(docs.map((d) => [d.docId, d]));
const docIds = new Set(docs.map((d) => d.docId));
console.log(`[phase-1a]   ${docs.length} docs loaded`);

// vol+pages → 10.5594-J* docId(s) for the SMPTE journal corpus.
// Multi-hit keys map to ambiguity; we only auto-resolve unambiguous hits.
const volPagesIdx = new Map();
for (const d of docs) {
  if (!/^10\.5594-[jJ]\d+/.test(d.docId || '')) continue;
  if (!d.volume || !d.pages) continue;
  const firstPage = String(d.pages).split(/[-–—]/)[0].trim();
  const key = `${String(d.volume).trim()}|${firstPage}`;
  if (!volPagesIdx.has(key)) volPagesIdx.set(key, []);
  volPagesIdx.get(key).push(d.docId);
}
console.log(`[phase-1a]   vol+pages index: ${volPagesIdx.size} entries (SMPTE journal corpus)`);

// Normalised docTitle → [docId, …] for title-fallback (conservative v1 path).
function normTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’“”'"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
const titleIdx = new Map();
for (const d of docs) {
  const t = normTitle(d.docTitle);
  if (!t) continue;
  if (!titleIdx.has(t)) titleIdx.set(t, []);
  titleIdx.get(t).push(d.docId);
}

// ---- load unresolved report ---------------------------------------------

const unresolvedReport = JSON.parse(fs.readFileSync(UNRESOLVED_PATH, 'utf8'));
const allEntries = Array.isArray(unresolvedReport.unresolved) ? unresolvedReport.unresolved : [];
const scope = allEntries.filter((r) => {
  const src = docById.get(r.docId);
  return src && STANDARDS_TYPES.has(src.docType);
});
console.log(`[phase-1a]   ${allEntries.length} total unresolved → ${scope.length} from Standards-family sources (scope)`);

// ---- resolution chain ---------------------------------------------------

function extractField(rawRef, tag) {
  const m = String(rawRef || '').match(new RegExp(`<${tag}\\b[^>]*>([^<]+)</${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function isSmpteJournalPub(pubTitle) {
  return /SMP[TE]|Soc.*Mot|Trans.*Mot/i.test(String(pubTitle || ''));
}

/**
 * tryResolve(entry) — returns one of:
 *   { kind: 'canonical', refId, source }     — caller cites refId
 *   { kind: 'slug-mint',  source }            — caller routes to mriRecordSighting
 *   { kind: 'ambiguous', candidates, source }— caller routes to slug-mint (we don't guess)
 */
function tryResolve(entry) {
  const raw = entry.rawRef || '';
  const cite = entry.cite || '';
  const title = entry.title || '';
  const standardnum = extractField(raw, 'standardnum');
  const onlineCite = extractField(raw, 'online-cite');
  const pubTitle = extractField(raw, 'ref_pubtitle');
  const volume = extractField(raw, 'volume');
  const startPage = extractField(raw, 'startpage');

  // (1) vol+pages SMPTE-self-cite — only for refs whose pub-title looks like
  // a SMPTE journal title and which carry both <volume> and <startpage>.
  if (volume && startPage && isSmpteJournalPub(pubTitle)) {
    const key = `${volume.trim()}|${startPage.trim()}`;
    const hits = volPagesIdx.get(key);
    if (hits && hits.length === 1) return { kind: 'canonical', refId: hits[0], source: 'vol+pages' };
    if (hits && hits.length > 1) return { kind: 'ambiguous', candidates: hits, source: 'vol+pages-ambig' };
  }

  // (2) parseRefId(<standardnum>, <online-cite>) — accept iff a refId comes
  // back at all. Even refIds not in the registry are useful under MRI v2 —
  // they become canonical-form `mri-known-no-doc` entries the next time a
  // matching publisher doc gets ingested.
  if (standardnum) {
    const refId = parseRefId(decodeEntities(standardnum), onlineCite || '');
    if (refId) return { kind: 'canonical', refId, source: 'parseRefId:standardnum' };
  }

  // (3) parseRefId on the cite string itself (no standardnum, but maybe a
  // recognisable form like "ISO/IEC 15938-3:2002" embedded in the cite).
  if (cite) {
    const refId = parseRefId(decodeEntities(cite), onlineCite || '');
    if (refId) return { kind: 'canonical', refId, source: 'parseRefId:cite' };
  }

  // (4) mapRefByCite — explicit cite-string entries in refMap.json.
  if (title) {
    const mapped = mapRefByCite(decodeEntities(title));
    if (mapped) return { kind: 'canonical', refId: mapped, source: 'mapRefByCite' };
  }

  // (5) Conservative title-match against the registry (the v1 path).
  // Only accept 1:1 matches AND don't allow self-references.
  if (title) {
    const t = normTitle(title);
    if (t) {
      const hits = titleIdx.get(t);
      if (hits && hits.length === 1 && hits[0] !== entry.docId) {
        return { kind: 'canonical', refId: hits[0], source: 'title-exact-match' };
      }
    }
  }

  // (6) Fall-through: slug-mint via mriRecordSighting.
  return { kind: 'slug-mint', source: 'orphan-slug' };
}

// ---- main loop ----------------------------------------------------------

const counters = {
  total: scope.length,
  bySource: {},
  byKind: { canonical: 0, 'slug-mint': 0, ambiguous: 0 },
  inRegistry: 0,             // canonical refId that IS a registry docId (direct doc-link)
  knownPublisherNoDoc: 0,    // canonical refId NOT a registry docId (MRI carries the slug)
  resolvedEntries: [],        // for the v1-style report
  slugMinted: [],             // for the v2 report
  ambiguousEntries: [],
};

const touchedDocs = new Map(); // docId → doc object (modified in-place)
const orphanSlugApplyQueue = []; // [{ docId, slug, type }]

for (const entry of scope) {
  const result = tryResolve(entry);
  counters.byKind[result.kind] += 1;
  counters.bySource[result.source] = (counters.bySource[result.source] || 0) + 1;

  if (result.kind === 'canonical') {
    const inRegistry = docIds.has(result.refId);
    if (inRegistry) counters.inRegistry += 1; else counters.knownPublisherNoDoc += 1;
    counters.resolvedEntries.push({
      sourceDocId: entry.docId,
      refXmlId: entry.refXmlId,
      type: entry.type,
      refId: result.refId,
      via: result.source,
      inRegistry,
      cite: entry.cite,
    });

    // Stage: cite the refId in source doc and record an MRI sighting.
    const src = touchedDocs.get(entry.docId) || docById.get(entry.docId);
    if (!src) continue;
    touchedDocs.set(entry.docId, src);
    addRefToDoc(src, entry.type, result.refId, result.source);
    if (APPLY) {
      try {
        mriRecordSighting({
          docId: entry.docId,
          type: entry.type,
          refId: result.refId,
          cite: entry.cite,
          href: '',
          rawRef: entry.rawRef,
          title: entry.title,
          mapSource: 'phase-1a-resolve',
          mapDetail: result.source,
        });
      } catch (e) {
        console.warn(`[phase-1a] mriRecordSighting failed for ${entry.docId}/${result.refId}: ${e.message}`);
      }
    }
    continue;
  }

  // ambiguous OR slug-mint → both route to slug-mint (we never guess in ambiguous).
  if (result.kind === 'ambiguous') counters.ambiguousEntries.push({ sourceDocId: entry.docId, candidates: result.candidates, cite: entry.cite });

  if (APPLY) {
    try {
      const mintResult = mriRecordSighting({
        docId: entry.docId,
        type: entry.type,
        // omit refId → orphan mint path
        cite: entry.cite,
        href: '',
        rawRef: entry.rawRef,
        title: entry.title,
        mapSource: 'phase-1a-resolve',
        mapDetail: result.source === 'vol+pages-ambig' ? 'vol+pages-ambiguous→slug' : 'no-resolution→slug',
      });
      const slug = mintResult && mintResult.mintedSlug;
      if (slug) {
        counters.slugMinted.push({ sourceDocId: entry.docId, refXmlId: entry.refXmlId, type: entry.type, slug, cite: entry.cite });
        orphanSlugApplyQueue.push({ docId: entry.docId, slug, type: entry.type });
      }
    } catch (e) {
      console.warn(`[phase-1a] slug-mint failed for ${entry.docId}/${entry.refXmlId}: ${e.message}`);
    }
  } else {
    // Dry-run — record what would have minted so the report is informative.
    counters.slugMinted.push({ sourceDocId: entry.docId, refXmlId: entry.refXmlId, type: entry.type, slug: '(would mint)', cite: entry.cite });
  }
}

function addRefToDoc(doc, type, refId, viaSource) {
  doc.references = doc.references || {};
  const bucket = type === 'normative' ? 'normative' : 'bibliographic';
  doc.references[bucket] = doc.references[bucket] || [];
  if (doc.references[bucket].includes(refId)) return false;
  doc.references[bucket].push(refId);
  const metaKey = `${bucket}$meta`;
  doc.references[metaKey] = {
    source: 'parsed',
    confidence: 'medium',
    note: `Resolved from sibling -ref.xml via resolveSmpteSourceRefs.v2.js (${viaSource})`,
    updated: NOW,
  };
  return true;
}

// ---- apply phase --------------------------------------------------------

if (APPLY) {
  // Apply minted slugs to source docs' references[] (mirrors extractDocs.js).
  for (const { docId, slug, type } of orphanSlugApplyQueue) {
    const src = touchedDocs.get(docId) || docById.get(docId);
    if (!src) continue;
    touchedDocs.set(docId, src);
    addRefToDoc(src, type, slug, 'orphan-slug-mint');
  }

  console.log(`[phase-1a] writing ${touchedDocs.size} source docs…`);
  for (const doc of touchedDocs.values()) {
    saveDoc(doc);
  }
  console.log('[phase-1a] flushing MRI…');
  mriFlush({ force: true });

  // Drop resolved + minted entries from unresolved.json — they no longer
  // belong there (canonical resolutions are in registry; slugs are in MRI).
  const handledKeys = new Set();
  for (const r of counters.resolvedEntries) handledKeys.add(`${r.sourceDocId}|${r.refXmlId}`);
  for (const r of counters.slugMinted) handledKeys.add(`${r.sourceDocId}|${r.refXmlId}`);
  const remaining = allEntries.filter((e) => !handledKeys.has(`${e.docId}|${e.refXmlId}`));
  unresolvedReport.unresolved = remaining;
  unresolvedReport.total = remaining.length;
  unresolvedReport.generatedAt = NOW;
  unresolvedReport.note = unresolvedReport.note +
    `\nPhase 1a (resolveSmpteSourceRefs.v2.js) consumed ${counters.total - remaining.length} entries from this report on ${NOW}.`;
  fs.writeFileSync(UNRESOLVED_PATH, JSON.stringify(unresolvedReport, null, 2) + '\n', 'utf8');
  console.log(`[phase-1a] updated ${path.relative(REPO_ROOT, UNRESOLVED_PATH)} — ${remaining.length} entries remain`);
}

// ---- reports ------------------------------------------------------------

const summary = {
  generatedAt: NOW,
  apply: APPLY,
  totals: {
    standardsScope: counters.total,
    canonical: counters.byKind.canonical,
    canonicalInRegistry: counters.inRegistry,
    canonicalKnownPubNoDoc: counters.knownPublisherNoDoc,
    slugMinted: counters.byKind['slug-mint'] + counters.byKind.ambiguous,
    ambiguous: counters.byKind.ambiguous,
  },
  bySource: counters.bySource,
  resolvedEntries: counters.resolvedEntries,
  slugMinted: counters.slugMinted,
  ambiguousEntries: counters.ambiguousEntries,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2) + '\n', 'utf8');

const md = [
  '# Phase 1a — Standards source-refs resolution\n',
  `> Generated at: ${NOW}`,
  `> Mode: **${APPLY ? 'APPLY' : 'dry-run'}**\n`,
  '## Scope',
  `- Standards-family source-doc unresolved refs (filtered from PR #1111's 961 leftover): **${counters.total}**\n`,
  '## Outcome',
  '| outcome | count |',
  '|---|---:|',
  `| canonical refId → registry doc (direct link) | ${counters.inRegistry} |`,
  `| canonical refId → \`mri-known-no-doc\` (MRI carries slug) | ${counters.knownPublisherNoDoc} |`,
  `| slug-minted (orphan; MRI carries cite + raw XML) | ${counters.byKind['slug-mint']} |`,
  `| ambiguous vol+pages → slug-minted | ${counters.byKind.ambiguous} |`,
  '',
  '## By resolution path',
  '| path | count |',
  '|---|---:|',
  ...Object.entries(counters.bySource).sort(([, a], [, b]) => b - a).map(([k, v]) => `| \`${k}\` | ${v} |`),
  '',
  '## Notes',
  '- Under MRI v2, slug-minted refs are NOT silent. Each lands in `doc.references[]` and renders inline as `<cite>citation text</cite>` with an `EXTERNAL` badge.',
  '- Slugs can graduate to canonical refIds later via `resolveOrphans` once a new parser family or refMap entry covers them.',
  '- The `mri-known-no-doc` bucket is the target population for the auto-issue workflow + future external-publisher ingest (#1195).',
  '',
  'Full per-entry detail in `smpteSourceRefs.v2.json`.\n',
].join('\n');
fs.writeFileSync(OUT_MD, md, 'utf8');

console.log(`\n[phase-1a] ${APPLY ? 'APPLIED' : 'DRY-RUN'} summary:`);
console.log(`  scope (Standards-source unresolved) : ${counters.total}`);
console.log(`  canonical → in registry             : ${counters.inRegistry}`);
console.log(`  canonical → known-pub-no-doc        : ${counters.knownPublisherNoDoc}`);
console.log(`  slug-minted                         : ${counters.byKind['slug-mint'] + counters.byKind.ambiguous}`);
console.log(`  reports                             : ${path.relative(REPO_ROOT, OUT_JSON)}, ${path.relative(REPO_ROOT, OUT_MD)}`);
if (!APPLY) console.log('\n  re-run with --apply to write changes.\n');
