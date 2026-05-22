/*
Copyright (c) 2025-26 PrZ3 LLC (d/b/a [PrZ3](https://github.com/PrZ3r))

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

3. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or
   other materials provided with the distribution.

4. Neither the name of the copyright holder nor the names of its contributors may
   be used to endorse or promote products derived from this software without specific
   prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

// ONE-TIME SMPTE journal-article + conference-paper backfill.
//
// _source/SMPTE/HIGHWIRE/.../ holds per-article XML in the NLM Journal Archiving
// & Interchange DTD — SMPTE content the registry has never carried (the "Gap"
// bucket in sourceInventory.smpte.md). Two corpora share the DTD:
//   smptej/  10.5594_J*  →  docType "Journal Article"   (~18k)
//   smptem/  10.5594_M*  →  docType "Conference Paper"   (~1.5k)
// This script parses each NLM article's front-matter and writes one per-doc JSON
// file into the #1108 per-doc registry (src/main/data/docs/smpte/{docType}/{year}/).
//
// References are NOT extracted here — the <back> reference list is a separate,
// deferred pass. Docs already present in the registry are skipped (never merged).
//
// --corpus journal|conference|both  (default both) selects which to import.
// Runs in chunks: --limit N writes the first N not-yet-present articles. There is
// no --offset — each run recomputes the target list (candidates whose docId is not
// in the registry), so landed docs drop out automatically. Re-run `--apply --limit
// N` until "remaining" reaches 0. Dry-run by default; pass --apply to write.
// Must run from the repo root (or anywhere — cwd is pinned below).

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
// registry.js resolves DOCS_ROOT relative to cwd — pin it.
process.chdir(REPO_ROOT);

const { readNlmArticleXml } = require('../utils/extractSourceMetadata');
const { doiToDocId } = require('../utils/parseSourceName');
const { loadAllDocs, saveDoc, docPath } = require('../../lib/registry');

const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const REPORT_JSON = path.join(REPO_ROOT, 'src', 'main', 'reports', 'smpteJournalImport.json');
const REPORT_MD = path.join(REPO_ROOT, 'src', 'main', 'reports', 'smpteJournalImport.md');
const DEFAULT_SOURCE = path.join(REPO_ROOT, '_source', 'SMPTE', 'HIGHWIRE');

// The two NLM corpora share this DTD and pipeline; only docType + provenance
// differ. `version` is the $meta tag a future re-extract greps for; `source`
// stays a schema enum value ('parsed' / 'inferred'). NLM names the parser
// family — distinct from the Allen Press journal_metadata reader.
const CORPORA = {
  journal: {
    key: 'journal', prefix: 'J', docType: 'Journal Article',
    version: 'smpte-journal-article-nlm@v1', label: 'journal paper',
  },
  conference: {
    key: 'conference', prefix: 'M', docType: 'Conference Paper',
    version: 'smpte-conference-paper-nlm@v1', label: 'conference paper',
  },
};
const NOW = new Date().toISOString();
const APPLY = process.argv.includes('--apply');

function argInt(name, def) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1] != null) {
    const n = parseInt(process.argv[i + 1], 10);
    if (Number.isFinite(n)) return n;
  }
  return def;
}
function argStr(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] != null ? process.argv[i + 1] : def;
}
const LIMIT = Math.max(0, argInt('--limit', Infinity));
const SOURCE = path.resolve(argStr('--source', DEFAULT_SOURCE));

const CORPUS_ARG = String(argStr('--corpus', 'both')).toLowerCase();
const SELECTED = CORPUS_ARG === 'both'
  ? Object.values(CORPORA)
  : (CORPORA[CORPUS_ARG] ? [CORPORA[CORPUS_ARG]] : null);
if (!SELECTED) {
  console.error(`Unknown --corpus "${CORPUS_ARG}" — use journal | conference | both`);
  process.exit(1);
}

// docId prefix (10.5594-J… / 10.5594-M…) → corpus.
function corpusForDocId(docId) {
  const m = String(docId || '').match(/^10\.5594-([A-Za-z])/);
  if (!m) return null;
  return Object.values(CORPORA).find((c) => c.prefix === m[1].toUpperCase()) || null;
}

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// --- discovery --------------------------------------------------------------
// NLM per-article files are named 10.5594_J#####.xml / 10.5594_M#####.xml (a
// trailing letter occurs, e.g. J00496a). The file regex is built from the
// selected corpora's prefixes; reference side-cars (*-ref.xml) are excluded.
const FILE_RE = new RegExp(
  `^10\\.5594[_-][${SELECTED.map((c) => c.prefix).join('')}]\\d+[a-z]?\\.xml$`, 'i');

function walkXml(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === '__MACOSX' || e.name === '.DS_Store') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkXml(full, out);
    else if (e.isFile() && FILE_RE.test(e.name) && !/-ref\.xml$/i.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

// docId derived from the filename alone — lets the target list be computed
// (and chunked runs stay resumable) without parsing every file up front.
function provisionalDocId(file) {
  const base = path.basename(file).replace(/\.xml$/i, '');
  return base.replace(/_/g, '-'); // 10.5594_J10870 -> 10.5594-J10870
}

// --- doc assembly -----------------------------------------------------------

// NLM journal pub-dates routinely lack a day (and sometimes a month). Pad to a
// schema-valid YYYY-MM-DD; record the approximation via confidence.
function normalizePubDate(raw) {
  if (!raw) return { date: null, confidence: null, note: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date: raw, confidence: 'high', note: null };
  if (/^\d{4}-\d{2}$/.test(raw)) {
    return { date: `${raw}-01`, confidence: 'high', note: 'Day absent in NLM source — padded to 01' };
  }
  if (/^\d{4}$/.test(raw)) {
    return { date: `${raw}-01-01`, confidence: 'low', note: 'Month/day absent in NLM source — padded to 01-01' };
  }
  return { date: null, confidence: null, note: null };
}

function monthYearLabel(raw) {
  if (!raw) return null;
  const ym = raw.match(/^(\d{4})-(\d{2})/);
  if (ym) {
    const mn = MONTHS[parseInt(ym[2], 10)] || '';
    return mn ? `${mn} ${ym[1]}` : ym[1];
  }
  const y = raw.match(/^(\d{4})$/);
  return y ? y[1] : null;
}

function composeDocLabel(p, corpus) {
  const my = monthYearLabel(p.publicationDateRaw);
  if (corpus.prefix === 'M') {
    // Conference: <volume> is just the year — redundant with the date — so the
    // label is the venue title + month/year only.
    const venue = p.journalTitle || 'SMPTE Meetings and Conferences';
    return my ? `${venue} ( ${my})` : venue;
  }
  const journal = p.journalTitle || 'SMPTE Journal';
  const bits = [];
  if (p.volume) bits.push(`Volume: ${p.volume}`);
  if (p.issue) bits.push(`Issue: ${p.issue}`);
  if (my) bits.push(my);
  return bits.length ? `${journal} ( ${bits.join(', ')})` : journal;
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

// Build a registry doc from a parsed NLM article. `corpus` decides docType and
// the $meta `version` tag; `relPath` is the source file path recorded in
// $meta.note for provenance / future re-extraction.
function buildDoc(p, docId, relPath, corpus) {
  const parsedNote = `Parsed from NLM article XML (${relPath})`;
  const meta = (source, confidence, note) => {
    const m = { source, confidence };
    if (note) m.note = note;
    m.updated = NOW;
    m.version = corpus.version;
    return m;
  };
  const doc = {};
  const set = (field, value, m) => {
    if (value === null || value === undefined || value === '') return;
    doc[field] = value;
    doc[`${field}$meta`] = m;
  };

  // identity (required: docId, docLabel, docTitle, docType, publisher, status)
  set('docId', docId, meta('parsed', 'high', `Derived from DOI ${p.doi}`));
  set('doi', p.doi, meta('parsed', 'high', parsedNote));
  set('docType', corpus.docType, meta('inferred', 'high', `NLM <article> — SMPTE ${corpus.label}`));
  set('publisher', 'SMPTE', meta('inferred', 'high',
    `Normalised to registry "SMPTE" convention from NLM publisher-name (${p.publisherName || 'n/a'})`));
  set('docTitle', p.docTitle, meta('parsed', 'high', parsedNote));
  set('docLabel', composeDocLabel(p, corpus), meta('inferred', 'medium', 'Composed from venue title, volume/issue and date'));
  set('href', `https://doi.org/${p.doi}`, meta('inferred', 'high', `Constructed from DOI ${p.doi}`));

  // publication date — padded; year drives the registry year-shard
  const pd = normalizePubDate(p.publicationDateRaw);
  if (pd.date) set('publicationDate', pd.date, meta('parsed', pd.confidence, pd.note || parsedNote));

  // bibliographic detail
  set('authors', p.authors, meta('parsed', 'high', parsedNote));
  set('pages', p.pages, meta('parsed', 'high', parsedNote));
  set('volume', p.volume, meta('parsed', 'high', parsedNote));
  set('number', p.issue, meta('parsed', 'high', parsedNote));
  set('abstract', p.abstract, meta('parsed', 'high', parsedNote));
  set('abbrevTitle', p.abbrevTitle, meta('parsed', 'high', parsedNote));
  set('articleType', p.articleType, meta('parsed', 'high', parsedNote));

  if (p.issn) {
    const issn = {};
    if (p.issn.print) { issn.print = p.issn.print; issn.print$meta = meta('parsed', 'high', parsedNote); }
    if (p.issn.electronic) { issn.electronic = p.issn.electronic; issn.electronic$meta = meta('parsed', 'high', parsedNote); }
    doc.issn = issn;
    doc.issn$meta = meta('parsed', 'high', parsedNote);
  }
  if (p.copyright) {
    const c = {};
    if (p.copyright.holder) { c.holder = p.copyright.holder; c.holder$meta = meta('parsed', 'high', parsedNote); }
    if (p.copyright.year) { c.year = p.copyright.year; c.year$meta = meta('parsed', 'high', parsedNote); }
    doc.copyright = c;
    doc.copyright$meta = meta('parsed', 'high', parsedNote);
  }
  if (p.publisherLoc) {
    // NLM <publisher-loc> is a single free-text string — kept as `city`.
    doc.publisherLocation = { city: p.publisherLoc, city$meta: meta('parsed', 'high', parsedNote) };
    doc.publisherLocation$meta = meta('parsed', 'high', parsedNote);
  }

  // status — NLM carries no explicit status; published articles default active
  doc.status = {
    active: true,
    active$meta: meta('inferred', 'medium', `No explicit status in NLM source — ${corpus.label}s default active`),
  };

  return sortKeysDeep(doc);
}

// --- main -------------------------------------------------------------------
function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source tree not found: ${SOURCE}`);
    process.exit(1);
  }

  console.log(`Scanning ${path.relative(REPO_ROOT, SOURCE)} for NLM XML `
    + `(${SELECTED.map((c) => c.label).join(' + ')})…`);
  const files = walkXml(SOURCE, []);

  // Collapse duplicate copies by provisional docId (first path wins).
  const byDocId = new Map();
  let dupeCopies = 0;
  for (const f of files.sort()) {
    const id = provisionalDocId(f);
    if (byDocId.has(id)) { dupeCopies++; continue; }
    byDocId.set(id, f);
  }

  const existing = new Set(loadAllDocs().map((d) => d.docId));
  const candidates = [...byDocId.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const targets = candidates.filter(([id]) => !existing.has(id));
  const slice = targets.slice(0, LIMIT === Infinity ? targets.length : LIMIT);

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validateDoc = ajv.compile(loadJson(SCHEMA).items);

  const written = [];
  const invalid = [];
  const parseErrors = [];
  const docIdMismatch = [];
  const byYear = {};
  const byArticleType = {};
  const byCorpus = {};
  let sampleDoc = null; // first built+valid doc, kept whole for review

  for (const [provId, file] of slice) {
    const rel = path.relative(REPO_ROOT, file);
    const parsed = readNlmArticleXml(file);
    if (!parsed) { parseErrors.push({ file: rel, reason: 'not an NLM article / no front-matter / no DOI' }); continue; }

    const docId = doiToDocId(parsed.doi);
    if (!docId) { parseErrors.push({ file: rel, reason: `DOI ${parsed.doi} did not yield a docId` }); continue; }
    const corpus = corpusForDocId(docId);
    if (!corpus) { parseErrors.push({ file: rel, reason: `docId ${docId} has no recognised J/M prefix` }); continue; }
    if (docId !== provId) docIdMismatch.push({ file: rel, filenameDocId: provId, xmlDocId: docId });
    // re-check against registry using the authoritative XML-derived docId
    if (existing.has(docId)) { continue; }

    const doc = buildDoc(parsed, docId, rel, corpus);
    const ok = validateDoc(doc);
    if (!ok) {
      invalid.push({
        docId,
        file: rel,
        errors: (validateDoc.errors || []).slice(0, 6)
          .map((e) => `${e.dataPath || e.instancePath || '/'} ${e.message}`),
      });
      continue;
    }

    if (!sampleDoc) sampleDoc = doc;
    const year = (doc.publicationDate || '').slice(0, 4) || '_undated';
    byYear[year] = (byYear[year] || 0) + 1;
    const at = doc.articleType || '(none)';
    byArticleType[at] = (byArticleType[at] || 0) + 1;
    byCorpus[corpus.docType] = (byCorpus[corpus.docType] || 0) + 1;

    let target = path.join('src', 'main', 'data', 'docs', docPath(doc));
    if (APPLY) {
      const res = saveDoc(doc);
      target = path.relative(REPO_ROOT, res.path);
      existing.add(docId);
    }
    written.push({
      docId, docType: doc.docType, docTitle: doc.docTitle,
      publicationDate: doc.publicationDate || null, path: target,
    });
  }

  const remainingAfter = Math.max(0, targets.length - slice.length);

  // --- console summary ---
  console.log('\n=== SMPTE NLM article extraction ===\n');
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}   corpora: `
    + SELECTED.map((c) => `${c.docType} [${c.version}]`).join(', '));
  console.log(`Source files matched: ${files.length} (${dupeCopies} duplicate copies collapsed)`);
  console.log(`Unique articles in source: ${byDocId.size}`);
  console.log(`Already in registry (skipped): ${byDocId.size - targets.length}`);
  console.log(`Target articles (not in registry): ${targets.length}`);
  console.log(`Batch: first ${LIMIT === Infinity ? 'all' : LIMIT} → ${slice.length} processed`);
  if (slice.length) console.log(`  docId range: ${slice[0][0]} … ${slice[slice.length - 1][0]}`);
  console.log(`  targets remaining after this batch: ${remainingAfter}`);
  console.log('');
  console.log(`${APPLY ? 'Written' : 'Would write'}:        ${written.length}`);
  console.log(`Schema-invalid (skipped): ${invalid.length}`);
  console.log(`Parse errors (skipped):   ${parseErrors.length}`);
  console.log(`DOI/filename mismatches:  ${docIdMismatch.length}`);

  if (invalid.length) {
    console.log('\n-- Sample schema-invalid --');
    for (const v of invalid.slice(0, 5)) {
      console.log(`  ${v.docId} (${v.file})`);
      for (const e of v.errors) console.log(`    - ${e}`);
    }
  }
  console.log('\n-- Sample docs --');
  for (const w of written.slice(0, 12)) {
    console.log(`  ${w.docId}  ${w.publicationDate || '(undated)'}  ${String(w.docTitle || '').slice(0, 64)}`);
  }
  if (sampleDoc) {
    console.log(`\n-- Full sample doc (${sampleDoc.docId}) — would write to src/main/data/docs/${docPath(sampleDoc)} --`);
    console.log(JSON.stringify(sampleDoc, null, 2));
  }

  // --- report files ---
  const reportJson = {
    generatedAt: NOW,
    mode: APPLY ? 'apply' : 'dry-run',
    corpora: SELECTED.map((c) => ({ docType: c.docType, version: c.version })),
    source: path.relative(REPO_ROOT, SOURCE),
    totals: {
      sourceFilesMatched: files.length,
      duplicateCopiesCollapsed: dupeCopies,
      uniqueArticles: byDocId.size,
      alreadyInRegistry: byDocId.size - targets.length,
      targets: targets.length,
      batchProcessed: slice.length,
      written: written.length,
      schemaInvalid: invalid.length,
      parseErrors: parseErrors.length,
      docIdMismatches: docIdMismatch.length,
      remainingAfterBatch: remainingAfter,
    },
    byCorpus,
    byYear,
    byArticleType,
    sampleDoc,
    written,
    schemaInvalid: invalid,
    parseErrors,
    docIdMismatch,
  };
  fs.writeFileSync(REPORT_JSON, JSON.stringify(reportJson, null, 2) + '\n');

  const md = [];
  md.push(`# SMPTE NLM Article Import — ${NOW}`);
  md.push('');
  md.push(`Mode: **${APPLY ? 'APPLY' : 'DRY-RUN'}** · source \`${reportJson.source}\``);
  md.push(`Corpora: ${SELECTED.map((c) => `${c.docType} (\`${c.version}\`)`).join(', ')}`);
  md.push('');
  md.push('## Totals');
  for (const [k, v] of Object.entries(reportJson.totals)) md.push(`- ${k}: ${v}`);
  md.push('');
  md.push('## By corpus');
  for (const c of Object.keys(byCorpus).sort()) md.push(`- ${c}: ${byCorpus[c]}`);
  md.push('');
  md.push('## By year');
  for (const y of Object.keys(byYear).sort()) md.push(`- ${y}: ${byYear[y]}`);
  md.push('');
  md.push('## By articleType');
  for (const a of Object.keys(byArticleType).sort()) md.push(`- ${a}: ${byArticleType[a]}`);
  md.push('');
  md.push(`## Written (${written.length}${written.length > 30 ? ' — first 30' : ''})`);
  for (const w of written.slice(0, 30)) md.push(`- \`${w.docId}\` ${w.publicationDate || '(undated)'} — ${w.docTitle || ''}`);
  if (invalid.length) {
    md.push('');
    md.push(`## Schema-invalid (${invalid.length})`);
    for (const v of invalid.slice(0, 30)) md.push(`- \`${v.docId}\` (${v.file}): ${v.errors.join('; ')}`);
  }
  if (parseErrors.length) {
    md.push('');
    md.push(`## Parse errors (${parseErrors.length}${parseErrors.length > 30 ? ' — first 30' : ''})`);
    for (const e of parseErrors.slice(0, 30)) md.push(`- ${e.file}: ${e.reason}`);
  }
  fs.writeFileSync(REPORT_MD, md.join('\n') + '\n');

  console.log(`\nWrote ${path.relative(REPO_ROOT, REPORT_JSON)} and ${path.relative(REPO_ROOT, REPORT_MD)}.`);
  if (APPLY) {
    console.log(`\nApplied ${written.length} new per-doc files under src/main/data/docs/smpte/.`);
    console.log('Reminder: run `npm run canonicalize` and `npm run validate`, commit this batch,');
    console.log(remainingAfter > 0
      ? `then re-run the SAME command — ${remainingAfter} targets still to import.`
      : 'All targets imported. Done.');
  } else {
    console.log('\nDry run — no files written. Pass --apply to write.');
  }
}

main();
