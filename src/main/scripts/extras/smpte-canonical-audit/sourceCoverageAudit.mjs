/*
 * sourceCoverageAudit.mjs — is every document in the SMPTE source trees in the
 * registry? Read-only.
 *
 * Source trees (local only — never committed):
 *   _source/SMPTE/                                   (current canonical repos)
 *   ../../SMPTE/smpte-mediashuttle-source/_source/   (the older APTARA / Allen
 *                                                     Press / HIGHWIRE / IEEE /
 *                                                     Zoho tree, moved out of
 *                                                     this repo)
 *
 * For every XML file, the document's OWN 10.5594 DOIs are collected after
 * stripping reference lists (<ref-list>, <citation_list>, <reflist>, <back>),
 * so a cited DOI is never mistaken for a document. -ref.xml sidecars are
 * reference files, not documents; their filename names the citing document,
 * which is checked too. Zoho JSON records are checked by their DOI field.
 *
 * Each DOI is matched to registry `doi` exactly (case-sensitive — J vs j are
 * distinct); a case-only match is reported separately, as is a DOI whose
 * dashed form is a registry docId.
 *
 *   node …/sourceCoverageAudit.mjs
 *
 * Report: src/main/reports/smpte-canonical-audit/sourceCoverageAudit.{md,json}
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);
const { loadAllDocs } = require('../../../lib/registry');

const TREES = [
  { name: 'MSRBot.io/_source/SMPTE', root: path.join(REPO_ROOT, '_source/SMPTE') },
  { name: 'smpte-mediashuttle-source/_source', root: path.resolve(REPO_ROOT, '../../SMPTE/smpte-mediashuttle-source/_source') },
];
const OUT_MD = 'src/main/reports/smpte-canonical-audit/sourceCoverageAudit.md';
const OUT_JSON = 'src/main/reports/smpte-canonical-audit/sourceCoverageAudit.json';

// ---- registry ------------------------------------------------------------
const docs = loadAllDocs();
const byDoi = new Map();
const byDoiLower = new Map();
const docIds = new Set();
for (const d of docs) {
  docIds.add(d.docId);
  if (d.doi) {
    const doi = String(d.doi).trim();
    byDoi.set(doi, d.docId);
    if (!byDoiLower.has(doi.toLowerCase())) byDoiLower.set(doi.toLowerCase(), d.docId);
  }
}

// ---- walk ----------------------------------------------------------------
function* walk(dir) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.name.startsWith('.') || e.name === '__MACOSX') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const DOI_RE = /10\.5594\/[A-Za-z0-9][A-Za-z0-9._\-/]*[A-Za-z0-9]/g;
const stripRefs = (x) => x
  .replace(/<ref-list\b[\s\S]*?<\/ref-list>/gi, ' ')
  .replace(/<citation_list\b[\s\S]*?<\/citation_list>/gi, ' ')
  .replace(/<reflist\b[\s\S]*?<\/reflist>/gi, ' ')
  .replace(/<back\b[\s\S]*?<\/back>/gi, ' ')
  .replace(/<ref\b[\s\S]*?<\/ref>/gi, ' ');
const cleanDoi = (d) => d.replace(/[./_-]+$/, '');

const found = new Map(); // doi → { trees:Set, folders:Set, files:n, sample }
function record(doi, tree, rel, how) {
  const d = cleanDoi(doi);
  const folder = rel.split(path.sep).slice(0, 2).join('/');
  if (!found.has(d)) found.set(d, { trees: new Set(), folders: new Set(), files: 0, sample: rel, how: new Set() });
  const f = found.get(d);
  f.trees.add(tree); f.folders.add(folder); f.files++; f.how.add(how);
}

const fileStats = {};
for (const { name, root } of TREES) {
  if (!fs.existsSync(root)) { console.warn(`[coverage] missing tree ${root}`); continue; }
  const st = fileStats[name] = { xml: 0, refXml: 0, json: 0, other: 0, xmlNoDoi: 0 };
  for (const p of walk(root)) {
    const rel = path.relative(root, p);
    const lower = p.toLowerCase();
    if (lower.endsWith('-ref.xml')) {
      st.refXml++;
      const m = path.basename(p).match(/10[-_.]5594[-_]([A-Za-z0-9.]+?)-ref\.xml$/i);
      if (m) record(`10.5594/${m[1]}`, name, rel, 'ref-sidecar-name');
      continue;
    }
    if (lower.endsWith('.xml')) {
      st.xml++;
      let x;
      try { x = fs.readFileSync(p, 'utf8'); } catch { continue; }
      const own = stripRefs(x).match(DOI_RE) || [];
      if (!own.length) st.xmlNoDoi++;
      for (const d of new Set(own)) record(d, name, rel, 'xml');
      continue;
    }
    if (lower.endsWith('.json') && /zoho/i.test(rel)) {
      st.json++;
      let j;
      try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
      const text = JSON.stringify(j);
      for (const d of new Set(text.match(DOI_RE) || [])) record(d, name, rel, 'zoho');
      continue;
    }
    st.other++;
  }
  console.log(`[coverage] ${name}: ${JSON.stringify(st)}`);
}

// ---- match ---------------------------------------------------------------
const rows = [];
for (const [doi, f] of found) {
  let status;
  let docId = null;
  if (byDoi.has(doi)) { status = 'exact'; docId = byDoi.get(doi); }
  else if (docIds.has(doi.replace(/\//g, '-'))) { status = 'docId'; docId = doi.replace(/\//g, '-'); }
  else if (byDoiLower.has(doi.toLowerCase())) { status = 'case-only'; docId = byDoiLower.get(doi.toLowerCase()); }
  else status = 'missing';
  rows.push({ doi, status, docId, files: f.files, trees: [...f.trees], folders: [...f.folders], how: [...f.how], sample: f.sample });
}
const by = (k) => rows.filter((r) => r.status === k);
const missing = by('missing');
const tally = (list, key) => list.reduce((m, r) => { for (const v of r[key]) m[v] = (m[v] || 0) + 1; return m; }, {});
const prefix = (doi) => (doi.match(/^10\.5594\/([A-Za-z]+)/) || [])[1] || '?';
const missByPrefix = missing.reduce((m, r) => { const p = prefix(r.doi); m[p] = (m[p] || 0) + 1; return m; }, {});

fs.writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), fileStats, total: rows.length, missing, caseOnly: by('case-only') }, null, 1) + '\n');
const esc = (s) => String(s).replace(/\|/g, '\\|');
const md = [
  '# SMPTE source coverage audit',
  '',
  `> ${new Date().toISOString()} · read-only · registry ${docs.length} docs`,
  '',
  '## Files scanned',
  '',
  '| tree | xml | -ref.xml | zoho json | other (pdf, images, …) | xml with no own DOI |',
  '|---|---:|---:|---:|---:|---:|',
  ...Object.entries(fileStats).map(([k, s]) => `| ${k} | ${s.xml} | ${s.refXml} | ${s.json} | ${s.other} | ${s.xmlNoDoi} |`),
  '',
  '## Distinct document DOIs',
  '',
  `- found in source: **${rows.length}**`,
  `- in registry (exact \`doi\`): ${by('exact').length}`,
  `- in registry (DOI's dashed form is a docId): ${by('docId').length}`,
  `- case-only match (J vs j — check, may be a distinct doc): ${by('case-only').length}`,
  `- **not in registry: ${missing.length}**`,
  '',
  '### Missing — by DOI prefix',
  '',
  '| prefix | missing |',
  '|---|---:|',
  ...Object.entries(missByPrefix).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '### Missing — by source folder',
  '',
  '| folder | missing |',
  '|---|---:|',
  ...Object.entries(tally(missing, 'folders')).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${esc(k)} | ${v} |`),
  '',
  '### Missing DOIs',
  '',
  '| DOI | how found | files | sample |',
  '|---|---|---:|---|',
  ...missing.sort((a, b) => a.doi.localeCompare(b.doi)).map((r) => `| \`${r.doi}\` | ${r.how.join(', ')} | ${r.files} | ${esc(r.sample)} |`),
  '',
  '### Case-only matches',
  '',
  '| source DOI | registry docId |',
  '|---|---|',
  ...by('case-only').map((r) => `| \`${r.doi}\` | \`${r.docId}\` |`),
  '',
];
fs.writeFileSync(OUT_MD, md.join('\n'));
console.log(`[coverage] ${rows.length} DOIs · exact ${by('exact').length} · docId ${by('docId').length} · case-only ${by('case-only').length} · missing ${missing.length}`);
console.log(`  report: ${OUT_MD}`);
