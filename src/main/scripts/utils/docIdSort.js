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

const fs = require('fs');
const jsonMap = require('json-source-map');

const DOCS_PATH = process.argv[2] || 'src/main/data/documents.json';

function sortByDocId(arr) {
  return [...arr].sort((a, b) => {
    const aId = String(a && a.docId ? a.docId : '').toUpperCase();
    const bId = String(b && b.docId ? b.docId : '').toUpperCase();
    if (aId < bId) return -1;
    if (aId > bId) return 1;
    return 0;
  });
}

function getDocsContainer(data) {
  if (Array.isArray(data)) {
    return { path: '', docs: data, isRootArray: true };
  }
  if (data && Array.isArray(data.documents)) {
    return { path: '/documents', docs: data.documents, isRootArray: false };
  }
  return null;
}

function getPointer(pointers, ptr) {
  const p = pointers[ptr];
  if (!p || !p.value || !p.valueEnd) return null;
  return p;
}

function reorderArrayText(raw, pointers, basePath, fromDocs, toDocs) {
  if (!fromDocs.length) return raw;

  const arrayPtr = getPointer(pointers, basePath);
  if (!arrayPtr) {
    throw new Error(`Missing source-map pointer for array path: ${basePath || '(root)'}`);
  }

  const items = fromDocs.map((doc, idx) => {
    const ptrPath = `${basePath}/${idx}`;
    const ptr = getPointer(pointers, ptrPath);
    if (!ptr) {
      throw new Error(`Missing source-map pointer for array item: ${ptrPath}`);
    }
    const key = String(doc && doc.docId ? doc.docId : '');
    return {
      key,
      idx,
      start: ptr.value.pos,
      end: ptr.valueEnd.pos,
      text: raw.slice(ptr.value.pos, ptr.valueEnd.pos)
    };
  });

  // Keep stable behavior when duplicate docIds exist.
  const queueByKey = new Map();
  for (const it of items) {
    if (!queueByKey.has(it.key)) queueByKey.set(it.key, []);
    queueByKey.get(it.key).push(it);
  }

  const sortedTexts = [];
  for (const doc of toDocs) {
    const key = String(doc && doc.docId ? doc.docId : '');
    const q = queueByKey.get(key);
    if (!q || !q.length) {
      throw new Error(`Sort mapping failed for docId: ${key || '(empty)'}`);
    }
    sortedTexts.push(q.shift().text);
  }

  let separator = ',\n';
  if (items.length > 1) {
    const firstGap = raw.slice(items[0].end, items[1].start);
    if (firstGap && firstGap.trim()) separator = firstGap;
    else if (firstGap) separator = firstGap;
  }

  const contentStart = items[0].start;
  const contentEnd = items[items.length - 1].end;
  const left = raw.slice(0, contentStart);
  const right = raw.slice(contentEnd);
  const middle = sortedTexts.join(separator);
  return left + middle + right;
}

function main() {
  const raw = fs.readFileSync(DOCS_PATH, 'utf8');
  const parsed = jsonMap.parse(raw);
  const data = parsed.data;
  const pointers = parsed.pointers;

  const container = getDocsContainer(data);
  const docs = container ? container.docs : null;

  if (!Array.isArray(docs)) {
    throw new Error('No documents array found (expected top-level array or { documents: [] }).');
  }

  const sortedDocs = sortByDocId(docs);
  const alreadySorted = docs.every((d, i) =>
    String(d && d.docId ? d.docId : '').toUpperCase() ===
    String(sortedDocs[i] && sortedDocs[i].docId ? sortedDocs[i].docId : '').toUpperCase()
  );
  if (alreadySorted) {
    console.log(`Already sorted by docId: ${DOCS_PATH}`);
    return;
  }

  const out = reorderArrayText(raw, pointers, container.path, docs, sortedDocs);
  fs.writeFileSync(DOCS_PATH, out, 'utf8');
  console.log(`Sorted ${docs.length} records by docId: ${DOCS_PATH}`);
}

try {
  main();
} catch (err) {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}
