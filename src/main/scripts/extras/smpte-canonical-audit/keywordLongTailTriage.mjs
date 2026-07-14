/*
 * keywordLongTailTriage.mjs — bucket the 684 ingested keywords that sit outside
 * controlledKeywords (the set failing `npm run validate`).
 *
 * The validator enforces controlled-vocab-only keywords, so every one of these
 * must land in exactly one bucket:
 *
 *   ACRONYM — miscased acronym (Vmaf → VMAF). Feeds keyword.normalize.js, then
 *             the canonical form is ADDed to the vocab.
 *   FOLD    — a variant of a term already in vocab (plural, punctuation,
 *             expansion) → maps to the canonical vocab term.
 *   DROP    — not a topic: author sentence-fragments, trademarks, one-off
 *             hyper-specifics. Removed from the doc's keywords[].
 *   ADD     — a real, reusable topic → new controlledKeywords entry.
 *
 * Heuristics propose a verdict; the emitted report is the review surface.
 * Nothing is written — this only produces the proposal.
 *
 *   node …/keywordLongTailTriage.mjs
 *
 * Reports:
 *   src/main/reports/smpte-canonical-audit/keywordLongTailTriage.md    (review)
 *   src/main/reports/smpte-canonical-audit/keywordLongTailTriage.json  (verdicts)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { loadAllDocs } = require('../../../lib/registry');
const REPORTS = 'src/main/reports/smpte-canonical-audit';

const site = JSON.parse(fs.readFileSync('src/main/config/site.json', 'utf8'));
const vocab = new Map((site.controlledKeywords || []).map((k) => [k.toLowerCase(), k]));

// ---- known acronyms surfaced by the ingest (canonical casing) --------------
const ACRONYMS = new Map(Object.entries({
  arq: 'ARQ', c2pa: 'C2PA', cuda: 'CUDA', daap: 'DAAP', 'dnxhr': 'DNxHR', 'dnxgx': 'DNxGX',
  gltf: 'glTF', gnss: 'GNSS', gps: 'GPS', hap: 'HAP', hlg: 'HLG', hls: 'HLS', moqt: 'MoQT',
  rdo: 'RDO', scte: 'SCTE', smpte: 'SMPTE', stltp: 'STLTP', tdc: 'TDC', ucx: 'UCX',
  vmaf: 'VMAF', xs: 'XS', genai: 'GenAI', olpf: 'OLPF', osnma: 'OSNMA', notchlc: 'NotchLC',
  vp9: 'VP9', vr: 'VR', vvc: 'VVC', vpu: 'VPU', ebu: 'EBU', scte35: 'SCTE-35', s35: 'S35',
  qoe: 'QoE', sei: 'SEI', vsei: 'VSEI', mmt: 'MMT', ddaas: 'DDaaS', ldr: 'LDR', dmf: 'DMF',
  has: 'HAS', hevc: 'HEVC', jpeg: 'JPEG', catena: 'Catena', daniel2: 'Daniel2',
}));

// generic single words that carry no topical signal
const GENERIC = new Set([
  'software', 'production', 'broadcast', 'stage', 'actor', 'hybrid', 'flexibility',
  'timing', 'rendering', 'containers', 'asynchronous', 'stereo', 'calibration',
  'resilience', 'orchestration', 'mezzanine', 'parallax', 'jamming', 'spoofing',
  'galileo', 'hearing', 'stage', 'live act', 'remote control', 'reference signal',
]);

// sentence-fragment detector — author "keywords" that are really prose
function isSentence(t) {
  const words = t.split(/\s+/);
  if (words.length < 4) return false;
  return /\b(is|are|was|were|be|been|doesn't|don't|can|will|should|to|the|of|on|for|in|and|as|a)\b/i.test(t)
    && words.length >= 5;
}

function fold(lo) {
  // exact vocab hit after de-pluralising / stripping punctuation
  const singular = lo.replace(/s$/, '');
  for (const cand of [lo, singular, lo.replace(/[-–—]/g, ' '), lo.replace(/\s*\(.*\)\s*/, '').trim()]) {
    if (vocab.has(cand)) return vocab.get(cand);
  }
  return null;
}

function classify(form, n) {
  const lo = form.toLowerCase().trim();
  if (/[™®©]/.test(form)) return { v: 'DROP', why: 'trademark / product name' };
  if (isSentence(form)) return { v: 'DROP', why: 'author sentence-fragment, not a topic' };
  if (GENERIC.has(lo)) return { v: 'DROP', why: 'too generic to be a facet' };

  const single = !/\s/.test(form);
  if (single && ACRONYMS.has(lo)) return { v: 'ACRONYM', as: ACRONYMS.get(lo), why: 'miscased acronym' };
  // Title-cased short single token that was ALL-CAPS upstream → almost certainly an acronym
  if (single && form.length <= 6 && /^[A-Z][a-z0-9]+$/.test(form)) {
    return { v: 'ACRONYM', as: form.toUpperCase(), why: 'short single token — likely acronym (confirm)' };
  }
  // ALL-CAPS hyphenated phrase left uppercase by the normalizer's acronym rule
  if (/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(form) && form.length > 6) {
    const fixed = form.split('-').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join('-');
    return { v: 'ACRONYM', as: fixed, why: 'casing artifact — uppercase hyphenated phrase' };
  }

  const f = fold(lo);
  if (f) return { v: 'FOLD', to: f, why: 'variant of an existing vocab term' };

  return { v: 'ADD', as: form, why: n >= 2 ? 'reusable topic (2 docs)' : 'topic (1 doc)' };
}

// ---- gather --------------------------------------------------------------
const freq = new Map();
for (const d of loadAllDocs()) {
  for (const k of d.keywords || []) {
    const lo = String(k).toLowerCase();
    if (vocab.has(lo)) continue;
    if (!freq.has(lo)) freq.set(lo, { form: k, n: 0 });
    freq.get(lo).n++;
  }
}
const terms = [...freq.values()].sort((a, b) => b.n - a.n || a.form.localeCompare(b.form));

const buckets = { ACRONYM: [], FOLD: [], DROP: [], ADD: [] };
for (const t of terms) {
  const c = classify(t.form, t.n);
  buckets[c.v].push({ ...t, ...c });
}

const out = { generatedAt: new Date().toISOString(), total: terms.length, buckets };
fs.writeFileSync(path.join(REPORTS, 'keywordLongTailTriage.json'), JSON.stringify(out, null, 2) + '\n');

const md = [];
md.push('# Keyword long-tail triage — the 684 terms failing `validate`\n');
md.push(`> Generated: ${out.generatedAt}`);
md.push('> The validator enforces controlled-vocab-only keywords, so every term below must');
md.push('> land in one bucket. **Proposal only — nothing written.** Edit any verdict, then I apply.\n');
md.push('## Buckets');
md.push('| verdict | terms | effect |');
md.push('|---|---:|---|');
md.push(`| ACRONYM | ${buckets.ACRONYM.length} | fix casing → add canonical form to vocab |`);
md.push(`| FOLD | ${buckets.FOLD.length} | map to an existing vocab term |`);
md.push(`| DROP | ${buckets.DROP.length} | remove from the docs' keywords[] |`);
md.push(`| ADD | ${buckets.ADD.length} | new controlledKeywords entry |`);
md.push('');
for (const [name, title] of [['DROP', '🗑️ DROP — remove from docs'], ['ACRONYM', '🔠 ACRONYM — casing fix'], ['FOLD', '🔀 FOLD — map to existing vocab'], ['ADD', '✅ ADD — new vocab entries']]) {
  const b = buckets[name];
  md.push(`## ${title} (${b.length})\n`);
  md.push('| term | docs | verdict | why |');
  md.push('|---|---:|---|---|');
  for (const t of b) {
    const target = t.as || t.to || '—';
    md.push(`| \`${t.form}\` | ${t.n} | **${target}** | ${t.why} |`);
  }
  md.push('');
}
fs.writeFileSync(path.join(REPORTS, 'keywordLongTailTriage.md'), md.join('\n'));

console.log(`[longtail] ${terms.length} terms →`);
for (const k of Object.keys(buckets)) console.log(`  ${k.padEnd(8)} ${buckets[k].length}`);
console.log(`  reports: ${REPORTS}/keywordLongTailTriage.{md,json}`);
