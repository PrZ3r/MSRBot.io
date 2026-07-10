/*
 * fixMergedOrphanSlugs.js — re-anchor orphan slugs after the XY twin merge.
 *
 * The merge unioned donor references into XY survivors, but orphan slugs
 * are SOURCE-ANCHORED: `orphan/<sourceDocId>/<refXmlId>`. The donors'
 * slugs still pointed at the retired plain docIds, so the build could no
 * longer derive lineage keys ("No lineage key derivable" warnings) and
 * MRI entries kept sourceDoc pointers at deleted docs.
 *
 * Fix, per XY survivor citing `orphan/<plainTwinId>/...`:
 *   1. doc.references[]: rename the slug to `orphan/<survivorId>/...`
 *   2. MRI.refs: move the entry to the new slug key — refId + sourceDoc
 *      re-anchored, rawVariants[].docId sightings updated from the
 *      retired donor to the survivor
 *
 * Idempotent: already-renamed slugs match nothing on re-run.
 *
 * Usage:
 *   node .../fixMergedOrphanSlugs.js            # dry-run
 *   node .../fixMergedOrphanSlugs.js --apply
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../../lib/registry');

const MRI_PATH = 'src/main/reports/masterReferenceIndex.json';
const APPLY = process.argv.includes('--apply');

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

const docs = loadAllDocs();
const byId = new Map(docs.map(d => [d.docId, d]));
const mri = JSON.parse(fs.readFileSync(MRI_PATH, 'utf8'));
const refs = mri.refs || {};

// Fallback: a post-merge build-mri prune deleted the donor-anchored orphan
// entries from the working MRI (43,405 → 42,928). The committed MRI still
// has them — recover entries from git when the working copy lacks a key.
const { execSync } = require('child_process');
let gitRefs = {};
try {
  execSync(`git show HEAD:${MRI_PATH} > /tmp/mri-HEAD.json`, { maxBuffer: 1024 * 1024 });
  gitRefs = JSON.parse(fs.readFileSync('/tmp/mri-HEAD.json', 'utf8')).refs || {};
  console.log(`[slug-fix] committed MRI loaded as recovery source (${Object.keys(gitRefs).length} refs)`);
} catch (e) {
  console.warn('[slug-fix] could not load committed MRI:', e.message);
}

let docsTouched = 0, slugsRenamed = 0, mriMoved = 0, mriMissing = 0, collisions = 0, mriRecovered = 0;
const touchedDocs = [];

for (const doc of docs) {
  if (!/XY$/.test(doc.docId)) continue;
  const donorId = doc.docId.replace(/XY$/, '');
  if (byId.has(donorId)) continue; // twin still present — this pair wasn't merged
  const prefix = `orphan/${donorId}/`;
  const newPrefix = `orphan/${doc.docId}/`;
  let changed = false;
  const r = doc.references || {};
  for (const cat of Object.keys(r)) {
    if (!Array.isArray(r[cat])) continue;
    r[cat] = r[cat].map(ref => {
      const s = String(ref);
      if (!s.startsWith(prefix)) return ref;
      const renamed = newPrefix + s.slice(prefix.length);
      slugsRenamed++;
      changed = true;
      // MRI move — from the working MRI, or recovered from the committed
      // MRI when the post-merge prune already deleted the entry
      const entry = refs[s] || (gitRefs[s] ? JSON.parse(JSON.stringify(gitRefs[s])) : null);
      const recovered = !refs[s] && !!entry;
      if (entry) {
        if (refs[renamed]) { collisions++; console.warn(`  MRI collision: ${renamed} already exists (leaving old key ${s})`); }
        else {
          entry.refId = renamed;
          if (entry.sourceDoc === donorId) entry.sourceDoc = doc.docId;
          if (Array.isArray(entry.rawVariants)) {
            for (const v of entry.rawVariants) if (v && v.docId === donorId) v.docId = doc.docId;
          }
          refs[renamed] = entry;
          delete refs[s];
          mriMoved++;
          if (recovered) mriRecovered++;
        }
      } else { mriMissing++; console.warn(`  MRI entry missing for ${s} (not in working or committed MRI)`); }
      return renamed;
    });
  }
  if (changed) {
    docsTouched++;
    touchedDocs.push(doc);
  }
}

console.log(`[slug-fix] survivors touched: ${docsTouched} | slugs renamed: ${slugsRenamed} | MRI moved: ${mriMoved} (recovered from git: ${mriRecovered}) | missing: ${mriMissing} | collisions: ${collisions}`);

if (!APPLY) {
  console.log(`\nDry run — pass --apply to write ${docsTouched} docs + MRI.`);
  process.exit(0);
}

for (const doc of touchedDocs) {
  const sorted = sortKeysDeep(doc);
  fs.writeFileSync(docAbsPath(sorted), JSON.stringify(sorted, null, 2) + '\n');
}
fs.writeFileSync(MRI_PATH, JSON.stringify(mri, null, 2) + '\n');
console.log(`\nApplied: ${touchedDocs.length} docs rewritten, MRI updated.`);
console.log('Reminder: npm run canonicalize && npm run validate && node src/main/scripts/extras/validateMriCoverage.js, then rebuild.');
