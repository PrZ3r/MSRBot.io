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
 * smpteJournal.discovery.js — find SMPTE journal / conference papers in a
 * LOCAL copy of the SMPTE journal library (the maintainer's AWS download).
 *
 * The library is not public, so this provider only works where its XML is on
 * disk. Layout (as delivered):
 *   <source>/Journal Article Repository/<year>/<issue>/<paper>.xml        content_batch primary
 *   <source>/Journal Article Repository/<year>/<issue>/FTXML/FT_<paper>.xml  JATS full text (refs)
 *   <source>/Conference Repository/Conference Papers/<year>/<issue>/…     same shape
 *
 * Flags (read here, so extractDocs.js needs nothing provider-specific):
 *   --source <dir>   library root (default: _source/SMPTE — a symlink to the library)
 *   --from <year>    first year to read (default: 2025)
 *   --to <year>      last year to read (default: no limit)
 *   --pdf-refs       also read papers delivered WITHOUT full text (the IEEE-era
 *                    <publication> records, 2015–2023): references only, parsed
 *                    from the paper's PDF in the same folder, for papers that
 *                    have none yet. Metadata for those papers is never touched.
 *
 * With no readable local source — the path is missing, holds no papers, or
 * holds only Dropbox online-only placeholders (0-byte files) — discovery
 * reports "nothing to do" and returns no keys, so the run ends without
 * touching the registry. A missing source never means "these docs are gone".
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_SOURCE = '_source/SMPTE';
const DEFAULT_FROM = 2025;
const CORPORA = [
  { dir: 'Journal Article Repository', docType: 'Journal Article' },
  { dir: path.join('Conference Repository', 'Conference Papers'), docType: 'Conference Paper' },
];

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i < 0) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : null;
}

function walkXml(dir, out = []) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (e.name.startsWith('.') || e.name === '__MACOSX' || e.name === 'FTXML') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory() || (e.isSymbolicLink() && fs.statSync(p).isDirectory())) walkXml(p, out);
    else if (e.name.endsWith('.xml')) out.push(p);
  }
  return out;
}

function createSmpteJournalDiscovery({ sourcePath, fromYear, toYear, pdfRefs } = {}) {
  const source = path.resolve(sourcePath || argValue('--source') || DEFAULT_SOURCE);
  const from = Number(fromYear || argValue('--from') || DEFAULT_FROM);
  const to = Number(toYear || argValue('--to') || 9999);
  const withPdfRefs = pdfRefs !== undefined ? !!pdfRefs : process.argv.includes('--pdf-refs');
  let primaries = null; // [{ file, docType, kind: 'content_batch' | 'pdf-refs', pdf? }]

  // content_batch primaries from `from` onward; 0-byte files counted separately.
  function load() {
    if (primaries) return primaries;
    primaries = [];
    let placeholders = 0;
    for (const { dir, docType } of CORPORA) {
      const root = path.join(source, dir);
      let years;
      try { years = fs.readdirSync(root).filter((y) => /^\d{4}$/.test(y) && Number(y) >= from && Number(y) <= to).sort(); } catch { continue; }
      for (const y of years) {
        for (const file of walkXml(path.join(root, y))) {
          let size = 0;
          try { size = fs.statSync(file).size; } catch { continue; }
          if (!size) { placeholders++; continue; }
          let head = '';
          try { head = fs.readFileSync(file, 'utf8').slice(0, 400); } catch { continue; }
          if (head.includes('<content_batch')) primaries.push({ file, docType, kind: 'content_batch' });
          else if (withPdfRefs && head.includes('<publication')) {
            // IEEE-era record: usable only if its main PDF sits beside it.
            const x = fs.readFileSync(file, 'utf8');
            const pdfName = (x.match(/filetype="MainPDF">([^<]+)</) || [])[1];
            const pdf = pdfName && path.join(path.dirname(file), pdfName);
            let pdfSize = 0;
            try { pdfSize = pdf ? fs.statSync(pdf).size : 0; } catch { /* not pulled */ }
            if (pdfSize) primaries.push({ file, docType, kind: 'pdf-refs', pdf });
          }
        }
      }
    }
    primaries.sort((a, b) => a.file.localeCompare(b.file));
    if (!primaries.length) {
      const why = !fs.existsSync(source)
        ? 'the path does not exist'
        : placeholders
          ? `${placeholders} file(s) are 0-byte placeholders (Dropbox online-only?) — make the folder available offline`
          : `no papers from ${from}${to < 9999 ? `–${to}` : ' onward'}${withPdfRefs ? ' (content_batch, or records with a PDF)' : ''}`;
      console.log(`ℹ️ No local SMPTE journal source at ${source} (${why}) — nothing to do.`);
      console.log('   This extractor needs a local copy of the SMPTE journal library XML. See docs/commands.md.');
    } else {
      const pdfN = primaries.filter((p) => p.kind === 'pdf-refs').length;
      console.log(`📚 SMPTE journal library: ${source} — ${primaries.length} paper(s) from ${from}${to < 9999 ? `–${to}` : ' onward'}${pdfN ? ` (${pdfN} references-only from PDF)` : ''}${placeholders ? ` (${placeholders} 0-byte placeholder(s) skipped)` : ''}`);
    }
    return primaries;
  }

  async function discoverFromRootDocPage() {
    return load().map((p) => `smpte-journal:${p.file}`);
  }

  function getPrimary(key) {
    const file = String(key || '').replace(/^smpte-journal:/, '');
    return load().find((p) => p.file === file) || null;
  }

  return {
    source,
    from,
    discoverFromRootDocPage,
    normalizeSeedUrl: (u) => u,
    shouldFilterUrl: () => false,
    getPrimary,
    allPrimaries: () => load(),
  };
}

module.exports = { createSmpteJournalDiscovery };
