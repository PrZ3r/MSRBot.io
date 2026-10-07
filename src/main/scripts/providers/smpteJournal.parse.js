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
 * smpteJournal.parse.js — one SMPTE journal/conference paper from the local
 * library: its content_batch primary (IEEE content_delivery 1.6) for metadata,
 * its FTXML sibling (JATS) for references.
 *
 * Everything specific to this delivery lives here, consolidated from the
 * one-time backfill scripts (ingestNlmCanonicalDocs.js, extractFtxmlRefs.js):
 *   - docId: the DOI dashed (never lowercased); DOI-less papers key on
 *     ISBN + article_sequence (conference) or ISSN + v<vol>.<issue> +
 *     article_sequence (journal). A DOI SMPTE gave two papers is
 *     disambiguated with the issue folder + sequence.
 *   - contentType: <pubitype type> verbatim (already the registry enum).
 *   - keywords: <index_terms> (ALL CAPS) through the shared conformer.
 *   - references: FTXML <ref-list>, resolved direct DOI → SMPTE vol+pages
 *     self-cite → refMap → the designator around the title → content hash →
 *     orphan slug; citation text as printed, link from <uri>/DOI.
 *   - nested objects (issn, isbn, copyright, publisherLocation): when the
 *     values match the registry copy, that copy is returned as-is ($meta
 *     included), so an unchanged paper is never reported as updated.
 *
 * An extraction only ADDS or CHANGES what it extracts — it never deletes.
 * Keywords someone added by hand, an author's bio / affiliation / ORCID,
 * extra keys in a nested object: all kept. Keywords and authors are unioned
 * (existing first, new source values appended); scalar fields change only
 * when the source changed. Fields other processes own (resolvedHref, …) are
 * not this extractor's concern. Locks hold: a field whose $meta has
 * excludeChanges / excludeOverwrite is never changed (extractDocs enforces it
 * for top-level fields and references; nested() enforces it per nested key).
 *
 * References are the exception: a paper's reference list is the source's,
 * taken as a unit, so the extracted bibliographic list REPLACES the stored
 * one. When the paper has no FTXML or no <ref-list>, the stored references
 * are left as they are; normative references are never touched.
 *
 * --pdf-refs (IEEE-era <publication> records, 2015–2023, which have no FTXML
 * and no reference file): REFERENCES ONLY, from the reference section of the
 * paper's PDF. Only papers with no bibliography (or one this pass wrote) are
 * filled; no other field is emitted. Each list's $meta note records Crossref's
 * reference count for the DOI next to the parsed count — a cross-check of what
 * the delivery lost, never a source — and a mismatch sets reviewRequired.
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs } = require('../../lib/registry');
const { loadMri } = require('../../lib/mriStore');
const {
  mapRefByCite, parseCiteDesignator, tidyCiteText, citeHref, mriRecordSighting, _contentHash,
} = require('../../lib/referencing');
const { makeKeywordConformer, loadKeywordDecisions } = require('../../lib/keywordConform');

const SITE_PATH = path.join(__dirname, '..', '..', 'config', 'site.json');

// ---- XML helpers ----------------------------------------------------------
function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return ''; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return ''; } })
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
const norm = (s) => decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
function tag(x, t) { const m = String(x).match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? m[1] : ''; }
const tagText = (x, t) => norm(tag(x, t));
function attr(x, t, a) { const m = String(x).match(new RegExp(`<${t}\\b[^>]*\\b${a}="([^"]*)"`, 'i')); return m ? m[1] : ''; }
const field = (block, t) => { const m = String(block).match(new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? norm(m[1]) : ''; };

const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
function firstMonthNum(monthText) {
  const m = String(monthText || '').toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  return m ? MONTHS[m[1]] : null;
}
function issueFolderToken(file) {
  const m = file.match(/\/(\d{4})\/([^/]+)\//);
  return m ? `${m[1]}-${m[2]}` : 'unknown';
}

// ---- content_batch reader -------------------------------------------------
function readContentBatch(file) {
  const xml = fs.readFileSync(file, 'utf8');
  if (!/<content_batch\b/.test(xml)) return null;
  const isConf = /<conference_article\b/.test(xml);
  const art = tag(xml, isConf ? 'conference_article' : 'journal_article');
  if (!art) return null;

  const pagesBlock = tag(art, 'pages');
  const fpage = tagText(pagesBlock, 'first_page') || tagText(art, 'first_page');
  const lpage = tagText(pagesBlock, 'last_page') || tagText(art, 'last_page');
  const authors = [];
  for (const m of art.matchAll(/<person_name\b[^>]*>[\s\S]*?<\/person_name>/gi)) {
    const b = m[0];
    if (/author_type="editor"/i.test(b)) continue;
    const full = [tagText(b, 'given_name'), tagText(b, 'surname')].filter(Boolean).join(' ').trim();
    if (full) authors.push({ name: full });
  }
  const copyBlock = tag(xml, 'copyright');
  const rec = {
    file,
    isConf,
    doi: tagText(art, 'doi') || null,
    seq: tagText(art, 'article_sequence') || null,
    contentType: attr(art, 'pubitype', 'type') || null,
    title: norm(tag(art, 'title')),
    abstract: tagText(art, 'abstract') || null,
    pages: fpage && lpage ? `${fpage}–${lpage}` : (fpage || null),
    fpage: fpage || null,
    lpage: lpage || null,
    authors,
    rawKeywords: [...tag(art, 'index_terms').matchAll(/<term>([\s\S]*?)<\/term>/gi)].map((m) => norm(m[1])).filter(Boolean),
    copyrightHolder: tagText(copyBlock, 'copyright_holder') || null,
    copyrightYear: tagText(copyBlock, 'year') || null,
  };
  if (isConf) {
    const meta = tag(xml, 'conference_metadata');
    rec.containerTitle = tagText(meta, 'conference_name') || tagText(meta, 'full_title') || null;
    rec.acronym = tagText(meta, 'conference_acronym') || null;
    rec.isbn = tagText(meta, 'isbn') || null;
    rec.meetingLocation = tagText(meta, 'meeting_location') || null;
    const cd = xml.match(/<conference_date\b[^>]*>/i);
    rec.year = cd ? (cd[0].match(/start_year="(\d{4})"/) || [])[1] || null : null;
    rec.month = cd ? firstMonthNum((cd[0].match(/start_month="([^"]*)"/) || [])[1]) : null;
    rec.day = cd ? ((cd[0].match(/start_day="(\d{1,2})"/) || [])[1] || null) : null;
    rec.volume = tagText(tag(xml, 'conference_issue'), 'volume') || null;
    rec.issue = null;
  } else {
    const meta = tag(xml, 'journal_metadata');
    rec.containerTitle = tagText(meta, 'full_title') || null;
    rec.abbrevTitle = tagText(meta, 'abbrev_title') || null;
    rec.acronym = tagText(meta, 'journal_acronym') || null;
    rec.issnPrint = (meta.match(/<issn[^>]*type="paper"[^>]*>([^<]+)<\/issn>/i) || [])[1] || null;
    rec.issnElectronic = (meta.match(/<issn[^>]*type="electronic"[^>]*>([^<]+)<\/issn>/i) || [])[1] || null;
    const ji = tag(xml, 'journal_issue');
    const pd = tag(ji, 'publication_date');
    rec.year = tagText(pd, 'year') || null;
    rec.month = firstMonthNum(tagText(pd, 'month'));
    const jv = tag(ji, 'journal_volume');
    rec.volume = tagText(jv, 'volume') || null;
    rec.issue = tagText(jv, 'issue') || null;
  }
  return rec;
}

function docIdFor(rec, dupDois) {
  if (rec.doi) {
    const base = rec.doi.replace(/\//g, '-');
    return dupDois.has(rec.doi) ? `${base}__${issueFolderToken(rec.file)}-${rec.seq || '0'}` : base;
  }
  const seq = rec.seq || '0';
  if (rec.isConf) return `${rec.isbn || 'noisbn'}-${seq}`;
  return `${rec.issnElectronic || rec.issnPrint || 'noissn'}-v${rec.volume || '0'}.${rec.issue || '0'}-${seq}`;
}

function publicationDate(rec) {
  if (!rec.year) return null;
  return `${rec.year}-${rec.month || '01'}-${rec.day ? String(rec.day).padStart(2, '0') : '01'}`;
}

function docLabel(rec, docType) {
  const bits = [[rec.acronym, rec.year].filter(Boolean).join(' ')].filter(Boolean);
  if (docType === 'Conference Paper') {
    if (rec.seq) bits.push(`Article ${rec.seq}`);
  } else {
    if (rec.volume) bits.push(`Volume ${rec.volume}`);
    if (rec.issue) bits.push(`Number ${rec.issue}`);
  }
  let label = bits.join(', ');
  if (rec.fpage && rec.lpage) label += ` (pp. ${rec.fpage} to ${rec.lpage})`;
  else if (rec.fpage) label += ` (p. ${rec.fpage})`;
  return label || rec.title || 'Untitled';
}

// ---- PDF reference lists (IEEE-era papers, no full text) -------------------
// The papers from 2015–2023 were delivered without FTXML or reference files;
// their references exist only in the published PDF. The PDF's text order is
// not reading order — two-column reference pages come out right column first
// (entries 5–17, then 1–4 under the heading) — so entries are collected as
// numbered blocks from the heading's page to the end and rebuilt 1, 2, 3 …
// Case-insensitive: small-caps headings extract as "RefeRences".
const REF_HEAD = /(?:^|\n)\s*(?:references|bibliography|works cited|literature cited)\s*:?\s*(?:\n|$)/i;
// A heading line has capitals ("References", small caps "RefeRences" or
// "rEFErEncES"); an all-lowercase "references" is a label inside a figure.
const HEAD_WORD = /^(?:references|bibliography|works cited|literature cited)\s*:?$/i;
const isHeadLine = (line) => HEAD_WORD.test(line) && /[A-Z]/.test(line);
function headAt(page) {
  let pos = 0;
  for (const raw of String(page).split('\n')) {
    if (isHeadLine(raw.trim())) return pos;
    pos += raw.length + 1;
  }
  return -1;
}
// A line that ends the reference list (the bios / acknowledgments that follow).
const REF_STOP = /^(?:About the Authors?|ABOUT THE AUTHORS?|The Authors?$|Author Biograph(?:y|ies)|Biograph(?:y|ies)$|Acknowledg(?:e)?ments?|ACKNOWLEDG(?:E)?MENTS?|Appendix\b|APPENDIX\b|Presented at the|A contribution received)/;
// A line that interrupts an entry: running page headers / footers, captions.
const isPageNoise = (line) => /^\d{1,4}$/.test(line)
  || /SMPTE Motion Imaging Journal\s*(?:\/\/\s*\d+)?$/i.test(line)
  || /^\d+\s*(?:\/\/|\|)?\s*SMPTE Motion Imaging Journal/i.test(line)
  || /SMPTE Motion Imaging Journal\s*\|\s*[A-Z][a-z]+(?:\/[A-Z][a-z]+)?\.? \d{4}\s*\d*$/.test(line)
  || /^(?:FIGURE|Figure|TABLE|Table)\s+\d+[.:]/.test(line)
  || /^©\s*\d{4}\s+Society of Motion Picture/.test(line)
  // Lines of the conference disclaimer footer
  || /technical presentation|SMPTE Board of Editors|constitute an endorsement|SMPTE meeting paper|jwelch@smpte\.org|Title of Presentation, Meeting name/.test(line)
  || (/^[^a-z]{12,}$/.test(line) && !/^\[?\d{1,3}[.\])]/.test(line) && /[A-Z]{3,}/.test(line) && !/https?:|www\./.test(line));

// Join a wrapped line onto an entry: keep URLs whole, drop end-of-line
// hyphenation in words ("Broad-" + "casting"), else join with a space.
function joinWrapped(a, b) {
  const lastTok = (a.match(/\S+$/) || [''])[0];
  const urlish = /(?:https?:\/\/|www\.)\S*$/.test(lastTok);
  if (urlish && /^[\w\-\/.?=&%#~+:@]+/.test(b) && !/[,;)]$/.test(lastTok)) return a + b;
  if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b) && !urlish) return a.slice(0, -1) + b;
  if (/-$/.test(a)) return a + b;
  return `${a} ${b}`;
}

const ROMAN = { i: 1, v: 5, x: 10, l: 50, c: 100 };
function romanToInt(r) {
  let n = 0;
  const s = r.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]];
    const next = ROMAN[s[i + 1]] || 0;
    n += v < next ? -v : v;
  }
  return n;
}
// "12. …", "[12] …", "12) …" — or roman "xii. …" (a few 2015 conference papers).
function entryStart(line) {
  const m = line.match(/^\[?(\d{1,3})[.\])]\s+(\S.*)$/) || line.match(/^\[\s*(\d{1,3})\s*\]\s*(\S.*)$/);   // "12. …", "[12] …", "[ 12 ] …"
  if (m) return { n: Number(m[1]), text: m[2] };
  const r = line.match(/^([ivxlc]{1,7})[.)]\s+(\S.*)$/i);
  if (r && /^(?:[ivxlc]+)$/i.test(r[1])) return { n: romanToInt(r[1]), text: r[2] };
  return null;
}

// Unnumbered bibliography (no entry numbers): a new entry starts where the
// previous line closed a citation (period, or a URL) and the next line opens
// one (capitalized author / organization, or a quote).
function unnumberedEntries(lines) {
  const out = [];
  let prevClosed = true;
  for (const raw of lines) {
    // A numbered line ("1. A. Akhtar, …" in a bibliography) always opens an entry.
    const num = raw.match(/^\[?\d{1,3}[.\])]\s+(\S.*)$/);
    const line = num ? num[1] : raw;
    if (num) { out.push(line); prevClosed = /[.)]$/.test(line); continue; }
    const opens = /^(?:[A-Z][A-Za-z'’.-]+(?:,|\s)|[A-Z]{2,}|“|")/.test(line)
      && !/^(?:Retrieved|Available|Accessed|Web\.|\[Online\])/.test(line)
      && !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d/.test(line); // a wrapped date
    if (!out.length || (prevClosed && opens && out[out.length - 1].length > 25)) out.push(line);
    else out[out.length - 1] = joinWrapped(out[out.length - 1], line);
    // "Ranjan, A., … (2019)." — APA: the title follows on the next line.
    // "… Cinnamon S." — an author list wrapping at an initial isn't a close.
    // A line ending in a year closes too ("…, TV Technology / August 2015"); a
    // journal abbreviation doesn't ("SMPTE Mot. / Imag. J.").
    prevClosed = (/[.)]$|(?:https?:\/\/|www\.)\S+$/.test(line) || /\b(?:19|20)\d{2}$/.test(line))
      && !/\(\d{4}[a-z]?\)\.$/.test(line) && !/\s[A-Z]\.$/.test(line)
      && !/\b(?:Mot|Imag|Proc|Trans|Int|Conf|Soc|Vol|No|pp|Eng|Tech|Comput|Commun|Electron|Res|Sci|Am|Assoc)\.$/.test(line);
  }
  return out;
}

// Looser entry starts, tried only when the strict pass finds < 2 entries:
// "[ 1] …", "[2]SMPTE …", footnote-style "1 Michael …" / "1E. Giorgianni",
// bare roman "i Futuresource …" (numbered), and keyed "[Wang09] …" or
// bulleted "• …" entries (numbered in order of appearance).
function looseStart(line, seq) {
  let m = line.match(/^\[\s*(\d{1,3})\s*\]\s*(\S.*)$/);
  if (m) return { n: Number(m[1]), text: m[2] };
  m = line.match(/^(\d{1,3})(?![\d.,:)\]/-])\s*([A-Z“"].*)$/);
  // …but not a wrapped access date: "(date accessed\n18 September 2018)".
  if (m && !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4}\b/.test(m[2])) return { n: Number(m[1]), text: m[2] };
  m = line.match(/^([ivx]{1,5})\s+([A-Z].*)$/);
  if (m) return { n: romanToInt(m[1]), text: m[2] };
  m = line.match(/^\[([A-Za-z][\w+.&-]{1,24})\]\s*(\S.*)$/) || line.match(/^[•▪●◦]\s*(\S.*)$/);
  if (m) return { n: seq + 1, text: m[2] || m[1], seq: true };
  return null;
}

// Some PDFs open with the tail of the previous article in the issue, its
// references included. A paper can't reach its own references within its first
// lines, so when a reference heading is among the first 10 lines of the PDF and
// the paper's title follows on its first two pages, everything before the title
// is dropped. (A heading further down — an editorial whose title box extracts
// after its text — is left alone.)
function startAtTitle(list, title) {
  const words = String(title || '').split(/[^A-Za-z0-9]+/).filter(Boolean).slice(0, 6);
  if (words.length < 3) return list;
  const re = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^A-Za-z0-9]+'), 'i');
  for (let k = 0; k < Math.min(2, list.length); k++) {
    const m = re.exec(list[k]);
    if (!m) continue;
    const before = list.slice(0, k).join('\n') + '\n' + list[k].slice(0, m.index);
    const early = String(list[0]).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10).some(isHeadLine);
    if (early && before.split('\n').some((l) => isHeadLine(l.trim()))) return [list[k].slice(m.index), ...list.slice(k + 1)];
    return list;
  }
  return list;
}

// A year, a URL or a quoted title.
const looksCited = (e) => /(?:19|20)\d{2}(?!\d)|https?:|www\.|[“"]/.test(e);

// pages: the PDF's text per page (or one string). Returns citation strings in
// reference-number order. Numbered lists are rebuilt by number; unnumbered
// bibliographies fall back to unnumberedEntries() (pdfReferenceEntries.lastMode
// reports which).
function pdfReferenceEntries(pages, { title } = {}) {
  pdfReferenceEntries.lastMode = 'none';
  const list = startAtTitle(Array.isArray(pages) ? pages : [String(pages || '')], title);
  const h = list.findIndex((p) => headAt(p) >= 0);
  if (h < 0) return [];
  const strict = collectPdfEntries(list, h, false);
  let entries = strict.entries;
  if (entries.length) pdfReferenceEntries.lastMode = 'numbered';
  if (entries.length < 2) {
    // Whichever reading finds more entries: loose starts or the unnumbered split.
    // Loose starts also match bulleted body text ("• Transcode", future-work
    // lists): keep them only when most entries read as citations.
    let loose = collectPdfEntries(list, h, true).entries;
    if (loose.filter(looksCited).length < 0.6 * loose.length) loose = [];
    const plain = entries.length ? [] : unnumberedEntries(strict.plain);
    if (loose.length > entries.length && loose.length >= plain.length) { entries = loose; pdfReferenceEntries.lastMode = 'loose'; }
    else if (plain.length > entries.length) {
      entries = trimProse(plain);
      pdfReferenceEntries.lastMode = 'unnumbered';
    }
  }
  // A second, unnumbered list after the main one ("Other Sources",
  // "Additional References") is part of the references: appended in order.
  if (strict.supp.length) entries = entries.concat(trimProse(unnumberedEntries(strict.supp)));
  // An author bio set after the list ("Rachel McIntire is a workflow producer …").
  const bio = /^[A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-zA-Z'’-]+\s+(?:is|was|has|received|joined|holds|graduated|earned|works|serves)\s/;
  return entries.map(cleanPdfEntry).filter((e) => e.length > 3 && !bio.test(e));
}

// Body text set after an unnumbered bibliography (a closing section in the
// next column) reads as entries: drop a trailing run with no year or URL.
function trimProse(list) {
  let end = list.length;
  while (end > 0 && !/(?:19|20)\d{2}(?!\d)|https?:|www\./.test(list[end - 1])) end--;
  return list.slice(0, end);
}

function collectPdfEntries(list, h, loose) {
  const blocks = []; // { n, pre, text }
  const plain = [];  // post-heading lines, for the unnumbered fallback
  const supp = [];   // lines of a supplementary list ("Other Sources")
  let inSupp = false;
  let cur = null;
  let stopped = false;
  let plainStopped = false;
  let seq = 0;
  for (let i = h; i < list.length; i++) {
    const page = list[i];
    const headPos = i === h ? headAt(page) : -1;
    let pos = 0;
    for (const raw of page.split('\n')) {
      const pre = i === h && pos < headPos;
      pos += raw.length + 1;
      // A whole disclaimer footer on one line goes first, keeping any citation text around it.
      const line = raw.replace(/\s+/g, ' ')
        .replace(/\s*The authors are solely responsible for the content of this technical presentation[\s\S]*?(?:\(SMPTE®?\)|$)\s*/g, ' ')
        .trim();
      if (!line) continue;
      if (REF_STOP.test(line)) { cur = null; stopped = true; inSupp = false; if (!pre) plainStopped = true; continue; }
      // A second heading after a numbered list ("References" … "Bibliography")
      // opens a supplementary list, like "Other Sources".
      // (A repeated "References" on a two-column page is not one.)
      if (isHeadLine(line) && !/^references/i.test(line) && !pre && blocks.some((b) => !b.pre)) { cur = null; stopped = true; inSupp = true; plainStopped = true; continue; }
      if (isPageNoise(line) || REF_HEAD.test(`\n${line}\n`)) { cur = null; continue; }
      const sh = !pre && line.match(/^(?:Other Sources|Additional References)\s*:?\s*(.*)$/i);
      if (sh) { cur = null; stopped = true; inSupp = true; plainStopped = true; if (sh[1]) supp.push(sh[1]); continue; }
      if (inSupp) {
        // …unless the numbered list resumes (a repeated heading on a continuation page).
        const next = (loose ? looseStart(line, seq) : entryStart(line));
        const maxN = blocks.reduce((a, b) => Math.max(a, b.n), 0);
        if (!(next && next.n === maxN + 1)) { supp.push(line); continue; }
        inSupp = false;
      }
      if (!pre && !plainStopped) plain.push(line);
      // Loose: entries run together on one line ("… Overview [2]SMPTE …", "… • Digital …").
      for (const part of line.split(loose ? /\s+(?=\[\s*\d{1,3}\s*\]|[•▪●◦]\s)/ : /\s+(?=\[\s*\d{1,3}\s*\]\s*[A-Z“"])/)) {
        const m = loose ? looseStart(part, seq) : entryStart(part);
        if (m) { if (m.seq) seq++; cur = { n: m.n, pre, text: m.text }; blocks.push(cur); stopped = false; continue; }
        if (cur && !stopped) cur.text = joinWrapped(cur.text, part);
      }
    }
    cur = null;
  }
  const entries = [];
  for (let n = 1; ; n++) {
    const c = blocks.filter((b) => b.n === n);
    if (!c.length) break;
    // Post-heading blocks first; of those, the fullest (a stray fragment loses).
    const pool = c.some((b) => !b.pre) ? c.filter((b) => !b.pre) : c;
    entries.push(pool.reduce((a, b) => (b.text.length > a.text.length ? b : a)).text);
  }
  return { entries, plain, supp };
}

// Conference papers repeat SMPTE's disclaimer footer on every page; an
// entry that wraps across a page picks it up. An entry can also run on into
// an unheaded author bio (often glued on with no space: "…FDLOhj.Al Kovalick
// has worked"): end it at the first sentence that starts "Name … is/was/…".
function cleanPdfEntry(e) {
  let t = String(e).replace(/\s*The authors are solely responsible for the content of this technical presentation[\s\S]*?(?:\(SMPTE®?\)|$)\s*/g, ' ');
  const cut = t.search(/\.\s*[A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-zA-Z'’-]+\s+(?:is|was|has|received|joined|holds|graduated|earned|works|serves)\b/);
  if (cut > 0) t = t.slice(0, cut + 1);
  return t.replace(/\s+/g, ' ').trim().replace(/^[.,;:]\s*/, '');
}

// ---- merge rules (never delete) -------------------------------------------
// Nested object: source values merged over the registry copy. Unchanged →
// the registry copy as-is ($meta included); keys the source lacks are kept;
// a changed or new key gets fresh provenance.
function nested(existing, key, value) {
  if (!value) return undefined;
  const prev = (existing && existing[key] && typeof existing[key] === 'object') ? existing[key] : {};
  if (Object.entries(value).every(([k, v]) => prev[k] === v)) return Object.keys(prev).length ? prev : undefined;
  const out = { ...prev };
  const locked = (k) => { const m = prev[`${k}$meta`]; return !!(m && (m.excludeChanges === true || m.excludeOverwrite === true)); };
  for (const [k, v] of Object.entries(value)) {
    if (prev[k] === v || locked(k)) continue; // a locked key (excludeChanges / excludeOverwrite) keeps its value
    out[k] = v;
    out[`${k}$meta`] = { source: 'parsed', confidence: 'high', note: "Read from SMPTE's journal library delivery (content_batch)", originalValue: prev[k], updated: new Date().toISOString() };
  }
  return out;
}

// Arrays: keep everything the registry has, append what the source adds.
function union(existingList, extracted) {
  const prev = Array.isArray(existingList) ? existingList : [];
  const out = [...prev];
  for (const v of extracted || []) if (!out.includes(v)) out.push(v);
  return out;
}

// Authors: keep each registry author object (bio, affiliation, ORCID);
// add source authors not yet listed; never remove one.
function mergeAuthors(existingList, extracted) {
  const prev = Array.isArray(existingList) ? existingList : [];
  const nameOf = (a) => String(a && typeof a === 'object' ? a.name : a || '').trim().toLowerCase();
  const have = new Set(prev.map(nameOf));
  const out = [...prev];
  for (const a of extracted || []) if (!have.has(nameOf(a))) { out.push(a); have.add(nameOf(a)); }
  return out;
}

// ---- parser ---------------------------------------------------------------
// Title compare key: case, punctuation and spacing ignored.
// Share of the shorter text's words (4+ letters) found in the other.
function tokenOverlap(a, b) {
  const toks = (s) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 3));
  const A = toks(a), B = toks(b);
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const w of A) if (B.has(w)) i++;
  return i / Math.min(A.size, B.size);
}

function titleKey(t) {
  return String(t || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Quoted title of a plain-text citation ("…" or “…”), without the trailing comma.
function pdfCiteTitle(cite) {
  const m = String(cite).match(/[“"]([^”"]{4,}?)[,.]?[”"]/);
  return m ? m[1].trim() : '';
}

// First URL in a plain-text citation, else its DOI.
function pdfCiteHref(cite) {
  const clean = (u) => u.replace(/[.,;:)\]]+$/, '');
  const url = String(cite).match(/https?:\/\/\S+/);
  if (url) return clean(url[0]);
  const doi = String(cite).match(/\b(10\.\d{4,9}\/[^\s,;"“”]+)/);
  return doi ? `https://doi.org/${clean(doi[1])}` : '';
}

const pdfRefsStats = { papers: 0, entries: 0, mismatch: 0, noCrossref: 0 };

function createSmpteJournalParser({ discovery }) {
  let ctx = null;

  // Built once per run: registry indices, MRI content hashes, upstream
  // duplicate DOIs, and a keyword conformer primed on every paper's terms.
  function init() {
    if (ctx) return ctx;
    const docs = loadAllDocs();
    const byDocId = new Map(docs.map((d) => [d.docId, d]));
    const byDoi = new Map();
    for (const d of docs) if (d.doi) byDoi.set(String(d.doi).trim(), d);
    const volPages = new Map();
    for (const d of docs) {
      if (!/^10\.5594-[jJmM]/.test(d.docId || '') || !d.volume || !d.pages) continue;
      const key = `${String(d.volume).trim()}|${String(d.pages).split(/[-–—]/)[0].trim()}`;
      if (!volPages.has(key)) volPages.set(key, []);
      volPages.get(key).push(d.docId);
    }
    // PDF citations: volume + issue + first page (pages restart per issue in
    // later volumes), and normalized title (venue- and year-checked on use).
    const volIssuePages = new Map();
    const titles = new Map();
    for (const d of docs) {
      if (!/^10\.5594-/.test(d.docId || '')) continue;
      if (d.volume && d.number && d.pages) {
        const key = `${String(d.volume).trim()}|${String(d.number).trim()}|${String(d.pages).split(/[-–—]/)[0].trim()}`;
        if (!volIssuePages.has(key)) volIssuePages.set(key, []);
        volIssuePages.get(key).push(d.docId);
      }
      const t = titleKey(d.docTitle);
      if (t.length >= 20) {
        if (!titles.has(t)) titles.set(t, []);
        titles.get(t).push({ docId: d.docId, conf: d.docType === 'Conference Paper', year: Number(String(d.publicationDate || '').slice(0, 4)) || null });
      }
    }
    const hashToRefId = new Map();
    try {
      for (const [refId, e] of Object.entries((loadMri() || {}).refs || {})) {
        if (e && e.contentHash && !e.isOrphan) hashToRefId.set(e.contentHash, refId);
      }
    } catch { /* no MRI yet */ }

    const recs = discovery.allPrimaries().map((p) => ({ ...p, rec: readContentBatch(p.file) })).filter((p) => p.rec);
    const doiCount = new Map();
    for (const { rec } of recs) if (rec.doi) doiCount.set(rec.doi, (doiCount.get(rec.doi) || 0) + 1);
    const dupDois = new Set([...doiCount].filter(([, n]) => n > 1).map(([d]) => d));

    // Papers in this run are citable too: a new paper citing another one in
    // the same delivery (or a 2026 paper citing a 2025 one ingested in the
    // same pass) resolves by DOI or volume + first page like a registry doc.
    for (const { rec } of recs) {
      const id = docIdFor(rec, dupDois);
      if (rec.doi && !byDoi.has(rec.doi)) byDoi.set(rec.doi, { docId: id });
      if (!byDocId.has(id)) byDocId.set(id, null);
      if (/^10\.5594-[jJmM]/.test(id) && rec.volume && rec.fpage) {
        const key = `${String(rec.volume).trim()}|${String(rec.fpage).trim()}`;
        if (!volPages.has(key)) volPages.set(key, []);
        if (!volPages.get(key).includes(id)) volPages.get(key).push(id);
      }
    }

    const site = JSON.parse(fs.readFileSync(SITE_PATH, 'utf8'));
    const kw = makeKeywordConformer(site.controlledKeywords || [], loadKeywordDecisions(), { shouted: true });
    kw.prime(recs.map(({ rec }) => rec.rawKeywords));

    ctx = { byDocId, byDoi, docIds: new Set(byDocId.keys()), volPages, volIssuePages, titles, hashToRefId, dupDois, kw };
    return ctx;
  }

  // Reuse the registry's nested object (with its $meta) when the values match.
  function isSmpteJournalSource(src) {
    const s = String(src || '').toLowerCase().trim();
    return /^journal$/.test(s) || /smp[te]|soc.*mot|trans.*mot/.test(s);
  }

  function resolveRef(rawRef) {
    const { byDoi, docIds, volPages, hashToRefId } = ctx;
    const doi = (rawRef.match(/<pub-id[^>]*pub-id-type=["']doi["'][^>]*>([^<]+)<\/pub-id>/i) || [])[1];
    if (doi) {
      const t = doi.trim();
      if (byDoi.has(t)) return { refId: byDoi.get(t).docId, via: 'direct-doi' };
      if (docIds.has(t.replace(/\//g, '-'))) return { refId: t.replace(/\//g, '-'), via: 'direct-doi' };
    }
    const source = field(rawRef, 'source');
    const volume = field(rawRef, 'volume');
    const fpage = field(rawRef, 'fpage');
    const title = field(rawRef, 'article-title') || field(rawRef, 'chapter-title') || source;
    if (volume && fpage && isSmpteJournalSource(source)) {
      const hits = volPages.get(`${volume.trim()}|${fpage.trim()}`);
      if (hits && hits.length === 1) return { refId: hits[0], via: 'vol+pages' };
      if (hits && hits.length > 1) return { refId: null, via: 'vol+pages-ambiguous' };
    }
    if (title) {
      const mapped = mapRefByCite(title);
      if (mapped) return { refId: mapped, via: 'mapRefByCite' };
    }
    const id = parseCiteDesignator(tidyCiteText(rawRef), { isRegistryDoc: (x) => docIds.has(x) });
    if (id) return { refId: id, via: 'leading-designator' };
    const h = _contentHash(rawRef);
    if (h && hashToRefId.has(h)) return { refId: hashToRefId.get(h), via: 'content-hash' };
    return { refId: null, via: 'orphan-slug' };
  }

  // FTXML sibling → ordered refIds (canonical or orphan slugs), MRI sightings recorded.
  function references(file, docId) {
    const ft = path.join(path.dirname(file), 'FTXML', `FT_${path.basename(file)}`);
    let xml;
    try { xml = fs.readFileSync(ft, 'utf8'); } catch { return null; }
    const list = (xml.match(/<ref-list\b[\s\S]*?<\/ref-list>/) || [])[0];
    if (!list) return null;
    const out = [];
    for (const raw of list.match(/<ref(?:\s[^>]*)?>[\s\S]*?<\/ref>/g) || []) {
      const r = resolveRef(raw);
      const sight = {
        docId, type: 'bibliographic', cite: tidyCiteText(raw), href: citeHref(raw), rawRef: raw,
        title: field(raw, 'article-title') || '', mapSource: 'ftxml-extract', mapDetail: r.via,
      };
      if (r.refId) {
        if (r.refId === docId) continue;
        mriRecordSighting({ ...sight, refId: r.refId });
        if (!out.includes(r.refId)) out.push(r.refId);
      } else {
        const mint = mriRecordSighting(sight);
        const slug = mint && mint.mintedSlug;
        if (slug && !out.includes(slug)) out.push(slug);
      }
    }
    return out.length ? out : null;
  }

  // --- References-only pass from the PDF (IEEE-era records, 2015–2023) ---

  // One plain-text citation → { refId } (registry doc) or { refId: null } (orphan).
  function resolvePdfCite(cite) {
    const { byDoi, docIds, volPages, volIssuePages, titles } = ctx;
    const doi = ((cite.match(/\b(10\.\d{4,9}\/ ?[^\s,;"“”]+)/) || [])[1] || "").replace("/ ", "/");
    if (doi) {
      const t = doi.replace(/[.)\]]+$/, '');
      if (byDoi.has(t)) return { refId: byDoi.get(t).docId, via: 'direct-doi' };
      if (docIds.has(t.replace(/\//g, '-'))) return { refId: t.replace(/\//g, '-'), via: 'direct-doi' };
    }
    if (/SMPTE|Mot(?:ion)?\.? ?Imag|Motion Pict|Soc(?:iety)?\.? (?:of )?Motion/i.test(cite)) {
      // "vol. 124, no. 3, pp. 19–27", "Vol. 124, Issue: 8, pp. 19-24" or "124(3):19–27"
      const short = cite.match(/\b(\d{2,3})\s*\((\d+)\)\s*:\s*(\d+)/);
      const vol = short ? short[1] : (cite.match(/\bvol\.?\s*(\d+)/i) || [])[1];
      const issue = short ? short[2] : (cite.match(/\b(?:no\.|issue:?)\s*(\d+)/i) || [])[1];
      const fpage = short ? short[3] : (cite.match(/\bpp?\.\s*(\d+)/i) || [])[1];
      const hits = vol && fpage && (issue ? volIssuePages.get(`${vol}|${issue}|${fpage}`) : volPages.get(`${vol}|${fpage}`));
      if (hits && hits.length === 1) return { refId: hits[0], via: issue ? 'vol+issue+pages' : 'vol+pages' };
    }
    // An SMPTE paper cited by its exact title, when the venue (journal vs
    // conference) and year agree: one candidate only.
    const t = titleKey(pdfCiteTitle(cite));
    if (t && titles.has(t) && /SMPTE|Mot(?:ion)?\.? ?Imag|Motion Pict|Technical Conference/i.test(cite)) {
      const conf = /Conference|Conf\.|presented at|Proc\./i.test(cite) && !/Mot(?:ion)?\.? ?Imag|J\. SMPTE|Journal/i.test(cite);
      const years = (cite.match(/\b(?:19|20)\d{2}\b/g) || []).map(Number);
      const cand = titles.get(t).filter((c) => c.conf === conf && (!years.length || !c.year || years.some((y) => Math.abs(y - c.year) <= 1)));
      if (cand.length === 1) return { refId: cand[0].docId, via: 'smpte-title' };
    }
    const whole = mapRefByCite(cite);
    if (whole) return { refId: whole, via: 'mapRefByCite' };
    const title = pdfCiteTitle(cite);
    if (title) {
      const mapped = mapRefByCite(title);
      if (mapped) return { refId: mapped, via: 'mapRefByCite' };
    }
    const id = parseCiteDesignator(cite, { isRegistryDoc: (x) => docIds.has(x) });
    if (id) return { refId: id, via: 'leading-designator' };
    return { refId: null, via: 'orphan-slug' };
  }

  // Crossref's reference count for a DOI: a cross-check only (never a source).
  // A DOI's Crossref record (message), or null.
  async function crossrefWork(doi) {
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
        headers: { 'User-Agent': 'MSRBot.io (https://github.com/PrZ3r/MSRBot.io)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return null;
      const j = await res.json();
      return (j && j.message) || null;
    } catch { return null; }
  }
  const crossrefCount = (w) => {
    const n = w && (w['references-count'] ?? w['reference-count']);
    return Number.isInteger(n) ? n : null;
  };

  // --crossref-fill (the maintainer's call, for papers whose PDF parse falls
  // short of Crossref's list): Crossref entries with no match among the parsed
  // citations. Matched by DOI (in our text, or resolving to a doc already
  // cited), by text, or — for a DOI-only entry — by the DOI's title. Empty
  // entries are skipped. More candidates than the gap → ambiguous, none taken.
  async function crossrefFill(work, cites, out, gap) {
    const seen = new Set();
    const cands = [];
    for (const r of (work && work.reference) || []) {
      const doi = String(r.DOI || '').trim();
      let text = decodeEntities(String(r.unstructured || [r.author, r['article-title'], r['journal-title'] || r['volume-title'] || r['series-title'], r.year].filter(Boolean).join(', ')))
        .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
        .replace(/,\s*0$/, '')                      // Crossref's empty year
        .replace(/\?([^?]+?)\s?\?(?=,|$)/, '“$1”')    // garbled quotes: "?Call for Evidence ?"
        .replace(/\s\?\s/g, ' – ');                  // garbled dash: "Environment ? CAVE"
      if (!/[A-Za-z]{3}/.test(text)) text = '';
      if (!text && !doi) continue;
      const key = doi ? doi.toLowerCase() : titleKey(text);
      if (seen.has(key)) continue;
      seen.add(key);
      if (doi && cites.some((c) => c.toLowerCase().includes(doi.toLowerCase()))) continue;
      const viaDoi = doi && resolvePdfCite(`doi: ${doi}`);
      if (viaDoi && viaDoi.refId && out.includes(viaDoi.refId)) continue;
      let probe = text;
      if (!probe && doi) {
        const w = await crossrefWork(doi);
        const t = w && [].concat(w.title || [])[0];
        if (t) {
          const who = (w.author || []).slice(0, 3).map((a) => [a.given, a.family].filter(Boolean).join(' ')).join(', ');
          const year = ((w.issued || {})['date-parts'] || [[]])[0][0];
          text = decodeEntities(`${who ? `${who}, ` : ''}“${t},” ${[].concat(w['container-title'] || [])[0] || w.publisher || ''}${year ? `, ${year}` : ''}. doi: ${doi}`)
            .replace(/<[^>]+>/g, '').replace(/ ,/g, ',');
          probe = t;
        } else text = `doi: ${doi}`;
      }
      if (probe && cites.some((c) => tokenOverlap(c, probe) >= 0.6)) continue;
      cands.push({ doi, text });
    }
    if (!cands.length) return { added: [], skipped: null };
    if (cands.length > gap) return { added: [], skipped: `${cands.length} unmatched Crossref entries for ${gap} missing; ambiguous, none added` };
    return { added: cands, skipped: null };
  }

  async function extractPdfRefs(p) {
    const { byDoi } = init();
    let xml;
    try { xml = fs.readFileSync(p.file, 'utf8'); } catch { return []; }
    const doi = decodeEntities(tag(xml, 'articledoi')).trim();
    const existing = doi && byDoi.get(doi);
    if (!existing || !existing.docId) return [];
    const docId = existing.docId;
    // Never over a better source: only papers with no bibliography, or one this pass wrote.
    const prev = existing.references || {};
    const prevMeta = prev['bibliographic$meta'];
    if (Array.isArray(prev.bibliographic) && prev.bibliographic.length && !(prevMeta && /^References parsed from the published PDF/.test(prevMeta.note || ''))) return [];

    let pages;
    try {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(p.pdf)));
      ({ text: pages } = await extractText(pdf, { mergePages: false }));
    } catch (e) {
      console.warn(`   ⚠️ ${docId}: could not read ${path.basename(p.pdf)} (${e.message})`);
      return [];
    }
    const cites = pdfReferenceEntries(pages, { title: existing.docTitle });
    const mode = pdfReferenceEntries.lastMode;
    if (!cites.length) {
      // A list this pass wrote earlier that a corrected parse no longer finds
      // (e.g. another article's references) is withdrawn; any other is untouched.
      if (!(Array.isArray(prev.bibliographic) && prev.bibliographic.length)) return [];
      const doc = { docId, references: { bibliographic: [] } };
      if (prev.normative) doc.references.normative = prev.normative;
      Object.defineProperty(doc, '__sourceUrl', { value: undefined, enumerable: false, configurable: true, writable: true });
      return [doc];
    }

    const out = [];
    for (const cite of cites) {
      const r = resolvePdfCite(cite);
      const sight = {
        docId, type: 'bibliographic', cite, href: pdfCiteHref(cite), rawRef: cite,
        title: pdfCiteTitle(cite), mapSource: 'pdf-extract', mapDetail: r.via,
      };
      if (r.refId) {
        if (r.refId === docId) continue;
        mriRecordSighting({ ...sight, refId: r.refId });
        if (!out.includes(r.refId)) out.push(r.refId);
      } else {
        const mint = mriRecordSighting(sight);
        const slug = mint && mint.mintedSlug;
        if (slug && !out.includes(slug)) out.push(slug);
      }
    }
    if (!out.length) return [];

    const work = await crossrefWork(doi);
    const cr = crossrefCount(work);
    let fill = null;
    if (discovery.crossrefFill && cr !== null && cr > cites.length) {
      fill = await crossrefFill(work, cites, out, cr - cites.length);
      for (const c of fill.added) {
        let r = c.doi ? resolvePdfCite(`${c.text} doi: ${c.doi}`) : resolvePdfCite(c.text);
        // Crossref lowercases some entries ("itu-r bs 1864, 2010"): retry for the designator.
        if (!r.refId && c.text === c.text.toLowerCase()) {
          const id = parseCiteDesignator(c.text.toUpperCase(), { isRegistryDoc: (x) => ctx.docIds.has(x) });
          if (id) r = { refId: id, via: 'leading-designator' };
        }
        const sight = {
          docId, type: 'bibliographic', cite: c.text, href: c.doi ? `https://doi.org/${c.doi}` : pdfCiteHref(c.text), rawRef: c.text,
          title: pdfCiteTitle(c.text), mapSource: 'crossref-fill', mapDetail: r.via,
        };
        if (r.refId && r.refId !== docId) {
          mriRecordSighting({ ...sight, refId: r.refId });
          if (!out.includes(r.refId)) out.push(r.refId);
        } else if (!r.refId) {
          const mint = mriRecordSighting(sight);
          if (mint && mint.mintedSlug && !out.includes(mint.mintedSlug)) out.push(mint.mintedSlug);
        }
      }
    }
    const where = path.relative(discovery.source, p.pdf);
    const check = cr === null
      ? 'Crossref cross-check unavailable for this DOI.'
      : `Cross-check: Crossref lists ${cr} reference(s) for this DOI; ${cites.length} parsed from the PDF.`;
    const note = `References parsed from the published PDF (${where})${mode === 'unnumbered' ? ', unnumbered bibliography' : ''}. `
      + "SMPTE's library delivery has no reference file or full text for this paper "
      + '(src/main/reports/smpte-upstream/referenceFilesTruthTable.md). ' + check
      + (fill && fill.added.length ? ` Crossref fill: ${fill.added.length} reference(s) the PDF parse missed were added from Crossref's list for this DOI (MRI mapSource crossref-fill), at the maintainer's direction.` : '')
      + (fill && fill.skipped ? ` Crossref fill skipped: ${fill.skipped}.` : '');
    const total = cites.length + (fill ? fill.added.length : 0);

    const doc = { docId, references: { bibliographic: out } };
    if (prev.normative) doc.references.normative = prev.normative;
    Object.defineProperty(doc, '__sourceUrl', { value: undefined, enumerable: false, configurable: true, writable: true });
    Object.defineProperty(doc, '__metaNotes', { value: { 'references.bibliographic': note }, enumerable: false, configurable: true, writable: true });
    const mismatch = cr !== null && cr !== total;
    if (mismatch || mode === 'unnumbered') {
      const flag = mismatch
        ? `Reference count (${total}${fill && fill.added.length ? `, ${fill.added.length} from Crossref` : ''}) differs from Crossref (${cr}); check the parse against the PDF`
        : 'Unnumbered bibliography split by line heuristics; check entry boundaries against the PDF';
      Object.defineProperty(doc, '__metaFlags', { value: { 'references.bibliographic': { reviewRequired: true, flag } }, enumerable: false, configurable: true, writable: true });
    }
    if (!pdfRefsStats.papers) {
      process.once('exit', () => console.log(`📄 PDF references: ${pdfRefsStats.papers} paper(s), ${pdfRefsStats.entries} citation(s); `
        + `${pdfRefsStats.mismatch} differ from Crossref's count (flagged reviewRequired), ${pdfRefsStats.noCrossref} without a Crossref count`));
    }
    pdfRefsStats.papers++;
    pdfRefsStats.entries += cites.length;
    if (mismatch) pdfRefsStats.mismatch++;
    if (cr === null) pdfRefsStats.noCrossref++;
    return [doc];
  }

  async function extractFromUrl(key) {
    const p = discovery.getPrimary(key);
    if (!p) throw new Error(`no SMPTE journal paper for ${key}`);
    if (p.kind === 'pdf-refs') return extractPdfRefs(p);
    const { byDocId, dupDois, kw } = init();
    const rec = readContentBatch(p.file);
    if (!rec) return [];
    const docType = p.docType;
    const docId = docIdFor(rec, dupDois);
    const existing = byDocId.get(docId) || null;

    const keywords = union(existing && existing.keywords, rec.rawKeywords.length ? kw.conformList(rec.rawKeywords) : []);
    const authors = mergeAuthors(existing && existing.authors, rec.authors);
    const doc = {
      docId,
      docType,
      docLabel: docLabel(rec, docType),
      docTitle: rec.title || rec.contentType || 'Untitled',
      doi: rec.doi || undefined,
      authors: authors.length ? authors : undefined,
      abstract: rec.abstract || undefined,
      pages: rec.pages || undefined,
      volume: rec.volume || undefined,
      number: rec.issue || undefined,
      publicationDate: publicationDate(rec) || undefined,
      journalTitle: rec.containerTitle || undefined,
      abbrevTitle: rec.abbrevTitle || undefined,
      journalAcronym: rec.acronym || undefined,
      issn: rec.isConf ? undefined : nested(existing, 'issn',
        (rec.issnPrint || rec.issnElectronic) ? { ...(rec.issnPrint ? { print: rec.issnPrint } : {}), ...(rec.issnElectronic ? { electronic: rec.issnElectronic } : {}) } : null),
      isbn: rec.isConf && rec.isbn ? nested(existing, 'isbn', { electronic: rec.isbn }) : undefined,
      publisher: 'SMPTE',
      publisherLocation: rec.meetingLocation ? nested(existing, 'publisherLocation', { city: rec.meetingLocation }) : undefined,
      contentType: rec.contentType || undefined,
      keywords: keywords.length ? keywords : undefined,
      copyright: (rec.copyrightHolder || rec.copyrightYear)
        ? nested(existing, 'copyright', { ...(rec.copyrightHolder ? { holder: rec.copyrightHolder } : {}), ...(rec.copyrightYear ? { year: rec.copyrightYear } : {}) })
        : undefined,
      href: rec.doi ? `https://doi.org/${rec.doi}` : undefined,
      status: { active: true },
    };
    if (rec.doi && dupDois.has(rec.doi)) doc.doiCollision = rec.doi;
    for (const k of Object.keys(doc)) if (doc[k] === undefined) delete doc[k];

    // References: the source list as a unit (see header); absent → untouched.
    const extractedBib = references(p.file, docId);
    if (extractedBib) {
      const prevRefs = (existing && existing.references) || {};
      doc.references = { bibliographic: extractedBib };
      if (prevRefs.normative) doc.references.normative = prevRefs.normative;
    }

    Object.defineProperty(doc, '__sourceUrl', { value: undefined, enumerable: false, configurable: true, writable: true });
    return [doc];
  }

  return { extractFromUrl, extractFromSeedDoc: extractFromUrl };
}

module.exports = {
  createSmpteJournalParser, readContentBatch, nested, union, mergeAuthors,
  pdfReferenceEntries, pdfCiteTitle, pdfCiteHref, pdfRefsStats,
};
