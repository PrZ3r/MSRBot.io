/*
 * sourceFieldCensus.mjs — Deep _source field audit for the canonical repos.
 *
 * Walks EVERY XML file under _source/SMPTE/{Journal Article Repository,
 * Conference Repository} — all 3 shapes (<publication> IDAMS,
 * <content_batch>, <article> NLM) — enumerates every distinct element +
 * attribute path, tallies per-path occurrence counts, collects up to N
 * distinct sample text values per leaf path, and cross-references paths
 * against:
 *   1. our documents.schema.json field names
 *   2. SMPTE canonical Article/Issue/Volume/Periodical model
 *
 * Buckets each path into:
 *   ✅ mapped     — explicit known mapping OR schema property name matches
 *   🎯 canonical  — captured by SMPTE canonical model (required floor)
 *   ❓ candidate  — leaf-element name looks similar to a schema property
 *   🔴 unmapped   — nothing plausible
 *
 * Regex-based path tracker (no XML parser dep) so we can rip through
 * 26k files fast. Ignore comments, CDATA, DOCTYPE, xml decl.
 *
 * Output:
 *   src/main/reports/smpte-canonical-audit/sourceFieldCensus.md
 *   src/main/reports/smpte-canonical-audit/sourceFieldCensus.paths.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const REPORTS = 'src/main/reports/smpte-canonical-audit';
fs.mkdirSync(REPORTS, { recursive: true });

const SCHEMA_PATH = 'src/main/schemas/documents.schema.json';
const SOURCE_DIRS = [
  '_source/SMPTE/Journal Article Repository',
  '_source/SMPTE/Conference Repository',
];

const MAX_SAMPLES_PER_PATH = 5;
const MAX_SAMPLE_LEN = 120;

// ---- schema property collection ----------------------------------------
// Recursively walk documents.schema.json and gather every property name
// that could plausibly map to an element in _source. We ignore path shape
// entirely (schema is nested; source is flat); we only care whether the
// leaf name exists anywhere in the schema.
function collectSchemaProperties(schema) {
  const props = new Set();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.properties) for (const k of Object.keys(node.properties)) {
      props.add(k);
      visit(node.properties[k]);
    }
    if (node.items) visit(node.items);
    for (const alt of ['anyOf', 'oneOf', 'allOf']) {
      if (Array.isArray(node[alt])) for (const a of node[alt]) visit(a);
    }
  }
  visit(schema.items || schema);
  return props;
}
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const schemaProps = collectSchemaProperties(schema);
console.log(`[census] schema properties collected: ${schemaProps.size}`);

// ---- SMPTE canonical model fields (from Article/Issue/Volume/Periodical) --
// These are the required-floor fields; anything mapping to one of these
// should already be in the extractor path.
const SMPTE_CANONICAL_FIELDS = new Set([
  // Article
  'number', 'title', 'doi', 'abstract', 'pubDate', 'contentType', 'authors',
  'keywords', 'mainPath', 'isOpenAccess',
  // Author
  'name',
  // PubDate
  'year', 'month', 'day',
  // Issue
  'identifier', 'date',
  // Volume
  // (number, year — already listed)
  // Periodical
  'pISSN', 'eISSN', 'volumes',
]);

// ---- explicit source-name → schema-field mappings ----------------------
// Manually curated: when the XML leaf element name doesn't literally
// match a schema property, encode the known-good mapping here so the
// census doesn't false-positive as "unmapped".
const EXPLICIT_MAPPINGS = new Map(Object.entries({
  articledoi: 'doi',
  articlestatus: 'status.active',
  contenttype: 'contentType',
  articletitle: 'docTitle',
  arttitle: 'docTitle',
  titlegroup: 'docTitle',
  articleeditstate: 'status.editorialState',
  article_editstate: 'status.editorialState',
  articleseqnum: 'seq',
  article_sequence: 'seq',
  articleopenaccess: 'isOpenAccess',
  open_access: 'isOpenAccess',
  articlepeerreviewflag: 'peerReviewed',
  peer_review_flag: 'peerReviewed',
  articleplagiarizedflag: 'plagiarizedFlag',
  articlecoverimageflag: 'hasCoverImage',
  article_copyright_statement: 'copyright',
  copyright_statement: 'copyright',
  copyright_holder: 'copyright',
  copyright_year: 'copyright.year',
  articlereferenceflag: 'references',
  reference_flag: 'references',
  idamsid: 'sourceIds.idams',
  amsid: 'sourceIds.ams',
  articleid: 'sourceIds.aptara',
  filename: 'sourceFilename',
  file: 'sourceFilename',
  fpage: 'pages.first',
  lpage: 'pages.last',
  first_page: 'pages.first',
  last_page: 'pages.last',
  artpagenums: 'pages',
  pagenums: 'pages',
  authorgroup: 'authors',
  contributors: 'authors',
  contrib: 'authors',
  contribgroup: 'authors',
  author: 'authors',
  person_name: 'authors',
  normname: 'authors',
  given_name: 'authors',
  givennames: 'authors',
  firstname: 'authors',
  surname: 'authors',
  affiliation: 'authors.affiliation',
  aff: 'authors.affiliation',
  bio: 'authors.bio',
  abstract: 'abstract',
  keyword: 'keywords',
  kwd: 'keywords',
  pubitype: 'articleType',
  major_topic: 'topics',
  topic: 'topics',
  publication_date: 'publicationDate',
  pubdate: 'publicationDate',
  articledate: 'publicationDate',
  epub_date: 'publicationDate',
  ppub_date: 'publicationDate',
  volume: 'volume',
  volumenum: 'volume',
  issuenum: 'issue',
  issue: 'issue',
  journal_acronym: 'journalAcronym',
  abbrev_title: 'journalAcronym',
  journal_id: 'journalId',
  full_title: 'journalTitle',
  publisher_name: 'publisher',
  publisher: 'publisher',
  issn: 'issn',
  coden: 'coden',
  isbn: 'isbn',
  parent_title: 'parentPublication',
  publicationtype: 'docType',
  publicationsubtype: 'docType',
  pubtopicalbrowse: 'topics',
  pubtopicalbrowseset: 'topics',
  articleshowflag: 'listed',
  articlenodoiflag: 'noDoi',
  article_quality: 'quality',
  article_status: 'status.active',
  holdstatus: 'status.state',
  pubstatus: 'status.state',
  size: 'fileSize',
  ieeeabbrev: 'sourceIds.ieeeAbbrev',
  publicationopenaccess: 'isOpenAccess',
}));

// Normalized versions for cheaper matching
function norm(s) { return String(s).toLowerCase().replace(/[_\-\s]/g, ''); }
const schemaPropsNorm = new Set([...schemaProps].map(norm));
const smpteCanonicalNorm = new Set([...SMPTE_CANONICAL_FIELDS].map(norm));

// ---- path tracker ------------------------------------------------------
// Regex-lex through XML. Maintain a stack of open tags. Emit a "path" =
// slash-joined stack. Attributes are emitted as `<path>/@name`. Text
// content collected up to MAX_SAMPLE_LEN.

const TAG_RE = /<\/?[A-Za-z][A-Za-z0-9._:-]*(?:\s[^>]*)?\/?>/g;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const CDATA_RE = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
const DOCTYPE_RE = /<!DOCTYPE[\s\S]*?>/g;
const XMLDECL_RE = /<\?xml[\s\S]*?\?>/g;
const ATTR_RE = /([A-Za-z][A-Za-z0-9._:-]*)="([^"]*)"/g;

function walkXml(xml, onPath) {
  // Strip pseudo-tags that would confuse the lexer
  xml = xml.replace(XMLDECL_RE, '')
           .replace(DOCTYPE_RE, '')
           .replace(COMMENT_RE, '')
           .replace(CDATA_RE, (_, inner) => inner);  // keep CDATA content as text

  const stack = [];
  let lastEnd = 0;
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(xml))) {
    const tag = m[0];
    const between = xml.slice(lastEnd, m.index);
    // Leaf text: between the previous tag and this one, when the stack is non-empty
    const txt = between.trim();
    if (txt && stack.length) {
      const p = stack.join('/');
      onPath(p, 'text', txt);
    }
    lastEnd = m.index + tag.length;

    if (tag.startsWith('</')) {
      const name = tag.slice(2, -1).trim().split(/\s/)[0];
      // Pop until we find name (be forgiving)
      while (stack.length && stack[stack.length - 1] !== name) stack.pop();
      if (stack.length) stack.pop();
    } else {
      // Opening or self-closing
      const bodyRe = /<([A-Za-z][A-Za-z0-9._:-]*)([\s\S]*?)(\/?)>/;
      const bm = tag.match(bodyRe);
      if (!bm) continue;
      const name = bm[1];
      const attrs = bm[2];
      const selfClose = bm[3] === '/';
      // Strip namespace prefix from element name to keep paths comparable
      const localName = name.includes(':') ? name.split(':').pop() : name;
      stack.push(localName);
      const p = stack.join('/');
      onPath(p, 'element', null);
      // Attributes: emit as `<path>/@attr`
      if (attrs) {
        ATTR_RE.lastIndex = 0;
        let am;
        while ((am = ATTR_RE.exec(attrs))) {
          const [, attrName, attrVal] = am;
          if (attrName === 'xmlns' || attrName.startsWith('xmlns:')) continue;
          const attrLocal = attrName.includes(':') ? attrName.split(':').pop() : attrName;
          onPath(`${p}/@${attrLocal}`, 'attr', attrVal);
        }
      }
      if (selfClose) stack.pop();
    }
  }
}

// ---- collector ---------------------------------------------------------
// path -> { files, occurs, samples: Set<string>, shapes: Set<string> }
const CENSUS = new Map();

function record(shape, p, kind, value) {
  // Prefix paths with shape so cross-shape overlap is visible
  const key = `${shape}::${p}`;
  let entry = CENSUS.get(key);
  if (!entry) { entry = { path: p, shape, files: 0, occurs: 0, samples: new Set() }; CENSUS.set(key, entry); }
  entry.occurs += 1;
  if (value && entry.samples.size < MAX_SAMPLES_PER_PATH) {
    const v = value.length > MAX_SAMPLE_LEN ? value.slice(0, MAX_SAMPLE_LEN) + '…' : value;
    entry.samples.add(v);
  }
}

// Detect root element to determine shape
function detectShape(xml) {
  // First non-<?xml, non-<!DOCTYPE, non-<!-- tag
  const stripped = xml.replace(XMLDECL_RE, '').replace(DOCTYPE_RE, '').replace(COMMENT_RE, '');
  const m = stripped.match(/<([A-Za-z][A-Za-z0-9._:-]*)/);
  if (!m) return 'unknown';
  const name = m[1].includes(':') ? m[1].split(':').pop() : m[1];
  return name;
}

// ---- walk directories --------------------------------------------------
function walkDir(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const ent of ents) {
    if (ent.name === '.DS_Store') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) { walkDir(full, out); continue; }
    if (ent.isFile() && /\.xml$/i.test(ent.name)) out.push(full);
  }
}
const files = [];
for (const d of SOURCE_DIRS) walkDir(d, files);
console.log(`[census] walking ${files.length} XML files`);

let processed = 0;
const shapeCounts = {};
const perFilePathSets = new Map();
for (const f of files) {
  let xml;
  try { xml = fs.readFileSync(f, 'utf8'); }
  catch (e) { console.error(`  read failed ${f}: ${e.message}`); continue; }
  const shape = detectShape(xml);
  shapeCounts[shape] = (shapeCounts[shape] || 0) + 1;
  const pathsThisFile = new Set();
  walkXml(xml, (p, kind, value) => {
    record(shape, p, kind, value);
    pathsThisFile.add(`${shape}::${p}`);
  });
  // bump file-count per path (distinct paths in this file)
  for (const k of pathsThisFile) {
    const e = CENSUS.get(k);
    if (e) e.files += 1;
  }
  processed++;
  if (processed % 5000 === 0) console.log(`  … ${processed}/${files.length}`);
}
console.log(`[census] processed ${processed} files`);
console.log(`[census] shapes: ${JSON.stringify(shapeCounts)}`);
console.log(`[census] distinct paths: ${CENSUS.size}`);

// ---- classify each path ------------------------------------------------
function classify(pathEntry) {
  // Take the last segment (element or @attr) for name matching
  const p = pathEntry.path;
  const seg = p.split('/').pop().replace(/^@/, '');
  const key = norm(seg);

  // Explicit mapping wins
  if (EXPLICIT_MAPPINGS.has(seg.toLowerCase())) {
    return { bucket: 'mapped', mappedTo: EXPLICIT_MAPPINGS.get(seg.toLowerCase()), reason: 'explicit' };
  }
  // SMPTE canonical model?
  if (smpteCanonicalNorm.has(key)) {
    return { bucket: 'canonical', mappedTo: seg, reason: 'canonical-model' };
  }
  // Schema property literal match?
  if (schemaPropsNorm.has(key)) {
    return { bucket: 'mapped', mappedTo: seg, reason: 'schema-match' };
  }
  // Candidate: schema property whose norm is a substring or vice-versa
  for (const sp of schemaProps) {
    const spn = norm(sp);
    if (spn === key) continue;
    if (spn.includes(key) && key.length >= 4) return { bucket: 'candidate', mappedTo: sp, reason: 'substr(key⊂schema)' };
    if (key.includes(spn) && spn.length >= 4) return { bucket: 'candidate', mappedTo: sp, reason: 'substr(schema⊂key)' };
  }
  return { bucket: 'unmapped', mappedTo: null, reason: null };
}

// ---- assemble report ---------------------------------------------------
const rows = [...CENSUS.values()]
  .map(e => ({ ...e, samples: [...e.samples], ...classify(e) }))
  .sort((a, b) => b.occurs - a.occurs);

const byBucket = { mapped: 0, canonical: 0, candidate: 0, unmapped: 0 };
for (const r of rows) byBucket[r.bucket] += 1;

// Machine-readable JSON
const outJson = {
  generatedAt: new Date().toISOString(),
  totals: {
    xmlFiles: processed,
    distinctPaths: rows.length,
    byBucket,
  },
  shapeCounts,
  paths: rows,
};
fs.writeFileSync(path.join(REPORTS, 'sourceFieldCensus.paths.json'), JSON.stringify(outJson, null, 2) + '\n');

// Human-readable MD — focus on unmapped + candidate (the interesting ones)
const md = [];
md.push('# Deep _source field census');
md.push('');
md.push(`> Generated: ${new Date().toISOString()}`);
md.push(`> XML files scanned: **${processed}**`);
md.push(`> Distinct paths: **${rows.length}**`);
md.push('');
md.push('## Shapes');
md.push('');
md.push('| shape | files |');
md.push('|---|---:|');
for (const [k, v] of Object.entries(shapeCounts).sort((a, b) => b[1] - a[1])) {
  md.push(`| \`${k}\` | ${v} |`);
}
md.push('');
md.push('## Classification');
md.push('');
md.push(`- 🎯 **canonical** (in SMPTE required-floor model): ${byBucket.canonical}`);
md.push(`- ✅ **mapped** (explicit mapping or schema match): ${byBucket.mapped}`);
md.push(`- ❓ **candidate** (name-substring match — needs review): ${byBucket.candidate}`);
md.push(`- 🔴 **unmapped** (no schema field considered): ${byBucket.unmapped}`);
md.push('');

function pathTable(header, filter, limit = 200) {
  md.push('| shape | path | files | occurs | mapping / candidate | samples |');
  md.push('|---|---|---:|---:|---|---|');
  const shown = rows.filter(filter).slice(0, limit);
  for (const r of shown) {
    const smp = r.samples.length ? r.samples.map(s => '`' + s.replace(/`/g, '\\`').replace(/\|/g, '\\|') + '`').join(' · ') : '';
    const mapping = r.mappedTo ? `\`${r.mappedTo}\`${r.reason ? ` <sub>(${r.reason})</sub>` : ''}` : '';
    md.push(`| \`${r.shape}\` | \`${r.path}\` | ${r.files} | ${r.occurs} | ${mapping} | ${smp} |`);
  }
  const total = rows.filter(filter).length;
  if (total > limit) md.push(`\n_… ${total - limit} more_`);
  md.push('');
}

md.push(`## 🔴 Unmapped paths (top 200 by occurs)`);
md.push('');
pathTable('unmapped', r => r.bucket === 'unmapped');

md.push(`## ❓ Candidate mappings (top 100 by occurs)`);
md.push('');
pathTable('candidate', r => r.bucket === 'candidate', 100);

md.push(`## ✅ Mapped paths (top 50 by occurs — sanity check)`);
md.push('');
pathTable('mapped', r => r.bucket === 'mapped', 50);

md.push(`## 🎯 Canonical-model paths (all)`);
md.push('');
pathTable('canonical', r => r.bucket === 'canonical', 500);

fs.writeFileSync(path.join(REPORTS, 'sourceFieldCensus.md'), md.join('\n') + '\n');
console.log(`[census] wrote ${path.join(REPORTS, 'sourceFieldCensus.md')}`);
console.log(`[census] wrote ${path.join(REPORTS, 'sourceFieldCensus.paths.json')}`);
console.log(`[census] classification: ${JSON.stringify(byBucket)}`);
