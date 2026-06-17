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

// Keyword vocab scrubber — audits every doc's keywords[] against the controlled
// vocabulary in src/main/config/site.json (`controlledKeywords`). Buckets each
// distinct out-of-vocab term into:
//   - "Auto-fix":   case/spelling variant of an existing vocab term
//   - "Drop":       redundant noise (publisher names that are implicit)
//   - "Promote":    legit concepts that should be added to the controlled vocab
//   - "Synonym":    pairs where both forms exist in use; pick one canonical
//   - "Unknown":    long tail, one-off — flagged for manual review
//
// Default: dry-run, writes a markdown report only.
// `--apply` rewrites every affected doc in-place: applies AUTO_FIX renames,
// drops DROP-listed terms, dedupes the result, and stamps `keywords$meta`
// with provenance (preserves the earliest `originalValue` if already set).
//
// Usage:
//   node src/main/scripts/extras/scrubKeywordVocab.js
//   node src/main/scripts/extras/scrubKeywordVocab.js --apply

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../lib/registry');

const APPLY = process.argv.includes('--apply');
const VERSION = 'kw-scrub@v1';
const NOW = new Date().toISOString();

const SITE_PATH = path.join('src', 'main', 'config', 'site.json');
const REPORT_PATH = path.join('src', 'main', 'reports', 'keywordVocabScrub.md');

const site = JSON.parse(fs.readFileSync(SITE_PATH, 'utf8'));
const vocab = Array.isArray(site.controlledKeywords) ? site.controlledKeywords : [];
const vocabSet = new Set(vocab);
const vocabLower = new Map(vocab.map((v) => [v.toLowerCase(), v]));

// Curated classifications — extend as new drift surfaces. Entries here drive
// the "Auto-fix" / "Drop" / "Synonym" sections of the report; anything not
// classified falls into Promote (real concept, likely vocab add) or Unknown.
const AUTO_FIX = new Map([
  ['Subtitle', 'Subtitles'],
  ['Look-up Table', 'LUT'],
  ['Common LUT Format', 'CLF'],
  ['Microservice', 'Microservices'],
  ['File Format', 'File Formats'],
  ['Image Format', 'Image Formats'],
  ['JPEG 2000', 'JPEG2000'],
  ['Interface', 'Interfaces'],
  ['Network', 'Networks'],
  ['Type', 'Types'],
  ['Internet Of Things', 'Internet of Things'],
  ['CoAP In Browsers', 'CoAP in Browsers'],
  ['Eneryption', 'Encryption'],
  ['USB Type-C', 'USB-C'],
  ['Internet of Things', 'IoT'],
  ['WOTS', 'W-OTS'],
  ['WOTS+', 'W-OTS+'],
]);
const DROP = new Set([
  'SMPTE',
  'Society of Motion Picture and Television Engineers',
  'Languages',
  'Status',
  'SNMP',
]);

// Real terms worth promoting to controlledKeywords — surfaces them as a
// ready-to-paste JSON snippet at the end of the report. SNMP is intentionally
// excluded (DROP-listed above; not relevant enough for SMPTE controlled vocab).
const PROMOTE_HINTS = new Set([
  'AFD', 'DPX', 'MIB', 'Mosaic', 'LFE', 'RIFF', 'WAVE', 'BW64',
  'RTP', 'TTML', 'IMSC', 'TIFF', 'VC-6', 'LUT', 'CLF', 'Microservices',
  'Streaming', 'Logging', 'Reporting', 'Transform', 'Proxy',
  'Switch', 'Non-Latin Alphabet Languages',
  'USB', 'USB-C', 'USB 2.0', 'USB4', 'USB PD', 'USB Type-C',
  '2110', 'ST 2110',
]);

const docs = loadAllDocs();

// distinct-keyword usage + doc index
const usage = new Map(); // keyword -> { count, docIds:Set }
for (const d of docs) {
  const kw = d.keywords;
  if (!Array.isArray(kw)) continue;
  for (const k of kw) {
    if (typeof k !== 'string') continue;
    let rec = usage.get(k);
    if (!rec) { rec = { count: 0, docIds: new Set() }; usage.set(k, rec); }
    rec.count += 1;
    if (d.docId) rec.docIds.add(d.docId);
  }
}

const exact = [];
const caseOnly = [];
const outOfVocab = [];
for (const [k, rec] of usage) {
  if (vocabSet.has(k)) exact.push([k, rec]);
  else if (vocabLower.has(k.toLowerCase())) caseOnly.push([k, rec, vocabLower.get(k.toLowerCase())]);
  else outOfVocab.push([k, rec]);
}

const autoFix = [];   // [k, rec, canonical]
const drop = [];      // [k, rec]
const synonym = [];   // [k, rec, partner]
const promote = [];   // [k, rec]
const unknown = [];   // [k, rec]
for (const [k, rec] of outOfVocab) {
  if (AUTO_FIX.has(k)) {
    const canon = AUTO_FIX.get(k);
    // If the canonical is itself in the vocab → auto-fix; else synonym pair.
    if (vocabSet.has(canon)) autoFix.push([k, rec, canon]);
    else synonym.push([k, rec, canon]);
  } else if (DROP.has(k)) {
    drop.push([k, rec]);
  } else if (PROMOTE_HINTS.has(k)) {
    promote.push([k, rec]);
  } else {
    unknown.push([k, rec]);
  }
}

// --- report -----------------------------------------------------------------
const totalUsages = [...usage.values()].reduce((s, r) => s + r.count, 0);
const md = [];
md.push('# Keyword vocab scrub');
md.push('');
md.push(`Generated: ${new Date().toISOString()}`);
md.push(`Source vocab: \`${SITE_PATH}\` (\`controlledKeywords\`, ${vocab.length} terms)`);
md.push('');
md.push('## Summary');
md.push('');
md.push('| bucket | distinct | usages |');
md.push('|---|---:|---:|');
md.push(`| exact-match to vocab | ${exact.length} | ${exact.reduce((s, [, r]) => s + r.count, 0)} |`);
md.push(`| case-only drift | ${caseOnly.length} | ${caseOnly.reduce((s, [, r]) => s + r.count, 0)} |`);
md.push(`| **out of vocab** | **${outOfVocab.length}** | **${outOfVocab.reduce((s, [, r]) => s + r.count, 0)}** |`);
md.push(`| &nbsp;&nbsp; auto-fix (variant of existing vocab) | ${autoFix.length} | ${autoFix.reduce((s, [, r]) => s + r.count, 0)} |`);
md.push(`| &nbsp;&nbsp; drop (redundant noise) | ${drop.length} | ${drop.reduce((s, [, r]) => s + r.count, 0)} |`);
md.push(`| &nbsp;&nbsp; promote → controlledKeywords | ${promote.length} | ${promote.reduce((s, [, r]) => s + r.count, 0)} |`);
md.push(`| &nbsp;&nbsp; synonym pair (pick one) | ${synonym.length} | ${synonym.reduce((s, [, r]) => s + r.count, 0)} |`);
md.push(`| &nbsp;&nbsp; unknown / manual review | ${unknown.length} | ${unknown.reduce((s, [, r]) => s + r.count, 0)} |`);
md.push(`| **total distinct keywords** | **${usage.size}** | **${totalUsages}** |`);

function section(title, rows, fmt) {
  if (!rows.length) return;
  md.push('');
  md.push(`## ${title} (${rows.length})`);
  md.push('');
  md.push('| keyword | usages | action | sample docIds |');
  md.push('|---|---:|---|---|');
  for (const row of rows.sort((a, b) => b[1].count - a[1].count)) {
    const sample = [...row[1].docIds].slice(0, 3).join(', ');
    md.push(`| \`${row[0]}\` | ${row[1].count} | ${fmt(row)} | ${sample}${row[1].docIds.size > 3 ? ', …' : ''} |`);
  }
}

section('Auto-fix candidates', autoFix, ([, , canon]) => `rewrite \`→ ${canon}\``);
section('Drop (redundant noise)', drop, () => 'strip from keywords[]');
section('Promote to controlledKeywords', promote, () => 'add to `site.json`');
section('Synonym pairs (pick one canonical)', synonym, ([, , partner]) => `paired with \`${partner}\``);
section('Unknown / manual review', unknown, () => 'review');

if (caseOnly.length) {
  md.push('');
  md.push(`## Case-only drift (${caseOnly.length})`);
  md.push('');
  md.push('| keyword | usages | canonical | sample docIds |');
  md.push('|---|---:|---|---|');
  for (const [k, rec, canon] of caseOnly.sort((a, b) => b[1].count - a[1].count)) {
    const sample = [...rec.docIds].slice(0, 3).join(', ');
    md.push(`| \`${k}\` | ${rec.count} | \`${canon}\` | ${sample}${rec.docIds.size > 3 ? ', …' : ''} |`);
  }
}

if (promote.length) {
  md.push('');
  md.push('## Ready-to-paste `controlledKeywords` additions');
  md.push('');
  md.push('Drop these into `src/main/config/site.json` `controlledKeywords` (re-sort the array alphabetically afterward):');
  md.push('');
  md.push('```json');
  md.push(JSON.stringify(promote.map(([k]) => k).sort(), null, 2));
  md.push('```');
}

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, md.join('\n') + '\n');

console.log(`Loaded ${docs.length} docs.`);
console.log(`Distinct keywords: ${usage.size}  (${totalUsages} usages)`);
console.log(`  exact-match:    ${exact.length}`);
console.log(`  case-only:      ${caseOnly.length}`);
console.log(`  out-of-vocab:   ${outOfVocab.length}`);
console.log(`    auto-fix:     ${autoFix.length}`);
console.log(`    drop:         ${drop.length}`);
console.log(`    promote:      ${promote.length}`);
console.log(`    synonym pair: ${synonym.length}`);
console.log(`    unknown:      ${unknown.length}`);
console.log(`\nWrote ${path.relative(REPO_ROOT, REPORT_PATH)}`);

// --- apply ------------------------------------------------------------------
// Walk every doc; if its keywords[] contains any AUTO_FIX or DROP target,
// rewrite the array and stamp `keywords$meta`. Preserve the earliest known
// `originalValue` so repeated runs don't lose the audit trail.
function scrubKeywordList(list) {
  const seen = new Set();
  const out = [];
  for (const k of list) {
    if (typeof k !== 'string') continue;
    if (DROP.has(k)) continue;
    const next = AUTO_FIX.has(k) ? AUTO_FIX.get(k) : k;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}
function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortKeysDeep(v[k]);
    return o;
  }
  return v;
}

const affected = [];
for (const d of docs) {
  const kw = d.keywords;
  if (!Array.isArray(kw) || !kw.length) continue;
  const next = scrubKeywordList(kw);
  if (next.length === kw.length && next.every((v, i) => v === kw[i])) continue;
  affected.push({ doc: d, before: kw, after: next });
}

console.log(`\nDocs needing keyword scrub: ${affected.length}`);
if (affected.length && !APPLY) {
  console.log('Sample (first 5):');
  for (const a of affected.slice(0, 5)) {
    console.log(`  ${a.doc.docId}`);
    console.log(`    before: ${JSON.stringify(a.before)}`);
    console.log(`    after:  ${JSON.stringify(a.after)}`);
  }
  console.log('\nDry-run — pass --apply to write.');
  process.exit(0);
}

if (!APPLY || !affected.length) process.exit(0);

let written = 0;
for (const { doc, before, after } of affected) {
  const prevMeta = doc['keywords$meta'] && typeof doc['keywords$meta'] === 'object' ? doc['keywords$meta'] : null;
  const originalValue = prevMeta && Array.isArray(prevMeta.originalValue) ? prevMeta.originalValue : before;
  doc.keywords = after;
  doc['keywords$meta'] = {
    source: 'parsed',
    confidence: 'high',
    note: `Scrubbed against ${SITE_PATH} controlledKeywords (auto-fix renames + drop noise)`,
    originalValue,
    updated: NOW,
    version: VERSION,
  };
  const sorted = sortKeysDeep(doc);
  const target = docAbsPath(sorted);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(sorted, null, 2) + '\n');
  written += 1;
}
console.log(`\nApplied keyword scrub to ${written} doc(s). Reminder: \`npm run canonicalize && npm run validate\`, then commit.`);
