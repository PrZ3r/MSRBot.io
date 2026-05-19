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

/*
 * One-time migration: explode src/main/data/documents.json into the per-doc
 * shard layout under src/main/data/docs/ (issue #1108).
 *
 *   node src/main/scripts/migrate.explode-documents.js          # dry-run report
 *   node src/main/scripts/migrate.explode-documents.js --apply   # write the tree
 *
 * Dry-run reports path collisions, near-duplicate publisher slugs, blank
 * (_unknown) publishers, and a year-shard summary. --apply only proceeds when
 * there are no hard errors.
 */

const fs = require('fs');
const path = require('path');
const {
  DOCS_ROOT,
  YEAR_SHARDED_DOCTYPES,
  slug,
  docPath,
} = require('../lib/registry');

const MONOLITH = path.resolve('src/main/data/documents.json');
const APPLY = process.argv.slice(2).includes('--apply');

function main() {
  if (!fs.existsSync(MONOLITH)) {
    console.error(`❌ Not found: ${MONOLITH}`);
    process.exit(1);
  }

  const docs = JSON.parse(fs.readFileSync(MONOLITH, 'utf8'));
  if (!Array.isArray(docs)) {
    console.error('❌ documents.json is not an array.');
    process.exit(1);
  }
  console.log(`Loaded ${docs.length} documents from documents.json\n`);

  const errors = [];
  const warnings = [];

  // --- 1. Path-collision report (hard error) -------------------------------
  const byPath = new Map();
  for (const doc of docs) {
    const rel = docPath(doc);
    if (!byPath.has(rel)) byPath.set(rel, []);
    byPath.get(rel).push(doc.docId);
  }
  const collisions = [...byPath.entries()].filter(([, ids]) => ids.length > 1);
  if (collisions.length) {
    errors.push(`${collisions.length} path collision(s) — distinct docs map to the same file:`);
    for (const [rel, ids] of collisions) {
      errors.push(`  ${rel}\n    ${ids.join('\n    ')}`);
    }
  }

  // --- 2. Near-duplicate publisher-slug report -----------------------------
  const slugToPublishers = new Map();
  for (const doc of docs) {
    const s = slug(doc.publisher);
    if (!slugToPublishers.has(s)) slugToPublishers.set(s, new Set());
    slugToPublishers.get(s).add(String(doc.publisher == null ? '' : doc.publisher));
  }
  const nearDupes = [...slugToPublishers.entries()].filter(([, set]) => set.size > 1);
  if (nearDupes.length) {
    warnings.push(`⚠️  ${nearDupes.length} publisher slug(s) shared by spelling variants — reconcile before --apply:`);
    for (const [s, set] of nearDupes) {
      warnings.push(`  ${s}  <=  ${[...set].map((p) => JSON.stringify(p)).join('  |  ')}`);
    }
  }

  // --- 3. Blank-publisher (_unknown) report --------------------------------
  const unknownDocs = docs
    .filter((d) => slug(d.publisher) === '_unknown')
    .map((d) => d.docId);
  console.log(`_unknown publisher: ${unknownDocs.length} doc(s)${unknownDocs.length ? ' — ' + unknownDocs.join(', ') : ''}`);
  if (unknownDocs.length !== 3) {
    warnings.push(`⚠️  Expected 3 _unknown docs (SCC.CEA-608, SSA.v4, SubRip.SRT); found ${unknownDocs.length}.`);
  }

  // --- 4. Leaf counts + year-shard summary ---------------------------------
  const leafCounts = new Map();
  for (const doc of docs) {
    const leaf = `${slug(doc.publisher)}/${slug(doc.docType)}`;
    leafCounts.set(leaf, (leafCounts.get(leaf) || 0) + 1);
  }
  const yearSharded = docs.filter((d) =>
    YEAR_SHARDED_DOCTYPES.has(String(d.docType == null ? '' : d.docType).trim())
  );
  const undated = yearSharded.filter((d) => !/^\d{4}/.test(String(d.publicationDate || '')));
  console.log(
    `Year-sharded (title-label docTypes): ${yearSharded.length} doc(s)` +
    (undated.length ? ` — ${undated.length} with no publicationDate → _undated/` : '')
  );

  // --- Planned tree summary ------------------------------------------------
  const publishers = new Set([...leafCounts.keys()].map((l) => l.split('/')[0]));
  console.log(`\nPlanned layout: ${publishers.size} publisher folders, ${leafCounts.size} leaf folders, ${docs.length} files`);
  const top = [...leafCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('Largest leaves:');
  for (const [leaf, n] of top) console.log(`  ${leaf}: ${n}`);

  if (warnings.length) {
    console.log('\n' + warnings.join('\n'));
  }
  if (errors.length) {
    console.error('\n❌ HARD ERRORS — must resolve before --apply:\n' + errors.join('\n'));
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write the per-doc tree.');
    return;
  }

  // --- Apply ---------------------------------------------------------------
  let written = 0;
  for (const doc of docs) {
    const abs = path.join(DOCS_ROOT, docPath(doc));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(doc, null, 2) + '\n');
    written += 1;
  }
  console.log(`\n✅ Wrote ${written} per-doc files under ${DOCS_ROOT}`);
  console.log('   documents.json left in place — remove it in a later commit once green.');
  console.log('   Next: npm run canonicalize && npm run validate && npm run build');
}

main();
