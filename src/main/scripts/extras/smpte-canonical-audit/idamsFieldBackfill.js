/*
 * idamsFieldBackfill.js — keywords + author bios from the raw IDAMS source.
 *
 * Reads the raw SMPTE `<publication>` XML under _source/SMPTE/ (Journal Article
 * Repository + Conference Repository), NOT the canonicalLibrary.*.json dump —
 * the dump drops keywordset / authorbio from the historical shape.
 *
 * Fills, on registry docs matched by EXACT `doi` (case-sensitive — J vs j):
 *
 *   1. keywords  registry empty, source has articleinfo/keywordset terms.
 *                Terms are CDATA-unwrapped with inline markup (<italic>) and
 *                entities stripped, then conformed the keywordConformIngest
 *                way: vocab casing → fold → normalizeKeyword(). Drops come from
 *                keywordVocabDecisions.json. Terms new to the vocabulary are
 *                added to site.json controlledKeywords on --apply (the
 *                validator gates doc.keywords ⊆ controlledKeywords).
 *   2. bios      no registry author has a bio yet, source authors do. Each
 *                source bio lands on the registry author it matches by name
 *                (full name, else surname + first initial; unique matches
 *                only). Unmatched bios are reported, never guessed.
 *
 * Fields whose `$meta.excludeChanges === true` are never touched.
 *
 *   node …/idamsFieldBackfill.js            # dry-run → report
 *   node …/idamsFieldBackfill.js --apply    # write docs + controlledKeywords
 *
 * Report: src/main/reports/smpte-canonical-audit/idamsFieldBackfill.md
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, saveDoc } = require('../../../lib/registry');
const { normalizeKeyword } = require('../../utils/keyword.normalize');

const APPLY = process.argv.includes('--apply');
const NOW = new Date().toISOString();
const VERSION = 'smpte-idams-publication@v1';
const SOURCE_ROOT = '_source/SMPTE';
const REPOS = ['Journal Article Repository', 'Conference Repository'];
const SITE_PATH = 'src/main/config/site.json';
const REPORTS = 'src/main/reports/smpte-canonical-audit';
const DECISIONS_PATH = path.join(REPORTS, 'keywordVocabDecisions.json');
const OUT_MD = path.join(REPORTS, 'idamsFieldBackfill.md');

// ---- text cleaning -------------------------------------------------------
function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
// CDATA first, then inline markup (<italic xmlns:…>), then entities.
function cleanText(s) {
  if (s == null) return null;
  const out = decodeEntities(String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
  return out || null;
}
function nameKey(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? cleanText(m[1]) : null;
};

// ---- source walk ---------------------------------------------------------
function listXml(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__MACOSX' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listXml(p, out);
    else if (e.name.endsWith('.xml') && !e.name.endsWith('-ref.xml')) out.push(p);
  }
  return out;
}

function parseArticle(xml) {
  const doi = (xml.match(/<articledoi>\s*([^<\s]+)\s*<\/articledoi>/) || [])[1];
  const keywords = [];
  for (const ks of xml.matchAll(/<keywordset\b[^>]*>([\s\S]*?)<\/keywordset>/g)) {
    for (const m of ks[1].matchAll(/<keywordterm>([\s\S]*?)<\/keywordterm>/g)) {
      const t = cleanText(m[1]);
      if (t) keywords.push(t);
    }
  }
  const authors = [];
  for (const m of xml.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/g)) {
    const a = m[1];
    authors.push({
      order: Number(tag(a, 'authororder')) || authors.length + 1,
      name: tag(a, 'nonnormname'),
      firstname: tag(a, 'firstname'),
      surname: tag(a, 'surname'),
      bio: tag(a, 'authorbio'),
    });
  }
  return { doi, keywords, authors };
}

const source = new Map(); // doi → { keywords, authors, rel }
let filesScanned = 0;
for (const repo of REPOS) {
  for (const file of listXml(path.join(SOURCE_ROOT, repo))) {
    const xml = fs.readFileSync(file, 'utf8');
    if (!xml.includes('<publication')) continue;
    filesScanned++;
    if (!xml.includes('<keywordset') && !xml.includes('<authorbio')) continue;
    for (const chunk of xml.split(/<article\b/).slice(1)) {
      const a = parseArticle(chunk);
      if (!a.doi) continue;
      if (!a.keywords.length && !a.authors.some((x) => x.bio)) continue;
      source.set(a.doi, { ...a, rel: path.relative(SOURCE_ROOT, file) });
    }
  }
}
console.log(`[idams] ${filesScanned} <publication> files scanned · ${source.size} articles with keywords or bios`);

// ---- keyword conform (keywordConformIngest rules) -------------------------
const site = JSON.parse(fs.readFileSync(SITE_PATH, 'utf8'));
const decisions = JSON.parse(fs.readFileSync(DECISIONS_PATH, 'utf8'));
const vocabByLower = new Map();
for (const k of [...(site.controlledKeywords || []), ...(decisions.adds || [])]) vocabByLower.set(String(k).toLowerCase(), k);
const foldByLower = new Map(Object.entries(decisions.folds || {}).map(([k, v]) => [k.toLowerCase(), v]));
const dropLower = new Set((decisions.drops || []).map((d) => String(typeof d === 'string' ? d : d.term || '').toLowerCase()));

// IEEE terms arrive mixed-case ("Digital TV", "DVB-S2", "192 kHz", "AES3id"),
// unlike the ALL-CAPS index_terms normalizeKeyword() was written for. Tokens
// carrying a capital past their first letter are passed through as-is via its
// extraAcronyms hook; wrapping quotes go, and "(computer graphics)" gets the
// word after "(" capitalized like any other word.
function normalizeIeee(raw) {
  const s = raw.replace(/^[“”"']+|[“”"']+$/g, '').trim();
  const keep = new Map();
  for (const w of s.split(/\s+/)) if (/[A-Z]/.test(w.slice(1))) keep.set(w.toLowerCase(), w);
  return normalizeKeyword(s, keep).replace(/\(([a-z])/g, (_, c) => `(${c.toUpperCase()}`);
}

// Source typos (long-tail FIX policy — keywordLongTailApply.js).
const FIX = new Map([
  ['ciritcal listening setup', 'Critical Listening Setup'],
  ['ucompressed transport', 'Uncompressed Transport'],
  ['ip protecton', 'IP Protection'],
]);
// New (non-vocab) terms, first-seen form wins, so case variants across docs
// ("Frame-rate" / "Frame-Rate") land as one controlledKeywords entry.
const runVocab = new Map();

function conformList(terms) {
  const out = [];
  const seen = new Set();
  const how = { vocab: 0, fold: 0, fix: 0, normalize: 0, drop: 0 };
  for (const raw of terms) {
    const lo = raw.replace(/^[“”"']+|[“”"']+$/g, '').trim().toLowerCase();
    let term;
    if (dropLower.has(lo)) { how.drop++; continue; }
    if (vocabByLower.has(lo)) { term = vocabByLower.get(lo); how.vocab++; }
    else if (foldByLower.has(lo)) { term = foldByLower.get(lo); how.fold++; }
    else if (FIX.has(lo)) { term = FIX.get(lo); how.fix++; }
    else {
      term = normalizeIeee(raw);
      const key = term.toLowerCase();
      if (runVocab.has(key)) term = runVocab.get(key); else runVocab.set(key, term);
      how.normalize++;
    }
    if (!term || seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    out.push(term);
  }
  return { out, how };
}

// ---- bio matching --------------------------------------------------------
// The source's own bio↔author pairing is unreliable: multi-author articles
// often carry author B's bio on author A (two-way swaps, three-way rotations).
// So the bio TEXT decides first — a bio goes to the registry author whose
// surname it names earliest. Only a bio naming no registry author (affiliation-
// only text, OCR-misspelt names) falls back to the source author-name pairing.
// Two bios claiming one author → both reported, neither written.
const surnameKey = (name) => nameKey(String(name || '').trim().split(/\s+/).pop());

function matchBios(regAuthors, srcAuthors) {
  const withBio = srcAuthors.filter((s) => s.bio);
  const regKeys = regAuthors.map((a) => nameKey(a && a.name));
  const regSur = regAuthors.map((a) => surnameKey(a && a.name));
  const claims = new Map(); // reg index → [{ bio, how, source }]
  const unmatched = [];
  for (const s of withBio) {
    const source = s.name || `${s.firstname} ${s.surname}`;
    const text = ` ${nameKey(s.bio)} `;
    let pick = -1;
    let how = 'text';
    let best = Infinity;
    regSur.forEach((sur, i) => {
      if (!sur) return;
      let at = text.indexOf(` ${sur} `);
      // Shared surname (Yasuaki / Yukihiro Nishida): the given name decides.
      if (at >= 0 && regSur.filter((x) => x === sur).length > 1) {
        const given = regKeys[i].split(' ')[0];
        at = given.length > 1 ? text.indexOf(` ${given} `) : -1;
      }
      if (at >= 0 && at < best) { best = at; pick = i; }
    });
    if (pick < 0) {
      how = 'name';
      const full = nameKey(source);
      const sur = nameKey(s.surname);
      const ini = nameKey(s.firstname).charAt(0);
      let hits = regKeys.map((k, i) => (k && k === full ? i : -1)).filter((i) => i >= 0);
      if (hits.length !== 1 && sur) {
        hits = regKeys.map((k, i) => {
          const parts = k.split(' ');
          return parts[parts.length - 1] === sur && (!ini || parts[0].charAt(0) === ini) ? i : -1;
        }).filter((i) => i >= 0);
      }
      if (hits.length !== 1) { unmatched.push({ source, reason: `no surname in bio; ${hits.length} name candidates` }); continue; }
      pick = hits[0];
    }
    if (!claims.has(pick)) claims.set(pick, []);
    claims.get(pick).push({ bio: s.bio, how, source });
  }
  const assigned = new Map(); // reg index → bio
  const realigned = [];
  for (const [i, list] of claims) {
    if (list.length > 1) {
      for (const c of list) unmatched.push({ source: c.source, reason: `bio collides on ${regAuthors[i].name}` });
      continue;
    }
    assigned.set(i, list[0].bio);
    if (list[0].how === 'text' && nameKey(list[0].source) !== regKeys[i]
        && surnameKey(list[0].source) !== regSur[i]) realigned.push({ from: list[0].source, to: regAuthors[i].name });
  }
  return { assigned, unmatched, realigned };
}

// ---- walk registry -------------------------------------------------------
const isLocked = (doc, key) => (doc[`${key}$meta`] || {}).excludeChanges === true;
const docs = loadAllDocs();
const byDoi = new Map();
for (const d of docs) if (d.doi) byDoi.set(String(d.doi).trim(), d);

const kwChanges = [];
const bioChanges = [];
const bioUnmatched = [];
const bioRealigned = [];
const newVocab = new Map(); // term → doc count
const tally = {
  sourceNotInRegistry: 0, kwAlreadyPresent: 0, kwLocked: 0, kwEmptyAfterConform: 0,
  bioAlreadyPresent: 0, bioLocked: 0, bioNoRegAuthors: 0, bioNoneMatched: 0,
};
const howTotals = { vocab: 0, fold: 0, fix: 0, normalize: 0, drop: 0 };

for (const [doi, s] of source) {
  const doc = byDoi.get(doi);
  if (!doc) { tally.sourceNotInRegistry++; continue; }

  if (s.keywords.length) {
    if (Array.isArray(doc.keywords) && doc.keywords.length) tally.kwAlreadyPresent++;
    else if (isLocked(doc, 'keywords')) tally.kwLocked++;
    else {
      const { out, how } = conformList(s.keywords);
      for (const k of Object.keys(how)) howTotals[k] += how[k];
      if (!out.length) tally.kwEmptyAfterConform++;
      else {
        for (const t of out) if (!vocabByLower.has(t.toLowerCase())) newVocab.set(t, (newVocab.get(t) || 0) + 1);
        kwChanges.push({ doc, raw: s.keywords, after: out, rel: s.rel });
      }
    }
  }

  if (s.authors.some((a) => a.bio)) {
    const reg = Array.isArray(doc.authors) ? doc.authors : [];
    if (!reg.length) tally.bioNoRegAuthors++;
    else if (reg.some((a) => a && typeof a === 'object' && a.bio)) tally.bioAlreadyPresent++;
    else if (isLocked(doc, 'authors')) tally.bioLocked++;
    else {
      const { assigned, unmatched, realigned } = matchBios(reg, s.authors);
      for (const r of realigned) bioRealigned.push({ docId: doc.docId, ...r });
      if (unmatched.length) bioUnmatched.push({ docId: doc.docId, reg: reg.map((a) => a && a.name), unmatched });
      if (!assigned.size) tally.bioNoneMatched++;
      else {
        const after = reg.map((a, i) => (assigned.has(i) ? { ...a, bio: assigned.get(i) } : a));
        bioChanges.push({ doc, after, count: assigned.size, rel: s.rel });
      }
    }
  }
}

const kwDocTypes = {};
for (const c of kwChanges) kwDocTypes[c.doc.docType] = (kwDocTypes[c.doc.docType] || 0) + 1;
const bioDocTypes = {};
for (const c of bioChanges) bioDocTypes[c.doc.docType] = (bioDocTypes[c.doc.docType] || 0) + 1;
const biosWritten = bioChanges.reduce((n, c) => n + c.count, 0);

// ---- apply ---------------------------------------------------------------
if (APPLY) {
  const byDoc = new Map();
  for (const c of kwChanges) byDoc.set(c.doc.docId, c.doc);
  for (const c of bioChanges) byDoc.set(c.doc.docId, c.doc);
  for (const c of kwChanges) {
    c.doc.keywords = c.after;
    c.doc['keywords$meta'] = {
      source: 'parsed',
      confidence: 'high',
      note: 'Keywords from SMPTE IDAMS <publication> articleinfo/keywordset (raw _source XML), conformed via controlledKeywords / keywordVocabDecisions folds + normalizeKeyword() — idamsFieldBackfill.js',
      updated: NOW,
      version: VERSION,
    };
  }
  for (const c of bioChanges) {
    const prev = c.doc['authors$meta'] || {};
    c.doc.authors = c.after;
    c.doc['authors$meta'] = {
      ...prev,
      note: `${prev.note ? `${prev.note}; ` : ''}bios backfilled from SMPTE IDAMS <publication> authorgroup/author/authorbio (name-matched) — idamsFieldBackfill.js`,
      updated: NOW,
      version: VERSION,
    };
  }
  for (const doc of byDoc.values()) saveDoc(doc);

  const missing = [...newVocab.keys()].filter((t) => !(site.controlledKeywords || []).some((k) => k.toLowerCase() === t.toLowerCase()));
  const adds = (decisions.adds || []).filter((a) => !(site.controlledKeywords || []).some((k) => k.toLowerCase() === a.toLowerCase()));
  if (missing.length || adds.length) {
    site.controlledKeywords = Array.from(new Set([...(site.controlledKeywords || []), ...missing, ...adds]))
      .sort((a, b) => a.localeCompare(b));
    fs.writeFileSync(SITE_PATH, JSON.stringify(site, null, 2) + '\n', 'utf8');
  }
  console.log(`[idams] wrote ${byDoc.size} docs · +${missing.length + adds.length} controlledKeywords`);
}

// ---- report --------------------------------------------------------------
const esc = (s) => String(s).replace(/\|/g, '\\|');
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(' · ') || '—';
const md = [
  '# IDAMS field backfill — keywords + author bios',
  '',
  `> ${APPLY ? 'APPLY' : 'DRY-RUN'} · ${NOW}`,
  `> Source: raw \`${SOURCE_ROOT}/{${REPOS.join(',')}}\` <publication> XML · joined on exact \`doi\``,
  '',
  '## Totals',
  '',
  `- <publication> files scanned: ${filesScanned}; articles with keywords or bios: ${source.size}`,
  `- source articles with no registry doc: ${tally.sourceNotInRegistry} (the 2016–2023 coverage gap — separate ingest)`,
  `- **keywords**: ${kwChanges.length} docs to fill (${fmt(kwDocTypes)}) · already had keywords ${tally.kwAlreadyPresent} · locked ${tally.kwLocked} · empty after conform ${tally.kwEmptyAfterConform}`,
  `  - term mapping: vocab ${howTotals.vocab} · fold ${howTotals.fold} · typo-fix ${howTotals.fix} · normalize ${howTotals.normalize} · dropped ${howTotals.drop}`,
  `  - terms new to controlledKeywords: **${newVocab.size}** (added on --apply)`,
  `- **bios**: ${bioChanges.length} docs / ${biosWritten} bios to fill (${fmt(bioDocTypes)}) · already had bios ${tally.bioAlreadyPresent} · locked ${tally.bioLocked} · no registry authors ${tally.bioNoRegAuthors} · no bio matched ${tally.bioNoneMatched}`,
  `  - realigned (source paired bio with the wrong author; text match wins): ${bioRealigned.length}`,
  `  - docs with ≥1 unmatched source bio: ${bioUnmatched.length} (${bioUnmatched.reduce((n, u) => n + u.unmatched.length, 0)} bios)`,
  '',
  '## Keyword fills',
  '',
  '| docId | source terms | → registry keywords |',
  '|---|---|---|',
  ...kwChanges.map((c) => `| \`${c.doc.docId}\` | ${esc(c.raw.join(' · '))} | ${esc(c.after.join(' · '))} |`),
  '',
  '## New controlledKeywords terms',
  '',
  'Review for the long-tail drop/fold list before --apply (keywordVocabDecisions.json `drops` / `folds`).',
  '',
  ...[...newVocab.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, n]) => `- ${esc(t)}${n > 1 ? ` (${n})` : ''}`),
  '',
  '## Bio fills (first 40)',
  '',
  '| docId | authors | bio filled for |',
  '|---|---|---|',
  ...bioChanges.slice(0, 40).map((c) => `| \`${c.doc.docId}\` | ${c.after.length} | ${esc(c.after.filter((a) => a && a.bio).map((a) => a.name).join(' · '))} |`),
  '',
  '## Realigned bios (source paired the bio with a different author — bio text names the registry author)',
  '',
  '| docId | source author | → bio lands on |',
  '|---|---|---|',
  ...bioRealigned.map((r) => `| \`${r.docId}\` | ${esc(r.from)} | ${esc(r.to)} |`),
  '',
  '## Unmatched source bios (review — never written)',
  '',
  '| docId | registry authors | unmatched source author (candidates) |',
  '|---|---|---|',
  ...bioUnmatched.map((u) => `| \`${u.docId}\` | ${esc(u.reg.join(' · '))} | ${esc(u.unmatched.map((x) => `${x.source} (${x.reason})`).join(' · '))} |`),
  '',
];
fs.writeFileSync(OUT_MD, md.join('\n'), 'utf8');

console.log(`[idams] ${APPLY ? 'APPLIED' : 'DRY-RUN'} — keywords ${kwChanges.length} docs (+${newVocab.size} vocab) · bios ${bioChanges.length} docs / ${biosWritten} bios · unmatched-bio docs ${bioUnmatched.length}`);
console.log(`  report: ${OUT_MD}`);
if (!APPLY) console.log('  re-run with --apply, then npm run canonicalize && npm run validate.');
