/*
Backfill IETF seed URLs (RFC + IETF drafts) from MRI presence-audit missing refs.

Usage:
  node src/main/scripts/utils/seedBackfill.ietf.js
  node src/main/scripts/utils/seedBackfill.ietf.js --write
*/

const fs = require('fs');
const path = require('path');

const AUDIT_PATH = path.resolve(process.cwd(), 'src/main/reports/mri_presence_audit.json');
const SEED_PATH = path.resolve(process.cwd(), 'src/main/input/seedUrls.ietf.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, v) {
  fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
}

function asRfcNum(refId) {
  const m = String(refId || '').toUpperCase().match(/^RFC(\d{1,5})$/);
  return m ? Number(m[1]) : null;
}

function asDraftName(refId) {
  const m = String(refId || '').match(/^IETF\.(draft-[A-Za-z0-9._-]+)$/i);
  if (!m || !m[1]) return null;
  return String(m[1])
    .toLowerCase()
    .replace(/\.(?:txt|xml|html?|pdf)$/i, '')
    .trim();
}

function toRfcUrl(n) {
  return `https://www.rfc-editor.org/info/rfc${n}`;
}

function toDraftUrl(name) {
  return `https://datatracker.ietf.org/doc/html/${name}`;
}

function normalizeUrl(v) {
  return String(v || '').trim();
}

function classifySeed(url) {
  const s = String(url || '').toLowerCase();
  if (/^https?:\/\/datatracker\.ietf\.org\/doc\/html\/draft-/.test(s)) return 'draft';
  if (/^https?:\/\/www\.rfc-editor\.org\/info\/rfc\d{1,5}$/.test(s)) return 'rfc';
  return 'other';
}

function rfcNum(url) {
  const m = String(url || '').toLowerCase().match(/\/rfc(\d{1,5})$/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

function canonicalizeSeeds(list) {
  const seen = new Set();
  const uniq = [];
  for (const raw of list) {
    const v = normalizeUrl(raw);
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(v);
  }

  const drafts = uniq.filter((u) => classifySeed(u) === 'draft').sort((a, b) => a.localeCompare(b));
  const rfcs = uniq
    .filter((u) => classifySeed(u) === 'rfc')
    .sort((a, b) => rfcNum(a) - rfcNum(b) || a.localeCompare(b));
  const others = uniq.filter((u) => classifySeed(u) === 'other').sort((a, b) => a.localeCompare(b));

  return [...drafts, ...rfcs, ...others];
}

function main() {
  const doWrite = process.argv.includes('--write');
  if (!fs.existsSync(AUDIT_PATH)) {
    console.error(`Missing file: ${AUDIT_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(SEED_PATH)) {
    console.error(`Missing file: ${SEED_PATH}`);
    process.exit(1);
  }

  const audit = loadJson(AUDIT_PATH);
  const seeds = loadJson(SEED_PATH);
  if (!Array.isArray(seeds)) {
    console.error('seedUrls.ietf.json is not an array');
    process.exit(1);
  }
  const missingRows = Array.isArray(audit?.missing) ? audit.missing : [];
  const rfcNums = [...new Set(
    missingRows
      .map((row) => asRfcNum(row?.refId))
      .filter((n) => Number.isInteger(n))
  )].sort((a, b) => a - b);
  const draftNames = [...new Set(
    missingRows
      .map((row) => asDraftName(row?.refId))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  const seedSet = new Set(seeds.map((s) => String(s).toLowerCase()));
  const missingSeedNums = rfcNums.filter((n) => !seedSet.has(toRfcUrl(n).toLowerCase()));
  const missingSeedUrls = missingSeedNums.map((n) => toRfcUrl(n));
  const missingDraftNames = draftNames.filter((name) => !seedSet.has(toDraftUrl(name).toLowerCase()));
  const missingDraftUrls = missingDraftNames.map((name) => toDraftUrl(name));
  const missingAll = [...missingDraftUrls, ...missingSeedUrls];

  console.log(`MRI missing refs: ${missingRows.length}`);
  console.log(`MRI missing RFC refs: ${rfcNums.length}`);
  console.log(`MRI missing IETF draft refs: ${draftNames.length}`);
  console.log(`IETF draft refs not in seedUrls.ietf.json: ${missingDraftUrls.length}`);
  console.log(`RFC refs not in seedUrls.ietf.json: ${missingSeedUrls.length}`);
  console.log(`Total refs to backfill into seedUrls.ietf.json: ${missingAll.length}`);
  if (!missingAll.length) return;

  for (const u of missingAll) console.log(`- ${u}`);

  if (!doWrite) {
    console.log('\nDry run only. Re-run with --write to append these seeds.');
    return;
  }

  const out = [...seeds];
  for (const u of missingAll) out.push(u);
  saveJson(SEED_PATH, canonicalizeSeeds(out));
  console.log(`\nUpdated ${SEED_PATH} (+${missingAll.length} seed URL(s): ${missingDraftUrls.length} draft, ${missingSeedUrls.length} RFC).`);
}

main();
