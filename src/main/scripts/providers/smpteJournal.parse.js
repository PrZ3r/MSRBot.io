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

    ctx = { byDocId, byDoi, docIds: new Set(byDocId.keys()), volPages, hashToRefId, dupDois, kw };
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

  async function extractFromUrl(key) {
    const { byDocId, dupDois, kw } = init();
    const p = discovery.getPrimary(key);
    if (!p) throw new Error(`no SMPTE journal paper for ${key}`);
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

module.exports = { createSmpteJournalParser, readContentBatch, nested, union, mergeAuthors };
