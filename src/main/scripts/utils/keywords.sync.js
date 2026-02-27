/*
Copyright (c) 2025-26 Steve LLamb (https://github.com/SteveLLamb) and PrZ3(https://github.com/PrZ3r)

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

const fs = require("fs");
const path = require("path");

const SITE_PATH = path.resolve("src/main/config/site.json");
const DOCS_PATH = path.resolve("src/main/data/documents.json");

const ACRONYM_MAP = new Map([
  "JSON", "XML", "RFC", "IETF", "ISO", "ITU", "AES",
  "MIME", "URI", "URL", "HTTP", "HTTPS", "API", "DOI",
  "ASCII", "UTF", "IMF", "MXF", "MPEG", "KDM", "DCDM", "DNS",
  "SDI", "OPL", "ACES", "HTJ2K", "JPEG2000", "URN"
].map((value) => [value.toLowerCase(), value]));

function normalizeKeyword(input) {
  const s = String(input || "").trim().replace(/\s+/g, " ");
  if (!s) return "";

  return s
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      if (ACRONYM_MAP.has(lower)) return ACRONYM_MAP.get(lower);
      if (/^b-?chain$/i.test(word)) return "B-Chain";
      if (/^dcinema$/i.test(word)) return "DCinema";
      if (/^sha-?1$/i.test(word)) return "SHA-1";
      if (/^dcp(?=$|[-/])/i.test(word)) return word.replace(/^dcp/i, "DCP");
      // Preserve MIME/media-type forms as lowercase per convention.
      if (/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(word)) return lower;
      // Preserve already-uppercase hyphenated acronym tokens (e.g., MIME-EXT, URI-GEN).
      if (/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(word)) return word;
      if (/^\d+mm$/i.test(word)) return `${word.replace(/mm$/i, "")}mm`;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function sortedUnique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const write = process.argv.includes("--write");

  if (!fs.existsSync(SITE_PATH)) {
    throw new Error(`Missing site config: ${SITE_PATH}`);
  }
  if (!fs.existsSync(DOCS_PATH)) {
    throw new Error(`Missing documents file: ${DOCS_PATH}`);
  }

  const site = readJson(SITE_PATH);
  const documents = readJson(DOCS_PATH);
  if (!Array.isArray(documents)) {
    throw new Error("Expected src/main/data/documents.json to be an array");
  }

  const current = sortedUnique(
    (Array.isArray(site.controlledKeywords) ? site.controlledKeywords : [])
      .map(normalizeKeyword)
  );
  const currentSet = new Set(current);

  const found = new Set();
  for (const doc of documents) {
    if (!doc || !Array.isArray(doc.keywords)) continue;
    for (const kw of doc.keywords) {
      const normalized = normalizeKeyword(kw);
      if (normalized) found.add(normalized);
    }
  }

  const missing = sortedUnique(Array.from(found).filter((kw) => !currentSet.has(kw)));
  if (!missing.length) {
    console.log("No new keywords to add. controlledKeywords is up to date.");
    return;
  }

  console.log(`Found ${missing.length} keyword(s) missing from controlledKeywords:`);
  for (const kw of missing) console.log(`- ${kw}`);

  if (!write) {
    console.log("\nDry run only. Re-run with --write to update src/main/config/site.json.");
    return;
  }

  site.controlledKeywords = sortedUnique([...current, ...missing]);
  fs.writeFileSync(SITE_PATH, `${JSON.stringify(site, null, 2)}\n`);
  console.log(`\nUpdated src/main/config/site.json (controlledKeywords: ${site.controlledKeywords.length}).`);
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
