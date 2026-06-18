/*
 * reauditRefs.js — full-corpus reference audit.
 *
 * Walks every doc in the per-doc registry and classifies each entry in
 * `references[]` against the now-complete corpus + MRI state. PR #1111 was
 * additive-only (filled refs from -ref.xml sidecars); this pass re-checks
 * everything end-to-end now that ~18k journal articles also landed.
 *
 * Read-only. Produces two reports under src/main/reports/:
 *   - refsReaudit.json — structured per-doc breakdown + summary
 *   - refsReaudit.md   — human-readable summary + top-N tables
 *
 * Classification per ref-entry (string in doc.references[]):
 *   - resolved-direct        — ref string is a real docId in the registry
 *   - resolved-via-mri       — ref is canonical refId / orphan slug with MRI resolvedDocId set, target in registry
 *   - mri-known-no-doc       — canonical refId known to MRI but target doc not in registry (#1195 territory)
 *   - orphan-slug            — source-anchored slug (orphan/<srcDoc>/<refXmlId|h:hash>); inline <cite> only
 *   - unparseable            — string doesn't match a docId, refId, or known slug pattern (parser-family gap)
 *
 * Cross-cuts:
 *   - By source-doc docType (Standards / Journal Article / etc.) → sizes Phase 1a/1b/3a/3b
 *   - Top publisher families for canonical-but-no-doc + unparseable → scopes #1195
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs } = require('../../lib/registry');

const ROOT = process.cwd();
const MRI_PATH = path.resolve(ROOT, 'src/main/reports/masterReferenceIndex.json');
const OUT_JSON = path.resolve(ROOT, 'src/main/reports/refsReaudit.json');
const OUT_MD = path.resolve(ROOT, 'src/main/reports/refsReaudit.md');

function loadMri() {
  if (!fs.existsSync(MRI_PATH)) return { version: null, refs: {} };
  return JSON.parse(fs.readFileSync(MRI_PATH, 'utf8'));
}

function publisherFamilyOf(refId) {
  if (!refId || typeof refId !== 'string') return 'unknown';
  if (refId.startsWith('orphan/')) return 'orphan-slug';
  const head = refId.split(/[./\-_]/)[0] || refId;
  if (/^10$/.test(head)) {
    const m = refId.match(/^10\.(\d{4,9})/);
    return m ? `DOI:10.${m[1]}` : 'DOI';
  }
  return head;
}

function classify(refString, registryDocIds, mriRefsMap) {
  if (!refString || typeof refString !== 'string') {
    return { kind: 'unparseable', family: 'unknown' };
  }
  if (registryDocIds.has(refString)) {
    return { kind: 'resolved-direct', family: publisherFamilyOf(refString) };
  }
  if (refString.startsWith('orphan/')) {
    const mri = mriRefsMap.get(refString);
    if (mri && mri.resolvedDocId && registryDocIds.has(mri.resolvedDocId)) {
      return {
        kind: 'resolved-via-mri',
        family: publisherFamilyOf(mri.resolvedDocId),
        viaMriResolvedTo: mri.resolvedDocId,
      };
    }
    return { kind: 'orphan-slug', family: 'orphan-slug' };
  }
  const mri = mriRefsMap.get(refString);
  if (mri) {
    if (mri.resolvedDocId && registryDocIds.has(mri.resolvedDocId)) {
      return {
        kind: 'resolved-via-mri',
        family: publisherFamilyOf(refString),
        viaMriResolvedTo: mri.resolvedDocId,
      };
    }
    return { kind: 'mri-known-no-doc', family: publisherFamilyOf(refString) };
  }
  return { kind: 'unparseable', family: publisherFamilyOf(refString) };
}

function topN(counter, n = 20) {
  return Object.entries(counter)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

function main() {
  const startedAt = process.env.REAUDIT_TIMESTAMP || '(set REAUDIT_TIMESTAMP env var)';
  console.log('[reaudit] loading registry…');
  const docs = loadAllDocs();
  const registryDocIds = new Set(docs.map((d) => d.docId).filter(Boolean));
  console.log(`[reaudit] ${docs.length} docs (${registryDocIds.size} unique docIds)`);

  console.log('[reaudit] loading MRI…');
  const mri = loadMri();
  const mriRefsObj = mri.refs || {};
  const mriRefsMap = new Map(Object.entries(mriRefsObj));
  console.log(`[reaudit] MRI v${mri.version} — ${mriRefsMap.size} ref entries`);

  const perDoc = [];
  const counters = {
    byKind: {
      'resolved-direct': 0,
      'resolved-via-mri': 0,
      'mri-known-no-doc': 0,
      'orphan-slug': 0,
      'unparseable': 0,
    },
    byDocType: {},
    byPublisher: {},
    familyForKnownNoDoc: {},
    familyForUnparseable: {},
  };

  let docsWithRefs = 0;
  let totalRefEntries = 0;
  const REF_CATEGORIES = ['normative', 'bibliographic', 'supersededBy', 'amendedBy'];

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

  counters.byCategory = {};

  for (const doc of docs) {
    const flat = flattenRefs(doc.references);
    if (flat.length === 0) continue;
    docsWithRefs += 1;

    const docType = doc.docType || '_unknown';
    const publisher = doc.publisher || '_unknown';

    const perEntry = flat.map(({ category, ref }) => {
      totalRefEntries += 1;
      const c = classify(ref, registryDocIds, mriRefsMap);
      counters.byKind[c.kind] = (counters.byKind[c.kind] || 0) + 1;

      const dtKey = docType;
      counters.byDocType[dtKey] = counters.byDocType[dtKey] || {
        'resolved-direct': 0,
        'resolved-via-mri': 0,
        'mri-known-no-doc': 0,
        'orphan-slug': 0,
        'unparseable': 0,
      };
      counters.byDocType[dtKey][c.kind] += 1;

      counters.byPublisher[publisher] = (counters.byPublisher[publisher] || 0) + 1;

      if (c.kind === 'mri-known-no-doc') {
        counters.familyForKnownNoDoc[c.family] = (counters.familyForKnownNoDoc[c.family] || 0) + 1;
      } else if (c.kind === 'unparseable') {
        counters.familyForUnparseable[c.family] = (counters.familyForUnparseable[c.family] || 0) + 1;
      }

      counters.byCategory[category] = counters.byCategory[category] || {
        'resolved-direct': 0,
        'resolved-via-mri': 0,
        'mri-known-no-doc': 0,
        'orphan-slug': 0,
        'unparseable': 0,
      };
      counters.byCategory[category][c.kind] += 1;

      return { category, ref, kind: c.kind, family: c.family, viaMriResolvedTo: c.viaMriResolvedTo || null };
    });

    perDoc.push({
      docId: doc.docId,
      docType,
      publisher,
      refCount: flat.length,
      byKind: perEntry.reduce(
        (acc, e) => {
          acc[e.kind] += 1;
          return acc;
        },
        {
          'resolved-direct': 0,
          'resolved-via-mri': 0,
          'mri-known-no-doc': 0,
          'orphan-slug': 0,
          'unparseable': 0,
        }
      ),
      entries: perEntry,
    });
  }

  const summary = {
    generatedAt: startedAt,
    mriVersion: mri.version,
    registry: { totalDocs: docs.length, docsWithRefs, totalRefEntries },
    byKind: counters.byKind,
    pctResolved:
      totalRefEntries === 0
        ? 0
        : +(
            ((counters.byKind['resolved-direct'] + counters.byKind['resolved-via-mri']) /
              totalRefEntries) *
            100
          ).toFixed(2),
    byDocType: counters.byDocType,
    byCategory: counters.byCategory,
    topPublishersByRefCount: topN(counters.byPublisher, 15),
    topFamilies_mriKnownNoDoc: topN(counters.familyForKnownNoDoc, 20),
    topFamilies_unparseable: topN(counters.familyForUnparseable, 20),
  };

  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify({ summary, perDoc }, null, 2) + '\n',
    'utf8'
  );
  console.log(`[reaudit] wrote ${path.relative(ROOT, OUT_JSON)}`);

  const md = renderMarkdown(summary);
  fs.writeFileSync(OUT_MD, md, 'utf8');
  console.log(`[reaudit] wrote ${path.relative(ROOT, OUT_MD)}`);
}

function renderMarkdown(s) {
  const lines = [];
  lines.push('# Refs Re-Audit\n');
  lines.push(`> Generated at: ${s.generatedAt}`);
  lines.push(`> MRI version: ${s.mriVersion}\n`);
  lines.push('## Scope\n');
  lines.push(`- Registry docs: **${s.registry.totalDocs}**`);
  lines.push(`- Docs with non-empty \`references[]\`: **${s.registry.docsWithRefs}**`);
  lines.push(`- Total ref-entries audited: **${s.registry.totalRefEntries}**`);
  lines.push(`- Currently resolved (direct + via-MRI): **${s.pctResolved}%**\n`);

  lines.push('## Classification breakdown\n');
  lines.push('| Kind | Count | % |');
  lines.push('|---|---:|---:|');
  for (const [k, v] of Object.entries(s.byKind)) {
    const pct = s.registry.totalRefEntries
      ? ((v / s.registry.totalRefEntries) * 100).toFixed(2)
      : '0.00';
    lines.push(`| \`${k}\` | ${v} | ${pct}% |`);
  }
  lines.push('');

  lines.push('## By source doc type\n');
  lines.push(
    '| docType | resolved-direct | resolved-via-mri | mri-known-no-doc | orphan-slug | unparseable |'
  );
  lines.push('|---|---:|---:|---:|---:|---:|');
  const sortedDt = Object.entries(s.byDocType).sort(([, a], [, b]) => {
    const aTotal = Object.values(a).reduce((x, y) => x + y, 0);
    const bTotal = Object.values(b).reduce((x, y) => x + y, 0);
    return bTotal - aTotal;
  });
  for (const [dt, c] of sortedDt) {
    lines.push(
      `| ${dt} | ${c['resolved-direct']} | ${c['resolved-via-mri']} | ${c['mri-known-no-doc']} | ${c['orphan-slug']} | ${c['unparseable']} |`
    );
  }
  lines.push('');

  lines.push('## By reference category\n');
  lines.push(
    '| category | resolved-direct | resolved-via-mri | mri-known-no-doc | orphan-slug | unparseable |'
  );
  lines.push('|---|---:|---:|---:|---:|---:|');
  const sortedCat = Object.entries(s.byCategory || {}).sort(([, a], [, b]) => {
    const aTotal = Object.values(a).reduce((x, y) => x + y, 0);
    const bTotal = Object.values(b).reduce((x, y) => x + y, 0);
    return bTotal - aTotal;
  });
  for (const [cat, c] of sortedCat) {
    lines.push(
      `| ${cat} | ${c['resolved-direct']} | ${c['resolved-via-mri']} | ${c['mri-known-no-doc']} | ${c['orphan-slug']} | ${c['unparseable']} |`
    );
  }
  lines.push('');

  lines.push('## Top 15 publishers by total ref-count (as source doc)\n');
  lines.push('| publisher | refs |');
  lines.push('|---|---:|');
  for (const { key, count } of s.topPublishersByRefCount) {
    lines.push(`| ${key} | ${count} |`);
  }
  lines.push('');

  lines.push('## Top 20 publisher families — `mri-known-no-doc`\n');
  lines.push(
    '> Canonical refIds we recognise, but the target doc is not in the registry. These are the docs we should ingest to unblock resolution. Feeds Phase 1b + #1195.\n'
  );
  lines.push('| family | count |');
  lines.push('|---|---:|');
  for (const { key, count } of s.topFamilies_mriKnownNoDoc) {
    lines.push(`| ${key} | ${count} |`);
  }
  lines.push('');

  lines.push('## Top 20 publisher families — `unparseable`\n');
  lines.push(
    '> Ref strings that don\'t match any known publisher pattern. These need new `parseRefId` families or `refMap.json` entries. Direct scope for #1195.\n'
  );
  lines.push('| family | count |');
  lines.push('|---|---:|');
  for (const { key, count } of s.topFamilies_unparseable) {
    lines.push(`| ${key} | ${count} |`);
  }
  lines.push('');

  lines.push('---');
  lines.push(
    '\nFull per-doc detail in `refsReaudit.json` (every ref-entry tagged with classification + MRI resolution pointer when present).\n'
  );
  return lines.join('\n');
}

main();
