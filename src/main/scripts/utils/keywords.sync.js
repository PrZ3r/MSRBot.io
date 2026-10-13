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

const path = require("path");
const { normalizeKeyword } = require("./keyword.normalize");
const { loadAllDocs } = require("../../lib/registry");
const {
  CONTROLLED_PATH,
  loadControlledKeywords,
  saveControlledKeywords,
  sortKeywords,
} = require("../../lib/keywordConform");

const CONTROLLED_REL = path.relative(process.cwd(), CONTROLLED_PATH);

function main() {
  const write = process.argv.includes("--write");

  const documents = loadAllDocs();
  if (!Array.isArray(documents)) {
    throw new Error("Expected the document registry to produce an array");
  }

  const current = sortKeywords(loadControlledKeywords().map((kw) => normalizeKeyword(kw)));
  const currentSet = new Set(current);

  const found = new Set();
  for (const doc of documents) {
    if (!doc || !Array.isArray(doc.keywords)) continue;
    for (const kw of doc.keywords) {
      const normalized = normalizeKeyword(kw);
      if (normalized) found.add(normalized);
    }
  }

  const missing = sortKeywords(Array.from(found).filter((kw) => !currentSet.has(kw)));
  if (!missing.length) {
    console.log(`No new keywords to add. ${CONTROLLED_REL} is up to date.`);
    return;
  }

  console.log(`Found ${missing.length} keyword(s) missing from ${CONTROLLED_REL}:`);
  for (const kw of missing) console.log(`- ${kw}`);

  if (!write) {
    console.log(`\nDry run only. Re-run with --write to update ${CONTROLLED_REL}.`);
    return;
  }

  const terms = saveControlledKeywords([...current, ...missing]);
  console.log(`\nUpdated ${CONTROLLED_REL} (${terms.length} terms).`);
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
