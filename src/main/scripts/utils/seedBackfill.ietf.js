/*
Backfill IETF seed URLs (RFC + IETF drafts) from MRI presence-audit missing refs, and from the
RFC-index relations on IETF docs we hold (status.supersededBy / amendedBy / supersedes / amends:
the lineage edges the MSI is built from) whose target isn't in the registry.

Usage:
  node src/main/scripts/utils/seedBackfill.ietf.js
  node src/main/scripts/utils/seedBackfill.ietf.js --write
  node src/main/scripts/utils/seedBackfill.ietf.js --limit 100 --out batch.json --write

--limit N takes the first N missing seeds: RFCs that supersede or update one we hold (the current
editions, which the weekly extract keeps current), then cited RFCs, then RFCs ours supersede or
update, each in number order, then drafts.
--relations seeds only the RFCs named by those relations (no citation backlog, no drafts). The
weekly extract runs it first, so an RFC that newly obsoletes or updates one we hold is pulled in.
--out <file> writes the chosen URLs as a JSON list, ready for
`extractDocs.js --provider ietf --only <file>`.
*/

const fs = require('fs');
const path = require('path');

const AUDIT_PATH = path.resolve(process.cwd(), 'src/main/reports/mri_presence_audit.json');
const SEED_PATH = path.resolve(process.cwd(), 'src/main/input/seedUrls.ietf.json');
const DOCS_DIR = path.resolve(process.cwd(), 'src/main/data/docs');

function walkJson(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkJson(p, out);
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

// RFCs named by status relations on the IETF docs we hold, split by direction, minus the ones
// already in the registry (any publisher; per-doc files are named <docId>.json).
// Numbers the RFC index lists as never issued (RFC26): nothing to fetch, so never seed them.
function notIssuedRfcs() {
  const p = path.resolve(process.cwd(), 'src/main/input/sources/ietf/rfc-index.xml');
  if (!fs.existsSync(p)) return new Set();
  const xml = fs.readFileSync(p, 'utf8');
  return new Set([...xml.matchAll(/<rfc-not-issued-entry>\s*<doc-id>RFC0*(\d+)<\/doc-id>/g)].map((m) => Number(m[1])));
}

function relationTargets() {
  const held = new Set(walkJson(DOCS_DIR).map((p) => path.basename(p, '.json')));
  const forward = new Set();
  const backward = new Set();
  for (const p of walkJson(path.join(DOCS_DIR, 'ietf'))) {
    let doc;
    try { doc = loadJson(p); } catch { continue; }
    const st = (doc && doc.status) || {};
    for (const [field, bucket] of [['supersededBy', forward], ['amendedBy', forward], ['supersedes', backward], ['amends', backward]]) {
      for (const id of Array.isArray(st[field]) ? st[field] : []) {
        const n = asRfcNum(id);
        if (Number.isInteger(n) && !held.has(`RFC${n}`)) bucket.add(n);
      }
    }
  }
  for (const n of forward) backward.delete(n);
  return { forward, backward };
}

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

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function main() {
  const doWrite = process.argv.includes('--write');
  const limitRaw = argValue('--limit');
  const limit = limitRaw == null ? null : Number(limitRaw);
  if (limitRaw != null && !(Number.isInteger(limit) && limit > 0)) {
    console.error(`--limit needs a positive whole number (got ${limitRaw})`);
    process.exit(1);
  }
  const outPath = argValue('--out');
  const relationsOnly = process.argv.includes('--relations');
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
  const notIssued = notIssuedRfcs();
  const unseeded = (n) => !notIssued.has(n) && !seedSet.has(toRfcUrl(n).toLowerCase());
  const byNum = (a, b) => a - b;
  const { forward, backward } = relationTargets();
  const citedSet = new Set(rfcNums);
  const forwardNums = [...forward].filter(unseeded).sort(byNum);
  const citedNums = rfcNums.filter((n) => unseeded(n) && !forward.has(n));
  const backwardNums = [...backward].filter((n) => unseeded(n) && !citedSet.has(n)).sort(byNum);
  const missingSeedUrls = relationsOnly
    ? [...forwardNums, ...[...backward].filter(unseeded).sort(byNum)].map((n) => toRfcUrl(n))
    : [...forwardNums, ...citedNums, ...backwardNums].map((n) => toRfcUrl(n));
  const missingDraftNames = relationsOnly ? [] : draftNames.filter((name) => !seedSet.has(toDraftUrl(name).toLowerCase()));
  const missingDraftUrls = missingDraftNames.map((name) => toDraftUrl(name));
  const missingAll = [...missingDraftUrls, ...missingSeedUrls];
  // A batch takes the newer editions first, then cited RFCs, then older editions, then drafts
  // (they need the most review).
  const batch = limit ? [...missingSeedUrls, ...missingDraftUrls].slice(0, limit) : missingAll;
  const batchDrafts = batch.filter((u) => classifySeed(u) === 'draft').length;

  console.log(`MRI missing refs: ${missingRows.length}`);
  console.log(`MRI missing RFC refs: ${rfcNums.length}`);
  console.log(`MRI missing IETF draft refs: ${draftNames.length}`);
  console.log(`RFCs superseding/updating one we hold, not seeded: ${forwardNums.length}`);
  console.log(`Cited RFCs not seeded: ${citedNums.length}`);
  console.log(`RFCs one we hold supersedes/updates, not cited, not seeded: ${backwardNums.length}`);
  console.log(`IETF draft refs not in seedUrls.ietf.json: ${missingDraftUrls.length}`);
  console.log(`RFC refs not in seedUrls.ietf.json: ${missingSeedUrls.length}`);
  console.log(`Total refs to backfill into seedUrls.ietf.json: ${missingAll.length}`);
  if (!missingAll.length) return;
  if (limit) console.log(`Batch (--limit ${limit}): ${batch.length} (${batch.length - batchDrafts} RFC, ${batchDrafts} draft); ${missingAll.length - batch.length} left after it`);

  for (const u of batch) console.log(`- ${u}`);

  if (outPath) {
    saveJson(path.resolve(process.cwd(), outPath), batch);
    console.log(`\nWrote ${batch.length} URL(s) to ${outPath} (for --only).`);
  }

  if (!doWrite) {
    console.log('\nDry run only. Re-run with --write to append these seeds.');
    return;
  }

  const out = [...seeds];
  for (const u of batch) out.push(u);
  saveJson(SEED_PATH, canonicalizeSeeds(out));
  console.log(`\nUpdated ${SEED_PATH} (+${batch.length} seed URL(s): ${batchDrafts} draft, ${batch.length - batchDrafts} RFC).`);
}

main();
