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
 * docRendering.test.js — src/main/config/docRendering.json, the citation
 * templates in src/main/templates/citations/, and their loader.
 */

const assert = require('assert');
const fs = require('fs');
const hb = require('handlebars');
const { DOC_RENDERING_PATH, loadDocRendering } = require('../../lib/docRendering');

let n = 0;
const eq = (got, want, msg) => { assert.deepStrictEqual(got, want, msg); n++; };

const raw = JSON.parse(fs.readFileSync(DOC_RENDERING_PATH, 'utf8'));
const cfg = loadDocRendering();

// docTypes and contentTypes stay sorted by name, with only the known flags.
const FIELDS = { docTypes: ['titleLabel', 'nonLineage'], contentTypes: ['label', 'noPage'] };
for (const [key, fields] of Object.entries(FIELDS)) {
  const names = Object.keys(raw[key]);
  eq(names, [...names].sort((a, b) => a.localeCompare(b)), `${key} out of localeCompare order`);
  eq(names.flatMap((name) => Object.keys(raw[key][name]).filter((f) => !fields.includes(f)).map((f) => `${name}.${f}`)), [], `unknown ${key} fields`);
}

// The registry's year shards and the MSI's lineage rules read these lists.
eq(cfg.titleLabelDocTypes.includes('Journal Article'), true, 'Journal Article is titleLabel');
eq(cfg.nonLineageDocTypes.includes('Standard'), false, 'Standard is a lineage docType');
eq(cfg.noPageContentTypes.includes('advert'), true, 'advert has no page');
eq(cfg.contentTypeLabels['orig-research'], 'Original Research', 'contentType label');

// Every template the build asks for exists, compiles, and carries no file-ending newline.
const WANTED = {
  generic: ['preview', 'previewUndated'],
  smpte: ['preview', 'previewUndated', 'snippet', 'snippetUndated'],
  text: ['preview', 'previewUndated'],
};
for (const [style, variants] of Object.entries(WANTED)) {
  for (const v of variants) {
    const src = cfg.citations[style] && cfg.citations[style][v];
    eq(typeof src, 'string', `templates/citations/${style}.${v}.hbs exists`);
    eq(/\n$/.test(src), false, `${style}.${v}: trailing newline stripped`);
    hb.precompile(src);
  }
}

console.log(`docRendering.test.js — ${n} cases passed`);
