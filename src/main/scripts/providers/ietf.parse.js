const fs = require('fs');
const path = require('path');

function createIetfParser(deps) {
  const {
    axios,
    cheerio,
    dayjs,
    mapRefByCite,
    withNoCache,
    NO_CACHE_HEADERS
  } = deps;

  function cleanUrl(u) {
    try {
      const url = new URL(u);
      url.protocol = 'https:';
      url.hash = '';
      url.search = '';
      let s = url.toString();
      const fileLike = /\/[^/]+\.[A-Za-z0-9]{1,8}$/.test(url.pathname || '');
      if (fileLike) {
        s = s.replace(/\/$/, '');
      } else if (!s.endsWith('/')) {
        s += '/';
      }
      return s;
    } catch {
      return String(u || '').trim();
    }
  }

  const docIdMapPath = path.resolve(process.cwd(), 'src/main/input/docIdMap.ietf.json');
  const docIdMap = (() => {
    try {
      if (!fs.existsSync(docIdMapPath)) return {};
      const raw = JSON.parse(fs.readFileSync(docIdMapPath, 'utf8'));
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      const out = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = cleanUrl(k);
        const val = String(v || '').trim();
        if (key && val) out[key] = val;
      }
      return out;
    } catch {
      return {};
    }
  })();

  function extractRfcNumber(value) {
    const m = String(value || '').match(/rfc[-\s\/]?(\d{3,5})/i);
    return m ? m[1] : null;
  }

  function text($, sel) {
    const t = $(sel).first().text();
    return t ? String(t).trim() : '';
  }

  function safeText($, sel) {
    if (!$) return '';
    return text($, sel);
  }

  function metaList($, name) {
    return $(`meta[name="${name}"]`)
      .map((_, el) => ($(el).attr('content') || '').trim())
      .get()
      .filter(Boolean);
  }

  function textList($, sel) {
    if (!$) return [];
    return $(sel)
      .map((_, el) => ($(el).text() || '').trim())
      .get()
      .filter(Boolean);
  }

  function cleanAuthorName(value) {
    const s = String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/,\s*(Ed|Editor)\.?$/i, '')
      .trim();
    return s || '';
  }

  function cleanAbstractText(value) {
    const s = String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return s || '';
  }

  function metaContent($, names = []) {
    for (const n of names) {
      const v = $(`meta[name="${n}"]`).attr('content') || $(`meta[property="${n}"]`).attr('content');
      if (v && String(v).trim()) return String(v).trim();
    }
    return '';
  }

  function parsePublishedDate(raw) {
    const s = String(raw || '').trim();
    if (!s) return undefined;

    const d = dayjs(s);
    if (d.isValid()) return d.format('YYYY-MM-DD');

    const monthYear = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (monthYear) {
      const p = dayjs(`${monthYear[1]} ${monthYear[2]} 01`, 'MMMM YYYY DD');
      if (p.isValid()) return p.format('YYYY-MM-DD');
    }

    const monthCommaYear = s.match(/^([A-Za-z]+)\s*,\s*(\d{4})$/);
    if (monthCommaYear) {
      const p = dayjs(`${monthCommaYear[1]} ${monthCommaYear[2]} 01`, 'MMMM YYYY DD');
      if (p.isValid()) return p.format('YYYY-MM-DD');
    }
    return undefined;
  }

  function unique(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }

  function parseRfcRefsFromText(input) {
    const refs = [];
    const re = /\bRFC\s*([0-9]{3,5})\b/gi;
    let m;
    while ((m = re.exec(String(input || ''))) !== null) refs.push(`RFC${m[1]}`);
    return unique(refs);
  }

  function escapeRegExp(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractRelationRefsFromText(text, phrase, allPhrases) {
    const source = String(text || '');
    if (!source || !phrase) return [];
    const phrasePattern = escapeRegExp(phrase);
    const others = (allPhrases || [])
      .filter(p => p && p.toLowerCase() !== phrase.toLowerCase())
      .map(escapeRegExp);
    const stop = others.length ? `(?:${others.join('|')})` : null;
    const lookahead = stop
      ? `(?=\\b${stop}\\b|[\\n\\r]|$)`
      : `(?=[\\n\\r]|$)`;
    const re = new RegExp(`\\b${phrasePattern}\\b\\s*:?[\\s]*([\\s\\S]{0,240}?)${lookahead}`, 'ig');
    const out = [];
    let m;
    while ((m = re.exec(source)) !== null) {
      out.push(...parseRfcRefsFromText(m[1] || ''));
    }
    return unique(out);
  }

  function collectValuesForKeys(input, relationKeys) {
    const keySet = new Set((relationKeys || []).map(k => String(k).toLowerCase()));
    const out = [];
    const walk = (node) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        if (keySet.has(String(k).toLowerCase())) out.push(v);
        walk(v);
      }
    };
    walk(input);
    return out;
  }

  function parseRfcRefsFromUnknown(value) {
    if (!value) return [];
    if (typeof value === 'string') return parseRfcRefsFromText(value);
    if (Array.isArray(value)) return unique(value.flatMap(v => parseRfcRefsFromUnknown(v)));
    if (typeof value === 'object') {
      const candidates = [
        value.rfc,
        value.doc,
        value.name,
        value.title,
        value.value,
        value.id,
        value.reference
      ];
      return unique(candidates.flatMap(v => parseRfcRefsFromUnknown(v)));
    }
    return [];
  }

  function isUsableErrataUrl(url) {
    const s = String(url || '').trim();
    if (!s) return false;
    try {
      const u = new URL(s);
      if (/^datatracker\.ietf\.org$/i.test(u.hostname)) {
        const p = (u.pathname || '').toLowerCase();
        // Keep errata URLs canonical and stable by excluding Datatracker errata pages.
        if (p === '/errata.php' || p.startsWith('/errata/')) return false;
      }
    } catch {}
    return true;
  }

  function relationsFromInfoDl($) {
    const empty = { supersededBy: [], supersedes: [], amendedBy: [], amends: [] };
    if (!$) return empty;

    const out = { ...empty };
    $('dt').each((_, dtEl) => {
      const $dt = $(dtEl);
      const label = ($dt.text() || '').replace(/[:\s]+/g, ' ').trim().toLowerCase();
      if (!label) return;

      // RFC info pages are not always strict dt/dd siblings; dd may be nested or later sibling.
      let $dd = $dt.children('dd').first();
      if (!$dd.length) $dd = $dt.next('dd');
      if (!$dd.length) $dd = $dt.nextAll('dd').first();
      if (!$dd.length) return;

      const fromLinks = $dd.find('a').map((__, a) => {
        const href = ($(a).attr('href') || '').trim();
        const m = href.match(/\/info\/rfc(\d{3,5})/i) || href.match(/rfc[-\/]?(\d{3,5})/i);
        return m ? `RFC${m[1]}` : null;
      }).get().filter(Boolean);
      const fromText = parseRfcRefsFromText($dd.text() || '');
      const refs = unique([...fromLinks, ...fromText]);
      if (!refs.length) return;

      if (label.includes('obsoleted by')) out.supersededBy.push(...refs);
      else if (label.includes('obsoletes')) out.supersedes.push(...refs);
      else if (label.includes('updated by')) out.amendedBy.push(...refs);
      else if (label.includes('updates')) out.amends.push(...refs);
    });

    const normalized = {
      supersededBy: unique(out.supersededBy),
      supersedes: unique(out.supersedes),
      amendedBy: unique(out.amendedBy),
      amends: unique(out.amends)
    };

    if (
      normalized.supersededBy.length ||
      normalized.supersedes.length ||
      normalized.amendedBy.length ||
      normalized.amends.length
    ) {
      return normalized;
    }

    // Fallback for malformed RFC info markup where dt/dd pairs are not represented
    // as clean DOM siblings (common with unclosed <dt> tags).
    const html = String($.html() || '');
    if (!html) return normalized;

    const pullRefsForLabel = (label) => {
      const safeLabel = escapeRegExp(label);
      const re = new RegExp(
        `<dt[^>]*>[\\s\\S]*?(?:<b[^>]*>)?\\s*${safeLabel}\\s*:?\\s*(?:</b>)?[\\s\\S]*?<dd[^>]*>([\\s\\S]*?)(?=<dt\\b|</dl>|$)`,
        'ig'
      );
      const refs = [];
      let m;
      while ((m = re.exec(html)) !== null) {
        const block = String(m[1] || '');
        const fromInfoLinks = [];
        const linkRe = /href\s*=\s*(["']?)([^"'\s>]+)\1/ig;
        let lm;
        while ((lm = linkRe.exec(block)) !== null) {
          const href = String(lm[2] || '');
          const r = href.match(/\/info\/rfc(\d{3,5})/i) || href.match(/rfc[-\/]?(\d{3,5})/i);
          if (r) fromInfoLinks.push(`RFC${r[1]}`);
        }
        refs.push(...fromInfoLinks, ...parseRfcRefsFromText(block));
      }
      return unique(refs);
    };

    const rawFallback = {
      supersededBy: pullRefsForLabel('Obsoleted by'),
      supersedes: pullRefsForLabel('Obsoletes'),
      amendedBy: pullRefsForLabel('Updated by'),
      amends: pullRefsForLabel('Updates')
    };
    return {
      supersededBy: unique(rawFallback.supersededBy),
      supersedes: unique(rawFallback.supersedes),
      amendedBy: unique(rawFallback.amendedBy),
      amends: unique(rawFallback.amends)
    };
  }

  function classifyIetfDoc(combinedText, { isDraft = false } = {}) {
    if (isDraft) {
      return { docType: 'Standard', statusNote: 'Internet-Draft' };
    }

    const t = String(combinedText || '').toLowerCase();
    if (/\bproposed standard\b/.test(t) || /\binternet standard\b/.test(t)) {
      return { docType: 'Standard', statusNote: 'Proposed Standard' };
    }
    if (/\bbest current practice\b|\bbcp\b/.test(t)) {
      return { docType: 'Best Practice', statusNote: 'Best Current Practice' };
    }
    if (/\bexperimental\b/.test(t)) {
      return { docType: 'Experimental', statusNote: 'Experimental' };
    }
    if (/\binformational\b/.test(t)) {
      return { docType: 'Informational', statusNote: 'Informational' };
    }
    return { docType: 'Specification', statusNote: '' };
  }

  function refsFromSection($, sectionSelectors) {
    const raw = [];
    for (const sel of sectionSelectors) {
      $(sel).each((_, el) => {
        const $el = $(el);
        raw.push($el.text());
        $el.find('a').each((__, a) => {
          const href = $(a).attr('href') || '';
          const m = href.match(/rfc[-\/]?(\d{3,5})/i);
          if (m) raw.push(`RFC ${m[1]}`);
        });
      });
    }
    return parseRfcRefsFromText(raw.join('\n'));
  }

  async function fetchHtml(url) {
    const res = await axios.get(withNoCache(url), { headers: NO_CACHE_HEADERS });
    return cheerio.load(res.data);
  }

  async function fetchJson(url) {
    const res = await axios.get(withNoCache(url), { headers: NO_CACHE_HEADERS });
    return res?.data && typeof res.data === 'object' ? res.data : null;
  }

  async function fetchXml(url) {
    const res = await axios.get(withNoCache(url), { headers: NO_CACHE_HEADERS });
    return cheerio.load(res.data, { xmlMode: true, decodeEntities: true });
  }

  function pickFirst(...vals) {
    for (const v of vals) {
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  }

  function pickFirstWithSource(pairs = []) {
    for (const [raw, sourceNote] of pairs) {
      const value = normalizeText(raw);
      if (value) return { value, sourceNote: String(sourceNote || '').trim() };
    }
    return { value: '', sourceNote: '' };
  }

  function pickDateWithSource(pairs = []) {
    for (const [raw, sourceNote] of pairs) {
      const parsed = parsePublishedDate(raw);
      if (parsed) return { value: parsed, sourceNote: String(sourceNote || '').trim() };
    }
    return { value: undefined, sourceNote: '' };
  }

  function normalizeText(v) {
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
    return '';
  }

  function firstNonEmpty(...vals) {
    for (const v of vals) {
      const s = normalizeText(v);
      if (s) return s;
    }
    return '';
  }

  function normalizeDoi(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const withoutPrefix = raw.replace(/^doi:\s*/i, '').trim();
    try {
      const asUrl = new URL(withoutPrefix);
      if (/doi\.org$/i.test(asUrl.hostname)) {
        return decodeURIComponent(asUrl.pathname.replace(/^\/+/, '').trim());
      }
    } catch {}
    return withoutPrefix.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').trim();
  }

  function hrefFromDoiOrSeed(doi, seed) {
    const normalizedDoi = normalizeDoi(doi);
    return normalizedDoi ? `https://doi.org/${normalizedDoi}` : seed;
  }

  function seedFormatHints(seed) {
    try {
      const pathname = new URL(seed).pathname || '';
      return {
        looksHtml: /\.html?$/i.test(pathname),
        looksJson: /\.json$/i.test(pathname)
      };
    } catch {
      return { looksHtml: false, looksJson: false };
    }
  }

  function deriveArchiveXmlUrl(seed) {
    try {
      const u = new URL(seed);
      const pathname = u.pathname || '';
      if (/^\/archive\/id\/[^/]+\.xml$/i.test(pathname)) return cleanUrl(seed);
      const mArchive = pathname.match(/^\/archive\/id\/([^/]+)\.(?:html?|txt)$/i);
      if (mArchive?.[1]) return `https://www.ietf.org/archive/id/${mArchive[1]}.xml`;
    } catch {}

    const slug = extractDatatrackerSlug(seed) || inferReportFromSeed(seed);
    if (slug && /^draft-/i.test(slug)) {
      return `https://www.ietf.org/archive/id/${slug}.xml`;
    }
    return '';
  }

  function xmlFrontBundle($) {
    if (!$) return {};
    const root = $('rfc').first();
    const dateEl = $('rfc > front > date').first();
    const year = (dateEl.attr('year') || '').trim();
    const month = (dateEl.attr('month') || '').trim();
    const day = (dateEl.attr('day') || '').trim();

    let dateRaw = '';
    if (year && month && day) dateRaw = `${month} ${day}, ${year}`;
    else if (year && month) dateRaw = `${month}, ${year}`;
    else if (year) dateRaw = year;

    const authors = unique($('rfc > front > author').map((_, el) => {
      const a = $(el);
      const full = (a.attr('fullname') || a.attr('asciiFullname') || '').trim();
      if (full) return full;
      const initials = (a.attr('initials') || '').trim();
      const surname = (a.attr('surname') || '').trim();
      return `${initials}${initials && surname ? ' ' : ''}${surname}`.trim();
    }).get().filter(Boolean));

    const abstract = cleanAbstractText(
      $('rfc > front > abstract > t').map((_, el) => ($(el).text() || '').trim()).get().filter(Boolean).join('\n')
    );

    const doi = firstNonEmpty(
      $('rfc > front > seriesInfo[name="DOI"]').attr('value'),
      $('rfc > front > seriesInfo[name="doi"]').attr('value')
    );
    const report = firstNonEmpty(
      root.attr('docName'),
      root.attr('docname'),
      $('rfc > front > seriesInfo[name="Internet-Draft"]').attr('value')
    );
    const title = firstNonEmpty($('rfc > front > title').first().text());

    return {
      title,
      publicationDate: dateRaw,
      doi,
      report,
      authors,
      abstract
    };
  }

  function extractDatatrackerSlug(seed) {
    const raw = String(seed || '');
    try {
      const u = new URL(raw);
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0]?.toLowerCase() === 'doc') {
        if (parts[1]?.toLowerCase() === 'html' && parts[2]) return parts[2];
        if (parts[1]) return parts[1];
      }
    } catch {}
    const dm = raw.match(/\b(draft-[A-Za-z0-9._-]+)\b/i);
    if (dm?.[1]) return dm[1];
    return '';
  }

  function inferReportFromSeed(seed) {
    const raw = String(seed || '');
    const draftMatch = raw.match(/\b(draft-[A-Za-z0-9._-]+)\b/i);
    if (draftMatch?.[1]) return draftMatch[1].toLowerCase();
    return '';
  }

  function canonicalIdPart(input) {
    const s = String(input || '').trim();
    if (!s) return '';
    return s
      .replace(/^https?:\/\//i, '')
      .replace(/[^A-Za-z0-9]+/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .toUpperCase();
  }

  function deriveNonRfcDocId({ seed, report, trackerJson, titleRaw }) {
    const override = docIdMap[cleanUrl(seed)];
    if (override) return override;

    const draftSlug = (extractDatatrackerSlug(seed) || inferReportFromSeed(seed) || '').toLowerCase();
    if (draftSlug.startsWith('draft-')) {
      // Canonical non-RFC draft identity should track the draft slug in the seed URL.
      return `IETF.${draftSlug}`;
    }

    const citeCandidates = unique([
      titleRaw,
      report,
      trackerJson?.title,
      trackerJson?.name,
      extractDatatrackerSlug(seed),
      `IETF ${extractDatatrackerSlug(seed)}`,
      `IETF ${report || ''}`.trim()
    ]);
    if (typeof mapRefByCite === 'function') {
      for (const c of citeCandidates) {
        const mapped = mapRefByCite(c);
        if (mapped) return mapped;
      }
    }

    const reportCandidate = String(report || '').trim();
    if (reportCandidate) return `IETF.${canonicalIdPart(reportCandidate)}`;

    const jsonName = String(trackerJson?.name || '').trim();
    if (jsonName) return `IETF.${canonicalIdPart(jsonName)}`;

    const slug = extractDatatrackerSlug(seed);
    if (slug) return `IETF.${canonicalIdPart(slug)}`;

    try {
      const u = new URL(seed);
      const lastSegment = u.pathname.split('/').filter(Boolean).slice(-1)[0] || '';
      const base = canonicalIdPart(lastSegment || u.hostname);
      return `IETF.${base || 'DOC'}`;
    } catch {
      return `IETF.${canonicalIdPart(seed) || 'DOC'}`;
    }
  }

  function normalizeAuthorNames(value) {
    if (!Array.isArray(value)) return [];
    return unique(value.map((entry) => {
      if (!entry) return '';
      if (typeof entry === 'string') return entry.trim();
      if (typeof entry === 'object' && typeof entry.name === 'string') return entry.name.trim();
      return '';
    }));
  }

  function pickFirstArray(...arrays) {
    for (const arr of arrays) {
      if (!Array.isArray(arr)) continue;
      const normalized = unique(arr.map(v => String(v || '').trim()).filter(Boolean));
      if (normalized.length) return normalized;
    }
    return [];
  }

  function pickFirstArrayWithSource(pairs = []) {
    for (const [arr, sourceNote] of pairs) {
      if (!Array.isArray(arr)) continue;
      const normalized = unique(arr.map(v => String(v || '').trim()).filter(Boolean));
      if (normalized.length) return { value: normalized, sourceNote: String(sourceNote || '').trim() };
    }
    return { value: [], sourceNote: '' };
  }

  function toIetfLabel(base) {
    const s = String(base || '').trim();
    if (!s) return 'IETF';
    if (/^IETF\b/i.test(s)) return s;
    return `IETF ${s}`;
  }

  function citationBundle($) {
    if (!$) return {};
    const metaAuthors = unique([
      ...metaList($, 'citation_author'),
      ...metaList($, 'author'),
      ...metaList($, 'dc.creator'),
      ...metaList($, 'dcterms.creator')
    ]);

    function abstractFromHeadings() {
      const out = [];
      $('h1, h2, h3').each((_, el) => {
        const heading = ($(el).text() || '').trim();
        if (!/^abstract$/i.test(heading)) return;
        let cur = $(el).next();
        while (cur && cur.length) {
          const tag = (cur[0]?.tagName || '').toLowerCase();
          if (/^h[1-6]$/.test(tag)) break;
          const $clone = cur.clone();
          $clone.find('a.selfRef, a.pilcrow').remove();
          const t = ($clone.text() || '').replace(/\s+/g, ' ').trim();
          if (t) out.push(t);
          cur = cur.next();
        }
      });
      return out.join('\n').trim();
    }

    return {
      title: pickFirst(
        metaContent($, ['citation_title', 'dc.title', 'dcterms.title', 'og:title']),
        text($, 'h1'),
        text($, 'title')
      ),
      publicationDate: pickFirst(metaContent($, [
        'citation_publication_date',
        'citation_date',
        'citation_online_date',
        'dc.date',
        'dc.date.issued',
        'dcterms.date',
        'dcterms.issued',
        'date',
        'article:published_time'
      ])),
      doi: pickFirst(metaContent($, ['citation_doi'])),
      issn: pickFirst(metaContent($, ['citation_issn'])),
      report: pickFirst(
        metaContent($, ['citation_technical_report_number', 'dcterms.identifier', 'dc.identifier'])
      ),
      authors: unique([
        ...metaAuthors,
        ...textList($, 'dd.authors .author-name'),
        ...textList($, '.authors .author-name'),
        ...textList($, '.author'),
        ...textList($, '.authors'),
        ...textList($, 'a.author')
      ]).map(cleanAuthorName).filter(Boolean),
      abstract: cleanAbstractText(pickFirst(
        metaContent($, ['dcterms.abstract', 'description', 'dc.description', 'og:description']),
        text($, 'section#section-abstract p'),
        text($, 'section#abstract p'),
        text($, '#abstract p'),
        abstractFromHeadings()
      ))
    };
  }

  function classifyIetfFromStdLevel(stdLevel, { isDraft = false } = {}) {
    if (isDraft) return { docType: 'Standard', statusNote: 'Internet-Draft' };

    const level = String(stdLevel || '').trim();
    const l = level.toLowerCase();
    if (!l) return { docType: 'Specification', statusNote: '' };
    if (l.includes('best current practice')) return { docType: 'Best Practice', statusNote: level };
    if (l.includes('proposed standard') || l.includes('internet standard') || l.includes('draft standard')) {
      return { docType: 'Standard', statusNote: level };
    }
    if (l.includes('experimental')) return { docType: 'Experimental', statusNote: level };
    if (l.includes('informational')) return { docType: 'Informational', statusNote: level };
    return { docType: 'Specification', statusNote: level };
  }

  async function extractFromSeedDoc(seedRootUrl) {
    const seed = cleanUrl(seedRootUrl);
    const rfcNum = extractRfcNumber(seed);
    if (rfcNum) {
      const infoUrl = `https://www.rfc-editor.org/info/rfc${rfcNum}`;
      const datatrackerUrl = `https://datatracker.ietf.org/doc/rfc${rfcNum}/`;
      const datatrackerJsonUrl = `${datatrackerUrl}doc.json`;
      const htmlUrl = `https://www.rfc-editor.org/rfc/rfc${rfcNum}.html`;

      let $info = null;
      let $tracker = null;
      let $html = null;
      let trackerJson = null;
      try { $info = await fetchHtml(infoUrl); } catch {}
      try { $tracker = await fetchHtml(datatrackerUrl); } catch {}
      try { trackerJson = await fetchJson(datatrackerJsonUrl); } catch {}
      try { $html = await fetchHtml(htmlUrl); } catch {}

      if (!$info && !$tracker && !$html && !trackerJson) {
        console.warn(`⚠️ IETF parse failed: unable to fetch info/tracker/html/doc.json for RFC${rfcNum}`);
        return [];
      }

      const cHtml = citationBundle($html);
      const cTracker = citationBundle($tracker);
      const cInfo = citationBundle($info);
      const metaNotes = {};

      const titlePick = pickFirstWithSource([
        [trackerJson?.title, 'Parsed from Datatracker doc.json title'],
        [cHtml.title, 'Parsed from RFC HTML citation/title'],
        [cTracker.title, 'Parsed from Datatracker HTML title metadata'],
        [cInfo.title, 'Parsed from RFC info page title metadata'],
        [`RFC ${rfcNum}`, 'Fallback to RFC identifier']
      ]);
      const titleRaw = titlePick.value;
      const docTitle = titleRaw.replace(/^RFC\s*\d+\s*[:\-–—]?\s*/i, '').trim() || `RFC ${rfcNum}`;
      if (titlePick.sourceNote) metaNotes.docTitle = titlePick.sourceNote;

      const publicationDatePick = pickDateWithSource([
        [trackerJson?.time, 'Parsed from Datatracker doc.json time'],
        [trackerJson?.published, 'Parsed from Datatracker doc.json published'],
        [trackerJson?.pub_date, 'Parsed from Datatracker doc.json pub_date'],
        [cHtml.publicationDate, 'Parsed from RFC HTML citation date'],
        [cTracker.publicationDate, 'Parsed from Datatracker HTML date metadata'],
        [cInfo.publicationDate, 'Parsed from RFC info page date metadata']
      ]);
      const publicationDate = publicationDatePick.value;
      if (publicationDatePick.sourceNote) metaNotes.publicationDate = publicationDatePick.sourceNote;

      const authorsPick = pickFirstArrayWithSource([
        [normalizeAuthorNames(trackerJson?.authors), 'Parsed from Datatracker doc.json authors'],
        [cHtml.authors, 'Parsed from RFC HTML citation_author metadata'],
        [cTracker.authors, 'Parsed from Datatracker HTML author metadata'],
        [cInfo.authors, 'Parsed from RFC info page author metadata']
      ]);
      const authors = authorsPick.value;
      if (authorsPick.sourceNote) metaNotes.authors = authorsPick.sourceNote;

      const doiPick = pickFirstWithSource([
        [cHtml.doi, 'Parsed from RFC HTML citation_doi'],
        [cTracker.doi, 'Parsed from Datatracker HTML DOI metadata'],
        [cInfo.doi, 'Parsed from RFC info page DOI metadata']
      ]);
      const doi = doiPick.value;
      if (doiPick.sourceNote) metaNotes.doi = doiPick.sourceNote;

      const issnPick = pickFirstWithSource([
        [cHtml.issn, 'Parsed from RFC HTML citation_issn'],
        [cTracker.issn, 'Parsed from Datatracker HTML ISSN metadata'],
        [cInfo.issn, 'Parsed from RFC info page ISSN metadata']
      ]);
      const issn = issnPick.value;
      if (issnPick.sourceNote) metaNotes.issn = issnPick.sourceNote;

      const reportPick = pickFirstWithSource([
        [cHtml.report, 'Parsed from RFC HTML technical report metadata'],
        [cTracker.report, 'Parsed from Datatracker HTML report metadata'],
        [cInfo.report, 'Parsed from RFC info page report metadata']
      ]);
      const report = reportPick.value;
      const docNumber = report ? report.replace(/^rfc/i, '') : rfcNum;
      if (reportPick.sourceNote) metaNotes.docNumber = reportPick.sourceNote;

      const abstractPick = pickFirstWithSource([
        [trackerJson?.abstract, 'Parsed from Datatracker doc.json abstract'],
        [cHtml.abstract, 'Parsed from RFC HTML abstract'],
        [cTracker.abstract, 'Parsed from Datatracker HTML abstract'],
        [cInfo.abstract, 'Parsed from RFC info page abstract']
      ]);
      const abstract = abstractPick.value;
      if (abstractPick.sourceNote) metaNotes.abstract = abstractPick.sourceNote;

      const pagesPick = pickFirstWithSource([
        [trackerJson?.pages, 'Parsed from Datatracker doc.json pages']
      ]);
      const pages = pagesPick.value;
      if (pagesPick.sourceNote) metaNotes.pages = pagesPick.sourceNote;

      const stdLevel = firstNonEmpty(trackerJson?.std_level);
      if (stdLevel) metaNotes['status.statusNote'] = 'Mapped from Datatracker doc.json std_level';
      const href = hrefFromDoiOrSeed(doi, seed);
      metaNotes.href = doi
        ? 'Derived from DOI (https://doi.org/<doi>)'
        : 'Retained from seed URL';

      const trackerText = $tracker ? $tracker.root().text() : '';
      const infoText = $info ? $info.root().text() : '';
      const combinedText = `${trackerText}\n${infoText}`;

      const relFromInfoDl = relationsFromInfoDl($info);

      const structuredSupersededBy = unique(relFromInfoDl.supersededBy);
      const structuredSupersedes = unique(relFromInfoDl.supersedes);
      const structuredAmendedBy = unique(relFromInfoDl.amendedBy);
      const structuredAmends = unique(relFromInfoDl.amends);

      // Only fall back to loose text extraction when structured relation data is absent.
      const fallbackSupersededBy = [];
      const fallbackSupersedes = [];
      const fallbackAmendedBy = [];
      const fallbackAmends = [];

      const supersededBy = unique([
        ...structuredSupersededBy,
        ...fallbackSupersededBy
      ]).filter(id => id !== `RFC${rfcNum}`);
      const supersedes = unique([
        ...structuredSupersedes,
        ...fallbackSupersedes
      ]).filter(id => id !== `RFC${rfcNum}`);
      const amendedBy = unique([
        ...structuredAmendedBy,
        ...fallbackAmendedBy
      ]).filter(id => id !== `RFC${rfcNum}`);
      const amends = unique([
        ...structuredAmends,
        ...fallbackAmends
      ]).filter(id => id !== `RFC${rfcNum}`);

      if (supersededBy.length) metaNotes['status.supersededBy'] = 'Parsed from RFC info page relation <dl>';
      if (supersedes.length) metaNotes['status.supersedes'] = 'Parsed from RFC info page relation <dl>';
      if (amendedBy.length) metaNotes['status.amendedBy'] = 'Parsed from RFC info page relation <dl>';
      if (amends.length) metaNotes['status.amends'] = 'Parsed from RFC info page relation <dl>';

      const errataUrls = unique([
        ...(($tracker ? $tracker('a[href*=\"errata\"]').map((_, a) => $tracker(a).attr('href')).get() : [])),
        ...(($info ? $info('a[href*=\"errata\"]').map((_, a) => $info(a).attr('href')).get() : [])),
        ...(($html ? $html('a[href*=\"errata\"]').map((_, a) => $html(a).attr('href')).get() : []))
      ]).map(h => {
        try { return new URL(h, datatrackerUrl).toString(); } catch { return null; }
      }).filter(isUsableErrataUrl);
      metaNotes['status.errataExist'] = 'Derived from presence of errata links on RFC/Datatracker pages';
      if (errataUrls.length) metaNotes['status.errataUrl'] = 'Parsed from errata links on RFC/Datatracker pages';

      let normative = [];
      let bibliographic = [];
      if ($html) {
        normative = refsFromSection($html, [
          'section#normative-references',
          'section[id*="normative"]'
        ]).filter(id => id !== `RFC${rfcNum}`);

        bibliographic = refsFromSection($html, [
          'section#references',
          'section#informative-references',
          'section[id*="informative"]',
          'section[id*="references"]'
        ]).filter(id => id !== `RFC${rfcNum}`);
      }

      const refs = {
        normative: unique(normative),
        bibliographic: unique(bibliographic)
      };
      if (refs.normative.length) metaNotes['references.normative'] = 'Parsed from RFC HTML normative references sections';
      if (refs.bibliographic.length) metaNotes['references.bibliographic'] = 'Parsed from RFC HTML references/informative sections';

      const classified = stdLevel
        ? classifyIetfFromStdLevel(stdLevel, { isDraft: false })
        : classifyIetfDoc(combinedText, { isDraft: false });
      if (!stdLevel && classified.statusNote) {
        metaNotes['status.statusNote'] = 'Mapped from RFC info/datatracker text classification';
      }

      const doc = {
        docId: `RFC${rfcNum}`,
        docLabel: toIetfLabel(`RFC ${rfcNum}`),
        docNumber,
        docTitle,
        docType: classified.docType,
        publicationDate,
        publisher: 'IETF',
        href,
        ...(abstract ? { abstract } : {}),
        ...(pages ? { pages } : {}),
        ...(authors.length ? { authors } : {}),
        ...(doi ? { doi } : {}),
        ...(issn ? { issn } : {}),
        status: {
          active: supersededBy.length === 0,
          latestVersion: supersededBy.length === 0,
          superseded: supersededBy.length > 0,
          supersededBy,
          supersedes,
          amendedBy,
          amends,
          ...(classified.statusNote ? { statusNote: classified.statusNote } : {}),
          errataExist: errataUrls.length > 0,
          errataUrl: errataUrls
        },
        ...(refs.normative.length || refs.bibliographic.length ? { references: refs } : {})
      };

      Object.defineProperty(doc, '__sourceUrl', { value: seed, enumerable: false });
      Object.defineProperty(doc, '__metaNotes', { value: metaNotes, enumerable: false });
      return [doc];
    }

    // Non-RFC: seed page + draft archive XML enrichment (when available).
    const { looksHtml, looksJson } = seedFormatHints(seed);
    let trackerJson = null;
    let $seed = null;
    const archiveXmlUrl = deriveArchiveXmlUrl(seed);
    let xml = {};

    // Prefer parsing HTML tags directly when the seed is an HTML page.
    if (looksHtml) {
      try { $seed = await fetchHtml(seed); } catch {}
      if (!$seed) {
        try { trackerJson = await fetchJson(seed); } catch {}
      }
    } else if (looksJson) {
      try { trackerJson = await fetchJson(seed); } catch {}
      if (!trackerJson) {
        try { $seed = await fetchHtml(seed); } catch {}
      }
    } else {
      // Unknown extension: try JSON first, then HTML, on the same seed URL.
      try { trackerJson = await fetchJson(seed); } catch {}
      if (!trackerJson) {
        try { $seed = await fetchHtml(seed); } catch {}
      }
    }

    if (!$seed && !trackerJson) {
      console.warn(`⚠️ IETF parse failed: unable to fetch non-RFC seed ${seed}`);
      return [];
    }
    if (archiveXmlUrl) {
      try {
        const $xml = await fetchXml(archiveXmlUrl);
        xml = xmlFrontBundle($xml);
      } catch {}
    }

    const cSeed = citationBundle($seed);
    const metaNotes = {};
    const seedDateHint = firstNonEmpty(
      $seed ? ($seed('meta[name="citation_date"]').attr('content') || '').trim() : '',
      $seed ? ($seed('time[datetime]').first().attr('datetime') || '').trim() : '',
      cSeed.publicationDate
    );

    // Explicit non-RFC source precedence by field:
    // - report/docNumber: XML -> seed HTML -> seed-inferred -> seed JSON
    // - title: XML -> seed HTML -> seed JSON -> seed path
    // - publicationDate: seed HTML -> XML -> seed JSON
    // - authors: XML OR seed HTML OR seed JSON (first non-empty source only; no merge)
    // - doi: XML -> seed HTML -> seed JSON
    // - abstract: XML -> seed HTML -> seed JSON
    // - pages/stdLevel: seed JSON only
    const reportPick = pickFirstWithSource([
      [xml.report, 'Parsed from archive XML (rfc@docName / seriesInfo Internet-Draft)'],
      [cSeed.report, 'Parsed from seed HTML metadata'],
      [inferReportFromSeed(seed), 'Inferred from seed URL draft slug'],
      [trackerJson?.name, 'Parsed from seed JSON name']
    ]);
    const report = reportPick.value;
    if (reportPick.sourceNote) metaNotes.docNumber = reportPick.sourceNote;

    const titlePick = pickFirstWithSource([
      [xml.title, 'Parsed from archive XML front/title'],
      [cSeed.title, 'Parsed from seed HTML title metadata'],
      [trackerJson?.title, 'Parsed from seed JSON title'],
      [safeText($seed, 'h1'), 'Parsed from seed HTML h1'],
      [report, 'Derived from draft identifier'],
      [seed, 'Fallback to seed URL']
    ]);
    const titleRaw = titlePick.value;
    if (titlePick.sourceNote) metaNotes.docTitle = titlePick.sourceNote;

    const publicationDatePick = pickDateWithSource([
      [seedDateHint, 'Parsed from seed HTML date metadata (citation/time datetime)'],
      [xml.publicationDate, 'Parsed from archive XML front/date'],
      [trackerJson?.time, 'Parsed from seed JSON time'],
      [trackerJson?.published, 'Parsed from seed JSON published'],
      [trackerJson?.pub_date, 'Parsed from seed JSON pub_date']
    ]);
    const publicationDate = publicationDatePick.value;
    if (publicationDatePick.sourceNote) metaNotes.publicationDate = publicationDatePick.sourceNote;

    const authorsPick = pickFirstArrayWithSource([
      [xml.authors, 'Parsed from archive XML front/author'],
      [cSeed.authors, 'Parsed from seed HTML author metadata'],
      [normalizeAuthorNames(trackerJson?.authors), 'Parsed from seed JSON authors']
    ]);
    const authors = authorsPick.value;
    if (authorsPick.sourceNote) metaNotes.authors = authorsPick.sourceNote;

    const doiPick = pickFirstWithSource([
      [normalizeDoi(xml.doi), 'Parsed from archive XML seriesInfo DOI'],
      [normalizeDoi(cSeed.doi), 'Parsed from seed HTML DOI metadata'],
      [normalizeDoi(trackerJson?.doi), 'Parsed from seed JSON doi'],
      [normalizeDoi(trackerJson?.doi_name), 'Parsed from seed JSON doi_name']
    ]);
    const doi = doiPick.value;
    if (doiPick.sourceNote) metaNotes.doi = doiPick.sourceNote;
    const issn = pickFirst(cSeed.issn);
    const abstractPick = pickFirstWithSource([
      [xml.abstract, 'Parsed from archive XML front/abstract'],
      [cSeed.abstract, 'Parsed from seed HTML abstract'],
      [trackerJson?.abstract, 'Parsed from seed JSON abstract']
    ]);
    const abstract = abstractPick.value;
    if (abstractPick.sourceNote) metaNotes.abstract = abstractPick.sourceNote;
    const pages = firstNonEmpty(trackerJson?.pages);
    if (pages) metaNotes.pages = 'Parsed from seed JSON pages';
    const stdLevel = firstNonEmpty(trackerJson?.std_level);
    if (stdLevel) metaNotes['status.statusNote'] = 'Mapped from seed JSON std_level';
    const href = hrefFromDoiOrSeed(doi, seed);
    const docNumber = '';
    const reportLower = String(report || '').toLowerCase();
    const isDraft = reportLower.startsWith('draft-') || seed.includes('/draft-');
    const docId = deriveNonRfcDocId({ seed, report, trackerJson, titleRaw });
    const docLabel = toIetfLabel(report || docId.replace(/^IETF\./i, ''));

    const classified = stdLevel
      ? classifyIetfFromStdLevel(stdLevel, { isDraft })
      : classifyIetfFromStdLevel('', { isDraft });

    const doc = {
      docId,
      docLabel,
      docTitle: titleRaw,
      docType: classified.docType,
      publicationDate,
      publisher: 'IETF',
      href,
      ...(abstract ? { abstract } : {}),
      ...(pages ? { pages } : {}),
      ...(authors.length ? { authors } : {}),
      ...(doi ? { doi } : {}),
      ...(issn ? { issn } : {}),
      status: {
        active: true,
        latestVersion: true,
        superseded: false,
        ...(classified.statusNote ? { statusNote: classified.statusNote } : {}),
        ...(isDraft ? { draft: true } : {}),
        errataExist: false
      }
    };

    Object.defineProperty(doc, '__sourceUrl', { value: seed, enumerable: false });
    Object.defineProperty(doc, '__metaNotes', { value: metaNotes, enumerable: false });
    return [doc];
  }

  async function extractFromUrl(rootUrl) {
    return extractFromSeedDoc(rootUrl);
  }

  return { extractFromSeedDoc, extractFromUrl };
}

module.exports = { createIetfParser };
