/*
 * extractSmpteConferenceRefs.js — Phase 3b.
 *
 * Same shape as Phase 3a's extractSmpteJournalRefs.js but scoped to
 * Conference Paper docs (1,503 in the registry, 1,502 with empty
 * references[]) and with the pre-check pattern from #1229 baked in from
 * the start, so we don't repeat Phase 3a's twin-slug + straggler cleanup
 * mess.
 *
 * Pre-check pattern (before minting an orphan slug for a raw <ref>):
 *
 *   1. Compute the raw ref's contentHash (via lib/referencing's
 *      _contentHash — same normalization mriFlush uses for dedup).
 *   2. If MRI already has an entry with that hash, cite THAT refId
 *      instead of minting a new slug. Prevents the "content-hash
 *      collision → orphan sighting absorbed → slug pruned but doc still
 *      cites it" straggler class.
 *   3. Also index existing orphan slugs cited by the same source doc by
 *      normalized citationText. If a new ref about to be minted matches
 *      an already-cited slug (or canonical refId), reuse it. Prevents
 *      the "APTARA sidecar + HIGHWIRE inline extracted the same ref-list
 *      in different XML shapes" twin-pair class we cleaned up in Phase 3a.
 *
 * Resolution chain (unchanged from Phase 3a):
 *   1. direct DOI match — <pub-id pub-id-type="doi">
 *   2. vol+pages SMPTE-self-cite — <source> + <volume> + <fpage>
 *   3. parseRefId(<article-title>)
 *   4. mapRefByCite(<article-title>)
 *   5. Fallback → PRE-CHECK → mint slug OR cite existing
 *
 * The 14 Conference-Paper-sourced entries in
 * smpteSourceRefs.unresolved.json (left by Phase 1a) are also folded in.
 *
 * Usage:
 *   node src/main/scripts/extras/extractSmpteConferenceRefs.js             # dry-run
 *   node src/main/scripts/extras/extractSmpteConferenceRefs.js --apply     # write
 *   node src/main/scripts/extras/extractSmpteConferenceRefs.js --limit 100 # cap
 *
 * Reports: src/main/reports/smpteConferenceRefs.{json,md}
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
  _contentHash,
} = require('../../lib/referencing');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  if (i < 0) return 0;
  const n = parseInt(process.argv[i + 1] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
})();

const NOW = new Date().toISOString();
const HIGHWIRE_ROOT = '_source/SMPTE/HIGHWIRE';
const UNRESOLVED_PATH = 'src/main/reports/smpteSourceRefs.unresolved.json';
const OUT_JSON = 'src/main/reports/smpteConferenceRefs.json';
const OUT_MD = 'src/main/reports/smpteConferenceRefs.md';

const SCOPE_TYPE = 'Conference Paper';

reloadRefMap();
mriEnsureFile();

// ---- registry + MRI + indices -------------------------------------------

console.log('[phase-3b] loading registry…');
const docs = loadAllDocs();
const docById = new Map(docs.map((d) => [d.docId, d]));
const docIds = new Set(docs.map((d) => d.docId));

const mri = JSON.parse(fs.readFileSync('src/main/reports/masterReferenceIndex.json', 'utf8'));

// Pre-check indices (#1229)
const mriHashIndex = new Map();      // contentHash → refId
const mriCiteBySourceDoc = new Map(); // sourceDocId → Map<normCite, refId>
for (const [refId, entry] of Object.entries(mri.refs || {})) {
  if (entry.contentHash) mriHashIndex.set(entry.contentHash, refId);
  // For every rawVariant, capture (docId → cite) so we can spot twin pairs
  // where the same source doc already cites this ref under a different form.
  for (const rv of (entry.rawVariants || [])) {
    if (!rv.docId) continue;
    const cite = normCite(entry.citationText || rv.cite || '');
    if (!cite) continue;
    if (!mriCiteBySourceDoc.has(rv.docId)) mriCiteBySourceDoc.set(rv.docId, new Map());
    const m = mriCiteBySourceDoc.get(rv.docId);
    if (!m.has(cite)) m.set(cite, refId);
  }
}
console.log(`[phase-3b]   MRI: ${Object.keys(mri.refs || {}).length} refs, ${mriHashIndex.size} distinct contentHashes`);

const scopeDocs = docs.filter((d) => d.docType === SCOPE_TYPE);
console.log(`[phase-3b]   scope: ${scopeDocs.length} Conference Paper docs`);

// vol+pages index (Manuscript / M-prefix conf docs mixed with journals)
const volPagesIdx = new Map();
for (const d of docs) {
  if (!/^10\.5594-[jJmM]\d+/.test(d.docId || '')) continue;
  if (!d.volume || !d.pages) continue;
  const firstPage = String(d.pages).split(/[-–—]/)[0].trim();
  const key = `${String(d.volume).trim()}|${firstPage}`;
  if (!volPagesIdx.has(key)) volPagesIdx.set(key, []);
  volPagesIdx.get(key).push(d.docId);
}
console.log(`[phase-3b]   vol+pages index: ${volPagesIdx.size} entries`);

// ---- helpers -------------------------------------------------------------

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

function normCite(s) {
  return String(s || '').toLowerCase()
    .replace(/^\d+[.(a-z)]*[.)]\s*/, '')     // strip leading "1. " / "1a. " label
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function doiToDocId(doi) { return String(doi).replace(/\//g, '-'); }

function extractField(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? stripInline(m[1]) : '';
}

function extractPubIdDoi(block) {
  const m = block.match(/<pub-id[^>]*pub-id-type=["']doi["'][^>]*>([^<]+)<\/pub-id>/i);
  return m ? m[1].trim() : '';
}

function isSmpteJournalSource(sourceText) {
  const s = String(sourceText || '').toLowerCase();
  return /^journal$/.test(s.trim()) || /smp[te]|soc.*mot|trans.*mot/.test(s);
}

// ---- resolution chain (unchanged from Phase 3a) --------------------------

function tryResolve(refBlock) {
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

  if (volume && fpage && isSmpteJournalSource(source)) {
    const key = `${volume.trim()}|${fpage.trim()}`;
    const hits = volPagesIdx.get(key);
    if (hits && hits.length === 1) return { kind: 'canonical', refId: hits[0], source: 'vol+pages' };
    if (hits && hits.length > 1)   return { kind: 'ambiguous', candidates: hits, source: 'vol+pages-ambig' };
  }

  if (title) {
    const rid = parseRefId(title, '');
    if (rid) return { kind: 'canonical', refId: rid, source: 'parseRefId:title' };
    const mapped = mapRefByCite(title);
    if (mapped) return { kind: 'canonical', refId: mapped, source: 'mapRefByCite' };
  }
  return { kind: 'slug-mint', source: 'orphan-slug' };
}

// ---- extraction pass -----------------------------------------------------

console.log('\n[phase-3b] Pass 1: walking HIGHWIRE XMLs…');
const xmlFiles = walkXmlFiles(HIGHWIRE_ROOT);
console.log(`[phase-3b]   ${xmlFiles.length} XML files`);

const counters = {
  filesParsed: 0,
  articlesMatched: 0,
  articlesWithRefs: 0,
  totalRefs: 0,
  bySource: {},
  byKind: { canonical: 0, 'slug-mint': 0, 'slug-mint-reused': 0, ambiguous: 0 },
  inRegistry: 0,
  knownPubNoDoc: 0,
  precheckHashMatch: 0,      // #1229: contentHash matched existing MRI entry
  precheckCiteMatch: 0,      // #1229: cite matched existing slug in same source doc
  touchedDocs: new Set(),
};

const orphanQueue = [];
const canonicalQueue = [];
const touchedDocSet = new Map();

function extractRefsFromArticle(articleXml) {
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

  const articleBlocks = xml.match(/<article\b[\s\S]*?<\/article>/g) || [xml];
  for (const artXml of articleBlocks) {
    if (LIMIT && counters.articlesMatched >= LIMIT) break;

    const doi = (artXml.match(/<article-id[^>]*pub-id-type=["']doi["'][^>]*>([^<]+)<\/article-id>/i) || [])[1];
    if (!doi) continue;
    const sourceDocId = doiToDocId(doi.trim());
    const sourceDoc = docById.get(sourceDocId);
    if (!sourceDoc || sourceDoc.docType !== SCOPE_TYPE) continue;
    counters.articlesMatched++;

    const refs = extractRefsFromArticle(artXml);
    if (!refs.length) continue;
    counters.articlesWithRefs++;

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
        canonicalQueue.push({ docId: sourceDocId, refId: result.refId, type: 'bibliographic', via: result.source, rawRef: r.rawRef, cite: r.cite, title: r.title });
        counters.touchedDocs.add(sourceDocId);
        continue;
      }

      // Fall-through: PRE-CHECK before minting (#1229)
      const hash = _contentHash(r.rawRef);
      const cite = normCite(r.cite);

      // 1) contentHash pre-check — global
      let reuseRefId = hash ? mriHashIndex.get(hash) : null;

      // 2) cite-text pre-check — same source doc
      if (!reuseRefId && cite) {
        const m = mriCiteBySourceDoc.get(sourceDocId);
        if (m) reuseRefId = m.get(cite);
      }

      if (reuseRefId) {
        counters.byKind['slug-mint-reused']++;
        if (hash && mriHashIndex.get(hash) === reuseRefId) counters.precheckHashMatch++;
        else counters.precheckCiteMatch++;
        // Cite the existing refId instead of minting a new slug
        canonicalQueue.push({
          docId: sourceDocId, refId: reuseRefId, type: 'bibliographic',
          via: 'precheck-reuse', rawRef: r.rawRef, cite: r.cite, title: r.title,
        });
        counters.touchedDocs.add(sourceDocId);
        continue;
      }

      // Real slug-mint
      if (APPLY) {
        try {
          const mint = mriRecordSighting({
            docId: sourceDocId, type: 'bibliographic', cite: r.cite, href: '',
            rawRef: r.rawRef, title: r.title || '',
            mapSource: 'phase-3b-extract', mapDetail: result.source,
          });
          const slug = mint && mint.mintedSlug;
          if (slug) {
            orphanQueue.push({ docId: sourceDocId, slug, type: 'bibliographic', via: result.source, cite: r.cite });
            // Register into indices so subsequent refs in this run see it
            if (hash) mriHashIndex.set(hash, slug);
            if (cite) {
              if (!mriCiteBySourceDoc.has(sourceDocId)) mriCiteBySourceDoc.set(sourceDocId, new Map());
              mriCiteBySourceDoc.get(sourceDocId).set(cite, slug);
            }
          }
        } catch (e) {
          console.warn(`[phase-3b] slug-mint failed for ${sourceDocId}/${r.refXmlId}: ${e.message}`);
        }
      } else {
        orphanQueue.push({ docId: sourceDocId, slug: '(would mint)', type: 'bibliographic', via: result.source, cite: r.cite });
      }
      counters.touchedDocs.add(sourceDocId);
    }

    if (counters.filesParsed % 2000 === 0) console.log(`[phase-3b]   …${counters.filesParsed} files, ${counters.articlesMatched} matched`);
  }
}
console.log(`[phase-3b]   done: ${counters.filesParsed} files, ${counters.articlesMatched} conf articles matched, ${counters.totalRefs} refs`);

// ---- Pass 2: leftover from Phase 1a --------------------------------------

console.log('\n[phase-3b] Pass 2: Conference-source leftover in unresolved.json…');
let leftoverProcessed = 0;
const leftoverKeys = new Set();
if (fs.existsSync(UNRESOLVED_PATH)) {
  const rep = JSON.parse(fs.readFileSync(UNRESOLVED_PATH, 'utf8'));
  const entries = Array.isArray(rep.unresolved) ? rep.unresolved : [];
  const leftoverScope = entries.filter((e) => docById.get(e.docId)?.docType === SCOPE_TYPE);
  console.log(`[phase-3b]   ${leftoverScope.length} entries in scope`);
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
      canonicalQueue.push({ docId: e.docId, refId: result.refId, type: e.type || 'bibliographic', via: result.source, rawRef: e.rawRef || '', cite: e.cite || '', title: e.title || '' });
    } else {
      const hash = _contentHash(e.rawRef || '');
      const cite = normCite(e.cite || '');
      let reuse = hash ? mriHashIndex.get(hash) : null;
      if (!reuse && cite) reuse = (mriCiteBySourceDoc.get(e.docId) || new Map()).get(cite);
      if (reuse) {
        counters.byKind['slug-mint-reused']++;
        if (hash && mriHashIndex.get(hash) === reuse) counters.precheckHashMatch++;
        else counters.precheckCiteMatch++;
        canonicalQueue.push({ docId: e.docId, refId: reuse, type: e.type || 'bibliographic', via: 'precheck-reuse', rawRef: e.rawRef || '', cite: e.cite || '', title: e.title || '' });
      } else if (APPLY) {
        try {
          const mint = mriRecordSighting({
            docId: e.docId, type: e.type || 'bibliographic',
            cite: e.cite || '', href: '', rawRef: e.rawRef || '', title: e.title || '',
            mapSource: 'phase-3b-extract', mapDetail: `leftover:${result.source}`,
          });
          const slug = mint && mint.mintedSlug;
          if (slug) {
            orphanQueue.push({ docId: e.docId, slug, type: e.type || 'bibliographic', via: result.source, cite: e.cite || '' });
            if (hash) mriHashIndex.set(hash, slug);
            if (cite) {
              if (!mriCiteBySourceDoc.has(e.docId)) mriCiteBySourceDoc.set(e.docId, new Map());
              mriCiteBySourceDoc.get(e.docId).set(cite, slug);
            }
          }
        } catch (err) { console.warn(`[phase-3b] leftover slug-mint failed for ${e.docId}: ${err.message}`); }
      }
    }
    counters.touchedDocs.add(e.docId);
    leftoverKeys.add(`${e.docId}|${e.refXmlId}`);
    leftoverProcessed++;
  }
}

// ---- apply ---------------------------------------------------------------

function addRefToDoc(doc, type, refIdOrSlug, viaSource) {
  doc.references = doc.references || {};
  const bucket = type === 'normative' ? 'normative' : 'bibliographic';
  doc.references[bucket] = doc.references[bucket] || [];
  if (doc.references[bucket].includes(refIdOrSlug)) return false;
  doc.references[bucket].push(refIdOrSlug);
  doc.references[`${bucket}$meta`] = {
    source: 'parsed', confidence: 'medium',
    note: `Extracted from NLM <ref-list> via extractSmpteConferenceRefs.js (${viaSource})`,
    updated: NOW,
  };
  return true;
}

if (APPLY) {
  console.log(`\n[phase-3b] APPLY: staging canonical + slug refs…`);
  for (const c of canonicalQueue) {
    try {
      mriRecordSighting({
        docId: c.docId, type: c.type, refId: c.refId, cite: c.cite, href: '',
        rawRef: c.rawRef, title: c.title,
        mapSource: 'phase-3b-extract', mapDetail: c.via,
      });
    } catch (e) { console.warn(`[phase-3b] canonical mri record failed for ${c.docId}/${c.refId}: ${e.message}`); }
    const doc = touchedDocSet.get(c.docId) || docById.get(c.docId);
    if (doc) { touchedDocSet.set(c.docId, doc); addRefToDoc(doc, c.type, c.refId, c.via); }
  }
  for (const o of orphanQueue) {
    const doc = touchedDocSet.get(o.docId) || docById.get(o.docId);
    if (doc) { touchedDocSet.set(o.docId, doc); addRefToDoc(doc, o.type, o.slug, 'orphan-slug-mint'); }
  }

  console.log(`[phase-3b] writing ${touchedDocSet.size} source docs…`);
  let n = 0;
  for (const doc of touchedDocSet.values()) { saveDoc(doc); n++; if (n % 500 === 0) console.log(`[phase-3b]   …${n}/${touchedDocSet.size}`); }
  console.log('[phase-3b] flushing MRI…');
  mriFlush({ force: true });

  if (leftoverKeys.size && fs.existsSync(UNRESOLVED_PATH)) {
    const rep = JSON.parse(fs.readFileSync(UNRESOLVED_PATH, 'utf8'));
    const remaining = (rep.unresolved || []).filter((e) => !leftoverKeys.has(`${e.docId}|${e.refXmlId}`));
    rep.unresolved = remaining;
    rep.total = remaining.length;
    rep.generatedAt = NOW;
    rep.note = (rep.note || '') + `\nPhase 3b (extractSmpteConferenceRefs.js) consumed ${leftoverKeys.size} entries on ${NOW}.`;
    fs.writeFileSync(UNRESOLVED_PATH, JSON.stringify(rep, null, 2) + '\n', 'utf8');
    console.log(`[phase-3b] trimmed leftover — ${remaining.length} remaining`);
  }
}

// ---- report -------------------------------------------------------------

const summary = {
  generatedAt: NOW, apply: APPLY, limit: LIMIT || null,
  totals: {
    highwireXmlFilesParsed: counters.filesParsed,
    articlesMatched: counters.articlesMatched,
    articlesWithRefs: counters.articlesWithRefs,
    totalRefs: counters.totalRefs,
    canonical: counters.byKind.canonical,
    canonicalInRegistry: counters.inRegistry,
    canonicalKnownPubNoDoc: counters.knownPubNoDoc,
    slugMinted: counters.byKind['slug-mint'] + counters.byKind.ambiguous,
    slugMintReused: counters.byKind['slug-mint-reused'],
    precheckHashMatch: counters.precheckHashMatch,
    precheckCiteMatch: counters.precheckCiteMatch,
    touchedDocs: counters.touchedDocs.size,
    leftoverProcessed,
  },
  bySource: counters.bySource,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2) + '\n', 'utf8');

const md = [
  '# Phase 3b — Conference Paper inline `<ref-list>` extraction\n',
  `> Generated at: ${NOW}`,
  `> Mode: **${APPLY ? 'APPLY' : 'dry-run'}**`,
  `> Scope: Conference Paper${LIMIT ? ` (limit ${LIMIT})` : ''}\n`,
  '## Totals',
  `- HIGHWIRE XML files parsed  : ${counters.filesParsed}`,
  `- Conf articles matched to registry: ${counters.articlesMatched}`,
  `- Articles with ref-list     : ${counters.articlesWithRefs}`,
  `- Total refs processed       : **${counters.totalRefs}**`,
  `- Distinct source docs touched: ${counters.touchedDocs.size}`,
  `- Leftover \`unresolved.json\` entries handled: ${leftoverProcessed}\n`,
  '## Outcome',
  '| outcome | count |',
  '|---|---:|',
  `| canonical refId → registry doc (direct link) | ${counters.inRegistry} |`,
  `| canonical refId → \`mri-known-no-doc\` (MRI carries slug) | ${counters.knownPubNoDoc} |`,
  `| slug-minted (fresh, orphan) | ${counters.byKind['slug-mint']} |`,
  `| **slug-mint reused via #1229 pre-check** (cited existing MRI refId instead of new slug) | ${counters.byKind['slug-mint-reused']} |`,
  `| ambiguous vol+pages → slug-minted | ${counters.byKind.ambiguous} |`,
  '',
  '## #1229 pre-check breakdown',
  '| trigger | count |',
  '|---|---:|',
  `| contentHash matched existing MRI entry (would-be-straggler prevented) | ${counters.precheckHashMatch} |`,
  `| normalized-cite matched existing slug on same source doc (twin-pair prevented) | ${counters.precheckCiteMatch} |`,
  '',
  '## By resolution path',
  '| path | count |',
  '|---|---:|',
  ...Object.entries(counters.bySource).sort(([, a], [, b]) => b - a).map(([k, v]) => `| \`${k}\` | ${v} |`),
  '',
  '## Notes',
  '- Under MRI v2 slug system, slug-minted refs are NOT silent. Each lands in the source doc\'s `references.bibliographic[]` and renders inline as `<cite>` with an `EXTERNAL` badge.',
  '- Pre-check pattern (#1229) prevents both the leaked-slug class (contentHash collision) AND the twin-pair class (APTARA↔HIGHWIRE same-ref-different-shape) that surfaced in Phase 3a.',
  '- Full per-entry detail in `smpteConferenceRefs.json`.\n',
].join('\n');
fs.writeFileSync(OUT_MD, md, 'utf8');

console.log(`\n[phase-3b] ${APPLY ? 'APPLIED' : 'DRY-RUN'} summary:`);
console.log(`  total refs processed              : ${counters.totalRefs}`);
console.log(`  canonical → in registry           : ${counters.inRegistry}`);
console.log(`  canonical → known-pub-no-doc      : ${counters.knownPubNoDoc}`);
console.log(`  slug-minted (fresh)               : ${counters.byKind['slug-mint']}`);
console.log(`  slug-mint reused via pre-check    : ${counters.byKind['slug-mint-reused']}`);
console.log(`    ↳ contentHash match             : ${counters.precheckHashMatch}`);
console.log(`    ↳ cite-text match (twin-pair)   : ${counters.precheckCiteMatch}`);
console.log(`  source docs touched               : ${counters.touchedDocs.size}`);
console.log(`  reports                           : ${OUT_JSON}, ${OUT_MD}`);
if (!APPLY) console.log('\n  re-run with --apply to write changes.\n');
