/*
 * idamsPublication.js — shared reader for SMPTE's IDAMS `<publication>` XML
 * (_source/SMPTE/{Journal Article,Conference} Repository), used by
 * idamsFieldBackfill.js (fills existing docs) and idamsIngest.js (mints the
 * docs the registry never had).
 *
 * Exports the file walker, the publication/article parser, the keyword
 * conformer (vocab → fold → typo-fix → mixed-case-preserving normalize) and
 * the text-first bio placer.
 */

const fs = require('fs');
const path = require('path');
const { normalizeKeyword } = require('../../utils/keyword.normalize');

const SOURCE_ROOT = '_source/SMPTE';
const REPOS = [
  { repo: 'Journal Article Repository', docType: 'Journal Article' },
  { repo: 'Conference Repository', docType: 'Conference Paper' },
];

// ---- text cleaning -------------------------------------------------------
function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
const unCdata = (s) => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

// CDATA first, then inline markup (<italic xmlns:…>), then entities.
function cleanText(s) {
  if (s == null) return null;
  const out = decodeEntities(unCdata(s)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
  return out || null;
}

// Inline TeX in abstracts is short and simple (`${\$}$25,000`, `$\times 264$`).
const TEX = [[/\\times/g, '×'], [/\{\\\$\}|\\\$/g, '$'], [/\\%/g, '%'], [/\\pm/g, '±'], [/\\approx/g, '≈'],
  [/\\mu/g, 'µ'], [/\\sim/g, '~'], [/\\geq?/g, '≥'], [/\\leq?/g, '≤'], [/\\cdot/g, '·'], [/\\circ/g, '°']];
function texToText(tex) {
  let s = decodeEntities(tex).trim().replace(/^\$+|\$+$/g, '');
  for (const [re, to] of TEX) s = s.replace(re, to);
  return s.replace(/\\(?:mathrm|text|mathit|mathbf)\s*/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋' };
const mapAll = (s, table) => ([...s].every((c) => table[c]) ? [...s].map((c) => table[c]).join('') : null);

// Rich text (titles, abstracts): graphical-abstract <fig> blocks go, TeX and
// digit sup/sub become characters, other markup is unwrapped.
function cleanRich(s) {
  if (s == null) return null;
  const x = unCdata(s)
    .replace(/<fig\b[\s\S]*?<\/fig>/g, ' ')
    .replace(/<graphic\b[^>]*\/>/g, ' ')
    .replace(/<tex-math\b[^>]*>([\s\S]*?)<\/tex-math>/g, (_, t) => texToText(t))
    .replace(/<sup>([^<]*)<\/sup>/g, (m, t) => mapAll(t, SUP) || t)
    .replace(/<(?:sub|inf)>([^<]*)<\/(?:sub|inf)>/g, (m, t) => mapAll(t, SUB) || t);
  return cleanText(x);
}

function nameKey(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const rawTag = (xml, name) => {
  const m = String(xml).match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : null;
};
const tag = (xml, name) => cleanText(rawTag(xml, name));

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

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// "Nov.-Dec." → { month: '11', range: true } · "10" → { month: '10' }
function parseMonth(s) {
  const t = String(s || '').trim().toLowerCase();
  if (!t) return { month: null, range: false };
  if (/^\d{1,2}$/.test(t)) return { month: t.padStart(2, '0'), range: false };
  const hits = MONTHS.filter((m) => t.includes(m));
  if (!hits.length) return { month: null, range: false };
  const first = t.match(new RegExp(MONTHS.join('|'))).index;
  const m = MONTHS.find((x) => t.indexOf(x) === first);
  return { month: String(MONTHS.indexOf(m) + 1).padStart(2, '0'), range: hits.length > 1 || /[-/]/.test(t) };
}

function parseArticle(xml) {
  const info = rawTag(xml, 'articleinfo') || '';
  const keywords = [];
  for (const ks of info.matchAll(/<keywordset\b[^>]*>([\s\S]*?)<\/keywordset>/g)) {
    for (const m of ks[1].matchAll(/<keywordterm>([\s\S]*?)<\/keywordterm>/g)) {
      const t = cleanText(m[1]);
      if (t) keywords.push(t);
    }
  }
  const authors = [];
  for (const m of info.matchAll(/<author\b[^>]*>([\s\S]*?)<\/author>/g)) {
    const a = m[1];
    const first = tag(a, 'firstname');
    const sur = tag(a, 'surname');
    // The unicode pair keeps diacritics the ASCII fields flatten or mangle
    // ("Hammershøj" vs "Hammershoj", "Sanz-Rodr'guez").
    const uFirst = tag(a, 'unicodefirstname');
    const uSur = tag(a, 'unicodesurname');
    authors.push({
      order: Number(tag(a, 'authororder')) || authors.length + 1,
      name: (uFirst && uSur ? `${uFirst} ${uSur}` : null) || tag(a, 'nonnormname') || [first, sur].filter(Boolean).join(' ') || null,
      firstname: first,
      surname: sur,
      affiliation: tag(a, 'affiliation'),
      orcid: tag(a, 'orcid'),
      bio: tag(a, 'authorbio'),
    });
  }
  authors.sort((a, b) => a.order - b.order);
  const orig = (info.match(/<date datetype="OriginalPub">([\s\S]*?)<\/date>/) || [])[1] || '';
  const origMonth = parseMonth(tag(orig, 'month'));
  const pageTag = (info.match(/<artpagenums\b[^>]*>/) || [''])[0];
  const startpage = (pageTag.match(/startpage="([^"]+)"/) || [])[1] || null;
  const endpage = (pageTag.match(/endpage="([^"]+)"/) || [])[1] || null;
  const cr = info.match(/<articlecopyright\b([^>]*)>([\s\S]*?)<\/articlecopyright>|<articlecopyright\b([^>]*)\/>/);
  const crAttrs = cr ? (cr[1] || cr[3] || '') : '';
  return {
    doi: (info.match(/<articledoi>\s*([^<\s]+)\s*<\/articledoi>/) || [])[1] || null,
    title: cleanRich(rawTag(xml, 'title')),
    seq: tag(info, 'articleseqnum'),
    contentType: tag(info, 'contenttype'),
    abstract: cleanRich(rawTag(info, 'abstract')),
    keywords,
    authors,
    year: tag(orig, 'year'),
    month: origMonth.month,
    monthRange: origMonth.range,
    startpage,
    endpage,
    copyrightYear: ((crAttrs.match(/year="(\d{4})"/) || [])[1]) || null,
    copyrightHolder: cr && cr[2] ? cleanText(cr[2]) : null,
  };
}

// One <publication> file → publication-level fields + its articles.
function parsePublicationFile(xml) {
  if (!xml.includes('<publication')) return null;
  const head = xml.split(/<volume>/)[0];
  const pinfo = rawTag(head, 'publicationinfo') || '';
  const vol = rawTag(xml, 'volumeinfo') || '';
  const conf = rawTag(pinfo, 'confgroup') || '';
  const confStart = (conf.match(/<confdate confdatetype="Start">([\s\S]*?)<\/confdate>/) || [])[1] || '';
  const addr = rawTag(rawTag(pinfo, 'publisher') || '', 'address') || '';
  const pubCr = rawTag(rawTag(pinfo, 'copyrightgroup') || '', 'copyright') || '';
  const pub = {
    title: tag(head.replace(/<publicationinfo>[\s\S]*$/, ''), 'title'),
    titleAbbrev: tag(head, 'titleabbrev'),
    acronym: tag(pinfo, 'acronym'),
    issnPrint: (pinfo.match(/<issn mediatype="Paper">([^<]+)</) || [])[1] || null,
    issnElectronic: (pinfo.match(/<issn mediatype="Electronic">([^<]+)</) || [])[1] || null,
    isbnPrint: (pinfo.match(/<isbn\b[^>]*mediatype="Paper"[^>]*>([^<]+)</) || [])[1] || null,
    isbnElectronic: (pinfo.match(/<isbn\b[^>]*mediatype="(?:Electronic|Online)"[^>]*>([^<]+)</) || [])[1] || null,
    city: tag(addr, 'city'),
    country: tag(addr, 'country'),
    copyrightHolder: tag(pubCr, 'holder'),
    confTitle: tag(conf, 'conftitle'),
    confYear: tag(confStart, 'year'),
    confMonth: parseMonth(tag(confStart, 'month')).month,
    confDay: tag(confStart, 'day'),
    volume: tag(vol, 'volumenum'),
    volumeYear: tag(vol, 'year'),
    issue: tag(rawTag(vol, 'issue') || '', 'issuenum'),
  };
  const articles = xml.split(/<article>/).slice(1).map((chunk) => parseArticle(chunk.split('</article>')[0]));
  return { pub, articles };
}

// Every <publication> article, with its file and docType.
function readAllArticles() {
  const out = [];
  let files = 0;
  for (const { repo, docType } of REPOS) {
    for (const file of listXml(path.join(SOURCE_ROOT, repo))) {
      const parsed = parsePublicationFile(fs.readFileSync(file, 'utf8'));
      if (!parsed) continue;
      files++;
      for (const art of parsed.articles) out.push({ ...art, pub: parsed.pub, docType, rel: path.relative(SOURCE_ROOT, file) });
    }
  }
  return { articles: out, files };
}

// ---- keyword conform -----------------------------------------------------
// IEEE terms arrive mixed-case ("Digital TV", "DVB-S2", "192 kHz", "AES3id"),
// unlike the ALL-CAPS index_terms normalizeKeyword() was written for. Tokens
// carrying a capital past their first letter are passed through as-is via its
// extraAcronyms hook; wrapping quotes go, and the word after "(" or an em dash
// is capitalized like any other ("(Computer Graphics)", "Broadcast—Satellite").
function normalizeIeee(raw) {
  const s = raw.replace(/^[“”"']+|[“”"']+$/g, '').trim();
  const keep = new Map();
  for (const w of s.split(/\s+/)) if (/[A-Z]/.test(w.slice(1))) keep.set(w.toLowerCase(), w);
  return normalizeKeyword(s, keep)
    .replace(/([(—])([a-z])/g, (_, p, c) => `${p}${c.toUpperCase()}`)
    .replace(/^([a-z])(?=[a-z])/, (c) => c.toUpperCase()); // "media-over-IP" → "Media-over-IP"; "iON" stays
}

// Source typos (long-tail FIX policy — keywordLongTailApply.js).
const FIX = new Map([
  ['ciritcal listening setup', 'Critical Listening Setup'],
  ['ucompressed transport', 'Uncompressed Transport'],
  ['ip protecton', 'IP Protection'],
  ['atsc 30', 'ATSC 3.0'],
]);

// Variant key for the long-tail "obvious duplicate variants" FOLD: drops a
// trailing "(ACRONYM)", unifies hyphen / slash / space, and singularizes
// words — "High-dynamic Range (HDR)" ≡ "High Dynamic Range", "Codecs" ≡ "Codec".
const variantKey = (s) => String(s).toLowerCase()
  .replace(/\s*\([^)]*\)\s*$/, '')
  .replace(/[-_/]+/g, ' ')
  .replace(/\b([a-z]{3,}[^s])s\b/g, '$1')
  .replace(/\s+/g, ' ').trim();
const trailingAcronym = (s) => ((String(s).match(/\(([A-Za-z0-9.+-]{2,})s?\)\s*$/) || [])[1] || null);

// vocab = site.json controlledKeywords ∪ keywordVocabDecisions adds; folds and
// drops from keywordVocabDecisions. A non-vocab term then folds onto the vocab
// term it is a variant of — same variant key, or its "(ACR)" is a vocab term
// ("Precision Time Protocol (PTP)" → PTP). Remaining new terms cluster by
// variant key and land as ONE controlledKeywords entry: the spelling most docs
// use (prime() counts them up front), else the first seen.
function makeKeywordConformer(site, decisions) {
  const vocabByLower = new Map();
  for (const k of [...(site.controlledKeywords || []), ...(decisions.adds || [])]) vocabByLower.set(String(k).toLowerCase(), k);
  const vocabByVariant = new Map();
  for (const k of vocabByLower.values()) if (!vocabByVariant.has(variantKey(k))) vocabByVariant.set(variantKey(k), k);
  const foldByLower = new Map(Object.entries(decisions.folds || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const dropLower = new Set((decisions.drops || []).map((d) => String(typeof d === 'string' ? d : d.term || '').toLowerCase()));
  const runVocab = new Map(); // variant key → chosen spelling
  const totals = { vocab: 0, fold: 0, fix: 0, variant: 0, normalize: 0, drop: 0 };

  const vocabVariant = (term) => {
    const v = vocabByVariant.get(variantKey(term));
    if (v) return v;
    const acr = trailingAcronym(term);
    return acr ? vocabByLower.get(acr.toLowerCase()) || null : null;
  };

  // Count each new spelling's docs so a cluster lands on its majority form.
  function prime(termLists) {
    const counts = new Map(); // variant key → Map(spelling → docs)
    for (const terms of termLists) {
      for (const raw of new Set(terms)) {
        const lo = raw.replace(/^[“”"']+|[“”"']+$/g, '').trim().toLowerCase();
        if (dropLower.has(lo) || vocabByLower.has(lo) || foldByLower.has(lo) || FIX.has(lo)) continue;
        const term = normalizeIeee(raw);
        if (vocabVariant(term)) continue;
        const key = variantKey(term);
        if (!counts.has(key)) counts.set(key, new Map());
        counts.get(key).set(term, (counts.get(key).get(term) || 0) + 1);
      }
    }
    // Majority spelling; a tie prefers the form carrying "(ACR)", then shorter.
    for (const [key, m] of counts) {
      const best = [...m].sort((a, b) => b[1] - a[1]
        || Number(Boolean(trailingAcronym(b[0]))) - Number(Boolean(trailingAcronym(a[0])))
        || a[0].length - b[0].length)[0][0];
      runVocab.set(key, best);
    }
  }

  function conformList(terms) {
    const out = [];
    const seen = new Set();
    for (const raw of terms) {
      const lo = raw.replace(/^[“”"']+|[“”"']+$/g, '').trim().toLowerCase();
      let term;
      if (dropLower.has(lo)) { totals.drop++; continue; }
      if (vocabByLower.has(lo)) { term = vocabByLower.get(lo); totals.vocab++; }
      else if (foldByLower.has(lo)) { term = foldByLower.get(lo); totals.fold++; }
      else if (FIX.has(lo)) { term = FIX.get(lo); totals.fix++; }
      else {
        term = normalizeIeee(raw);
        const v = vocabVariant(term);
        if (v) { term = v; totals.variant++; }
        else {
          const key = variantKey(term);
          if (runVocab.has(key)) term = runVocab.get(key); else runVocab.set(key, term);
          totals.normalize++;
        }
      }
      if (!term || seen.has(term.toLowerCase())) continue;
      seen.add(term.toLowerCase());
      out.push(term);
    }
    return out;
  }
  const inVocab = (t) => vocabByLower.has(String(t).toLowerCase());
  return { conformList, inVocab, prime, totals };
}

// ---- bio placement -------------------------------------------------------
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

module.exports = {
  SOURCE_ROOT,
  REPOS,
  cleanText,
  cleanRich,
  nameKey,
  listXml,
  parseMonth,
  parsePublicationFile,
  readAllArticles,
  makeKeywordConformer,
  matchBios,
};
