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
 * reconcileIncoming — keep an existing registry value when a re-extract only
 * re-renders it, so upstream formatting churn doesn't become PR noise.
 *
 * Runs on the incoming doc before extractDocs diffs it against the registry.
 * Where incoming is equivalent to what we hold, the existing value is put back on
 * the incoming doc; anything genuinely new still flows through as an update.
 *
 *   resolvedHref/href  differ only by a trailing slash (rfc-editor.org now 302s
 *                      /info/rfcN → /info/rfcN/)
 *   abstract           differs only in whitespace
 *   authors            same people, initials form ("R. Braden" for "Robert T. Braden",
 *                      Datatracker doc.json), any order
 *   keywords           never drop a held controlled term; add only terms that aren't
 *                      a case / plural / hyphen / typo variant of one ("Eneryption"
 *                      vs "Encryption", "WOTS" vs "W-OTS"). Held terms the keyword
 *                      rules would change are conformed first (see conformHeld), so
 *                      a re-run cleans up what an earlier run got wrong.
 *   status.<list>      same set in another order
 */

const STATUS_LISTS = ['amendedBy', 'amends', 'supersededBy', 'supersedes', 'errataUrl'];
// "Ed." (editor) needs its period: a bare "Ed" is a given name (Ed Levinson).
const NAME_SUFFIX = /^(?:(?:jr|sr|ii|iii|iv|2nd|3rd|4th)\.?|ed\.|editor)$/i;

function foldName(s) {
  const lower = String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  return lower.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\s-]/g, ' ').trim();
}

// Both spellings of a surname: "Björklund" → bjoerklund / bjorklund, so an ASCII
// "Bjorklund" or "Schoenwaelder" matches the accented original either way.
function surnameKeys(raw) {
  const tokens = String(raw || '').replace(/^(?:dr|prof)\.?\s+/i, '').trim().split(/\s+/)
    .filter((t, i) => t && !(i > 0 && NAME_SUFFIX.test(t)));
  const last = tokens[tokens.length - 1] || '';
  const plain = String(last).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z-]/g, '');
  return { tokens, keys: new Set([foldName(last).replace(/\s+/g, ''), plain].filter(Boolean)) };
}

function nameOf(a) {
  return typeof a === 'string' ? a : (a && a.name) || '';
}

// Incoming is the same person written shorter: same surname and a matching first
// initial, or a single-token name that is one of the held name's tokens ("Mitra").
function sameAuthor(held, incoming) {
  const h = surnameKeys(nameOf(held));
  const i = surnameKeys(nameOf(incoming));
  if (i.tokens.length === 1) {
    const one = foldName(i.tokens[0]);
    return h.tokens.some((t) => foldName(t) === one);
  }
  if (![...i.keys].some((k) => h.keys.has(k))) return false;
  const hi = foldName(h.tokens[0]).charAt(0);
  const ii = foldName(i.tokens[0]).charAt(0);
  return !hi || !ii || hi === ii;
}

function authorsEquivalent(held, incoming) {
  if (!Array.isArray(held) || !Array.isArray(incoming) || !held.length) return false;
  if (held.length !== incoming.length) return false;
  const pool = [...held];
  for (const a of incoming) {
    const idx = pool.findIndex((h) => sameAuthor(h, a));
    if (idx < 0) return false;
    pool.splice(idx, 1);
  }
  return true;
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

function keywordVariant(a, b) {
  // Hyphens/spaces don't make a new term: "WOTS+" is "W-OTS+".
  const x = String(a).toLowerCase().replace(/[\s_-]+/g, '').replace(/s$/, '');
  const y = String(b).toLowerCase().replace(/[\s_-]+/g, '').replace(/s$/, '');
  if (x === y) return true;
  return Math.min(x.length, y.length) >= 6 && editDistance(x, y) <= 1;
}

// Held keywords outside the controlled vocabulary go through the shared rules:
// dropped terms go, and a term whose fold or case-insensitive match is controlled
// becomes that term ("Aaa" → "AAA", "Transport Layer Security" → "TLS").
// Controlled terms are never touched.
function conformHeld(held, rules) {
  if (!rules || !Array.isArray(held)) return held;
  const { vocab = new Map(), folds = new Map(), drops = new Set() } = rules;
  const out = [];
  for (const raw of held) {
    if (vocab.get(String(raw).toLowerCase()) === raw) { out.push(raw); continue; }
    // Same cleanup the IETF parser now does: a list tail stored as "and URN".
    const kw = String(raw).replace(/^(?:and|or)\s+/i, '');
    const lower = kw.toLowerCase();
    if (drops.has(lower)) continue;
    const folded = folds.get(lower) || kw;
    out.push(vocab.get(String(folded).toLowerCase()) || kw);
  }
  const deduped = [...new Set(out)];
  return JSON.stringify(deduped) === JSON.stringify(held) ? held : deduped;
}

function mergeKeywords(held, incoming, rules = null) {
  held = conformHeld(held, rules);
  if (!Array.isArray(held) || !held.length) return incoming;
  if (!Array.isArray(incoming)) return held;
  const out = [...held];
  for (const kw of incoming) {
    if (!out.some((h) => keywordVariant(h, kw))) out.push(kw);
  }
  return out.length === held.length ? held : out;
}

const trimSlash = (u) => String(u).replace(/\/+$/, '');
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();

function sameSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const s = new Set(a.map(String));
  return b.every((v) => s.has(String(v)));
}

/**
 * Mutates `incoming` in place, putting back held values where incoming only
 * re-renders them. Returns the list of field paths it kept.
 */
function reconcileIncoming(held, incoming, { keywordRules = null } = {}) {
  const kept = [];
  if (!held || !incoming) return kept;

  for (const key of ['href', 'resolvedHref']) {
    const h = held[key];
    const i = incoming[key];
    if (typeof h === 'string' && typeof i === 'string' && h !== i && trimSlash(h) === trimSlash(i)) {
      incoming[key] = h;
      kept.push(key);
    }
  }

  if (typeof held.abstract === 'string' && typeof incoming.abstract === 'string' &&
      held.abstract !== incoming.abstract && squash(held.abstract) === squash(incoming.abstract)) {
    incoming.abstract = held.abstract;
    kept.push('abstract');
  }

  if (incoming.authors !== undefined && authorsEquivalent(held.authors, incoming.authors) &&
      JSON.stringify(held.authors) !== JSON.stringify(incoming.authors)) {
    incoming.authors = held.authors;
    kept.push('authors');
  }

  // The source gave no keywords (or all were dropped): still conform what's held, and
  // flag an all-dropped list for removal (RFC6066's TLS extension names).
  if (incoming.keywords === undefined && Array.isArray(held.keywords) && held.keywords.length && keywordRules) {
    const conformed = conformHeld(held.keywords, keywordRules);
    if (conformed !== held.keywords) {
      if (conformed.length) incoming.keywords = conformed;
      else Object.defineProperty(incoming, '__clearKeywords', { value: true, enumerable: false, configurable: true });
    }
  }

  if (incoming.keywords !== undefined) {
    const merged = mergeKeywords(held.keywords, incoming.keywords, keywordRules);
    if (merged !== incoming.keywords) {
      incoming.keywords = merged;
      // Only "kept" when the result is the held list; a conformed list is an update.
      if (JSON.stringify(merged) === JSON.stringify(held.keywords)) kept.push('keywords');
    }
  }

  if (held.status && incoming.status) {
    for (const f of STATUS_LISTS) {
      const h = held.status[f];
      const i = incoming.status[f];
      if (JSON.stringify(h) !== JSON.stringify(i) && sameSet(h, i)) {
        incoming.status[f] = h;
        kept.push(`status.${f}`);
      }
    }
  }

  return kept;
}

module.exports = { reconcileIncoming, authorsEquivalent, mergeKeywords, conformHeld };
