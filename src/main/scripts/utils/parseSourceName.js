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

// Parse a _source/SMPTE path segment (file or folder basename) into a schema-shaped identity.
// Returns { kind, docId, doi, ... } when recognisable, or null otherwise.
// Invariant: docId follows the registry convention — SMPTE-typed DOIs (10.5594/SMPTE.*) strip
// the 10.5594/ prefix; all other DOIs (including 10.5594/J##### legacy journal codes and
// foreign 10.1002/10.1016/...) are stored full-form with "/" replaced by "-".

const typeMap = {
  AG: 'Administrative Guideline',
  OM: 'Operations Manual',
  ST: 'Standard',
  RP: 'Recommended Practice',
  EG: 'Engineering Guideline',
  RDD: 'Registered Disclosure Document',
  OV: 'Overview Document',
  TSP: 'Technical Specification',
  OR: 'Operational Recommendation',
};

function doiToDocId(doi) {
  if (!doi) return null;
  const trimmed = String(doi).trim().replace(/^doi:\s*/i, '');
  const m = trimmed.match(/^(10\.\d{4,9})\/(.+)$/);
  if (!m) return null;
  const [, prefix, suffix] = m;
  if (prefix === '10.5594' && /^SMPTE\./i.test(suffix)) {
    return suffix.replace(/^SMPTE\./i, 'SMPTE.');
  }
  if (prefix === '10.5594') {
    // SMPTE convention: the suffix's leading article-id letter (J, M, S, …) is
    // canonical uppercase. APTARA delivers lowercase for some ranges, but DOI
    // resolution is case-insensitive so unsuffixed lowercase aliases resolve
    // back to the same article as their uppercase form. Normalise here.
    return `${prefix}-${suffix.replace(/^[a-z]/, (c) => c.toUpperCase())}`;
  }
  return `${prefix}-${suffix}`;
}

// Standards folder: smptes_<type>-<num>[-<part>]-<year>[_<delivery>] or smptes_<type>_<num>[-<part>]-<year>
// Also: st-337-2015, rp-2092-1-2015, rdd-26-2015, eg-9-2005 (no smptes_ prefix)
// Also accepts -amendment-<n> suffix (smptes_st-429-9-2007-amendment-1)
const STANDARD_RX = /^(?:smptes[_-])?(st|rp|eg|ag|om|tsp|rdd|or|ov)[-_](\d+[a-z]?)(?:-(\d+))?-(\d{4})(?:-amendment-(\d+))?(?:[_-]\d+)?$/i;

// Flat-file standard PDF: eg0001-1990_stable2004.pdf, st0429-9-2007_stable2015.pdf,
// st2036-1-am1-2013.pdf, st337-am1-2017.pdf, rp168v2-2007.pdf, eg10-2003_withdrawn2015.pdf,
// st0275-1995-stable2003.pdf (dash-separated suffix variant)
const FLAT_STANDARD_FILE_RX = /^(st|rp|eg|ag|om|tsp|rdd|or|ov)0*(\d+[a-z]?)(?:[-v](\d+))?(?:-am?(\d+))?-(\d{4})(?:[-_](?:stable|withdrawn)\d{4})?\.(pdf|xml)$/i;

// SMPTE Journal issue container: smptej_<vol>_<issue> and smptej_<vol>_<issue>-<issue2>
const JOURNAL_ISSUE_RX = /^smptej[_-](\d+)[_-](\d+(?:-\d+)?)$/i;

// SMPTE conference proceedings container: smptem_<year>_<num>
const CONFERENCE_RX = /^smptem[_-](\d{4})[_-](\d+)$/i;

// Allen Press / APTARA issue folder: <pageid>-mijr-<year> (e.g. 12401-mijr-2015)
const ALLEN_PRESS_ISSUE_RX = /^(\d+)-mijr-(\d{4})$/i;

// File: 10-5594_J#####.pdf OR 10.5594_J#####.pdf → DOI 10.5594/J#####
const JOURNAL_ARTICLE_FILE_RX = /^10[._-]5594[_-]([A-Za-z]?\d+[a-z]?)\.(pdf|xml)$/i;

// File: 10.5594_SMPTE.ST2036-1.2013.pdf or similar DOI-as-filename
const SMPTE_DOI_FILE_RX = /^10[._-]5594[_-](SMPTE\.[A-Z]+\d+(?:-\d+)?(?:\.\d{4}(?:-\d{2})?)?(?:Am\d+\.\d{4})?)\.(pdf|xml)$/i;

// Amendment folder variant: smptes_st-2036-1-2013am1-2015_1 style
const STANDARD_AMENDMENT_RX = /^(?:smptes[_-])?(st|rp|eg|ag|om|tsp|rdd|or|ov)[-_](\d+[a-z]?)(?:-(\d+))?-(\d{4})am(\d+)-(\d{4})(?:[_-]\d+)?$/i;

function parseStandardBase(basename) {
  const amendMatch = basename.match(STANDARD_AMENDMENT_RX);
  if (amendMatch) {
    const [, type, num, part, baseYear, amendNum, amendYear] = amendMatch;
    const pubTypeNum = `${type.toUpperCase()}${num}${part ? `-${part}` : ''}`;
    const docId = `SMPTE.${pubTypeNum}.${baseYear}Am${amendNum}.${amendYear}`;
    return {
      kind: 'standard',
      docId,
      doi: `10.5594/${docId}`,
      docType: typeMap[type.toUpperCase()] || type.toUpperCase(),
      docNumber: num,
      docPart: part,
      publicationDate: amendYear,
      releaseTag: `${baseYear}Am${amendNum}.${amendYear}`,
    };
  }

  const m = basename.match(STANDARD_RX);
  if (!m) return null;
  const [, type, num, part, year, amendmentN] = m;
  const pubTypeNum = `${type.toUpperCase()}${num}${part ? `-${part}` : ''}`;
  const docId = amendmentN
    ? `SMPTE.${pubTypeNum}.${year}Am${amendmentN}`
    : `SMPTE.${pubTypeNum}.${year}`;
  return {
    kind: 'standard',
    docId,
    doi: `10.5594/${docId}`,
    docType: typeMap[type.toUpperCase()] || type.toUpperCase(),
    docNumber: num,
    docPart: part,
    publicationDate: year,
    releaseTag: amendmentN ? `${year}Am${amendmentN}` : year,
  };
}

function parseFlatStandardFile(basename) {
  const m = basename.match(FLAT_STANDARD_FILE_RX);
  if (!m) return null;
  const [, type, num, part, amendN, year, ext] = m;
  const pubTypeNum = `${type.toUpperCase()}${num}${part ? `-${part}` : ''}`;
  const docId = amendN ? `SMPTE.${pubTypeNum}.${year}Am${amendN}` : `SMPTE.${pubTypeNum}.${year}`;
  return {
    kind: 'standard',
    docId,
    doi: `10.5594/${docId}`,
    docType: typeMap[type.toUpperCase()] || type.toUpperCase(),
    docNumber: num,
    docPart: part,
    publicationDate: year,
    releaseTag: amendN ? `${year}Am${amendN}` : year,
    fileExt: ext.toLowerCase(),
    publisher: 'SMPTE',
  };
}

function parseSourceName(basename) {
  if (!basename) return null;
  const name = String(basename).normalize('NFC').replace(/\uf028$/, '').trim();
  if (!name) return null;

  // Journal article PDF: 10-5594_J####.pdf / 10.5594_J####.pdf
  const journalFile = name.match(JOURNAL_ARTICLE_FILE_RX);
  if (journalFile) {
    const [, code, ext] = journalFile;
    const doi = `10.5594/${code}`;
    return {
      kind: 'journalArticle',
      docId: doiToDocId(doi),
      doi,
      docType: 'Journal Article',
      publisher: 'SMPTE',
      fileExt: ext.toLowerCase(),
    };
  }

  // DOI-named SMPTE file
  const smpteDoiFile = name.match(SMPTE_DOI_FILE_RX);
  if (smpteDoiFile) {
    const [, suffix, ext] = smpteDoiFile;
    const doi = `10.5594/${suffix}`;
    return {
      kind: 'standard',
      docId: doiToDocId(doi),
      doi,
      docType: 'Standard',
      publisher: 'SMPTE',
      fileExt: ext.toLowerCase(),
    };
  }

  // Flat-file standard: eg0001-1990_stable2004.pdf
  const flat = parseFlatStandardFile(name);
  if (flat) return flat;

  // Standards folder (or zip'd folder name)
  const withoutExt = name.replace(/\.(zip|pdf)$/i, '');
  const std = parseStandardBase(withoutExt);
  if (std) return { ...std, publisher: 'SMPTE' };

  // SMPTE Journal issue folder (container, not a document)
  const journalIssue = name.match(JOURNAL_ISSUE_RX);
  if (journalIssue) {
    const [, volume, issue] = journalIssue;
    return {
      kind: 'journalIssueContainer',
      volume: Number(volume),
      issue: Number(issue),
      publisher: 'SMPTE',
    };
  }

  // Conference proceedings container
  const conf = name.match(CONFERENCE_RX);
  if (conf) {
    const [, year, num] = conf;
    return {
      kind: 'conferenceContainer',
      year: Number(year),
      sequence: Number(num),
      publisher: 'SMPTE',
    };
  }

  // Allen Press / APTARA-journal issue folder
  const ap = name.match(ALLEN_PRESS_ISSUE_RX);
  if (ap) {
    const [, pageId, year] = ap;
    return {
      kind: 'allenPressIssueContainer',
      pageId,
      year: Number(year),
      publisher: 'SMPTE',
    };
  }

  return null;
}

module.exports = {
  parseSourceName,
  parseStandardBase,
  doiToDocId,
  typeMap,
};
