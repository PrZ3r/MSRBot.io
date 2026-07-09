/*
 * canonicalFieldBackfill.js — field-diff follow-up passes 1-3.
 *
 * Backfills (write with --apply, dry-run default):
 *
 *   1. pubMonth   registry publicationDate has the Jan-1 placeholder
 *                 pattern (yyyy-01-01) while canonical carries a real,
 *                 different month → rewrite to yyyy-<mm>-<dd|01>.
 *                 Only placeholder dates are ever touched.
 *   2. journalTitle  new schema 2.4.0 field — era-accurate journal name
 *                 (Transactions → JSMPE → SMPTE Journal → MIJ …) from the
 *                 canonical periodical parent. Journal-kind only; the
 *                 conference-side equivalent runs with the conference
 *                 metadata pass later.
 *   3. abstract   registry empty, canonical has one (cleaned of embedded
 *                 <!--xref--> comments / entities).
 *   4. keywords   registry empty, canonical has a set.
 *
 * Review reports (never written from):
 *   authorsDrift.md   89 docs where loose-name author sets differ
 *   abstractDrift.md  126 docs where both sides have abstracts that differ
 *
 * Usage:
 *   node .../canonicalFieldBackfill.js            # dry-run
 *   node .../canonicalFieldBackfill.js --apply
 *
 * Reports:
 *   src/main/reports/smpte-canonical-audit/canonicalFieldBackfill.md
 *   src/main/reports/smpte-canonical-audit/authorsDrift.md
 *   src/main/reports/smpte-canonical-audit/abstractDrift.md
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs, docAbsPath } = require('../../../lib/registry');

const REPORTS = 'src/main/reports/smpte-canonical-audit';
const APPLY = process.argv.includes('--apply');
const APPLY_AUTHORS = process.argv.includes('--apply-authors');
const APPLY_KW_MERGE = process.argv.includes('--apply-keywords-merge');
const APPLY_TITLES = process.argv.includes('--apply-titles');
const NOW = new Date().toISOString();
const VERSION = 'smpte-canonical-repo@v1';

// ---- text cleaning -------------------------------------------------------
function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function cleanText(s) {
  if (s == null) return null;
  const out = decodeEntities(String(s).replace(/<!--[\s\S]*?-->/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return out || null;
}
function normText(s) {
  if (s == null) return '';
  return cleanText(s)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’‚′']/g, "'").replace(/[“”„″"]/g, '"').replace(/[‐-―−-]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
// ---- title markup → Unicode ----------------------------------------------
// Canonical titles occasionally carry IEEE inline markup (<tex>, <sup>, <inf>).
// Convert the known patterns; if any markup survives, the caller must treat
// the title as unconvertible and skip it.
const SUP_DIGITS = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const SUB_DIGITS = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
const VULGAR = { '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞' };
function texToUnicode(s) {
  let out = String(s);
  // <tex>$...$</tex> fraction forms: {a\over b} and \frac{a}{b}
  out = out.replace(/<tex>\s*\$\s*\{?\s*(\d+)\s*\\over\s*(\d+)\s*\}?\s*\$\s*<\/tex>/gi,
    (_, a, b) => VULGAR[`${a}/${b}`] || `${a}/${b}`);
  out = out.replace(/<tex>\s*\$\s*\\frac\s*\{(\d+)\}\s*\{(\d+)\}\s*\$\s*<\/tex>/gi,
    (_, a, b) => VULGAR[`${a}/${b}`] || `${a}/${b}`);
  // <sup>digits</sup> → superscript chars; <sup>text</sup> → plain text
  out = out.replace(/<sup>(\d+)<\/sup>/gi, (_, dd) => dd.split('').map(c => SUP_DIGITS[c] || c).join(''));
  out = out.replace(/<sup>([^<]*)<\/sup>/gi, '$1');
  // <inf>digits</inf> → subscript chars; <inf>text</inf> → plain text
  out = out.replace(/<inf>(\d+)<\/inf>/gi, (_, dd) => dd.split('').map(c => SUB_DIGITS[c] || c).join(''));
  out = out.replace(/<inf>([^<]*)<\/inf>/gi, '$1');
  return out;
}
function hasMarkup(s) { return /<[a-zA-Z][^>]*>/.test(String(s)); }

function looseName(s) {
  const tokens = normText(s).split(' ').filter(Boolean);
  if (!tokens.length) return '';
  const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
  return `${longest}:${tokens[0][0] || ''}`;
}
function regAuthorName(a) {
  if (typeof a === 'string') return a;
  if (a && typeof a === 'object') return a.name || '';
  return '';
}

// ---- title-drift bucket logic (mirrors titleDriftReport.mjs; user review
// 2026-07-09: canonical wins in every bucket EXCEPT reg-extends and
// far-reg-specific, where the registry carries detail canonical lost).
const GENERIC_TITLE = /^(book review(s)?|books reviewed|american national standards?|approved american national standards?|smpte recommended practices?|proposed smpte recommended practices?|international standards?|new products( and developments)?|obituar(y|ies)|letters? to the editor|standards and recommended practices|proposed american national standards?|current literature|new members|meetings? of the board of governors|technical literature|society announcements|employment service|book received|abstracts of current literature)$/;
function isGenericTitle(s) { const n = normText(s); return GENERIC_TITLE.test(n) || n.split(' ').filter(Boolean).length <= 2; }
function titleCanonicalWins(regTitle, canTitle) {
  const rn = normText(regTitle), cn = normText(canTitle);
  if (cn.startsWith(rn)) return true;             // canon-extends
  if (rn.startsWith(cn)) return false;            // reg-extends — registry richer
  if (cn.includes(rn)) return true;               // canon-contains
  if (rn.includes(cn)) return true;               // reg-contains — reviewed: canonical
  const rSet = new Set(rn.split(' ')), cSet = new Set(cn.split(' '));
  const inter = [...rSet].filter(x => cSet.has(x)).length;
  const jac = inter / (rSet.size + cSet.size - inter);
  if (jac >= 0.5) return true;                    // near-different
  if (!isGenericTitle(regTitle) && isGenericTitle(canTitle)) return false; // far-reg-specific
  return true;                                    // far-canon-specific / both-generic / both-specific
}

// ---- canonical flatten ---------------------------------------------------
const canon = new Map();
{
  const j = JSON.parse(fs.readFileSync(path.join(REPORTS, 'canonicalLibrary.journal.json'), 'utf8'));
  const c = JSON.parse(fs.readFileSync(path.join(REPORTS, 'canonicalLibrary.conference.json'), 'utf8'));
  for (const p of j.periodicals) for (const v of p.volumes) for (const i of v.issues) for (const a of i.articles) {
    if (!a.doi) continue;
    canon.set(a.doi.trim(), {
      title: a.title, abstract: a.abstract,
      year: a.pubDate?.year ?? null, month: a.pubDate?.month ?? null, day: a.pubDate?.day ?? null,
      authors: (a.authors || []).map(x => x.name).filter(Boolean),
      keywords: a.keywords || [],
      journalTitle: p.title, kind: 'journal',
    });
  }
  for (const cf of c.conferences) for (const a of cf.articles) {
    if (!a.doi) continue;
    canon.set(a.doi.trim(), {
      title: a.title, abstract: a.abstract,
      year: a.pubDate?.year ?? null, month: a.pubDate?.month ?? null, day: a.pubDate?.day ?? null,
      authors: (a.authors || []).map(x => x.name).filter(Boolean),
      keywords: a.keywords || [],
      journalTitle: cf.title, kind: 'conference',
    });
  }
}
console.log(`[backfill] canonical DOIs: ${canon.size}`);

// keyword vocab: lower -> canonical vocab casing, plus curated synonym folds
const site = JSON.parse(fs.readFileSync('src/main/config/site.json', 'utf8'));
const vocabByLower = new Map((site.controlledKeywords || []).map(k => [k.toLowerCase(), k]));
let kwFolds = {};
try {
  kwFolds = JSON.parse(fs.readFileSync(path.join(REPORTS, 'keywordVocabDecisions.json'), 'utf8')).folds || {};
} catch { console.warn('[backfill] keywordVocabDecisions.json not found — keywords fill will use vocab matches only'); }

const docs = loadAllDocs();

// ---- walk -----------------------------------------------------------------
const changes = []; // { doc, field, path: [..], newValue, note, originalValue }
const authorsDrift = [];
const abstractDrift = [];
const titleKeepOurs = [];         // registry-richer rows → push-back register
const titleSkippedMarkup = [];    // unconvertible markup — never written raw
const titleMarkupConversions = []; // before/after for the 16 markup rows
const tally = { pubYear: 0, pubMonth: 0, journalTitle: 0, abstract: 0, keywords: 0 };
const skipped = { pubMonthConflict: 0, lockedField: 0 };

function isLocked(doc, key) {
  const m = doc[`${key}$meta`];
  return m && m.excludeChanges === true;
}

// pubYear drift — user reviewed all 5 surviving rows on 2026-07-08 and
// confirmed canonical is correct in each (2↔5 keying errors and similar).
// Full-date rewrite from canonical year+month (day 01 when canonical has none).
const APPROVED_PUBYEAR_FIXES = new Set([
  '10.5594-J05436',
  '10.5594-J15292',
  '10.5594-J17253',
  '10.5594-J18005',
  '10.5594-M00395',
]);

// Author count-mismatch drift — user reviewed all 15 rows on 2026-07-08:
// canonical is correct in every case (junk initials, missing coauthors,
// and outright wrong author lists on the registry side). Author arrays
// are REBUILT from canonical names; bio/affiliation carried over where a
// registry author loosely matches by name, else plain {name}.
const APPROVED_AUTHOR_COUNT_FIXES = new Set([
  '10.5594-J01003', '10.5594-J05083', '10.5594-J05722', '10.5594-J07544',
  '10.5594-J10421', '10.5594-J10863', '10.5594-J11525', '10.5594-J11679',
  '10.5594-J11743', '10.5594-J13515', '10.5594-J14913', '10.5594-J15588',
  '10.5594-J17816', '10.5594-M00524', '10.5594-j18591',
]);

for (const doc of docs) {
  if (!doc.doi) continue;
  const hit = canon.get(String(doc.doi).trim());
  if (!hit) continue;

  // 0. pubYear — the 5 user-approved digit-error fixes (canonical wins)
  if (APPROVED_PUBYEAR_FIXES.has(doc.docId) && hit.year) {
    const mm = hit.month != null && Number(hit.month) >= 1 && Number(hit.month) <= 12
      ? String(hit.month).padStart(2, '0') : '01';
    const dd = hit.day != null ? String(hit.day).padStart(2, '0') : '01';
    const newDate = `${hit.year}-${mm}-${dd}`;
    if (String(doc.publicationDate || '') !== newDate && !isLocked(doc, 'publicationDate')) {
      changes.push({
        doc, field: 'pubYear', key: 'publicationDate',
        newValue: newDate,
        originalValue: doc.publicationDate || null,
        note: 'Year corrected from SMPTE canonical repository (registry had digit-level keying error; approved 2026-07-08)',
      });
      tally.pubYear = (tally.pubYear || 0) + 1;
    }
  }

  // 1. pubMonth — only the yyyy-01-01 placeholder pattern
  const pd = String(doc.publicationDate || '');
  const m = pd.match(/^(\d{4})-01-01$/);
  if (m && hit.month != null && Number(hit.month) >= 1 && Number(hit.month) <= 12 && Number(hit.month) !== 1
      && String(hit.year) === m[1]) {
    if (isLocked(doc, 'publicationDate')) { skipped.lockedField++; }
    else {
      const mm = String(hit.month).padStart(2, '0');
      const dd = hit.day != null ? String(hit.day).padStart(2, '0') : '01';
      changes.push({
        doc, field: 'pubMonth', key: 'publicationDate',
        newValue: `${m[1]}-${mm}-${dd}`,
        originalValue: pd,
        note: 'Month corrected from SMPTE canonical repository (registry had Jan-1 placeholder)',
      });
      tally.pubMonth++;
    }
  }

  // 1b. docTitle — canonical wins per the 2026-07-09 title-drift review,
  // except the two registry-richer buckets (kept + push-back). Canonical
  // markup (<tex>/<sup>/<inf>) converts to Unicode; titles with surviving
  // markup are skipped and flagged, never written raw.
  const canTitleConverted = hit.title ? texToUnicode(cleanText(hit.title)) : null;
  if (doc.docTitle && canTitleConverted && normText(doc.docTitle) !== normText(canTitleConverted)) {
    if (isLocked(doc, 'docTitle')) { skipped.lockedField++; }
    else if (titleCanonicalWins(doc.docTitle, canTitleConverted)) {
      const converted = canTitleConverted;
      if (hasMarkup(converted)) {
        titleSkippedMarkup.push({ docId: doc.docId, canonical: hit.title });
      } else {
        changes.push({
          doc, field: 'title', key: 'docTitle',
          newValue: converted,
          originalValue: doc.docTitle,
          note: 'Title updated from SMPTE canonical repository (2026-07-09 drift review: canonical richer/cleaner; TeX/sup/inf converted to Unicode)',
        });
        tally.title = (tally.title || 0) + 1;
        if (/<(tex|sup|inf)/i.test(String(hit.title))) {
          titleMarkupConversions.push({ docId: doc.docId, from: doc.docTitle, to: converted });
        }
      }
    } else {
      titleKeepOurs.push({ docId: doc.docId, registry: doc.docTitle, canonical: canTitleConverted });
    }
  }

  // 2. journalTitle — journal-kind only, registry empty (new field, always empty today)
  if (hit.kind === 'journal' && hit.journalTitle && !doc.journalTitle) {
    changes.push({
      doc, field: 'journalTitle', key: 'journalTitle',
      newValue: cleanText(hit.journalTitle),
      originalValue: null,
      note: 'Era-accurate journal title from SMPTE canonical repository (periodical parent at time of publication)',
    });
    tally.journalTitle++;
  }

  // 3. abstract — registry empty, canonical present
  const regAbsEmpty = doc.abstract == null || String(doc.abstract).trim() === '';
  const canAbs = cleanText(hit.abstract);
  if (regAbsEmpty && canAbs) {
    if (isLocked(doc, 'abstract')) { skipped.lockedField++; }
    else {
      changes.push({
        doc, field: 'abstract', key: 'abstract',
        newValue: canAbs,
        originalValue: null,
        note: 'Backfilled from SMPTE canonical repository',
      });
      tally.abstract++;
    }
  } else if (!regAbsEmpty && canAbs) {
    // drift report — both present, normalized-prefix differs
    const rp = normText(doc.abstract).slice(0, 120);
    const cp = normText(canAbs).slice(0, 120);
    if (rp !== cp) abstractDrift.push({ docId: doc.docId, registry: String(doc.abstract).slice(0, 160), canonical: canAbs.slice(0, 160) });
  }

  // 4. keywords — RE-ENABLED 2026-07-09 after the vocab curation round.
  // Each canonical index_term maps through: (a) case-insensitive match
  // against site.json controlledKeywords (350 entries incl. the 56 adds
  // from keywordVocabCandidates review) → vocab casing; (b) the FOLD
  // synonym table from keywordVocabDecisions.json; (c) otherwise dropped.
  // Only docs that end up with ≥1 mapped term are written.
  const regKwEmpty = !Array.isArray(doc.keywords) || doc.keywords.length === 0;
  const canKw = (hit.keywords || []).map(cleanText).filter(Boolean);
  if (regKwEmpty && canKw.length) {
    if (isLocked(doc, 'keywords')) { skipped.lockedField++; }
    else {
      const mapped = [];
      const seen = new Set();
      for (const k of canKw) {
        const lo = k.toLowerCase();
        let target = vocabByLower.get(lo) || null;
        if (!target && kwFolds[lo]) target = kwFolds[lo];
        if (!target) continue;
        const key = target.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        mapped.push(target);
      }
      if (mapped.length) {
        changes.push({
          doc, field: 'keywords', key: 'keywords',
          newValue: mapped,
          originalValue: null,
          note: 'Backfilled from SMPTE canonical repository index_terms, mapped through controlledKeywords + curated synonym folds (keywordVocabDecisions.json)',
        });
        tally.keywords++;
      }
    }
  } else if (!regKwEmpty && canKw.length) {
    // 4b. keywords MERGE — doc already has keywords; union in any canonical
    // terms that map to vocab and aren't present yet. Existing list order
    // and casing preserved; new terms appended. Written only under
    // --apply-keywords-merge.
    if (!isLocked(doc, 'keywords')) {
      const have = new Set(doc.keywords.map(k => String(k).toLowerCase()));
      const additions = [];
      for (const k of canKw) {
        const lo = k.toLowerCase();
        let target = vocabByLower.get(lo) || null;
        if (!target && kwFolds[lo]) target = kwFolds[lo];
        if (!target) continue;
        const key = target.toLowerCase();
        if (have.has(key)) continue;
        have.add(key);
        additions.push(target);
      }
      if (additions.length) {
        changes.push({
          doc, field: 'keywordsMerge', key: 'keywords',
          newValue: [...doc.keywords, ...additions],
          originalValue: doc.keywords,
          note: 'Union-merged canonical repository index_terms into existing keywords (vocab-mapped; existing entries preserved verbatim)',
        });
        tally.keywordsMerge = (tally.keywordsMerge || 0) + 1;
      }
    }
  }

  // authors — both present, loose-name sets differ.
  // Same-count drift = canonical name wins (approved 2026-07-08): prefix
  // junk ('Mr.', 'By'), initial expansion, and OCR spelling fixes. Names
  // are replaced POSITIONALLY on the existing author objects so bio /
  // affiliation enrichment survives. Count-mismatch rows stay review-only
  // (authorsCountDiff — mixed bag incl. possible cross-matched articles).
  const regAuthors = (doc.authors || []).map(regAuthorName).filter(Boolean);
  if (regAuthors.length && hit.authors.length) {
    const regSet = new Set(regAuthors.map(looseName));
    const canSet = new Set(hit.authors.map(looseName));
    const equal = regSet.size === canSet.size && [...regSet].every(x => canSet.has(x));
    if (!equal) {
      if (regAuthors.length === hit.authors.length && !isLocked(doc, 'authors')) {
        const newAuthors = (doc.authors || []).map((a, i) => {
          const cleanName = cleanText(hit.authors[i]);
          if (typeof a === 'string') return cleanName;
          return { ...a, name: cleanName };
        });
        changes.push({
          doc, field: 'authors', key: 'authors',
          newValue: newAuthors,
          originalValue: doc.authors,
          note: 'Author names corrected from SMPTE canonical repository (prefix junk / initials / OCR spelling; positional replace preserving bio+affiliation; approved 2026-07-08)',
        });
        tally.authors = (tally.authors || 0) + 1;
      } else if (APPROVED_AUTHOR_COUNT_FIXES.has(doc.docId) && !isLocked(doc, 'authors')) {
        // Rebuild from canonical; carry bio/affiliation over on loose-name match.
        const regObjs = (doc.authors || []).filter(a => a && typeof a === 'object');
        const newAuthors = hit.authors.map(name => {
          const cleanName = cleanText(name);
          const match = regObjs.find(a => looseName(a.name) === looseName(cleanName));
          if (match && (match.bio || match.affiliation)) {
            const out = { name: cleanName };
            if (match.bio) out.bio = match.bio;
            if (match.affiliation) out.affiliation = match.affiliation;
            return out;
          }
          return { name: cleanName };
        });
        changes.push({
          doc, field: 'authors', key: 'authors',
          newValue: newAuthors,
          originalValue: doc.authors,
          note: 'Author list rebuilt from SMPTE canonical repository (count-mismatch review: canonical correct in all 15 cases; approved 2026-07-08)',
        });
        tally.authors = (tally.authors || 0) + 1;
      } else {
        authorsDrift.push({ docId: doc.docId, registry: regAuthors, canonical: hit.authors });
      }
    }
  }
}

console.log(`[backfill] pending changes: ${JSON.stringify(tally)}`);
console.log(`[backfill] skipped: ${JSON.stringify(skipped)}`);
console.log(`[backfill] authors drift: ${authorsDrift.length} | abstract drift: ${abstractDrift.length}`);

// ---- reports --------------------------------------------------------------
const md = [];
md.push('# Canonical field backfill — passes 1-3');
md.push('');
md.push(`> Generated: ${NOW}`);
md.push(`> Mode: **${APPLY ? 'APPLY' : 'DRY-RUN'}**`);
md.push('');
md.push('| pass | field | changes |');
md.push('|---|---|---:|');
md.push(`| 0 | publicationDate year (5 approved digit-error fixes) | ${tally.pubYear || 0} |`);
md.push(`| 1 | publicationDate month (Jan-1 placeholder → canonical month) | ${tally.pubMonth} |`);
md.push(`| 2 | journalTitle (era-accurate, journal-kind) | ${tally.journalTitle} |`);
md.push(`| 3a | abstract (canonical-only fill) | ${tally.abstract} |`);
md.push(`| 3b | keywords (empty-doc fill, vocab-mapped) | ${tally.keywords} |`);
md.push(`| 4b | keywords merge (union into existing; --apply-keywords-merge) | ${tally.keywordsMerge || 0} |`);
md.push(`| 5 | authors (name fixes; written under --apply-authors) | ${tally.authors || 0} |`);
md.push(`| 6 | docTitle (canonical wins per drift review; --apply-titles) | ${tally.title || 0} |`);
md.push('');
md.push(`Title pass extras: ${titleKeepOurs.length} registry-richer rows kept (push-back), ${titleSkippedMarkup.length} skipped for unconvertible markup, ${titleMarkupConversions.length} TeX/sup/inf→Unicode conversions.`);
if (titleMarkupConversions.length) {
  md.push('');
  md.push('### Markup→Unicode conversions (verify each)');
  md.push('');
  md.push('| docId | registry (old) | canonical converted (new) |');
  md.push('|---|---|---|');
  for (const t of titleMarkupConversions) {
    md.push(`| \`${t.docId}\` | ${String(t.from).slice(0, 80).replace(/\|/g, '\\|')} | ${String(t.to).slice(0, 80).replace(/\|/g, '\\|')} |`);
  }
}
md.push('');
md.push('## Samples (first 25 per pass)');
for (const f of ['pubYear', 'pubMonth', 'journalTitle', 'abstract', 'keywords', 'authors']) {
  const rows = changes.filter(c => c.field === f).slice(0, 25);
  if (!rows.length) continue;
  md.push('');
  md.push(`### ${f}`);
  md.push('');
  md.push('| docId | old | new |');
  md.push('|---|---|---|');
  for (const c of rows) {
    const oldV = JSON.stringify(c.originalValue ?? '').slice(0, 60).replace(/\|/g, '\\|');
    const newV = JSON.stringify(c.newValue ?? '').slice(0, 80).replace(/\|/g, '\\|');
    md.push(`| \`${c.doc.docId}\` | ${oldV} | ${newV} |`);
  }
}
fs.writeFileSync(path.join(REPORTS, 'canonicalFieldBackfill.md'), md.join('\n') + '\n');

function driftReport(name, rows, file) {
  const r = [];
  r.push(`# ${name} — registry vs canonical (both present, different)`);
  r.push('');
  r.push(`> Generated: ${NOW} · ${rows.length} docs · review list, never auto-written`);
  r.push('');
  r.push('| docId | registry | canonical |');
  r.push('|---|---|---|');
  for (const d of rows) {
    const reg = JSON.stringify(d.registry).slice(0, 120).replace(/\|/g, '\\|');
    const can = JSON.stringify(d.canonical).slice(0, 120).replace(/\|/g, '\\|');
    r.push(`| \`${d.docId}\` | ${reg} | ${can} |`);
  }
  fs.writeFileSync(path.join(REPORTS, file), r.join('\n') + '\n');
}
driftReport('Authors count-mismatch drift', authorsDrift, 'authorsCountDiff.md');
driftReport('Abstract drift', abstractDrift, 'abstractDrift.md');
driftReport('Titles kept (registry richer — push-back to SMPTE)', titleKeepOurs, 'titleKeepOurs.md');
console.log(`[backfill] wrote canonicalFieldBackfill.md + authorsCountDiff.md + abstractDrift.md + titleKeepOurs.md`);
console.log(`[backfill] titles: ${tally.title || 0} updates pending | ${titleKeepOurs.length} keep-ours | ${titleSkippedMarkup.length} markup-skipped | ${titleMarkupConversions.length} conversions`);

// ---- apply ----------------------------------------------------------------
function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

// Partition: authors changes write only under --apply-authors; keyword
// merges only under --apply-keywords-merge; the rest under --apply.
// Flags combine.
const authorChanges = changes.filter(c => c.field === 'authors');
const kwMergeChanges = changes.filter(c => c.field === 'keywordsMerge');
const titleChanges = changes.filter(c => c.field === 'title');
const fieldChanges = changes.filter(c => !['authors', 'keywordsMerge', 'title'].includes(c.field));
const toWrite = [
  ...(APPLY ? fieldChanges : []),
  ...(APPLY_AUTHORS ? authorChanges : []),
  ...(APPLY_KW_MERGE ? kwMergeChanges : []),
  ...(APPLY_TITLES ? titleChanges : []),
];
if (!toWrite.length) {
  console.log(`\nDry run — pass --apply to write ${fieldChanges.length} field changes,`);
  console.log(`          --apply-authors to write ${authorChanges.length} author-name fixes,`);
  console.log(`          --apply-keywords-merge to write ${kwMergeChanges.length} keyword unions,`);
  console.log(`          --apply-titles to write ${titleChanges.length} title updates (flags combine).`);
  process.exit(0);
}

// Group by doc so multi-field docs are written once
const byDoc = new Map();
for (const c of toWrite) {
  if (!byDoc.has(c.doc.docId)) byDoc.set(c.doc.docId, { doc: c.doc, fields: [] });
  byDoc.get(c.doc.docId).fields.push(c);
}
let written = 0;
for (const { doc, fields } of byDoc.values()) {
  for (const c of fields) {
    doc[c.key] = c.newValue;
    doc[`${c.key}$meta`] = {
      source: 'parsed',
      confidence: 'high',
      note: c.note + ' (smpte-canonical-audit/canonicalLibrary.*.json)',
      originalValue: c.originalValue,
      updated: NOW,
      version: VERSION,
    };
  }
  const sorted = sortKeysDeep(doc);
  const target = docAbsPath(sorted);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(sorted, null, 2) + '\n');
  written++;
}
console.log(`\nApplied ${toWrite.length} field changes across ${written} docs.`);
console.log('Reminder: npm run canonicalize && npm run validate, then commit.');
