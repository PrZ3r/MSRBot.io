/*
 * auditSourceFoldersDeep.js — Deep pre-#1171 audit, Part 2.
 *
 * Walks every subtree under _source/ (all 10 subfolders), tallies XML
 * element paths per source archive, and cross-references against schema
 * 2.3.0 + the existing sourceInventory.smpte.schemaMap.md decisions.
 *
 * Extends v2.1.0's reauditUnmappedFields.js which only sampled a subset
 * of the SMPTE HIGHWIRE + APTARA + Allen Press trees. This deep version
 * covers:
 *
 *   _source/SMPTE/APTARA/DL Project Files          ← new
 *   _source/SMPTE/APTARA/METADATA and PDFs         ← already sampled
 *   _source/SMPTE/HIGHWIRE/HW Usage Data           ← new
 *   _source/SMPTE/HIGHWIRE/ORIGINAL SAMPLES        ← new
 *   _source/SMPTE/HIGHWIRE/Source Bak              ← already sampled
 *   _source/SMPTE/ALLEN PRESS/DELIVERED TO IEEEE   ← new
 *   _source/SMPTE/ALLEN PRESS/JOURNAL SAMPLES      ← already sampled
 *   _source/SMPTE/IEEE/IEEE FTP FILES              ← new
 *   _source/SMPTE/IEEE DL Usage Data/{2016,17,18}  ← new
 *   _source/SMPTE/Zoho                             ← new
 *
 * Output:
 *   src/main/reports/sourceInventory.deep.{json,md}
 *
 * Companion to auditRegistryFields.js (Part 1 — registry side).
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const SCHEMA_PATH = 'src/main/schemas/documents.schema.json';
const SCHEMA_MAP_PATH = 'src/main/reports/sourceInventory.smpte.schemaMap.md';
const OUT_JSON = 'src/main/reports/sourceInventory.deep.json';
const OUT_MD = 'src/main/reports/sourceInventory.deep.md';

// Sub-trees to walk. Cap per-subtree to keep runtime bounded (representative
// sampling); 5000 files is plenty for path-frequency detection.
const SUBTREES = [
  { label: 'APTARA / DL Project Files',        dir: '_source/SMPTE/APTARA/DL Project Files',                   sampleCap: 5000 },
  { label: 'APTARA / METADATA and PDFs',       dir: '_source/SMPTE/APTARA/METADATA and PDFs ALL CONTENT',       sampleCap: 5000 },
  { label: 'HIGHWIRE / HW Usage Data',         dir: '_source/SMPTE/HIGHWIRE/HW Usage Data',                     sampleCap: 5000 },
  { label: 'HIGHWIRE / ORIGINAL SAMPLES',      dir: '_source/SMPTE/HIGHWIRE/ORIGINAL SAMPLES',                  sampleCap: 5000 },
  { label: 'HIGHWIRE / Source Bak',            dir: '_source/SMPTE/HIGHWIRE/Source Bak',                        sampleCap: 5000 },
  { label: 'ALLEN PRESS / DELIVERED TO IEEEE', dir: '_source/SMPTE/ALLEN PRESS/DELIVERED TO IEEEE',             sampleCap: 5000 },
  { label: 'ALLEN PRESS / JOURNAL SAMPLES',    dir: '_source/SMPTE/ALLEN PRESS/JOURNAL SAMPLES',                sampleCap: 5000 },
  { label: 'IEEE / IEEE FTP FILES',            dir: '_source/SMPTE/IEEE/IEEE FTP FILES',                        sampleCap: 5000 },
  { label: 'IEEE DL Usage Data (all years)',   dir: '_source/SMPTE/IEEE DL Usage Data',                         sampleCap: 5000 },
  { label: 'Zoho',                             dir: '_source/SMPTE/Zoho',                                       sampleCap: 5000 },
];

// ---- XML path tally -----------------------------------------------------

function walkXmlFiles(dir, cap) {
  const out = [];
  function w(d) {
    if (out.length >= cap) return;
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (out.length >= cap) return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) w(p);
      else if (e.isFile() && /\.xml$/i.test(p)) out.push(p);
    }
  }
  w(path.resolve(REPO_ROOT, dir));
  return out;
}

function tallyPaths(xml) {
  // Crude element-name-stack streaming parser, same idea as v2.1.0
  // reauditUnmappedFields.js. Returns Map<path, count>.
  const paths = new Map();
  const stack = [];
  let i = 0;
  const n = xml.length;
  while (i < n) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) break;
    const gt = xml.indexOf('>', lt + 1);
    if (gt < 0) break;
    const raw = xml.slice(lt + 1, gt);
    i = gt + 1;
    if (raw.startsWith('!') || raw.startsWith('?')) continue;
    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim().split(/\s+/)[0];
      while (stack.length && stack[stack.length - 1] !== name) stack.pop();
      stack.pop();
      continue;
    }
    const selfClose = raw.endsWith('/');
    const body = (selfClose ? raw.slice(0, -1) : raw).trim();
    const name = body.split(/\s+/)[0];
    if (!name) continue;
    stack.push(name);
    const p = stack.join('/');
    paths.set(p, (paths.get(p) || 0) + 1);
    if (selfClose) stack.pop();
  }
  return paths;
}

// Load existing schema-field names + schemaMap decisions so we can classify
// each element path as modeled / deferred / mapped-meta / new-unseen.

function loadSchemaFieldNames() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const out = new Set();
  function walk(s) {
    if (!s || typeof s !== 'object') return;
    if (s.properties) for (const k of Object.keys(s.properties)) { out.add(k); walk(s.properties[k]); }
    if (s.items) walk(s.items);
    if (s.oneOf) for (const o of s.oneOf) walk(o);
    if (s.anyOf) for (const o of s.anyOf) walk(o);
    if (s.allOf) for (const o of s.allOf) walk(o);
  }
  walk(schema);
  return out;
}

function loadSchemaMapDecisions() {
  const decisions = new Map();
  if (!fs.existsSync(SCHEMA_MAP_PATH)) return decisions;
  const text = fs.readFileSync(SCHEMA_MAP_PATH, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/`([a-zA-Z_][a-zA-Z0-9_/@\-]*)`/g);
    if (!m) continue;
    for (const tok of m) {
      const tag = tok.slice(1, -1);
      if (!tag.includes('/') && !/[a-z]/.test(tag)) continue;
      let status = 'modeled';
      if (/skip|low-value|don't add|Redundant|Minor/i.test(line)) status = 'deferred';
      else if (/\$meta\.sourceFile|carry as.*\$meta|via companion.*meta/i.test(line)) status = 'mapped-meta';
      if (!decisions.has(tag) || decisions.get(tag) === 'modeled') decisions.set(tag, status);
    }
  }
  return decisions;
}

function classify(elementPath, schemaFields, schemaMapDecisions) {
  const leaf = elementPath.split('/').pop();
  if (schemaMapDecisions.has(elementPath)) return schemaMapDecisions.get(elementPath);
  if (schemaMapDecisions.has(leaf)) return schemaMapDecisions.get(leaf);
  if (schemaFields.has(leaf)) return 'modeled';
  return 'new-unseen';
}

// ---- main ---------------------------------------------------------------

console.log('[audit-source] loading schema + schemaMap…');
const schemaFields = loadSchemaFieldNames();
const decisions = loadSchemaMapDecisions();
console.log(`[audit-source]   schema fields: ${schemaFields.size} | schemaMap decisions: ${decisions.size}`);

const perSubtree = {};
for (const sub of SUBTREES) {
  console.log(`[audit-source] sampling ${sub.label} (cap ${sub.sampleCap})`);
  const files = walkXmlFiles(sub.dir, sub.sampleCap);
  console.log(`[audit-source]   ${files.length} XML files`);
  const agg = new Map();
  for (const f of files) {
    let xml; try { xml = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const t = tallyPaths(xml);
    for (const [p, c] of t) agg.set(p, (agg.get(p) || 0) + c);
  }
  const paths = [...agg.entries()].map(([p, count]) => ({
    path: p, count, status: classify(p, schemaFields, decisions),
  }));
  perSubtree[sub.label] = {
    dir: sub.dir,
    filesSampled: files.length,
    distinctPaths: paths.length,
    paths,
  };
}

// Aggregate "new-unseen" paths across ALL subtrees
const newUnseenAgg = new Map();
for (const [label, info] of Object.entries(perSubtree)) {
  for (const r of info.paths) {
    if (r.status !== 'new-unseen') continue;
    const k = r.path;
    const cur = newUnseenAgg.get(k) || { path: k, totalCount: 0, perSubtree: {} };
    cur.totalCount += r.count;
    cur.perSubtree[label] = r.count;
    newUnseenAgg.set(k, cur);
  }
}
const newUnseen = [...newUnseenAgg.values()].sort((a, b) => b.totalCount - a.totalCount);

const summary = {
  generatedAt: new Date().toISOString(),
  schemaFieldsCount: schemaFields.size,
  schemaMapDecisionsCount: decisions.size,
  subtrees: perSubtree,
  newUnseenAggregate: newUnseen,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2) + '\n', 'utf8');

// Markdown
const md = [];
md.push('# Deep Source-XML Inventory — pre-#1171 Audit Part 2\n');
md.push(`> Generated at: ${summary.generatedAt}`);
md.push(`> Schema fields modeled in 2.3.0: **${schemaFields.size}**`);
md.push(`> Decisions captured in sourceInventory.smpte.schemaMap.md: **${decisions.size}**\n`);

md.push('## Per-subtree overview\n');
md.push('| subtree | files sampled | distinct paths | new-unseen paths |');
md.push('|---|---:|---:|---:|');
for (const [label, info] of Object.entries(perSubtree)) {
  const newUnseenLocal = info.paths.filter((r) => r.status === 'new-unseen').length;
  md.push(`| ${label} | ${info.filesSampled} | ${info.distinctPaths} | ${newUnseenLocal} |`);
}
md.push('');

md.push('## Top 60 new-unseen element paths across all subtrees\n');
md.push('> Paths that appear in `_source/` XML but were never mentioned in `sourceInventory.smpte.schemaMap.md` and are not among the schema 2.3.0 field names. Real gaps — evaluate for schema promotion vs #1171 envelope capture vs deferred.\n');
md.push('| path | total | per-subtree |');
md.push('|---|---:|---|');
for (const r of newUnseen.slice(0, 60)) {
  const per = Object.entries(r.perSubtree).map(([l, c]) => `${l}: ${c}`).join(' · ');
  md.push(`| \`${r.path}\` | ${r.totalCount} | ${per} |`);
}
md.push('');

md.push('## Per-subtree detail — status breakdown + top 15 new-unseen\n');
for (const [label, info] of Object.entries(perSubtree)) {
  md.push(`### ${label}\n`);
  md.push(`- Files sampled: ${info.filesSampled}`);
  md.push(`- Directory: \`${info.dir}\`\n`);
  const buckets = { modeled: 0, deferred: 0, 'mapped-meta': 0, 'new-unseen': 0 };
  for (const r of info.paths) buckets[r.status] = (buckets[r.status] || 0) + 1;
  md.push('| status | distinct paths |');
  md.push('|---|---:|');
  for (const [s, n] of Object.entries(buckets)) md.push(`| ${s} | ${n} |`);
  md.push('');
  const top = info.paths.filter((r) => r.status === 'new-unseen').sort((a, b) => b.count - a.count).slice(0, 15);
  if (top.length) {
    md.push('Top 15 new-unseen paths in this subtree:\n');
    md.push('| path | count |');
    md.push('|---|---:|');
    for (const r of top) md.push(`| \`${r.path}\` | ${r.count} |`);
    md.push('');
  } else {
    md.push('_(no new-unseen paths — all element paths modeled or classified)_\n');
  }
}

md.push('---');
md.push('Full detail per subtree lives in `sourceInventory.deep.json`.');
fs.writeFileSync(OUT_MD, md.join('\n'), 'utf8');
console.log(`[audit-source] wrote ${OUT_JSON}`);
console.log(`[audit-source] wrote ${OUT_MD}`);
