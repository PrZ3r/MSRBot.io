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

// ---- keyword conform + bio placement: shared libs ----------------------
const { clusterKey, makeKeywordConformer, loadKeywordDecisions, pruneUnusedVocab } = require('../../../lib/keywordConform');
const { matchBios } = require('../../../lib/authorBios');

// ---- decisions + vocabulary ----------------------------------------------
// keywordVocabDecisions.json (earlier passes) plus keywordIdamsDecisions.json
// (this arc, from keywordIdamsAudit.md). IDAMS folds are checked before the
// vocabulary so they also override a spelling an earlier run added.
// The unified keyword rules (src/main/config/keywordDecisions.json); the
// argument is ignored (kept for the callers in this folder).
function loadDecisions() { return loadKeywordDecisions(); }

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
