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

// ONE-TIME SMPTE cross-fill from the Zoho Standards Document export.
//
// Operates one --field at a time. Adds the field's value from Zoho onto
// overlap-registry docs that are currently empty for that field; never
// overwrites a populated value. Conflicts (registry has X, Zoho has different
// Y) are logged for human review, not written.
//
// CLI:
//   --field <name>      field to cross-fill (required)
//   --apply             write changes (default dry-run)
//   --zoho-wins         overwrite conflicts with Zoho's value (audit-traceable
//                       via $meta.originalValue + overridden: true).
//   --merge-conflicts   for fields whose def supplies a `conflictMerge`
//                       function (e.g. icsCodes), union the registry and Zoho
//                       values rather than overwrite. Use when "conflict"
//                       really means complementary, not contradictory.
//                       Mutually exclusive with --zoho-wins.
//   --max-conflicts     cap the conflict list in console output (default 200)
//
// Available fields:
//   isbn                       string
//   copyright.year             nested under copyright object
//   productNumber              string
//   numberOfPages              new field — additionalProperties allows it
//   status.reaffirmDate        nested under status object (date)
//
// Reports:
//   src/main/reports/zohoCrossfill.{field}.md  (per-field conflict log)

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../lib/registry');
const { doiToDocId } = require('../utils/parseSourceName');

const ZOHO_PATH = path.join(REPO_ROOT, '_source', 'SMPTE', 'Zoho',
  'SMPTE Standards Document Zoho Export 2026-05-21.json');

const APPLY = process.argv.includes('--apply');
const ZOHO_WINS = process.argv.includes('--zoho-wins');
const MERGE_CONFLICTS = process.argv.includes('--merge-conflicts');
if (ZOHO_WINS && MERGE_CONFLICTS) {
  console.error('Cannot combine --zoho-wins and --merge-conflicts; pick one.');
  process.exit(1);
}
function argStr(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] != null ? process.argv[i + 1] : def;
}
function argInt(name, def) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1] != null) {
    const n = parseInt(process.argv[i + 1], 10);
    if (Number.isFinite(n)) return n;
  }
  return def;
}
const FIELD = argStr('--field', null);
const MAX_CONFLICTS = argInt('--max-conflicts', 200);
const NOW = new Date().toISOString();
const VERSION = 'smpte-zoho-standards@v1';
const ZOHO_REL = path.relative(REPO_ROOT, ZOHO_PATH);

// --- normalisers --------------------------------------------------------------
const trim = (s) => String(s == null ? '' : s).trim();
const lower = (s) => trim(s).toLowerCase();
const digitsOnly = (s) => trim(s).replace(/\D/g, '');
function dateNorm(s) {
  const t = trim(s);
  if (!t) return '';
  const isoMatch = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const slashMatch = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`;
  }
  return t;
}

// --- field definitions --------------------------------------------------------
// For nested fields, `path` is dotted; getReg / setReg walk the doc accordingly.
const FIELDS = {
  isbn: {
    zohoKey: 'ISBN',
    path: ['isbn'],
    normalize: digitsOnly,
    transform: (raw) => trim(raw),
  },
  'copyright.year': {
    zohoKey: 'Copyright_Year',
    path: ['copyright', 'year'],
    normalize: digitsOnly,
    transform: (raw) => (String(raw).match(/^\d{4}/) || [''])[0],
  },
  productNumber: {
    zohoKey: 'Product_Code',
    path: ['productNumber'],
    normalize: trim,
    transform: (raw) => trim(raw),
  },
  numberOfPages: {
    zohoKey: 'Number_of_Pages',
    path: ['numberOfPages'],
    normalize: digitsOnly,
    transform: (raw) => trim(raw),
  },
  'status.reaffirmDate': {
    zohoKey: 'Reaffirm_Date',
    path: ['status', 'reaffirmDate'],
    normalize: dateNorm,
    transform: (raw) => dateNorm(raw),
  },
  'status.stabilizedDate': {
    zohoKey: 'Stabilized_Date',
    path: ['status', 'stabilizedDate'],
    normalize: dateNorm,
    transform: (raw) => dateNorm(raw),
  },
  approvalDate: {
    zohoKey: 'Approval_Date',
    path: ['approvalDate'],
    normalize: dateNorm,
    transform: (raw) => dateNorm(raw),
  },
  // status booleans — derived from Zoho's free-text Modifier column.
  // transform returns true (set the flag), false (explicitly clear it), or
  // null (Zoho carries no signal — leave the doc alone).
  'status.superseded': {
    zohoKey: 'Modifier',
    path: ['status', 'superseded'],
    normalize: (v) => (v === true ? 'true' : (v === false ? 'false' : '')),
    transform: (raw) => (/^superseded$/i.test(trim(raw)) ? true : null),
  },
  'status.withdrawn': {
    zohoKey: 'Modifier',
    path: ['status', 'withdrawn'],
    normalize: (v) => (v === true ? 'true' : (v === false ? 'false' : '')),
    transform: (raw) => (/^withdrawn$/i.test(trim(raw)) ? true : null),
  },
  // icsCodes derives from three flat Zoho columns rather than a single key,
  // so the transform reads the whole record (passed as second arg). Output
  // shape matches the registry's existing icsCodes items: {code, description?}.
  // Duplicates within a record are collapsed; comparison sorts both sides.
  docTitle: {
    zohoKey: 'Document_Title',
    path: ['docTitle'],
    normalize: lower,
    transform: (raw) => trim(raw),
  },
  icsCodes: {
    zohoKey: null,
    path: ['icsCodes'],
    normalize: (v) => {
      if (!Array.isArray(v) || !v.length) return '';
      const dedup = new Map();
      for (const e of v) {
        if (!e || !e.code) continue;
        if (!dedup.has(e.code)) dedup.set(e.code, e.description || '');
      }
      const sorted = [...dedup.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      return JSON.stringify(sorted.map(([code, description]) => ({ code, description })));
    },
    transform: (_, r) => {
      const seen = new Set();
      const codes = [];
      for (let i = 1; i <= 3; i += 1) {
        const code = trim(r[`ICS_Number_Topic_${i}.ICS_Number`]);
        const desc = trim(r[`ICS_Number_Topic_${i}.ICS_Topic`]);
        if (!code || seen.has(code)) continue;
        seen.add(code);
        const item = { code };
        if (desc) item.description = desc;
        codes.push(item);
      }
      return codes.length ? codes : null;
    },
    // Union the two ICS sets, deduped by code (registry's description wins when
    // both sides describe the same code). Used with --merge-conflicts.
    conflictMerge: (regVal, zohoVal) => {
      const merged = new Map();
      const lists = [regVal, zohoVal].filter(Array.isArray);
      for (const arr of lists) {
        for (const e of arr) {
          if (!e || !e.code) continue;
          if (!merged.has(e.code)) merged.set(e.code, e.description || '');
        }
      }
      return [...merged.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, description]) => {
        const item = { code };
        if (description) item.description = description;
        return item;
      });
    },
  },
};

function getDeep(obj, parts) {
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

// Return the `$meta` sibling object for a field at the given path. For nested
// fields (copyright.year, status.reaffirmDate), `$meta` lives inside the
// container at `<lastKey>$meta` — that's the existing repo convention.
function getDeepMeta(obj, parts) {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[parts[i]];
  }
  if (cur == null || typeof cur !== 'object') return undefined;
  return cur[`${parts[parts.length - 1]}$meta`];
}

// Set nested path; create intermediate objects when missing. Also writes
// `<lastKey>$meta` next to the field. For container objects (status, copyright)
// the container itself doesn't get a top-level $meta — only its sub-fields do,
// matching the existing per-doc convention.
function setDeepWithMeta(obj, parts, value, meta) {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  cur[last] = value;
  cur[`${last}$meta`] = meta;
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

// --- main ---------------------------------------------------------------------
if (!FIELD || !FIELDS[FIELD]) {
  console.error(`Specify --field <name>. Available: ${Object.keys(FIELDS).join(', ')}`);
  process.exit(1);
}
const def = FIELDS[FIELD];

if (!fs.existsSync(ZOHO_PATH)) {
  console.error(`Zoho export not found: ${ZOHO_PATH}`);
  process.exit(1);
}

console.log(`Loading Zoho export…`);
const zohoData = JSON.parse(fs.readFileSync(ZOHO_PATH, 'utf8'));
const zohoRecords = [].concat(...Object.values(zohoData));
console.log(`  ${zohoRecords.length} Zoho records`);

console.log(`Loading registry…`);
const docs = loadAllDocs();
const byId = new Map(docs.map((d) => [d.docId, d]));
console.log(`  ${docs.length} registry docs`);

const meta = {
  source: 'parsed',
  confidence: 'high',
  note: `Cross-filled from Zoho standards export (${ZOHO_REL})`,
  updated: NOW,
  version: VERSION,
};

const adds = [];
const conflicts = [];
const agrees = [];
const regOnly = [];
const bothEmpty = [];
const noMatch = [];
const locked = []; // docs with $meta.excludeChanges = true on this field

for (const r of zohoRecords) {
  if (!r.DOI_IEEE) continue;
  const docId = doiToDocId(r.DOI_IEEE);
  if (!docId) continue;
  const doc = byId.get(docId);
  if (!doc) { noMatch.push(docId); continue; }
  const regVal = getDeep(doc, def.path);
  const regMeta = getDeepMeta(doc, def.path);
  const zohoRaw = def.zohoKey ? r[def.zohoKey] : null;
  const newVal = def.transform(zohoRaw, r);
  const regNorm = def.normalize(regVal);
  const zohoNorm = def.normalize(newVal);
  // Hard lock — never touch a field whose $meta says excludeChanges: true.
  // Honoured even with --zoho-wins or --merge-conflicts.
  if (regMeta && regMeta.excludeChanges === true) {
    locked.push({ docId, registry: regVal, zoho: newVal });
    continue;
  }
  if (!regNorm && !zohoNorm) bothEmpty.push(docId);
  else if (!regNorm && zohoNorm) adds.push({ docId, value: newVal });
  else if (regNorm && !zohoNorm) regOnly.push(docId);
  else if (regNorm === zohoNorm) agrees.push(docId);
  else conflicts.push({ docId, registry: regVal, registryMeta: regMeta, zoho: newVal });
}

console.log('');
console.log(`=== Field: ${FIELD}    Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}${
  ZOHO_WINS ? ' (Zoho wins on conflicts)' :
  MERGE_CONFLICTS ? (def.conflictMerge ? ' (merge conflicts)' : ' (merge requested but field has no conflictMerge — conflicts skipped)') :
  ''
} ===`);
console.log(`  Add (registry empty, Zoho fills):  ${adds.length}`);
console.log(`  Conflict (different values):        ${conflicts.length}`);
console.log(`  Agree (same value, no-op):          ${agrees.length}`);
console.log(`  Registry-only (Zoho empty):         ${regOnly.length}`);
console.log(`  Both empty:                         ${bothEmpty.length}`);
console.log(`  Locked ($meta.excludeChanges):      ${locked.length}`);
console.log(`  Zoho records with no registry doc:  ${noMatch.length}`);

function fmtMeta(m) {
  if (!m) return '(no $meta)';
  const bits = [];
  if (m.source) bits.push(`source=${m.source}`);
  if (m.confidence) bits.push(`conf=${m.confidence}`);
  if (m.version) bits.push(`ver=${m.version}`);
  if (m.updated) bits.push(`updated=${String(m.updated).slice(0, 10)}`);
  if (m.note) bits.push(`note=${JSON.stringify(String(m.note).slice(0, 70))}`);
  return bits.join(' · ');
}

console.log('');
console.log(`-- Conflicts (${conflicts.length}${conflicts.length > MAX_CONFLICTS ? ` — first ${MAX_CONFLICTS}` : ''}) --`);
for (const c of conflicts.slice(0, MAX_CONFLICTS)) {
  console.log(`  ${c.docId}`);
  console.log(`    reg = ${JSON.stringify(c.registry)}`);
  console.log(`    meta: ${fmtMeta(c.registryMeta)}`);
  console.log(`    zoho = ${JSON.stringify(c.zoho)}`);
}

// Per-field conflict report (markdown), always written
const reportPath = path.join(REPO_ROOT, 'src', 'main', 'reports',
  `zohoCrossfill.${FIELD.replace(/\./g, '_')}.md`);
const md = [];
md.push(`# Zoho cross-fill — ${FIELD} — ${NOW}`);
md.push('');
md.push(`Mode: **${APPLY ? 'APPLY' : 'DRY-RUN'}** · source: \`${ZOHO_REL}\``);
md.push('');
md.push('## Totals');
md.push(`- Add: ${adds.length}`);
md.push(`- Conflict: ${conflicts.length}`);
md.push(`- Agree: ${agrees.length}`);
md.push(`- Registry-only: ${regOnly.length}`);
md.push(`- Both empty: ${bothEmpty.length}`);
md.push(`- No registry doc: ${noMatch.length}`);
md.push('');
md.push(`## Conflicts (${conflicts.length})`);
md.push('');
md.push('| docId | registry | zoho | registry $meta |');
md.push('|---|---|---|---|');
for (const c of conflicts) {
  const metaStr = c.registryMeta ? '`' + JSON.stringify(c.registryMeta).replace(/\|/g, '\\|') + '`' : '*(no $meta)*';
  md.push(`| \`${c.docId}\` | \`${c.registry == null ? '' : c.registry}\` | \`${c.zoho}\` | ${metaStr} |`);
}
fs.writeFileSync(reportPath, md.join('\n') + '\n');
console.log(`\nWrote ${path.relative(REPO_ROOT, reportPath)}`);

if (!APPLY) {
  let suffix = '. Conflicts are never overwritten in default mode.';
  if (ZOHO_WINS) suffix = ` + ${conflicts.length} conflict overwrite(s).`;
  if (MERGE_CONFLICTS && def.conflictMerge) suffix = ` + ${conflicts.length} conflict merge(s).`;
  console.log(`\nDry run — pass --apply to write ${adds.length} adds${suffix}`);
  if (MERGE_CONFLICTS && def.conflictMerge && conflicts.length) {
    console.log(`\n-- Sample merged values (first 3) --`);
    for (const c of conflicts.slice(0, 3)) {
      const merged = def.conflictMerge(c.registry, c.zoho);
      console.log(`  ${c.docId}`);
      console.log(`    merged = ${JSON.stringify(merged)}`);
    }
  }
  process.exit(0);
}

// Apply: write ADDS and (if --zoho-wins or --merge-conflicts) the matching
// conflict resolutions. Bypass saveDoc for speed (no index rebuild churn).
let writtenAdds = 0;
let writtenOverwrites = 0;
let writtenMerges = 0;
const toWrite = [...adds.map((a) => ({ ...a, kind: 'add' }))];
if (ZOHO_WINS) {
  for (const c of conflicts) {
    toWrite.push({ docId: c.docId, value: c.zoho, kind: 'overwrite', originalValue: c.registry });
  }
} else if (MERGE_CONFLICTS && def.conflictMerge) {
  for (const c of conflicts) {
    const merged = def.conflictMerge(c.registry, c.zoho);
    toWrite.push({ docId: c.docId, value: merged, kind: 'merge', originalValue: c.registry });
  }
}
for (const item of toWrite) {
  const doc = byId.get(item.docId);
  const fieldMeta = { ...meta };
  if (item.kind === 'overwrite') {
    fieldMeta.originalValue = item.originalValue == null ? null : item.originalValue;
    fieldMeta.overridden = true;
    fieldMeta.note = `Cross-filled from Zoho standards export (${ZOHO_REL}); Zoho is canonical for SMPTE standards metadata, registry value overwritten`;
  } else if (item.kind === 'merge') {
    fieldMeta.originalValue = item.originalValue == null ? null : item.originalValue;
    fieldMeta.note = `Cross-filled from Zoho standards export (${ZOHO_REL}); registry value merged with Zoho's set (union deduped)`;
  }
  setDeepWithMeta(doc, def.path, item.value, fieldMeta);
  const sorted = sortKeysDeep(doc);
  const target = docAbsPath(sorted);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(sorted, null, 2) + '\n');
  if (item.kind === 'add') writtenAdds += 1;
  else if (item.kind === 'overwrite') writtenOverwrites += 1;
  else writtenMerges += 1;
}
const summary = [`${writtenAdds} adds`];
if (writtenOverwrites) summary.push(`${writtenOverwrites} overwrites`);
if (writtenMerges) summary.push(`${writtenMerges} merges`);
console.log(`\nApplied ${summary.join(' + ')}.`);
console.log('Reminder: run `npm run canonicalize` and `npm run validate`, then commit.');
