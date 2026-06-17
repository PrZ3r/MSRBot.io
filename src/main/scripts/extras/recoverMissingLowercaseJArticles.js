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

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
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

// One-time recovery for 9 NLM lowercase-j journal articles that the original
// `extractSmpteJournalArticles.js` missed:
//
// - 1 article (j18404) has a per-article XML named `10.5594_J18404.xml`
//   (uppercase J in filename) — the extractor's filename-based dedup
//   collapsed it against the existing uppercase-J registry doc.
//
// - 8 articles (j18421, j18437, j18459, j18476, j18491, j18503, j18506,
//   j18522) live in SICI-named NLM XML files (`i1545-0279-*.xml`) that the
//   extractor's file-name regex (`10.5594_J#####.xml`) skips entirely.
//
// Strategy: grep _source/SMPTE/HIGHWIRE/ for the exact `<article-id>` matches,
// parse each containing XML via the central `readNlmArticleXml` helper, build
// the doc record with the same `buildDoc` logic used by the main extractor.
//
// Dry-run by default; --apply writes.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const Ajv = require('ajv');
const { saveDoc } = require('../../lib/registry');
const { readNlmArticleXml } = require('../utils/extractSourceMetadata');
const { doiToDocId } = require('../utils/parseSourceName');

const APPLY = process.argv.includes('--apply');
const SCHEMA = path.join('src', 'main', 'schemas', 'documents.schema.json');
const SOURCE = path.join('_source', 'SMPTE', 'HIGHWIRE');
const VERSION = 'smpte-journal-article-nlm@v1';
const NOW = new Date().toISOString();

const TARGETS = [
  'j18404', 'j18421', 'j18437', 'j18459', 'j18476',
  'j18491', 'j18503', 'j18506', 'j18522',
];

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// Single walk of the source tree, building a DOI→file map in one pass.
function walkXml(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkXml(full, out);
    else if (e.isFile() && /\.xml$/i.test(e.name)) out.push(full);
  }
  return out;
}
function buildDoiFileMap(targetDois) {
  const map = new Map();
  const allFiles = walkXml(SOURCE, []);
  const needle = new RegExp(
    `<article-id pub-id-type="doi">10\\.5594/(${targetDois.join('|')})</article-id>`,
  );
  for (const f of allFiles) {
    if (map.size === targetDois.length) break;
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const m = text.match(needle);
    if (m && !map.has(m[1])) map.set(m[1], f);
  }
  return map;
}

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

function composeDocLabel(p) {
  const venue = p.fullJournalTitle || p.abbrevTitle || 'SMPTE Motion Imaging Journal';
  const bits = [];
  if (p.volume) bits.push(`Volume: ${p.volume}`);
  if (p.issue) bits.push(`Issue: ${p.issue}`);
  if (p.publicationDateRaw) {
    const dt = p.publicationDateRaw;
    const ym = dt.match(/^(\d{4})-(\d{2})/);
    if (ym) {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      bits.push(`${months[parseInt(ym[2],10)-1]} ${ym[1]}`);
    } else if (/^\d{4}$/.test(dt)) {
      bits.push(dt);
    }
  }
  return `${venue} ( ${bits.join(', ')})`;
}

function buildDoc(p, docId, relPath) {
  const parsedNote = `Parsed from NLM article XML (${relPath})`;
  const meta = (source, confidence, note) => {
    const m = { source, confidence };
    if (note) m.note = note;
    m.updated = NOW;
    m.version = VERSION;
    return m;
  };
  const doc = {};
  const set = (field, value, m) => {
    if (value === null || value === undefined || value === '') return;
    doc[field] = value;
    doc[`${field}$meta`] = m;
  };

  set('docId', docId, meta('parsed', 'high', `Derived from DOI ${p.doi}`));
  set('doi', p.doi, meta('parsed', 'high', parsedNote));
  set('docType', 'Journal Article', meta('inferred', 'high', 'NLM <article> — SMPTE Journal Article'));
  set('publisher', 'SMPTE', meta('inferred', 'high',
    `Normalised to registry "SMPTE" convention from NLM publisher-name (${p.publisherName || 'n/a'})`));
  set('docTitle', p.docTitle, meta('parsed', 'high', parsedNote));
  set('docLabel', composeDocLabel(p), meta('inferred', 'medium', 'Composed from venue title, volume/issue and date'));
  set('href', `https://doi.org/${p.doi}`, meta('inferred', 'high', `Constructed from DOI ${p.doi}`));

  const pd = normalizePubDate(p.publicationDateRaw);
  if (pd.date) set('publicationDate', pd.date, meta('parsed', pd.confidence, pd.note || parsedNote));

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
    doc.publisherLocation = { city: p.publisherLoc, city$meta: meta('parsed', 'high', parsedNote) };
    doc.publisherLocation$meta = meta('parsed', 'high', parsedNote);
  }
  doc.status = {
    active: true,
    active$meta: meta('inferred', 'medium', 'No explicit status in NLM source — journal articles default active'),
  };
  return doc;
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(loadJson(SCHEMA).items);

const results = { built: 0, skippedFound: 0, parseFail: [], schemaFail: [], notFound: [] };
const sample = [];

console.log(`Scanning ${SOURCE} once for ${TARGETS.length} target DOIs ...`);
const doiToFile = buildDoiFileMap(TARGETS);
console.log(`Found XML files for ${doiToFile.size}/${TARGETS.length} targets.\n`);

for (const suffix of TARGETS) {
  const doi = `10.5594/${suffix}`;
  const f = doiToFile.get(suffix);
  if (!f) { results.notFound.push(doi); continue; }
  let parsed;
  try { parsed = readNlmArticleXml(f); }
  catch (e) { results.parseFail.push({ doi, file: f, error: e.message }); continue; }
  if (!parsed || !parsed.doi) { results.parseFail.push({ doi, file: f, error: 'no doi parsed' }); continue; }
  const docId = doiToDocId(parsed.doi);
  if (!docId) { results.parseFail.push({ doi, file: f, error: `doiToDocId(${parsed.doi}) returned null` }); continue; }
  const doc = buildDoc(parsed, docId, path.relative(REPO_ROOT, f));
  if (!validate(doc)) {
    results.schemaFail.push({ doi, docId, errors: (validate.errors || []).slice(0, 5)
      .map((e) => `${e.dataPath || e.instancePath || '/'} ${e.message}`) });
    continue;
  }
  if (sample.length < 3) sample.push({ docId, docTitle: doc.docTitle, publicationDate: doc.publicationDate });
  if (APPLY) saveDoc(doc);
  results.built += 1;
}

console.log(`Targets: ${TARGETS.length}`);
console.log(`  built:        ${results.built}${APPLY ? ' (written)' : ' (dry-run)'}`);
console.log(`  not found in source: ${results.notFound.length}  ${results.notFound.join(', ')}`);
console.log(`  parse fail:   ${results.parseFail.length}`);
for (const e of results.parseFail) console.log(`    ${e.doi} (${e.file}): ${e.error}`);
console.log(`  schema fail:  ${results.schemaFail.length}`);
for (const e of results.schemaFail) console.log(`    ${e.docId}: ${e.errors.join('; ')}`);

console.log('\nSample:');
for (const s of sample) console.log(`  ${s.docId} — ${JSON.stringify(s.docTitle).slice(0, 80)} (${s.publicationDate})`);
if (!APPLY) console.log('\nDry run — pass --apply to write.');
