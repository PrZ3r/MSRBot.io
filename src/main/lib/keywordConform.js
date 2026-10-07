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
 * keywordConform.js — conform source keywords to the controlled vocabulary.
 *
 * Shared by every extractor that ingests publisher keywords (the SMPTE journal
 * extractor; the IDAMS backfill). Mixed-case IEEE terms keep their capitals;
 * ALL-CAPS sources opt into { shouted: true }. Variants cluster ("High-dynamic
 * Range (HDR)" ≡ HDR, "100 gbit/s" ≡ 100GbE) and land on the existing
 * vocabulary term, else the house-style spelling most docs use. Rules live in
 * src/main/config/keywordDecisions.json (folds / drops / splits / acronyms /
 * adds) — add a rule there, not in an extractor.
 */

const fs = require('fs');
const path = require('path');
const { normalizeKeyword } = require('../scripts/utils/keyword.normalize');

const DECISIONS_PATH = path.join(__dirname, '..', 'config', 'keywordDecisions.json');

// IEEE terms arrive mixed-case ("Digital TV", "DVB-S2", "192 kHz", "AES3id"),
// unlike the ALL-CAPS index_terms normalizeKeyword() was written for. Tokens
// carrying a capital past their first letter are passed through as-is via its
// extraAcronyms hook; wrapping quotes go, and the word after "(" or an em dash
// is capitalized like any other ("(Computer Graphics)", "Broadcast—Satellite").
// Mixed-case names that really do start lowercase (everything else of the
// form "sT", "iS-10", "iTU-R", "vR" is a source glitch → uppercased).
const LOWER_INITIAL_OK = new Set(['mdns', 'icam06', 'ion', 'iphone', 'ipad', 'ios', 'ebook']);

function normalizeIeee(raw, knownAcronyms = null, shouted = false) {
  let s0 = raw.replace(/^[“”"']+|[“”"']+$/g, '').trim();
  // Shouted sources only (content_batch index_terms arrive ALL CAPS — the
  // caller opts in): a multi-word or long single-word term with no lowercase
  // is lowercased first, so it title-cases like any other ("NEURAL RADIANCE
  // FIELDS" → "Neural Radiance Fields"); short all-caps tokens (ABR, QUIC)
  // stay, and vocabulary acronyms are restored below. Never applied to IDAMS
  // terms, whose capitals are deliberate ("ITU-R BT.2100", "TLS 1.3").
  if (shouted && /[A-Z]/.test(s0) && !/[a-z]/.test(s0) && (/\s/.test(s0) || s0.replace(/[^A-Z]/g, '').length > 5)) s0 = s0.toLowerCase();
  const s = s0
    .replace(/(?<!\b[A-Z]|\bInc|\betc)[.;,]+$/, '') // "Cache Management." → "Cache Management"
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2')            // "ST 2022–7" → "ST 2022-7"
    .replace(/^SMPTE\s+(?=ST\s*\d)/i, '');                // "SMPTE ST 2059" → "ST 2059" (house style)
  const keep = new Map();
  // Acronyms the vocabulary already uses keep their capitals once a shouted
  // term is lowercased ("NHK ARCHIVES" → "NHK Archives").
  if (knownAcronyms && s !== raw.trim()) {
    for (const w of s.split(/\s+/)) {
      // Bare or wrapped in punctuation: "hdr", "(hdr)", "hdr,".
      const core = w.replace(/^[("'\[]+|[)"'\],.;:]+$/g, '');
      const a = knownAcronyms.get(core.toLowerCase());
      if (a) keep.set(w.toLowerCase(), w.replace(core, a));
    }
  }
  for (let w of s.split(/\s+/)) {
    if (!/[A-Z]/.test(w.slice(1))) continue;
    if (/^[a-z][A-Z0-9][A-Z0-9.\-/]*$/.test(w) && !LOWER_INITIAL_OK.has(w.toLowerCase())) w = w.toUpperCase();
    keep.set(w.toLowerCase(), w);
  }
  return normalizeKeyword(s, keep)
    .replace(/([(—])([a-z])/g, (_, p, c) => `${p}${c.toUpperCase()}`)
    .replace(/^([a-z])(?=[a-z])/, (c) => c.toUpperCase()); // "media-over-IP" → "Media-over-IP"; "iON" stays
}

// ---- clustering ----------------------------------------------------------
// clusterKey: what a term "is" once spelling noise is gone — case, spacing,
// hyphens/dashes/dots/slashes, diacritics, Δ/delta, ×/x, British spelling,
// plurals ("APIs" → API), a leading SMPTE, ST/BT/Rec. standard forms
// ("SMPTE ST 2059–2" ≡ "ST2059-2", "Rec. 2020" ≡ "ITU-R BT.2020"), Ethernet
// rates ("100 gbit/s" ≡ "100Gbps" ≡ "100 Gigabit Ethernet") and a trailing
// "(ACRONYM)" ("Wide Color Gamut (WCG)" ≡ "Wide Colour Gamut").
const BRIT = [[/colour/g, 'color'], [/centre/g, 'center'], [/metre/g, 'meter'], [/isation/g, 'ization'],
  [/ise$/g, 'ize'], [/analyse/g, 'analyze'], [/programme/g, 'program'], [/grey/g, 'gray'],
  [/modelling/g, 'modeling'], [/artefact/g, 'artifact']];
const KEEP_S = /(ss|us|is|ws|ics|ous)$/;
function clusterKey(term) {
  const s = String(term)
    .replace(/\b([A-Z]{2,})s\b/g, '$1')
    .replace(/\s*\([^()]*\)\s*$/, '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/international telecommunications? union[- ]?radiocommunication(?:\s*\(itu-r\))?/g, 'itu-r')
    .replace(/\b(?:recommendation|rec)\.?\s*(?:itu-r\s*)?(?:bt\.?\s*)?(\d{3,4})\b/g, 'itu-r bt $1')
    .replace(/(^|[^-])\bbt\.?\s*(\d{3,4})\b/g, (m, pre, n) => `${pre}${/itu-r\s*$/.test(pre) ? '' : 'itu-r '}bt ${n}`)
    .replace(/δ|∆/g, 'delta ').replace(/×/g, 'x').replace(/[′’']/g, '')
    .replace(/[–—]/g, '-')
    .replace(/(?:itu-r\s*)+/g, 'itu-r ')
    .replace(/\bsmpte\s+(?=\d)/g, 'st ')
    .replace(/\bsmpte\s+(?=(?:st|rp|eg|rdd|ot)\s*\d)/g, '')
    .replace(/\b(st|rp|eg|rdd)\s*(\d)/g, '$1 $2')
    .replace(/(\d+)\s*(?:gigabit(?:\s*ethernet)?(?:\s*interface)?|gbit(?:\/s(?:ec)?)?|gb\/s|gbps|gbe)\b/g, '$1gbe');
  return s.split(/[^a-z0-9]+/).filter(Boolean)
    .map((w) => { let x = w; for (const [re, to] of BRIT) x = x.replace(re, to); return x; })
    .map((w) => (w.length > 4 && /s$/.test(w) && !KEEP_S.test(w) ? w.slice(0, -1) : w))
    .join('');
}
const trailingAcronym = (s) => ((String(s).match(/\(([A-Za-z0-9][A-Za-z0-9.+\-/ ]{1,14})\)\s*$/) || [])[1] || null);
const longForm = (s) => String(s).replace(/\s*\([^()]*\)\s*$/, '').trim();

// vocab = the caller's controlledKeywords ∪ decisions.adds.
// Order per term: split → drop → fold → vocab (exact) → acronym (single token)
// → normalizeIeee → cluster; a fold also applies to the spelling a cluster
// lands on. prime() sees every term up front and builds the
// clusters: one per clusterKey, joined through "Long Form (ACR)" pairs when the
// acronym is unambiguous (one long form across the corpus) — and, when the
// acronym is itself an existing term, only for a 3+-word long form, so
// "Aspect Ratio (AR)" can't join AR (augmented reality). A cluster lands on its
// existing vocabulary term when it has one, else on the spelling most docs use
// (tie → shorter).
function makeKeywordConformer(vocab, decisions, { shouted = false } = {}) {
  const vocabByLower = new Map();
  for (const k of [...vocab, ...(decisions.adds || [])]) vocabByLower.set(String(k).toLowerCase(), k);
  const foldByLower = new Map(Object.entries(decisions.folds || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const splitByLower = new Map(Object.entries(decisions.splits || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const acronymByLower = new Map(Object.entries(decisions.acronyms || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const dropLower = new Set((decisions.drops || []).map((d) => String(typeof d === 'string' ? d : d.term || '').toLowerCase()));
  const totals = { fold: 0, vocab: 0, acronym: 0, variant: 0, normalize: 0, drop: 0 };
  // Acronym-style tokens used anywhere in the vocabulary (NHK, HDR, IMF, …).
  const knownAcronyms = new Map(['NHK', 'BBC', 'EBU', 'NAB', 'IBC', 'ITU', 'ARIB', 'NASA', 'NFL', 'NHRA', 'HBO',
    'IMAX', 'CBC', 'RAI', 'ZDF', 'ARD', 'NRK', 'SVT', 'KBS', 'IRT', 'MPEG', 'JPEG', 'IETF', 'W3C', 'IEEE', 'ISO', 'IEC',
    'ANSI', 'CTA', 'VSF', 'AMWA', 'DPP', 'SRT', 'ITU-R', 'ITU-T'].map((a) => [a.toLowerCase(), a]));
  for (const [k, v] of acronymByLower) knownAcronyms.set(k, v);
  for (const k of vocabByLower.values()) {
    for (const w of String(k).split(/[\s(),]+/)) {
      if (/^[A-Z][A-Z0-9.\-/]{1,10}$/.test(w) && (w.match(/[A-Z]/g) || []).length >= 2) knownAcronyms.set(w.toLowerCase(), w);
    }
  }

  const parent = new Map();
  const find = (k) => { if (!parent.has(k)) parent.set(k, k); while (parent.get(k) !== k) k = parent.get(k); return k; };
  const union = (x, y) => { const a = find(x); const b = find(y); if (a !== b) parent.set(b, a); };
  const vocabKeys = new Map(); // clusterKey → vocab term
  for (const k of vocabByLower.values()) { const ck = clusterKey(k); if (ck && !vocabKeys.has(ck)) vocabKeys.set(ck, k); }
  const surfaceCount = new Map(); // normalized spelling → docs
  const rep = new Map();          // cluster root → chosen spelling
  let primed = false;

  // Explicit decisions first, then the raw term itself.
  function early(raw) {
    const lo = raw.replace(/^[“”"']+|[“”"']+$/g, '').trim().toLowerCase();
    const bare = lo.replace(/[.;,]+$/, '');
    if (dropLower.has(lo) || dropLower.has(bare)) return { drop: true };
    if (foldByLower.has(lo)) return { term: foldByLower.get(lo), how: 'fold' };
    if (foldByLower.has(bare)) return { term: foldByLower.get(bare), how: 'fold' };
    if (vocabByLower.has(lo)) return { term: vocabByLower.get(lo), how: 'vocab' };
    if (!/\s/.test(lo) && acronymByLower.has(lo)) return { term: acronymByLower.get(lo), how: 'acronym' };
    const n = normalizeIeee(raw, knownAcronyms, shouted);
    const nl = n.toLowerCase();
    if (dropLower.has(nl)) return { drop: true };
    if (foldByLower.has(nl)) return { term: foldByLower.get(nl), how: 'fold' };
    if (vocabByLower.has(nl)) return { term: vocabByLower.get(nl), how: 'vocab' };
    return { term: n, how: null };
  }

  function prime(termLists) {
    const terms = [];
    for (const list of termLists) {
      for (const raw of new Set(splitAll(list))) {
        const e = early(raw);
        if (e.drop || e.how) continue;
        terms.push(e.term);
        surfaceCount.set(e.term, (surfaceCount.get(e.term) || 0) + 1);
      }
    }
    // Acronym ↔ long form, from every "Long Form (ACR)" in vocab + corpus.
    const acrLongs = new Map(); // acr key → Set(long key)
    for (const t of [...vocabByLower.values(), ...surfaceCount.keys()]) {
      const acr = trailingAcronym(t);
      if (!acr) continue;
      const ak = clusterKey(acr);
      const lk = clusterKey(longForm(t));
      if (!ak || !lk || ak === lk) continue;
      if (!acrLongs.has(ak)) acrLongs.set(ak, new Map());
      const prev = acrLongs.get(ak).get(lk);
      acrLongs.get(ak).set(lk, { long: longForm(t), n: (prev ? prev.n : 0) + (surfaceCount.get(t) || 1) });
    }
    for (const t of surfaceCount.keys()) find(clusterKey(t));
    // An acronym's long forms are grouped by their first two words; only the
    // dominant group joins the acronym ("High Efficiency Video Coding" /
    // "… Codec" join HEVC, a stray "Video Coding (HEVC)" does not). A tie means
    // two real meanings (IP: Internet Protocol / Intellectual Property) — no join.
    const lead = (long) => long.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 2).join(' ');
    for (const [ak, longs] of acrLongs) {
      const groups = new Map(); // lead → { n, keys, words }
      for (const [lk, { long, n }] of longs) {
        const g = groups.get(lead(long)) || { n: 0, keys: [], words: 0 };
        g.n += n; g.keys.push(lk); g.words = Math.max(g.words, long.split(/[\s-]+/).length);
        groups.set(lead(long), g);
      }
      const ranked = [...groups.values()].sort((x, y) => y.n - x.n);
      if (ranked.length > 1 && ranked[0].n === ranked[1].n) continue;
      const top = ranked[0];
      if (vocabKeys.has(ak) && !top.keys.some((lk) => vocabKeys.has(lk)) && top.words < 3) continue;
      for (const lk of top.keys) union(ak, lk);
    }
    // Representative per cluster.
    const members = new Map();
    for (const t of surfaceCount.keys()) {
      const r = find(clusterKey(t));
      if (!members.has(r)) members.set(r, []);
      members.get(r).push(t);
    }
    const vocabByRoot = new Map();
    for (const [ck, v] of vocabKeys) if (parent.has(ck)) { const r = find(ck); if (!vocabByRoot.has(r)) vocabByRoot.set(r, v); }
    for (const [r, list] of members) {
      const own = list.map((t) => vocabKeys.get(clusterKey(t))).find(Boolean);
      // House style first (ST 2110 not SMPTE ST 2110; 100GbE not 100Gbit/Sec;
      // no lowercase start), then most docs, then shorter.
      const offStyle = (t) => /^SMPTE\s/i.test(t) || /\bST\d/.test(t) || /\d\s*(gbit|gbps|gb\/s)/i.test(t) || /^[a-z]/.test(t) || /[–—]/.test(t);
      const styled = list.filter((t) => !offStyle(t));
      // Ties: keep a version decimal (TLS 1.3, not TLS 13) and a slash (TCP/IP),
      // prefer acronym capitals (CGI, CALM Act) unless the whole phrase is
      // shouted (SCENE REFERRED), then shorter.
      const score = (t) => [
        /\d\.\d/.test(t) ? 1 : 0,
        /[A-Za-z]\/[A-Za-z]/.test(t) ? 1 : 0,
        /\s/.test(t) && t === t.toUpperCase() ? -1 : (t.match(/[A-Z]/g) || []).length,
      ];
      const tie = (a, b) => { const x = score(a); const y = score(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; };
      rep.set(r, own || vocabByRoot.get(r)
        || (styled.length ? styled : list)
          .sort((a, b) => surfaceCount.get(b) - surfaceCount.get(a) || tie(a, b) || a.length - b.length || a.localeCompare(b))[0]);
    }
    primed = true;
  }

  // An IDAMS fold also applies to whatever spelling a cluster landed on, and
  // follows chains (A → B → C) — so a fold written against one spelling covers
  // every variant clustered with it.
  function followFolds(r) {
    let { term, how } = r;
    for (let i = 0; i < 5 && foldByLower.has(term.toLowerCase()); i++) {
      const next = foldByLower.get(term.toLowerCase());
      if (next === term) break;
      term = next; how = 'fold';
    }
    return { term, how };
  }

  function resolve(term) {
    const ck = clusterKey(term);
    if (vocabKeys.has(ck)) return { term: vocabKeys.get(ck), how: 'variant' };
    if (primed && parent.has(ck)) {
      const r = rep.get(find(ck));
      if (r) return followFolds({ term: r, how: vocabByLower.has(r.toLowerCase()) ? 'variant' : 'normalize' });
    }
    return followFolds({ term, how: 'normalize' });
  }

  // Run-together terms ("PQ. HLG") become their parts before anything else.
  const splitAll = (terms) => terms.flatMap((raw) => splitByLower.get(String(raw).trim().toLowerCase()) || [raw]);

  function conformList(terms) {
    const out = [];
    const seen = new Set();
    for (const raw of splitAll(terms)) {
      const e = early(raw);
      if (e.drop) { totals.drop++; continue; }
      const r = e.how ? followFolds(e) : resolve(e.term);
      totals[r.how]++;
      const term = r.term;
      if (!term || seen.has(term.toLowerCase())) continue;
      seen.add(term.toLowerCase());
      out.push(term);
    }
    return out;
  }

  // Spellings folded into each landing term (for reports): term → [[spelling, docs]].
  function merges() {
    const out = new Map();
    for (const [t, n] of surfaceCount) {
      const r = resolve(t).term;
      if (r === t) continue;
      if (!out.has(r)) out.set(r, []);
      out.get(r).push([t, n]);
    }
    return out;
  }
  const inVocab = (t) => vocabByLower.has(String(t).toLowerCase());
  return { conformList, inVocab, prime, merges, totals };
}

// The rules file (src/main/config/keywordDecisions.json), or another one.
function loadKeywordDecisions(file = DECISIONS_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Drop controlledKeywords no doc carries any more (spellings a re-run folded away).
function pruneUnusedVocab(site, docs) {
  const used = new Set();
  for (const d of docs) for (const k of d.keywords || []) used.add(k);
  const before = (site.controlledKeywords || []).length;
  site.controlledKeywords = (site.controlledKeywords || []).filter((k) => used.has(k));
  return before - site.controlledKeywords.length;
}

module.exports = {
  DECISIONS_PATH,
  clusterKey,
  normalizeIeee,
  makeKeywordConformer,
  loadKeywordDecisions,
  pruneUnusedVocab,
};
