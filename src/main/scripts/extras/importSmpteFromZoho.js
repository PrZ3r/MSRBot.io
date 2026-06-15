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

// ONE-OFF wholesale-import of SMPTE standards docs straight from the Zoho
// export — for cases where you've already triaged a specific docId as a real
// new doc and want it imported without going through a full coverage extractor.
//
// CLI:
//   --docs <id1,id2,...>   comma-separated docIds (Zoho-derived form). Default
//                          imports SMPTE.ST292-0.2011 only.
//   --apply                write the doc files (default dry-run)
//
// Each requested docId is matched against Zoho by `DOI_IEEE` and built into a
// full per-doc registry doc with $meta provenance smpte-zoho-standards@v1.
// Validates against the schema before writing; refuses to overwrite an
// existing doc unless the docId isn't already in the registry.

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../lib/registry');
const { doiToDocId } = require('../utils/parseSourceName');

const ZOHO_PATH = path.join(REPO_ROOT, '_source', 'SMPTE', 'Zoho',
  'SMPTE Standards Document Zoho Export 2026-05-21.json');
const SCHEMA_PATH = path.join(REPO_ROOT, 'src', 'main', 'schemas', 'documents.schema.json');
const ZOHO_REL = path.relative(REPO_ROOT, ZOHO_PATH);

const APPLY = process.argv.includes('--apply');
function argStr(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] != null ? process.argv[i + 1] : def;
}
const DOCS_ARG = argStr('--docs', 'SMPTE.ST292-0.2011');
const TARGETS = DOCS_ARG.split(',').map((s) => s.trim()).filter(Boolean);

const NOW = new Date().toISOString();
const VERSION = 'smpte-zoho-standards@v1';

const SUB_TYPE_TO_DOC_TYPE = {
  'SMPTE Standard': 'Standard',
  'SMPTE Recommended Practice': 'Recommended Practice',
  'SMPTE Engineering Guideline': 'Engineering Guideline',
  'SMPTE Overview Document': 'Overview Document',
  'SMPTE Amendment': 'Standard',
  'No': 'Registered Disclosure Document',
};

const trim = (s) => String(s == null ? '' : s).trim();
const dateNorm = (s) => {
  const t = trim(s);
  if (!t) return '';
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return t;
};

function parsedMeta(note) {
  return {
    source: 'parsed',
    confidence: 'high',
    note: note || `Imported from Zoho standards export (${ZOHO_REL})`,
    updated: NOW,
    version: VERSION,
  };
}

function inferredMeta(note) {
  return {
    source: 'inferred',
    confidence: 'high',
    note,
    updated: NOW,
    version: VERSION,
  };
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

// Build a per-doc registry doc from one Zoho record.
function buildDoc(r) {
  const docId = doiToDocId(r.DOI_IEEE);
  if (!docId) throw new Error(`Could not derive docId from DOI ${r.DOI_IEEE}`);
  const docType = SUB_TYPE_TO_DOC_TYPE[r.Sub_Type]
    || (r.Type === 'Registered Disclosure Documents' ? 'Registered Disclosure Document' : null);
  if (!docType) throw new Error(`No docType mapping for Sub_Type=${JSON.stringify(r.Sub_Type)}`);

  const docNumber = trim(r.Document_Number).replace(/^\s+/, '');
  const docLabel = docNumber ? `SMPTE ${docNumber}` : `SMPTE ${docId}`;
  const doc = {};

  // identity
  doc.docId = docId;
  doc.docId$meta = inferredMeta(`Derived from Zoho DOI_IEEE (${r.DOI_IEEE})`);
  doc.doi = r.DOI_IEEE;
  doc.doi$meta = parsedMeta();
  doc.href = `https://doi.org/${r.DOI_IEEE}`;
  doc.href$meta = inferredMeta(`Constructed from DOI (${r.DOI_IEEE})`);
  doc.docType = docType;
  doc.docType$meta = inferredMeta(`Mapped from Zoho Sub_Type=${JSON.stringify(r.Sub_Type)}`);
  doc.publisher = 'SMPTE';
  doc.publisher$meta = inferredMeta('SMPTE-published standards document');
  doc.docTitle = trim(r.Document_Title);
  doc.docTitle$meta = parsedMeta();
  doc.docLabel = docLabel;
  doc.docLabel$meta = inferredMeta(`Composed from Zoho Document_Number=${JSON.stringify(docNumber)}`);

  // numbering
  if (r['Root_Number_Name.Root_Number']) {
    doc.docNumber = trim(r['Root_Number_Name.Root_Number']);
    doc.docNumber$meta = parsedMeta();
  }
  if (r['Root_Number_Name.Root_Name']) {
    doc.docSuiteTitle = trim(r['Root_Number_Name.Root_Name']);
    doc.docSuiteTitle$meta = parsedMeta();
  }
  // docPart — derive from docId suffix after first dash before .YYYY
  const partMatch = docId.match(/^SMPTE\.[A-Z]+\d+-([0-9A-Za-z]+)\./);
  if (partMatch) {
    doc.docPart = partMatch[1];
    doc.docPart$meta = inferredMeta(`Extracted from docId suffix`);
  }

  // dates
  const pubDate = dateNorm(r.Publication_Date);
  if (pubDate) { doc.publicationDate = pubDate; doc.publicationDate$meta = parsedMeta(); }
  const apprDate = dateNorm(r.Approval_Date);
  if (apprDate) { doc.approvalDate = apprDate; doc.approvalDate$meta = parsedMeta(); }

  // identifiers / pages
  if (trim(r.ISBN)) { doc.isbn = trim(r.ISBN); doc.isbn$meta = parsedMeta(); }
  if (trim(r.Product_Code)) { doc.productNumber = trim(r.Product_Code); doc.productNumber$meta = parsedMeta(); }
  if (trim(r.Number_of_Pages)) { doc.numberOfPages = trim(r.Number_of_Pages); doc.numberOfPages$meta = parsedMeta(); }

  // copyright
  if (trim(r.Copyright_Year)) {
    const year = (String(r.Copyright_Year).match(/^\d{4}/) || [''])[0];
    if (year) {
      doc.copyright = { year, year$meta: parsedMeta() };
    }
  }

  // icsCodes
  const ics = [];
  const seenIcs = new Set();
  for (let i = 1; i <= 3; i += 1) {
    const code = trim(r[`ICS_Number_Topic_${i}.ICS_Number`]);
    const desc = trim(r[`ICS_Number_Topic_${i}.ICS_Topic`]);
    if (code && !seenIcs.has(code)) {
      seenIcs.add(code);
      const item = { code };
      if (desc) item.description = desc;
      ics.push(item);
    }
  }
  if (ics.length) { doc.icsCodes = ics; doc.icsCodes$meta = parsedMeta(); }

  // status
  const status = {};
  const statusLower = trim(r.Status).toLowerCase();
  if (statusLower === 'active') {
    status.active = true;
    status.active$meta = parsedMeta(`Mapped from Zoho Status="Active"`);
  } else if (statusLower === 'inactive' || statusLower === 'superseded') {
    status.active = false;
    status.active$meta = parsedMeta(`Mapped from Zoho Status=${JSON.stringify(r.Status)}`);
  } else {
    status.active = true;
    status.active$meta = inferredMeta(`Zoho Status=${JSON.stringify(r.Status)} — defaulted active`);
  }
  const modifierLower = trim(r.Modifier).toLowerCase();
  if (/superseded/.test(modifierLower)) {
    status.superseded = true;
    status.superseded$meta = parsedMeta(`Mapped from Zoho Modifier=${JSON.stringify(r.Modifier)}`);
  }
  if (/withdrawn/.test(modifierLower)) {
    status.withdrawn = true;
    status.withdrawn$meta = parsedMeta(`Mapped from Zoho Modifier=${JSON.stringify(r.Modifier)}`);
  }
  if (dateNorm(r.Stabilized_Date)) {
    status.stabilizedDate = dateNorm(r.Stabilized_Date);
    status.stabilizedDate$meta = parsedMeta();
  }
  if (dateNorm(r.Reaffirm_Date)) {
    status.reaffirmDate = dateNorm(r.Reaffirm_Date);
    status.reaffirmDate$meta = parsedMeta();
  }
  doc.status = status;

  return sortKeysDeep(doc);
}

const docs = loadAllDocs();
const existing = new Set(docs.map((d) => d.docId));
const zohoData = JSON.parse(fs.readFileSync(ZOHO_PATH, 'utf8'));
const zohoRecords = [].concat(...Object.values(zohoData));
const zohoByDocId = new Map();
for (const r of zohoRecords) {
  if (!r.DOI_IEEE) continue;
  const id = doiToDocId(r.DOI_IEEE);
  if (id) zohoByDocId.set(id, r);
}

console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Targets: ${TARGETS.length} (${TARGETS.join(', ')})`);
console.log('');

const ajv = new Ajv({ allErrors: true, strict: false });
const validateDoc = ajv.compile(JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')).items);

const planned = [];
for (const docId of TARGETS) {
  const r = zohoByDocId.get(docId);
  if (!r) { console.log(`  ❌ ${docId}: not found in Zoho — skip`); continue; }
  if (existing.has(docId)) { console.log(`  ❌ ${docId}: already in registry — skip (won't overwrite)`); continue; }
  let doc;
  try { doc = buildDoc(r); }
  catch (e) { console.log(`  ❌ ${docId}: build error — ${e.message}`); continue; }
  const ok = validateDoc(doc);
  if (!ok) {
    console.log(`  ❌ ${docId}: schema-invalid — ${(validateDoc.errors || []).slice(0, 3).map((e) => `${e.instancePath || e.dataPath || '/'} ${e.message}`).join(' | ')}`);
    continue;
  }
  const target = path.join('src', 'main', 'data', 'docs', require('../../lib/registry').docPath(doc));
  console.log(`  ✅ ${docId} → ${target}`);
  console.log(`     docType=${doc.docType}  docLabel=${JSON.stringify(doc.docLabel)}`);
  console.log(`     docTitle=${JSON.stringify((doc.docTitle || '').slice(0, 60))}`);
  planned.push({ docId, doc, target });
}

console.log('');
console.log(`Planned writes: ${planned.length}`);

if (!APPLY) {
  if (planned.length === 1) {
    console.log('\n-- Full sample doc --');
    console.log(JSON.stringify(planned[0].doc, null, 2));
  }
  console.log('\nDry run — pass --apply to write.');
  process.exit(0);
}

let written = 0;
for (const { doc } of planned) {
  const target = docAbsPath(doc);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
  written += 1;
}
console.log(`\nApplied ${written} doc(s). Reminder: run \`npm run canonicalize\` and \`npm run validate\`, then commit.`);
