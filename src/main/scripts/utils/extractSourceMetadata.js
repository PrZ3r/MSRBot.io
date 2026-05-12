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

// Lightweight XML extractors for _source/SMPTE metadata side-cars.
// Intentionally regex-based: the documents follow a flat, predictable schema
// and pulling in an XML parser isn't warranted for a one-shot audit script.

const fs = require('fs');

const HTML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&#x2014;': '—', '&#x2013;': '–', '&#x00D7;': '×', '&#x2026;': '…',
  '&#x201C;': '“', '&#x201D;': '”', '&#x2018;': '‘', '&#x2019;': '’',
  '&#x00A0;': ' ', '&#x00E9;': 'é', '&#x00E8;': 'è',
};

function decodeEntities(s) {
  if (s == null) return s;
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; }
    })
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m] || m);
}

function normText(s) {
  if (s == null) return null;
  const t = decodeEntities(String(s)).replace(/\s+/g, ' ').trim();
  return t || null;
}

function matchAll(text, rx) {
  const out = [];
  let m;
  const g = new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g');
  while ((m = g.exec(text)) !== null) out.push(m);
  return out;
}

function firstTag(text, tag) {
  const m = text.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : null;
}

function firstTagText(text, tag) {
  return normText(firstTag(text, tag));
}

function firstAttr(text, tag, attr) {
  const m = text.match(new RegExp(`<${tag}\\s[^>]*\\b${attr}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

function composeDate(blockText) {
  if (!blockText) return null;
  const year = firstTagText(blockText, 'year');
  const month = firstTagText(blockText, 'month');
  const day = firstTagText(blockText, 'day');
  if (!year) return null;
  const monthNum = monthToNum(month);
  const dd = day ? String(day).padStart(2, '0') : null;
  if (monthNum && dd) return `${year}-${monthNum}-${dd}`;
  if (monthNum) return `${year}-${monthNum}`;
  return year;
}

function monthToNum(m) {
  if (!m) return null;
  const s = String(m).trim().toLowerCase();
  const map = {
    january: '01', jan: '01',
    february: '02', feb: '02',
    march: '03', mar: '03',
    april: '04', apr: '04',
    may: '05',
    june: '06', jun: '06',
    july: '07', jul: '07',
    august: '08', aug: '08',
    september: '09', sept: '09', sep: '09',
    october: '10', oct: '10',
    november: '11', nov: '11',
    december: '12', dec: '12',
  };
  if (map[s]) return map[s];
  if (/^\d+$/.test(s)) return s.padStart(2, '0');
  const slashMatch = s.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s*[\/\-]\s*(january|february|march|april|may|june|july|august|september|october|november|december)$/);
  if (slashMatch) return map[slashMatch[1]]; // e.g. "January/February" → "01"
  return null;
}

const STANDARD_TYPE_MAP = {
  'standard docs|smpte standard': 'Standard',
  'recommended practice docs|smpte recommended practice': 'Recommended Practice',
  'engineering guideline docs|smpte engineering guideline': 'Engineering Guideline',
  'registered disclosure doc docs|smpte registered disclosure doc': 'Registered Disclosure Document',
  'technical specification docs|smpte technical specification': 'Technical Specification',
  'administrative guideline docs|smpte administrative guideline': 'Administrative Guideline',
  'operations manual docs|smpte operations manual': 'Operations Manual',
  'standard docs|smpte overview': 'Overview Document',
};

function mapDocTypeFromStandardXml(typeAttr, subtypeAttr) {
  const key = `${(typeAttr || '').toLowerCase().trim()}|${(subtypeAttr || '').toLowerCase().trim()}`;
  return STANDARD_TYPE_MAP[key] || null;
}

const STATUS_MODIFIER_MAP = {
  superseded: { superseded: true, active: false },
  withdrawn: { withdrawn: true, active: false },
  stabilized: { stabilized: true },
  reaffirmed: { reaffirmed: true },
  amended: { amended: true },
};

function mapStatusModifier(modifierType) {
  if (!modifierType) return {};
  return STATUS_MODIFIER_MAP[String(modifierType).toLowerCase().trim()] || {};
}

// SMPTE committee slug builder. Source committee text looks like
// "10E - Technology Committee on Essence". Extract the leading code.
function committeeToSlug(source, registrySlugs) {
  if (!source) return null;
  const codeMatch = String(source).match(/^\s*([A-Z0-9]+)\b/i);
  if (!codeMatch) return null;
  const code = codeMatch[1].toLowerCase();
  // Registry-derived lookup first
  const known = registrySlugs.get(code);
  if (known) return { slug: known, reviewRequired: false };
  // Fallback guess: smpte-<code>-tc
  return { slug: `smpte-${code}-tc`, reviewRequired: true };
}

function buildCommitteeSlugReverseIndex(registry) {
  // Registry slugs look like "smpte-10e-tc", "smpte-02c-st".
  // Reverse-index: "10e" → "smpte-10e-tc" (prefer most-used slug per code).
  const byCode = new Map();
  const countByPair = new Map();
  for (const doc of registry) {
    if (!doc || !doc.group) continue;
    const m = String(doc.group).match(/^smpte-([a-z0-9]+)-/i);
    if (!m) continue;
    const code = m[1].toLowerCase();
    const pair = `${code}|${doc.group}`;
    countByPair.set(pair, (countByPair.get(pair) || 0) + 1);
  }
  const bestByCode = new Map();
  for (const [pair, count] of countByPair.entries()) {
    const [code, slug] = pair.split('|');
    const prev = bestByCode.get(code);
    if (!prev || count > prev.count) bestByCode.set(code, { slug, count });
  }
  for (const [code, { slug }] of bestByCode.entries()) byCode.set(code, slug);
  return byCode;
}

// --- standard XML ------------------------------------------------------------

function readStandardXml(absPath) {
  let text;
  try {
    text = fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }

  const stdMetaBlock = firstTag(text, 'standard_metadata');
  const issueBlock = firstTag(text, 'standard_issue');
  const articleBlock = firstTag(text, 'standard_article');
  if (!stdMetaBlock && !articleBlock) return null;

  const out = {};

  if (stdMetaBlock) {
    const typeAttr = firstAttr(stdMetaBlock, 'standard_type', 'type');
    const subtypeAttr = firstAttr(stdMetaBlock, 'standard_subtype', 'type');
    out.docType = mapDocTypeFromStandardXml(typeAttr, subtypeAttr);
    out.docLabel = firstTagText(stdMetaBlock, 'normalized_title') || firstTagText(stdMetaBlock, 'full_title');
    out.standardId = firstTagText(stdMetaBlock, 'standard_id');
    out.productNumber = firstTagText(stdMetaBlock, 'product_number');
    out.familyId = firstTagText(stdMetaBlock, 'family');
    out.docSuite = firstTagText(stdMetaBlock, 'root_title');
    out.docNumber = firstTagText(stdMetaBlock, 'root');

    // ISBN electronic preferred
    const isbnMatch = stdMetaBlock.match(/<isbn\s[^>]*type="electronic"[^>]*>([^<]+)<\/isbn>/i) || stdMetaBlock.match(/<isbn[^>]*>([^<]+)<\/isbn>/i);
    out.isbn = isbnMatch ? normText(isbnMatch[1]) : null;

    const pubBlock = firstTag(stdMetaBlock, 'publisher');
    if (pubBlock) {
      out.publisher = firstTagText(pubBlock, 'publisher_name');
      const locBlock = firstTag(pubBlock, 'publisher_location');
      if (locBlock) {
        const city = firstTagText(locBlock, 'city');
        const country = firstTagText(locBlock, 'country');
        if (city || country) out.publisherLocation = { ...(city ? { city } : {}), ...(country ? { country } : {}) };
      }
    }

    const copyBlock = firstTag(stdMetaBlock, 'copyright');
    if (copyBlock) {
      const holder = firstTagText(copyBlock, 'copyright_holder');
      const year = firstTagText(copyBlock, 'year');
      if (holder || year) out.copyright = { ...(holder ? { holder } : {}), ...(year ? { year } : {}) };
    }

    const sponsorBlock = firstTag(stdMetaBlock, 'sponsor');
    if (sponsorBlock) {
      out.committee = firstTagText(sponsorBlock, 'committee');
    }

    const approvalBlock = firstTag(stdMetaBlock, 'approval_date');
    if (approvalBlock) out.approvalDate = composeDate(approvalBlock);

    // DOI (authoritative) — usually inside <standard_metadata>, sometimes inside <standard_article>
    const doiInner = firstTagText(stdMetaBlock, 'doi');
    if (doiInner) out.doi = doiInner;

    // status
    const statusType = firstAttr(stdMetaBlock, 'standard_status', 'status');
    const modifierType = firstAttr(stdMetaBlock, 'standard_modifier', 'type');
    out.statusFlags = {};
    if (statusType && /^inactive$/i.test(statusType)) {
      out.statusFlags.active = false;
    } else if (statusType && /^active$/i.test(statusType)) {
      out.statusFlags.active = true;
    }
    Object.assign(out.statusFlags, mapStatusModifier(modifierType));

    // supersededDate
    const relAttr = stdMetaBlock.match(/<standard_relationship\s+type="S"\s+relationship_date="([^"]+)"/i);
    if (relAttr) out.statusFlags.supersededDate = relAttr[1];

    // keywords from topical + standardtopicset + ICS descriptions
    const keywords = new Set();
    matchAll(stdMetaBlock, /<topic[^>]*>([^<]+)<\/topic>/gi).forEach((m) => {
      const t = normText(m[1]);
      if (t) keywords.add(t);
    });
    matchAll(stdMetaBlock, /<standard_topic[^>]*>([^<]+)<\/standard_topic>/gi).forEach((m) => {
      const t = normText(m[1]);
      if (t) keywords.add(t);
    });
    if (keywords.size) out.keywords = [...keywords];

    // ICS codes
    const ics = [];
    matchAll(stdMetaBlock, /<code_term\s+codenum="([^"]+)"[^>]*>([^<]*)<\/code_term>/gi).forEach((m) => {
      ics.push({ code: m[1], description: normText(m[2]) || '' });
    });
    if (ics.length) out.icsCodes = ics;
  }

  if (issueBlock) {
    const pubDate = firstTag(issueBlock, 'publication_date');
    if (pubDate) out.publicationDate = composeDate(pubDate);
  }

  if (articleBlock) {
    out.docTitle = firstTagText(articleBlock, 'title');
    out.abstract = firstTagText(articleBlock, 'abstract') || firstTagText(articleBlock, 'scope');
    const pagesBlock = firstTag(articleBlock, 'pages');
    if (pagesBlock) {
      const fp = firstTagText(pagesBlock, 'first_page');
      const lp = firstTagText(pagesBlock, 'last_page');
      if (fp && lp) out.pages = `${fp}–${lp}`;
      else if (fp) out.pages = fp;
    }
    const articleFile = firstTagText(articleBlock, 'file');
    if (articleFile) out.sourceFile = articleFile;
    // DOI may live inside the article block too (legacy XMLs)
    if (!out.doi) {
      const articleDoi = firstTagText(articleBlock, 'doi');
      if (articleDoi) out.doi = articleDoi;
    }
    // Article-level index_terms / keywords merge into keywords
    const indexTerms = matchAll(articleBlock, /<term[^>]*>([^<]+)<\/term>/gi).map((m) => normText(m[1])).filter(Boolean);
    if (indexTerms.length) {
      out.keywords = [...new Set([...(out.keywords || []), ...indexTerms])];
    }
  }

  return out;
}

// --- journal issue-metadata XML ---------------------------------------------

function readIssueMetadataXml(absPath) {
  let text;
  try {
    text = fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }

  const journalMetaBlock = firstTag(text, 'journal_metadata');
  const issueBlock = firstTag(text, 'journal_issue');
  if (!journalMetaBlock) return null;

  const suite = {};
  suite.fullTitle = firstTagText(journalMetaBlock, 'full_title');
  suite.abbrevTitle = firstTagText(journalMetaBlock, 'abbrev_title');
  suite.journalAcronym = firstTagText(journalMetaBlock, 'journal_acronym');

  const issnPrint = (journalMetaBlock.match(/<issn[^>]*type="paper"[^>]*>([^<]+)<\/issn>/i) || [])[1];
  const issnElectronic = (journalMetaBlock.match(/<issn[^>]*type="electronic"[^>]*>([^<]+)<\/issn>/i) || [])[1];
  if (issnPrint || issnElectronic) {
    suite.issn = {};
    if (issnPrint) suite.issn.print = normText(issnPrint);
    if (issnElectronic) suite.issn.electronic = normText(issnElectronic);
  }

  const pubBlock = firstTag(journalMetaBlock, 'publisher');
  if (pubBlock) {
    suite.publisher = firstTagText(pubBlock, 'publisher_name');
    const locBlock = firstTag(pubBlock, 'publisher_location');
    if (locBlock) {
      const city = firstTagText(locBlock, 'city');
      const country = firstTagText(locBlock, 'country');
      if (city || country) suite.publisherLocation = { ...(city ? { city } : {}), ...(country ? { country } : {}) };
    }
  }

  const copyBlock = firstTag(journalMetaBlock, 'copyright');
  if (copyBlock) {
    const holder = firstTagText(copyBlock, 'copyright_holder');
    const year = firstTagText(copyBlock, 'year');
    if (holder || year) suite.copyright = { ...(holder ? { holder } : {}), ...(year ? { year } : {}) };
  }

  let issueVolume = null;
  let issueNumber = null;
  let issuePublicationDate = null;
  if (issueBlock) {
    const pubDate = firstTag(issueBlock, 'publication_date');
    if (pubDate) issuePublicationDate = composeDate(pubDate);
    const volBlock = firstTag(issueBlock, 'journal_volume');
    if (volBlock) {
      issueVolume = firstTagText(volBlock, 'volume');
      issueNumber = firstTagText(volBlock, 'issue');
    }
  }

  const articles = new Map();
  for (const articleMatch of matchAll(text, /<journal_article[\s\S]*?<\/journal_article>/gi)) {
    const block = articleMatch[0];
    const file = firstTagText(block, 'file');
    const doi = firstTagText(block, 'doi');
    if (!file || !doi) continue;
    const title = firstTagText(block, 'title');
    const articleStatus = firstTagText(block, 'article_status');
    const articleType = firstAttr(block, 'pubitype', 'type');
    const pagesBlock = firstTag(block, 'pages');
    let pages = null;
    if (pagesBlock) {
      const fp = firstTagText(pagesBlock, 'first_page');
      const lp = firstTagText(pagesBlock, 'last_page');
      if (fp && lp) pages = `${fp}–${lp}`;
      else if (fp) pages = fp;
    }
    const authors = [];
    for (const authMatch of matchAll(block, /<author[\s\S]*?<\/author>/gi)) {
      const pn = firstTag(authMatch[0], 'person_name');
      if (!pn) continue;
      const given = firstTagText(pn, 'given_name');
      const surname = firstTagText(pn, 'surname');
      const full = [given, surname].filter(Boolean).join(' ').trim();
      if (full) authors.push(full);
    }
    const keywords = [];
    for (const kwMatch of matchAll(block, /<(major_topic|minor_topic)>([^<]+)<\/\1>/gi)) {
      const t = normText(kwMatch[2]);
      if (t) keywords.push(t);
    }
    articles.set(file, {
      doi,
      docTitle: title,
      pages,
      authors: authors.length ? authors : null,
      keywords: keywords.length ? keywords : null,
      articleType,
      articleStatus,
      abstract: firstTagText(block, 'abstract'),
    });
  }

  return {
    journalSuite: suite,
    issueVolume,
    issueNumber,
    issuePublicationDate,
    articles,
  };
}

// --- reference side-car XML -------------------------------------------------

function readRefXml(absPath, parseRefId) {
  let text;
  try {
    text = fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }

  // Container DOI (authoritative for the document this ref.xml is attached to)
  const containerDoiMatch = text.match(/<objid\s+objidtype="doi">([^<]+)<\/objid>/i);
  const containerDoi = containerDoiMatch ? normText(containerDoiMatch[1]) : null;

  const normative = [];
  const bibliographic = [];
  const referencedDocIds = new Set();

  for (const refMatch of matchAll(text, /<ref\s+id="(ref-[a-z]+-\d+)"[^>]*>([\s\S]*?)<\/ref>/gi)) {
    const id = refMatch[1];
    const body = refMatch[2];
    const pubTitle = firstTagText(body, 'ref_pubtitle');
    const articleTitle = firstTagText(body, 'ref_articletitle');
    const standardnum = firstTagText(body, 'standardnum');
    const chapterTitle = firstTagText(body, 'chaptertitle');
    const objidref = (body.match(/<objidref\s+objidreftype="doi">([^<]+)<\/objidref>/i) || [])[1];
    const citation = [standardnum, articleTitle || pubTitle || chapterTitle].filter(Boolean).join(' — ');
    const bucket = /^ref-norm-/i.test(id) ? normative : bibliographic;
    if (citation) bucket.push(normText(citation));
    if (objidref && parseRefId) {
      try {
        const resolved = parseRefId(objidref) || parseRefId(standardnum);
        if (resolved) referencedDocIds.add(resolved);
      } catch { /* ignore */ }
    } else if (standardnum && parseRefId) {
      try {
        const resolved = parseRefId(standardnum);
        if (resolved) referencedDocIds.add(resolved);
      } catch { /* ignore */ }
    }
  }

  return {
    containerDoi,
    normative,
    bibliographic,
    referencedDocIds: [...referencedDocIds],
  };
}

module.exports = {
  readStandardXml,
  readIssueMetadataXml,
  readRefXml,
  buildCommitteeSlugReverseIndex,
  committeeToSlug,
  mapDocTypeFromStandardXml,
  mapStatusModifier,
  decodeEntities,
  normText,
  composeDate,
};
