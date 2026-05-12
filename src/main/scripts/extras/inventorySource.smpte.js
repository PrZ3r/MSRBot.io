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

// One-shot inventory of _source/SMPTE → DOI-keyed audit report vs documents.json.
// Invocation: node src/main/scripts/extras/inventorySource.smpte.js
//
// Reports (no registry mutation):
//   src/main/reports/sourceInventory.smpte.json
//   src/main/reports/sourceInventory.smpte.md

const fs = require('fs');
const path = require('path');
const { parseSourceName, doiToDocId } = require('../utils/parseSourceName');
const {
  readStandardXml,
  readIssueMetadataXml,
  readRefXml,
  buildCommitteeSlugReverseIndex,
  committeeToSlug,
} = require('../utils/extractSourceMetadata');
const { parseRefId } = require('../../lib/referencing');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SOURCE_ROOT = path.join(REPO_ROOT, '_source', 'SMPTE');
const DOCS_JSON = path.join(REPO_ROOT, 'src', 'main', 'data', 'documents.json');
const REPORT_JSON = path.join(REPO_ROOT, 'src', 'main', 'reports', 'sourceInventory.smpte.json');
const REPORT_MD = path.join(REPO_ROOT, 'src', 'main', 'reports', 'sourceInventory.smpte.md');
const FAILED_EXTRACTIONS = path.join(SOURCE_ROOT, 'failed_extractions.txt');

const VENDORS = {
  'ALLEN PRESS': 'allen_press',
  'APTARA': 'aptara',
  'HIGHWIRE': 'highwire',
  'IEEE': 'ieee',
  'IEEE DL Usage Data': 'ieee_dl_usage',
  'Zoho': 'zoho',
};

const NOISE_NAMES = new Set(['.DS_Store', '__MACOSX', 'Thumbs.db']);
const NOISE_EXT_NON_RECORD = new Set(['.xlsx', '.xls', '.csv', '.docx', '.doc', '.textclipping']);
const NON_RECORD_REASONS = {
  '.xlsx': 'spreadsheet',
  '.xls': 'spreadsheet',
  '.csv': 'spreadsheet',
  '.docx': 'word doc',
  '.doc': 'word doc',
  '.textclipping': 'macOS text clipping',
  '.xsd': 'XML schema (no surrounding doc folder)',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.tif': 'image',
  '.tiff': 'image',
  '.gif': 'image',
};

const FIELDS_FOR_UPDATE = [
  'docTitle', 'docLabel', 'abstract', 'docType', 'publisher', 'publicationDate',
  'docNumber', 'docPart', 'doi', 'isbn', 'issn', 'group', 'pages', 'authors',
  'keywords', 'docSuite', 'standardId', 'productNumber', 'familyId',
  'approvalDate', 'abbrevTitle', 'journalAcronym', 'articleType', 'copyright',
  'publisherLocation', 'icsCodes', 'volume', 'number', 'references',
];

function readFailedExtractions() {
  if (!fs.existsSync(FAILED_EXTRACTIONS)) return new Set();
  const raw = fs.readFileSync(FAILED_EXTRACTIONS, 'utf8');
  const basenames = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    basenames.add(path.basename(t));
  }
  return basenames;
}

function detectVendor(absPath) {
  const rel = path.relative(SOURCE_ROOT, absPath);
  const first = rel.split(path.sep)[0];
  return VENDORS[first] || null;
}

function relFromRepo(absPath) {
  return path.relative(REPO_ROOT, absPath);
}

// Allen Press / APTARA journal issue-metadata: builds fileBase → {doi, title, authors} map.
function parseIssueMetadataXml(xmlPath) {
  try {
    const txt = fs.readFileSync(xmlPath, 'utf8');
    const articles = [];
    const rx = /<journal_article[\s\S]*?<\/journal_article>/gi;
    const matches = txt.match(rx) || [];
    for (const block of matches) {
      const file = (block.match(/<file>([^<]+)<\/file>/i) || [])[1];
      const doi = (block.match(/<doi>([^<]+)<\/doi>/i) || [])[1];
      const title = (block.match(/<title>([^<]+)<\/title>/i) || [])[1];
      if (file && doi) {
        articles.push({ file: file.trim(), doi: doi.trim(), title: title ? title.trim() : null });
      }
    }
    return articles;
  } catch (_) {
    return [];
  }
}

class Report {
  constructor() {
    this.stats = {
      filesScanned: 0,
      dirsScanned: 0,
      filesSkipped: { failedExtraction: 0, zipContainers: 0, noise: 0 },
    };
    this.byDocId = new Map(); // docId → { doi, kind, docType, publisher, sourcePaths:[], vendorCounts:{}, sampleMeta:{} }
    this.unidentifiable = [];
    this.nonRecord = [];
  }

  addRecord(identity, absPath, vendor) {
    const { docId, doi } = identity;
    if (!docId) return;
    let bucket = this.byDocId.get(docId);
    if (!bucket) {
      bucket = {
        docId,
        doi,
        kind: identity.kind,
        docType: identity.docType || null,
        publisher: identity.publisher || 'SMPTE',
        docNumber: identity.docNumber || null,
        docPart: identity.docPart || null,
        publicationDate: identity.publicationDate || null,
        releaseTag: identity.releaseTag || null,
        sampleTitle: identity.title || null,
        sourcePaths: [],
        vendorCounts: {},
      };
      this.byDocId.set(docId, bucket);
    }
    bucket.sourcePaths.push(relFromRepo(absPath));
    bucket.vendorCounts[vendor] = (bucket.vendorCounts[vendor] || 0) + 1;
    if (!bucket.sampleTitle && identity.title) bucket.sampleTitle = identity.title;
  }

  addUnidentifiable(absPath, reason) {
    this.unidentifiable.push({ path: relFromRepo(absPath), reason });
  }

  addNonRecord(absPath, reason) {
    this.nonRecord.push({ path: relFromRepo(absPath), reason });
  }
}

const CONTAINER_KINDS = new Set(['journalIssueContainer', 'conferenceContainer', 'allenPressIssueContainer']);

function walk(dir, report, ctx, failedExtractionBasenames) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    report.addNonRecord(dir, `unreadable directory: ${err.code || err.message}`);
    return;
  }
  report.stats.dirsScanned++;

  // Detect if this directory itself is a container (journal issue / conference / allen-press issue).
  const dirIdentity = parseSourceName(path.basename(dir));
  const insideContainer = ctx.insideContainer || (dirIdentity && CONTAINER_KINDS.has(dirIdentity.kind));
  const insideStandard = ctx.insideStandard || (dirIdentity && dirIdentity.kind === 'standard');

  // If an Allen Press issue-metadata.xml exists here, preload its PDF→DOI map.
  const issueMetaEntry = entries.find((e) => e.isFile() && /-issue-metadata\.xml$/i.test(e.name));
  let pdfDoiMap = ctx.pdfDoiMap;
  if (issueMetaEntry) {
    const articles = parseIssueMetadataXml(path.join(dir, issueMetaEntry.name));
    if (articles.length) {
      pdfDoiMap = new Map();
      for (const art of articles) {
        pdfDoiMap.set(art.file, { doi: art.doi, title: art.title });
      }
    }
  }

  for (const entry of entries) {
    const entryName = entry.name;
    if (NOISE_NAMES.has(entryName)) {
      report.stats.filesSkipped.noise++;
      continue;
    }
    const abs = path.join(dir, entryName);
    const vendor = detectVendor(abs) || 'unknown';

    if (entry.isDirectory()) {
      // Skip __MACOSX subtrees
      if (entryName === '__MACOSX') {
        report.stats.filesSkipped.noise++;
        continue;
      }
      // Directory itself may be a documental leaf (standard folder). Attempt identity.
      const identity = parseSourceName(entryName);
      if (identity && (identity.kind === 'standard')) {
        report.addRecord(identity, abs, vendor);
      }
      // Recurse regardless — standards have nested payloads we want to count,
      // and containers (journalIssue/conference/allenPress) expose article files inside.
      const childCtx = {
        pdfDoiMap,
        insideContainer: insideContainer || (identity && CONTAINER_KINDS.has(identity.kind)),
        insideStandard: insideStandard || (identity && identity.kind === 'standard'),
      };
      walk(abs, report, childCtx, failedExtractionBasenames);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    report.stats.filesScanned++;

    if (failedExtractionBasenames.has(entryName)) {
      report.stats.filesSkipped.failedExtraction++;
      continue;
    }

    const lowerName = entryName.toLowerCase();
    const ext = path.extname(lowerName);

    if (ext === '.zip') {
      report.stats.filesSkipped.zipContainers++;
      continue;
    }

    // 1. DOI-encoded filename match (journal article / smpte doc).
    //    Skip if we're already inside a recognised standard folder — the file is payload of the parent record.
    const nameIdentity = parseSourceName(entryName);
    if (nameIdentity && nameIdentity.docId) {
      if (insideStandard) continue; // payload of the enclosing standard folder
      report.addRecord(nameIdentity, abs, vendor);
      continue;
    }

    // 2. PDF with an issue-metadata sibling DOI map
    if (ext === '.pdf' && pdfDoiMap && pdfDoiMap.has(entryName)) {
      const { doi, title } = pdfDoiMap.get(entryName);
      const docId = doiToDocId(doi);
      if (docId) {
        report.addRecord(
          {
            kind: 'journalArticle',
            docId,
            doi,
            docType: 'Journal Article',
            publisher: 'SMPTE',
            title,
          },
          abs,
          vendor
        );
        continue;
      }
    }

    // 3. Structural non-records
    if (NOISE_EXT_NON_RECORD.has(ext) || ext === '.xsd' || ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.tif' || ext === '.tiff' || ext === '.gif') {
      report.addNonRecord(abs, NON_RECORD_REASONS[ext] || `structural file type ${ext}`);
      continue;
    }

    // 4. XML / schema / ref / misc files inside a known container or standard: support content, not a record.
    const SUPPORT_EXTS = new Set(['.xml', '.dtd', '.txt', '.xsl', '.wsdl', '.xsd', '.xsx', '.html', '.css', '.js']);
    if (SUPPORT_EXTS.has(ext)) {
      if (insideStandard || insideContainer || dirIdentity) continue; // supporting file under a known parent — silent
      report.addNonRecord(abs, `support file (${ext}) with no recognised parent`);
      continue;
    }

    // 5. PDFs without DOI filename or sibling metadata:
    //    - inside a standard → payload of the standard (already recorded via folder)
    //    - inside a journal/conference/issue container → non-record (cover, TOC, completeissue, ed_board, etc.)
    //    - standalone journal support filename → non-record regardless of container detection
    //    - elsewhere → unidentifiable
    if (ext === '.pdf') {
      if (insideStandard) continue;
      if (insideContainer) {
        report.addNonRecord(abs, 'issue/conference support PDF (cover, TOC, complete-issue, etc.)');
        continue;
      }
      const lowerBase = path.basename(lowerName, ext);
      if (/^(toc(\.\d+)?|cover|bookcover|ed_board|advertising|masthead|frontmatter|backmatter|front_matter|back_matter|complete_issue|completeissue|allissues)$/.test(lowerBase) || /completeissue$/.test(lowerBase)) {
        report.addNonRecord(abs, 'journal issue support PDF (filename-based)');
        continue;
      }
      if (/^i\d/.test(lowerBase) || /^mijr-/.test(lowerBase)) {
        report.addNonRecord(abs, 'ISSN/journal-article PDF without DOI metadata (legacy source, unresolvable)');
        continue;
      }
      report.addUnidentifiable(abs, 'PDF with no DOI filename and no resolvable sibling metadata');
      continue;
    }

    // 6. Known non-record extensions even in edge locations
    if (['.log', '.tgz', '.tar', '.gz', '.pptx', '.ppt', '.key', '.pages', ''].includes(ext)) {
      report.addNonRecord(abs, `non-document file (${ext || 'no extension'})`);
      continue;
    }

    // 7. Fallback
    report.addUnidentifiable(abs, `unclassified (ext=${ext || 'none'})`);
  }

}

// --- DOI reconciliation + XML enrichment passes ----------------------------

const xmlCache = new Map();

function cacheGet(key, factory) {
  if (xmlCache.has(key)) return xmlCache.get(key);
  const v = factory();
  xmlCache.set(key, v);
  return v;
}

function listDirSafe(absPath) {
  try { return fs.readdirSync(absPath); } catch { return []; }
}

// Given one of a bucket's sourcePaths, return { kind, stdXml?, refXml?, issueXml?, articleFile? }
// Critical: only use sibling files that share the same stem as the source path. Never grab
// an arbitrary XML from a shared batch directory (multiple unrelated docs live side by side).
function locateXmlForSourcePath(absSourcePath, bucket) {
  if (!fs.existsSync(absSourcePath)) return null;
  const stat = fs.statSync(absSourcePath);

  if (stat.isFile()) {
    const dir = path.dirname(absSourcePath);
    const base = path.basename(absSourcePath);
    const stem = base.replace(/\.[^.]+$/, '');
    const ext = path.extname(base).toLowerCase();

    if (bucket.kind === 'standard') {
      // Flat-file standard. The XML for THIS doc shares the stem.
      let stdXml = null;
      let refXml = null;
      if (ext === '.xml') {
        stdXml = absSourcePath;
        const sibRef = path.join(dir, stem + '-ref.xml');
        if (fs.existsSync(sibRef)) refXml = sibRef;
      } else {
        // .pdf or other — look for stem-named .xml / -ref.xml siblings only
        const sibStd = path.join(dir, stem + '.xml');
        const sibRef = path.join(dir, stem + '-ref.xml');
        if (fs.existsSync(sibStd)) stdXml = sibStd;
        if (fs.existsSync(sibRef)) refXml = sibRef;
      }
      if (stdXml || refXml) return { kind: 'standard', stdXml, refXml };
      return null;
    }

    // Journal article PDF: sibling -ref.xml in same dir
    const sibRef = path.join(dir, stem + '-ref.xml');
    if (fs.existsSync(sibRef)) {
      // Also check for an Allen Press issue-metadata sibling for richer metadata
      const issueXml = listDirSafe(dir).find((e) => /-issue-metadata\.xml$/i.test(e));
      return {
        kind: 'journalArticle',
        refXml: sibRef,
        issueXml: issueXml ? path.join(dir, issueXml) : null,
        articleFile: base,
      };
    }
    // Allen Press article: only issue-metadata, no per-article ref
    const issueXml = listDirSafe(dir).find((e) => /-issue-metadata\.xml$/i.test(e));
    if (issueXml) return { kind: 'journalArticle', issueXml: path.join(dir, issueXml), articleFile: base };
    return null;
  }

  // Directory (standard folder) — exactly one std XML expected
  const entries = listDirSafe(absSourcePath);
  const stdXml = entries.find((e) => /\.xml$/i.test(e) && !/-ref\.xml$/i.test(e) && !/-issue-metadata\.xml$/i.test(e));
  const refXml = entries.find((e) => /-ref\.xml$/i.test(e));
  if (stdXml || refXml) {
    return {
      kind: 'standard',
      stdXml: stdXml ? path.join(absSourcePath, stdXml) : null,
      refXml: refXml ? path.join(absSourcePath, refXml) : null,
    };
  }
  return null;
}

function pickBestSourcePath(bucket) {
  // Prefer paths NOT under "Standards Copy"; otherwise first
  const nonCopy = bucket.sourcePaths.find((p) => !p.includes('Standards Copy'));
  return path.join(REPO_ROOT, nonCopy || bucket.sourcePaths[0]);
}

function gatherXmlForBucket(bucket) {
  for (const sp of bucket.sourcePaths) {
    const located = locateXmlForSourcePath(path.join(REPO_ROOT, sp), bucket);
    if (located) return located;
  }
  // Fallback: best path regardless
  return locateXmlForSourcePath(pickBestSourcePath(bucket), bucket);
}

function extractFromLocatedXml(located) {
  if (!located) return { merged: null, xmlPaths: [] };
  const xmlPaths = [];
  const merged = {};

  if (located.kind === 'standard') {
    if (located.stdXml) {
      const r = cacheGet('std:' + located.stdXml, () => readStandardXml(located.stdXml));
      if (r) Object.assign(merged, r);
      xmlPaths.push(located.stdXml);
    }
    if (located.refXml) {
      const r = cacheGet('ref:' + located.refXml, () => readRefXml(located.refXml, parseRefId));
      if (r) {
        if (r.containerDoi && !merged.doi) merged.doi = r.containerDoi;
        if (r.containerDoi && merged.doi && r.containerDoi !== merged.doi) {
          // Ref's DOI is a valid alias for this doc — capture it
          merged.refContainerDoi = r.containerDoi;
          merged.refDoiAlias = r.containerDoi;
        }
        const refs = {};
        if (r.normative.length) refs.normative = r.normative;
        if (r.bibliographic.length) refs.bibliographic = r.bibliographic;
        if (r.referencedDocIds.length) merged.referencedDocIds = r.referencedDocIds;
        if (Object.keys(refs).length) merged.references = refs;
      }
      xmlPaths.push(located.refXml);
    }
  } else if (located.kind === 'journalArticle') {
    if (located.issueXml) {
      const issue = cacheGet('issue:' + located.issueXml, () => readIssueMetadataXml(located.issueXml));
      if (issue) {
        const article = located.articleFile ? issue.articles.get(located.articleFile) : null;
        if (article) {
          if (article.doi) merged.doi = article.doi;
          if (article.docTitle) merged.docTitle = article.docTitle;
          if (article.authors) merged.authors = article.authors;
          if (article.pages) merged.pages = article.pages;
          if (article.keywords) merged.keywords = article.keywords;
          if (article.articleType) merged.articleType = article.articleType;
          if (article.articleStatus) merged.articleStatus = article.articleStatus;
          if (article.abstract) merged.abstract = article.abstract;
        }
        if (issue.journalSuite) {
          const s = issue.journalSuite;
          if (s.fullTitle) merged.docSuite = s.fullTitle;
          if (s.abbrevTitle) merged.abbrevTitle = s.abbrevTitle;
          if (s.journalAcronym) merged.journalAcronym = s.journalAcronym;
          if (s.issn) merged.issn = s.issn;
          if (s.publisher) merged.publisher = s.publisher;
          if (s.publisherLocation) merged.publisherLocation = s.publisherLocation;
          if (s.copyright) merged.copyright = s.copyright;
        }
        if (issue.issueVolume) merged.volume = issue.issueVolume;
        if (issue.issueNumber) merged.number = issue.issueNumber;
        if (issue.issuePublicationDate) merged.publicationDate = issue.issuePublicationDate;
      }
      xmlPaths.push(located.issueXml);
    }
    if (located.refXml) {
      const r = cacheGet('ref:' + located.refXml, () => readRefXml(located.refXml, parseRefId));
      if (r) {
        if (r.containerDoi && !merged.doi) merged.doi = r.containerDoi;
        const refs = {};
        if (r.normative.length) refs.normative = r.normative;
        if (r.bibliographic.length) refs.bibliographic = r.bibliographic;
        if (r.referencedDocIds.length) merged.referencedDocIds = r.referencedDocIds;
        if (Object.keys(refs).length) merged.references = refs;
      }
      xmlPaths.push(located.refXml);
    }
  }

  return { merged, xmlPaths };
}

function reconcileAndEnrich(report, committeeIdx) {
  const reconciliation = []; // doiReconciliation[]
  const conflicts = [];      // conflicts[]
  const reconciledByDocId = new Map();

  // First pass: extract XML for every bucket and propose reconciliations.
  // Then detect collision (multiple distinct name-derived docIds → same XML DOI),
  // which signals the XML DOI is collection-level / bogus. Revert those.
  const proposed = []; // [{ bucket, located, merged, xmlPaths, proposedXmlDoi }]
  for (const bucket of report.byDocId.values()) {
    const located = gatherXmlForBucket(bucket);
    const { merged, xmlPaths } = extractFromLocatedXml(located);
    bucket.xmlData = merged;
    bucket.xmlPaths = xmlPaths;
    proposed.push({ bucket, merged, xmlPaths });
  }

  // Detect bogus DOIs (assigned to >1 distinct name-derived docIds)
  const xmlDoiAssignees = new Map(); // xmlDoi → Set<nameDerivedDocId>
  for (const { bucket, merged } of proposed) {
    if (!merged || !merged.doi) continue;
    if (merged.doi === bucket.doi) continue;
    const key = merged.doi;
    if (!xmlDoiAssignees.has(key)) xmlDoiAssignees.set(key, new Set());
    xmlDoiAssignees.get(key).add(bucket.docId);
  }
  const bogusXmlDois = new Set();
  for (const [doi, set] of xmlDoiAssignees.entries()) {
    if (set.size > 1) bogusXmlDois.add(doi);
  }
  if (bogusXmlDois.size) {
    console.warn(`Detected ${bogusXmlDois.size} bogus collection-level DOI(s) in source XML — reverting affected buckets.`);
  }

  const mergeBuckets = (target, src) => {
    target.sourcePaths.push(...src.sourcePaths);
    for (const [v, n] of Object.entries(src.vendorCounts)) {
      target.vendorCounts[v] = (target.vendorCounts[v] || 0) + n;
    }
    if (!target.sampleTitle && src.sampleTitle) target.sampleTitle = src.sampleTitle;
    target.doiAliases = target.doiAliases || [];
    if (src.docId !== target.docId && !target.doiAliases.includes(src.doi)) target.doiAliases.push(src.doi);
  };

  for (const { bucket, merged, xmlPaths } of proposed) {
    // DOI reconciliation
    let outcome = 'agree';
    let reconciledDocId = bucket.docId;
    let reconciledDoi = bucket.doi;

    if (!merged || !merged.doi) {
      outcome = 'xmlMissing';
    } else if (merged.doi === bucket.doi) {
      outcome = 'agree';
    } else if (bogusXmlDois.has(merged.doi)) {
      // Collision-detected bogus DOI (collection-level, used for many docs) → revert
      outcome = 'xmlBogus';
    } else {
      // Disagreement — XML wins
      const xmlDocId = doiToDocId(merged.doi);
      if (!xmlDocId) {
        outcome = 'xmlMissing';
      } else {
        // Categorize the disagreement
        const nameYearM = bucket.doi.match(/(\d{4})$/);
        const xmlYearM = merged.doi.match(/(\d{4})$/);
        if (nameYearM && xmlYearM && bucket.doi.replace(/\d{4}$/, '') === merged.doi.replace(/\d{4}$/, '')) {
          outcome = 'xmlWins:year';
        } else if (/SMPTE\./i.test(bucket.doi) !== /SMPTE\./i.test(merged.doi)) {
          outcome = 'xmlWins:scheme';
        } else {
          outcome = 'xmlWins:other';
        }
        reconciledDocId = xmlDocId;
        reconciledDoi = merged.doi;
      }
    }

    if (outcome.startsWith('xmlWins') || outcome === 'xmlMissing' || outcome === 'xmlBogus') {
      const xmlBogusDoi = outcome === 'xmlBogus' ? merged.doi : null;
      reconciliation.push({
        outcome,
        nameDerivedDocId: bucket.docId,
        nameDerivedDoi: bucket.doi,
        reconciledDocId: (outcome === 'xmlMissing' || outcome === 'xmlBogus') ? bucket.docId : reconciledDocId,
        reconciledDoi: (outcome === 'xmlMissing' || outcome === 'xmlBogus') ? bucket.doi : reconciledDoi,
        xmlBogusDoi,
        xmlSourcePath: xmlPaths[0] ? path.relative(REPO_ROOT, xmlPaths[0]) : null,
      });
      // For xmlBogus, also remove the bogus DOI from the merged extraction so we don't
      // accidentally use it downstream as the doc's doi.
      if (outcome === 'xmlBogus' && merged) merged.doi = null;
    }

    // Year-drift conflict log (independent of DOI reconciliation outcome)
    const folderYearM = bucket.sourcePaths[0] && bucket.sourcePaths[0].match(/-(\d{4})(?:[_-]|$)/);
    const folderYear = folderYearM ? folderYearM[1] : null;
    const doiYearM = (reconciledDoi || '').match(/(\d{4})(?:Am\d+\.\d{4})?$/);
    const doiYear = doiYearM ? doiYearM[1] : null;
    const pubYear = merged && merged.publicationDate ? merged.publicationDate.slice(0, 4) : null;
    const yearsSeen = new Set([folderYear, doiYear, pubYear].filter(Boolean));
    if (yearsSeen.size > 1) {
      conflicts.push({
        docId: reconciledDocId,
        field: 'year',
        folderYear,
        doiYear,
        publicationDateYear: pubYear,
        xmlSourcePath: xmlPaths[0] ? path.relative(REPO_ROOT, xmlPaths[0]) : null,
      });
    }

    // Field conflicts (XML vs name) for non-DOI fields
    if (merged) {
      if (merged.docType && bucket.docType && merged.docType !== bucket.docType) {
        conflicts.push({
          docId: reconciledDocId,
          field: 'docType',
          nameDerived: bucket.docType,
          xmlDerived: merged.docType,
          xmlSourcePath: xmlPaths[0] ? path.relative(REPO_ROOT, xmlPaths[0]) : null,
          winner: 'xmlDerived',
        });
      }
    }

    // Resolve committee → group slug
    if (merged && merged.committee) {
      const slug = committeeToSlug(merged.committee, committeeIdx);
      if (slug) {
        merged.group = slug.slug;
        merged.groupReviewRequired = slug.reviewRequired;
      }
    }

    // Re-key into reconciledByDocId
    bucket.reconciledOutcome = outcome;
    if (outcome.startsWith('xmlWins')) {
      bucket.docId = reconciledDocId;
      bucket.doi = reconciledDoi;
    }
    // Promote refContainerDoi to doiAliases when the ref's DOI is different from the chosen DOI
    if (merged && merged.refDoiAlias && merged.refDoiAlias !== bucket.doi) {
      bucket.doiAliases = bucket.doiAliases || [];
      if (!bucket.doiAliases.includes(merged.refDoiAlias)) bucket.doiAliases.push(merged.refDoiAlias);
    }
    const existing = reconciledByDocId.get(bucket.docId);
    if (existing) {
      mergeBuckets(existing, bucket);
    } else {
      reconciledByDocId.set(bucket.docId, bucket);
    }
  }

  report.byDocId = reconciledByDocId;
  return { reconciliation, conflicts };
}

function loadRegistry() {
  const raw = fs.readFileSync(DOCS_JSON, 'utf8');
  const arr = JSON.parse(raw);
  const byId = new Map();
  for (const doc of arr) {
    if (doc && doc.docId) byId.set(doc.docId, doc);
  }
  return { all: arr, byId };
}

// Merge the bucket's name-derived identity with its xmlData. XML wins where present.
function mergedView(bucket) {
  const x = bucket.xmlData || {};
  return {
    docId: bucket.docId,
    doi: bucket.doi,
    docType: x.docType || bucket.docType,
    docTitle: x.docTitle || bucket.sampleTitle || null,
    docLabel: x.docLabel || null,
    abstract: x.abstract || null,
    docNumber: bucket.docNumber || x.docNumber || null,
    docPart: bucket.docPart || null,
    docSuite: x.docSuite || null,
    publisher: x.publisher || bucket.publisher || 'SMPTE',
    publicationDate: x.publicationDate || bucket.publicationDate || null,
    releaseTag: bucket.releaseTag || null,
    isbn: x.isbn || null,
    issn: x.issn || null,
    group: x.group || null,
    pages: x.pages || null,
    authors: x.authors || null,
    keywords: x.keywords || null,
    standardId: x.standardId || null,
    productNumber: x.productNumber || null,
    familyId: x.familyId || null,
    approvalDate: x.approvalDate || null,
    abbrevTitle: x.abbrevTitle || null,
    journalAcronym: x.journalAcronym || null,
    articleType: x.articleType || null,
    copyright: x.copyright || null,
    publisherLocation: x.publisherLocation || null,
    icsCodes: x.icsCodes || null,
    volume: x.volume || null,
    number: x.number || null,
    references: x.references || null,
    statusFlags: x.statusFlags || null,
    referencedDocIds: x.referencedDocIds || null,
    doiAliases: bucket.doiAliases || null,
    groupReviewRequired: x.groupReviewRequired || false,
  };
}

function isEmpty(v) {
  return v === undefined || v === null || v === ''
    || (Array.isArray(v) && v.length === 0)
    || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
}

function classifyAgainstRegistry(report, registry) {
  const found = [];
  const update = [];
  const gap = [];

  for (const [docId, bucket] of report.byDocId.entries()) {
    const existing = registry.byId.get(docId);
    const view = mergedView(bucket);

    if (!existing) {
      const candidateRecord = buildCandidateRecord(view, bucket);
      const xmlPathCount = (bucket.xmlPaths || []).length;
      const enrichmentLevel = view.docTitle && xmlPathCount > 0 ? 'full' : (xmlPathCount > 0 ? 'partial' : 'name-only');
      gap.push({
        docId,
        doi: bucket.doi,
        doiAliases: bucket.doiAliases || undefined,
        enrichmentLevel,
        candidateRecord,
        sourcePaths: bucket.sourcePaths,
        sourceXmlPaths: (bucket.xmlPaths || []).map((p) => path.relative(REPO_ROOT, p)),
        vendors: bucket.vendorCounts,
      });
      continue;
    }

    const fillable = [];
    for (const field of FIELDS_FOR_UPDATE) {
      const cur = existing[field];
      const proposed = view[field];
      if (!isEmpty(proposed) && isEmpty(cur)) {
        fillable.push({ field, currentValue: cur === undefined ? null : cur, proposedValue: proposed });
      }
    }
    if (fillable.length) {
      update.push({
        docId,
        doi: bucket.doi,
        fillableFields: fillable,
        sourcePaths: bucket.sourcePaths,
        sourceXmlPaths: (bucket.xmlPaths || []).map((p) => path.relative(REPO_ROOT, p)),
        vendors: bucket.vendorCounts,
      });
    } else {
      found.push({
        docId,
        doi: bucket.doi,
        sourcePaths: bucket.sourcePaths,
        vendors: bucket.vendorCounts,
      });
    }
  }

  // registryOnly: SMPTE-published docs indexed but not seen in source
  const registryOnly = [];
  for (const doc of registry.all) {
    if (!doc || !doc.docId) continue;
    if ((doc.publisher || '').toUpperCase() !== 'SMPTE') continue;
    if (report.byDocId.has(doc.docId)) continue;
    registryOnly.push({
      docId: doc.docId,
      doi: doc.doi || null,
      publisher: doc.publisher,
      href: doc.href || null,
    });
  }

  return { found, update, gap, registryOnly };
}

function deriveDocLabel(view, bucket) {
  if (view.docLabel) return view.docLabel;
  // Try to compose from publisher + docNumber + part + year
  if (view.docType && view.docNumber) {
    const part = view.docPart ? `-${view.docPart}` : '';
    const year = (view.publicationDate || '').slice(0, 4);
    return `${view.publisher || 'SMPTE'} ${view.docType.replace(/^./, c => c.toUpperCase())} ${view.docNumber}${part}${year ? ':' + year : ''}`.trim();
  }
  return view.doi || view.docId;
}

function defaultStatus(view) {
  const s = { active: true, latestVersion: true };
  if (view.statusFlags) Object.assign(s, view.statusFlags);
  return s;
}

function buildCandidateRecord(view, bucket) {
  const now = new Date().toISOString();
  const xmlPath = (bucket.xmlPaths && bucket.xmlPaths[0]) ? path.relative(REPO_ROOT, bucket.xmlPaths[0]) : null;
  const inferredMeta = (note) => ({ source: 'inferred', confidence: 'medium', note, updated: now });
  const parsedMeta = (note) => ({ source: 'parsed', confidence: 'high', note: xmlPath ? `${note} (from ${xmlPath})` : note, updated: now });
  const placeholderMeta = (note) => ({ source: 'inferred', confidence: 'low', note, updated: now, reviewRequired: true });
  const xml = bucket.xmlData || {};

  const rec = {
    docId: view.docId,
    docId$meta: { ...inferredMeta('Calculated from reconciled DOI'), confidence: 'high' },
    doi: view.doi,
    doi$meta: bucket.reconciledOutcome && bucket.reconciledOutcome.startsWith('xmlWins')
      ? parsedMeta('DOI taken from sibling XML; name-derived form retained in doiAliases')
      : inferredMeta('Constructed from name + DOI rule'),
    publisher: view.publisher || 'SMPTE',
    publisher$meta: xml.publisher ? parsedMeta('Parsed from publisher_name') : { ...inferredMeta('Static: provider'), confidence: 'high' },
  };

  // Always-fielded basics
  if (view.docType) rec.docType = view.docType, rec.docType$meta = xml.docType ? parsedMeta('Mapped from standard_type/standard_subtype') : inferredMeta('Inferred from release folder name');
  if (view.docNumber) rec.docNumber = view.docNumber, rec.docNumber$meta = xml.docNumber ? parsedMeta('Parsed from <root>') : inferredMeta('Inferred from root folder name');
  if (view.docPart) rec.docPart = view.docPart, rec.docPart$meta = inferredMeta('Inferred from root folder name');
  if (view.publicationDate) rec.publicationDate = view.publicationDate, rec.publicationDate$meta = xml.publicationDate ? parsedMeta('Parsed from publication_date') : inferredMeta('Inferred from release folder name');
  if (view.releaseTag) rec.releaseTag = view.releaseTag, rec.releaseTag$meta = { ...inferredMeta('Release tag inferred from source folder name'), confidence: 'high' };

  // Required-by-schema fields with placeholder fallbacks (so candidateRecord validates).
  // Title: use parsed if available; otherwise placeholder + reviewRequired.
  if (view.docTitle) {
    rec.docTitle = view.docTitle; rec.docTitle$meta = parsedMeta('Parsed from <title>');
  } else {
    rec.docTitle = `(metadata unavailable for ${view.docId})`;
    rec.docTitle$meta = placeholderMeta('No sibling XML found — title needs manual lookup');
  }
  // Label: parsed or composed.
  if (view.docLabel) {
    rec.docLabel = view.docLabel; rec.docLabel$meta = parsedMeta('Parsed from normalized_title');
  } else {
    rec.docLabel = deriveDocLabel(view, bucket);
    rec.docLabel$meta = inferredMeta('Composed from publisher + type + number + year');
  }
  // Status: required object — inject sensible defaults if XML didn't supply.
  rec.status = defaultStatus(view);
  rec.status$meta = view.statusFlags ? parsedMeta('Mapped from standard_status / standard_modifier') : inferredMeta('Default status (active, latestVersion) for newly-discovered SMPTE doc');
  // docTitle / docLabel already handled above.
  if (view.docSuite) rec.docSuite = view.docSuite, rec.docSuite$meta = parsedMeta('Parsed from root_title / journal full_title');
  if (view.abstract) rec.abstract = view.abstract, rec.abstract$meta = parsedMeta('Parsed from <abstract>');
  if (view.isbn) rec.isbn = view.isbn, rec.isbn$meta = parsedMeta('Parsed from <isbn>');
  if (view.issn) rec.issn = view.issn, rec.issn$meta = parsedMeta('Parsed from <issn> (print/electronic)');
  if (view.group) {
    rec.group = view.group;
    rec.group$meta = view.groupReviewRequired
      ? { ...parsedMeta('Slug guessed from sponsor/committee — confirm against group registry'), confidence: 'low', reviewRequired: true }
      : parsedMeta('Mapped from sponsor/committee via registry slug index');
  }
  if (view.pages) rec.pages = view.pages, rec.pages$meta = parsedMeta('Parsed from pages first_page/last_page');
  if (view.authors) rec.authors = view.authors, rec.authors$meta = parsedMeta('Parsed from contributors/author/person_name');
  if (view.keywords) rec.keywords = view.keywords, rec.keywords$meta = parsedMeta('Parsed from topical browse + standard topics + major/minor topic');
  if (view.standardId) rec.standardId = view.standardId, rec.standardId$meta = parsedMeta('Parsed from <standard_id>');
  if (view.productNumber) rec.productNumber = view.productNumber, rec.productNumber$meta = parsedMeta('Parsed from <product_number>');
  if (view.familyId) rec.familyId = view.familyId, rec.familyId$meta = parsedMeta('Parsed from <family>');
  if (view.approvalDate) rec.approvalDate = view.approvalDate, rec.approvalDate$meta = parsedMeta('Parsed from <approval_date>');
  if (view.abbrevTitle) rec.abbrevTitle = view.abbrevTitle, rec.abbrevTitle$meta = parsedMeta('Parsed from journal_metadata/abbrev_title');
  if (view.journalAcronym) rec.journalAcronym = view.journalAcronym, rec.journalAcronym$meta = parsedMeta('Parsed from journal_metadata/journal_acronym');
  if (view.articleType) rec.articleType = view.articleType, rec.articleType$meta = parsedMeta('Parsed from journal_article/pubitype@type');
  if (view.copyright) rec.copyright = view.copyright, rec.copyright$meta = parsedMeta('Parsed from <copyright>');
  if (view.publisherLocation) rec.publisherLocation = view.publisherLocation, rec.publisherLocation$meta = parsedMeta('Parsed from publisher_location');
  if (view.icsCodes) rec.icsCodes = view.icsCodes, rec.icsCodes$meta = parsedMeta('Parsed from ICS_codes/code_term');
  if (view.volume) rec.volume = view.volume, rec.volume$meta = parsedMeta('Parsed from journal_volume/volume');
  if (view.number) rec.number = view.number, rec.number$meta = parsedMeta('Parsed from journal_volume/issue');

  if (view.references) {
    rec.references = view.references;
    rec.references$meta = parsedMeta('Parsed from sibling -ref.xml');
  }

  // status already handled above with defaults
  if (view.doiAliases && view.doiAliases.length) {
    rec.doiAliases = view.doiAliases;
    rec.doiAliases$meta = parsedMeta('Name-derived DOI form(s) preserved as alias after XML reconciliation');
  }

  return rec;
}

function summarise(report, buckets) {
  const byBucket = {
    found: buckets.found.length,
    update: buckets.update.length,
    gap: buckets.gap.length,
    registryOnly: buckets.registryOnly.length,
    unidentifiable: report.unidentifiable.length,
    nonRecord: report.nonRecord.length,
  };
  const uniqueAssets = report.byDocId.size;
  let duplicateCopies = 0;
  for (const b of report.byDocId.values()) {
    if (b.sourcePaths.length > 1) duplicateCopies += b.sourcePaths.length - 1;
  }

  const byVendor = {};
  for (const v of Object.values(VENDORS)) {
    byVendor[v] = { scanned: 0, found: 0, update: 0, gap: 0, unidentifiable: 0, nonRecord: 0 };
  }
  const addVendor = (bucketList, key) => {
    for (const b of bucketList) {
      for (const [v, n] of Object.entries(b.vendors || {})) {
        if (!byVendor[v]) continue;
        byVendor[v][key] += n;
      }
    }
  };
  addVendor(buckets.found, 'found');
  addVendor(buckets.update, 'update');
  addVendor(buckets.gap, 'gap');
  for (const u of report.unidentifiable) {
    const vendor = detectVendor(path.join(REPO_ROOT, u.path));
    if (vendor && byVendor[vendor]) byVendor[vendor].unidentifiable++;
  }
  for (const n of report.nonRecord) {
    const vendor = detectVendor(path.join(REPO_ROOT, n.path));
    if (vendor && byVendor[vendor]) byVendor[vendor].nonRecord++;
  }

  const topDuplicates = [...report.byDocId.values()]
    .filter((b) => b.sourcePaths.length > 1)
    .sort((a, b) => b.sourcePaths.length - a.sourcePaths.length)
    .slice(0, 25)
    .map((b) => ({ docId: b.docId, copies: b.sourcePaths.length, vendors: b.vendorCounts }));

  return {
    filesScanned: report.stats.filesScanned,
    dirsScanned: report.stats.dirsScanned,
    filesSkipped: report.stats.filesSkipped,
    uniqueAssets,
    duplicateCopies,
    byBucket,
    byVendor,
    topDuplicates,
  };
}

function renderMarkdown(totals, buckets, generatedAt, registryDocCount, reconciliation = [], conflicts = []) {
  const L = [];
  L.push(`# _source/SMPTE Inventory — ${generatedAt}`);
  L.push('');
  L.push(`Registry snapshot: [src/main/data/documents.json](../data/documents.json) (${registryDocCount} docs at scan time)`);
  L.push('');
  L.push('## Totals');
  L.push(`- Directories walked: ${totals.dirsScanned}`);
  L.push(`- Files scanned: ${totals.filesScanned}`);
  L.push(`- Files skipped: failed-extraction ${totals.filesSkipped.failedExtraction}, zip containers ${totals.filesSkipped.zipContainers}, noise ${totals.filesSkipped.noise}`);
  L.push(`- Unique assets (dedup by docId): ${totals.uniqueAssets}`);
  L.push(`- Duplicate copies detected: ${totals.duplicateCopies}`);
  L.push('');
  L.push('## Buckets');
  L.push('| Bucket          | Count | Notes                                          |');
  L.push('|-----------------|-------|------------------------------------------------|');
  L.push(`| Found           | ${totals.byBucket.found.toString().padEnd(5)} | already in documents.json, no change           |`);
  L.push(`| Update          | ${totals.byBucket.update.toString().padEnd(5)} | in registry, source has new fields             |`);
  L.push(`| Gap             | ${totals.byBucket.gap.toString().padEnd(5)} | in source, not in registry — new records       |`);
  L.push(`| Registry-only   | ${totals.byBucket.registryOnly.toString().padEnd(5)} | in registry (SMPTE), no local source archived  |`);
  L.push(`| Unidentifiable  | ${totals.byBucket.unidentifiable.toString().padEnd(5)} | in source, no DOI derivable — manual triage    |`);
  L.push(`| Non-record      | ${totals.byBucket.nonRecord.toString().padEnd(5)} | not a document (analytics/schema/db/image)     |`);
  L.push('');
  L.push('## By vendor');
  L.push('| Vendor            | Found | Update | Gap | Unid. | Non-rec |');
  L.push('|-------------------|-------|--------|-----|-------|---------|');
  const vendorLabels = {
    allen_press: 'ALLEN PRESS',
    aptara: 'APTARA',
    highwire: 'HIGHWIRE',
    ieee: 'IEEE',
    ieee_dl_usage: 'IEEE DL Usage',
    zoho: 'Zoho',
  };
  for (const [key, label] of Object.entries(vendorLabels)) {
    const v = totals.byVendor[key];
    L.push(`| ${label.padEnd(17)} | ${String(v.found).padEnd(5)} | ${String(v.update).padEnd(6)} | ${String(v.gap).padEnd(3)} | ${String(v.unidentifiable).padEnd(5)} | ${String(v.nonRecord).padEnd(7)} |`);
  }
  L.push('');
  L.push('## Top duplicates');
  if (!totals.topDuplicates.length) L.push('- (none)');
  for (const d of totals.topDuplicates) {
    const vendorStr = Object.entries(d.vendors).map(([k, n]) => `${k}:${n}`).join(', ');
    L.push(`- \`${d.docId}\` — ${d.copies} copies (${vendorStr})`);
  }
  L.push('');

  L.push(`## Updates (${buckets.update.length} — details in JSON)`);
  for (const u of buckets.update.slice(0, 200)) {
    const fields = u.fillableFields.map((f) => f.field).join(', ');
    L.push(`- \`${u.docId}\` — fillable: ${fields}`);
  }
  if (buckets.update.length > 200) L.push(`- … ${buckets.update.length - 200} more`);
  L.push('');

  L.push(`## Gaps (${buckets.gap.length} — details in JSON)`);
  for (const g of buckets.gap.slice(0, 500)) {
    L.push(`- \`${g.docId}\``);
  }
  if (buckets.gap.length > 500) L.push(`- … ${buckets.gap.length - 500} more`);
  L.push('');

  L.push(`## Registry-only (${buckets.registryOnly.length} — indexed but no archived source)`);
  for (const r of buckets.registryOnly.slice(0, 500)) {
    L.push(`- \`${r.docId}\``);
  }
  if (buckets.registryOnly.length > 500) L.push(`- … ${buckets.registryOnly.length - 500} more`);
  L.push('');

  // DOI reconciliation summary
  L.push('## DOI reconciliation — where filename and XML disagree');
  const r = totals.doiReconciliation || {};
  L.push(`- agree: ${r.agree || 0}`);
  L.push(`- xmlWins:scheme (e.g. symbolic vs ISBN form): ${r['xmlWins:scheme'] || 0}`);
  L.push(`- xmlWins:year (folder year vs DOI year): ${r['xmlWins:year'] || 0}`);
  L.push(`- xmlWins:other: ${r['xmlWins:other'] || 0}`);
  L.push(`- xmlMissing (no DOI in any sibling XML — kept name-derived): ${r.xmlMissing || 0}`);
  L.push(`- xmlBogus (XML DOI was a collection-level / shared placeholder — reverted to name-derived): ${r.xmlBogus || 0}`);
  L.push('');
  if (reconciliation.length) {
    const xmlWins = reconciliation.filter((x) => x.outcome.startsWith('xmlWins'));
    L.push(`### First ${Math.min(50, xmlWins.length)} xmlWins reconciliations`);
    L.push('| Outcome | Name-derived docId | XML-derived docId | XML source |');
    L.push('|---|---|---|---|');
    for (const x of xmlWins.slice(0, 50)) {
      L.push(`| ${x.outcome} | \`${x.nameDerivedDocId}\` | \`${x.reconciledDocId}\` | \`${x.xmlSourcePath || ''}\` |`);
    }
    L.push('');
  }

  // Field conflicts
  L.push(`## Field conflicts — XML vs filename / year drift (${conflicts.length} — details in JSON)`);
  const byField = {};
  for (const c of conflicts) byField[c.field] = (byField[c.field] || 0) + 1;
  for (const [f, n] of Object.entries(byField)) L.push(`- \`${f}\`: ${n}`);
  L.push('');

  L.push(`## Unidentifiable (${totals.byBucket.unidentifiable} — details in JSON)`);
  return L.join('\n') + '\n';
}

function main() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    console.error(`Source tree not found: ${SOURCE_ROOT}`);
    process.exit(1);
  }
  if (!fs.existsSync(DOCS_JSON)) {
    console.error(`Registry not found: ${DOCS_JSON}`);
    process.exit(1);
  }

  console.log(`Scanning ${SOURCE_ROOT}…`);
  const failedExtractionBasenames = readFailedExtractions();
  const report = new Report();
  walk(SOURCE_ROOT, report, { pdfDoiMap: null, insideContainer: false, insideStandard: false }, failedExtractionBasenames);

  console.log(`Loading registry ${DOCS_JSON}…`);
  const registry = loadRegistry();

  console.log('Building committee-slug reverse index…');
  const committeeIdx = buildCommitteeSlugReverseIndex(registry.all);

  console.log(`Reconciling DOIs and enriching from sibling XMLs (${report.byDocId.size} unique assets)…`);
  const { reconciliation, conflicts } = reconcileAndEnrich(report, committeeIdx);

  const buckets = classifyAgainstRegistry(report, registry);
  const totals = summarise(report, buckets);

  // Reconciliation outcome counts
  const reconciliationCounts = { agree: 0, xmlMissing: 0, xmlBogus: 0, 'xmlWins:scheme': 0, 'xmlWins:year': 0, 'xmlWins:other': 0 };
  for (const b of report.byDocId.values()) {
    const o = b.reconciledOutcome || 'agree';
    reconciliationCounts[o] = (reconciliationCounts[o] || 0) + 1;
  }
  totals.doiReconciliation = reconciliationCounts;
  totals.conflicts = conflicts.length;

  const generatedAt = new Date().toISOString();

  const json = {
    generatedAt,
    registrySnapshot: { path: path.relative(REPO_ROOT, DOCS_JSON), docCount: registry.all.length },
    totals,
    found: buckets.found.sort((a, b) => a.docId.localeCompare(b.docId)),
    update: buckets.update.sort((a, b) => a.docId.localeCompare(b.docId)),
    gap: buckets.gap.sort((a, b) => a.docId.localeCompare(b.docId)),
    registryOnly: buckets.registryOnly.sort((a, b) => a.docId.localeCompare(b.docId)),
    doiReconciliation: reconciliation.sort((a, b) => (a.nameDerivedDocId || '').localeCompare(b.nameDerivedDocId || '')),
    conflicts: conflicts.sort((a, b) => (a.docId || '').localeCompare(b.docId || '')),
    unidentifiable: report.unidentifiable.sort((a, b) => a.path.localeCompare(b.path)),
    nonRecord: report.nonRecord.sort((a, b) => a.path.localeCompare(b.path)),
  };

  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(json, null, 2) + '\n');
  fs.writeFileSync(REPORT_MD, renderMarkdown(totals, buckets, generatedAt, registry.all.length, reconciliation, conflicts));

  console.log(`Wrote ${path.relative(REPO_ROOT, REPORT_JSON)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, REPORT_MD)}`);
  console.log(`Summary: found=${totals.byBucket.found} update=${totals.byBucket.update} gap=${totals.byBucket.gap} registryOnly=${totals.byBucket.registryOnly} unidentifiable=${totals.byBucket.unidentifiable} nonRecord=${totals.byBucket.nonRecord}`);
  console.log(`DOI reconciliation: agree=${reconciliationCounts.agree} xmlWins(scheme)=${reconciliationCounts['xmlWins:scheme']} xmlWins(year)=${reconciliationCounts['xmlWins:year']} xmlWins(other)=${reconciliationCounts['xmlWins:other']} xmlMissing=${reconciliationCounts.xmlMissing} xmlBogus=${reconciliationCounts.xmlBogus} conflicts=${conflicts.length}`);
}

main();
