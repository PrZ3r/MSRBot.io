/*
 * reauditUnmappedFields.js — XML-side field coverage audit.
 *
 * Walks samples of `_source/SMPTE/*` XML deliveries (HIGHWIRE standards,
 * APTARA + Allen Press journal-article fragments) and tallies every element
 * path encountered, then cross-references each path against:
 *
 *   (a) what we already model in schema 2.2.0 (per documents.schema.json), and
 *   (b) the field decisions already recorded in
 *       src/main/reports/sourceInventory.smpte.schemaMap.md
 *
 * Output: src/main/reports/refsReaudit.unmappedFields.{json,md}
 *
 * For each tallied path, status is one of:
 *   - modeled         — handled by schema 2.2.0
 *   - deferred        — schemaMap explicitly deferred (low value / not first-class)
 *   - mapped-meta     — schemaMap routes via companion `$meta` rather than first-class field
 *   - new-unseen      — path appears in XML but schemaMap.md never mentioned it (real gap)
 *
 * Sampling — we don't need to walk every file. A 1000-doc sample from each
 * delivery is sufficient to surface every path that occurs more than ~0.1% of
 * the time, which is the threshold for "worth modeling".
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SCHEMA_PATH = path.resolve(ROOT, 'src/main/schemas/documents.schema.json');
const SCHEMA_MAP_PATH = path.resolve(ROOT, 'src/main/reports/sourceInventory.smpte.schemaMap.md');
const OUT_JSON = path.resolve(ROOT, 'src/main/reports/refsReaudit.unmappedFields.json');
const OUT_MD = path.resolve(ROOT, 'src/main/reports/refsReaudit.unmappedFields.md');

const SAMPLES = [
  { label: 'HIGHWIRE standards (originals)', dir: '_source/SMPTE/HIGHWIRE/ORIGINAL SAMPLES/Standards', limit: 500 },
  { label: 'HIGHWIRE Source Bak', dir: '_source/SMPTE/HIGHWIRE/Source Bak', limit: 1500 },
  { label: 'APTARA journal', dir: '_source/SMPTE/APTARA/METADATA and PDFs ALL CONTENT/Journal', limit: 1500 },
  { label: 'ALLEN PRESS journal', dir: '_source/SMPTE/ALLEN PRESS/JOURNAL SAMPLES', limit: 200 },
];

function listXml(dir, limit) {
  const out = [];
  function walk(d) {
    if (out.length >= limit) return;
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (out.length >= limit) return;
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && full.endsWith('.xml')) out.push(full);
    }
  }
  walk(path.resolve(ROOT, dir));
  return out;
}

/**
 * Crude element-path tally. Streams the XML byte-by-byte and tracks an
 * element-name stack. We're after PATH FREQUENCY, not real parsing — the
 * existing inventorySource.smpte.js does proper parsing for the fields it
 * already knows about. This catches paths the proper parser was never told
 * to look at.
 */
function tallyPaths(xml) {
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

function loadSchemaFieldNames() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const out = new Set();
  function walkProps(s) {
    if (!s || typeof s !== 'object') return;
    if (s.properties) {
      for (const k of Object.keys(s.properties)) {
        out.add(k);
        walkProps(s.properties[k]);
      }
    }
    if (s.items) walkProps(s.items);
    if (s.oneOf) for (const o of s.oneOf) walkProps(o);
    if (s.anyOf) for (const o of s.anyOf) walkProps(o);
    if (s.allOf) for (const o of s.allOf) walkProps(o);
  }
  walkProps(schema);
  return out;
}

function loadSchemaMapDecisions() {
  const text = fs.readFileSync(SCHEMA_MAP_PATH, 'utf8');
  const decisions = new Map();
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

function main() {
  console.log('[unmapped] loading schema + schemaMap');
  const schemaFields = loadSchemaFieldNames();
  const decisions = loadSchemaMapDecisions();

  const allPathsByLabel = {};
  for (const sample of SAMPLES) {
    console.log(`[unmapped] sampling ${sample.label} (limit ${sample.limit})`);
    const files = listXml(sample.dir, sample.limit);
    console.log(`[unmapped]   found ${files.length} files`);
    const agg = new Map();
    for (const f of files) {
      let xml;
      try { xml = fs.readFileSync(f, 'utf8'); } catch { continue; }
      const tallies = tallyPaths(xml);
      for (const [p, c] of tallies) agg.set(p, (agg.get(p) || 0) + c);
    }
    allPathsByLabel[sample.label] = {
      filesSampled: files.length,
      paths: [...agg.entries()].map(([p, count]) => ({
        path: p,
        count,
        status: classify(p, schemaFields, decisions),
      })),
    };
  }

  const newUnseenAll = new Map();
  for (const [label, info] of Object.entries(allPathsByLabel)) {
    for (const r of info.paths) {
      if (r.status !== 'new-unseen') continue;
      const k = r.path;
      const cur = newUnseenAll.get(k) || { path: k, totalCount: 0, perLabel: {} };
      cur.totalCount += r.count;
      cur.perLabel[label] = r.count;
      newUnseenAll.set(k, cur);
    }
  }
  const newUnseen = [...newUnseenAll.values()].sort((a, b) => b.totalCount - a.totalCount);

  const out = {
    generatedAt: process.env.REAUDIT_TIMESTAMP || '(set REAUDIT_TIMESTAMP)',
    schemaFields: [...schemaFields].sort(),
    schemaMapDecisionsCount: decisions.size,
    samples: allPathsByLabel,
    newUnseenAggregate: newUnseen,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`[unmapped] wrote ${path.relative(ROOT, OUT_JSON)}`);

  fs.writeFileSync(OUT_MD, renderMd(out), 'utf8');
  console.log(`[unmapped] wrote ${path.relative(ROOT, OUT_MD)}`);
}

function renderMd(out) {
  const lines = [];
  lines.push('# Refs Re-Audit — Unmapped Source-XML Fields\n');
  lines.push(`> Generated at: ${out.generatedAt}`);
  lines.push(`> Schema fields modeled in 2.2.0: **${out.schemaFields.length}**`);
  lines.push(`> Decisions captured in sourceInventory.smpte.schemaMap.md: **${out.schemaMapDecisionsCount}**\n`);

  lines.push('## Top 50 \'new-unseen\' XML element paths across all samples\n');
  lines.push('> Paths that appear in source XML but were never mentioned in `sourceInventory.smpte.schemaMap.md` — real gaps to evaluate for schema 2.3.0 vs #1171 envelope capture.\n');
  lines.push('| Path | Total sightings | Per-source |');
  lines.push('|---|---:|---|');
  for (const r of out.newUnseenAggregate.slice(0, 50)) {
    const per = Object.entries(r.perLabel).map(([l, c]) => `${l}: ${c}`).join(' · ');
    lines.push(`| \`${r.path}\` | ${r.totalCount} | ${per} |`);
  }
  lines.push('');

  for (const [label, info] of Object.entries(out.samples)) {
    lines.push(`## ${label} — ${info.filesSampled} files sampled\n`);
    const buckets = { modeled: 0, deferred: 0, 'mapped-meta': 0, 'new-unseen': 0 };
    for (const r of info.paths) buckets[r.status] = (buckets[r.status] || 0) + 1;
    lines.push('| status | distinct paths |');
    lines.push('|---|---:|');
    for (const [s, n] of Object.entries(buckets)) lines.push(`| ${s} | ${n} |`);
    lines.push('');
    const top = info.paths.filter((r) => r.status === 'new-unseen').sort((a, b) => b.count - a.count).slice(0, 25);
    if (top.length) {
      lines.push('Top 25 new-unseen paths in this source:\n');
      lines.push('| path | count |');
      lines.push('|---|---:|');
      for (const r of top) lines.push(`| \`${r.path}\` | ${r.count} |`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('Full per-source detail with all paths + status in `refsReaudit.unmappedFields.json`.');
  return lines.join('\n');
}

main();
