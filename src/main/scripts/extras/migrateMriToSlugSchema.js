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

// One-time MRI schema migration to the slug-keyed model.
//
// Adds three fields to every refs[] entry:
//   - resolvedDocId : null | string
//   - needsResolve  : null | "known-publisher-no-doc" | "unknown-publisher"
//   - contentHash   : string  (sha256 of normalised raw citation, first 16 hex chars)
//
// Lifts every orphans.unmapped[] entry into refs[] keyed by a source-anchored
// slug `orphan/<sourceDoc>/<refXmlId>`. Empties orphans.unmapped[].
//
// Idempotent: re-running on an already-migrated MRI is a no-op.
//
// Usage:
//   node src/main/scripts/extras/migrateMriToSlugSchema.js
//   node src/main/scripts/extras/migrateMriToSlugSchema.js --apply

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const MRI_PATH = path.join('src', 'main', 'reports', 'masterReferenceIndex.json');
const APPLY = process.argv.includes('--apply');

function contentHash(rawRef) {
  // Normalise: drop the per-sighting `<ref id="X">` attribute (varies across sightings of
  // the same logical citation), collapse whitespace, strip XML entity casing variance.
  const norm = String(rawRef || '')
    .replace(/<ref\s+id="[^"]+"/g, '<ref')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!norm) return null;
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 16);
}

function refXmlIdOf(rawRef) {
  const m = String(rawRef || '').match(/<ref\s+id="([^"]+)"/);
  return m ? m[1] : null;
}

function classifyNeedsResolve(entry) {
  if (entry?.resolution?.sourcePresent) return null;
  return 'known-publisher-no-doc';
}

const mri = JSON.parse(fs.readFileSync(MRI_PATH, 'utf8'));

let refsTouched = 0;
let refsAlreadyMigrated = 0;
let orphansLifted = 0;
let orphansSkipped = 0;
let contentHashed = 0;

// 1. Augment every refs[] entry with the three new fields.
for (const [refId, entry] of Object.entries(mri.refs || {})) {
  let changed = false;
  if (entry.resolvedDocId === undefined) {
    entry.resolvedDocId = entry?.resolution?.sourceDocId || null;
    changed = true;
  }
  if (entry.needsResolve === undefined) {
    entry.needsResolve = classifyNeedsResolve(entry);
    changed = true;
  }
  if (entry.contentHash === undefined) {
    // Hash the FIRST rawVariant's rawRef — sightings of the same canonical refId should
    // hash identically post-normalisation; we just need one as the dedup anchor.
    const first = (entry.rawVariants || [])[0];
    entry.contentHash = first?.rawRef ? contentHash(first.rawRef) : null;
    if (entry.contentHash) contentHashed += 1;
    changed = true;
  }
  if (changed) refsTouched += 1;
  else refsAlreadyMigrated += 1;
}

// 2. Lift orphans.unmapped[] into refs[] as source-anchored slugs.
const unmapped = mri.orphans?.unmapped || [];
const survivingOrphans = [];
for (const o of unmapped) {
  const refXmlId = refXmlIdOf(o.rawRef);
  if (!o.docId || !refXmlId) {
    // Can't mint a deterministic slug — keep in unmapped for manual triage.
    survivingOrphans.push(o);
    orphansSkipped += 1;
    continue;
  }
  const slug = `orphan/${o.docId}/${refXmlId}`;
  if (mri.refs[slug]) {
    // Already migrated; skip.
    orphansSkipped += 1;
    continue;
  }
  mri.refs[slug] = {
    refId: slug,
    isOrphan: true,
    sourceDoc: o.docId,
    sourceRefId: refXmlId,
    citationText: o.cite || null,
    href: o.href || null,
    title: o.title || null,
    rawRef: o.rawRef || null,
    contentHash: contentHash(o.rawRef),
    resolvedDocId: null,
    needsResolve: 'unknown-publisher',
    rawVariants: [
      { docId: o.docId, type: o.type || null, cite: o.cite || null, href: o.href || null, rawRef: o.rawRef || null, title: o.title || null },
    ],
    provenance: {
      firstSeen: mri.generatedAt || new Date().toISOString(),
      mapSource: ['migrate-mri-slug-schema@v1'],
      mapDetails: [`lifted from orphans.unmapped`],
    },
  };
  orphansLifted += 1;
}

// 3. Replace orphans.unmapped with anything that couldn't be lifted (should be empty in practice).
if (mri.orphans) mri.orphans.unmapped = survivingOrphans;

// 4. Refresh stats.
mri.stats = mri.stats || {};
mri.stats.uniqueRefIds = Object.keys(mri.refs || {}).length;
mri.stats.resolvedCount = Object.values(mri.refs).filter((r) => !!r.resolvedDocId).length;
mri.stats.knownPublisherNoDocCount = Object.values(mri.refs).filter((r) => r.needsResolve === 'known-publisher-no-doc').length;
mri.stats.unknownPublisherOrphanCount = Object.values(mri.refs).filter((r) => r.needsResolve === 'unknown-publisher').length;
mri.stats.contentHashedCount = Object.values(mri.refs).filter((r) => r.contentHash).length;

console.log('=== MRI slug-schema migration ===');
console.log(`refs[] entries:                       ${mri.stats.uniqueRefIds}`);
console.log(`  newly augmented this run:           ${refsTouched}`);
console.log(`  already migrated (idempotent skip): ${refsAlreadyMigrated}`);
console.log(`  with contentHash computed:          ${contentHashed} (this run) / ${mri.stats.contentHashedCount} (total)`);
console.log('');
console.log(`orphans.unmapped[] migrated:          ${orphansLifted}`);
console.log(`orphans.unmapped[] left in place:     ${survivingOrphans.length}  (couldn't mint a deterministic slug)`);
console.log(`orphan dupes / already-lifted:        ${orphansSkipped}`);
console.log('');
console.log('Stats after migration:');
console.log(`  resolved (have resolvedDocId):       ${mri.stats.resolvedCount}`);
console.log(`  known-publisher-no-doc backlog:      ${mri.stats.knownPublisherNoDocCount}`);
console.log(`  unknown-publisher orphan backlog:    ${mri.stats.unknownPublisherOrphanCount}`);

if (APPLY) {
  mri.version = '2.0.0';                    // bump explicitly — the schema is no longer 1.0.0
  mri.generatedAt = new Date().toISOString();
  fs.writeFileSync(MRI_PATH, JSON.stringify(mri, null, 2) + '\n');
  console.log(`\nWrote ${path.relative(REPO_ROOT, MRI_PATH)} (version → 2.0.0).`);
} else {
  console.log('\nDry-run — pass --apply to write.');
}
