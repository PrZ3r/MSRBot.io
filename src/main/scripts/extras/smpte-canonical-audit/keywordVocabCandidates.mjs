/*
 * keywordVocabCandidates.mjs — vocabulary curation table for the canonical
 * keywords backfill (pass 3b, currently report-only).
 *
 * Emits every case-folded canonical index_term appearing in ≥3 candidate
 * docs that isn't already in site.json controlledKeywords, annotated with
 * a curation suggestion:
 *   ADD          new controlledKeywords entry (form given)
 *   FOLD → X     synonym of existing vocab entry or another candidate; map at fill time
 *   DROP         too generic / not a topic
 *
 * The user edits the emitted MD; the final decisions get encoded into the
 * fill pass.
 *
 * Output: src/main/reports/smpte-canonical-audit/keywordVocabCandidates.md
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

// suggestion map — keyed by lowercase candidate. Anything not listed gets 'ADD (as-is)'.
const S = new Map(Object.entries({
  // resolution / format family
  '3d':                        { v: 'FOLD', to: 'Stereoscopic', note: 'vocab has Stereoscopic; 3D alone is ambiguous' },
  's3d':                       { v: 'FOLD', to: 'Stereoscopic' },
  'stereoscopic 3d':           { v: 'FOLD', to: 'Stereoscopic' },
  'stereoscopy':               { v: 'FOLD', to: 'Stereoscopic' },
  '3dtv':                      { v: 'FOLD', to: 'Stereoscopic' },
  'disparity':                  { v: 'ADD', as: 'Disparity' },
  'visual fatigue':             { v: 'ADD', as: 'Visual Fatigue' },
  '4k':                        { v: 'ADD', as: '4K' },
  '8k':                        { v: 'ADD', as: '8K' },
  '2k':                        { v: 'ADD', as: '2K' },
  'uhd':                       { v: 'FOLD', to: 'UHDTV' },
  'super hi-vision':            { v: 'ADD', as: 'Super Hi-Vision' },
  'hd':                        { v: 'FOLD', to: 'HDTV' },
  'hfr':                       { v: 'ADD', as: 'HFR' },
  'high frame rate':           { v: 'FOLD', to: 'HFR' },
  'closed captioning':         { v: 'FOLD', to: 'Captions', note: 'vocab has Captions' },
  // codecs / compression
  'hevc':                      { v: 'ADD', as: 'HEVC' },
  'high efficiency video coding': { v: 'FOLD', to: 'HEVC' },
  'h.265':                      { v: 'ADD', as: 'H.265', note: 'kept distinct from HEVC per review' },
  'h.264':                      { v: 'ADD', as: 'H.264', note: 'kept distinct from AVC per review' },
  'video compression':          { v: 'ADD', as: 'Video Compression' },
  'data compression':          { v: 'FOLD', to: 'Compression' },
  'encoding':                   { v: 'ADD', as: 'Encoding' },
  'motion estimation':         { v: 'FOLD', to: 'Compression', note: 'codec internals' },
  'transcoding':               { v: 'ADD', as: 'Transcoding' },
  'jpeg 2000':                 { v: 'FOLD', to: 'JPEG2000', note: 'vocab has JPEG2000 (one word)' },
  'mpeg-2':                     { v: 'ADD', as: 'MPEG-2' },
  // color
  'high dynamic range':        { v: 'FOLD', to: 'HDR' },
  'rec. 2020':                 { v: 'FOLD', to: 'BT.2020', note: 'pick one form — suggest BT.2020 (ITU name), also candidate below' },
  'bt.2020':                   { v: 'ADD', as: 'BT.2020' },
  'wcg':                       { v: 'FOLD', to: 'Color Gamut' },
  'color gamut':               { v: 'ADD', as: 'Color Gamut' },
  'gamut mapping':              { v: 'ADD', as: 'Gamut Mapping' },
  'colorimetry':               { v: 'ADD', as: 'Colorimetry' },
  'color management':          { v: 'ADD', as: 'Color Management' },
  // infrastructure / IT
  'cloud':                     { v: 'ADD', as: 'Cloud' },
  'saas':                       { v: 'ADD', as: 'SaaS' },
  'virtualization':             { v: 'ADD', as: 'Virtualization' },
  'soa':                       { v: 'DROP', note: 'dated architecture jargon; Microservices already in vocab' },
  'it':                        { v: 'DROP', note: 'too generic' },
  'gpu':                       { v: 'ADD', as: 'GPU' },
  'fpga':                      { v: 'ADD', as: 'FPGA' },
  'storage':                   { v: 'ADD', as: 'Storage' },
  'flash memory':               { v: 'ADD', as: 'Flash Memory' },
  'lto':                       { v: 'ADD', as: 'LTO' },
  'ltfs':                      { v: 'ADD', as: 'LTFS' },
  'ethernet':                  { v: 'ADD', as: 'Ethernet' },
  'network':                   { v: 'FOLD', to: 'Networks' },
  'router':                    { v: 'FOLD', to: 'Networks' },
  'transmission':              { v: 'FOLD', to: 'Networks' },
  'multicast':                 { v: 'ADD', as: 'Multicast' },
  'sdn':                       { v: 'ADD', as: 'SDN' },
  'ptp':                       { v: 'ADD', as: 'PTP' },
  'avb':                       { v: 'ADD', as: 'AVB' },
  'low latency':               { v: 'ADD', as: 'Low Latency' },
  'snmp':                      { v: 'ADD', as: 'SNMP' },
  'hdmi':                      { v: 'ADD', as: 'HDMI' },
  'displayport':               { v: 'ADD', as: 'DisplayPort' },
  'hd-sdi':                    { v: 'FOLD', to: 'SDI' },
  '3g-sdi':                    { v: 'FOLD', to: 'SDI' },
  'serial digital interface':  { v: 'FOLD', to: 'SDI' },
  // displays
  'oled':                      { v: 'ADD', as: 'OLED' },
  'lcd':                       { v: 'ADD', as: 'LCD' },
  'displays':                  { v: 'FOLD', to: 'Display' },
  'laser':                     { v: 'ADD', as: 'Laser' },
  // workflow / ops
  'workflow':                  { v: 'ADD', as: 'Workflow' },
  'workflows':                 { v: 'FOLD', to: 'Workflow' },
  'file-based workflows':      { v: 'FOLD', to: 'File-Based Workflow' },
  'file-based workflow':        { v: 'ADD', as: 'File-Based Workflow' },
  'file-based':                { v: 'FOLD', to: 'File-Based Workflow' },
  'post production':           { v: 'ADD', as: 'Post Production' },
  'editing':                   { v: 'FOLD', to: 'Edit', note: 'vocab has Edit' },
  'monitoring':                { v: 'ADD', as: 'Monitoring' },
  'master control':            { v: 'ADD', as: 'Master Control' },
  'automation':                { v: 'FOLD', to: 'Automation' },
  'media asset management':    { v: 'ADD', as: 'Media Asset Management' },
  'asset management':          { v: 'FOLD', to: 'Media Asset Management' },
  'archiving':                 { v: 'FOLD', to: 'Archive' },
  'preservation':              { v: 'ADD', as: 'Preservation', note: 'distinct archival concept — or FOLD → Archive' },
  'standards conversion':      { v: 'ADD', as: 'Standards Conversion' },
  'conversion':                { v: 'DROP', note: 'too generic' },
  'synchronization':           { v: 'FOLD', to: 'Time & Sync' },
  'scalability':               { v: 'DROP', note: 'too generic' },
  'systems':                   { v: 'DROP', note: 'too generic' },
  'contribution':              { v: 'ADD', as: 'Contribution', note: 'broadcast contribution feeds' },
  'contribution services':     { v: 'FOLD', to: 'Contribution' },
  // perception / research
  'perception':                { v: 'ADD', as: 'Perception' },
  'human visual system':        { v: 'ADD', as: 'Human Visual System' },
  'subjective study':          { v: 'DROP', note: 'methodology, not topic' },
  // audio
  'spatial audio':              { v: 'ADD', as: 'Spatial Audio' },
  'surround':                   { v: 'ADD', as: 'Surround' },
  // cinema
  'digital cinema':            { v: 'FOLD', to: 'DCinema' },
  'cinema':                    { v: 'DROP', note: 'Film / Theater / DCinema cover it' },
  // misc
  'image processing':           { v: 'ADD', as: 'Image Processing' },
  'video signal processing':    { v: 'ADD', as: 'Video Signal Processing' },
  'smpte standards':           { v: 'FOLD', to: 'Standards' },
  'ieee':                      { v: 'DROP', note: 'publisher, not topic' },
  'olympics':                  { v: 'DROP', note: 'event, not technology topic — or keep if event coverage matters' },
  'advertising':               { v: 'ADD', as: 'Advertising' },
  'ad-id':                     { v: 'FOLD', to: 'Advertising', note: 'or keep Ad-ID as its own standard entry' },
  'immersive':                 { v: 'FOLD', to: 'Immersive Audio', note: 'all 3 uses are audio context' },
}));

// ---- rebuild the candidate list (same logic as profiling) ----------------
const site = JSON.parse(fs.readFileSync('src/main/config/site.json', 'utf8'));
const ctrlLower = new Set((site.controlledKeywords || []).map(k => k.toLowerCase()));
const j = JSON.parse(fs.readFileSync(path.join(REPORTS, 'canonicalLibrary.journal.json')));
const c = JSON.parse(fs.readFileSync(path.join(REPORTS, 'canonicalLibrary.conference.json')));
const docs = loadAllDocs();
const canon = new Map();
for (const p of j.periodicals) for (const v of p.volumes) for (const i of v.issues) for (const a of i.articles) if (a.doi) canon.set(a.doi.trim(), a.keywords || []);
for (const cf of c.conferences) for (const a of cf.articles) if (a.doi) canon.set(a.doi.trim(), a.keywords || []);

const freq = new Map();
for (const d of docs) {
  if (!d.doi) continue;
  const kws = canon.get(String(d.doi).trim());
  if (!kws || !kws.length) continue;
  if (Array.isArray(d.keywords) && d.keywords.length) continue;
  for (const k of kws) {
    const t = String(k).replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const lo = t.toLowerCase();
    if (!freq.has(lo)) freq.set(lo, { n: 0, forms: new Map() });
    const e = freq.get(lo);
    e.n++;
    e.forms.set(t, (e.forms.get(t) || 0) + 1);
  }
}
const candidates = [...freq.entries()]
  .filter(([lo, e]) => e.n >= 3 && !ctrlLower.has(lo))
  .sort((a, b) => b[1].n - a[1].n)
  .map(([lo, e]) => ({
    lo,
    form: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0],
    n: e.n,
  }));

// ---- emit ---------------------------------------------------------------
const adds = [], folds = [], drops = [], unreviewed = [];
for (const c2 of candidates) {
  const s = S.get(c2.lo);
  if (!s) { unreviewed.push(c2); continue; }
  if (s.v === 'ADD') adds.push({ ...c2, s });
  else if (s.v === 'FOLD') folds.push({ ...c2, s });
  else drops.push({ ...c2, s });
}

const md = [];
md.push('# Keyword vocabulary candidates — canonical index_terms (≥3 docs)');
md.push('');
md.push(`> Generated: ${new Date().toISOString()}`);
md.push(`> ${candidates.length} candidates from 305 fill-candidate docs · current controlledKeywords: ${(site.controlledKeywords || []).length}`);
md.push('> Edit this table: change any verdict, then the decisions get encoded into the fill pass.');
md.push('');
md.push(`## ✅ ADD — new controlledKeywords entries (${adds.length})`);
md.push('');
md.push('| add as | docs | source form | note |');
md.push('|---|---:|---|---|');
for (const a of adds) md.push(`| **${a.s.as}** | ${a.n} | \`${a.form}\` | ${a.s.note || ''} |`);
md.push('');
md.push('### Paste-ready additions');
md.push('');
md.push('```json');
md.push(JSON.stringify(adds.map(a => a.s.as).sort(), null, 0));
md.push('```');
md.push('');
md.push(`## 🔁 FOLD — synonyms mapped at fill time (${folds.length})`);
md.push('');
md.push('| candidate | docs | folds into | note |');
md.push('|---|---:|---|---|');
for (const f of folds) md.push(`| \`${f.form}\` | ${f.n} | **${f.s.to}** | ${f.s.note || ''} |`);
md.push('');
md.push(`## 🗑️ DROP (${drops.length})`);
md.push('');
md.push('| candidate | docs | why |');
md.push('|---|---:|---|');
for (const d of drops) md.push(`| \`${d.form}\` | ${d.n} | ${d.s.note || ''} |`);
md.push('');
if (unreviewed.length) {
  md.push(`## ❓ UNREVIEWED (${unreviewed.length})`);
  md.push('');
  md.push('| candidate | docs |');
  md.push('|---|---:|');
  for (const u of unreviewed) md.push(`| \`${u.form}\` | ${u.n} |`);
  md.push('');
}
md.push('## Notes');
md.push('');
md.push('- Terms in <3 docs (1,394 singletons + ~185 doubles) are excluded — they can ride along later if the vocab grows.');
md.push('- 99 canonical terms already match controlledKeywords case-insensitively and will flow through the fill regardless.');
md.push('- FOLD mappings apply only at fill time; they do not rename anything already in the registry.');
fs.writeFileSync(path.join(REPORTS, 'keywordVocabCandidates.md'), md.join('\n') + '\n');

// Machine-readable decisions for the fill pass (canonicalFieldBackfill.js).
// folds: lowercase source term -> vocab target. adds are expected to already
// be present in site.json controlledKeywords when the fill runs.
const decisions = {
  generatedAt: new Date().toISOString(),
  adds: adds.map(a => a.s.as).sort(),
  folds: Object.fromEntries(folds.map(f => [f.lo, f.s.to])),
  drops: drops.map(d => d.lo).sort(),
};
fs.writeFileSync(path.join(REPORTS, 'keywordVocabDecisions.json'), JSON.stringify(decisions, null, 2) + '\n');
console.log(`wrote ${path.join(REPORTS, 'keywordVocabCandidates.md')} + keywordVocabDecisions.json`);
console.log(`ADD: ${adds.length} · FOLD: ${folds.length} · DROP: ${drops.length} · UNREVIEWED: ${unreviewed.length}`);
