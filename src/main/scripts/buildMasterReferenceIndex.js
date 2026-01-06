/*
Copyright (c) 2025 Steve LLamb (https://github.com/SteveLLamb) and PrZ3(https://github.com/PrZ3r)

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

/**
 * First-pass CLI to (re)build the Master Reference Index (MRI) from documents.json
 * without running the HTML extractor. This replays known references as sightings
 * and/or recomputes presence-only state, then flushes MRI with stable diffs.
 *
 * Modes:
 *  - default: full replay (add sightings for all refs found in documents.json)
 *  - --presence-only: skip adding sightings; just recompute resolution.sourcePresent/sourceDocId
 *
 * Extras:
 *  - --audit-out <path>: write a JSON audit of refs missing source docs
 *  - --limit <N>: process only the first N source documents (for quick tests)
 *  - --in <path>: path to documents.json (default: src/main/data/documents.json)
 *  - --force: force write even if only generatedAt would change
 *  - --quiet: minimal console output
 */

const fs = require('fs');
const path = require('path');

const {
  // sighting + flush
  mriRecordSighting,
  mriFlush,
  mriEnsureFile,
  // indices
  reloadDocumentsIndex,
  mriPruneToSightings
} = require('../lib/referencing');

const keying = require('../lib/keying');
const { keyFromDocId } = keying;

const REGISTRIES_REPO_PATH = 'src/main';
const MSI_PATH = path.join(REGISTRIES_REPO_PATH, 'reports/masterSuiteIndex.json');

let __msiSuitesByKey = null;
let __msiLoadedSuites = false;
const NO_PRUNE = has('--no-prune');

function arg(flag, def = null) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  if (next == null || /^--/.test(next)) return def;
  return next;
}
function has(flag) { return process.argv.includes(flag); }

const IN = arg('--in', 'src/main/data/documents.json');
const PRESENCE_ONLY = has('--presence-only');
const AUDIT_OUT = arg('--audit-out', 'src/main/reports/mri_presence_audit.json');
const LIMIT = parseInt(arg('--limit', ''), 10);
const FORCE = has('--force');
const QUIET = has('--quiet');

function ensureDir(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); }

function loadDocuments(inPath) {
  if (!fs.existsSync(inPath)) {
    console.error(`❌ Input not found: ${inPath}`);
    process.exit(1);
  }
  try {
    const raw = fs.readFileSync(inPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.documents || []);
  } catch (e) {
    console.error(`❌ Failed to parse JSON: ${e.message}`);
    process.exit(1);
  }
}

function* iterDocRefs(doc) {
  const refObj = (doc && doc.references) || {};
  const kinds = [ ['normative', 'normative'], ['bibliographic', 'bibliographic'] ];
  for (const [key, type] of kinds) {
    const arr = Array.isArray(refObj[key]) ? refObj[key] : [];
    for (const refId of arr) {
      if (!refId || typeof refId !== 'string') continue;
      yield { type, refId };
    }
  }
}

function loadMsiSuitesQuiet() {
  if (__msiLoadedSuites) return;
  __msiLoadedSuites = true;
  try {
    if (!fs.existsSync(MSI_PATH)) {
      __msiSuitesByKey = null;
      return;
    }
    const raw = fs.readFileSync(MSI_PATH, 'utf8');
    const msi = JSON.parse(raw);
    if (msi && Array.isArray(msi.suites)) {
      __msiSuitesByKey = new Map(
        msi.suites
          .filter(f => f && typeof f.key === 'string')
          .map(f => [f.key, f])
      );
    } else {
      __msiSuitesByKey = null;
    }
  } catch (e) {
    __msiSuitesByKey = null;
    if (!QUIET) {
      console.warn(`⚠️ MRI: failed to load MSI for ALLPARTS presence checks: ${e.message || e}`);
    }
  }
}

function isAllPartsResolvable(refId) {
  if (!refId) return false;
  loadMsiSuitesQuiet();
  if (!__msiSuitesByKey) return false;

  const m = String(refId).match(/^(.+)\.ALLPARTS$/);
  if (!m) return false;

  const baseId = m[1];

  // If MSI failed to load or has no suites, we cannot resolve
  if (!__msiSuitesByKey || __msiSuitesByKey.size === 0) return false;

  // Treat an ALLPARTS reference as resolvable if *any* MSI suite has
  // allPartsLatestIds whose docIds clearly belong to this base. We do
  // this by string-prefix matching on the docId stem (e.g., SMPTE.ST379)
  // and ignoring the part/date suffix (e.g., -1.2009, .2004, etc.).
  for (const suite of __msiSuitesByKey.values()) {
    const ids = Array.isArray(suite.allPartsLatestIds) ? suite.allPartsLatestIds : [];
    if (!ids.length) continue;

    const match = ids.some((id) => {
      if (!id) return false;
      const s = String(id);
      return (
        s === baseId ||
        s.startsWith(baseId + '.') ||
        s.startsWith(baseId + '-') ||
        s.startsWith(baseId + '/')
      );
    });

    if (match) return true;
  }

  return false;
}

function main() {
  const docs = loadDocuments(IN);
  const countDocs = LIMIT > 0 ? Math.min(LIMIT, docs.length) : docs.length;
  if (!QUIET) {
    console.log(`🧠 MRI replay ${PRESENCE_ONLY ? '(presence-only)' : ''}`.trim());
    console.log(`   Source: ${IN}`);
    console.log(`   Documents: ${countDocs}/${docs.length}`);
  }

  // Refresh the docId/docBase index so presence checks use the current input
  reloadDocumentsIndex();

  let seenSightings = 0;
  let seenRefs = 0;
  let docCounter = 0;
  const sightIdx = new Set();

  // Always compute current truth from documents.json for pruning decisions
  for (const d of docs) {
    if (docCounter >= countDocs) break;
    docCounter++;
    const docId = d && d.docId ? String(d.docId) : null;
    if (!docId) continue;

    for (const { type, refId } of iterDocRefs(d)) {
      if (!refId) continue;
      sightIdx.add(`${refId}||${docId}||${type}`);
      if (!PRESENCE_ONLY) {
        seenRefs++;
        mriRecordSighting({
          docId,
          type,
          refId,
          cite: '',
          href: '',
          rawRef: '',
          title: '',
          mapSource: 'replay',
          mapDetail: 'from-documents.json'
        });
        seenSightings++;
      }
    }
  }

  // Prune only during full replay unless explicitly disabled
  if (!PRESENCE_ONLY && !NO_PRUNE) {
    const pr = mriPruneToSightings(sightIdx, { removeEmptyRefs: true });
    if (!QUIET) console.log(`🧹 Pruned MRI: -${pr.removedVariants} variants, -${pr.removedRefs} refs, -${pr.removedOrphans || 0} orphans`);
  }

  // Flush MRI (will recompute sourcePresent/sourceDocId and suppress timestamp-only writes)
  const res = mriFlush({ force: FORCE });

  if (!QUIET) {
    if (PRESENCE_ONLY) {
      console.log(res.wrote
        ? `🧠 MRI updated — presence recomputed; uniqueRefIds=${res.uniqueRefIds}, orphans=${res.orphanCount}`
        : (res.reason === 'timestamp-only'
            ? '🧠 MRI unchanged — timestamp-only (presence recomputed)'
            : '🧠 MRI unchanged — no delta'));
    } else {
      console.log(res.wrote
        ? `🧠 MRI updated — replayed ${seenSightings} sightings from ${countDocs} docs; uniqueRefIds=${res.uniqueRefIds}, orphans=${res.orphanCount}`
        : (res.reason === 'timestamp-only'
            ? `🧠 MRI unchanged — timestamp-only after replay (${seenSightings} sightings processed)`
            : `🧠 MRI unchanged — no delta after replay (${seenSightings} sightings processed)`));
    }
  }

  // Optional audit: read the emitted MRI and list refs lacking source docs
  if (AUDIT_OUT) {
    try {
      const MRI_PATH = path.resolve(process.cwd(), 'src/main/reports/masterReferenceIndex.json');
      const mri = JSON.parse(fs.readFileSync(MRI_PATH, 'utf8'));
      const missing = [];
      const present = [];
      const refs = mri && mri.refs ? mri.refs : {};
      for (const [refId, entry] of Object.entries(refs)) {
        let sp = !!(entry && entry.resolution && entry.resolution.sourcePresent);
        const srcDoc = entry && entry.resolution ? entry.resolution.sourceDocId || null : null;
        const variants = Array.isArray(entry && entry.rawVariants) ? entry.rawVariants : [];
        // Build full sightings from rawVariants, sorted by docId+type for stability
        const sightings = variants
          .map(v => ({
            docId: v.docId || null,
            type: v.type || null,
            cite: v.cite || '',
            href: v.href || '',
            rawRef: v.rawRef || '',
            title: (v.title == null ? null : v.title)
          }))
          .sort((a, b) => {
            const ka = `${a.docId || ''}||${a.type || ''}`;
            const kb = `${b.docId || ''}||${b.type || ''}`;
            return ka < kb ? -1 : ka > kb ? 1 : 0;
          });

        // Presence override: treat resolvable .ALLPARTS refs as present, even if
        // there is no single sourceDocId. This stops ISO.11664.ALLPARTS,
        // SMPTE.ST379.ALLPARTS, etc. from being flagged as missing when MSI
        // suites confirm all-parts coverage.
        if (!sp && !srcDoc && /\.ALLPARTS$/i.test(refId) && isAllPartsResolvable(refId)) {
          sp = true;
        }

        const item = { refId, sourceDocId: srcDoc, sightingCount: sightings.length, sightings };
        (sp ? present : missing).push(item);
      }
      const audit = {
        generatedAt: new Date().toISOString(),
        sourcePath: IN,
        processedDocs: countDocs,
        replayMode: PRESENCE_ONLY ? 'presence-only' : 'full-replay',
        seenRefs,
        seenSightings,
        presentCount: present.length,
        missingCount: missing.length,
        missing // no cap; caller can post-filter if needed
      };
      ensureDir(AUDIT_OUT);
      fs.writeFileSync(AUDIT_OUT, JSON.stringify(audit, null, 2));
      if (!QUIET) console.log(`📝 MRI presence audit written: ${AUDIT_OUT}`);
    } catch (e) {
      console.warn(`⚠️ Failed to write audit: ${e.message}`);
    }
  }
}

main();