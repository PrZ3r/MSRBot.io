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

/**
 * Build a minimal, 1‑to‑1 search index directly from documents.json
 * plus friendly joins from groups.json/projects.json. No parallel truth;
 * all display fields derive from canonical registry fields.
 *
 * Output:
 *   build/docs/search-index.json  — flat rows for docList + client search
 *   build/docs/facets.json        — precomputed facet counts + labels
 */

const fs = require('fs').promises;
const path = require('path');
const { loadAllDocs } = require('../lib/registry');
const { noPageContentTypeSet, isPageGated } = require('../lib/pageGate');

/** Page gate config — gated contentTypes are excluded from the browse/search
 *  index (and facets), matching the per-doc page gate in build.js. */
let __gateSet;
let __siteConfig = {};
try {
  __siteConfig = require('../config/site.json');
  __gateSet = noPageContentTypeSet(__siteConfig);
} catch (e) {
  __gateSet = new Set();
}

/* Keyword chips for the doc-list facet rail.
 *
 * site.json `controlledKeywords` is the INDEXED vocabulary — every searchable
 * term (~990). Rendering one chip per term would be unusable, so the chip rail
 * is a curated subset, DERIVED HERE ON EVERY BUILD from three inputs:
 *
 *   1. count  — terms carried by >= curation.minDocs docs
 *   2. portal — every keyword any portal declares (portals.json `match.keyword`).
 *               Non-negotiable: portals filter on keywords, so a portal keyword
 *               with no chip is a portal you cannot browse.
 *   3. hand   — site.json facetKeywordCuration.add / .remove, applied last so
 *               curation always beats the heuristics.
 *
 * Nothing is hand-maintained: add a keyword to a portal (or to .add) and the
 * next build picks it up. There is deliberately no persisted `facetKeywords`
 * list — it is derived output, and a stored copy would go stale. */
const __curation = (__siteConfig && __siteConfig.facetKeywordCuration) || {};
const CHIP_MIN_DOCS = Number.isFinite(__curation.minDocs) ? __curation.minDocs : 30;
const CHIP_ADD = Array.isArray(__curation.add) ? __curation.add : [];
const CHIP_REMOVE = new Set((Array.isArray(__curation.remove) ? __curation.remove : []).map((s) => String(s).toLowerCase()));

/* Keywords any portal declares, so their chips always exist. */
function portalKeywords() {
  const out = new Set();
  try {
    const raw = require('fs').readFileSync(path.join('src', 'main', 'data', 'portals.json'), 'utf8');
    for (const m of raw.matchAll(/"keyword"\s*:\s*"([^"]+)"/g)) out.add(m[1]);
    for (const m of raw.matchAll(/"keywords"\s*:\s*\[([^\]]*)\]/g)) {
      for (const km of m[1].matchAll(/"([^"]+)"/g)) out.add(km[1]);
    }
  } catch { /* no portals — chips fall back to count + hand */ }
  return out;
}

/* True when `needle` appears in `hay` on whole-token boundaries. Deliberately
 * not a substring test: "AI" must match "Generative AI" and "AI-Driven Media"
 * but not "Chain", "Domain" or "Training". Hand-rolled rather than a \b regex so
 * chips containing regex metacharacters ("Test & Measurement", "Media Exchange
 * Layer (MXL)") need no escaping. MUST stay in sync with the same-named helper
 * in src/site/js/docList.js — this computes the counts, that applies the filter. */
function tokenContains(hay, needle) {
  const h = String(hay == null ? '' : hay).toLowerCase();
  const n = String(needle == null ? '' : needle).toLowerCase();
  if (!h || !n) return false;
  const isWord = (c) => /[a-z0-9]/.test(c);
  let i = 0;
  while ((i = h.indexOf(n, i)) !== -1) {
    const before = i === 0 ? '' : h[i - 1];
    const after = (i + n.length >= h.length) ? '' : h[i + n.length];
    if ((!before || !isWord(before)) && (!after || !isWord(after))) return true;
    i += 1;
  }
  return false;
}

/* Derive the chip list from the finished index rows. */
function deriveChips(rows) {
  const exact = new Map();
  for (const r of rows) {
    for (const k of new Set((r.keywords || []).map(String))) exact.set(k, (exact.get(k) || 0) + 1);
  }
  const chips = new Set();
  for (const [term, n] of exact) if (n >= CHIP_MIN_DOCS) chips.add(term);
  for (const term of portalKeywords()) chips.add(term);
  for (const term of CHIP_ADD) chips.add(term);
  for (const term of [...chips]) if (CHIP_REMOVE.has(term.toLowerCase())) chips.delete(term);
  // A chip need NOT be a vocabulary term itself — no doc carries the bare
  // keyword "AI", yet it token-matches "Generative AI" / "AI Ethics". The only
  // disqualifier is matching nothing at all.
  for (const c of [...chips]) {
    if (!rows.some((r) => (r.keywords || []).some((k) => tokenContains(k, c)))) chips.delete(c);
  }
  return [...chips].sort((a, b) => a.localeCompare(b));
}

/* True when `needle` appears in `hay` on whole-token boundaries. Deliberately
 * not a substring test: "AI" must match "Generative AI" and "AI-driven Media"
 * but not "Chain", "Domain" or "Training". Hand-rolled rather than a \b regex so
 * chips containing regex metacharacters ("Test & Measurement", "Media Exchange
 * Layer (MXL)") need no escaping. */
function tokenContains(hay, needle) {
  const h = String(hay == null ? '' : hay).toLowerCase();
  const n = String(needle == null ? '' : needle).toLowerCase();
  if (!h || !n) return false;
  const isWord = (c) => /[a-z0-9]/.test(c);
  let i = 0;
  while ((i = h.indexOf(n, i)) !== -1) {
    const before = i === 0 ? '' : h[i - 1];
    const after = (i + n.length >= h.length) ? '' : h[i + n.length];
    if ((!before || !isWord(before)) && (!after || !isWord(after))) return true;
    i += 1;
  }
  return false;
}

const GROUPS = path.join('src','main','data','groups.json');
const PROJECTS = path.join('src','main','data','projects.json');
const OUT = 'build/docs';
const DATA_OUT = path.join(OUT, '_data');
const IDX = path.join(DATA_OUT, 'search-index.json');
const FAC = path.join(DATA_OUT, 'facets.json');
const SYN = path.join('src','main','lib','synonyms.json'); // optional

/** Optional override: accept a built docs JSON snapshot path via argv[2].
 *  When omitted, the per-doc registry under src/main/data/docs/ is used. */
const DOCS_PATH = (process.argv[2] && String(process.argv[2]).trim()) || null;


/** Parse full ISO date → timestamp (or null) without throwing */
function toTs(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const t = Date.parse(dateStr);
  return Number.isNaN(t) ? null : t;
}

/** Compact/clean string helpers */
const compact = s => String(s || '').trim();
const squash = s => compact(s).replace(/\s+/g, ' ');

/** Build */
(async () => {
  const [docsRaw, groupsRaw, projectsRaw] = await Promise.all([
    DOCS_PATH ? fs.readFile(DOCS_PATH, 'utf8').catch(() => '[]') : Promise.resolve('[]'),
    fs.readFile(GROUPS, 'utf8').catch(() => '[]'),
    fs.readFile(PROJECTS, 'utf8').catch(() => '[]'),
  ]);

  /** Canonical sources */
  const docs = DOCS_PATH ? JSON.parse(docsRaw) : loadAllDocs();
  const groups = JSON.parse(groupsRaw);
  const projects = JSON.parse(projectsRaw);

  await fs.mkdir(OUT, { recursive: true });
  await fs.mkdir(DATA_OUT, { recursive: true });

  /** Reverse-lookup: docId → [groupIds] (from groups.json) */
  const groupsByDoc = new Map();
  for (const g of Array.isArray(groups) ? groups : []) {
    const list = Array.isArray(g.docs) ? g.docs
               : Array.isArray(g.documents) ? g.documents : [];
    for (const did of list) {
      if (!did) continue;
      const arr = groupsByDoc.get(did) || [];
      const gid = g.groupId || g.id || g.name;
      if (gid && !arr.includes(gid)) arr.push(gid);
      groupsByDoc.set(did, arr);
    }
  }

  /** GroupId → Friendly label: "org name desc" (squashed) */
  const groupNameById = new Map();
  for (const g of Array.isArray(groups) ? groups : []) {
    const gid = g.groupId || g.id || g.name;
    if (!gid) continue;
    const parts = [g.groupOrg, g.groupName || g.name || gid, g.groupDesc]
      .map(squash)
      .filter(Boolean);
    const full = parts.join(' ');
    groupNameById.set(gid, full || String(gid));
  }

  /** currentWork join from projects.json and workInfo.review */
  const workByDoc = new Map();
  function pushWork(did, label){
    if (!did || !label) return;
    const arr = workByDoc.get(did) || [];
    if (!arr.includes(label)) arr.push(label);
    workByDoc.set(did, arr);
  }

  for (const p of Array.isArray(projects) ? projects : []) {
    const wt = p.workType;
    const ps = p.projectStatus;
    if (ps !== "Complete") {
      const label = [wt, ps].filter(Boolean).join(' - ');
      if (p.docId && label) pushWork(p.docId, label);
      const affected = Array.isArray(p.docAffected) ? p.docAffected : [];
      for (const did of affected) pushWork(did, label);
    }
  }

  /** Build the flat, minimal index strictly from canonical doc fields */
  const idx = [];
  let gatedCount = 0;
  const icsCodeLabels = {};
  for (const d of Array.isArray(docs) ? docs : []) {
    if (!d || !d.docId) continue;
    // Page gate: gated contentTypes stay in the API but not the browse index.
    if (isPageGated(d, __gateSet)) { gatedCount++; continue; }

    const label = d.docLabel;
    const baseTitle = d.docTitle || '';
    const suiteTitle = d.docSuiteTitle || d.suiteTitle || '';
    const title = suiteTitle
      ? `${suiteTitle} — ${baseTitle || suiteTitle}`
      : baseTitle || suiteTitle;

    // Status: derive canonical booleans, then emit an array of all true flags
    const st = (d.status && typeof d.status === 'object') ? d.status : {};
    const statusFlags = {
      active: !!st.active,
      latestVersion: !!st.latestVersion,
      superseded: !!st.superseded,
      withdrawn: !!st.withdrawn,
      draft: !!st.draft,
      stabilized: !!st.stabilized,
      reaffirmed: !!st.reaffirmed,
      amended: !!st.amended,
      versionless: !!st.versionless
    };
    // Guardrails: normalize implied relationships
    //if (statusFlags.latestVersion) {
    //  statusFlags.active = true;
    //  statusFlags.superseded = false;
    //  statusFlags.withdrawn = false;
    //}
    if (statusFlags.withdrawn) {
      statusFlags.latestVersion = false;
    }
    // Emit "status" as an array of every true flag; no primary/singleton
    const status = Object.entries(statusFlags)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    if (!status.length) status.push('unknown');

    // Publication dating (full string + parsed timestamp + year)
    const pubDate = d.publicationDate || '';
    const pubTs = toTs(pubDate);
    const year = /^\d{4}/.test(pubDate) ? parseInt(pubDate.slice(0,4), 10) : null;

    // Group membership: prefer doc.group; fallback to groups.json reverse index
    let group = [];
    if (Array.isArray(d.group)) group = d.group.filter(Boolean);
    else if (d.group) group = [d.group];
    else group = groupsByDoc.get(d.docId) || [];
    const groupNames = group.map(gid => groupNameById.get(gid) || gid);

    // Current work from projects + reviewNeeded flags
    const currentWork = (workByDoc.get(d.docId) || []).slice();
    const works = d.workInfo || {};
    if (works && works.review && Array.isArray(works.review)) {
      for (const r of works.review) {
        const rP = r && r.reviewPeriod;
        const rN = r && r.reviewNeeded;
        if (rN === true && rP) currentWork.push(`${rP} Review Needed`);
      }
    }
    const hasCurrentWork = currentWork.length > 0;

    // Keywords:
    // - facetKeywords: from canonical d.keywords array (for filtering)
    // - searchKeywords: assembled terms for free-text search
    const facetKeywords = Array.isArray(d.keywords) ? d.keywords.map(squash).filter(Boolean) : [];

    // Normalize authors to strings for search — supports ["Last, First"] or [{ name, bio?, affiliation? }]
    const authorsList = Array.isArray(d.authors)
      ? d.authors
          .map(a => {
            if (!a) return null;
            if (typeof a === 'string') return a;
            if (typeof a === 'object') {
              const parts = [a.name, a.familyName || a.last || a.surname, a.givenName || a.first || a.forename];
              const joined = parts.filter(Boolean).join(' ').trim();
              return joined || null;
            }
            return null;
          })
          .filter(Boolean)
          .map(squash)
      : [];

    // Affiliations: emit as a facet AND index for search. Object-form authors only.
    const affiliationsList = Array.isArray(d.authors)
      ? d.authors
          .map(a => (a && typeof a === 'object' && a.affiliation) ? String(a.affiliation).trim() : null)
          .filter(Boolean)
      : [];
    const affiliationsFacet = Array.from(new Set(affiliationsList));

    // Author bios — full-text searchable (not faceted; too long).
    const biosList = Array.isArray(d.authors)
      ? d.authors
          .map(a => (a && typeof a === 'object' && a.bio) ? squash(String(a.bio)) : null)
          .filter(Boolean)
      : [];

    // ICS classification codes — facet by code; descriptions collected for
    // the icsCodeLabels map emitted into facets.json (first non-empty wins —
    // the ISO code → description mapping is canonical, so any per-doc copy
    // is fine).
    const icsCodesList = [];
    if (Array.isArray(d.icsCodes)) {
      for (const c of d.icsCodes) {
        if (!c || typeof c !== 'object' || !c.code) continue;
        const code = String(c.code).trim();
        if (!code) continue;
        icsCodesList.push(code);
        if (!icsCodeLabels[code] && c.description) {
          icsCodeLabels[code] = String(c.description).trim();
        }
      }
    }

    // doiAliases — search index only, so ISBN-form / legacy DOIs resolve to canonical
    const doiAliasesList = Array.isArray(d.doiAliases)
      ? d.doiAliases.map(s => String(s).trim()).filter(Boolean)
      : [];

    const searchKeywords = Array.from(
      new Set(
        [
          //d.docId,
          title,
          //d.docTitle,
          d.docLabel,
          d.abbrevTitle,
          ...authorsList,
          ...affiliationsList.map(squash),
          ...biosList,
          ...doiAliasesList.map(squash),
          ...(Array.isArray(currentWork) ? currentWork : [])
        ]
          .filter(Boolean)
          .map(squash)
      )
    );

    // Minimal row — 1‑to‑1 with canonical where applicable
    idx.push({
      id: d.docId,
      title,                 // display title for cards
      label,                 // canonical label (useful for details view)
      publisher: d.publisher || 'Unknown',
      docType: d.docType,                  // required field
      docTypeAbr: d.docTypeAbr || null,    // optional abbreviation (e.g., ST, RP)
      contentType: d.contentType || null,  // journal-article subtype (filter via ?f.contentType=)
      status,                // array of all true flags (no primary)
      statusFlags,           // canonical booleans
      pubDate,               // full canonical date
      pubTs,                 // parsed timestamp for sort
      year,
      hasDoi: Boolean(d.doi),
      doi: d.doi || null,
      releaseTag: d.releaseTag,
      hasReleaseTag: Boolean(d.releaseTag),
      authors: d.authors,
      group,
      groupNames,
      currentWork,
      hasCurrentWork,
      keywords: facetKeywords,        // facet values (from documents.json)
      keywordsSearch: searchKeywords, // assembled search tokens
      icsCodes: icsCodesList,         // facet values (codes only; descriptions stay in API)
      affiliations: affiliationsFacet,// facet values from authors[].affiliation
      abbrevTitle: d.abbrevTitle || null,
      href: d.href || null,
      docBase: d.docBase || null,
      docBaseLabel: d.docBaseLabel || null
    });
  }

  /* Chips are derived from the finished index rows on every build — count bar +
   * portal-declared keywords + site.json hand curation. Nothing to hand-maintain. */
  const FACET_KEYWORDS = deriveChips(idx);

  /** Build facet counts (using the flat index) */
  const facets = {
    publisher: {},
    group: {},
    docType: {},
    status: {},
    statusLabels: {
      active: "Active",
      latestVersion: "Latest Version",
      superseded: "Superseded",
      withdrawn: "Withdrawn",
      draft: "Draft",
      stabilized: "Stabilized",
      reaffirmed: "Reaffirmed",
      amended: "Amended",
      versionless: "Versionless",
      unknown: "Unknown"
    },
    year: {},
    currentWork: {},
    keywords: {},
    contentType: {},
    icsCodes: {},
    // affiliations: {} — facet bucket disabled, see follow-up issue for
    // fuzzy/canonical-name normalization. The per-doc affiliations array is
    // still emitted on each idx row so:
    //   - full-text search keeps matching affiliation strings
    //   - URL filters like ?f.affiliations=<exact string> still work
    // Just no picker UI until the ~7k raw strings collapse to ~1-2k canonical
    // institutions.
    hasDoi: { true: 0, false: 0 },
    hasReleaseTag: { true: 0, false: 0 },
    groupLabels: Object.fromEntries(Array.from(groupNameById.entries())),
    contentTypeLabels: (__siteConfig && __siteConfig.contentTypeLabels) || {},
    icsCodeLabels
  };

  for (const r of idx) {
    facets.publisher[r.publisher] = (facets.publisher[r.publisher] || 0) + 1;
    if (Array.isArray(r.group)) {
      for (const g of r.group) {
        if (!g) continue;
        facets.group[g] = (facets.group[g] || 0) + 1;
      }
    }
    facets.docType[r.docType] = (facets.docType[r.docType] || 0) + 1;
    if (Array.isArray(r.status) && r.status.length) {
      for (const s of r.status) {
        facets.status[s] = (facets.status[s] || 0) + 1;
      }
    } else {
      const s = r.status || 'unknown';
      facets.status[s] = (facets.status[s] || 0) + 1;
    }
    if (r.year != null) facets.year[r.year] = (facets.year[r.year] || 0) + 1;
    if (Array.isArray(r.currentWork)) {
      for (const w of r.currentWork) {
        const key = String(w).trim();
        if (!key) continue;
        facets.currentWork[key] = (facets.currentWork[key] || 0) + 1;
      }
    }
    // Keyword chips are the CURATED site.json facetKeywords list — not every
    // distinct doc keyword. doc.keywords is the full indexed vocabulary (~1k
    // terms, all searchable); rendering one chip per term would be unusable.
    // A doc matches a chip when any of its keywords contains the chip as a
    // whole token, so "AI" aggregates "Generative AI" / "AI Ethics" /
    // "AI-driven Media" — but never "Chain" / "Domain" / "Training".
    if (Array.isArray(r.keywords) && FACET_KEYWORDS.length) {
      for (const chip of FACET_KEYWORDS) {
        if (r.keywords.some((k) => tokenContains(k, chip))) {
          facets.keywords[chip] = (facets.keywords[chip] || 0) + 1;
        }
      }
    }
    if (r.contentType) {
      const at = String(r.contentType).trim();
      if (at) facets.contentType[at] = (facets.contentType[at] || 0) + 1;
    }
    if (Array.isArray(r.icsCodes)) {
      for (const c of r.icsCodes) {
        const key = String(c).trim();
        if (!key) continue;
        facets.icsCodes[key] = (facets.icsCodes[key] || 0) + 1;
      }
    }
    // affiliations facet bucket disabled — see facets dict initializer above.
    facets.hasDoi[String(r.hasDoi)]++;
    facets.hasReleaseTag[String(r.hasReleaseTag)]++;
  }

  /** Optional assets: synonyms + MiniSearch UMD for client */
  try {
    // Copy synonyms.json if present
    const synRaw = await fs.readFile(SYN, 'utf8').catch(() => null);
    if (synRaw) {
      await fs.writeFile(path.join(DATA_OUT, 'synonyms.json'), synRaw, 'utf8');
    }
  } catch (e) {
    console.warn('[docList] No synonyms.json found (optional):', e && e.message ? e.message : e);
  }
  // --- MiniSearch UMD: ensure a browser-usable bundle is available under build/docs/minisearch/umd/index.min.js ---
  try {
    const https = require('https');
    const destDir = path.join(OUT, 'minisearch', 'umd');
    const destUmd = path.join(destDir, 'index.min.js');
    await fs.mkdir(destDir, { recursive: true });

    async function pathExists(p){
      try { await fs.stat(p); return true; } catch { return false; }
    }
    async function fetchToFile(url, outFile){
      await fs.mkdir(path.dirname(outFile), { recursive: true });
      await new Promise((resolve, reject) => {
        https.get(url, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            // follow redirects
            return fetchToFile(res.headers.location, outFile).then(resolve, reject);
          }
          if (res.statusCode !== 200) return reject(new Error(`GET ${url} -> ${res.statusCode}`));
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', async () => {
            try {
              const buf = Buffer.concat(chunks);
              await fs.writeFile(outFile, buf);
              resolve();
            } catch (e) { reject(e); }
          });
        }).on('error', reject);
      });
    }

    // Prefer a locally installed UMD if present
    const localUmd = path.join('node_modules', 'minisearch', 'dist', 'umd', 'index.min.js');
    if (await pathExists(localUmd)) {
      const data = await fs.readFile(localUmd);
      await fs.writeFile(destUmd, data);
    } else {
      // Fallback to CDN
      try {
        await fetchToFile('https://cdn.jsdelivr.net/npm/minisearch/dist/umd/index.min.js', destUmd);
      } catch {
        await fetchToFile('https://unpkg.com/minisearch/dist/umd/index.min.js', destUmd);
      }
    }
  } catch (e) {
    console.warn('[docList] Could not acquire MiniSearch UMD (local or CDN):', e && e.message ? e.message : e);
    console.warn('[docList] Search will fall back to plain includes() if MiniSearch cannot be loaded.');
  }

  /** Write outputs */
  await fs.writeFile(IDX, JSON.stringify(idx, null, 2), 'utf8');
  await fs.writeFile(FAC, JSON.stringify(facets, null, 2), 'utf8');
  console.log(`[docList] Wrote ${IDX} (${idx.length} docs, ${gatedCount} gated by contentType), ${FAC}`);
})().catch(err => {
  console.error('[docList] Index build failed:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});