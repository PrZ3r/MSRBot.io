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
 * manual provider — discovery. Instead of crawling a publisher site, it reads a
 * records file prepared by hand or by an AI agent (the msrbot-extract skill) and
 * hands each record to the normal extractDocs pipeline as `manual:<n>`.
 *
 *   npm run extract-manual -- --input path/to/records.json
 *
 * Record format: docs/manual-extraction.md.
 */

const fs = require('fs');

function createManualDiscovery({ inputPath } = {}) {
  let records = null;

  function load() {
    if (records) return records;
    if (!inputPath) throw new Error('manual provider needs --input <records.json>');
    const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const list = Array.isArray(data) ? data : data && data.records;
    if (!Array.isArray(list) || !list.length) throw new Error(`${inputPath}: expected a non-empty "records" array`);
    list.forEach((r, i) => {
      for (const k of ['docId', 'docLabel', 'docTitle', 'docType', 'publisher']) {
        if (!r || typeof r[k] !== 'string' || !r[k].trim()) throw new Error(`${inputPath}: records[${i}] is missing ${k}`);
      }
    });
    records = list;
    return records;
  }

  async function discoverFromRootDocPage() {
    return load().map((_, i) => `manual:${i}`);
  }

  function getRecord(key) {
    const m = String(key || '').match(/^manual:(\d+)$/);
    return m ? load()[Number(m[1])] : null;
  }

  return {
    discoverFromRootDocPage,
    normalizeSeedUrl: (u) => u,
    shouldFilterUrl: () => false,
    getRecord
  };
}

module.exports = { createManualDiscovery };
