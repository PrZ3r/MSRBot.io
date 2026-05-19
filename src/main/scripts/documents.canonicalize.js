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
 * Canonicalize and enforce $meta for the documents registry
 */

const fs = require('fs');
const path = require('path');
const stringify = require('json-stable-stringify');
const { getPrLogPath } = require('./utils/prLogPath');
const {
  loadAllDocs,
  walkJsonFiles,
  docAbsPath,
  DOCS_ROOT,
} = require('../lib/registry');

// Default $meta for manual entries (timestamp is once per run in UTC)
const defaultMeta = {
  confidence: "medium",
  source: "manual",
  updated: new Date().toISOString()
};

// Container-level fields to skip $meta injection
const containerFields = new Set(["status", "references", "workInfo"]);

function ensureMeta(obj, path = "", rootDocId = null, changedDocs = {}) {
  for (const key of Object.keys(obj)) {
    if (key.endsWith("$meta")) continue;

    // Skip container-level meta injection at top-level
    if (containerFields.has(key) && path === "") {
      if (typeof obj[key] === "object") {
        ensureMeta(obj[key], `${key}.`, rootDocId, changedDocs);
      }
      continue;
    }

    const metaKey = `${key}$meta`;
    if (!(metaKey in obj)) {
      obj[metaKey] = { ...defaultMeta };

      // Track this change for PR log
      if (!changedDocs[rootDocId]) changedDocs[rootDocId] = [];
      changedDocs[rootDocId].push(path + key);

      console.warn(
        `[WARN] Added missing $meta for '${path}${key}' in docId '${rootDocId || "(unknown)"}'`
      );
    }

    // Recurse into nested objects
    if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      ensureMeta(obj[key], `${path}${key}.`, rootDocId, changedDocs);
    }
  }
}

function writeMetaPrLog(changedDocs) {
  const changedDocCount = Object.keys(changedDocs).length;

  if (changedDocCount > 0) {
    console.log(`🛠 Injected missing $meta for ${changedDocCount} document(s) in documents registry...`);

    const prLogPath = getPrLogPath();
    const sectionHeader = "### 🛠 Canonicalization fixed missing $meta fields";

    // Read existing PR log if it exists
    let existingLog = "";
    if (fs.existsSync(prLogPath)) {
      existingLog = fs.readFileSync(prLogPath, 'utf8');

      // Remove any previous canonicalization section
      const lines = existingLog.split("\n");
      const filtered = [];
      let skipping = false;
      for (const line of lines) {
        if (line.startsWith(sectionHeader)) {
          skipping = true;
        } else if (skipping && line.startsWith("### ")) {
          skipping = false;
          filtered.push(line);
        } else if (!skipping) {
          filtered.push(line);
        }
      }
      existingLog = filtered.join("\n").trim();
    }

    // Build new canonicalization section
    const prLogLines = [
      `---`,
      ``,
      `${sectionHeader} in ${changedDocCount} document(s):`
    ];
    for (const [docId, fields] of Object.entries(changedDocs)) {
      prLogLines.push(`- ${docId} (injected: ${fields.join(', ')})`);
    }

    // Append to the end and write back
    const finalLog = (existingLog ? existingLog + "\n" : "") + prLogLines.join("\n") + "\n";
    fs.writeFileSync(prLogPath, finalLog);

    console.log(`📄 PR log updated: ${prLogPath}`);
  }
}

/**
 * Array-mode canonicalize — inject missing $meta, then write the whole
 * registry array back to a single monolithic file.
 */
function canonicalizeDocuments(registry, filePath) {
  const changedDocs = {};
  registry.forEach(doc => ensureMeta(doc, "", doc.docId, changedDocs));
  writeMetaPrLog(changedDocs);

  fs.writeFileSync(
    filePath,
    stringify(registry, { space: '  ' }) + "\n"
  );
}

/**
 * Directory-mode canonicalize (issue #1108) — inject missing $meta, then write
 * each doc back to the shard path derived from its own fields. A file sitting
 * at the wrong path is re-homed: the in-file field wins (decision 2).
 */
function canonicalizeDirectory() {
  // Capture current on-disk locations before rewriting.
  const beforeFiles = new Map();
  for (const file of walkJsonFiles(DOCS_ROOT)) {
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (d && d.docId != null) beforeFiles.set(String(d.docId), file);
    } catch {
      /* parse errors surface in validate */
    }
  }

  const docs = loadAllDocs();
  const changedDocs = {};
  docs.forEach(doc => ensureMeta(doc, "", doc.docId, changedDocs));

  let rehomed = 0;
  for (const doc of docs) {
    const target = docAbsPath(doc);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, stringify(doc, { space: '  ' }) + "\n");

    const old = beforeFiles.get(String(doc.docId));
    if (old && path.resolve(old) !== path.resolve(target)) {
      try { fs.unlinkSync(old); } catch { /* already gone */ }
      rehomed += 1;
      console.warn(`[WARN] Re-homed ${doc.docId}: ${path.relative(DOCS_ROOT, old)} -> ${path.relative(DOCS_ROOT, target)}`);
    }
  }

  if (rehomed > 0) console.log(`🛠 Re-homed ${rehomed} document(s) to their derived shard path`);

  // Prune directories left empty by re-homing (bottom-up; never DOCS_ROOT itself).
  const pruned = pruneEmptyDirs(DOCS_ROOT);
  if (pruned > 0) console.log(`🧹 Pruned ${pruned} empty director(ies)`);

  writeMetaPrLog(changedDocs);
}

// Recursively remove empty directories under `dir`. Returns the count removed.
function pruneEmptyDirs(dir) {
  let removed = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return removed;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) removed += pruneEmptyDirs(path.join(dir, entry.name));
  }
  if (dir !== DOCS_ROOT && fs.readdirSync(dir).length === 0) {
    try { fs.rmdirSync(dir); removed += 1; } catch { /* race / not empty */ }
  }
  return removed;
}

module.exports = canonicalizeDocuments;
module.exports.canonicalizeDirectory = canonicalizeDirectory;