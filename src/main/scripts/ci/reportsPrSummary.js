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

/*
 * reportsPrSummary.js — markdown summary of how a PR changes the MSI / MRI
 * reports, for the auto-updated section of the PR body (build-reports-pr.yml).
 *
 *   node src/main/scripts/ci/reportsPrSummary.js [baseRef]   # default origin/main
 *
 * Compares the working tree's reports with <baseRef>'s. Writes markdown to
 * stdout. Exported helpers are pure so they can be tested without git.
 */

const fs = require('fs');
const { execFileSync } = require('child_process');

const MSI = 'src/main/reports/masterSuiteIndex.json';
const AUDIT = 'src/main/reports/mri_presence_audit.json';
const MRI_INDEX = 'src/main/reports/mri/index.json';
const REPORT_PATHS = [MSI, AUDIT, 'src/main/reports/mri'];
const LIST_MAX = 15;

function gitShowJson(ref, file) {
  try {
    return JSON.parse(execFileSync('git', ['show', `${ref}:${file}`], { maxBuffer: 1024 * 1024 * 1024 }).toString());
  } catch {
    return null;
  }
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function unkeyedKeys(msi) {
  const out = new Set();
  for (const block of Object.values(msi?.skippedDocs?.byPublisher || {})) {
    for (const it of (block.items || [])) {
      if (it?.reason === 'UNKEYED') {
        const k = (it.key || it.docId || '').trim();
        if (k) out.add(k);
      }
    }
  }
  return out;
}
// Same filter the MISSING REF issue sync uses.
function issueWorthyMissing(audit) {
  return new Set((audit?.missing || [])
    .filter(m => (m && m.needsResolve) ? m.needsResolve === 'known-publisher-no-doc' : !(m && m.isOrphan))
    .map(m => m.refId));
}
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');
function delta(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return `${fmt(a)} → ${fmt(b)}`;
  if (a === b) return `${fmt(b)} (no change)`;
  const d = b - a;
  return `${fmt(a)} → ${fmt(b)} (${d > 0 ? '+' : ''}${fmt(d)})`;
}
function listDiff(label, items) {
  if (!items.length) return [];
  const shown = items.slice(0, LIST_MAX).map(x => `\`${x}\``).join(', ');
  const more = items.length > LIST_MAX ? `, … +${items.length - LIST_MAX} more` : '';
  return [`  - ${label} (${items.length}): ${shown}${more}`];
}
const minus = (a, b) => [...a].filter(x => !b.has(x)).sort();

/** Pure: build the markdown from base/head report objects + changed file list. */
function summarize({ baseMsi, headMsi, baseIdx, headIdx, baseAudit, headAudit, changedFiles }) {
  const shardCount = changedFiles.filter(f => f.startsWith('src/main/reports/mri/refs/')).length;
  const lines = ['### MSI / MRI (auto-updated)', ''];
  if (!changedFiles.length) {
    lines.push('Reports unchanged by this PR.');
    return lines.join('\n');
  }
  const bU = unkeyedKeys(baseMsi), hU = unkeyedKeys(headMsi);
  lines.push(`- **MSI:** lineages ${delta(baseMsi?.lineages?.length, headMsi?.lineages?.length)} · UNKEYED ${delta(bU.size, hU.size)}`);
  lines.push(...listDiff('newly UNKEYED', minus(hU, bU)));
  lines.push(...listDiff('no longer UNKEYED', minus(bU, hU)));
  lines.push(`- **MRI:** refs ${delta(baseIdx?.stats?.uniqueRefIds, headIdx?.stats?.uniqueRefIds)} · resolved ${delta(baseIdx?.stats?.resolvedCount, headIdx?.stats?.resolvedCount)}`);
  const bM = issueWorthyMissing(baseAudit), hM = issueWorthyMissing(headAudit);
  lines.push(`- **Missing refs** (issue-worthy): ${delta(bM.size, hM.size)}`);
  lines.push(...listDiff('newly resolved', minus(bM, hM)));
  lines.push(...listDiff('newly missing', minus(hM, bM)));
  const files = [];
  if (changedFiles.includes(MSI)) files.push('`masterSuiteIndex.json`');
  if (shardCount) files.push(`${fmt(shardCount)} MRI shard${shardCount === 1 ? '' : 's'}`);
  if (changedFiles.includes(MRI_INDEX)) files.push('`mri/index.json`');
  if (changedFiles.includes(AUDIT)) files.push('`mri_presence_audit.json`');
  lines.push(`- **Files:** ${files.join(', ')}`);
  return lines.join('\n');
}

if (require.main === module) {
  const base = process.argv[2] || 'origin/main';
  const changedFiles = execFileSync('git', ['diff', '--name-only', base, '--', ...REPORT_PATHS])
    .toString().split('\n').filter(Boolean);
  process.stdout.write(summarize({
    baseMsi: gitShowJson(base, MSI), headMsi: readJson(MSI),
    baseIdx: gitShowJson(base, MRI_INDEX), headIdx: readJson(MRI_INDEX),
    baseAudit: gitShowJson(base, AUDIT), headAudit: readJson(AUDIT),
    changedFiles,
  }) + '\n');
}

module.exports = { summarize };
