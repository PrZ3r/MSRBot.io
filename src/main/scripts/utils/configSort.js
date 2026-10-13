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

// canonicalize-json.js
const fs = require('fs');
const { loadControlledKeywords, saveControlledKeywords } = require('../../lib/keywordConform');
const { PUBLISHERS_PATH } = require('../../lib/publishers');
const { DOC_RENDERING_PATH } = require('../../lib/docRendering');

function sortObj(v) {
  if (Array.isArray(v)) return v.map(sortObj);
  if (v && typeof v === 'object') {
    return Object.keys(v)
      .sort()                // <– alphabetical
      .reduce((o, k) => {
        o[k] = sortObj(v[k]);
        return o;
      }, {});
  }
  return v;
}

function canonicalize(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const json = JSON.parse(raw);
  const sorted = sortObj(json);
  fs.writeFileSync(path, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log('Canonicalized:', path);
}

canonicalize('src/main/config/site.json')
// refMap.json: keys alphabetical so entries are findable; pattern order inside each entry is kept
canonicalize('src/main/input/refMap.json')
// controlledKeywords.json: terms alphabetical (localeCompare), one per line, so the list scans in order
saveControlledKeywords(loadControlledKeywords())
console.log('Canonicalized: src/main/config/controlledKeywords.json')

// publishers.json: entries by name (localeCompare), fields in one order, aliases sorted
const PUBLISHER_FIELDS = ['url', 'logo', 'logoDark', 'aliases', 'dateless'];
{
  const data = JSON.parse(fs.readFileSync(PUBLISHERS_PATH, 'utf8'));
  const publishers = {};
  for (const name of Object.keys(data.publishers).sort((a, b) => a.localeCompare(b))) {
    const p = data.publishers[name];
    const out = {};
    for (const f of PUBLISHER_FIELDS) if (p[f] !== undefined) out[f] = f === 'aliases' ? [...p[f]].sort((a, b) => a.localeCompare(b)) : p[f];
    for (const f of Object.keys(p)) if (!PUBLISHER_FIELDS.includes(f)) out[f] = p[f];
    publishers[name] = out;
  }
  data.publishers = publishers;
  fs.writeFileSync(PUBLISHERS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Canonicalized: src/main/config/publishers.json');
}

// docRendering.json: docTypes and contentTypes by name (localeCompare); facets as they are
{
  const data = JSON.parse(fs.readFileSync(DOC_RENDERING_PATH, 'utf8'));
  for (const key of ['docTypes', 'contentTypes']) {
    const map = data[key] || {};
    data[key] = Object.fromEntries(Object.keys(map).sort((a, b) => a.localeCompare(b)).map((k) => [k, map[k]]));
  }
  fs.writeFileSync(DOC_RENDERING_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Canonicalized: src/main/config/docRendering.json');
}
