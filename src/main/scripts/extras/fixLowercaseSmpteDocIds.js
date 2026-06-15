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

// ONE-TIME registry cleanup — normalise lowercase 10.5594-{letter} SMPTE
// docIds to their canonical uppercase form. APTARA delivers some article DOIs
// with a lowercase J prefix (mostly post-2010 paginalia); DOI resolution is
// case-insensitive so unsuffixed lowercase IDs collapse to the same article as
// the uppercase form. The registry enforces uppercase-collapsed uniqueness via
// documents.validate.js's sort/duplicate check, so the lowercase entries must
// be either dropped (when they're aliases of an existing uppercase doc) or
// renamed to uppercase (when the suffix makes them genuinely distinct).
//
// Classification (computed at run time):
//   collider  — uppercase counterpart already in registry; delete the
//               lowercase file. The uppercase canonical wins.
//   rename    — no uppercase counterpart; rewrite docId / doi / href to
//               uppercase and re-home the file via saveDoc.
//
// Dry-run by default. Pass --apply to write.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath, walkJsonFiles, DOCS_ROOT } = require('../../lib/registry');

const APPLY = process.argv.includes('--apply');

function upperCaseSmpteDocId(docId) {
  return docId.replace(/^(10\.5594)-([a-z])/, (_, p, c) => `${p}-${c.toUpperCase()}`);
}

function upperCaseSmpteDoi(doi) {
  return String(doi || '').replace(/^(10\.5594)\/([a-z])/, (_, p, c) => `${p}/${c.toUpperCase()}`);
}

function upperCaseSmpteHref(href) {
  return String(href || '').replace(/(10\.5594)\/([a-z])/, (_, p, c) => `${p}/${c.toUpperCase()}`);
}

function main() {
  const docs = loadAllDocs();
  const existingIds = new Set(docs.map((d) => d.docId));

  const lower = docs.filter((d) => /^10\.5594-[a-z]/.test(d.docId));
  if (!lower.length) {
    console.log('No lowercase 10.5594-{letter} docs found. Nothing to do.');
    return;
  }

  const colliders = [];
  const renames = [];
  for (const d of lower) {
    const upperId = upperCaseSmpteDocId(d.docId);
    if (existingIds.has(upperId) && upperId !== d.docId) {
      colliders.push({ docId: d.docId, upperId });
    } else {
      renames.push({ doc: d, newDocId: upperId });
    }
  }

  // Build docId → file path index from disk for unlinking — registry.js doesn't
  // expose its private file index, so we walk to find each lowercase file's path.
  const fileByDocId = new Map();
  for (const f of walkJsonFiles(DOCS_ROOT)) {
    try {
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (d && d.docId) fileByDocId.set(d.docId, f);
    } catch { /* skip parse errors */ }
  }

  console.log(`Found ${lower.length} docs with lowercase 10.5594-{letter} prefix.`);
  console.log(`  colliders (delete lowercase):       ${colliders.length}`);
  console.log(`  non-colliders (rename to uppercase): ${renames.length}`);
  console.log('');

  if (colliders.length) {
    console.log('-- Sample colliders --');
    for (const c of colliders.slice(0, 8)) {
      console.log(`  ${c.docId} → uppercase ${c.upperId} already in registry; will delete lowercase`);
    }
  }
  if (renames.length) {
    console.log('\n-- Sample renames --');
    for (const r of renames.slice(0, 8)) {
      console.log(`  ${r.doc.docId} → ${r.newDocId}`);
    }
  }

  if (!APPLY) {
    console.log('\nDry run — pass --apply to delete colliders and rename non-colliders.');
    return;
  }

  let deleted = 0;
  let deleteFailed = 0;
  for (const c of colliders) {
    const f = fileByDocId.get(c.docId);
    if (!f) { deleteFailed++; continue; }
    try { fs.unlinkSync(f); deleted++; }
    catch (e) { console.warn(`  failed to delete ${path.relative(REPO_ROOT, f)}: ${e.message}`); deleteFailed++; }
  }

  // For renames on a case-insensitive filesystem, fs.writeFile alone won't
  // change the on-disk filename case (it overwrites the existing lowercase
  // entry). Unlink the lowercase path first, then saveDoc writes a fresh file
  // whose directory-entry name carries the canonical uppercase form.
  let renamed = 0;
  let renameFailed = 0;
  for (const r of renames) {
    const oldPath = fileByDocId.get(r.doc.docId);
    if (!oldPath) { renameFailed++; continue; }
    const doc = r.doc;
    doc.docId = r.newDocId;
    if (doc.doi) doc.doi = upperCaseSmpteDoi(doc.doi);
    if (doc.href) doc.href = upperCaseSmpteHref(doc.href);
    if (doc.resolvedHref) doc.resolvedHref = upperCaseSmpteHref(doc.resolvedHref);
    try {
      fs.unlinkSync(oldPath);
      // Write directly via docAbsPath rather than saveDoc — saveDoc would
      // rebuild registry.js's docId→path index after every write, turning
      // each rename into a full ~26k-file walk. Fields are already canonical
      // so direct write is safe.
      const targetPath = docAbsPath(doc);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, JSON.stringify(doc, null, 2) + '\n');
      renamed++;
    } catch (e) {
      console.warn(`  failed to rename ${r.doc.docId}: ${e.message}`);
      renameFailed++;
    }
  }

  console.log('');
  console.log(`Deleted (colliders): ${deleted}${deleteFailed ? ` (${deleteFailed} failed)` : ''}`);
  console.log(`Renamed (uppercase): ${renamed}${renameFailed ? ` (${renameFailed} failed)` : ''}`);
  console.log('\nReminder: run `npm run canonicalize` and `npm run validate`, then commit.');
}

main();
