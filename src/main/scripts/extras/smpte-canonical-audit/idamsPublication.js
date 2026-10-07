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
// Mixed-case names that really do start lowercase (everything else of the
// form "sT", "iS-10", "iTU-R", "vR" is a source glitch → uppercased).
const LOWER_INITIAL_OK = new Set(['mdns', 'icam06', 'ion', 'iphone', 'ipad', 'ios', 'ebook']);

function normalizeIeee(raw) {
  const s = raw.replace(/^[“”"']+|[“”"']+$/g, '').trim()
    .replace(/(?<!\b[A-Z]|\bInc|\betc)[.;,]+$/, '') // "Cache Management." → "Cache Management"
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2')            // "ST 2022–7" → "ST 2022-7"
    .replace(/^SMPTE\s+(?=ST\s*\d)/i, '');                // "SMPTE ST 2059" → "ST 2059" (house style)
  const keep = new Map();
  for (let w of s.split(/\s+/)) {
    if (!/[A-Z]/.test(w.slice(1))) continue;
    if (/^[a-z][A-Z0-9][A-Z0-9.\-/]*$/.test(w) && !LOWER_INITIAL_OK.has(w.toLowerCase())) w = w.toUpperCase();
    keep.set(w.toLowerCase(), w);
  }
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

// vocab = the pre-IDAMS controlledKeywords ∪ keywordVocabDecisions adds.
// Order per term: IDAMS fold → drop → vocab (exact) → earlier folds → typo fix
// → normalizeIeee → cluster. prime() sees every term up front and builds the
// clusters: one per clusterKey, joined through "Long Form (ACR)" pairs when the
// acronym is unambiguous (one long form across the corpus) — and, when the
// acronym is itself an existing term, only for a 3+-word long form, so
// "Aspect Ratio (AR)" can't join AR (augmented reality). A cluster lands on its
// existing vocabulary term when it has one, else on the spelling most docs use
// (tie → shorter).
function makeKeywordConformer(vocab, decisions) {
  const vocabByLower = new Map();
  for (const k of [...vocab, ...(decisions.adds || [])]) vocabByLower.set(String(k).toLowerCase(), k);
  const idamsFoldByLower = new Map(Object.entries(decisions.idamsFolds || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const foldByLower = new Map(Object.entries(decisions.folds || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const dropLower = new Set([...(decisions.drops || []), ...(decisions.idamsDrops || [])]
    .map((d) => String(typeof d === 'string' ? d : d.term || '').toLowerCase()));
  const totals = { idamsFold: 0, vocab: 0, fold: 0, fix: 0, variant: 0, normalize: 0, drop: 0 };

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
    if (idamsFoldByLower.has(lo)) return { term: idamsFoldByLower.get(lo), how: 'idamsFold' };
    if (idamsFoldByLower.has(bare)) return { term: idamsFoldByLower.get(bare), how: 'idamsFold' };
    if (vocabByLower.has(lo)) return { term: vocabByLower.get(lo), how: 'vocab' };
    if (foldByLower.has(lo)) return { term: foldByLower.get(lo), how: 'fold' };
    if (FIX.has(lo)) return { term: FIX.get(lo), how: 'fix' };
    const n = normalizeIeee(raw);
    const nl = n.toLowerCase();
    if (dropLower.has(nl)) return { drop: true };
    if (idamsFoldByLower.has(nl)) return { term: idamsFoldByLower.get(nl), how: 'idamsFold' };
    if (vocabByLower.has(nl)) return { term: vocabByLower.get(nl), how: 'vocab' };
    return { term: n, how: null };
  }

  function prime(termLists) {
    const terms = [];
    for (const list of termLists) {
      for (const raw of new Set(list)) {
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

  function resolve(term) {
    const ck = clusterKey(term);
    if (vocabKeys.has(ck)) return { term: vocabKeys.get(ck), how: 'variant' };
    if (primed && parent.has(ck)) {
      const r = rep.get(find(ck));
      if (r) return { term: r, how: vocabByLower.has(r.toLowerCase()) ? 'variant' : 'normalize' };
    }
    return { term, how: 'normalize' };
  }

  function conformList(terms) {
    const out = [];
    const seen = new Set();
    for (const raw of terms) {
      const e = early(raw);
      if (e.drop) { totals.drop++; continue; }
      const r = e.how ? e : resolve(e.term);
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

// ---- decisions + vocabulary ----------------------------------------------
// keywordVocabDecisions.json (earlier passes) plus keywordIdamsDecisions.json
// (this arc, from keywordIdamsAudit.md). IDAMS folds are checked before the
// vocabulary so they also override a spelling an earlier run added.
function loadDecisions(reportsDir) {
  const base = JSON.parse(fs.readFileSync(path.join(reportsDir, 'keywordVocabDecisions.json'), 'utf8'));
  let idams = {};
  try { idams = JSON.parse(fs.readFileSync(path.join(reportsDir, 'keywordIdamsDecisions.json'), 'utf8')); } catch { /* none yet */ }
  return { ...base, idamsFolds: idams.folds || {}, idamsDrops: idams.drops || [] };
}

// Keywords the IDAMS passes wrote: every doc idamsIngest.js minted, and the
// keywords idamsFieldBackfill.js filled.
const IDAMS_SCRIPTS = /idamsIngest\.js|idamsFieldBackfill\.js/;
const idamsWroteKeywords = (d) => IDAMS_SCRIPTS.test(String((d['docId$meta'] || {}).note || ''))
  || IDAMS_SCRIPTS.test(String((d['keywords$meta'] || {}).note || ''));

// The vocabulary as it stands without the IDAMS passes: every controlledKeywords
// term some non-IDAMS doc carries. (Before these passes every vocabulary term
// was in use, so this is exactly the pre-IDAMS set — re-runs conform against it
// instead of against spellings an earlier run added.)
function preIdamsVocab(site, docs) {
  const used = new Set();
  for (const d of docs) if (!idamsWroteKeywords(d)) for (const k of d.keywords || []) used.add(k);
  return (site.controlledKeywords || []).filter((k) => used.has(k));
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
  clusterKey,
  loadDecisions,
  idamsWroteKeywords,
  preIdamsVocab,
  pruneUnusedVocab,
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
