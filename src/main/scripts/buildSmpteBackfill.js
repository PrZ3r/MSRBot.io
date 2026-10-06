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

// SMPTE backfill list: every SMPTE edition we have evidence for but no digital copy of.
//
// Two kinds of evidence put an edition on the list:
//   - placeholder: a registry record with no href, created because a later edition's front page
//     names it ("Revision of …", see scanRevisionOf.js). It exists; we lack a copy, and usually
//     its own title and exact date.
//   - cited:       a SMPTE refId that registry documents cite but that isn't in the registry
//     (known-publisher-no-doc in the MRI presence audit). We lack the record entirely.
//
// Both are derived from the data, so the list shrinks on its own as editions are found and
// ingested. Output carries no timestamps: it changes only when the list does.
//
//   node src/main/scripts/buildSmpteBackfill.js
//   → src/main/reports/smpteBackfill.json, src/main/reports/smpteBackfill.md

const fs = require('fs');
const path = require('path');
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs } = require('../lib/registry');
const { loadMri } = require('../lib/mriStore');

const AUDIT = 'src/main/reports/mri_presence_audit.json';
const OUT_JSON = 'src/main/reports/smpteBackfill.json';
const OUT_MD = 'src/main/reports/smpteBackfill.md';
const PLACEHOLDER_NOTE = /^No digital copy available\./;

const byId = (a, b) => a.docId.localeCompare(b.docId, undefined, { numeric: true });
const DATED_TAIL = /\.((?:19|20)\d{2})(?:-\d{2})?$/;
const baseOf = (id) => String(id).replace(DATED_TAIL, '');
const yearOf = (id) => ((String(id).match(DATED_TAIL) || [])[1] || null);

const docs = loadAllDocs();
const smpte = docs.filter((d) => /^SMPTE\./.test(d.docId));
const editionsByBase = new Map();
for (const d of smpte) {
  const b = baseOf(d.docId);
  if (!editionsByBase.has(b)) editionsByBase.set(b, []);
  editionsByBase.get(b).push(d);
}
const mri = loadMri() || { refs: {} };
const citersOf = (id) => {
  const e = mri.refs[id];
  const seen = new Set();
  const out = [];
  for (const v of (e && e.rawVariants) || []) {
    if (seen.has(v.docId)) continue;
    seen.add(v.docId);
    out.push({ docId: v.docId, cite: v.cite ? String(v.cite).replace(/\s+/g, ' ').trim().slice(0, 200) : null });
  }
  return out.sort(byId);
};

// Placeholders: in the registry with no copy.
const placeholders = smpte
  .filter((d) => !d.href && PLACEHOLDER_NOTE.test(String((d.status || {}).statusNote || '')))
  .map((d) => ({
    docId: d.docId,
    kind: 'placeholder',
    docLabel: d.docLabel,
    docTitle: d.docTitle,
    year: yearOf(d.docId),
    evidence: {
      confirmedBy: (d.status && d.status.supersededBy) || [],
      sourcePdf: (d['docId$meta'] || {}).sourceUrl || null,
      citedBy: citersOf(d.docId),
    },
    titleFrom: /citation/.test(String((d['docTitle$meta'] || {}).note || '')) ? 'citation' : 'successor',
    needs: ['digital copy', 'approval or publication date', ...(/citation/.test(String((d['docTitle$meta'] || {}).note || '')) ? [] : ['own title'])],
  }))
  .sort(byId);

// Cited but not in the registry.
const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const cited = (audit.missing || [])
  .filter((m) => m && /^SMPTE\./.test(m.refId))
  .filter((m) => (m.needsResolve ? m.needsResolve === 'known-publisher-no-doc' : !m.isOrphan))
  .map((m) => {
    const held = (editionsByBase.get(baseOf(m.refId)) || []).map((d) => d.docId).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return {
      docId: m.refId,
      kind: 'cited',
      year: yearOf(m.refId),
      evidence: { citedBy: citersOf(m.refId) },
      editionsHeld: held,
      needs: ['existence (edition record)', 'title', 'date', 'digital copy'],
    };
  })
  .sort(byId);

const items = [...placeholders, ...cited].sort(byId);
const report = {
  $comment: 'Generated by src/main/scripts/buildSmpteBackfill.js. SMPTE editions with evidence of existence but no digital copy. Do not edit by hand.',
  counts: { total: items.length, placeholder: placeholders.length, cited: cited.length },
  items,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + '\n');

// Markdown
const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|');
const ids = (arr) => arr.map((x) => `\`${x}\``).join(', ');
const L = [];
L.push('# SMPTE backfill', '');
L.push('SMPTE editions we have **evidence** for but **no digital copy** of. Generated by `npm run build-smpte-backfill`; do not edit by hand. An edition leaves this list when it is ingested with a link (or, for a cited edition, a record).', '');
L.push('| Kind | Count | Evidence | Still needed |', '|---|---|---|---|');
L.push(`| Placeholder | ${placeholders.length} | Named on a later edition's front page ("Revision of …") | A digital copy, the approval/publication date, and for most, the edition's own title |`);
L.push(`| Cited | ${cited.length} | Cited by registry documents, not in the registry | Everything: confirmation of the edition, title, date, a copy |`);
L.push(`| **Total** | **${items.length}** | | |`, '');
L.push(`## Placeholders (${placeholders.length})`, '');
L.push('| Edition | Title (source) | Confirmed by | Cited by |', '|---|---|---|---|');
for (const p of placeholders) {
  L.push(`| \`${p.docId}\` | ${esc(p.docTitle)} (${p.titleFrom}) | ${ids(p.evidence.confirmedBy)} | ${p.evidence.citedBy.length || ''} |`);
}
L.push('', `## Cited, not in the registry (${cited.length})`, '');
L.push('| Edition | Cited by | Editions held | Example citation |', '|---|---|---|---|');
for (const c of cited) {
  const ex = (c.evidence.citedBy.find((x) => x.cite) || {}).cite || '';
  L.push(`| \`${c.docId}\` | ${c.evidence.citedBy.length} | ${c.editionsHeld.length ? ids(c.editionsHeld) : '—'} | ${esc(ex.slice(0, 90))} |`);
}
fs.writeFileSync(OUT_MD, L.join('\n') + '\n');

console.log(`SMPTE backfill: ${items.length} editions (${placeholders.length} placeholders, ${cited.length} cited) → ${OUT_JSON}, ${OUT_MD}`);
