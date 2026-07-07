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

// Idempotent MRI-only retry pass. Walks every `MRI.refs[]` entry where
// `resolvedDocId === null` and tries to resolve it through the current parser
// + refMap + registry. When a hit is found:
//   - the entry's `resolvedDocId` is set and `needsResolve` is cleared
//   - every sibling sharing the same `contentHash` is updated in the same
//     pass (so one decision propagates across N sightings of identical raw
//     citations across multiple source docs).
//
// No doc files are touched. Run as often as you want — every additional
// parser family, refMap entry, or registry ingestion can graduate more
// orphans on the next pass.
//
// Usage:
//   node src/main/scripts/extras/resolveOrphans.js           # dry-run
//   node src/main/scripts/extras/resolveOrphans.js --apply   # write MRI

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs } = require('../../lib/registry');
const { parseRefId, mapRefByCite } = require('../../lib/referencing');

const MRI_PATH = path.join('src', 'main', 'reports', 'masterReferenceIndex.json');
const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();

const mri = JSON.parse(fs.readFileSync(MRI_PATH, 'utf8'));
const refs = mri.refs || {};

// Build registry docId set (used to confirm a candidate refId is actually a
// real doc in the registry, not just a syntactically valid pattern).
const registryDocIds = new Set(loadAllDocs().map((d) => d.docId));

// Index orphans / known-publisher-no-docs by contentHash so a single
// resolution can fan out to every sibling sharing the hash.
const byHash = new Map();
for (const [refId, entry] of Object.entries(refs)) {
  if (entry && entry.resolvedDocId) continue; // already resolved
  if (!entry || !entry.contentHash) continue;
  const arr = byHash.get(entry.contentHash) || [];
  arr.push(refId);
  byHash.set(entry.contentHash, arr);
}

const groupResolutions = new Map(); // contentHash → resolvedDocId
const unresolved = [];

function tryResolve(entry) {
  const cite = entry.citationText || (entry.rawVariants && entry.rawVariants[0] && entry.rawVariants[0].cite) || '';
  const href = entry.href || (entry.rawVariants && entry.rawVariants[0] && entry.rawVariants[0].href) || '';

  // 1. If the refId itself is a docId in the registry (the canonical-form
  //    "known-publisher-no-doc" case — RFC1642, ASME.B1.1.1989, etc.), the
  //    ingestion already happened and resolvedDocId just needs to be set.
  if (entry.refId && registryDocIds.has(entry.refId)) {
    return { docId: entry.refId, via: 'registry-direct' };
  }

  // 2. parseRefId on the cite/href — a new parser family may now produce a
  //    canonical refId that exists in the registry.
  if (cite || href) {
    try {
      const parsed = parseRefId(cite, href);
      if (parsed && registryDocIds.has(parsed)) {
        return { docId: parsed, via: 'parseRefId' };
      }
    } catch {}
  }

  // 3. mapRefByCite — a new refMap entry may now resolve.
  if (cite) {
    try {
      const mapped = mapRefByCite(cite);
      if (mapped && registryDocIds.has(mapped)) {
        return { docId: mapped, via: 'refMap' };
      }
    } catch {}
  }

  return null;
}

let resolvedCount = 0;
let propagatedCount = 0;
const samples = [];

for (const [refId, entry] of Object.entries(refs)) {
  if (entry && entry.resolvedDocId) continue;
  // If a sibling in this entry's contentHash group already resolved this pass,
  // inherit the resolution without re-running the parser chain.
  let resolution = entry.contentHash && groupResolutions.get(entry.contentHash);
  let via = resolution ? 'contentHash-sibling' : null;
  if (!resolution) {
    const hit = tryResolve(entry);
    if (hit) {
      resolution = hit.docId;
      via = hit.via;
      if (entry.contentHash) groupResolutions.set(entry.contentHash, resolution);
    }
  }
  if (resolution) {
    if (via !== 'contentHash-sibling') {
      resolvedCount += 1;
    } else {
      propagatedCount += 1;
    }
    entry.resolvedDocId = resolution;
    entry.needsResolve = null;
    entry.provenance = entry.provenance || { mapSource: [], mapDetails: [] };
    entry.provenance.mapSource = Array.from(new Set([...(entry.provenance.mapSource || []), `resolveOrphans@${via}`]));
    entry.provenance.mapDetails = Array.from(new Set([...(entry.provenance.mapDetails || []), `resolved-at:${NOW}`]));
    if (samples.length < 10) samples.push({ refId, resolvedDocId: resolution, via });
  } else {
    unresolved.push(refId);
  }
}

const totalUnresolvedBefore = Object.values(refs).filter((e) => !e.resolvedDocId).length + resolvedCount + propagatedCount;

console.log('=== resolveOrphans pass ===');
console.log('');
console.log(`Entries scanned (unresolved-at-start):  ${totalUnresolvedBefore}`);
console.log(`  resolved this pass (direct):          ${resolvedCount}`);
console.log(`  propagated via contentHash sibling:   ${propagatedCount}`);
console.log(`  still unresolved:                     ${unresolved.length}`);

if (samples.length) {
  console.log('');
  console.log('Sample resolutions (first 10):');
  for (const s of samples) {
    console.log(`  ${s.refId}  →  ${s.resolvedDocId}  (${s.via})`);
  }
}

if (resolvedCount === 0 && propagatedCount === 0) {
  console.log('\nNo new resolutions this pass. Nothing to write.');
  process.exit(0);
}

if (!APPLY) {
  console.log('\nDry-run — pass --apply to write MRI.');
  process.exit(0);
}

// Persist
mri.generatedAt = NOW;
// Stats
mri.stats = mri.stats || {};
mri.stats.resolvedCount = Object.values(refs).filter((e) => !!e.resolvedDocId).length;
mri.stats.knownPublisherNoDocCount = Object.values(refs).filter((e) => e.needsResolve === 'known-publisher-no-doc').length;
mri.stats.unknownPublisherOrphanCount = Object.values(refs).filter((e) => e.needsResolve === 'unknown-publisher').length;

fs.writeFileSync(MRI_PATH, JSON.stringify(mri, null, 2) + '\n');
console.log(`\nWrote ${MRI_PATH} — ${resolvedCount + propagatedCount} entries updated.`);
