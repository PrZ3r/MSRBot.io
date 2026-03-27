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

function createSmpteParser(deps) {
  const {
    axios,
    cheerio,
    dayjs,
    urlReachable,
    extractRefs,
    mapRefByCite,
    withNoCache,
    NO_CACHE_HEADERS,
    onBadRefs
  } = deps;

  const typeMap = {
    AG: 'Administrative Guideline',
    OM: 'Operations Manual',
    ST: 'Standard',
    RP: 'Recommended Practice',
    EG: 'Engineering Guideline',
    RDD: 'Registered Disclosure Document',
    OV: 'Overview Document'
  };

  function stripLeadingSmpte(title) {
    if (!title) return title;
    return String(title).replace(/^\s*SMPTE\s*[:\-–—]?\s*/i, '').trim();
  }

  function stripLeadingDesignatorComma(t) {
    if (!t) return t;
    const s = String(t).trim();
    const idx = s.indexOf(',');
    if (idx === -1) return s;
    return s.slice(idx + 1).trim();
  }

  function splitSuiteTitleOnDash(t) {
    if (!t) return { suiteTitle: null, title: t };
    const s = String(t).trim();

    const m = s.match(/^(.*?)\s*[—–]\s*(.+)$/);
    if (m) return { suiteTitle: m[1].trim() || null, title: m[2].trim() };

    const m2 = s.match(/^(.*?)\s-\s(.+)$/);
    if (m2) return { suiteTitle: m2[1].trim() || null, title: m2[2].trim() };

    return { suiteTitle: null, title: s };
  }

  function normalizeInlineText(input) {
    if (input === null || input === undefined) return null;
    const s = String(input)
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return s || null;
  }

  function extractScopeAbstract($) {
    try {
      const $scope = $('#sec-scope');
      if (!$scope || !$scope.length) return null;

      const paras = [];
      $scope.find('p').each((_, p) => {
        const t = normalizeInlineText($(p).text());
        if (t) paras.push(t);
      });

      if (paras.length) return paras.join('\n');
      return normalizeInlineText($scope.text());
    } catch (_) {
      return null;
    }
  }

  function inferMetadataFromPath(rootUrl, releaseTag, baseReleases = [], latestTag = null) {
    const match = rootUrl.match(/doc\/([^/]+)\/$/);
    const pubTypeNum = match ? match[1].toUpperCase() : null;
    const pubType = pubTypeNum?.match(/^[A-Z]+/)[0];
    const numberPart = pubTypeNum?.replace(pubType, '');
    let docNumber = numberPart;
    let docPart;

    if (numberPart.includes('-')) {
      const [num, part] = numberPart.split('-');
      docNumber = num;
      docPart = part;
    }
    const [datePart] = releaseTag.split('-');
    const pubDate = dayjs(datePart, 'YYYYMMDD');
    const dateString = pubDate.isValid() ? (pubDate.year() < 2023 ? `${pubDate.year()}` : pubDate.format('YYYY-MM')) : 'UNKNOWN';

    let docId = pubTypeNum ? `SMPTE.${pubTypeNum}.${dateString}` : 'UNKNOWN';
    let docLabel = `SMPTE ${pubType || ''} ${docNumber || ''}${docPart ? `-${docPart}` : ''}:${dateString}`;
    let doi = `10.5594/${docId}`;
    let href = `https://doi.org/${doi}`;
    const repoUrl = `https://github.com/SMPTE/${pubTypeNum.toLowerCase()}/`;

    if (/^(\d{8})-am(\d+)-/.test(releaseTag)) {
      const [, amendDate, amendNum] = releaseTag.match(/^(\d{8})-am(\d+)-/);
      const amendYear = dayjs(amendDate, 'YYYYMMDD').year();
      const base = baseReleases
        .map(tag => ({ tag, date: dayjs(tag.split('-')[0], 'YYYYMMDD') }))
        .filter(entry => entry.date.isValid() && entry.date.isBefore(dayjs(amendDate, 'YYYYMMDD')))
        .sort((a, b) => b.date - a.date)[0];
      if (base) {
        const baseYear = base.date.year();
        docId = `SMPTE.${pubTypeNum}.${baseYear}Am${amendNum}.${amendYear}`;
        docLabel = `SMPTE ${pubType || ''} ${docNumber || ''}${docPart ? `-${docPart}` : ''}:${baseYear} Am${amendNum}:${amendYear}`;
        doi = `10.5594/${docId}`;
        href = `https://doi.org/${doi}`;
      }
    }

    const lastBase = baseReleases[baseReleases.length - 1];
    const isAmendmentLatest = latestTag ? /-am\d+-/i.test(latestTag) : false;
    const isThisBase = !/-am\d+-/i.test(releaseTag);
    const isLatestOverall =
      (latestTag ? (releaseTag === latestTag) : (releaseTag === lastBase)) ||
      (isThisBase && isAmendmentLatest && releaseTag === lastBase);

    return {
      docId,
      docLabel,
      releaseTag,
      publicationDate: pubDate.isValid() ? pubDate.format('YYYY-MM-DD') : undefined,
      publisher: 'SMPTE',
      href,
      repo: repoUrl,
      doi,
      docType: typeMap[pubType] || pubType,
      docNumber,
      docPart,
      status: {
        active: isLatestOverall,
        latestVersion: isLatestOverall,
        superseded: !isLatestOverall
      }
    };
  }

  function mergeInferredInto(existingDoc, inferredDoc) {
    const safeFields = [
      'docId',
      'releaseTag',
      'publicationDate',
      'publisher',
      'href',
      'repo',
      'doi',
      'docType',
      'docNumber',
      'docPart'
    ];

    for (const key of safeFields) {
      if (inferredDoc[key] !== undefined) existingDoc[key] = inferredDoc[key];
    }

    if (!existingDoc.status) existingDoc.status = {};
    const statusFields = ['active', 'latestVersion', 'superseded'];
    for (const field of statusFields) {
      if (inferredDoc.status[field] !== undefined) existingDoc.status[field] = inferredDoc.status[field];
    }
  }

  async function extractFromSeedDoc(seedRootUrl) {
    const rootUrl = seedRootUrl.endsWith('/') ? seedRootUrl : seedRootUrl + '/';
    const indexUrl = rootUrl + 'index.html';
    try {
      const indexRes = await axios.get(withNoCache(indexUrl), { headers: NO_CACHE_HEADERS });
      const $index = cheerio.load(indexRes.data);

      const pubType = $index('[itemprop="pubType"]').attr('content');
      let pubNumber = $index('[itemprop="pubNumber"]').attr('content');
      if (pubNumber) pubNumber = pubNumber.replace(/([a-z]+)/g, (m) => m.toUpperCase());
      const pubPart = $index('[itemprop="pubPart"]').attr('content');
      const pubDate = $index('[itemprop="pubDateTime"]').attr('content');
      const suiteTitleRaw = $index('[itemprop="pubSuiteTitle"]').attr('content');
      const docSuiteTitle = (suiteTitleRaw || '').trim() || null;

      const titleText = ($index('title').text() || '').trim();
      const titleAfterComma = stripLeadingDesignatorComma(titleText);
      const split = splitSuiteTitleOnDash(titleAfterComma);
      const docTitle = (split.title || titleAfterComma || '').trim() || null;
      const tc = $index('[itemprop="pubTC"]').attr('content');

      const pubDateObj = dayjs(pubDate);
      const dateFormatted = pubDateObj.isValid() ? pubDateObj.format('YYYY-MM-DD') : undefined;
      const syntheticTag = pubDateObj.isValid() ? `${pubDateObj.format('YYYYMMDD')}-pub` : '00000000-pub';

      const docType = typeMap[pubType?.toUpperCase()] || pubType;
      let label = `SMPTE ${pubType} ${pubNumber}${pubPart ? `-${pubPart}` : ''}`;
      let id = `SMPTE.${pubType}${pubNumber}${pubPart ? `-${pubPart}` : ''}`;
      if ((pubType || '').toUpperCase() === 'OM') {
        const rawTitleForMap = (docSuiteTitle && docSuiteTitle.trim()) ? docSuiteTitle : (docTitle || '');
        const normTitleForMap = stripLeadingSmpte(rawTitleForMap);
        const mappedId = mapRefByCite(normTitleForMap) || mapRefByCite(rawTitleForMap);
        if (mappedId) {
          label = 'SMPTE OM';
          id = mappedId;
        }
      }
      const href = rootUrl;
      const pubTypeNum = `${pubType}${pubNumber}${pubPart ? `-${pubPart}` : ''}`;
      const repoUrl = `https://github.com/SMPTE/${(pubTypeNum || '').toLowerCase()}/`;

      const pubStage = $index('[itemprop="pubStage"]').attr('content');
      const pubState = $index('[itemprop="pubState"]').attr('content');
      const pubPublisher =
        ($index('[itemprop="publisher"]').text() || $index('[itemprop="publisher"]').attr('content') || '').trim() || 'SMPTE';

      const { references: refsOut = {}, badRefs: localBad = [] } = extractRefs($index, id);
      if (localBad.length && typeof onBadRefs === 'function') onBadRefs(localBad);
      const hasRefsOut = Object.keys(refsOut).length > 0;
      const abstract = extractScopeAbstract($index);

      const revisionRaw = $index('[itemprop="pubRevisionOf"]').attr('content');
      let revisionOf;
      if (revisionRaw) {
        const match = revisionRaw.match(/SMPTE\s+([A-Z]+)\s+(\d+)(?:-(\d+))?:?(\d{4})(?:-(\d{2}))?/);
        if (match) {
          const [, type, number, part, year, month] = match;
          const suffix = (parseInt(year) >= 2023 && month) ? `${year}-${month}` : year;
          const baseId = `SMPTE.${type.toUpperCase()}${part ? `${number}-${part}` : number}.${suffix}`;
          revisionOf = [baseId];
        }
      }

      const doc = {
        docId: id,
        docLabel: label,
        docNumber: pubNumber,
        docPart: pubPart,
        ...(docSuiteTitle ? { docSuiteTitle } : {}),
        ...(docTitle ? { docTitle } : {}),
        docType,
        group: tc ? `smpte-${tc.toLowerCase()}-tc` : 'smpte-02c-st',
        publicationDate: dateFormatted,
        releaseTag: syntheticTag,
        publisher: pubPublisher,
        href,
        repo: repoUrl,
        status: {
          active: true,
          latestVersion: true,
          stage: pubStage,
          state: pubState,
          superseded: false,
          versionless: true
        },
        ...(hasRefsOut ? { references: refsOut } : {}),
        ...(abstract ? { abstract } : {}),
        ...(revisionOf && { revisionOf })
      };

      Object.defineProperty(doc, '__sourceUrl', { value: rootUrl, enumerable: false });
      return [doc];
    } catch (err) {
      console.warn(`⚠️ Seed doc parse failed at ${indexUrl}: ${err.message}`);
      return [];
    }
  }

  async function extractFromUrl(rootUrl) {
    const res = await axios.get(rootUrl);
    const $ = cheerio.load(res.data);
    const folderLinksSet = new Set();
    const amendmentMap = new Map();

    $('ul.versions li.version').each((_, ver) => {
      const $ver = $(ver);
      const baseHrefRaw = $ver.find('> div > a').attr('href') || '';
      const baseHref = baseHrefRaw.trim();
      if (/^\d{8}(?:-am\d+)?-(wd|cd|fcd|dp|pub)\/$/i.test(baseHref)) {
        const baseTag = baseHref.replace(/\/$/, '');
        folderLinksSet.add(baseTag);
        if (!amendmentMap.has(baseTag)) amendmentMap.set(baseTag, []);
      }

      $ver.find('.amendments a').each((__, a) => {
        const ahrefRaw = $(a).attr('href') || '';
        const ahref = ahrefRaw.trim();
        if (/^\d{8}(?:-am\d+)?-(wd|cd|fcd|dp|pub)\/$/i.test(ahref)) {
          const amendTag = ahref.replace(/\/$/, '');
          folderLinksSet.add(amendTag);
          if (baseHref) {
            const baseTag = baseHref.replace(/\/$/, '');
            if (!amendmentMap.has(baseTag)) amendmentMap.set(baseTag, []);
            amendmentMap.get(baseTag).push(amendTag);
          }
        }
      });
    });

    const folderLinks = Array.from(folderLinksSet);
    if (!folderLinks.length) {
      console.warn(`\n⚠️ No release folders found at ${rootUrl}`);
      return [];
    }

    folderLinks.sort();
    const latestTag = folderLinks[folderLinks.length - 1];
    const baseReleases = folderLinks.filter(tag => !/-am\d+-/.test(tag));

    const docs = [];
    let countHTML = 0, countPDF = 0, countNoIframe = 0;

    for (const releaseTag of folderLinks) {
      const lastBase = baseReleases[baseReleases.length - 1];
      const isAmendmentLatest = /-am\d+-/i.test(latestTag);
      const isThisBase = !/-am\d+-/i.test(releaseTag);
      const isLatestForStatus = (releaseTag === latestTag) || (isThisBase && isAmendmentLatest && releaseTag === lastBase);
      const sourceUrl = `${rootUrl}${releaseTag}`;

      console.log(`\n🔍 Processing ${sourceUrl}/`);

      let iframeSrc = null;
      let wrapperStates = new Set();
      let wrapperDesignator = null;
      let withdrawnNoticeHref = null;
      try {
        const wrapperRes = await axios.get(`${sourceUrl}/`);
        const $wrap = cheerio.load(wrapperRes.data);
        iframeSrc = ($wrap('#document').attr('src') || '').trim() || null;
        $wrap('span#state').each((_, el) => {
          const cls = ($wrap(el).attr('class') || '').split(/\s+/);
          cls.forEach(c => {
            if (c.startsWith('state-')) wrapperStates.add(c.replace('state-', '').toLowerCase());
          });
        });
        wrapperDesignator = ($wrap('#designator').text() || '').trim();
        withdrawnNoticeHref = ($wrap('#withdrawal-statement').attr('href') || '').trim() || null;

        const folderSlug = rootUrl.split('/').filter(Boolean).pop();
        const kind = iframeSrc ? (iframeSrc.endsWith('.pdf') ? 'PDF' : 'HTML') : 'none';
        console.log(`📂 ${folderSlug} | ${releaseTag} | iframe: ${kind}${iframeSrc ? '=' + iframeSrc : ''} | states: ${Array.from(wrapperStates).join(', ') || 'none'}`);

        if (!iframeSrc) countNoIframe++;
        else if (/\.pdf$/i.test(iframeSrc)) countPDF++;
        else countHTML++;
      } catch (_) {}

      if (iframeSrc && /\.pdf$/i.test(iframeSrc)) {
        try {
          const inferred = inferMetadataFromPath(rootUrl, releaseTag, baseReleases, latestTag);
          let docSuiteTitle = null;
          let docTitle = null;
          let titleText = null;
          if (wrapperDesignator) titleText = String(wrapperDesignator).trim();

          if (!titleText) {
            try {
              const wrapperRes = await axios.get(`${sourceUrl}/`);
              const $wrap = cheerio.load(wrapperRes.data);
              titleText = ($wrap('title').text() || '').trim() || null;
            } catch {}
          }

          if (titleText) {
            const titleAfterComma = stripLeadingDesignatorComma(titleText);
            const split = splitSuiteTitleOnDash(titleAfterComma);
            docSuiteTitle = split.suiteTitle || null;
            docTitle = (split.title || titleAfterComma || '').trim() || null;
          }

          const doc = {
            ...inferred,
            ...(docSuiteTitle ? { docSuiteTitle } : {}),
            ...(docTitle ? { docTitle } : {}),
            status: {
              ...(inferred.status || {}),
              ...(wrapperStates.has('stabilized') ? { stabilized: true } : {}),
              ...(wrapperStates.has('withdrawn') ? { withdrawn: true, active: false } : {})
            }
          };
          if (withdrawnNoticeHref) {
            const absNotice = new URL(withdrawnNoticeHref, `${sourceUrl}/`).toString();
            doc.status = { ...(doc.status || {}), withdrawnNotice: absNotice };

            let suffix = 'link unreachable at extraction';
            try {
              const ok = await urlReachable(absNotice);
              suffix = ok ? 'verified reachable' : suffix;
            } catch (_) {}
            Object.defineProperty(doc, '__withdrawnNoticeSuffix', { value: suffix, enumerable: false });
          }

          Object.defineProperty(doc, '__sourceUrl', { value: `${sourceUrl}/`, enumerable: false });
          docs.push(doc);
          continue;
        } catch (e) {
          console.warn(`⚠️ PDF-wrapper handling failed at ${sourceUrl}/: ${e.message}`);
        }
      }

      const indexUrl = `${sourceUrl}/${iframeSrc && !/\.pdf$/i.test(iframeSrc) ? iframeSrc : 'index.html'}`;
      try {
        const indexRes = await axios.get(indexUrl);
        const $index = cheerio.load(indexRes.data);

        const pubType = $index('[itemprop="pubType"]').attr('content');
        let pubNumber = $index('[itemprop="pubNumber"]').attr('content');
        if (pubNumber) pubNumber = pubNumber.replace(/([a-z]+)/g, (m) => m.toUpperCase());
        const pubPart = $index('[itemprop="pubPart"]').attr('content');
        const pubDate = $index('[itemprop="pubDateTime"]').attr('content');
        const suiteTitleRaw = $index('[itemprop="pubSuiteTitle"]').attr('content');
        const docSuiteTitle = (suiteTitleRaw || '').trim() || null;

        const titleText = ($index('title').text() || '').trim();
        const titleAfterComma = stripLeadingDesignatorComma(titleText);
        const split = splitSuiteTitleOnDash(titleAfterComma);
        const docTitle = (split.title || titleAfterComma || '').trim() || null;
        const tc = $index('[itemprop="pubTC"]').attr('content');

        const pubDateObj = dayjs(pubDate);
        const dateFormatted = pubDateObj.format('YYYY-MM-DD');
        const dateShort = pubDateObj.format('YYYY-MM');

        const docType = typeMap[pubType?.toUpperCase()] || pubType;
        let label = `SMPTE ${pubType} ${pubNumber}${pubPart ? `-${pubPart}` : ''}:${dateShort}`;
        let id = `SMPTE.${pubType}${pubNumber}${pubPart ? `-${pubPart}` : ''}.${dateShort}`;
        if ((pubType || '').toUpperCase() === 'OM') {
          const rawTitleForMap = (docSuiteTitle && docSuiteTitle.trim()) ? docSuiteTitle : (docTitle || '');
          const normTitleForMap = stripLeadingSmpte(rawTitleForMap);
          const mappedId = mapRefByCite(normTitleForMap) || mapRefByCite(rawTitleForMap);
          if (mappedId) {
            label = 'SMPTE OM';
            id = mappedId;
          }
        }
        const doi = `10.5594/SMPTE.${pubType}${pubNumber}${pubPart ? `-${pubPart}` : ''}.${pubDateObj.format('YYYY')}`;
        const href = `https://doi.org/${doi}`;
        const pubTypeNum = `${pubType}${pubNumber}${pubPart ? `-${pubPart}` : ''}`;
        const repoUrl = `https://github.com/SMPTE/${pubTypeNum.toLowerCase()}/`;

        const pubStage = $index('[itemprop="pubStage"]').attr('content');
        const pubState = $index('[itemprop="pubState"]').attr('content');
        const pubPublisher =
          ($index('[itemprop="publisher"]').text() || $index('[itemprop="publisher"]').attr('content') || '').trim() || 'SMPTE';

        const { references: refsOut = {}, badRefs: localBad = [] } = extractRefs($index, id);
        if (localBad.length && typeof onBadRefs === 'function') onBadRefs(localBad);
        const hasRefsOut = Object.keys(refsOut).length > 0;
        const abstract = extractScopeAbstract($index);

        const revisionRaw = $index('[itemprop="pubRevisionOf"]').attr('content');
        let revisionOf;
        if (revisionRaw) {
          const match = revisionRaw.match(/SMPTE\s+([A-Z]+)\s+(\d+)(?:-(\d+))?:?(\d{4})(?:-(\d{2}))?/);
          if (match) {
            const [, type, number, part, year, month] = match;
            const suffix = (parseInt(year) >= 2023 && month) ? `${year}-${month}` : year;
            const baseId = `SMPTE.${type.toUpperCase()}${part ? `${number}-${part}` : number}.${suffix}`;
            revisionOf = [baseId];
          }
        }

        const doc = {
          docId: id,
          docLabel: label,
          docNumber: pubNumber,
          docPart: pubPart,
          ...(docSuiteTitle ? { docSuiteTitle } : {}),
          ...(docTitle ? { docTitle } : {}),
          docType,
          doi,
          group: `smpte-${tc.toLowerCase()}-tc`,
          publicationDate: dateFormatted,
          releaseTag,
          publisher: pubPublisher,
          href,
          repo: repoUrl,
          status: {
            active: isLatestForStatus && pubStage === 'PUB' && pubState === 'pub',
            latestVersion: isLatestForStatus,
            stage: pubStage,
            state: pubState,
            superseded: !isLatestForStatus
          },
          ...(hasRefsOut ? { references: refsOut } : {}),
          ...(abstract ? { abstract } : {}),
          ...(revisionOf && { revisionOf })
        };

        Object.defineProperty(doc, '__sourceUrl', { value: `${sourceUrl}/`, enumerable: false });
        docs.push(doc);
      } catch (err) {
        if (err.response?.status === 403 || err.response?.status === 404) {
          console.warn(`⚠️ No index.html found at ${sourceUrl}/`);
          const inferred = inferMetadataFromPath(rootUrl, releaseTag, baseReleases, latestTag);
          Object.defineProperty(inferred, '__sourceUrl', { value: `${sourceUrl}/`, enumerable: false });
          const existingIndex = docs.findIndex(d => d.docId === inferred.docId);
          if (existingIndex !== -1) mergeInferredInto(docs[existingIndex], inferred);
          else docs.push(inferred);
          console.warn(`📄 Likely PDF-only release — inferred docId: ${inferred.docId}`);
        } else {
          console.warn(`⚠️ Failed to fetch or parse ${indexUrl}: ${err.message}`);
        }
      }
    }

    try {
      if (amendmentMap && amendmentMap.size) {
        const byReleaseTag = new Map();
        for (const d of docs) {
          if (d && d.releaseTag) byReleaseTag.set(d.releaseTag, d);
        }

        for (const [baseTag, amendTags] of amendmentMap.entries()) {
          const baseDoc = byReleaseTag.get(baseTag);
          if (!baseDoc) continue;
          const amendIds = amendTags
            .map(t => byReleaseTag.get(t))
            .filter(Boolean)
            .map(d => d.docId)
            .filter(Boolean);
          baseDoc.status = baseDoc.status || {};
          if (amendIds.length) {
            baseDoc.status.amended = true;
            baseDoc.status.amendedBy = amendIds;
          }
        }

        for (const [baseTag, baseDoc] of byReleaseTag.entries()) {
          if (/-am\d+-/i.test(baseTag)) continue;
          baseDoc.status = baseDoc.status || {};
          if (baseDoc.status.amended === undefined) baseDoc.status.amended = false;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Amendment wiring failed for ${rootUrl}: ${e.message}`);
    }

    try {
      const byReleaseTag = new Map();
      for (const d of docs) {
        if (d && d.releaseTag) byReleaseTag.set(d.releaseTag, d);
      }
      const baseTags = Array.from(byReleaseTag.keys()).filter(t => !/-am\d+-/i.test(t)).sort();

      for (let i = 0; i < baseTags.length - 1; i++) {
        const baseTag = baseTags[i];
        const nextBaseTag = baseTags[i + 1];
        const nextBaseDateStr = (nextBaseTag.match(/^(\d{4})(\d{2})(\d{2})/))
          ? `${nextBaseTag.slice(0, 4)}-${nextBaseTag.slice(4, 6)}-${nextBaseTag.slice(6, 8)}`
          : undefined;

        const baseDoc = byReleaseTag.get(baseTag);
        const nextBaseDoc = byReleaseTag.get(nextBaseTag);
        if (!baseDoc || !nextBaseDoc || !nextBaseDoc.docId) continue;

        baseDoc.status = baseDoc.status || {};
        const nextList = [nextBaseDoc.docId];
        const prevListBase = Array.isArray(baseDoc.status.supersededBy) ? baseDoc.status.supersededBy : [];
        if (JSON.stringify(prevListBase) !== JSON.stringify(nextList)) baseDoc.status.supersededBy = nextList;
        if (nextBaseDateStr) baseDoc.status.supersededDate = nextBaseDateStr;

        if (amendmentMap && amendmentMap.has(baseTag)) {
          const amendTags = amendmentMap.get(baseTag) || [];
          for (const amendTag of amendTags) {
            const amendDoc = byReleaseTag.get(amendTag);
            if (!amendDoc) continue;
            amendDoc.status = amendDoc.status || {};
            const prevListAmend = Array.isArray(amendDoc.status.supersededBy) ? amendDoc.status.supersededBy : [];
            if (JSON.stringify(prevListAmend) !== JSON.stringify(nextList)) amendDoc.status.supersededBy = nextList;
            if (nextBaseDateStr) amendDoc.status.supersededDate = nextBaseDateStr;
          }
        }
      }
    } catch (e) {
      console.warn(`⚠️ supersededBy wiring failed for ${rootUrl}: ${e.message}`);
    }

    try {
      for (const d of docs) {
        d.status = d.status || {};
        if (typeof d.status.superseded === 'undefined') {
          if (d.status.latestVersion === true) d.status.superseded = false;
          else if (d.status.latestVersion === false) d.status.superseded = true;
          else d.status.superseded = false;
        }
      }
    } catch (e) {
      console.warn(`⚠️ Superseded normalization failed for ${rootUrl}: ${e.message}`);
    }

    console.log(`📊 Release summary — HTML: ${countHTML}, PDF: ${countPDF}, none: ${countNoIframe}`);
    return docs;
  }

  return { extractFromSeedDoc, extractFromUrl };
}

module.exports = { createSmpteParser };
