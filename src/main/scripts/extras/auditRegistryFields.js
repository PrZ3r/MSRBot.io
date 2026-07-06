/*
 * auditRegistryFields.js — Deep pre-#1171 audit, Part 1.
 *
 * Registry-side field census. Walks every doc in the per-doc registry,
 * counts populated-per-field, cross-references against render / search /
 * extractor surfaces, and flags anything with populated > 0 that isn't
 * downstream-visible.
 *
 * Output:
 *   src/main/reports/registryFieldCensus.{json,md}
 *
 * Companion to auditSourceFoldersDeep.js (Part 2 — source-XML side).
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs } = require('../../lib/registry');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const SCHEMA_PATH = 'src/main/schemas/documents.schema.json';
const OUT_JSON = 'src/main/reports/registryFieldCensus.json';
const OUT_MD = 'src/main/reports/registryFieldCensus.md';

// Files we grep for "is this field wired downstream"
const TEMPLATE_FILES = [
  'src/main/templates/docId.hbs',
  'src/main/templates/docList.hbs',
  'src/main/templates/api.hbs',
  'src/main/templates/refTree.hbs',
  'src/main/templates/changelog.hbs',
  'src/main/templates/partials/header.hbs',
  'src/main/templates/partials/footer.hbs',
];
const SEARCH_INDEX_FILE = 'src/main/scripts/build.search-index.js';
const CLIENT_JS_FILE = 'src/site/js/docList.js';
const PROVIDER_DIR = 'src/main/scripts/providers';

// ---- schema field enumeration ------------------------------------------

function enumerateSchemaFields(schema) {
  const fields = new Map(); // path -> { type, description? }
  function visit(node, pathPrefix) {
    if (!node || typeof node !== 'object') return;
    if (node.properties) {
      for (const [k, v] of Object.entries(node.properties)) {
        const p = pathPrefix ? `${pathPrefix}.${k}` : k;
        fields.set(p, { type: typeOf(v) });
        visit(v, p);
      }
    }
    if (node.items) {
      // Arrays: represent as `parent[]` and recurse into items' properties
      const arrPath = pathPrefix ? `${pathPrefix}[]` : '[]';
      if (Array.isArray(node.items.anyOf)) {
        for (const alt of node.items.anyOf) visit(alt, arrPath);
      } else {
        visit(node.items, arrPath);
      }
    }
    if (Array.isArray(node.anyOf)) for (const alt of node.anyOf) visit(alt, pathPrefix);
    if (Array.isArray(node.oneOf)) for (const alt of node.oneOf) visit(alt, pathPrefix);
    if (Array.isArray(node.allOf)) for (const alt of node.allOf) visit(alt, pathPrefix);
  }
  function typeOf(node) {
    if (node.enum) return `enum(${node.enum.length})`;
    if (node.type) return Array.isArray(node.type) ? node.type.join('|') : node.type;
    if (node.oneOf || node.anyOf) return 'variant';
    return 'unknown';
  }
  visit(schema.items, '');
  // De-dupe: some fields land under multiple anyOf branches. Keep one entry.
  return [...fields.entries()].sort(([a], [b]) => a.localeCompare(b));
}

// ---- populated-count per field ------------------------------------------

function isPopulated(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

function walkDocValue(doc, fieldPath) {
  // Field paths are `key`, `key.subkey`, or `key[].subkey`. Return a boolean:
  // does the doc have ANY value at this path?
  const parts = fieldPath.split('.');
  function step(node, i) {
    if (i >= parts.length) return isPopulated(node);
    const p = parts[i];
    if (p.endsWith('[]')) {
      const base = p.slice(0, -2);
      const arr = base ? (node && node[base]) : node;
      if (!Array.isArray(arr)) return false;
      // For arrays, check any element has the remaining path
      return arr.some((el) => step(el, i + 1));
    }
    if (!node || typeof node !== 'object') return false;
    return step(node[p], i + 1);
  }
  return step(doc, 0);
}

console.log('[audit-registry] loading schema…');
const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const fields = enumerateSchemaFields(schema);
console.log(`[audit-registry]   ${fields.length} distinct field paths`);

console.log('[audit-registry] loading registry…');
const docs = loadAllDocs();
console.log(`[audit-registry]   ${docs.length} docs`);

// Populated counts + top-N by publisher/docType
const populatedByField = new Map();
const perPubByField = new Map(); // field -> Map<publisher, count>
const perTypeByField = new Map();

for (const doc of docs) {
  for (const [field] of fields) {
    if (!walkDocValue(doc, field)) continue;
    populatedByField.set(field, (populatedByField.get(field) || 0) + 1);
    const pub = doc.publisher || '_unknown';
    const type = doc.docType || '_unknown';
    if (!perPubByField.has(field)) perPubByField.set(field, new Map());
    if (!perTypeByField.has(field)) perTypeByField.set(field, new Map());
    perPubByField.get(field).set(pub, (perPubByField.get(field).get(pub) || 0) + 1);
    perTypeByField.get(field).set(type, (perTypeByField.get(field).get(type) || 0) + 1);
  }
}

// ---- downstream-surface grep ---------------------------------------------

function slurp(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

const templateBlob = TEMPLATE_FILES.map(slurp).join('\n');
const searchIndexBlob = slurp(SEARCH_INDEX_FILE);
const clientJsBlob = slurp(CLIENT_JS_FILE);
const providerBlob = fs.existsSync(PROVIDER_DIR)
  ? fs.readdirSync(PROVIDER_DIR).filter(f => f.endsWith('.js')).map(f => slurp(path.join(PROVIDER_DIR, f))).join('\n')
  : '';

function referenceStyleField(field) {
  // For "authors[].bio" we grep on "bio" and "authors"
  // For "status.superseded" we grep on "superseded" and "status"
  const tokens = field.split(/[.\[\]]+/).filter(Boolean);
  return tokens;
}

function usedIn(blob, tokens) {
  return tokens.every((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(blob));
}

const rendered = new Map();
const searchable = new Map();
const inClient = new Map();
const extractedBy = new Map();

for (const [field] of fields) {
  const tokens = referenceStyleField(field);
  rendered.set(field, usedIn(templateBlob, tokens));
  searchable.set(field, usedIn(searchIndexBlob, tokens));
  inClient.set(field, usedIn(clientJsBlob, tokens));
  extractedBy.set(field, usedIn(providerBlob, tokens));
}

// ---- classify & report --------------------------------------------------

function classify(field) {
  const p = populatedByField.get(field) || 0;
  const r = rendered.get(field);
  const s = searchable.get(field);
  const e = extractedBy.get(field);
  if (p === 0) return 'unused';                             // ⚪ schema-only
  if (p > 0 && !r && !s) return 'gap';                       // 🔴 data present, no downstream surface
  if (e && !r && !s && p > 0) return 'gap';                  // 🔴 extractor emits but no surface
  return 'covered';                                          // 🟢
}

const rows = [];
for (const [field, meta] of fields) {
  rows.push({
    field,
    type: meta.type,
    populated: populatedByField.get(field) || 0,
    rendered: rendered.get(field) || false,
    searchable: searchable.get(field) || false,
    inClient: inClient.get(field) || false,
    inExtractor: extractedBy.get(field) || false,
    classification: classify(field),
  });
}
rows.sort((a, b) => (b.populated - a.populated) || a.field.localeCompare(b.field));

const gaps = rows.filter((r) => r.classification === 'gap');
const covered = rows.filter((r) => r.classification === 'covered');
const unused = rows.filter((r) => r.classification === 'unused');

// ---- writes -------------------------------------------------------------

const summary = {
  generatedAt: new Date().toISOString(),
  totals: { fields: rows.length, docs: docs.length, gaps: gaps.length, covered: covered.length, unused: unused.length },
  rows,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2) + '\n', 'utf8');

const md = [];
md.push('# Registry Field Census — Deep pre-#1171 Audit Part 1\n');
md.push(`> Generated at: ${summary.generatedAt}`);
md.push(`> Registry docs: **${docs.length}**`);
md.push(`> Distinct schema fields: **${rows.length}**\n`);
md.push('## Classification summary\n');
md.push(`- 🔴 **Gaps** (populated but not rendered/searchable): **${gaps.length}**`);
md.push(`- 🟢 Covered (populated + downstream visible): ${covered.length}`);
md.push(`- ⚪ Unused (schema-only, no docs populate it): ${unused.length}\n`);

md.push('## 🔴 Gaps — fields with populated data but no downstream surface\n');
md.push('| field | type | populated | rendered | searchable | in client JS | in extractor |');
md.push('|---|---|---:|:---:|:---:|:---:|:---:|');
for (const r of gaps) {
  md.push(`| \`${r.field}\` | ${r.type} | ${r.populated} | ${r.rendered?'✓':'—'} | ${r.searchable?'✓':'—'} | ${r.inClient?'✓':'—'} | ${r.inExtractor?'✓':'—'} |`);
}
md.push('');

md.push('## 🟢 Covered fields (top 40 by population)\n');
md.push('| field | type | populated | rendered | searchable | in extractor |');
md.push('|---|---|---:|:---:|:---:|:---:|');
for (const r of covered.slice(0, 40)) {
  md.push(`| \`${r.field}\` | ${r.type} | ${r.populated} | ${r.rendered?'✓':'—'} | ${r.searchable?'✓':'—'} | ${r.inExtractor?'✓':'—'} |`);
}
md.push('');

md.push('## ⚪ Unused fields (schema-only, 0 docs populate)\n');
md.push('| field | type |');
md.push('|---|---|');
for (const r of unused) md.push(`| \`${r.field}\` | ${r.type} |`);
md.push('');

md.push('## Notes\n');
md.push('- "populated" counts docs with a non-null / non-empty value at the field path (arrays require ≥1 element; objects require ≥1 key).');
md.push('- "rendered" / "searchable" / "in extractor" are grep-based token checks against the relevant files — they can false-positive on shared substrings, so treat as first-pass triage rather than authoritative.');
md.push('- Companion source-XML side lives in `sourceInventory.deep.{json,md}` from `auditSourceFoldersDeep.js`.');
md.push('- Cross-reference with source-XML tally: fields with `source_XML: yes` and `populated: 0` are "extractor never captured this even though the data is on disk."');

fs.writeFileSync(OUT_MD, md.join('\n'), 'utf8');
console.log(`[audit-registry] wrote ${OUT_JSON}`);
console.log(`[audit-registry] wrote ${OUT_MD}`);
console.log(`[audit-registry]   fields: ${rows.length} | gaps: ${gaps.length} | covered: ${covered.length} | unused: ${unused.length}`);
