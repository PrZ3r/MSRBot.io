/*
 * keywordIdamsAudit.mjs — how close is each keyword the IDAMS passes added
 * (idamsFieldBackfill.js + idamsIngest.js) to one that already existed?
 *
 * "Existing" = site.json controlledKeywords as of the pre-IDAMS commit
 * (BASE_REF). "New" = every term in today's controlledKeywords not in that set.
 * Read-only: nothing is decided or written except the report.
 *
 * Each new term is matched, strongest first, against the existing vocabulary:
 *
 *   same      — identical once case, spacing, hyphens/dashes, dots, Δ/delta,
 *               ×/x, British spelling and plurals are ignored
 *               ("DeltaICTCP" ≡ "Delta ICTCP" ≡ "ΔICTCP", "Wide Colour Gamut")
 *   acronym   — its acronym or expansion is an existing term, learned from
 *               "Long Form (ACR)" terms anywhere in the vocabulary, or from
 *               the initials of a 3+-word long form ("High-dynamic-range" ↔
 *               HDR; two-word initials are too ambiguous — AR, IP, VR)
 *   typo      — one edit from an existing term, same first and last letter
 *               ("Interne" → Internet, "Olumetric Videos" → Volumetric Video)
 *   contains  — carries an existing term as whole tokens ("HDR Live
 *               Production" ⊃ HDR) — a narrower topic, informational
 *   none      — nothing close in the existing vocabulary
 *
 * New terms that match each other (same / acronym / typo) are also clustered,
 * so duplicates WITHIN the new set show up even when nothing existing is near.
 *
 *   node …/keywordIdamsAudit.mjs
 *
 * Report: src/main/reports/smpte-canonical-audit/keywordIdamsAudit.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(__dirname, '..', '..', '..', '..', '..'));

const { loadAllDocs } = require('../../../lib/registry');

const BASE_REF = 'd2fbe5ac0e71'; // main before the IDAMS passes (v2.9.0 + #2378)
const OUT_MD = 'src/main/reports/smpte-canonical-audit/keywordIdamsAudit.md';

const base = JSON.parse(execSync(`git show ${BASE_REF}:src/main/config/site.json`, { encoding: 'utf8' })).controlledKeywords;
const current = JSON.parse(fs.readFileSync('src/main/config/site.json', 'utf8')).controlledKeywords;
const baseLower = new Set(base.map((k) => k.toLowerCase()));
const added = current.filter((k) => !baseLower.has(k.toLowerCase()));

const docCount = new Map();
const exampleDoc = new Map();
for (const d of loadAllDocs()) {
  for (const k of new Set(d.keywords || [])) {
    docCount.set(k, (docCount.get(k) || 0) + 1);
    if (!exampleDoc.has(k)) exampleDoc.set(k, d.docId);
  }
}

// ---- keys ----------------------------------------------------------------
const BRIT = [[/colour/g, 'color'], [/centre/g, 'center'], [/metre/g, 'meter'], [/isation/g, 'ization'],
  [/ise\b/g, 'ize'], [/analyse/g, 'analyze'], [/programme/g, 'program'], [/grey/g, 'gray'], [/modelling/g, 'modeling']];
const words = (s) => String(s).replace(/\b([A-Z]{2,})s\b/g, '$1').toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/δ|∆/g, 'delta ').replace(/×/g, 'x').replace(/[′’']/g, '')
  .replace(/\bsmpte\s+/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
  .map((w) => { let x = w; for (const [re, to] of BRIT) x = x.replace(re, to); return x; })
  .map((w) => (w.length > 4 && /s$/.test(w) && !/(ss|us|is|ws)$/.test(w) ? w.slice(0, -1) : w));
// "same" key: words glued, so spacing/hyphen/dot differences vanish.
const sameKey = (s) => words(String(s).replace(/\s*\([^)]*\)\s*$/, '')).join('');
const acronymOf = (s) => ((String(s).match(/\(([^()]{2,15})\)\s*$/) || [])[1] || null);
const longOf = (s) => String(s).replace(/\s*\([^)]*\)\s*$/, '').trim();
const initials = (s) => words(longOf(s)).filter((w) => !['of', 'and', 'for', 'the', 'on', 'over', 'in', 'to', 'a'].includes(w))
  .map((w) => w[0]).join('');

// Acronym ↔ expansion pairs learned from "Long Form (ACR)" anywhere.
const acrToLong = new Map(); // sameKey(acr) → Set(sameKey(long))
const longToAcr = new Map();
for (const t of [...base, ...added]) {
  const acr = acronymOf(t);
  if (!acr) continue;
  const a = sameKey(acr);
  const l = sameKey(longOf(t));
  if (!a || !l || a === l) continue;
  if (!acrToLong.has(a)) acrToLong.set(a, new Set());
  acrToLong.get(a).add(l);
  if (!longToAcr.has(l)) longToAcr.set(l, new Set());
  longToAcr.get(l).add(a);
}

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// Every key a term answers to for "same" / "acronym" matching.
function keysOf(t) {
  const out = new Set([sameKey(t)]);
  const acr = acronymOf(t);
  if (acr) { out.add(sameKey(acr)); out.add(sameKey(longOf(t))); }
  return [...out].filter(Boolean);
}

// ---- index existing --------------------------------------------------------
const bySame = new Map(); // sameKey → existing term
const byAcr = new Map();  // key reachable via acronym/expansion → existing term
for (const t of base) {
  for (const k of keysOf(t)) if (!bySame.has(k)) bySame.set(k, t);
}
for (const t of base) {
  const k = sameKey(t);
  for (const l of acrToLong.get(k) || []) if (!byAcr.has(l)) byAcr.set(l, t);   // t is an acronym
  for (const a of longToAcr.get(k) || []) if (!byAcr.has(a)) byAcr.set(a, t);   // t is a long form
}
const baseTokens = base.map((t) => ({ t, w: words(t) })).filter((x) => x.w.length);

function matchExisting(t) {
  for (const k of keysOf(t)) if (bySame.has(k)) return { how: 'same', to: bySame.get(k) };
  for (const k of keysOf(t)) if (byAcr.has(k)) return { how: 'acronym', to: byAcr.get(k) };
  // initials of a long form equal an existing acronym-style term ("High-dynamic-range" → HDR)
  const ini = initials(t);
  if (ini.length >= 3 && words(longOf(t)).length >= 3) {
    const hit = base.find((b) => /^[A-Z0-9][A-Z0-9-]+$/.test(b) && sameKey(b) === ini);
    if (hit) return { how: 'acronym', to: hit, note: 'initials' };
  }
  const k = sameKey(t);
  if (k.length >= 7) {
    let best = null;
    for (const b of base) {
      const bk = sameKey(b);
      if (bk.length < 7) continue;
      if (k[0] !== bk[0] || k.at(-1) !== bk.at(-1)) continue;
      const d = lev(k, bk, 1);
      if (d <= 1 && (!best || d < best.d)) best = { d, b };
    }
    if (best) return { how: 'typo', to: best.b, note: `edit ${best.d}` };
  }
  const tw = words(t);
  const contained = baseTokens
    .filter((x) => x.w.length < tw.length && tw.join(' ').match(new RegExp(`(^| )${x.w.join(' ')}( |$)`)))
    .sort((a, b) => b.w.length - a.w.length);
  if (contained.length) return { how: 'contains', to: contained.slice(0, 3).map((x) => x.t).join(' · ') };
  return { how: 'none', to: null };
}

// ---- cluster the new terms among themselves (union-find) ----------------
const parent = new Map(added.map((t) => [t, t]));
const find = (t) => { while (parent.get(t) !== t) t = parent.get(t); return t; };
const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent.set(rb, ra); };
const firstByKey = new Map();
for (const t of added) {
  const ks = [...keysOf(t), ...[...(acrToLong.get(sameKey(t)) || [])], ...[...(longToAcr.get(sameKey(t)) || [])]];
  for (const k of ks) {
    if (firstByKey.has(k)) union(firstByKey.get(k), t); else firstByKey.set(k, t);
  }
}
const longKeys = added.map((t) => [t, sameKey(t)]).filter(([, k]) => k.length >= 9);
for (let i = 0; i < longKeys.length; i++) {
  for (let j = i + 1; j < longKeys.length; j++) {
    const [a, b] = [longKeys[i][1], longKeys[j][1]];
    if (a[0] !== b[0] || a.at(-1) !== b.at(-1)) continue; // File/Tile Based, Generation X/Y
    if (lev(a, b, 1) <= 1) union(longKeys[i][0], longKeys[j][0]);
  }
}

// ---- assemble ------------------------------------------------------------
const rows = added.map((t) => ({ t, n: docCount.get(t) || 0, doc: exampleDoc.get(t), ...matchExisting(t) }));
const byHow = { same: [], acronym: [], typo: [], contains: [], none: [] };
for (const r of rows) byHow[r.how].push(r);

const clusters = new Map();
for (const t of added) {
  const r = find(t);
  if (!clusters.has(r)) clusters.set(r, []);
  clusters.get(r).push(t);
}
const multi = [...clusters.values()].filter((c) => c.length > 1)
  .map((c) => c.sort((a, b) => (docCount.get(b) || 0) - (docCount.get(a) || 0)))
  .sort((a, b) => b.reduce((n, t) => n + (docCount.get(t) || 0), 0) - a.reduce((n, t) => n + (docCount.get(t) || 0), 0));
const rowOf = new Map(rows.map((r) => [r.t, r]));

const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|');
const docsCol = (r) => `${r.n}`;
const table = (list, withNote) => [
  `| new term | docs | ${withNote ? 'existing term | how' : 'existing term'} |`,
  `|---|---:|${withNote ? '---|---' : '---'}|`,
  ...list.sort((a, b) => b.n - a.n || a.t.localeCompare(b.t))
    .map((r) => `| ${esc(r.t)} | ${docsCol(r)} | ${esc(r.to)}${withNote ? ` | ${esc(r.note || '')}` : ''} |`),
];
const dist = (list) => {
  const d = { 1: 0, 2: 0, '3–4': 0, '5+': 0 };
  for (const r of list) d[r.n >= 5 ? '5+' : r.n >= 3 ? '3–4' : r.n]++;
  return Object.entries(d).map(([k, v]) => `${k} doc${k === '1' ? '' : 's'}: ${v}`).join(' · ');
};

const md = [
  '# IDAMS keyword audit — new terms vs. existing vocabulary',
  '',
  `> Generated ${new Date().toISOString()} · existing = controlledKeywords at \`${BASE_REF}\` (${base.length}) · new = ${added.length} terms added since`,
  '',
  'Read-only. Nothing here is decided — this is the map for the keep / fold / toss pass.',
  '',
  '## Summary',
  '',
  '| match to existing | terms | spread |',
  '|---|---:|---|',
  ...Object.entries(byHow).map(([k, v]) => `| ${k} | ${v.length} | ${dist(v)} |`),
  `| **total** | **${added.length}** | ${dist(rows)} |`,
  '',
  `Duplicate clusters within the new terms: **${multi.length}** clusters holding ${multi.reduce((n, c) => n + c.length, 0)} terms.`,
  '',
  '## 1. Same as an existing term (spacing / punctuation / case / spelling)',
  '',
  ...table(byHow.same, false),
  '',
  '## 2. Acronym or expansion of an existing term',
  '',
  'Rows marked *initials* are guesses from the long form\'s initials. Check the meaning: "Anti-alias Filter" spells AAF, but the existing AAF is Advanced Authoring Format.',
  '',
  ...table(byHow.acronym, true),
  '',
  '## 3. Possible typo of an existing term',
  '',
  'One edit apart, with the same first and last letter. Some are only look-alikes ("Contract" / "Contrast").',
  '',
  ...table(byHow.typo, true),
  '',
  '## 4. Duplicate clusters within the new terms',
  '',
  'Each line is one cluster, most-used spelling first. "→ existing" marks a cluster that also matches an existing term.',
  '',
  ...multi.map((c) => {
    const ex = c.map((t) => rowOf.get(t)).find((r) => r && ['same', 'acronym', 'typo'].includes(r.how));
    return `- ${c.map((t) => `${esc(t)} (${docCount.get(t) || 0})`).join(' · ')}${ex ? ` → existing **${esc(ex.to)}**` : ''}`;
  }),
  '',
  '## 5. Contains an existing term (narrower topic)',
  '',
  ...table(byHow.contains, false),
  '',
  '## 6. Nothing close in the existing vocabulary',
  '',
  ...table(byHow.none, false),
  '',
];
fs.writeFileSync(OUT_MD, md.join('\n'), 'utf8');
console.log(`[kw-audit] ${added.length} new terms — ${Object.entries(byHow).map(([k, v]) => `${k} ${v.length}`).join(' · ')} · ${multi.length} clusters`);
console.log(`  report: ${OUT_MD}`);
