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

// One-time merger for J##### / J#####XY same-article DOI registration twins.
// Both DOIs are real, distinct SMPTE registrations pointing to the same
// historical Transactions article (NLM extracted the bare J#####, APTARA
// extracted the J#####XY parallel registration). After this pass, both
// registry files carry equally complete metadata — each keeps its distinct
// `docId`/`doi`/`href`, but every other field is the union of NLM (rich
// abstract/authors) and APTARA (issue-level structured metadata) sources.
//
// Pairs flagged as DIFFERENT articles (title/vol/num/pages disagree — the
// XY suffix coincidentally collides with a numerically-adjacent article)
// are skipped automatically.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../lib/registry');

const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const VERSION = 'smpte-jxy-merge@v1';

const IDENTITY_FIELDS = new Set(['docId', 'doi', 'href']);
const RICH_FIELDS_FROM_BARE = ['abstract', 'authors'];

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortKeysDeep(v[k]);
    return o;
  }
  return v;
}

function mergeMeta(note) {
  return {
    source: 'merged',
    confidence: 'high',
    note,
    updated: NOW,
    version: VERSION,
  };
}

// Update the $meta on a field, recording that we cross-merged from the twin.
// Preserves the underlying source provenance by keeping the original $meta
// shape and just decorating note + version.
function decorateMeta(existing, twinDocId) {
  const n = existing && typeof existing === 'object' ? { ...existing } : {};
  const oldNote = n.note || '';
  n.note = `${oldNote}${oldNote ? ' · ' : ''}Cross-merged from same-article DOI twin ${twinDocId}`;
  n.updated = NOW;
  return n;
}

const docs = loadAllDocs();
const byId = new Map(docs.map((d) => [d.docId, d]));

// Group J##### / J#####XY pairs (both uppercase J, same numeric base).
const groups = new Map();
for (const d of docs) {
  const m = /^(10\.5594-J\d+[a-zA-Z0-9]*?)(XY)?$/.exec(d.docId);
  if (!m) continue;
  const base = m[1];
  const isXy = Boolean(m[2]);
  if (!groups.has(base)) groups.set(base, {});
  groups.get(base)[isXy ? 'xy' : 'bare'] = d;
}

let sameArticle = 0;
let differentArticle = 0;
let writtenBare = 0;
let writtenXy = 0;
const skipped = [];

function sameArticleFingerprint(a, b) {
  const norm = (s) => String(s || '').trim().toLowerCase();
  return norm(a.docTitle) === norm(b.docTitle)
    && String(a.volume || '') === String(b.volume || '')
    && String(a.number || '') === String(b.number || '')
    && String(a.pages || '') === String(b.pages || '');
}

function mergeIntoXy(bare, xy) {
  // Copy fields where bare has data, xy doesn't, OR bare's value is richer.
  // For the conflict set, prefer bare (NLM-source is canonical for content).
  // Preserve xy's identity fields (docId, doi, href).
  let mutated = 0;

  // 1. Rich content fields — only fill if xy lacks them.
  for (const f of RICH_FIELDS_FROM_BARE) {
    if (bare[f] != null && bare[f] !== '' && (xy[f] == null || xy[f] === '' || (Array.isArray(xy[f]) && xy[f].length === 0))) {
      xy[f] = bare[f];
      xy[`${f}$meta`] = bare[`${f}$meta`] ? decorateMeta(bare[`${f}$meta`], bare.docId) : mergeMeta(`Cross-merged from same-article DOI twin ${bare.docId}`);
      mutated += 1;
    }
  }

  // 2. publicationDate / docLabel — prefer bare's value when it's more precise.
  if (bare.publicationDate && xy.publicationDate && bare.publicationDate.length >= xy.publicationDate.length && bare.publicationDate !== xy.publicationDate) {
    // Bare typically has -MM- where xy has -01- (year-only padded).
    const bareMonth = (bare.publicationDate.match(/^\d{4}-(\d{2})/) || [])[1];
    const xyMonth = (xy.publicationDate.match(/^\d{4}-(\d{2})/) || [])[1];
    if (bareMonth && xyMonth === '01' && bareMonth !== '01') {
      xy.publicationDate = bare.publicationDate;
      xy['publicationDate$meta'] = decorateMeta(bare['publicationDate$meta'], bare.docId);
      mutated += 1;
    }
  }
  if (bare.docLabel && xy.docLabel && bare.docLabel !== xy.docLabel && bare.docLabel.length > xy.docLabel.length) {
    xy.docLabel = bare.docLabel;
    xy['docLabel$meta'] = decorateMeta(bare['docLabel$meta'], bare.docId);
    mutated += 1;
  }

  return mutated;
}

function mergeIntoBare(bare, xy) {
  // Bare is canonical for content. Pull from xy only when bare is missing
  // a structured field xy has (rare given NLM dominance for these eras).
  let mutated = 0;
  for (const f of ['articleType', 'abbrevTitle']) {
    if ((bare[f] == null || bare[f] === '') && xy[f] != null && xy[f] !== '') {
      bare[f] = xy[f];
      bare[`${f}$meta`] = decorateMeta(xy[`${f}$meta`], xy.docId);
      mutated += 1;
    }
  }
  return mutated;
}

for (const [base, pair] of groups) {
  if (!pair.bare || !pair.xy) continue;
  if (!sameArticleFingerprint(pair.bare, pair.xy)) {
    differentArticle += 1;
    skipped.push({ base, reason: 'different-article fingerprint (vol/num/pages/title differ)' });
    continue;
  }
  sameArticle += 1;
  const bareMutations = mergeIntoBare(pair.bare, pair.xy);
  const xyMutations = mergeIntoXy(pair.bare, pair.xy);

  if (APPLY) {
    if (bareMutations) {
      const sorted = sortKeysDeep(pair.bare);
      fs.writeFileSync(docAbsPath(sorted), JSON.stringify(sorted, null, 2) + '\n');
      writtenBare += 1;
    }
    if (xyMutations) {
      const sorted = sortKeysDeep(pair.xy);
      fs.writeFileSync(docAbsPath(sorted), JSON.stringify(sorted, null, 2) + '\n');
      writtenXy += 1;
    }
  } else {
    if (bareMutations) writtenBare += 1;
    if (xyMutations) writtenXy += 1;
  }
}

console.log(`J/JXY pair groups: ${[...groups.values()].filter((g) => g.bare && g.xy).length}`);
console.log(`  same-article (merged):      ${sameArticle}`);
console.log(`    bare files updated:       ${writtenBare}${APPLY ? '' : ' (dry-run)'}`);
console.log(`    XY files enriched:        ${writtenXy}${APPLY ? '' : ' (dry-run)'}`);
console.log(`  different-article (skipped): ${differentArticle}`);
if (!APPLY) console.log('\nDry-run — pass --apply to write.');
