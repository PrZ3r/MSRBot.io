/*
Synchronize controlled keywords in src/main/config/site.json from documents.json.

Usage:
  node src/main/scripts/keywords.sync.js          # dry-run (default)
  node src/main/scripts/keywords.sync.js --write  # apply updates
*/

const fs = require("fs");
const path = require("path");

const SITE_PATH = path.resolve("src/main/config/site.json");
const DOCS_PATH = path.resolve("src/main/data/documents.json");

const ACRONYM_MAP = new Map([
  "JSON", "XML", "RFC", "IETF", "ISO", "ITU", "AES",
  "MIME", "URI", "URL", "HTTP", "HTTPS", "API", "DOI",
  "ASCII", "UTF", "IMF", "MXF", "MPEG", "KDM", "DCDM",
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
