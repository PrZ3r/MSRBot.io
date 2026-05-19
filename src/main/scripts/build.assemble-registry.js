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
 * build.assemble-registry.js — assemble build artifacts from the per-doc
 * registry (issue #1108).
 *
 * The monolithic site snapshot (build/docs/_data/documents.json) and the
 * per-docId API (build/api/) are emitted by build.js. This step adds the
 * per-publisher and per-publisher/docType slices, so downstream clients can
 * fetch a narrow cut of the registry instead of the whole monolith.
 *
 *   build/docs/_data/by-publisher/{publisher}.json
 *   build/docs/_data/by-publisher/{publisher}/{docType}.json
 *
 * Slices are site artifacts: $meta is stripped (matching build.js).
 *
 *   node src/main/scripts/build.assemble-registry.js   # standalone
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs, slug } = require('../lib/registry');

const SLICES_ROOT = path.resolve('build', 'docs', '_data', 'by-publisher');

/** Deep-clone a doc with every "*$meta" key removed (site outputs strip $meta). */
function stripMeta(value) {
  return JSON.parse(
    JSON.stringify(value, (key, val) =>
      (typeof key === 'string' && key.includes('$meta') ? undefined : val)
    )
  );
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Emit per-publisher and per-publisher/docType slices. Publishers and docTypes
 * are derived from the docs themselves (via slug()), never a hardcoded list.
 */
function assembleSlices(docs = loadAllDocs()) {
  const byPublisher = new Map();
  for (const doc of docs) {
    const pub = slug(doc.publisher);
    if (!byPublisher.has(pub)) byPublisher.set(pub, []);
    byPublisher.get(pub).push(doc);
  }

  let publisherCount = 0;
  let typeCount = 0;

  for (const [pub, pubDocs] of byPublisher) {
    writeJson(path.join(SLICES_ROOT, `${pub}.json`), stripMeta(pubDocs));
    publisherCount += 1;

    const byType = new Map();
    for (const doc of pubDocs) {
      const type = slug(doc.docType);
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(doc);
    }
    for (const [type, typeDocs] of byType) {
      writeJson(path.join(SLICES_ROOT, pub, `${type}.json`), stripMeta(typeDocs));
      typeCount += 1;
    }
  }

  console.log(`[assemble] Wrote ${publisherCount} publisher slice(s) and ${typeCount} publisher/docType slice(s) under ${SLICES_ROOT}`);
  return { publisherCount, typeCount };
}

module.exports = { assembleSlices, stripMeta, SLICES_ROOT };

if (require.main === module) {
  assembleSlices();
}
