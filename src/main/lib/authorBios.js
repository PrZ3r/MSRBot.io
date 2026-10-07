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
 * authorBios.js — put author bios on the right author.
 *
 * Publisher metadata often files one author's bio under a co-author (two-way
 * swaps, three-way rotations, verbatim copies). matchBios places each bio by
 * the name its TEXT contains, falling back to the source pairing only when the
 * bio names nobody. Shared by the SMPTE journal extractor and the IDAMS backfill.
 */

function nameKey(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// The source's own bio↔author pairing is unreliable: multi-author articles
// often carry author B's bio on author A (two-way swaps, three-way rotations).
// So the bio TEXT decides first — a bio goes to the registry author whose
// surname it names earliest (given name breaks a shared surname). Only a bio
// naming no registry author (affiliation-only text, OCR-misspelt names) falls
// back to the source author-name pairing. Two different bios claiming one
// author → both reported, neither written; an identical copy collapses to one.
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
    // Each author scores the earliest position the bio names them at:
    //   · full name — given name, up to two middle tokens, surname
    //   · bare surname — unless it is really a first name, i.e. directly
    //     followed by another author's surname ("Thomas Kernen…" must not
    //     land on co-author Yvonne Thomas); a shared surname needs the given
    //     name (Yasuaki / Yukihiro Nishida).
    let best = Infinity;
    regSur.forEach((sur, i) => {
      if (!sur) return;
      const given = regKeys[i].split(' ')[0];
      let at = Infinity;
      if (given.length > 1 && given !== sur) {
        const m = text.match(new RegExp(` ${given}(?: [a-z]+){0,2} ${sur} `));
        if (m) at = m.index;
      }
      const shared = regSur.filter((x) => x === sur).length > 1;
      if (!shared) {
        let from = 0;
        let k;
        while ((k = text.indexOf(` ${sur} `, from)) >= 0) {
          const next = text.slice(k + sur.length + 2).split(' ')[0];
          if (!regSur.some((o, j) => j !== i && o === next)) { at = Math.min(at, k); break; }
          from = k + 1;
        }
      }
      if (at < best) { best = at; pick = i; }
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
  for (const [i, all] of claims) {
    // The same bio text filed under two authors (a source copy error) is one bio.
    const list = all.filter((c, j) => all.findIndex((x) => x.bio === c.bio) === j);
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

module.exports = { nameKey, matchBios };
