/*
 * extractSmpteJournalRefs.js — Phase 3a.
 *
 * Journal Article docs (and, when --include-conference is set, Conference
 * Paper docs) currently have empty `references[]` — greenfield. The NLM
 * XMLs in `_source/SMPTE/HIGHWIRE/` carry per-article `<back><ref-list><ref>`
 * blocks with structured citations. This pass walks those XMLs, matches
 * each to a registry doc by DOI, and for each `<ref>` runs a resolution
 * chain against the current corpus + MRI:
 *
 *   1. Direct DOI match — `<pub-id pub-id-type="doi">` in the cite
 *   2. vol+pages SMPTE-self-cite — Journal → Journal via the ~18k journal
 *      corpus, keyed on (volume, first_page)
 *   3. parseRefId — against article-title + source (journal name) hints
 *   4. mapRefByCite — refMap.json canonical-form entries
 *   5. Fallback → MRI v2 orphan-slug mint via mriRecordSighting
 *
 * The 345 Journal-Article-sourced + 14 Conference-Paper-sourced entries
 * left in `smpteSourceRefs.unresolved.json` by Phase 1a (which explicitly
 * filtered to Standards-family sources) are ALSO processed here — same
 * resolution chain, so those refs finally get slug-cited from their source
 * docs instead of staying orphaned in a report.
 *
 * Under MRI v2, every ref lands somewhere — canonical refIds go straight
 * into `doc.references.bibliographic[]`, orphan slugs get cited from the
 * source doc's references[] with the raw <ref> XML + citation text
 * preserved in MRI for future graduation via `resolveOrphans`.
 *
 * Reports:
 *   src/main/reports/smpteJournalRefs.{json,md}
 *
 * Usage:
 *   node src/main/scripts/extras/extractSmpteJournalRefs.js               # dry-run
 *   node src/main/scripts/extras/extractSmpteJournalRefs.js --apply       # write
 *   node src/main/scripts/extras/extractSmpteJournalRefs.js --limit 100   # cap to N source docs
 *   node src/main/scripts/extras/extractSmpteJournalRefs.js --include-conference  # also Phase 3b
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs, saveDoc } = require('../../lib/registry');
const {
  parseRefId,
  mapRefByCite,
  reloadRefMap,
  mriRecordSighting,
  mriFlush,
  mriEnsureFile,
} = require('../../lib/referencing');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const APPLY = process.argv.includes('--apply');
const INCLUDE_CONFERENCE = process.argv.includes('--include-conference');
const LIMIT = (() => {
  const idx = process.argv.indexOf('--limit');
  if (idx < 0) return 0;
  const n = parseInt(process.argv[idx + 1] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
})();

const NOW = new Date().toISOString();
const HIGHWIRE_ROOT = '_source/SMPTE/HIGHWIRE';
const UNRESOLVED_PATH = 'src/main/reports/smpteSourceRefs.unresolved.json';
const OUT_JSON = 'src/main/reports/smpteJournalRefs.json';
const OUT_MD = 'src/main/reports/smpteJournalRefs.md';

const SCOPE_TYPES = new Set(
  INCLUDE_CONFERENCE
    ? ['Journal Article', 'Conference Paper']
    : ['Journal Article']
);

reloadRefMap();
mriEnsureFile();

// ---- registry + indices --------------------------------------------------

console.log('[phase-3a] loading registry…');
const docs = loadAllDocs();
const docById = new Map(docs.map((d) => [d.docId, d]));
const docIds = new Set(docs.map((d) => d.docId));

const scopeDocs = docs.filter((d) => SCOPE_TYPES.has(d.docType));
console.log(`[phase-3a]   scope: ${scopeDocs.length} ${INCLUDE_CONFERENCE ? 'Journal + Conference' : 'Journal Article'} docs`);

// vol+pages → SMPTE journal docId(s), for self-cite lookup
const volPagesIdx = new Map();
for (const d of docs) {
  if (!/^10\.5594-[jJmM]\d+/.test(d.docId || '')) continue; // include Manuscripts (M-prefix conference) as targets too
  if (!d.volume || !d.pages) continue;
  const firstPage = String(d.pages).split(/[-–—]/)[0].trim();
  const key = `${String(d.volume).trim()}|${firstPage}`;
  if (!volPagesIdx.has(key)) volPagesIdx.set(key, []);
  volPagesIdx.get(key).push(d.docId);
}
console.log(`[phase-3a]   vol+pages index: ${volPagesIdx.size} entries`);

// ---- XML walker ---------------------------------------------------------

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
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

function stripInline(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function doiToDocId(doi) {
  return String(doi).replace(/\//g, '-');
}

function extractField(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? stripInline(m[1]) : '';
}

function extractPubIdDoi(block) {
  const m = block.match(/<pub-id[^>]*pub-id-type=["']doi["'][^>]*>([^<]+)<\/pub-id>/i);
  return m ? m[1].trim() : '';
}

function isSmpteJournalSource(sourceText) {
  // NLM `<source>` for SMPTE journals is often just "Journal" (the abbreviation
  // for J. SMPTE / SMPTE J. within the SMPTE corpus). Also match explicit forms.
  const s = String(sourceText || '').toLowerCase();
  return /^journal$/.test(s.trim()) || /smp[te]|soc.*mot|trans.*mot/.test(s);
}

// ---- resolution chain ----------------------------------------------------

/**
 * tryResolve(refBlock) — returns
 *   { kind: 'canonical', refId, source }  — cite refId in source doc
 *   { kind: 'slug-mint', source }         — mint MRI orphan slug
 */
function tryResolve(refBlock) {
  // (1) direct DOI match
  const doi = extractPubIdDoi(refBlock);
  if (doi) {
    const docIdForm = doiToDocId(doi);
    if (docIds.has(docIdForm)) return { kind: 'canonical', refId: docIdForm, source: 'direct-doi' };
    if (docIds.has(doi))       return { kind: 'canonical', refId: doi,       source: 'direct-doi' };
  }

  const source = extractField(refBlock, 'source');
  const volume = extractField(refBlock, 'volume');
  const fpage  = extractField(refBlock, 'fpage');
  const title  = extractField(refBlock, 'article-title') || extractField(refBlock, 'chapter-title') || extractField(refBlock, 'source');

  // (2) vol+pages SMPTE-self-cite
  if (volume && fpage && isSmpteJournalSource(source)) {
    const key = `${volume.trim()}|${fpage.trim()}`;
    const hits = volPagesIdx.get(key);
    if (hits && hits.length === 1) return { kind: 'canonical', refId: hits[0], source: 'vol+pages' };
    if (hits && hits.length > 1)   return { kind: 'ambiguous', candidates: hits, source: 'vol+pages-ambig' };
  }

  // (3) parseRefId on title (may catch canonical-form external cites)
  if (title) {
    const rid = parseRefId(title, '');
    if (rid) return { kind: 'canonical', refId: rid, source: 'parseRefId:title' };
  }

  // (4) mapRefByCite on title
  if (title) {
    const rid = mapRefByCite(title);
    if (rid) return { kind: 'canonical', refId: rid, source: 'mapRefByCite' };
  }

  // (5) fall-through → slug-mint
  return { kind: 'slug-mint', source: 'orphan-slug' };
}

// ---- extraction pass -----------------------------------------------------

console.log('\n[phase-3a] Pass 1: walking HIGHWIRE XMLs…');
const xmlFiles = walkXmlFiles(HIGHWIRE_ROOT);
console.log(`[phase-3a]   ${xmlFiles.length} XML files`);

const counters = {
  filesParsed: 0,
  articlesMatched: 0,
  articlesWithRefs: 0,
  totalRefs: 0,
  bySource: {},
  byKind: { canonical: 0, 'slug-mint': 0, ambiguous: 0 },
  inRegistry: 0,
  knownPubNoDoc: 0,
  touchedDocs: new Set(),
};

const orphanQueue = []; // [{ docId, slug, type: 'bibliographic' }]
const canonicalQueue = []; // [{ docId, refId, type }]
const touchedDocSet = new Map(); // docId → doc obj

function extractRefsFromArticle(articleXml, sourceDocId) {
  // <ref-list> is inside <back>
  const refList = articleXml.match(/<ref-list\b[\s\S]*?<\/ref-list>/);
  if (!refList) return [];
  const refs = refList[0].match(/<ref\b[^>]*id=[^>]*>[\s\S]*?<\/ref>/g) || [];
  return refs.map((r) => {
    const idMatch = r.match(/<ref\b[^>]*id=["']([^"']+)["']/);
    const refXmlId = idMatch ? idMatch[1] : '';
    const cite = stripInline(r.replace(/<ref\b[^>]*>|<\/ref>/g, ''));
    const title = extractField(r, 'article-title') || extractField(r, 'chapter-title') || extractField(r, 'source');
    return { rawRef: r, refXmlId, cite, title };
  });
}

for (const f of xmlFiles) {
  if (LIMIT && counters.articlesMatched >= LIMIT) break;
  let xml; try { xml = fs.readFileSync(f, 'utf8'); } catch { continue; }
  counters.filesParsed++;

  // Split multi-article files (rare but possible) — process each <article>
  const articleBlocks = xml.match(/<article\b[\s\S]*?<\/article>/g) || [xml]; // fall back to full file
  for (const artXml of articleBlocks) {
    if (LIMIT && counters.articlesMatched >= LIMIT) break;

    const doi = (artXml.match(/<article-id[^>]*pub-id-type=["']doi["'][^>]*>([^<]+)<\/article-id>/i) || [])[1];
    if (!doi) continue;
    const sourceDocId = doiToDocId(doi.trim());
    const sourceDoc = docById.get(sourceDocId);
    if (!sourceDoc || !SCOPE_TYPES.has(sourceDoc.docType)) continue;
    counters.articlesMatched++;

    const refs = extractRefsFromArticle(artXml, sourceDocId);
    if (!refs.length) continue;
    counters.articlesWithRefs++;

    // Ensure doc.references shape
    const doc = touchedDocSet.get(sourceDocId) || sourceDoc;
    touchedDocSet.set(sourceDocId, doc);

    for (const r of refs) {
      counters.totalRefs++;
      const result = tryResolve(r.rawRef);
      counters.byKind[result.kind] = (counters.byKind[result.kind] || 0) + 1;
      counters.bySource[result.source] = (counters.bySource[result.source] || 0) + 1;

      if (result.kind === 'canonical') {
        const inReg = docIds.has(result.refId);
        if (inReg) counters.inRegistry++;
        else counters.knownPubNoDoc++;
        canonicalQueue.push({
          docId: sourceDocId,
          refId: result.refId,
          type: 'bibliographic',
          via: result.source,
          rawRef: r.rawRef,
          cite: r.cite,
          title: r.title,
        });
        counters.touchedDocs.add(sourceDocId);
        continue;
      }

      // slug-mint (including ambiguous fallback) — in dry-run we only tally;
      // on --apply we call mriRecordSighting to mint and queue the slug.
      if (APPLY) {
        try {
          const mint = mriRecordSighting({
            docId: sourceDocId,
            type: 'bibliographic',
            cite: r.cite,
            href: '',
            rawRef: r.rawRef,
            title: r.title || '',
            mapSource: 'phase-3a-extract',
            mapDetail: result.source,
          });
          const slug = mint && mint.mintedSlug;
          if (slug) orphanQueue.push({ docId: sourceDocId, slug, type: 'bibliographic', via: result.source, cite: r.cite });
        } catch (e) {
          console.warn(`[phase-3a] slug-mint failed for ${sourceDocId}/${r.refXmlId}: ${e.message}`);
        }
      } else {
        orphanQueue.push({ docId: sourceDocId, slug: '(would mint)', type: 'bibliographic', via: result.source, cite: r.cite });
      }
      counters.touchedDocs.add(sourceDocId);
    }

    if (counters.filesParsed % 2000 === 0) console.log(`[phase-3a]   …${counters.filesParsed} files, ${counters.articlesMatched} matched`);
  }
}
console.log(`[phase-3a]   done: ${counters.filesParsed} files parsed, ${counters.articlesMatched} articles matched, ${counters.totalRefs} refs`);

// ---- Pass 2: fold in the Phase 1a leftover unresolved (Journal/Conf sources) ---

console.log('\n[phase-3a] Pass 2: leftover from smpteSourceRefs.unresolved.json…');
let leftoverProcessed = 0;
const leftoverKeys = new Set();
if (fs.existsSync(UNRESOLVED_PATH)) {
  const rep = JSON.parse(fs.readFileSync(UNRESOLVED_PATH, 'utf8'));
  const entries = Array.isArray(rep.unresolved) ? rep.unresolved : [];
  const leftoverScope = entries.filter((e) => {
    const src = docById.get(e.docId);
    return src && SCOPE_TYPES.has(src.docType);
  });
  console.log(`[phase-3a]   ${leftoverScope.length} entries in scope from leftover report`);
  for (const e of leftoverScope) {
    if (LIMIT && leftoverProcessed >= LIMIT) break;
    counters.totalRefs++;
    const result = tryResolve(e.rawRef || '');
    counters.byKind[result.kind] = (counters.byKind[result.kind] || 0) + 1;
    counters.bySource[result.source] = (counters.bySource[result.source] || 0) + 1;

    if (result.kind === 'canonical') {
      const inReg = docIds.has(result.refId);
      if (inReg) counters.inRegistry++;
      else counters.knownPubNoDoc++;
      canonicalQueue.push({
        docId: e.docId,
        refId: result.refId,
        type: e.type || 'bibliographic',
        via: result.source,
        rawRef: e.rawRef || '',
        cite: e.cite || '',
        title: e.title || '',
      });
    } else if (APPLY) {
      try {
        const mint = mriRecordSighting({
          docId: e.docId,
          type: e.type || 'bibliographic',
          cite: e.cite || '',
          href: '',
          rawRef: e.rawRef || '',
          title: e.title || '',
          mapSource: 'phase-3a-extract',
          mapDetail: `leftover:${result.source}`,
        });
        const slug = mint && mint.mintedSlug;
        if (slug) orphanQueue.push({ docId: e.docId, slug, type: e.type || 'bibliographic', via: result.source, cite: e.cite });
      } catch (err) {
        console.warn(`[phase-3a] leftover slug-mint failed for ${e.docId}/${e.refXmlId}: ${err.message}`);
      }
    }
    counters.touchedDocs.add(e.docId);
    leftoverKeys.add(`${e.docId}|${e.refXmlId}`);
    leftoverProcessed++;
  }
}
console.log(`[phase-3a]   leftover processed: ${leftoverProcessed}`);

// ---- Pass 3: apply (write) ---------------------------------------------

function addRefToDoc(doc, type, refIdOrSlug, viaSource) {
  doc.references = doc.references || {};
  const bucket = type === 'normative' ? 'normative' : 'bibliographic';
  doc.references[bucket] = doc.references[bucket] || [];
  if (doc.references[bucket].includes(refIdOrSlug)) return false;
  doc.references[bucket].push(refIdOrSlug);
  const metaKey = `${bucket}$meta`;
  doc.references[metaKey] = {
    source: 'parsed',
    confidence: 'medium',
    note: `Extracted from NLM <ref-list> via extractSmpteJournalRefs.js (${viaSource})`,
    updated: NOW,
  };
  return true;
}

if (APPLY) {
  console.log(`\n[phase-3a] APPLY: mriRecordSighting for canonical + staging…`);
  // Canonical: record MRI sightings (idempotent upsert) + add refId to source doc
  for (const c of canonicalQueue) {
    try {
      mriRecordSighting({
        docId: c.docId,
        type: c.type,
        refId: c.refId,
        cite: c.cite,
        href: '',
        rawRef: c.rawRef,
        title: c.title,
        mapSource: 'phase-3a-extract',
        mapDetail: c.via,
      });
    } catch (e) {
      console.warn(`[phase-3a] canonical mri record failed for ${c.docId}/${c.refId}: ${e.message}`);
    }
    const doc = touchedDocSet.get(c.docId) || docById.get(c.docId);
    if (doc) { touchedDocSet.set(c.docId, doc); addRefToDoc(doc, c.type, c.refId, c.via); }
  }
  // Orphan slugs
  for (const o of orphanQueue) {
    const doc = touchedDocSet.get(o.docId) || docById.get(o.docId);
    if (doc) { touchedDocSet.set(o.docId, doc); addRefToDoc(doc, o.type, o.slug, 'orphan-slug-mint'); }
  }

  console.log(`[phase-3a] writing ${touchedDocSet.size} source docs…`);
  let n = 0;
  for (const doc of touchedDocSet.values()) {
    saveDoc(doc);
    n++;
    if (n % 1000 === 0) console.log(`[phase-3a]   …${n}/${touchedDocSet.size}`);
  }
  console.log('[phase-3a] flushing MRI…');
  mriFlush({ force: true });

  // Trim leftover report — remove entries we handled
  if (leftoverKeys.size && fs.existsSync(UNRESOLVED_PATH)) {
    const rep = JSON.parse(fs.readFileSync(UNRESOLVED_PATH, 'utf8'));
    const remaining = (rep.unresolved || []).filter((e) => !leftoverKeys.has(`${e.docId}|${e.refXmlId}`));
    rep.unresolved = remaining;
    rep.total = remaining.length;
    rep.generatedAt = NOW;
    rep.note = (rep.note || '') + `\nPhase 3a (extractSmpteJournalRefs.js) consumed ${leftoverKeys.size} entries on ${NOW}.`;
    fs.writeFileSync(UNRESOLVED_PATH, JSON.stringify(rep, null, 2) + '\n', 'utf8');
    console.log(`[phase-3a] trimmed leftover report — ${remaining.length} remaining`);
  }
}

// ---- report -------------------------------------------------------------

const summary = {
  generatedAt: NOW,
  apply: APPLY,
  scope: INCLUDE_CONFERENCE ? ['Journal Article', 'Conference Paper'] : ['Journal Article'],
  limit: LIMIT || null,
  totals: {
    highwireXmlFilesParsed: counters.filesParsed,
    articlesMatched: counters.articlesMatched,
    articlesWithRefs: counters.articlesWithRefs,
    totalRefs: counters.totalRefs,
    canonical: counters.byKind.canonical,
    canonicalInRegistry: counters.inRegistry,
    canonicalKnownPubNoDoc: counters.knownPubNoDoc,
    slugMinted: counters.byKind['slug-mint'] + counters.byKind.ambiguous,
    ambiguous: counters.byKind.ambiguous,
    touchedDocs: counters.touchedDocs.size,
    leftoverProcessed,
  },
  bySource: counters.bySource,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2) + '\n', 'utf8');

const md = [
  '# Phase 3a — Journal (+ Conference) inline `<ref-list>` extraction\n',
  `> Generated at: ${NOW}`,
  `> Mode: **${APPLY ? 'APPLY' : 'dry-run'}**`,
  `> Scope: ${summary.scope.join(', ')}${LIMIT ? ` (limit ${LIMIT})` : ''}\n`,
  '## Totals',
  `- HIGHWIRE XML files parsed  : ${counters.filesParsed}`,
  `- Articles matched to registry: ${counters.articlesMatched}`,
  `- Articles with ref-list     : ${counters.articlesWithRefs}`,
  `- Total refs processed       : **${counters.totalRefs}**`,
  `- Distinct source docs touched: ${counters.touchedDocs.size}`,
  `- Leftover \`unresolved.json\` entries handled: ${leftoverProcessed}\n`,
  '## Outcome',
  '| outcome | count |',
  '|---|---:|',
  `| canonical refId → registry doc (direct link)                 | ${counters.inRegistry} |`,
  `| canonical refId → \`mri-known-no-doc\` (MRI carries slug)     | ${counters.knownPubNoDoc} |`,
  `| slug-minted (orphan; MRI carries cite + raw XML)             | ${counters.byKind['slug-mint']} |`,
  `| ambiguous vol+pages → slug-minted                             | ${counters.byKind.ambiguous} |`,
  '',
  '## By resolution path',
  '| path | count |',
  '|---|---:|',
  ...Object.entries(counters.bySource).sort(([, a], [, b]) => b - a).map(([k, v]) => `| \`${k}\` | ${v} |`),
  '',
  '## Notes',
  '- Under MRI v2, slug-minted refs are NOT silent. Each lands in the source doc\'s `references.bibliographic[]` and renders inline as `<cite>` with an `EXTERNAL` badge.',
  '- Slugs graduate to canonical refIds later via `resolveOrphans` once a new parser family or refMap entry covers them — no doc-file edits needed then.',
  '- Full per-entry detail in `smpteJournalRefs.json`.\n',
].join('\n');
fs.writeFileSync(OUT_MD, md, 'utf8');

console.log(`\n[phase-3a] ${APPLY ? 'APPLIED' : 'DRY-RUN'} summary:`);
console.log(`  total refs processed              : ${counters.totalRefs}`);
console.log(`  canonical → in registry           : ${counters.inRegistry}`);
console.log(`  canonical → known-pub-no-doc      : ${counters.knownPubNoDoc}`);
console.log(`  slug-minted                       : ${counters.byKind['slug-mint'] + counters.byKind.ambiguous}`);
console.log(`  source docs touched               : ${counters.touchedDocs.size}`);
console.log(`  reports                           : ${OUT_JSON}, ${OUT_MD}`);
if (!APPLY) console.log('\n  re-run with --apply to write changes.\n');
