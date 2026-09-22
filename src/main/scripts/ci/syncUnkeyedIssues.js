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
 * syncUnkeyedIssues.js — one "UNKEYED: <docKey>" issue per doc the Master
 * Suite Index could not key into a lineage; closes issues whose doc is no
 * longer UNKEYED. Idempotent.
 *
 * Called from .github/workflows/sync-report-issues.yml via actions/github-script:
 *
 *   await require('./src/main/scripts/ci/syncUnkeyedIssues.js')({ github, context, core });
 */

const fs = require('fs');

const MSI_PATH = 'src/main/reports/masterSuiteIndex.json';

module.exports = async function syncUnkeyedIssues({ github, context, core }) {
  const report = JSON.parse(fs.readFileSync(MSI_PATH, 'utf8'));
  const byPub = report?.skippedDocs?.byPublisher || {};
  const { owner, repo } = context.repo;

  // CURRENT set of UNKEYED doc identifiers (prefer 'key' if present, else
  // docId), with per-doc details for the issue body.
  const currentUnkeyed = new Set();
  const detailByKey = {};
  for (const [pub, block] of Object.entries(byPub)) {
    for (const it of (block.items || [])) {
      if (it?.reason !== 'UNKEYED') continue;
      const key = (it.key || it.docId || '').trim();
      if (!key) continue;
      currentUnkeyed.add(key);
      detailByKey[key] = { publisher: pub, rule: it.rule, ruleDetail: it.ruleDetail, lineageKey: it.key };
    }
  }
  core.info(`Current UNKEYED count in report: ${currentUnkeyed.size}`);

  async function listOpenUnkeyedIssues() {
    const issues = await github.paginate(github.rest.issues.listForRepo, {
      owner, repo, state: 'open', labels: 'unkeyed'
    });
    return issues.filter(i => i.title.startsWith('UNKEYED: '));
  }

  const openIssues = await listOpenUnkeyedIssues();
  const openTitles = new Set(openIssues.map(i => i.title));
  const stamp = new Date().toISOString().slice(0, 10);
  const runTag = `Run #${context.runId}`;

  // 1) Ensure an issue exists per CURRENT unkeyed doc
  let created = 0;
  for (const docKey of currentUnkeyed) {
    if (openTitles.has(`UNKEYED: ${docKey}`)) continue;
    const details = detailByKey[docKey] || {};
    const body = [
      `Detected as UNKEYED`,
      `RefId: **${docKey}**\n`,
      '',
      'Context:',
      `- Publisher: ${details.publisher || '(unknown)'}`,
      `- Rule: ${details.rule || '(unknown)'}`,
      `- Rule detail: ${details.ruleDetail || '(none)'}`,
      details.lineageKey ? `- Lineage key: ${details.lineageKey}` : null,
      '',
      `\n_Created automatically from MSI on ${stamp} — ${runTag}_`
    ].filter(Boolean).join('\n');
    const res = await github.rest.issues.create({
      owner, repo, title: `UNKEYED: ${docKey}`, body, labels: ['automated', 'unkeyed', 'msi']
    });
    openTitles.add(`UNKEYED: ${docKey}`);
    created += 1;
    core.info(`Created UNKEYED issue #${res.data.number} for ${docKey}`);
  }

  // 2) Close stale UNKEYED issues whose docKey is no longer present
  let closed = 0;
  for (const issue of openIssues) {
    const docKey = issue.title.replace(/^UNKEYED: /, '');
    if (currentUnkeyed.has(docKey)) continue;
    await github.rest.issues.createComment({
      owner, repo, issue_number: issue.number,
      body: `Resolved: no longer reported as UNKEYED (Run #${context.runId}). Closing.`
    });
    await github.rest.issues.update({ owner, repo, issue_number: issue.number, state: 'closed' });
    closed += 1;
    core.info(`Closed resolved UNKEYED issue for ${docKey}`);
  }
  core.info(`UNKEYED issue sync complete: ${currentUnkeyed.size} unkeyed, ${created} created, ${closed} closed.`);
};
