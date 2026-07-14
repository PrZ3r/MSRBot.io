/*
 * keywordVocabDedup.js — collapse case/punctuation duplicate keywords.
 *
 * The long-tail cleanup left 6 near-duplicate groups in controlledKeywords —
 * the same term in two casings, e.g. ["Low Latency","Low-latency","Low-Latency"]
 * and ["3d-reconstruction","3d-RECONSTRUCTION"]. Two causes, both now fixed at
 * source (keywordLongTailApply.js repairCasing + keyword.normalize.js):
 *
 *   1. The uppercase-phrase branch keyed on a LEADING LETTER (^[A-Z]...), so
 *      digit-led ALL-CAPS terms ("3D-RECONSTRUCTION") skipped it and only got
 *      their first hyphen-part cased → "3d-RECONSTRUCTION".
 *   2. The base normalizer title-cases only the FIRST part of a hyphenated
 *      token ("Low-latency") while the repair cased EVERY part
 *      ("Low-Latency") — so both survived on different docs.
 *
 * This pass merges each group onto one canonical form across doc.keywords and
 * controlledKeywords, and normalizes dimensional prefixes (3d → 3D). Per review,
 * "3D-Reconstruction" loses the artifact hyphen → "3D Reconstruction".
 *
 *   node …/keywordVocabDedup.js            # dry-run
 *   node …/keywordVocabDedup.js --apply    # write docs + controlledKeywords
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs, saveDoc } = require('../../../lib/registry');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const NOW = new Date().toISOString();
const APPLY = process.argv.includes('--apply');
const SITE_PATH = 'src/main/config/site.json';

// canonical form for each duplicate / mis-cased term (keyed lowercase)
const CANON = new Map(Object.entries({
  '3d-reconstruction': '3D Reconstruction',
  '3d lut': '3D LUT',
  '3d rendering': '3D Rendering',
  '3d scene reconstruction': '3D Scene Reconstruction',
  '3d stereoscopic video': '3D Stereoscopic Video',
  '3d vertigo syndrome': '3D Vertigo Syndrome',
  '3d video streaming': '3D Video Streaming',
  '3d video transport': '3D Video Transport',
  'film-look': 'Film-Look',
  'high-fidelity': 'High-Fidelity',
  'ip-based media solutions': 'IP-Based Media Solutions',
  'ip-based workflows': 'IP-Based Workflows',
  'low latency': 'Low Latency',
  'low-latency': 'Low Latency',
  'low-latency media': 'Low-Latency Media',
  'software-defined media facilities': 'Software-Defined Media Facilities',
  // Hyphen-part casing: the base normalizer title-cases only the FIRST part of a
  // hyphenated token, so ingest terms landed as "AI-driven" next to "AI-Assisted".
  // Only ingest-only terms are listed — legacy vocab (IMF Plug-in, Public-key,
  // Multi-tree XMSS, Content-transfer-encodings, Hash-based Signatures, Lang-tag,
  // Post-quantum Cryptography, Winternitz One-time Signature Scheme) is left
  // alone: it is in use by pre-existing docs and renaming it would churn them.
  '5g': '5G',
  'ai-assisted film production': 'AI-Assisted Film Production',
  'ai-driven media': 'AI-Driven Media',
  'ai-generated content': 'AI-Generated Content',
  'ai-native networking': 'AI-Native Networking',
  'auto-regressive film grain synthesis': 'Auto-Regressive Film Grain Synthesis',
  'cloud-native': 'Cloud-Native',
  'cloud-native media': 'Cloud-Native Media',
  'code-switching': 'Code-Switching',
  'color-close applications': 'Color-Close Applications',
  'content-adaptive encoding': 'Content-Adaptive Encoding',
  'failure-tolerant control plane': 'Failure-Tolerant Control Plane',
  'global shared-memory mesh': 'Global Shared-Memory Mesh',
  'keyframe-centric processing': 'Keyframe-Centric Processing',
  'multi-agent ai': 'Multi-Agent AI',
  'on-premises datacenters': 'On-Premises Datacenters',
  'packet-pacing': 'Packet-Pacing',
  'real-time media workflows': 'Real-Time Media Workflows',
  'real-time processing': 'Real-Time Processing',
  'region-of-interest decoding': 'Region-of-Interest Decoding',
  'speech-to-text': 'Speech-to-Text',
  'text-to-speech': 'Text-to-Speech',
  'time-aligned media': 'Time-Aligned Media',
  'websocket-based api': 'WebSocket-Based API',
}));

function canon(k) {
  const lo = String(k).toLowerCase().trim();
  if (CANON.has(lo)) return CANON.get(lo);
  // Uppercase a dimensional prefix ANYWHERE in the term, not just leading —
  // "LED 3d Displays" is as wrong as "3d Rendering". The token must stand alone
  // (bounded by non-alphanumerics) so "3GPP" and "S3D" are left untouched.
  return String(k).replace(/(^|[^A-Za-z0-9])([238])d([^A-Za-z0-9]|$)/g,
    (_m, before, digit, after) => `${before}${digit}D${after}`);
}

const site = JSON.parse(fs.readFileSync(SITE_PATH, 'utf8'));
const docs = loadAllDocs();

const rewrites = new Map();
let docsChanged = 0;

for (const doc of docs) {
  if (!Array.isArray(doc.keywords) || !doc.keywords.length) continue;
  const before = doc.keywords.slice();
  const out = [];
  const seen = new Set();
  for (const k of before) {
    const c = canon(k);
    if (c !== k) rewrites.set(k, c);
    if (seen.has(c.toLowerCase())) continue; // collapse the merged pair
    seen.add(c.toLowerCase());
    out.push(c);
  }
  if (JSON.stringify(before) !== JSON.stringify(out)) {
    docsChanged++;
    if (APPLY) {
      doc.keywords = out;
      doc['keywords$meta'] = {
        source: 'resolved', confidence: 'high',
        note: 'Keyword vocab dedup (keywordVocabDedup.js): case/punctuation duplicate forms merged; dimensional prefixes normalized (3d → 3D).',
        updated: NOW,
      };
      saveDoc(doc);
    }
  }
}

// rebuild controlledKeywords: canonicalize, then de-dup case-insensitively
const vocabBefore = site.controlledKeywords || [];
const byLower = new Map();
for (const k of vocabBefore) {
  const c = canon(k);
  if (!byLower.has(c.toLowerCase())) byLower.set(c.toLowerCase(), c);
}
const vocabAfter = [...byLower.values()].sort((a, b) => a.localeCompare(b));

if (APPLY) {
  site.controlledKeywords = vocabAfter;
  fs.writeFileSync(SITE_PATH, JSON.stringify(site, null, 2) + '\n', 'utf8');
}

console.log(`[dedup] ${APPLY ? 'APPLIED' : 'DRY-RUN'}`);
console.log(`  docs changed        : ${docsChanged}`);
console.log(`  term rewrites       : ${rewrites.size}`);
for (const [a, b] of rewrites) console.log(`      ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
console.log(`  controlledKeywords  : ${vocabBefore.length} -> ${vocabAfter.length} (${vocabBefore.length - vocabAfter.length} removed)`);
if (!APPLY) console.log('\n  re-run with --apply to write.');
