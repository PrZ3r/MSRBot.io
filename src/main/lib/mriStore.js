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
 * mriStore.js — single point of access to the on-disk Master Reference Index.
 *
 * The MRI used to be one monolithic src/main/reports/masterReferenceIndex.json;
 * it outgrew GitHub's 100 MB per-file limit (issue #1266), so it is stored as a
 * directory of one pretty-printed JSON file per ref entry:
 *
 *   src/main/reports/mri/index.json                 top-level fields (version,
 *                                                    stats, reverse, orphans, …)
 *                                                    — everything except `refs`
 *   src/main/reports/mri/refs/{prefix}/{refId}.json  canonical refs
 *                                                    (e.g. smpte/SMPTE.ST2067-21.2020.json,
 *                                                     rfc/RFC8446.json, 10.5594/10.5594-J06292.json)
 *   src/main/reports/mri/refs/orphan/{sourceDoc}/{refXmlId}.json
 *                                                    orphan slugs `orphan/<sourceDoc>/<refXmlId>`,
 *                                                    grouped by the citing doc
 *
 * Each shard holds the entry object verbatim (every field, every shape); its
 * `refId` is the map key, so file names are for humans only. Directory names
 * are lower-cased and a file name gets a `~<hash>` suffix when its key is not
 * filesystem-safe or would collide case-insensitively with another key (SMPTE
 * J/j docIds are distinct refs) — case-insensitive filesystems (macOS) stay safe.
 *
 * loadMri() returns the same in-memory shape the monolith had (`refs` keys in
 * sorted order). writeMri() only rewrites shards whose content changed and
 * deletes shards for removed keys — so an unchanged MRI produces no diff.
 * There is deliberately no generatedAt: git history records when the MRI
 * changed, and a per-run timestamp would make concurrent data PRs conflict on
 * the same line (#1266).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_ROOT = path.resolve('src/main/reports/mri');
const LEGACY_PATH = path.resolve('src/main/reports/masterReferenceIndex.json');

function _serialize(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function _hash8(key) {
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 8);
}

/** Filesystem-safe path component; '' / '.' / '..' map to '_'. */
function _safe(part) {
  const s = String(part).replace(/[^A-Za-z0-9._-]+/g, '-');
  return (s === '' || s === '.' || s === '..') ? '_' : s;
}

/**
 * Preferred (pre-collision) shard path for a ref key, relative to refs/.
 * Returns { dirs: [...], base, lossy } — lossy when sanitising changed a part.
 */
function _preferredPath(key) {
  const k = String(key);
  let dirs;
  let base;
  let lossy = false;
  if (k.startsWith('orphan/')) {
    const parts = k.split('/');
    // orphan/<sourceDoc>/<refXmlId...> — any extra '/' stays inside the file name
    dirs = ['orphan', parts[1] || '_'];
    base = parts.slice(2).join('/') || '_';
  } else {
    const m = k.match(/^\d+\.\d+/) || k.match(/^[A-Za-z]+/);
    dirs = [m ? m[0] : '_'];
    base = k;
  }
  const safeDirs = dirs.map((d) => {
    const s = _safe(d);
    if (s !== d) lossy = true;
    return s.toLowerCase();
  });
  const safeBase = _safe(base);
  if (safeBase !== base) lossy = true;
  return { dirs: safeDirs, base: safeBase, lossy };
}

/**
 * shardPaths(keys) — deterministic key -> relative shard path (under refs/)
 * for a whole key set. A `~<hash8>` suffix is added when a key is lossy or
 * when two keys would land on the same path case-insensitively.
 */
function shardPaths(keys) {
  const pref = new Map();
  const folded = new Map(); // lower-cased path -> count
  for (const key of keys) {
    const p = _preferredPath(key);
    const rel = path.join(...p.dirs, `${p.base}.json`);
    pref.set(key, { ...p, rel });
    const f = rel.toLowerCase();
    folded.set(f, (folded.get(f) || 0) + 1);
  }
  const out = new Map();
  for (const [key, p] of pref) {
    const clash = folded.get(p.rel.toLowerCase()) > 1;
    out.set(key, (p.lossy || clash)
      ? path.join(...p.dirs, `${p.base}~${_hash8(key)}.json`)
      : p.rel);
  }
  return out;
}

function _walkJson(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return out;
    throw err;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) _walkJson(full, out);
    else if (e.isFile() && e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function _removeEmptyDirs(dir, keepRoot) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) if (e.isDirectory()) _removeEmptyDirs(path.join(dir, e.name), false);
  if (!keepRoot) {
    try { if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir); } catch { /* not empty / gone */ }
  }
}

/** True when an MRI exists at `root` (sharded) or at the legacy monolith path. */
function mriExists(root = DEFAULT_ROOT) {
  return fs.existsSync(path.join(root, 'index.json')) || (root === DEFAULT_ROOT && fs.existsSync(LEGACY_PATH));
}

/**
 * loadMri(root) — assemble the full MRI object ({ version, stats, refs,
 * reverse, orphans, … }). A legacy `generatedAt` in index.json is dropped.
 * Falls back to the legacy monolithic file when no sharded store exists yet
 * (pre-migration checkouts). Returns null when neither exists.
 */
function loadMri(root = DEFAULT_ROOT) {
  const indexPath = path.join(root, 'index.json');
  if (!fs.existsSync(indexPath)) {
    if (root === DEFAULT_ROOT && fs.existsSync(LEGACY_PATH)) {
      return JSON.parse(fs.readFileSync(LEGACY_PATH, 'utf8'));
    }
    return null;
  }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const entries = [];
  for (const file of _walkJson(path.join(root, 'refs'))) {
    let entry;
    try {
      entry = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`Failed to parse MRI shard ${file}: ${err.message}`);
    }
    if (!entry || typeof entry.refId !== 'string') {
      throw new Error(`MRI shard ${file} has no string refId`);
    }
    entries.push(entry);
  }
  entries.sort((a, b) => (a.refId < b.refId ? -1 : a.refId > b.refId ? 1 : 0));
  const refs = {};
  for (const e of entries) {
    if (Object.prototype.hasOwnProperty.call(refs, e.refId)) {
      throw new Error(`Duplicate MRI refId across shards: ${e.refId}`);
    }
    refs[e.refId] = e;
  }
  // Rebuild in the monolith's field order: refs sits after stats.
  const { version, generatedAt: _legacy, stats, ...rest } = index;
  const out = {};
  if (version !== undefined) out.version = version;
  if (stats !== undefined) out.stats = stats;
  out.refs = refs;
  Object.assign(out, rest);
  return out;
}

/**
 * writeMri(mri, { root }) — persist an MRI object as shards.
 * Only shards whose serialized content differs are rewritten; shards whose
 * key disappeared are deleted; index.json is rewritten only when it differs.
 * Any `generatedAt` on the object is not persisted.
 * Returns { changed, written, deleted, indexChanged, root }.
 */
function writeMri(mri, opts = {}) {
  const root = opts.root || DEFAULT_ROOT;
  const refsRoot = path.join(root, 'refs');
  const refs = (mri && mri.refs) || {};
  for (const [k, e] of Object.entries(refs)) {
    if (!e || e.refId !== k) {
      throw new Error(`MRI entry key/refId mismatch: key=${k} refId=${e && e.refId}`);
    }
  }

  const targets = shardPaths(Object.keys(refs));
  const wanted = new Set();
  let written = 0;
  for (const [key, rel] of targets) {
    const abs = path.join(refsRoot, rel);
    wanted.add(path.resolve(abs));
    const body = _serialize(refs[key]);
    let prev = null;
    try { prev = fs.readFileSync(abs, 'utf8'); } catch { /* new shard */ }
    if (prev !== body) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body);
      written++;
    }
  }

  let deleted = 0;
  for (const file of _walkJson(refsRoot)) {
    if (!wanted.has(path.resolve(file))) {
      fs.unlinkSync(file);
      deleted++;
    }
  }
  if (deleted) _removeEmptyDirs(refsRoot, true);

  // index.json = everything but refs, in the monolith's field order.
  const { refs: _omit, generatedAt: _ga, version, stats, ...tail } = mri || {};
  const index = {};
  if (version !== undefined) index.version = version;
  if (stats !== undefined) index.stats = stats;
  Object.assign(index, tail);
  const indexPath = path.join(root, 'index.json');
  const indexBody = _serialize(index);
  let prevIndexBody = null;
  try { prevIndexBody = fs.readFileSync(indexPath, 'utf8'); } catch { /* none yet */ }
  const indexChanged = prevIndexBody !== indexBody;
  if (indexChanged) {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(indexPath, indexBody);
  }

  const changed = written > 0 || deleted > 0 || indexChanged;
  return { changed, written, deleted, indexChanged, root };
}

module.exports = {
  DEFAULT_ROOT,
  LEGACY_PATH,
  shardPaths,
  mriExists,
  loadMri,
  writeMri,
};
