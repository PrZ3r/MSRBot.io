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
 * new-doc.js — scaffold a new per-doc registry file from the blank template
 * (issue #1108). The file is written straight to the correct shard path,
 * derived from --publisher / --docType / --docId.
 *
 *   node src/main/scripts/new-doc.js \
 *     --docId SMPTE.ST2067-2.2020 --publisher SMPTE --docType Standard \
 *     [--docTitle "..."] [--docLabel "..."]
 *
 * Required: --docId, --publisher, --docType (these derive the file path).
 * Any other --field value is copied onto the template. After scaffolding,
 * fill in the remaining fields and run `npm run canonicalize` to inject $meta.
 */

const fs = require('fs');
const path = require('path');
const { loadDoc, saveDoc, docPath } = require('../lib/registry');

const TEMPLATE_PATH = path.resolve('src/main/data/templates/documents.json');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[(i += 1)] : '';
      out[key] = val;
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const missing = ['docId', 'publisher', 'docType'].filter((k) => !String(args[k] || '').trim());
  if (missing.length) {
    console.error(`❌ Missing required argument(s): ${missing.map((m) => '--' + m).join(', ')}`);
    console.error('   Usage: node src/main/scripts/new-doc.js --docId <id> --publisher <pub> --docType <type> [--field value ...]');
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`❌ Template not found: ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  if (loadDoc(args.docId)) {
    console.error(`❌ A document with docId "${args.docId}" already exists in the registry.`);
    process.exit(1);
  }

  const template = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
  const doc = { ...template, ...args };

  const result = saveDoc(doc);
  console.log(`✅ Created ${path.relative(process.cwd(), result.path)}`);
  console.log(`   (shard: ${docPath(doc)})`);
  console.log('   Next: fill in remaining fields, then run `npm run canonicalize && npm run validate`.');
}

main();
