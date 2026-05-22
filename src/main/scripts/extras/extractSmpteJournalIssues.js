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

// ONE-TIME SMPTE journal-issue XML backfill — coverage + cross-fill.
//
// _source/SMPTE/APTARA + ALLEN PRESS carry IEEE content_delivery 1.6 schema
// issue-metadata XML (`journal_metadata` root) — a different DTD from the
// HIGHWIRE NLM per-article XML the sibling extractSmpteJournalArticles.js
// handles. This format groups multiple articles under one issue header, so
// each article inherits journalSuite + issue fields from its parent block.
//
// APTARA covers ~22k unique J-DOIs against the registry's ~18k journal docs
// from the prior NLM pass — i.e. ~3.8k journal articles the NLM corpus never
// carried (mostly recent MIJR issues, vols ~120s, post-2010, since HIGHWIRE
// tops out ~2010). This script imports those new docs AND opportunistically
// cross-fills missing fields on overlap docs (authors, abstract, etc.).
//
// References are NOT extracted here — deferred. Keywords are NOT extracted
// either — APTARA major_topic/minor_topic are section labels ("Article",
// "News Column", "Smpte News and Department"), already covered by articleType.
//
// Cross-fill rule is universal: only-add-missing, never overwrite. Hand-curated
// values, NLM-parsed values, anything already present is left alone.
//
// CLI:
//   --apply             write changes (dry-run by default)
//   --limit N           cap the per-run docs touched
//   --source <dir>      override discovery root (single dir; default scans
//                       both APTARA and ALLEN PRESS trees)
//   --coverage-only     only create new docs; skip cross-fill
//   --crossfill-only    only cross-fill overlaps; skip new doc creation
//
// Resumable: each run recomputes targets. Landed coverage docs drop out of the
// "new" target list; cross-fill candidates drop out as their fields fill in.
// Re-run the same command until "targets remaining" reaches 0.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { readIssueMetadataXml } = require('../utils/extractSourceMetadata');
const { doiToDocId } = require('../utils/parseSourceName');
const { loadAllDocs, loadDoc, saveDoc, docPath } = require('../../lib/registry');

const SCHEMA = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const REPORT_JSON = path.join(REPO_ROOT, 'src', 'main', 'reports', 'smpteJournalIssueImport.json');
const REPORT_MD = path.join(REPO_ROOT, 'src', 'main', 'reports', 'smpteJournalIssueImport.md');

// Default discovery roots — APTARA (METADATA + DL Project Files) and ALLEN PRESS.
// Both ship the same `journal_metadata` XML format; readIssueMetadataXml returns
// null for any file that isn't this format, so over-walking is harmless.
const DEFAULT_SOURCES = [
  path.join(REPO_ROOT, '_source', 'SMPTE', 'APTARA'),
  path.join(REPO_ROOT, '_source', 'SMPTE', 'ALLEN PRESS'),
];

const CORPORA = {
  journal: {
    key: 'journal', prefix: 'J', docType: 'Journal Article',
    version: 'smpte-journal-issue-xml@v1', label: 'journal paper',
  },
  conference: {
    key: 'conference', prefix: 'M', docType: 'Conference Paper',
    version: 'smpte-conference-issue-xml@v1', label: 'conference paper',
  },
};

const NOW = new Date().toISOString();
const APPLY = process.argv.includes('--apply');
const COVERAGE_ONLY = process.argv.includes('--coverage-only');
const CROSSFILL_ONLY = process.argv.includes('--crossfill-only');
if (COVERAGE_ONLY && CROSSFILL_ONLY) {
  console.error('Cannot combine --coverage-only and --crossfill-only');
  process.exit(1);
}

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
const SOURCE_OVERRIDE = argStr('--source', null);
const SOURCES = SOURCE_OVERRIDE ? [path.resolve(SOURCE_OVERRIDE)] : DEFAULT_SOURCES;

function corpusForDocId(docId) {
  const m = String(docId || '').match(/^10\.5594-([A-Za-z])/);
  if (!m) return null;
  return Object.values(CORPORA).find((c) => c.prefix === m[1].toUpperCase()) || null;
}

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// --- discovery --------------------------------------------------------------
// Walk source roots; accept .xml files that aren't -ref sidecars and let the
// parser filter for journal_metadata format. Path bases with embedded sequence
// numbers like `-ref.1.xml` are also excluded.
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
    else if (e.isFile() && /\.xml$/i.test(e.name) && !/-ref(\.\d+)?\.xml$/i.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

// --- $meta + helpers --------------------------------------------------------
function makeMeta(versionTag, sourceFile) {
  const parsedNote = `Parsed from journal_metadata XML (${sourceFile})`;
  return (source, confidence, note) => {
    const m = { source, confidence };
    m.note = note || parsedNote;
    m.updated = NOW;
    m.version = versionTag;
    return m;
  };
}

function normalizePubDate(raw) {
  if (!raw) return { date: null, confidence: null, note: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date: raw, confidence: 'high', note: null };
  if (/^\d{4}-\d{2}$/.test(raw)) {
    return { date: `${raw}-01`, confidence: 'high', note: 'Day absent in source — padded to 01' };
  }
  if (/^\d{4}$/.test(raw)) {
    return { date: `${raw}-01-01`, confidence: 'low', note: 'Month/day absent in source — padded to 01-01' };
  }
  return { date: null, confidence: null, note: null };
}

function monthYearLabel(raw) {
  if (!raw) return null;
  const ym = raw.match(/^(\d{4})-(\d{2})/);
  if (ym) return (MONTHS[parseInt(ym[2], 10)] || '') + ' ' + ym[1];
  const y = raw.match(/^(\d{4})$/);
  return y ? y[1] : null;
}

function composeDocLabel(article, suite, vol, num, pubRaw, corpus) {
  const title = suite.fullTitle || (corpus.prefix === 'M' ? 'SMPTE Meetings and Conferences' : 'SMPTE Journal');
  const my = monthYearLabel(pubRaw);
  if (corpus.prefix === 'M') return my ? `${title} ( ${my})` : title;
  const bits = [];
  if (vol) bits.push(`Volume: ${vol}`);
  if (num) bits.push(`Issue: ${num}`);
  if (my) bits.push(my);
  return bits.length ? `${title} ( ${bits.join(', ')})` : title;
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

// --- per-article extraction -------------------------------------------------
// Flatten one issue-file's parse result into per-article candidate records.
// Each candidate carries the article fields PLUS the inherited journal/issue
// context — that's the unit downstream code works with.
function flattenIssue(parsed, sourceFile) {
  const out = [];
  if (!parsed || !parsed.articles) return out;
  const suite = parsed.journalSuite || {};
  const vol = parsed.issueVolume || null;
  const num = parsed.issueNumber || null;
  const pubRaw = parsed.issuePublicationDate || null;
  for (const [file, art] of parsed.articles) {
    if (!art || !art.doi) continue;
    out.push({
      file,
      doi: art.doi,
      docTitle: art.docTitle,
      authors: art.authors,
      pages: art.pages,
      abstract: art.abstract,
      articleType: art.articleType,
      articleStatus: art.articleStatus,
      suite,
      volume: vol,
      issue: num,
      publicationDateRaw: pubRaw,
      sourceFile,
    });
  }
  return out;
}

// Build the full extracted-field object for one article. Used both for new-doc
// creation (full doc) and for cross-fill (we read the SAME shape and copy only
// missing fields onto the existing doc).
function buildExtracted(art, docId, corpus) {
  const mk = makeMeta(corpus.version, art.sourceFile);
  const pd = normalizePubDate(art.publicationDateRaw);
  const extracted = {};
  const suite = art.suite || {};

  // identity / required
  extracted.docId = { value: docId, meta: mk('parsed', 'high', `Derived from DOI ${art.doi}`) };
  extracted.doi = { value: art.doi, meta: mk('parsed', 'high') };
  extracted.docType = { value: corpus.docType, meta: mk('inferred', 'high', `journal_metadata XML — SMPTE ${corpus.label}`) };
  extracted.publisher = { value: 'SMPTE', meta: mk('inferred', 'high',
    `Normalised to registry "SMPTE" convention from publisher-name (${suite.publisher || 'n/a'})`) };
  extracted.docTitle = { value: art.docTitle || null, meta: mk('parsed', 'high') };
  extracted.docLabel = {
    value: composeDocLabel(art, suite, art.volume, art.issue, art.publicationDateRaw, corpus),
    meta: mk('inferred', 'medium', 'Composed from journal title, volume, issue and date'),
  };
  extracted.href = { value: `https://doi.org/${art.doi}`, meta: mk('inferred', 'high', `Constructed from DOI ${art.doi}`) };

  if (pd.date) extracted.publicationDate = { value: pd.date, meta: mk('parsed', pd.confidence, pd.note) };

  // bibliographic
  if (art.authors && art.authors.length) extracted.authors = { value: art.authors, meta: mk('parsed', 'high') };
  if (art.pages) extracted.pages = { value: art.pages, meta: mk('parsed', 'high') };
  if (art.volume) extracted.volume = { value: art.volume, meta: mk('parsed', 'high') };
  if (art.issue) extracted.number = { value: art.issue, meta: mk('parsed', 'high') };
  if (art.abstract) extracted.abstract = { value: art.abstract, meta: mk('parsed', 'high') };
  if (art.articleType) extracted.articleType = { value: art.articleType, meta: mk('parsed', 'high') };

  // journal-suite fields
  if (suite.abbrevTitle) extracted.abbrevTitle = { value: suite.abbrevTitle, meta: mk('parsed', 'high') };
  if (suite.journalAcronym) extracted.journalAcronym = { value: suite.journalAcronym, meta: mk('parsed', 'high') };

  if (suite.issn && (suite.issn.print || suite.issn.electronic)) {
    const issn = {};
    const m = mk('parsed', 'high');
    if (suite.issn.print) { issn.print = suite.issn.print; issn.print$meta = m; }
    if (suite.issn.electronic) { issn.electronic = suite.issn.electronic; issn.electronic$meta = m; }
    extracted.issn = { value: issn, meta: m, isNested: true };
  }
  if (suite.copyright && (suite.copyright.holder || suite.copyright.year)) {
    const c = {};
    const m = mk('parsed', 'high');
    if (suite.copyright.holder) { c.holder = suite.copyright.holder; c.holder$meta = m; }
    if (suite.copyright.year) { c.year = suite.copyright.year; c.year$meta = m; }
    extracted.copyright = { value: c, meta: m, isNested: true };
  }
  if (suite.publisherLocation && (suite.publisherLocation.city || suite.publisherLocation.country)) {
    const pl = {};
    const m = mk('parsed', 'high');
    if (suite.publisherLocation.city) { pl.city = suite.publisherLocation.city; pl.city$meta = m; }
    if (suite.publisherLocation.country) { pl.country = suite.publisherLocation.country; pl.country$meta = m; }
    extracted.publisherLocation = { value: pl, meta: m, isNested: true };
  }

  return extracted;
}

// Compose the full new-doc object from extracted fields. status is added here
// (container field — no top-level $meta, just status.active$meta).
function buildDoc(extracted, art, corpus) {
  const mk = makeMeta(corpus.version, art.sourceFile);
  const doc = {};
  for (const [field, e] of Object.entries(extracted)) {
    doc[field] = e.value;
    doc[`${field}$meta`] = e.meta;
  }
  // articleStatus — APTARA carries 'active' / 'inactive'; default true.
  const active = !art.articleStatus || /^active$/i.test(String(art.articleStatus));
  doc.status = {
    active,
    active$meta: mk('parsed', art.articleStatus ? 'high' : 'medium',
      art.articleStatus
        ? `Mapped from article_status="${art.articleStatus}"`
        : `No explicit article_status — ${corpus.label}s default active`),
  };
  return sortKeysDeep(doc);
}

// Test "field is empty" for cross-fill — covers undefined, null, '', [], {}.
function isEmpty(v) {
  if (v === undefined || v === null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

// Cross-fill only-add-missing onto an existing doc. Returns {addedFields[],
// addedSubFields[]}. NEVER overwrites a value that is already present.
function crossFill(existing, extracted) {
  const addedFields = [];
  const addedSubFields = []; // for nested objects' sub-fields
  for (const [field, e] of Object.entries(extracted)) {
    // identity / always-present fields — skip cross-fill (docId, doi, docType,
    // publisher, docTitle, docLabel, href, publicationDate). These either come
    // from the existing doc's own creation or shouldn't be overridden by APTARA.
    if (['docId', 'doi', 'docType', 'publisher', 'docTitle', 'docLabel', 'href',
         'publicationDate'].includes(field)) continue;

    if (e.isNested) {
      // Nested container (issn/copyright/publisherLocation): if absent entirely,
      // add the whole block. If partially present, fill in missing sub-fields.
      if (isEmpty(existing[field])) {
        existing[field] = e.value;
        existing[`${field}$meta`] = e.meta;
        addedFields.push(field);
      } else {
        for (const subKey of Object.keys(e.value)) {
          if (subKey.endsWith('$meta')) continue;
          if (isEmpty(existing[field][subKey])) {
            existing[field][subKey] = e.value[subKey];
            existing[field][`${subKey}$meta`] = e.value[`${subKey}$meta`];
            addedSubFields.push(`${field}.${subKey}`);
          }
        }
      }
    } else if (isEmpty(existing[field])) {
      existing[field] = e.value;
      existing[`${field}$meta`] = e.meta;
      addedFields.push(field);
    }
  }
  return { addedFields, addedSubFields };
}

// --- main -------------------------------------------------------------------
function main() {
  for (const s of SOURCES) {
    if (!fs.existsSync(s)) {
      console.error(`Source tree not found: ${s}`);
      process.exit(1);
    }
  }

  console.log(`Scanning ${SOURCES.length} source root(s) for journal_metadata XML…`);
  const files = [];
  for (const s of SOURCES) walkXml(s, files);
  console.log(`  ${files.length} candidate .xml files (non-ref)`);

  // Parse each file; flatten to per-article candidates; dedup by docId (first wins).
  const byDocId = new Map(); // docId -> article record (first occurrence wins)
  let issuesParsed = 0;
  let parseSkipped = 0;
  let articlesSeen = 0;
  let dupArticles = 0;
  for (const f of files.sort()) {
    let parsed;
    try { parsed = readIssueMetadataXml(f); }
    catch { parseSkipped++; continue; }
    if (!parsed) { parseSkipped++; continue; }
    issuesParsed++;
    const rel = path.relative(REPO_ROOT, f);
    for (const art of flattenIssue(parsed, rel)) {
      articlesSeen++;
      const docId = doiToDocId(art.doi);
      if (!docId) continue;
      if (byDocId.has(docId)) { dupArticles++; continue; }
      byDocId.set(docId, { ...art, docId });
    }
  }
  console.log(`  ${issuesParsed} issue files parsed (${parseSkipped} non-journal_metadata files skipped)`);
  console.log(`  ${articlesSeen} article records → ${byDocId.size} unique docIds (${dupArticles} dup-article entries collapsed)`);

  const existing = new Map(loadAllDocs().map((d) => [d.docId, d]));

  // Classify each unique article: coverage (new) vs cross-fill (overlap).
  const coverageTargets = [];
  const crossfillTargets = [];
  for (const [docId, art] of [...byDocId.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (existing.has(docId)) crossfillTargets.push([docId, art]);
    else coverageTargets.push([docId, art]);
  }
  console.log(`  classification: ${coverageTargets.length} coverage (new), ${crossfillTargets.length} potential cross-fill`);

  // Build the combined work list per CLI flags, sliced by --limit.
  const workList = [];
  if (!CROSSFILL_ONLY) for (const t of coverageTargets) workList.push({ kind: 'coverage', t });
  if (!COVERAGE_ONLY) for (const t of crossfillTargets) workList.push({ kind: 'crossfill', t });
  // Coverage first then cross-fill within --limit (new docs are the heavier value).
  const slice = workList.slice(0, LIMIT === Infinity ? workList.length : LIMIT);

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validateDoc = ajv.compile(loadJson(SCHEMA).items);

  const created = [];
  const crossfilled = [];
  const crossfillNoChange = [];
  const invalid = [];
  const errors = [];
  const byCorpus = {};
  const byYear = {};
  const byArticleType = {};
  const fieldsAddedTally = {};
  let sampleDoc = null;
  let sampleCrossfill = null;

  for (const { kind, t } of slice) {
    const [docId, art] = t;
    const corpus = corpusForDocId(docId);
    if (!corpus) { errors.push({ docId, reason: `docId ${docId} has no recognised J/M prefix` }); continue; }

    const extracted = buildExtracted(art, docId, corpus);

    if (kind === 'coverage') {
      const doc = buildDoc(extracted, art, corpus);
      const ok = validateDoc(doc);
      if (!ok) {
        invalid.push({
          docId, file: art.sourceFile,
          errors: (validateDoc.errors || []).slice(0, 6)
            .map((e) => `${e.dataPath || e.instancePath || '/'} ${e.message}`),
        });
        continue;
      }
      const yr = (doc.publicationDate || '').slice(0, 4) || '_undated';
      byYear[yr] = (byYear[yr] || 0) + 1;
      byCorpus[corpus.docType] = (byCorpus[corpus.docType] || 0) + 1;
      const at = doc.articleType || '(none)';
      byArticleType[at] = (byArticleType[at] || 0) + 1;
      if (!sampleDoc) sampleDoc = doc;
      let target = path.join('src', 'main', 'data', 'docs', docPath(doc));
      if (APPLY) {
        const res = saveDoc(doc);
        target = path.relative(REPO_ROOT, res.path);
        existing.set(docId, doc); // dedup follow-up runs
      }
      created.push({ docId, docType: doc.docType, docTitle: doc.docTitle, publicationDate: doc.publicationDate || null, path: target });
    } else {
      // cross-fill: read the LIVE doc each time (don't reuse the cached one — a
      // prior cross-fill in the same chunk could have mutated it on disk).
      const live = APPLY ? loadDoc(docId) : existing.get(docId);
      if (!live) { errors.push({ docId, reason: 'overlap doc disappeared between dedup and cross-fill' }); continue; }
      const { addedFields, addedSubFields } = crossFill(live, extracted);
      if (addedFields.length === 0 && addedSubFields.length === 0) {
        crossfillNoChange.push(docId);
        continue;
      }
      // Re-validate after mutating; on failure skip saveDoc (in-memory mutation
      // doesn't reach disk unless APPLY + saveDoc runs).
      if (!validateDoc(live)) {
        invalid.push({
          docId, file: art.sourceFile,
          errors: (validateDoc.errors || []).slice(0, 6)
            .map((e) => `${e.dataPath || e.instancePath || '/'} ${e.message}`),
          context: `cross-fill added [${[...addedFields, ...addedSubFields].join(', ')}]`,
        });
        continue;
      }
      for (const f of addedFields) fieldsAddedTally[f] = (fieldsAddedTally[f] || 0) + 1;
      for (const f of addedSubFields) fieldsAddedTally[f] = (fieldsAddedTally[f] || 0) + 1;
      let target = path.join('src', 'main', 'data', 'docs', docPath(live));
      if (APPLY) {
        const res = saveDoc(sortKeysDeep(live));
        target = path.relative(REPO_ROOT, res.path);
      }
      if (!sampleCrossfill) sampleCrossfill = { docId, addedFields, addedSubFields, path: target };
      crossfilled.push({ docId, addedFields, addedSubFields, path: target });
    }
  }

  const totalProcessed = slice.length;
  const remainingAfter = Math.max(0, workList.length - slice.length);

  // --- console summary ---
  console.log('\n=== SMPTE journal-issue XML extraction ===\n');
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}   versions: ${Object.values(CORPORA).map((c) => `${c.docType} [${c.version}]`).join(', ')}`);
  console.log(`Scope: ${COVERAGE_ONLY ? 'coverage only' : CROSSFILL_ONLY ? 'cross-fill only' : 'coverage + cross-fill'}`);
  console.log('');
  console.log(`Coverage targets (new docs):   ${coverageTargets.length}`);
  console.log(`Cross-fill candidates:         ${crossfillTargets.length}`);
  console.log(`Batch: first ${LIMIT === Infinity ? 'all' : LIMIT} → ${totalProcessed} processed   (remaining after: ${remainingAfter})`);
  console.log('');
  console.log(`${APPLY ? 'Created' : 'Would create'}:    ${created.length}`);
  console.log(`Cross-filled (≥1 field added): ${crossfilled.length}`);
  console.log(`Cross-fill no-change:          ${crossfillNoChange.length}`);
  console.log(`Schema-invalid:                ${invalid.length}`);
  console.log(`Errors:                        ${errors.length}`);

  if (Object.keys(fieldsAddedTally).length) {
    console.log('\n-- Cross-fill fields added --');
    for (const [f, n] of Object.entries(fieldsAddedTally).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${f}: ${n}`);
    }
  }

  if (invalid.length) {
    console.log('\n-- Sample schema-invalid --');
    for (const v of invalid.slice(0, 5)) {
      console.log(`  ${v.docId} (${v.file})`);
      for (const e of v.errors) console.log(`    - ${e}`);
    }
  }

  if (created.length) {
    console.log('\n-- Sample created --');
    for (const w of created.slice(0, 10)) {
      console.log(`  ${w.docId}  ${w.publicationDate || '(undated)'}  ${String(w.docTitle || '').slice(0, 60)}`);
    }
  }
  if (crossfilled.length) {
    console.log('\n-- Sample cross-filled --');
    for (const w of crossfilled.slice(0, 10)) {
      console.log(`  ${w.docId}: +[${[...w.addedFields, ...w.addedSubFields].join(', ')}]`);
    }
  }
  if (sampleDoc) {
    console.log(`\n-- Full sample new doc (${sampleDoc.docId}) — would write to src/main/data/docs/${docPath(sampleDoc)} --`);
    console.log(JSON.stringify(sampleDoc, null, 2));
  }

  // --- report files ---
  const reportJson = {
    generatedAt: NOW,
    mode: APPLY ? 'apply' : 'dry-run',
    scope: COVERAGE_ONLY ? 'coverage-only' : CROSSFILL_ONLY ? 'crossfill-only' : 'coverage+crossfill',
    corpora: Object.values(CORPORA).map((c) => ({ docType: c.docType, version: c.version })),
    sources: SOURCES.map((s) => path.relative(REPO_ROOT, s)),
    totals: {
      sourceFilesScanned: files.length,
      issueFilesParsed: issuesParsed,
      nonJournalMetadataFilesSkipped: parseSkipped,
      articleRecordsSeen: articlesSeen,
      duplicateArticleRecordsCollapsed: dupArticles,
      uniqueArticles: byDocId.size,
      coverageTargets: coverageTargets.length,
      crossfillCandidates: crossfillTargets.length,
      batchProcessed: totalProcessed,
      created: created.length,
      crossfilled: crossfilled.length,
      crossfillNoChange: crossfillNoChange.length,
      schemaInvalid: invalid.length,
      errors: errors.length,
      remainingAfterBatch: remainingAfter,
    },
    byCorpus, byYear, byArticleType,
    fieldsAddedTally,
    sampleDoc,
    sampleCrossfill,
    created,
    crossfilled,
    schemaInvalid: invalid,
    errors,
  };
  fs.writeFileSync(REPORT_JSON, JSON.stringify(reportJson, null, 2) + '\n');

  const md = [];
  md.push(`# SMPTE Journal-Issue XML Import — ${NOW}`);
  md.push('');
  md.push(`Mode: **${APPLY ? 'APPLY' : 'DRY-RUN'}** · scope: ${reportJson.scope}`);
  md.push(`Sources: ${reportJson.sources.map((s) => `\`${s}\``).join(', ')}`);
  md.push(`Versions: ${Object.values(CORPORA).map((c) => `${c.docType} (\`${c.version}\`)`).join(', ')}`);
  md.push('');
  md.push('## Totals');
  for (const [k, v] of Object.entries(reportJson.totals)) md.push(`- ${k}: ${v}`);
  md.push('');
  if (Object.keys(byCorpus).length) {
    md.push('## Created — by corpus');
    for (const c of Object.keys(byCorpus).sort()) md.push(`- ${c}: ${byCorpus[c]}`);
    md.push('');
  }
  if (Object.keys(byYear).length) {
    md.push('## Created — by year');
    for (const y of Object.keys(byYear).sort()) md.push(`- ${y}: ${byYear[y]}`);
    md.push('');
  }
  if (Object.keys(byArticleType).length) {
    md.push('## Created — by articleType');
    for (const a of Object.keys(byArticleType).sort()) md.push(`- ${a}: ${byArticleType[a]}`);
    md.push('');
  }
  if (Object.keys(fieldsAddedTally).length) {
    md.push('## Cross-fill — fields added');
    for (const [f, n] of Object.entries(fieldsAddedTally).sort((a, b) => b[1] - a[1])) md.push(`- ${f}: ${n}`);
    md.push('');
  }
  md.push(`## Created (${created.length}${created.length > 30 ? ' — first 30' : ''})`);
  for (const w of created.slice(0, 30)) md.push(`- \`${w.docId}\` ${w.publicationDate || '(undated)'} — ${w.docTitle || ''}`);
  md.push('');
  md.push(`## Cross-filled (${crossfilled.length}${crossfilled.length > 30 ? ' — first 30' : ''})`);
  for (const w of crossfilled.slice(0, 30)) md.push(`- \`${w.docId}\` +[${[...w.addedFields, ...w.addedSubFields].join(', ')}]`);
  if (invalid.length) {
    md.push('');
    md.push(`## Schema-invalid (${invalid.length})`);
    for (const v of invalid.slice(0, 30)) md.push(`- \`${v.docId}\` (${v.file}): ${v.errors.join('; ')}`);
  }
  if (errors.length) {
    md.push('');
    md.push(`## Errors (${errors.length})`);
    for (const e of errors.slice(0, 30)) md.push(`- \`${e.docId}\`: ${e.reason}`);
  }
  fs.writeFileSync(REPORT_MD, md.join('\n') + '\n');

  console.log(`\nWrote ${path.relative(REPO_ROOT, REPORT_JSON)} and ${path.relative(REPO_ROOT, REPORT_MD)}.`);
  if (APPLY) {
    console.log(`\nApplied: ${created.length} new + ${crossfilled.length} cross-filled = ${created.length + crossfilled.length} doc writes.`);
    console.log('Reminder: run `npm run canonicalize` and `npm run validate`, commit this batch,');
    console.log(remainingAfter > 0
      ? `then re-run the SAME command — ${remainingAfter} targets still to process.`
      : 'All targets processed. Done.');
  } else {
    console.log('\nDry run — no files written. Pass --apply to write.');
  }
}

main();
