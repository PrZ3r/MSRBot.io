/*
 * validateMriCoverage.js — MRI v2 slug-system invariant check.
 *
 * The slug system (PR #1191, docs/mri-citation-system.md) guarantees that
 * every string a doc cites in `doc.references.{normative,bibliographic}[]`
 * lands in `MRI.refs[]` — either as a canonical refId, a known-publisher
 * slug, or a source-anchored orphan slug. The renderer relies on this
 * invariant to produce sensible output for every ref.
 *
 * This script asserts the invariant against the current state of the
 * registry + MRI on disk. Exits 0 if clean, exit 1 with a structured
 * report if any leaks are found. Wire into CI / pre-commit to catch
 * regressions at build time instead of in the rendered UI.
 *
 * Report sidecars (written even on success):
 *   src/main/reports/mriCoverageGaps.json — machine-readable
 *   src/main/reports/mriCoverageGaps.md   — human-readable
 *
 * Usage:
 *   node src/main/scripts/extras/validateMriCoverage.js
 *   npm run validate-mri-coverage
 *
 * Exit codes:
 *   0 — every ref string in every doc.references[] is present in MRI.refs[]
 *   1 — one or more ref strings are missing from MRI (the leak set)
 *   2 — script-level error (couldn't load registry or MRI)
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs } = require('../../lib/registry');

const ROOT = process.cwd();
const MRI_PATH = path.resolve(ROOT, 'src/main/reports/masterReferenceIndex.json');
const OUT_JSON = path.resolve(ROOT, 'src/main/reports/mriCoverageGaps.json');
const OUT_MD = path.resolve(ROOT, 'src/main/reports/mriCoverageGaps.md');

const REF_CATEGORIES = ['normative', 'bibliographic', 'supersededBy', 'amendedBy'];

function loadMri() {
  if (!fs.existsSync(MRI_PATH)) {
    throw new Error(`MRI file not found at ${MRI_PATH}`);
  }
  return JSON.parse(fs.readFileSync(MRI_PATH, 'utf8'));
}

function flattenRefs(refsField) {
  if (Array.isArray(refsField)) return refsField.map((r) => ({ category: 'legacy', ref: r }));
  if (refsField && typeof refsField === 'object') {
    const out = [];
    for (const cat of REF_CATEGORIES) {
      const arr = refsField[cat];
      if (Array.isArray(arr)) for (const r of arr) out.push({ category: cat, ref: r });
    }
    return out;
  }
  return [];
}

function classifyLeak(ref) {
  if (!ref || typeof ref !== 'string') return 'non-string-ref';
  if (ref.startsWith('orphan/')) return 'orphan-slug-not-in-mri';
  if (/^10\.\d{4,9}[-./]/.test(ref)) return 'doi-form-not-in-mri';
  return 'unknown-form-not-in-mri';
}

function main() {
  const docs = loadAllDocs();
  const mri = loadMri();
  const mriRefIds = new Set(Object.keys(mri.refs || {}));

  console.log(`[mri-coverage] registry: ${docs.length} docs`);
  console.log(`[mri-coverage] MRI v${mri.version || '?'}: ${mriRefIds.size} ref entries`);

  const leaks = [];
  let docsWithRefs = 0;
  let totalRefEntries = 0;

  for (const doc of docs) {
    const flat = flattenRefs(doc.references);
    if (flat.length === 0) continue;
    docsWithRefs += 1;

    for (const { category, ref } of flat) {
      totalRefEntries += 1;
      if (!ref || typeof ref !== 'string') {
        leaks.push({
          docId: doc.docId,
          category,
          ref: String(ref),
          kind: 'non-string-ref',
        });
        continue;
      }
      if (!mriRefIds.has(ref)) {
        leaks.push({
          docId: doc.docId,
          category,
          ref,
          kind: classifyLeak(ref),
        });
      }
    }
  }

  console.log(`[mri-coverage] audited ${totalRefEntries} ref-entries across ${docsWithRefs} docs`);

  const summary = {
    generatedAt: process.env.MRI_COVERAGE_TIMESTAMP || '(set MRI_COVERAGE_TIMESTAMP env var)',
    mriVersion: mri.version || null,
    totals: {
      registryDocs: docs.length,
      docsWithRefs,
      totalRefEntries,
      mriRefIds: mriRefIds.size,
      leakCount: leaks.length,
    },
    leaksByKind: leaks.reduce((acc, l) => {
      acc[l.kind] = (acc[l.kind] || 0) + 1;
      return acc;
    }, {}),
    leaks,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  fs.writeFileSync(OUT_MD, renderMd(summary), 'utf8');
  console.log(`[mri-coverage] wrote ${path.relative(ROOT, OUT_JSON)}`);
  console.log(`[mri-coverage] wrote ${path.relative(ROOT, OUT_MD)}`);

  if (leaks.length === 0) {
    console.log('[mri-coverage] PASS — every doc.references[] entry is present in MRI.refs[]');
    process.exit(0);
  }

  console.error(`[mri-coverage] FAIL — ${leaks.length} ref-string(s) not in MRI:`);
  for (const l of leaks.slice(0, 25)) {
    console.error(`  [${l.kind}] "${l.ref}" — cited by ${l.docId} (${l.category})`);
  }
  if (leaks.length > 25) {
    console.error(`  ... and ${leaks.length - 25} more (see ${path.relative(ROOT, OUT_MD)})`);
  }
  console.error('');
  console.error('This means the MRI v2 slug-system invariant is broken — every ref a doc');
  console.error('cites should land in MRI.refs[] via extractDocs.js / mriRecordSighting.');
  console.error('See docs/mri-citation-system.md for the resolution lifecycle. Patch the');
  console.error('slug-mint path; do NOT silence this check.');
  process.exit(1);
}

function renderMd(s) {
  const lines = [];
  lines.push('# MRI Coverage Validation\n');
  lines.push(`> Generated at: ${s.generatedAt}`);
  lines.push(`> MRI version: ${s.mriVersion}\n`);
  lines.push('## Invariant\n');
  lines.push('Every string in `doc.references.{normative,bibliographic,supersededBy,amendedBy}[]` must exist as a key in `MRI.refs[]`. The MRI v2 slug-system guarantees this — `extractDocs.js` routes through `mriRecordSighting`, which mints a slug for every ref it sees, and the slug is cited from `doc.references[]` before the doc is saved.\n');
  lines.push('See [docs/mri-citation-system.md](../../../docs/mri-citation-system.md) for the resolution lifecycle.\n');
  lines.push('## Totals\n');
  lines.push(`- Registry docs: **${s.totals.registryDocs}**`);
  lines.push(`- Docs with non-empty \`references[]\`: **${s.totals.docsWithRefs}**`);
  lines.push(`- Total ref-entries audited: **${s.totals.totalRefEntries}**`);
  lines.push(`- MRI \`refs[]\` entries: **${s.totals.mriRefIds}**`);
  lines.push(`- **Leak count: ${s.totals.leakCount}**\n`);

  if (s.totals.leakCount === 0) {
    lines.push('## Result: PASS\n');
    lines.push('Every audited ref-string is present in MRI. The invariant holds.\n');
    return lines.join('\n');
  }

  lines.push('## Result: FAIL\n');
  lines.push('### Leaks by kind\n');
  lines.push('| kind | count |');
  lines.push('|---|---:|');
  for (const [k, n] of Object.entries(s.leaksByKind)) lines.push(`| \`${k}\` | ${n} |`);
  lines.push('');

  lines.push('### All leaks\n');
  lines.push('| docId | category | ref | kind |');
  lines.push('|---|---|---|---|');
  for (const l of s.leaks) {
    lines.push(`| \`${l.docId}\` | ${l.category} | \`${l.ref}\` | \`${l.kind}\` |`);
  }
  lines.push('');

  lines.push('### What to do\n');
  lines.push('- **Do not silence this check.** Each leak is a real bug in the extract/mint pipeline.');
  lines.push('- For each leak, trace back to the extractor that produced the ref string and confirm it routed through `mriRecordSighting`. If it did, confirm the minted slug was queued for application to the source doc\'s `references[]` before save.');
  lines.push('- If the slug-mint path is correct but the MRI lost the entry, check `mriPruneToSightings` — it may be pruning an entry whose source doc has the slug cited but with a different normalized form.');
  return lines.join('\n');
}

try {
  main();
} catch (err) {
  console.error('[mri-coverage] FATAL:', err && err.message ? err.message : err);
  process.exit(2);
}
