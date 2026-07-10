/*
 * keywordConformIngest.js — conform the NLM-ingested docs' keywords.
 *
 * The 491 NLM-ingested docs carry `index_terms` keywords verbatim ALL-CAPS.
 * This pass rewrites each ingested doc's `keywords[]`:
 *   1. case-insensitive vocab match  → controlledKeywords canonical casing
 *      (vocab = site.json controlledKeywords ∪ keywordVocabDecisions.adds)
 *   2. else FOLD synonym             → keywordVocabDecisions.folds target
 *   3. else                          → normalizeKeyword() (casing conform only)
 * Step 3 KEEPS the long-tail (1–2-doc terms) — deferred to a later triage —
 * rather than dropping non-vocab terms. Deduped case-insensitively, order kept.
 *
 * Scope: only docs THIS ingester wrote (docId$meta.note carries the ingest
 * marker) — never the wider registry.
 *
 * On --apply: saveDoc() each changed doc AND union keywordVocabDecisions.adds
 * into site.json controlledKeywords (so the new vocab terms are browsable).
 *
 *   node …/keywordConformIngest.js            # dry-run → report
 *   node …/keywordConformIngest.js --apply    # write docs + controlledKeywords
 *
 * Report: src/main/reports/smpte-canonical-audit/keywordConformIngest.md
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs, saveDoc } = require('../../../lib/registry');
const { normalizeKeyword } = require('../../utils/keyword.normalize');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const NOW = new Date().toISOString();
const APPLY = process.argv.includes('--apply');
const SITE_PATH = 'src/main/config/site.json';
const DECISIONS_PATH = 'src/main/reports/smpte-canonical-audit/keywordVocabDecisions.json';
const OUT_MD = 'src/main/reports/smpte-canonical-audit/keywordConformIngest.md';
const INGEST_NOTE = 'ingestNlmCanonicalDocs.js';

const site = JSON.parse(fs.readFileSync(SITE_PATH, 'utf8'));
const decisions = JSON.parse(fs.readFileSync(DECISIONS_PATH, 'utf8'));
const adds = Array.isArray(decisions.adds) ? decisions.adds : [];
const folds = decisions.folds || {};

// vocab = controlledKeywords ∪ approved adds, indexed by lowercase → canonical
const vocabByLower = new Map();
for (const k of [...(site.controlledKeywords || []), ...adds]) vocabByLower.set(String(k).toLowerCase(), k);
const foldByLower = new Map(Object.entries(folds).map(([k, v]) => [k.toLowerCase(), v]));

function conformOne(raw) {
  const lo = String(raw || '').toLowerCase().trim();
  if (!lo) return null;
  if (vocabByLower.has(lo)) return { term: vocabByLower.get(lo), how: 'vocab' };
  if (foldByLower.has(lo)) return { term: foldByLower.get(lo), how: 'fold' };
  return { term: normalizeKeyword(raw), how: 'normalize' };
}

function conformList(keywords) {
  const out = [];
  const seen = new Set();
  const stats = { vocab: 0, fold: 0, normalize: 0 };
  for (const k of keywords) {
    const r = conformOne(k);
    if (!r || !r.term) continue;
    const key = r.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r.term);
    stats[r.how]++;
  }
  return { out, stats };
}

const isOurs = (d) => String((d['docId$meta'] || {}).note || '').includes(INGEST_NOTE);

const docs = loadAllDocs().filter((d) => isOurs(d) && Array.isArray(d.keywords) && d.keywords.length);
console.log(`[kw-conform] ${docs.length} ingested docs with keywords`);

const changed = [];
const totals = { vocab: 0, fold: 0, normalize: 0, docsChanged: 0 };
for (const doc of docs) {
  const before = doc.keywords.slice();
  const { out, stats } = conformList(before);
  totals.vocab += stats.vocab; totals.fold += stats.fold; totals.normalize += stats.normalize;
  const diff = JSON.stringify(before) !== JSON.stringify(out);
  if (diff) {
    changed.push({ docId: doc.docId, before, after: out });
    if (APPLY) {
      doc.keywords = out;
      doc['keywords$meta'] = {
        source: 'resolved',
        confidence: 'high',
        note: `Keywords conformed via keywordConformIngest.js — vocab/fold mapping (keywordVocabDecisions.json) + casing normalize; long-tail retained pending later triage.`,
        updated: NOW,
      };
      saveDoc(doc);
    }
  }
}
totals.docsChanged = changed.length;

// union approved adds into controlledKeywords
const missingAdds = adds.filter((a) => !(site.controlledKeywords || []).some((k) => k.toLowerCase() === a.toLowerCase()));
if (APPLY && missingAdds.length) {
  site.controlledKeywords = Array.from(new Set([...(site.controlledKeywords || []), ...missingAdds]))
    .sort((a, b) => a.localeCompare(b));
  fs.writeFileSync(SITE_PATH, JSON.stringify(site, null, 2) + '\n', 'utf8');
  console.log(`[kw-conform] added ${missingAdds.length} terms to controlledKeywords (${site.controlledKeywords.length} total)`);
}

const md = [
  '# Keyword conform — NLM-ingested docs\n',
  `> ${APPLY ? 'APPLY' : 'DRY-RUN'} · ${NOW}`,
  `> Vocab = ${(site.controlledKeywords || []).length} controlledKeywords ∪ ${adds.length} approved adds · ${Object.keys(folds).length} fold rules\n`,
  '## Totals',
  `- ingested docs with keywords: ${docs.length}`,
  `- docs whose keyword list changed: **${totals.docsChanged}**`,
  `- term mappings — vocab-matched: ${totals.vocab} · folded: ${totals.fold} · casing-normalized (long-tail kept): ${totals.normalize}`,
  `- new controlledKeywords added: ${APPLY ? missingAdds.length : `${missingAdds.length} (on apply)`}\n`,
  '## Sample changes (first 25 docs)',
  '| docId | before → after |',
  '|---|---|',
  ...changed.slice(0, 25).map((c) => `| \`${c.docId}\` | ${c.before.join(', ')} → **${c.after.join(', ')}** |`),
  '',
  '## Notes',
  '- Long-tail (1–2-doc) terms are casing-normalized and KEPT, not dropped — held for the next triage pass.',
  '- Only docs written by `ingestNlmCanonicalDocs.js` are touched.',
  '',
].join('\n');
fs.writeFileSync(OUT_MD, md, 'utf8');

console.log(`[kw-conform] ${APPLY ? 'APPLIED' : 'DRY-RUN'} — ${totals.docsChanged}/${docs.length} docs changed. Report: ${OUT_MD}`);
if (!APPLY) console.log('  re-run with --apply to write docs + controlledKeywords.');
