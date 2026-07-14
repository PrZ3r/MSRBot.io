/*
 * buildFacetKeywords.js — generate site.json `facetKeywords` (the doc-list chips).
 *
 * `controlledKeywords` is the INDEXED vocabulary — every searchable term (~990),
 * far too many to render as chips. `facetKeywords` is the curated browsable
 * subset. It is generated, not hand-maintained, in three passes:
 *
 *   1. HIGH COUNT   — terms carried by >= MIN_DOCS docs. The chips people
 *                     actually reach for.
 *   2. PORTAL       — every keyword a portal flags (portals.json `match.keyword`,
 *                     plus keyword lists in sections/items). NON-NEGOTIABLE: a
 *                     portal that filters on a keyword whose chip doesn't exist
 *                     is a portal you can't browse.
 *   3. HAND         — explicit ADD / REMOVE below, applied last so curation
 *                     always wins over the heuristics.
 *
 * Chip counts use whole-token matching (see build.search-index.js tokenContains),
 * so a broad chip aggregates its family: "AI" covers "Generative AI" /
 * "AI Ethics" / "AI-Driven Media" — but never "Chain" / "Domain" / "Training".
 * That's why a chip can be broad without the vocabulary having to be.
 *
 *   node …/buildFacetKeywords.js            # dry-run → report
 *   node …/buildFacetKeywords.js --apply    # write site.json facetKeywords
 *
 * Report: src/main/reports/smpte-canonical-audit/facetKeywords.md
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs } = require('../../../lib/registry');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const APPLY = process.argv.includes('--apply');
const SITE_PATH = 'src/main/config/site.json';
const PORTALS_PATH = 'src/main/data/portals.json';
const OUT_MD = 'src/main/reports/smpte-canonical-audit/facetKeywords.md';

// Pass 1 threshold — a term needs this many docs to earn a chip on count alone.
// Passes 2 and 3 bypass it: a portal-flagged or hand-curated chip is included at
// any count (HTJ2K rides on 1 doc, and must, or the dcinema portal can't browse).
const MIN_DOCS = 30;

// Pass 3 — hand curation. ADD: below the count bar but worth browsing (emerging
// topics we want discoverable). REMOVE: over the bar but useless as a facet.
const HAND_ADD = [
  'AI', 'Machine Learning', 'Virtual Production', 'Virtual Reality',
  'Augmented Reality', 'Metaverse', 'Sustainability', 'Streaming', 'Cloud',
  'Latency', 'Video Coding', 'Encoding', 'Rendering', 'Storage', 'Quality',
  'Standards', 'Display',
];
const HAND_REMOVE = [
  'Dimension',   // structural tag, not a topic anyone browses by
  'Traffic',
  'Label',
  'Absolute',
  'Alpha',
  'Access',
];

// ---- token matching (mirrors build.search-index.js) ------------------------
function tokenContains(hay, needle) {
  const h = String(hay == null ? '' : hay).toLowerCase();
  const n = String(needle == null ? '' : needle).toLowerCase();
  if (!h || !n) return false;
  const isWord = (c) => /[a-z0-9]/.test(c);
  let i = 0;
  while ((i = h.indexOf(n, i)) !== -1) {
    const before = i === 0 ? '' : h[i - 1];
    const after = (i + n.length >= h.length) ? '' : h[i + n.length];
    if ((!before || !isWord(before)) && (!after || !isWord(after))) return true;
    i += 1;
  }
  return false;
}

// ---- gather ---------------------------------------------------------------
const site = JSON.parse(fs.readFileSync(SITE_PATH, 'utf8'));
const vocab = site.controlledKeywords || [];
const vocabByLower = new Map(vocab.map((k) => [k.toLowerCase(), k]));
const docs = loadAllDocs();

// exact per-term doc counts (pass 1 works on the term as written)
const exactCount = new Map();
for (const d of docs) {
  for (const k of new Set((d.keywords || []).map(String))) {
    exactCount.set(k, (exactCount.get(k) || 0) + 1);
  }
}

// Pass 2 — every keyword any portal references
const portalKeywords = new Set();
try {
  const raw = fs.readFileSync(PORTALS_PATH, 'utf8');
  for (const m of raw.matchAll(/"keyword"\s*:\s*"([^"]+)"/g)) portalKeywords.add(m[1]);
  for (const m of raw.matchAll(/"keywords"\s*:\s*\[([^\]]*)\]/g)) {
    for (const km of m[1].matchAll(/"([^"]+)"/g)) portalKeywords.add(km[1]);
  }
} catch (e) {
  console.warn(`[facets] portals unreadable: ${e.message}`);
}

// ---- assemble -------------------------------------------------------------
const provenance = new Map(); // chip → [passes]
const note = (term, pass) => {
  const canon = vocabByLower.get(String(term).toLowerCase()) || term;
  if (!provenance.has(canon)) provenance.set(canon, []);
  if (!provenance.get(canon).includes(pass)) provenance.get(canon).push(pass);
};

for (const [term, n] of exactCount) if (n >= MIN_DOCS) note(term, 'count');
for (const term of portalKeywords) note(term, 'portal');
for (const term of HAND_ADD) note(term, 'hand');

for (const term of HAND_REMOVE) {
  const canon = vocabByLower.get(term.toLowerCase()) || term;
  provenance.delete(canon);
}

// Aggregate (token-matched) doc count per chip — what the UI shows.
// NOTE: a chip need NOT be a vocabulary term itself. "AI" is the clearest case:
// no doc carries the bare keyword "AI", but it token-matches "Generative AI",
// "AI Ethics", "AI-Driven Media". So the only disqualifier is matching NOTHING.
const chipCount = new Map();
for (const c of provenance.keys()) {
  let n = 0;
  for (const d of docs) if ((d.keywords || []).some((k) => tokenContains(k, c))) n++;
  chipCount.set(c, n);
}
const orphanChips = [...provenance.keys()].filter((c) => (chipCount.get(c) || 0) === 0);
for (const c of orphanChips) { provenance.delete(c); chipCount.delete(c); }

const chips = [...provenance.keys()].sort((a, b) => a.localeCompare(b));

if (APPLY) {
  site.facetKeywords = chips;
  fs.writeFileSync(SITE_PATH, JSON.stringify(site, null, 2) + '\n', 'utf8');
}

// ---- report ---------------------------------------------------------------
const rows = chips.slice().sort((a, b) => (chipCount.get(b) - chipCount.get(a)) || a.localeCompare(b));
const md = [
  '# Facet keyword chips — doc-list filter rail\n',
  `> ${APPLY ? 'APPLIED' : 'DRY-RUN'} · chips: **${chips.length}** (indexed vocabulary: ${vocab.length})`,
  `> Passes: count (>= ${MIN_DOCS} docs) · portal-flagged · hand curation\n`,
  '`controlledKeywords` stays the full indexed vocabulary — every term remains searchable.',
  'These chips are only the browsable subset. Counts are **aggregate**: a chip matches any',
  'keyword containing it as a whole token, so `AI` covers `Generative AI` / `AI Ethics`',
  '(but never `Chain` / `Domain`).\n',
  '| chip | docs | from |',
  '|---|---:|---|',
  ...rows.map((c) => `| ${c} | ${chipCount.get(c)} | ${provenance.get(c).join(' + ')} |`),
  '',
  `## Hand REMOVE (over the count bar, useless as facets)\n`,
  HAND_REMOVE.map((t) => `- ${t}`).join('\n'),
  '',
  ...(orphanChips.length ? ['## Dropped — match zero docs', orphanChips.map((t) => `- ${t}`).join('\n'), ''] : []),
].join('\n');
fs.writeFileSync(OUT_MD, md, 'utf8');

const byPass = { count: 0, portal: 0, hand: 0 };
for (const p of provenance.values()) for (const x of p) byPass[x]++;
console.log(`[facets] ${APPLY ? 'APPLIED' : 'DRY-RUN'} — ${chips.length} chips`);
console.log(`  from count (>=${MIN_DOCS} docs): ${byPass.count}`);
console.log(`  from portals              : ${byPass.portal}`);
console.log(`  from hand curation        : ${byPass.hand}`);
if (orphanChips.length) console.log(`  dropped (not in vocab)    : ${orphanChips.join(', ')}`);
console.log(`  report                    : ${OUT_MD}`);
if (!APPLY) console.log('\n  re-run with --apply to write site.json facetKeywords.');
