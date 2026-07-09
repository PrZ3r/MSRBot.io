/*
 * titleDriftReport.mjs — full categorized listing of the 2,294 title-drift
 * rows for human review, BEFORE any update pass is built.
 *
 * Buckets:
 *   canon-extends    canonical = registry + subtitle/venue/date tail
 *   canon-contains   canonical wraps registry (prefix labels, full review titles)
 *   near-different   no containment, token-jaccard >= 0.5 (typo/OCR level)
 *   far-canon-specific   registry is a generic department label, canonical specific
 *   far-both-generic     both sides are generic labels
 *   reg-extends      registry = canonical + tail (registry richer)
 *   reg-contains     registry wraps canonical
 *   far-reg-specific     canonical is the generic one (registry richer)
 *   far-both-specific    real divergence, both specific
 *
 * Output: src/main/reports/smpte-canonical-audit/titleDrift.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);
const REPORTS = 'src/main/reports/smpte-canonical-audit';

function decode(s) {
  return String(s || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, x) => String.fromCodePoint(parseInt(x, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ').trim();
}
function norm(s) {
  return decode(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
const GENERIC = /^(book review(s)?|books reviewed|american national standards?|approved american national standards?|smpte recommended practices?|proposed smpte recommended practices?|international standards?|new products( and developments)?|obituar(y|ies)|letters? to the editor|standards and recommended practices|proposed american national standards?|current literature|new members|meetings? of the board of governors|technical literature|society announcements|employment service|book received|abstracts of current literature)$/;
function isGeneric(s) { const n = norm(s); return GENERIC.test(n) || n.split(' ').filter(Boolean).length <= 2; }

const d = JSON.parse(fs.readFileSync(path.join(REPORTS, 'fieldDiff.json'), 'utf8'));
const buckets = {
  'canon-extends': [], 'canon-contains': [], 'near-different': [],
  'far-canon-specific': [], 'far-both-generic': [],
  'reg-extends': [], 'reg-contains': [], 'far-reg-specific': [], 'far-both-specific': [],
};
for (const r of d.drift.title) {
  const rn = norm(r.registry), cn = norm(r.canonical);
  let b;
  if (cn.startsWith(rn)) b = 'canon-extends';
  else if (rn.startsWith(cn)) b = 'reg-extends';
  else if (cn.includes(rn)) b = 'canon-contains';
  else if (rn.includes(cn)) b = 'reg-contains';
  else {
    const rSet = new Set(rn.split(' ')), cSet = new Set(cn.split(' '));
    const inter = [...rSet].filter(x => cSet.has(x)).length;
    const jac = inter / (rSet.size + cSet.size - inter);
    if (jac >= 0.5) b = 'near-different';
    else if (isGeneric(r.registry) && !isGeneric(r.canonical)) b = 'far-canon-specific';
    else if (!isGeneric(r.registry) && isGeneric(r.canonical)) b = 'far-reg-specific';
    else if (isGeneric(r.registry) && isGeneric(r.canonical)) b = 'far-both-generic';
    else b = 'far-both-specific';
  }
  buckets[b].push(r);
}

const PLAN = {
  'canon-extends':      { verdict: '✅ auto-update proposed', why: 'canonical = ours + subtitle/venue/date' },
  'canon-contains':     { verdict: '✅ auto-update proposed', why: 'canonical wraps ours (labels, full review titles)' },
  'near-different':     { verdict: '✅ auto-update proposed', why: 'typo/OCR-level variants; canonical cleaner' },
  'far-canon-specific': { verdict: '✅ auto-update proposed', why: 'ours is a generic department label' },
  'far-both-generic':   { verdict: '✅ auto-update proposed', why: 'label variants, take canonical form' },
  'reg-extends':        { verdict: '🚫 keep ours (push-back)', why: 'registry carries extra detail canonical lost' },
  'far-reg-specific':   { verdict: '🚫 keep ours (push-back)', why: 'canonical is the generic one' },
  'reg-contains':       { verdict: '👀 review', why: 'mixed: our prefixes vs our section-number junk' },
  'far-both-specific':  { verdict: '👀 review', why: 'real divergence both ways' },
};

const md = [];
md.push('# Title drift — full categorized listing (2,294 rows)');
md.push('');
md.push(`> Generated: ${new Date().toISOString()}`);
md.push('> Review the ✅ buckets for junk and veto rows/buckets; mark the 👀 buckets update/ignore.');
md.push('');
md.push('| bucket | rows | proposed |');
md.push('|---|---:|---|');
for (const [b, rows] of Object.entries(buckets)) {
  md.push(`| ${b} | ${rows.length} | ${PLAN[b].verdict} — ${PLAN[b].why} |`);
}
md.push('');
for (const [b, rows] of Object.entries(buckets)) {
  if (!rows.length) continue;
  md.push(`## ${PLAN[b].verdict.slice(0, 2)} ${b} (${rows.length})`);
  md.push('');
  md.push(PLAN[b].why + '.');
  md.push('');
  md.push('| docId | registry | canonical |');
  md.push('|---|---|---|');
  for (const r of rows) {
    const reg = decode(r.registry).slice(0, 110).replace(/\|/g, '\\|');
    const can = decode(r.canonical).slice(0, 110).replace(/\|/g, '\\|');
    md.push(`| \`${r.docId}\` | ${reg} | ${can} |`);
  }
  md.push('');
}
fs.writeFileSync(path.join(REPORTS, 'titleDrift.md'), md.join('\n') + '\n');
console.log(`wrote ${path.join(REPORTS, 'titleDrift.md')}`);
for (const [b, rows] of Object.entries(buckets)) console.log(`  ${b.padEnd(20)} ${rows.length}`);
