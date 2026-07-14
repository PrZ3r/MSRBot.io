/*
 * keywordLongTailApply.js — clean the 684 ingested keywords outside the vocab.
 *
 * Policy (2026-07-14 decision): the registry INDEXES every source keyword so it
 * stays searchable; the browsable *chips* are curated separately (site.json
 * facetKeywords — a later step). So this pass is deliberately conservative:
 *
 *   DROP   — only genuine non-topics: author prose fragments ("In The Good Old
 *            Days"), contentless singletons ("Background", "Baseline"), and
 *            trademarks. Everything else is kept.
 *   FIX    — typos + malformed "ABBR- Long Name" forms from the index_terms.
 *   ACRONYM— curated casing map (Vmaf → VMAF). Guessing was wrong: heuristics
 *            wrongly uppercased ordinary words (Gaming, News, Intel, Unity), so
 *            the list is explicit.
 *   FOLD   — obvious duplicate variants (Large Language Model(s)/LLMs → one).
 *   KEEP   — everything else, as normalized.
 *
 * Kept terms are added to site.json controlledKeywords so `validate` passes
 * (the validator gates doc.keywords ⊆ controlledKeywords).
 *
 *   node …/keywordLongTailApply.js            # dry-run → report
 *   node …/keywordLongTailApply.js --apply    # write docs + controlledKeywords
 *
 * Report: src/main/reports/smpte-canonical-audit/keywordLongTailApply.md
 */

const fs = require('fs');
const path = require('path');
const { loadAllDocs, saveDoc } = require('../../../lib/registry');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const NOW = new Date().toISOString();
const APPLY = process.argv.includes('--apply');
const SITE_PATH = 'src/main/config/site.json';
const OUT_MD = 'src/main/reports/smpte-canonical-audit/keywordLongTailApply.md';
const INGEST_NOTE = 'ingestNlmCanonicalDocs.js';

// ---- DROP: prose fragments, contentless singletons, trademarks -------------
const DROP = new Set([
  '3d simulation in football analysis',
  'auditory envelopment is stimulating to young and old people alike',
  'hearing is the earliest and most formative sense',
  'in the good old days',
  'movie theatres are reliable places to enjoy auditory envelopment',
  'music production for social listening in movie theatres',
  "pixel count doesn't necessarily equal resolution",
  'test materials intended for observation',
  'vision and other senses build on hearing',
  'static versus dynamic test materials',
  'listening level on portable platforms',
  'universal test patterns for sdr and hd',
  'images as test materials',
  'best of breed choices',
  'audience aware',
  'voxiumai™',
  // contentless singletons — no topical signal
  'background', 'baseline', 'availability', 'compute', 'virtual',
  'guidelines', 'efficiency', 'creativity', 'flexibility', 'case study',
  'cost savings', 'human impact', 'existing infrastructure', 'hiring',
]);

// ---- FIX: typos + malformed "ABBR- Long Name" index_terms ------------------
const FIX = new Map(Object.entries({
  'apple vison pro': 'Apple Vision Pro',
  'camara tracking': 'Camera Tracking',
  'head mounded display': 'Head Mounted Display',
  'production sound mixer/recordist': 'Production Sound Mixer/Recordist',
  'hdr- high dynamic range': 'HDR',
  'wcg- wide color gamut': 'Color Gamut',
  'fhd- full high definition': 'HDTV',
  'fbb- frame buffer bandwidth': 'Frame Buffer Bandwidth',
  'bpp-bits per pixel': 'Bits Per Pixel',
  'rtp-real time transport protocol': 'RTP',
  'next-generation-audio nga': 'Next-Generation Audio',
  'metadata-guided audio mga': 'Metadata-Guided Audio',
  '2/3-inch': '2/3-Inch',
  'adm/s-adm': 'ADM/S-ADM',
  'iso/iec': 'ISO/IEC',
  'moiré': 'Moiré',
}));

// ---- ACRONYM: explicit casing map (never guessed) --------------------------
const ACRONYM = new Map(Object.entries({
  abr: 'ABR', aom: 'AOM', ar: 'AR', arq: 'ARQ', c2pa: 'C2PA', cie: 'CIE',
  cna: 'CNA', cpp: 'CPP', cve: 'CVE', cuda: 'CUDA', daap: 'DAAP', dchd: 'DCHD',
  dmf: 'DMF', dnxhd: 'DNxHD', dnxhr: 'DNxHR', dnxgx: 'DNxGX', dnxho: 'DNxHO',
  ebu: 'EBU', ebucore: 'EBUCore', ffmpeg: 'FFmpeg', genai: 'GenAI', gltf: 'glTF',
  gnss: 'GNSS', gps: 'GPS', hap: 'HAP', has: 'HAS', hlg: 'HLG', hls: 'HLS',
  icvfx: 'ICVFX', ipmx: 'IPMX', itm: 'ITM', lidar: 'LiDAR', mcs: 'MCS',
  mets: 'METS', moq: 'MoQ', moqt: 'MoQT', mr: 'MR', ner: 'NER', nic: 'NIC',
  nisq: 'NISQ', nmos: 'NMOS', ntr: 'NTR', onetbb: 'oneTBB', osa: 'OSA',
  osha: 'OSHA', osnma: 'OSNMA', qoe: 'QoE', quic: 'QUIC', rag: 'RAG', rdo: 'RDO',
  scte: 'SCTE', sdp: 'SDP', sdr: 'SDR', sgai: 'SGAI', slog: 'S-Log', sls: 'SLS',
  smpte: 'SMPTE', stltp: 'STLTP', tdc: 'TDC', tm: 'TM', ucx: 'UCX', vmaf: 'VMAF',
  vod: 'VOD', vp9: 'VP9', vpu: 'VPU', vr: 'VR', vvc: 'VVC', xs: 'XS', vc6: 'VC6',
  neqr: 'NEQR', rocos: 'ROCOS', remi: 'REMI', h266: 'H.266', notchlc: 'NotchLC',
  mpeg2ts: 'MPEG2-TS', openclip: 'OpenCLIP', connectsdk: 'ConnectSDK',
  rosstalk: 'RossTalk', jammertest: 'JammerTest', 'ris-osa': 'RIS-OSA',
  rfc9134: 'RFC 9134', llama2: 'Llama 2', naba: 'NABA', olpf: 'OLPF',
  'get-ci': 'GET-CI', s35: 'S35', catena: 'Catena', daniel2: 'Daniel2',
}));

// Multi-word terms whose leading token is an acronym the normalizer title-cased.
const TOKEN_FIX = new Map(Object.entries({
  ai: 'AI', ar: 'AR', vr: 'VR', tv: 'TV', ip: 'IP', it: 'IT', led: 'LED',
  gpu: 'GPU', cpu: 'CPU', rgb: 'RGB', ott: 'OTT', cdn: 'CDN', uhd: 'UHD',
  hdr: 'HDR', sdr: 'SDR', cmos: 'CMOS', nmos: 'NMOS', amwa: 'AMWA',
  atsc: 'ATSC', scte: 'SCTE', smpte: 'SMPTE', ebu: 'EBU', lg: 'LG',
  av: 'AV', ui: 'UI', api: 'API', http: 'HTTP', rtp: 'RTP', xr: 'XR',
  nga: 'NGA', llm: 'LLM', llms: 'LLMs', sei: 'SEI', vsei: 'VSEI', mmt: 'MMT',
}));

// ---- FOLD: duplicate variants → one canonical form -------------------------
const FOLD = new Map(Object.entries({
  'large language model': 'Large Language Models (LLMs)',
  'large language models': 'Large Language Models (LLMs)',
  'large language models (llm)': 'Large Language Models (LLMs)',
  'llms': 'Large Language Models (LLMs)',
  'media & entertainment': 'Media and Entertainment',
  'containerized': 'Containerization',
  'containers': 'Containerization',
  'extended reality (xr)': 'Extended Reality',
  'content delivery network (cdn)': 'Content Delivery Network',
  'dynamic media facilities': 'Dynamic Media Facility',
  'volumetric videos': 'Volumetric Video',
  '3d gaussian splatting': 'Gaussian Splatting',
  'natural language processing (nlp)': 'Natural Language Processing',
  'versatile video coding (vvc)': 'Versatile Video Coding',
  'high efficiency video coding (hevc)': 'HEVC',
  'quality of experience (qoe)': 'QoE',
  'qoe (quality of experience)': 'QoE',
  'video quality of experience': 'QoE',
  'supplemental enhancement information (sei)': 'SEI',
  'versatile supplemental enhancement information (vsei)': 'VSEI',
  'dynamic adaptive streaming over http (dash)': 'DASH',
  'http adaptive streaming (has)': 'HAS',
  'extended reality (xr) ': 'Extended Reality',
  'video codecs': 'Video Codec',
  'tunable bitrates': 'Tunable Bitrate',
  'augmented reality graphics': 'Augmented Reality',
  'ar graphics': 'Augmented Reality',
  'smpte st2110': 'ST 2110',
  'st2110': 'ST 2110',
  'st-2110': 'ST 2110',
  'st2022': 'ST 2022',
  'speech recognition': 'Automatic Speech Recognition',
  'loudness-to-dialog ratio': 'Loudness To Dialog Ratio (LDR)',
  'loudness to dialog ratio (ldr)': 'Loudness To Dialog Ratio (LDR)',
  'data distribution as a service (ddaas)': 'Data Distribution as a Service (DDaaS)',
  'atsc 3.0 and mpeg media transport (mmt)': 'MPEG Media Transport (MMT)',
  'faiss (facebook ai similarity search)': 'FAISS',
  'clip (contrastive language-image pre-training)': 'CLIP',
  'advanced vector extensions (avx)': 'AVX',
  'camera response function (crf)': 'Camera Response Function (CRF)',
  'internet-of-things (iot)': 'IoT',
  'opto-electronic transfer function (oetf)': 'OETF',
  'personal data store (pds)': 'Personal Data Store (PDS)',
  'text-to-speech (tts)': 'Text-to-Speech',
  'text-to-speech': 'Text-to-Speech',
  'over-the-top (ott) media platforms': 'OTT',
  'ott streaming': 'OTT',
  'ebu dynamic media facility (dmf)': 'Dynamic Media Facility',
  'video generation models': 'Video Generation',
}));

// ---- casing repair --------------------------------------------------------
// The normalizer preserves ALL-CAPS hyphenated tokens (for MIME-EXT-style
// acronyms), which leaves ALL-CAPS *phrases* uppercase (FILM-LOOK). Repair
// those, but never touch genuine acronym forms (JPEG-XS, MV-HEVC, TR-07).
const KEEP_UPPER = new Set(['JPEG-XS', 'MV-HEVC', 'TR-07', 'TR-08', 'GPT-4', 'H.264, AVC', 'GET-CI', 'RIS-OSA', 'ISO 226', 'ITU-T', 'IETF', 'JPEG', 'RDD 50']);

// Conjunctions/prepositions stay lowercase mid-term — the base normalizer keeps
// "and" lowercase deliberately ("Networking and Broadcast Technologies").
const SMALL = new Set(['and', 'of', 'to', 'in', 'for', 'on', 'the', 'a', 'an', 'as', 'at', 'by', 'with', 'or', 'over', 'per', 'vs']);

function titleWord(w, isFirst = true) {
  const lo = w.toLowerCase();
  if (TOKEN_FIX.has(lo)) return TOKEN_FIX.get(lo);
  if (ACRONYM.has(lo)) return ACRONYM.get(lo);
  if (!isFirst && SMALL.has(lo)) return lo;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function repairCasing(form) {
  if (KEEP_UPPER.has(form)) return form;
  // ALL-CAPS word or hyphenated ALL-CAPS phrase → title-case each part
  const words = form.split(/\s+/).map((w, wi) => {
    // token wholly uppercase (>2 chars) and not a known acronym → title-case it
    if (/^[A-Z][A-Z0-9-]{2,}$/.test(w) && !ACRONYM.has(w.toLowerCase()) && !KEEP_UPPER.has(w)) {
      return w.split('-').map((p, i) => titleWord(p, wi === 0 && i === 0)).join('-');
    }
    return w
      .split('-')
      .map((p, i) => {
        const lo = p.toLowerCase();
        if (i === 0) return titleWord(p, wi === 0);
        return (TOKEN_FIX.has(lo) || ACRONYM.has(lo)) ? titleWord(p, false) : p;
      })
      .join('-');
  });
  return words.join(' ');
}

function conform(raw) {
  const lo = String(raw).toLowerCase().trim();
  if (DROP.has(lo)) return null;
  if (FIX.has(lo)) return FIX.get(lo);
  if (FOLD.has(lo)) return FOLD.get(lo);
  if (ACRONYM.has(lo) && !/\s/.test(raw)) return ACRONYM.get(lo);
  return repairCasing(String(raw).trim());
}

// ---- run ------------------------------------------------------------------
const site = JSON.parse(fs.readFileSync(SITE_PATH, 'utf8'));
const vocab = new Map((site.controlledKeywords || []).map((k) => [k.toLowerCase(), k]));
const isOurs = (d) => String((d['docId$meta'] || {}).note || '').includes(INGEST_NOTE);

const docs = loadAllDocs().filter((d) => isOurs(d) && Array.isArray(d.keywords) && d.keywords.length);
const changedDocs = [];
const dropped = new Set();
const kept = new Set();
const changedTerms = new Map();

for (const doc of docs) {
  const before = doc.keywords.slice();
  const after = [];
  const seen = new Set();
  for (const k of before) {
    const lo = String(k).toLowerCase();
    // already-canonical vocab term → keep as-is
    if (vocab.has(lo)) { const t = vocab.get(lo); if (!seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); after.push(t); } continue; }
    const t = conform(k);
    if (!t) { dropped.add(k); continue; }
    if (t !== k) changedTerms.set(k, t);
    kept.add(t);
    if (!seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); after.push(t); }
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    changedDocs.push({ docId: doc.docId, before, after });
    if (APPLY) {
      doc.keywords = after;
      doc['keywords$meta'] = {
        source: 'resolved', confidence: 'high',
        note: 'Long-tail keyword cleanup (keywordLongTailApply.js): prose/contentless terms dropped, acronym casing + typos fixed, duplicate variants folded; all surviving terms indexed in controlledKeywords.',
        updated: NOW,
      };
      saveDoc(doc);
    }
  }
}

// every surviving keyword must be in controlledKeywords for validate to pass
const finalTerms = new Set();
for (const d of docs) for (const k of (APPLY ? d.keywords : [])) finalTerms.add(k);
if (!APPLY) for (const c of changedDocs) for (const k of c.after) finalTerms.add(k);
const missing = [...finalTerms].filter((k) => !vocab.has(k.toLowerCase()));

if (APPLY && missing.length) {
  site.controlledKeywords = Array.from(new Set([...(site.controlledKeywords || []), ...missing]))
    .sort((a, b) => a.localeCompare(b));
  fs.writeFileSync(SITE_PATH, JSON.stringify(site, null, 2) + '\n', 'utf8');
}

const md = [
  '# Keyword long-tail cleanup — NLM-ingested docs\n',
  `> ${APPLY ? 'APPLY' : 'DRY-RUN'} · ${NOW}`,
  '> Policy: index every source keyword (searchable); chips curated separately via `facetKeywords`.\n',
  '## Totals',
  `- docs touched: **${changedDocs.length}** / ${docs.length}`,
  `- terms DROPPED (prose / contentless / trademark): **${dropped.size}**`,
  `- terms rewritten (casing / typo / fold): **${changedTerms.size}**`,
  `- new controlledKeywords entries: **${missing.length}** (→ ${(site.controlledKeywords || []).length + (APPLY ? 0 : missing.length)} total)\n`,
  '## Dropped',
  '',
  [...dropped].sort().map((d) => `- \`${d}\``).join('\n'),
  '',
  '## Rewritten (first 80)',
  '| from | to |',
  '|---|---|',
  ...[...changedTerms.entries()].slice(0, 80).map(([a, b]) => `| \`${a}\` | **${b}** |`),
  '',
].join('\n');
fs.writeFileSync(OUT_MD, md, 'utf8');

console.log(`[longtail] ${APPLY ? 'APPLIED' : 'DRY-RUN'}`);
console.log(`  docs touched      : ${changedDocs.length}/${docs.length}`);
console.log(`  terms dropped     : ${dropped.size}`);
console.log(`  terms rewritten   : ${changedTerms.size}`);
console.log(`  new vocab entries : ${missing.length}`);
console.log(`  report            : ${OUT_MD}`);
