/*
 * mergeXyTwins.js — merge the 147 plain-DOI duplicate docs into their
 * XY-DOI twins (2026-07-09 decision).
 *
 * Model (verified via doi.org handle API): the DOI registrar is case-
 * insensitive, so 10.5594/J18049 ≡ 10.5594/j18049 — one DOI, owned by
 * ONE of the two same-numbered documents. SMPTE re-registered the other
 * document under the XY suffix (10.5594/J18049XY). Our registry imported
 * that re-registered article twice: once from HIGHWIRE under the plain
 * DOI (a mispointer — it resolves to the case-sibling's landing page)
 * and once from the canonical corpus under the true XY DOI. Those pairs
 * are the same article (147/147 identical pages, same issue).
 *
 * Merge: XY doc survives (docId matches the registered DOI). Richest
 * field wins: references (union), authors (richer list), abstract
 * (longer), docTitle (longer), keywords (union); donor-only fields copy
 * over. The survivor's doi$meta.note records the duplicative plain-DOI
 * registration. The donor file is deleted.
 *
 * Case-siblings (J18049 vs j18049 = different documents) are NEVER
 * touched by this pass — only exact-casing plain/XY pairs.
 *
 * Report (also the "what to remove from source" list): xyTwinMerge.md —
 * per pair: survivor, retired docId+doi, the donor's source-file trails
 * from $meta, and which fields were merged.
 *
 * KNOWN GAP (repaired by fixMergedOrphanSlugs.js): this merge did NOT
 * re-anchor source-anchored orphan slugs (orphan/<donorId>/…) carried in
 * the unioned references — they must be renamed to the survivor and the
 * MRI entries re-keyed, or the build loses their lineage. Run the fix
 * script after any future use of this merge.
 *
 * Usage:
 *   node .../mergeXyTwins.js            # dry-run + report
 *   node .../mergeXyTwins.js --apply
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../../lib/registry');

const REPORTS = 'src/main/reports/smpte-canonical-audit';
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const VERSION = 'xy-twin-merge@v1';

function decode(s) { return String(s == null ? '' : s); }
function longer(a, b) {
  const as = decode(a).trim(), bs = decode(b).trim();
  return bs.length > as.length ? bs : as;
}
function authorRichness(arr) {
  if (!Array.isArray(arr)) return 0;
  let score = arr.length * 10;
  for (const a of arr) if (a && typeof a === 'object') score += (a.bio ? 2 : 0) + (a.affiliation ? 2 : 0) + 1;
  return score;
}
function sourceHints(doc) {
  const hints = new Set();
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k.endsWith('$meta') && v && typeof v === 'object') {
        if (v.sourceUrl) hints.add(String(v.sourceUrl));
        if (v.note && /_source[\\/]/i.test(v.note)) {
          // paths contain spaces (e.g. "DL Project Files") — capture to the
          // closing paren of the "(…)" the notes wrap paths in
          const m = String(v.note).match(/_source[^)]+/g);
          if (m) for (const x of m) hints.add(x.trim());
        }
      }
      if (v && typeof v === 'object') walk(v);
    }
  })(doc);
  return [...hints];
}
function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

const docs = loadAllDocs();
const byId = new Map(docs.map(d => [d.docId, d]));

const merges = [];
for (const d of docs) {
  if (!/XY$/.test(d.docId)) continue;
  const donor = byId.get(d.docId.replace(/XY$/, ''));
  if (!donor) continue;
  // Same-article guard: identical pages (the property that established the
  // duplication). Refuse to merge if pages differ — that pair needs eyes.
  if (String(d.pages || '') !== String(donor.pages || '')) {
    console.warn(`  SKIP (pages differ — review): ${d.docId} vs ${donor.docId}`);
    continue;
  }
  merges.push({ survivor: d, donor });
}
console.log(`[xy-merge] pairs to merge: ${merges.length}`);

const report = [];
let refUnions = 0, authorTakes = 0, abstractTakes = 0, titleTakes = 0;
for (const { survivor, donor } of merges) {
  const mergedFields = [];

  // references — union per category
  const dRefs = donor.references || {};
  if (Object.keys(dRefs).some(k => Array.isArray(dRefs[k]) && dRefs[k].length)) {
    const sRefs = survivor.references || {};
    const out = { ...sRefs };
    let changed = false;
    for (const [cat, arr] of Object.entries(dRefs)) {
      if (!Array.isArray(arr) || !arr.length) continue;
      const cur = Array.isArray(out[cat]) ? out[cat] : [];
      const set = new Set(cur.map(String));
      const additions = arr.filter(r => !set.has(String(r)));
      if (additions.length) { out[cat] = [...cur, ...additions]; changed = true; }
      // carry the donor's category $meta when survivor has none
      if (dRefs[`${cat}$meta`] && !out[`${cat}$meta`]) out[`${cat}$meta`] = dRefs[`${cat}$meta`];
    }
    if (changed) { survivor.references = out; mergedFields.push('references'); refUnions++; }
  }

  // authors — richer list wins
  if (authorRichness(donor.authors) > authorRichness(survivor.authors)) {
    survivor.authors = donor.authors;
    if (donor['authors$meta']) survivor['authors$meta'] = donor['authors$meta'];
    mergedFields.push('authors'); authorTakes++;
  }

  // abstract — longer wins
  if (decode(donor.abstract).trim() && decode(donor.abstract).trim().length > decode(survivor.abstract).trim().length) {
    survivor.abstract = donor.abstract;
    if (donor['abstract$meta']) survivor['abstract$meta'] = donor['abstract$meta'];
    mergedFields.push('abstract'); abstractTakes++;
  }

  // docTitle — longer wins
  if (longer(survivor.docTitle, donor.docTitle) !== decode(survivor.docTitle).trim()) {
    survivor.docTitle = donor.docTitle;
    mergedFields.push('docTitle'); titleTakes++;
  }

  // keywords — union
  if (Array.isArray(donor.keywords) && donor.keywords.length) {
    const cur = Array.isArray(survivor.keywords) ? survivor.keywords : [];
    const seen = new Set(cur.map(k => String(k).toLowerCase()));
    const adds = donor.keywords.filter(k => !seen.has(String(k).toLowerCase()));
    if (adds.length) { survivor.keywords = [...cur, ...adds]; mergedFields.push('keywords'); }
  }

  // donor-only top-level scalars/objects survivor lacks (excluding identity/meta)
  const SKIP = new Set(['docId', 'doi', 'href', 'resolvedHref', 'docLabel', 'references', 'authors', 'abstract', 'docTitle', 'keywords']);
  for (const [k, v] of Object.entries(donor)) {
    if (k.endsWith('$meta') || SKIP.has(k)) continue;
    if (survivor[k] === undefined && v !== undefined) {
      survivor[k] = v;
      if (donor[`${k}$meta`]) survivor[`${k}$meta`] = donor[`${k}$meta`];
      mergedFields.push(k);
    }
  }

  // doi$meta note — the duplicative-registration record (user requirement)
  const dupNote = `DUPLICATIVE DOI NOTE: the plain form ${donor.doi} was also used for this article by an earlier delivery (registry doc ${donor.docId}, merged+retired ${NOW.slice(0, 10)}). The DOI registrar is case-insensitive, so that plain form is owned by the case-sibling document and resolves to ITS landing page — this article's registered DOI is the XY form.`;
  const dm = survivor['doi$meta'] && typeof survivor['doi$meta'] === 'object' ? { ...survivor['doi$meta'] } : {};
  dm.note = dm.note ? `${dm.note} ${dupNote}` : dupNote;
  dm.updated = NOW;
  dm.version = VERSION;
  if (!dm.source) dm.source = 'resolved';
  if (!dm.confidence) dm.confidence = 'high';
  survivor['doi$meta'] = dm;

  report.push({
    survivor: survivor.docId,
    retired: donor.docId,
    retiredDoi: donor.doi,
    retiredResolvedHref: donor.resolvedHref || null,
    mergedFields,
    sourceHints: sourceHints(donor),
    donorPath: path.relative(REPO_ROOT, docAbsPath(donor)),
  });
}
console.log(`[xy-merge] field merges — references: ${refUnions} · authors: ${authorTakes} · abstract: ${abstractTakes} · docTitle: ${titleTakes}`);

// ---- report ---------------------------------------------------------------
const md = [];
md.push('# XY twin merge — plain-DOI duplicates retired into XY docs');
md.push('');
md.push(`> Generated: ${NOW} · Mode: **${APPLY ? 'APPLY' : 'DRY-RUN'}** · ${merges.length} pairs`);
md.push('');
md.push('The **retired docId / source trail** column is the "what to remove from the source archives" list.');
md.push('');
md.push('| survivor (kept) | retired doc | retired doi (mispointer) | fields merged in | donor source trail |');
md.push('|---|---|---|---|---|');
for (const r of report) {
  const hints = r.sourceHints.slice(0, 3).map(h => `\`${h.slice(0, 160)}\``).join('<br>') || '—';
  md.push(`| \`${r.survivor}\` | \`${r.retired}\` | ${r.retiredDoi} | ${r.mergedFields.join(', ') || '(none — XY already richest)'} | ${hints} |`);
}
md.push('');
md.push('## Notes');
md.push('');
md.push('- Survivor `doi$meta.note` records the duplicative plain-DOI registration on every merged doc.');
md.push('- MRI sightings recorded under retired docIds remain until the next full MRI replay prunes them (auto-build).');
md.push('- Case-siblings (J vs j) are different documents and were not touched.');
fs.writeFileSync(path.join(REPORTS, 'xyTwinMerge.md'), md.join('\n') + '\n');
console.log(`[xy-merge] wrote ${path.join(REPORTS, 'xyTwinMerge.md')}`);

if (!APPLY) {
  console.log(`\nDry run — pass --apply to merge ${merges.length} pairs (writes survivors, deletes donors).`);
  process.exit(0);
}

let written = 0, deleted = 0;
for (const { survivor, donor } of merges) {
  const sorted = sortKeysDeep(survivor);
  fs.writeFileSync(docAbsPath(sorted), JSON.stringify(sorted, null, 2) + '\n');
  written++;
  const donorFile = docAbsPath(donor);
  if (fs.existsSync(donorFile)) { fs.rmSync(donorFile); deleted++; }
}
console.log(`\nMerged ${written} survivors, deleted ${deleted} donor files.`);
console.log('Reminder: npm run canonicalize && npm run validate && node src/main/scripts/extras/validateMriCoverage.js, then commit.');
