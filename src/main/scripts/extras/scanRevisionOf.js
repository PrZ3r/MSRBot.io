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

// Read the "Revision of" line from a document's PDF front page.
//
// A SMPTE standard prints its predecessor on page 1: "SMPTE 259M-2008 — Revision of SMPTE
// 259M-2006". Older RP/EG/RDD pages leave out "SMPTE" ("Revision of RP 87-1995"), and the
// extracted text often runs on into the document's own designator, so only the first
// designator after the phrase is the predecessor. It is parsed with parseRefId, the same
// mapping the registry uses. "Supersedes" and "Replaces" are read the same way.
//
// Use it to fill `revisionOf`, and to confirm that a cited edition missing from the registry
// really existed (a placeholder candidate). Read-only: it writes a JSON report, never the
// registry.
//
//   --pdf <url|path>     one PDF (e.g. while preparing a manual-extraction record)
//   --docs A,B,…         registry docs, read from their pub.smpte.org release page
//   --all-smpte          every registry doc with a pub.smpte.org release
//   --out <file>         report path (default: stdout summary only)
//   --concurrency <n>    parallel fetches for --docs / --all-smpte (default 4)
//
// Usage:
//   node src/main/scripts/extras/scanRevisionOf.js --pdf https://pub.smpte.org/doc/st259/20080129-pub/st0259-2008.pdf
//   node src/main/scripts/extras/scanRevisionOf.js --all-smpte --out /tmp/revisions.json

const fs = require('fs');
const path = require('path');
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const axios = require('axios');
const { loadAllDocs, loadDoc } = require('../../lib/registry');
const { parseRefId, findSourceDocIdForRefId } = require('../../lib/referencing');

const argv = process.argv.slice(2);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null; };
const PAGES = 3;

// A predecessor designator: "SMPTE 259M-2006", "ANSI/SMPTE 244M-1995", "RP 87-1995",
// "EG 22-1993", "RP 210.8-2004", "SMPTE ST 291:2010", "ECR 1-1978" (Engineering Committee
// Recommendation, the predecessor of EGs). The number must not follow a letter, so "AES3-1992"
// in running text is not read as SMPTE 3.
const DESIGNATOR = /(?<![A-Za-z])(?:ANSI\/)?(?:SMPTE\s+)?(?:ST|RP|EG|RDD|OV|AG|ECR)?\s*\d[\d.]*[A-Z]?(?:-\d{1,3})?\s*[-–:]\s*(?:19|20)\d{2}/g;
const PHRASE = /(Revision of|Supersedes|Replaces)\s*(.*)/;

// Every predecessor named after the phrase ("SMPTE 12M-1999, RP 159-1995 and RP 164-1996"),
// stopping at the document's own designator, which the line often runs on into. Its own
// designator may be printed with a different year from its docId ("RP 86-1991" on
// SMPTE.RP86.1990), so it also stops at anything that resolves to the document itself, and a
// "predecessor" newer than the document is never one.
const yearOf = (id) => +((String(id).match(/\.((?:19|20)\d{2})(?:-\d{2})?$/) || [])[1] || 0);
function predecessorsIn(tail, selfDocId) {
  const out = [];
  for (const m of tail.matchAll(DESIGNATOR)) {
    const d = m[0].trim();
    // A bare number right after a word the tool doesn't know ("XYZ 1-1978") belongs to that
    // word, not to SMPTE: skip it rather than read it as a SMPTE standard.
    const before = tail.slice(0, m.index + (m[0].length - m[0].trimStart().length)).match(/([A-Za-z]+)\s*$/);
    // A word ending in SMPTE is still SMPTE: text layers mangle "ANSI/SMPTE" into "ANSMPTE".
    if (/^\d/.test(d) && before && !/^(of|and|or|ANSI)$/i.test(before[1]) && !/SMPTE$/i.test(before[1])) continue;
    const id = parseRefId(/SMPTE/.test(d) ? d : `SMPTE ${d.replace(/^ANSI\//, '')}`);
    if (!id) continue;
    if (selfDocId && (id === selfDocId || findSourceDocIdForRefId(id) === selfDocId)) break;
    if (selfDocId && yearOf(id) > yearOf(selfDocId)) break;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

async function pdfText(buf) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  return text.slice(0, PAGES);
}

// Returns { phrase, line, predecessor, predecessors } or null. `predecessor` is the first of
// `predecessors`. `selfDocId` stops the list at the document's own designator, and lets the
// "ANSI/SMPTE 1993" case (number dropped by the PDF's text layer) fall back to its own number.
function findRevision(pages, selfDocId) {
  for (const page of pages) {
    const lines = String(page).split(/\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('....')) continue; // table of contents ("Revision Notes ......")
      const m = lines[i].match(PHRASE);
      if (!m) continue;
      const tail = [m[2], ...lines.slice(i + 1, i + 3)].join(' ').trim();
      const predecessors = predecessorsIn(tail, selfDocId);
      if (!predecessors.length && selfDocId && /ANSI\/SMPTE\s+(?:19|20)\d{2}/.test(tail)) {
        predecessors.push(`${selfDocId.replace(/\.\d{4}.*$/, '')}.${tail.match(/(?:19|20)\d{2}/)[0]}`);
      }
      return { phrase: m[1], line: tail.slice(0, 160), predecessor: predecessors[0] || null, predecessors };
    }
  }
  return null;
}

async function fetchBuf(url) {
  if (!/^https?:/i.test(url)) return fs.readFileSync(url);
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  return Buffer.from(res.data);
}

// The PDF behind a pub.smpte.org release page is the `#document` iframe.
async function pdfUrlForRelease(releaseUrl) {
  const res = await axios.get(releaseUrl, { timeout: 30000 });
  const m = String(res.data).match(/id="document"[^>]*src="([^"]+)"|src="([^"]+)"[^>]*id="document"/);
  const src = m && (m[1] || m[2]);
  return src && /\.pdf$/i.test(src) ? new URL(src, releaseUrl).toString() : null;
}

function releaseUrlOf(doc) {
  const su = (doc['releaseTag$meta'] || {}).sourceUrl || (doc['docId$meta'] || {}).sourceUrl || '';
  const m = su.match(/^(https:\/\/pub\.smpte\.org\/doc\/[^/]+\/[^/]+)\/?/);
  return m ? `${m[1]}/` : null;
}

async function scanDoc(doc) {
  const out = { docId: doc.docId, pdf: null, phrase: null, line: null, predecessor: null, predecessorInRegistry: null, error: null };
  try {
    const rel = releaseUrlOf(doc);
    if (!rel) { out.error = 'no pub.smpte.org release'; return out; }
    out.pdf = await pdfUrlForRelease(rel);
    if (!out.pdf) { out.error = 'release has no PDF'; return out; }
    const hit = findRevision(await pdfText(await fetchBuf(out.pdf)), doc.docId);
    if (!hit) { out.error = `no revision line on pages 1-${PAGES}`; return out; }
    Object.assign(out, hit);
    out.predecessorInRegistry = out.predecessor ? !!loadDoc(out.predecessor) : null;
  } catch (e) {
    out.error = `${e.code || e.name}: ${String(e.message).slice(0, 80)}`;
  }
  return out;
}

async function main() {
  const one = arg('--pdf');
  if (one) {
    const hit = findRevision(await pdfText(await fetchBuf(one)), null);
    console.log(JSON.stringify(hit || { phrase: null, note: `no revision line on pages 1-${PAGES}` }, null, 2));
    return;
  }
  let docs;
  if (argv.includes('--all-smpte')) docs = loadAllDocs().filter((d) => releaseUrlOf(d));
  else if (arg('--docs')) docs = arg('--docs').split(',').map((s) => loadDoc(s.trim())).filter(Boolean);
  else { console.error('Pass --pdf <url|path>, --docs A,B,… or --all-smpte.'); process.exit(1); }

  const conc = Math.max(1, parseInt(arg('--concurrency') || '4', 10));
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: conc }, async () => {
    while (next < docs.length) {
      const d = docs[next++];
      results.push(await scanDoc(d));
      if (results.length % 50 === 0) console.error(`… ${results.length}/${docs.length}`);
    }
  }));
  results.sort((a, b) => a.docId.localeCompare(b.docId, undefined, { numeric: true }));
  const withLine = results.filter((r) => r.phrase).length;
  const named = results.filter((r) => r.predecessor);
  console.log(`${results.length} scanned; ${withLine} with a revision line; ${named.length} name a predecessor (${named.filter((r) => !r.predecessorInRegistry).length} not in the registry).`);
  if (arg('--out')) { fs.writeFileSync(arg('--out'), JSON.stringify(results, null, 2) + '\n'); console.log(`Report: ${arg('--out')}`); }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { findRevision };
