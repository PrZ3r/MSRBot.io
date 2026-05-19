/*
Manage reference review flags in documents.json.

Usage:
  node src/main/scripts/utils/review.refs.js list
  node src/main/scripts/utils/review.refs.js resolve RFC2130 RFC2141
*/

const fs = require('fs');
const path = require('path');
const { loadAllDocs, saveDoc } = require('../../lib/registry');

const BAD_REFS_PATH = path.resolve(process.cwd(), 'src/main/reports/badRefs.latest.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, v) {
  fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
}

function getPublisherLabel(doc) {
  const publisher = String(doc?.publisher || '').trim();
  if (publisher) return publisher;
  return String(doc?.provider || '').trim();
}

function getBadRefsData() {
  const empty = { byDoc: new Map(), total: 0, docCount: 0 };
  if (!fs.existsSync(BAD_REFS_PATH)) return empty;
  try {
    const payload = loadJson(BAD_REFS_PATH);
    const arr = Array.isArray(payload?.badRefs) ? payload.badRefs : [];
    const m = new Map();
    for (const x of arr) {
      const id = String(x?.docId || '').trim();
      if (!id) continue;
      m.set(id, (m.get(id) || 0) + 1);
    }
    return {
      byDoc: m,
      total: arr.length,
      docCount: m.size
    };
  } catch {
    return empty;
  }
}

function listFlagged(docs, badRefsByDoc) {
  const rows = [];
  const refTypes = ['normative', 'bibliographic'];
  for (const d of docs) {
    if (!d || typeof d !== 'object') continue;
    const docId = String(d.docId || '');
    const publisher = getPublisherLabel(d);
    for (const refType of refTypes) {
      const meta = d?.references?.[`${refType}$meta`];
      if (!meta || typeof meta !== 'object') continue;
      if (meta.reviewRequired !== true) continue;
      const count = Array.isArray(d?.references?.[refType]) ? d.references[refType].length : 0;
      rows.push({
        docId,
        publisher,
        refType,
        refs: count,
        badRefs: badRefsByDoc.get(docId) || 0,
        flag: String(meta.flag || '')
      });
    }
  }
  rows.sort((a, b) => a.docId.localeCompare(b.docId) || a.refType.localeCompare(b.refType));
  return rows;
}

function listUnflaggedWithBadRefs(docs, badRefsByDoc) {
  const rows = [];
  const refTypes = ['normative', 'bibliographic'];
  for (const d of docs) {
    if (!d || typeof d !== 'object') continue;
    const docId = String(d.docId || '');
    const publisher = getPublisherLabel(d);
    const badRefs = badRefsByDoc.get(docId) || 0;
    if (!badRefs) continue;
    const flagged = refTypes.some((refType) => {
      const meta = d?.references?.[`${refType}$meta`];
      return !!(meta && typeof meta === 'object' && meta.reviewRequired === true);
    });
    if (flagged) continue;
    const normRefs = Array.isArray(d?.references?.normative) ? d.references.normative.length : 0;
    const biblRefs = Array.isArray(d?.references?.bibliographic) ? d.references.bibliographic.length : 0;
    rows.push({ docId, publisher, normRefs, biblRefs, badRefs });
  }
  rows.sort((a, b) => b.badRefs - a.badRefs || a.docId.localeCompare(b.docId));
  return rows;
}

function resolveDocs(docs, ids) {
  const set = new Set(ids.map((x) => String(x || '').trim()).filter(Boolean));
  const now = new Date().toISOString();
  let changed = 0;
  for (const d of docs) {
    if (!d || typeof d !== 'object') continue;
    const docId = String(d.docId || '');
    if (!set.has(docId)) continue;
    for (const refType of ['normative', 'bibliographic']) {
      const meta = d?.references?.[`${refType}$meta`];
      if (!meta || typeof meta !== 'object') continue;
      if (meta.reviewRequired === true) {
        meta.reviewRequired = false;
        changed += 1;
      }
      if (typeof meta.flag === 'string') {
        delete meta.flag;
      }
      const note = String(meta.note || '').trim();
      const tag = `Manual review completed ${now.slice(0, 10)}`;
      meta.note = note.includes(tag) ? note : `${note}${note ? ' | ' : ''}${tag}`;
      meta.updated = now;
    }
  }
  return changed;
}

function main() {
  const docs = loadAllDocs();
  if (!Array.isArray(docs)) {
    console.error('document registry did not produce an array');
    process.exit(1);
  }

  const cmd = String(process.argv[2] || '').trim().toLowerCase();
  if (cmd === 'list') {
    const badRefsData = getBadRefsData();
    const rows = listFlagged(docs, badRefsData.byDoc);
    const unflaggedBad = listUnflaggedWithBadRefs(docs, badRefsData.byDoc);
    const flaggedDocs = new Set(rows.map((r) => r.docId));
    const overlap = new Set(rows.filter((r) => r.badRefs > 0).map((r) => r.docId)).size;

    console.log(`badRefs.latest: total=${badRefsData.total}, docs=${badRefsData.docCount}`);
    console.log(`reviewRequired docs (all providers, all ref types): ${flaggedDocs.size} entries=${rows.length} (with badRefs overlap=${overlap})`);
    console.log(`docs with badRefs but no reviewRequired flag: ${unflaggedBad.length}`);

    if (!rows.length) {
      console.log('No docs currently flagged for reference review.');
      if (unflaggedBad.length) {
        console.log('\ndocs with badRefs.latest > 0 but no reviewRequired flag');
        console.log('docId | publisher | normativeRefs | bibliographicRefs | badRefs.latest');
        for (const r of unflaggedBad) {
          console.log(`${r.docId} | ${r.publisher} | ${r.normRefs} | ${r.biblRefs} | ${r.badRefs}`);
        }
      }
      return;
    }
    console.log('\nflagged docs');
    console.log('docId | publisher | refType | refs | badRefs.latest | flag');
    for (const r of rows) {
      console.log(`${r.docId} | ${r.publisher} | ${r.refType} | ${r.refs} | ${r.badRefs} | ${r.flag}`);
    }
    if (unflaggedBad.length) {
      console.log('\ndocs with badRefs.latest > 0 but no reviewRequired flag');
      console.log('docId | publisher | normativeRefs | bibliographicRefs | badRefs.latest');
      for (const r of unflaggedBad) {
        console.log(`${r.docId} | ${r.publisher} | ${r.normRefs} | ${r.biblRefs} | ${r.badRefs}`);
      }
    }
    return;
  }

  if (cmd === 'resolve') {
    const ids = process.argv.slice(3);
    if (!ids.length) {
      console.error('Provide at least one docId. Example: resolve RFC2130 RFC2141');
      process.exit(1);
    }
    const changed = resolveDocs(docs, ids);
    const wanted = new Set(ids);
    for (const d of docs) {
      if (wanted.has(d.docId)) saveDoc(d);
    }
    console.log(`Updated review flags for ${changed} reference meta field(s).`);
    return;
  }

  console.error('Usage: list | resolve <docIds...>');
  process.exit(1);
}

main();
