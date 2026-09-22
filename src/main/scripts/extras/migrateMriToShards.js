#!/usr/bin/env node
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
 * migrateMriToShards.js — one-shot migration for issue #1266.
 *
 * Splits the monolithic src/main/reports/masterReferenceIndex.json (~100 MB,
 * at GitHub's per-file limit) into the sharded store src/main/reports/mri/
 * (one pretty-printed file per ref; see src/main/lib/mriStore.js), and trims
 * src/main/reports/mri_presence_audit.json to its non-orphan missing[] rows
 * (orphan slugs are counted, not listed — each has its own MRI shard).
 *
 * Every entry is copied verbatim and the result is verified byte-for-byte
 * against the monolith before anything is deleted.
 *
 *   node src/main/scripts/extras/migrateMriToShards.js          # dry run (temp dir)
 *   node src/main/scripts/extras/migrateMriToShards.js --apply  # write store, remove monolith
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
process.chdir(REPO_ROOT);

const { DEFAULT_ROOT, LEGACY_PATH, loadMri, writeMri } = require('../../lib/mriStore');

const AUDIT_PATH = path.resolve('src/main/reports/mri_presence_audit.json');
const APPLY = process.argv.includes('--apply');

function mb(bytes) { return `${(bytes / 1e6).toFixed(1)} MB`; }

function dirStats(dir) {
  let files = 0;
  let bytes = 0;
  let largest = 0;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else {
        const size = fs.statSync(full).size;
        files++;
        bytes += size;
        if (size > largest) largest = size;
      }
    }
  })(dir);
  return { files, bytes, largest };
}

if (!fs.existsSync(LEGACY_PATH)) {
  console.log(`[mri-shards] No monolith at ${path.relative(REPO_ROOT, LEGACY_PATH)} — already migrated.`);
  process.exit(0);
}
if (APPLY && fs.existsSync(path.join(DEFAULT_ROOT, 'index.json'))) {
  console.error(`[mri-shards] ${path.relative(REPO_ROOT, DEFAULT_ROOT)}/index.json already exists alongside the monolith — resolve by hand.`);
  process.exit(1);
}

const legacyText = fs.readFileSync(LEGACY_PATH, 'utf8');
const legacy = JSON.parse(legacyText);
const refCount = Object.keys(legacy.refs || {}).length;
console.log(`[mri-shards] monolith: ${refCount} refs, ${mb(Buffer.byteLength(legacyText))}`);

const root = APPLY ? DEFAULT_ROOT : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mri-shards-')), 'mri');
const res = writeMri(legacy, { root, generatedAt: legacy.generatedAt });
const back = loadMri(root);

// Verify: the store must reproduce the monolith exactly (the monolith was
// written as JSON.stringify(out, null, 2) + '\n').
const identical = JSON.stringify(back, null, 2) + '\n' === legacyText
  || JSON.stringify(back) === JSON.stringify(legacy);
if (!identical) {
  console.error('[mri-shards] VERIFY FAILED — sharded store does not reproduce the monolith. Nothing deleted.');
  process.exit(1);
}
const s = dirStats(root);
console.log(`[mri-shards] store: ${res.written} shard(s) + index.json → ${s.files} files, ${mb(s.bytes)} total, largest file ${mb(s.largest)}`);
console.log('[mri-shards] verify: round trip is identical to the monolith ✓');

// Presence audit: keep every non-orphan missing row, count orphans.
let auditMsg = 'no presence audit found';
let auditOut = null;
if (fs.existsSync(AUDIT_PATH)) {
  const auditText = fs.readFileSync(AUDIT_PATH, 'utf8');
  const audit = JSON.parse(auditText);
  const rows = Array.isArray(audit.missing) ? audit.missing : [];
  const kept = rows.filter((m) => !m.isOrphan);
  const { missing: _m, ...head } = audit;
  auditOut = { ...head, orphansListed: false, missing: kept };
  const text = JSON.stringify(auditOut, null, 2);
  auditMsg = `presence audit: ${rows.length} → ${kept.length} missing[] rows (${rows.length - kept.length} orphan rows dropped), ${mb(Buffer.byteLength(auditText))} → ${mb(Buffer.byteLength(text))}`;
  if (APPLY) fs.writeFileSync(AUDIT_PATH, text);
}
console.log(`[mri-shards] ${auditMsg}`);

if (!APPLY) {
  fs.rmSync(path.dirname(root), { recursive: true, force: true });
  console.log('\nDry run — nothing in the repo changed. Re-run with --apply to write src/main/reports/mri/ and remove the monolith.');
  process.exit(0);
}

fs.unlinkSync(LEGACY_PATH);
console.log(`[mri-shards] removed ${path.relative(REPO_ROOT, LEGACY_PATH)}`);
console.log('\nNext: npm test && npm run validate-mri-coverage && npm run build-mri (should report "unchanged"), then commit src/main/reports/.');
