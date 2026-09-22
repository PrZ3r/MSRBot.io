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
 * syncIssues.test.js — pins the post-merge issue sync (sync-report-issues.yml):
 *   - MISSING REF: orphans skipped; closes run before creates; duplicates
 *     closed (oldest kept); an unchanged issue is NOT rewritten just because
 *     the run footer differs; mutation budget respected; converges (a second
 *     run against the result is a no-op).
 *   - UNKEYED: creates for new keys, closes stale ones.
 *
 *   node src/main/scripts/test/syncIssues.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
const syncMissing = require(path.join(repoRoot, 'src/main/scripts/ci/syncMissingRefIssues.js'));
const syncUnkeyed = require(path.join(repoRoot, 'src/main/scripts/ci/syncUnkeyedIssues.js'));

// In-memory GitHub: issues live in `state.open`; every call is recorded.
function fakeGithub(state) {
  const calls = [];
  let next = 1000;
  return {
    calls,
    api: {
      paginate: async () => state.open.map(i => ({ ...i })),
      rest: {
        issues: {
          listForRepo() {},
          createComment: async () => {},
          create: async ({ title, body }) => {
            calls.push({ op: 'create', title });
            state.open.push({ number: next++, title, body });
            return { data: { number: next - 1 } };
          },
          update: async ({ issue_number, state: st, body }) => {
            calls.push({ op: st === 'closed' ? 'close' : 'update', number: issue_number });
            if (st === 'closed') state.open = state.open.filter(i => i.number !== issue_number);
            else state.open.find(i => i.number === issue_number).body = body;
          },
        },
      },
    },
  };
}
const core = { info() {}, warning() {} };
const ctx = (runId) => ({ repo: { owner: 'o', repo: 'r' }, runId });
const ops = (calls) => calls.map(c => c.op);

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-issues-test-'));
fs.mkdirSync(path.join(sandbox, 'src/main/reports'), { recursive: true });
process.chdir(sandbox);

(async () => {
  // ---------------- MISSING REF ----------------
  const sighting = (docId) => ({ docId, type: 'normative', cite: `cite in ${docId}`, href: '', rawRef: '', title: null });
  fs.writeFileSync('src/main/reports/mri_presence_audit.json', JSON.stringify({
    missing: [
      { refId: 'RFC1', sourceDocId: null, sightingCount: 1, sightings: [sighting('A')], isOrphan: false, needsResolve: 'known-publisher-no-doc' },
      { refId: 'RFC2', sourceDocId: null, sightingCount: 2, sightings: [sighting('A'), sighting('B')], isOrphan: false, needsResolve: 'known-publisher-no-doc' },
      { refId: 'orphan/A/x', sourceDocId: null, sightingCount: 1, sightings: [sighting('A')], isOrphan: true, needsResolve: 'unknown-publisher' },
    ],
  }));

  // First run from scratch: RFC2 (more sightings) then RFC1; orphan skipped.
  const state = { open: [] };
  let gh = fakeGithub(state);
  await syncMissing({ github: gh.api, context: ctx(1), core });
  assert.deepStrictEqual(gh.calls.map(c => c.title), ['MISSING REF: RFC2', 'MISSING REF: RFC1']);

  // Second run, different runId (footer differs): nothing to do.
  gh = fakeGithub(state);
  await syncMissing({ github: gh.api, context: ctx(2), core });
  assert.deepStrictEqual(ops(gh.calls), [], 'unchanged issues must not be rewritten because of the run footer');

  // Resolved + duplicate: RFC1 resolved, a duplicate RFC2 issue exists.
  const rfc2 = state.open.find(i => i.title === 'MISSING REF: RFC2');
  state.open.push({ number: 5000, title: 'MISSING REF: RFC2', body: rfc2.body });
  state.open.push({ number: 6000, title: 'MISSING REF: RFC9', body: 'stale' });
  gh = fakeGithub(state);
  await syncMissing({ github: gh.api, context: ctx(3), core });
  const closedNumbers = gh.calls.filter(c => c.op === 'close').map(c => c.number).sort();
  assert.deepStrictEqual(closedNumbers, [5000, 6000], 'duplicate (newer) and resolved issues closed');
  assert.ok(state.open.some(i => i.number === rfc2.number), 'oldest RFC2 issue kept');
  assert.ok(!gh.calls.some(c => c.op === 'create'), 'no creates needed');

  // Budget: closes happen before creates even when creates would exhaust it.
  const many = Array.from({ length: 80 }, (_, n) => ({ refId: `RFC${100 + n}`, sourceDocId: null, sightingCount: 1, sightings: [], isOrphan: false, needsResolve: 'known-publisher-no-doc' }));
  fs.writeFileSync('src/main/reports/mri_presence_audit.json', JSON.stringify({ missing: many }));
  const busy = { open: [{ number: 1, title: 'MISSING REF: GONE', body: '' }] };
  gh = fakeGithub(busy);
  await syncMissing({ github: gh.api, context: ctx(4), core });
  assert.strictEqual(gh.calls[0].op, 'close', 'closes run first');
  assert.strictEqual(gh.calls.length, 75, 'mutation budget is 75 per run');
  gh = fakeGithub(busy);
  await syncMissing({ github: gh.api, context: ctx(5), core });
  assert.strictEqual(gh.calls.filter(c => c.op === 'create').length, 6, 'remaining creates land on the next run');
  gh = fakeGithub(busy);
  await syncMissing({ github: gh.api, context: ctx(6), core });
  assert.deepStrictEqual(ops(gh.calls), [], 'converged');

  // ---------------- UNKEYED ----------------
  fs.writeFileSync('src/main/reports/masterSuiteIndex.json', JSON.stringify({
    skippedDocs: { byPublisher: { SMPTE: { items: [
      { docId: 'SMPTE.X.1', reason: 'UNKEYED', rule: 'r', ruleDetail: 'd' },
      { docId: 'SMPTE.Y.1', reason: 'OTHER' },
    ] } } },
  }));
  const uState = { open: [{ number: 7, title: 'UNKEYED: OLD.1', body: '' }] };
  gh = fakeGithub(uState);
  await syncUnkeyed({ github: gh.api, context: ctx(7), core });
  assert.deepStrictEqual(gh.calls.map(c => c.op + ':' + (c.title || c.number)), ['create:UNKEYED: SMPTE.X.1', 'close:7']);
  gh = fakeGithub(uState);
  await syncUnkeyed({ github: gh.api, context: ctx(8), core });
  assert.deepStrictEqual(ops(gh.calls), [], 'UNKEYED sync converged');

  process.chdir(repoRoot);
  fs.rmSync(sandbox, { recursive: true, force: true });
  console.log('syncIssues.test.js — all assertions passed');
})().catch((e) => { console.error(e); process.exit(1); });
