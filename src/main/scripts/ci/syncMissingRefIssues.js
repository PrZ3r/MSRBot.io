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
 * syncMissingRefIssues.js — create / update / close "MISSING REF: <refId>"
 * issues from src/main/reports/mri_presence_audit.json. Idempotent: run it as
 * often as you like; it converges the open `missing-ref` issues on the audit.
 *
 * Called from .github/workflows/sync-report-issues.yml via actions/github-script:
 *
 *   await require('./src/main/scripts/ci/syncMissingRefIssues.js')({ github, context, core });
 *
 * Only canonical-form refs whose publisher is known but whose target isn't in
 * the registry (`needsResolve === 'known-publisher-no-doc'`) get an issue.
 * Orphan slugs (`orphan/<sourceDoc>/<suffix>`) never do — their citation data
 * already lives on `doc.references[]` via the MRI slug, so there is no
 * "missing ref" to file.
 */

const fs = require('fs');

const AUDIT_PATH = 'src/main/reports/mri_presence_audit.json';
const MAX_MUTATIONS = 75;
const LABELS = ['automated', 'mri', 'missing-ref'];

// The trailing "_Created automatically … — Run #N_" line changes every run;
// compare bodies without it so an unchanged issue isn't rewritten each time.
function withoutFooter(body) {
  return String(body || '').replace(/\n_Created automatically from MRI presence audit on [^\n]*_\s*$/, '');
}

function formatSightings(m, max = 10) {
  const arr = (m.sightings || []).slice(0, max);
  if (arr.length === 0) return '- (none listed)';
  return arr.map(s => {
    const parts = [`- ${s.docId || '(unknown doc)'} (${s.type || '?'})`];
    const extras = [];
    if (s.cite) extras.push(` - _cite:_ ` + s.cite);
    if (s.title) extras.push(` - _title:_ ` + s.title);
    if (s.href) extras.push(` - _href:_ ` + s.href);
    if (s.rawRef) extras.push(` - _rawRef:_ ` + s.rawRef);
    if (extras.length) parts[0] += '\n_Source info:_\n ' + extras.join(' \n ');
    return parts.join('');
  }).join('\n');
}

module.exports = async function syncMissingRefIssues({ github, context, core }) {
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  // Backwards-compat: entries without `needsResolve` fall back to `!isOrphan`.
  const rawMissing = Array.isArray(audit.missing) ? audit.missing : [];
  const missing = rawMissing.filter((m) => {
    if (m && m.needsResolve) return m.needsResolve === 'known-publisher-no-doc';
    return !(m && m.isOrphan);
  });
  const skippedOrphans = rawMissing.length - missing.length;
  if (skippedOrphans > 0) {
    core.info(`Skipped ${skippedOrphans} orphan-slug entries (no canonical refId; no issue to open).`);
  }

  const { owner, repo } = context.repo;
  let mutations = 0;
  const currentMissing = new Set(missing.map(m => m.refId));

  const all = await github.paginate(github.rest.issues.listForRepo, {
    owner, repo, state: 'open', labels: 'missing-ref'
  });
  // Oldest issue per title is canonical; later copies are duplicates.
  const openIssues = all
    .filter(i => i.title && i.title.startsWith('MISSING REF: '))
    .sort((a, b) => a.number - b.number);
  const openByTitle = new Map();
  const duplicates = [];
  for (const i of openIssues) {
    if (openByTitle.has(i.title)) duplicates.push(i);
    else openByTitle.set(i.title, i);
  }

  const runTag = `Run #${context.runId}`;
  const stamp = new Date().toISOString().slice(0, 10);

  function allowMutation(action, key) {
    if (mutations >= MAX_MUTATIONS) {
      core.warning(`Mutation budget reached (${MAX_MUTATIONS}); skipping ${action} for ${key}`);
      return false;
    }
    return true;
  }

  let created = 0, updated = 0, closed = 0;
  // Close duplicate issues (same title as an older open issue).
  for (const dup of duplicates) {
    if (!allowMutation('close-duplicate', dup.title)) continue;
    const original = openByTitle.get(dup.title);
    await github.rest.issues.createComment({
      owner, repo, issue_number: dup.number,
      body: `Duplicate of #${original.number} (Run #${context.runId}). Closing.`
    });
    await github.rest.issues.update({ owner, repo, issue_number: dup.number, state: 'closed', state_reason: 'duplicate' });
    mutations += 1; closed += 1;
  }

  // Close resolved issues first — they're cheap and reflect real progress, so
  // a large create backlog can't starve them of the per-run mutation budget.
  for (const issue of openByTitle.values()) {
    const refId = issue.title.replace(/^MISSING REF: /, '');
    if (!currentMissing.has(refId)) {
      if (!allowMutation('close', refId)) continue;
      await github.rest.issues.update({ owner, repo, issue_number: issue.number, state: 'closed' });
      mutations += 1; closed += 1;
    }
  }

  const orderedMissing = [...missing].sort((a, b) => (b.sightingCount || 0) - (a.sightingCount || 0));
  for (const m of orderedMissing) {
    const title = `MISSING REF: ${m.refId}`;
    const body = [
      `Detected as MISSING`,
      `RefId: **${m.refId}**`,
      `Sightings: **${m.sightingCount}**`,
      '',
      'First few sightings:',
      formatSightings(m, 10),
      '',
      `_Created automatically from MRI presence audit on ${stamp} — ${runTag}_`
    ].join('\n');

    const existing = openByTitle.get(title);
    if (existing) {
      if (withoutFooter(existing.body) === withoutFooter(body)) continue;
      if (!allowMutation('update', m.refId)) continue;
      await github.rest.issues.update({ owner, repo, issue_number: existing.number, body, labels: LABELS });
      mutations += 1; updated += 1;
    } else {
      if (!allowMutation('create', m.refId)) continue;
      await github.rest.issues.create({ owner, repo, title, body, labels: LABELS });
      mutations += 1; created += 1;
    }
  }

  core.info(`Missing-ref issue sync complete: ${missing.length} missing, ${created} created, ${updated} updated, ${closed} closed (mutations ${mutations}/${MAX_MUTATIONS}).`);
};
