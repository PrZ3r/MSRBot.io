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

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const Ajv = require("ajv");
const jsonSourceMap = require("json-source-map");
const { listRegistries } = require("./utils/registryList");
const { loadAllDocs, walkJsonFiles, docPath, DOCS_ROOT } = require("../lib/registry");

// Build a Set of paths git tracks (the canonical case-sensitive view). On
// macOS the FS layer is case-insensitive — a file tracked by git as
// `J18503.json` will be reported by `fs.readdirSync` as `j18503.json` once
// any tool writes to the lowercase form, while git's index keeps uppercase.
// Linux CI sees the git-tracked case and fails on path-consistency; this
// helper lets the local validator catch the same drift.
function gitTrackedPaths() {
  try {
    const out = execSync("git ls-files src/main/data/docs", { encoding: "utf8" });
    return new Set(out.split("\n").filter(Boolean));
  } catch (e) {
    return null; // not a git repo or git missing — skip the check
  }
}

/**
 * Validate a directory-backed registry (issue #1108): every per-doc file is
 * schema-checked individually (a failure names the exact file), and each file
 * is asserted to sit at the shard path its own fields derive (decision 2).
 * Returns the merged docs array, sorted by docId.
 */
function validateDirectoryRegistry(reg, validateFn) {
  const files = walkJsonFiles(reg.dataDir).sort();
  const tracked = gitTrackedPaths();
  const pathErrors = [];
  const caseErrors = [];

  for (const file of files) {
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
      throw new Error(`Invalid JSON in ${file}: ${err.message}`);
    }

    // Schema check — validate the doc directly against the item schema so error
    // paths read /docId, /publisher, etc. (not /0/docId from a wrapped array).
    if (!validateFn(doc)) {
      const text = new Ajv({ allErrors: true })
        .errorsText(validateFn.errors, { separator: "\n  " });
      throw new Error(`Schema validation failed for ${file}:\n  ${text}`);
    }

    // Path-consistency check — the in-file fields must derive this file's path.
    const expected = path.join(DOCS_ROOT, docPath(doc));
    if (path.resolve(file) !== path.resolve(expected)) {
      pathErrors.push(
        `  ${path.relative(DOCS_ROOT, file)}\n    -> expected ${path.relative(DOCS_ROOT, expected)}`
      );
    }

    // Case-sensitive cross-check against git's tracked filename. On macOS
    // case-insensitive FS, `fs.readdirSync` can quietly normalise a file's
    // case after a same-path-different-case write, while git's index keeps
    // the original case. CI on Linux (case-sensitive) sees the git case and
    // fails — this catches it locally before push.
    if (tracked) {
      const relFromRepo = path.relative(process.cwd(), file);
      const gitView = [...tracked].find((p) => p.toLowerCase() === relFromRepo.toLowerCase());
      if (gitView && gitView !== relFromRepo) {
        caseErrors.push(
          `  git tracks: ${gitView}\n    fs reports: ${relFromRepo}`
        );
      }
      // Also flag when git's tracked basename case mismatches the doc's docId.
      if (gitView) {
        const gitBase = path.basename(gitView, ".json");
        if (gitBase !== doc.docId) {
          caseErrors.push(
            `  git tracks: ${gitView}\n    docId in file: ${doc.docId}\n    (case-sensitive mismatch — CI will fail)`
          );
        }
      }
    }
  }

  if (pathErrors.length) {
    throw new Error(
      `${pathErrors.length} file(s) not at their derived shard path ` +
      `(run \`npm run canonicalize\` to re-home):\n${pathErrors.join("\n")}`
    );
  }

  if (caseErrors.length) {
    throw new Error(
      `${caseErrors.length} file(s) have a case-only mismatch between git index and ` +
      `filesystem (will fail on Linux CI even if local validate passes — run a ` +
      `two-step \`git mv\` to align):\n${caseErrors.join("\n")}`
    );
  }

  return loadAllDocs();
}

function applyValidationModeFromArgs(argv = []) {
  const args = new Set(argv.map((a) => String(a || "").trim()));
  if (args.has("--warn")) {
    process.env.KEYWORD_VALIDATION_MODE = "warn";
    return "warn";
  }
  if (args.has("--error")) {
    process.env.KEYWORD_VALIDATION_MODE = "error";
    return "error";
  }
  return String(process.env.KEYWORD_VALIDATION_MODE || "error").toLowerCase();
}

async function registries() {
  const ajvFactory = new Ajv({ allErrors: true });
  const regs = {};

  for (const reg of listRegistries()) {
    if (!reg.isDirectory && !fs.existsSync(reg.dataPath)) {
      console.warn(`[WARN] No data file found for ${reg.name}, skipping...`);
      continue;
    }

    console.log(`\nChecking ${reg.name} registry...`);

    // Load schema
    const schema = JSON.parse(fs.readFileSync(reg.schemaPath, "utf8"));
    const validateFn = ajvFactory.compile(schema);

    let data;

    if (reg.isDirectory) {
      // Directory-backed registry: compile the item schema once so each per-doc
      // file is validated directly (clean /docId-style error paths). Falls
      // back to the wrapping array validator if the item schema can't compile
      // standalone (e.g. unusable internal $id).
      let itemValidateFn = validateFn;
      try {
        const rawItem = (schema.items && Array.isArray(schema.items.anyOf) && schema.items.anyOf[0])
          || schema.items
          || null;
        if (rawItem) {
          const { $id, ...itemSchema } = rawItem; // strip relative $id
          itemValidateFn = ajvFactory.compile(itemSchema);
        }
      } catch (e) {
        console.warn(`[validate] Could not compile item schema standalone (${e.message}); falling back to array validator.`);
        itemValidateFn = function wrapValidate(doc) {
          const ok = validateFn([doc]);
          wrapValidate.errors = validateFn.errors;
          return ok;
        };
      }
      data = validateDirectoryRegistry(reg, itemValidateFn);
    } else {
      data = JSON.parse(fs.readFileSync(reg.dataPath, "utf8"));
      const valid = validateFn(data);

      if (!valid) {
        let errorMessage = '';
        const sourceMap = jsonSourceMap.stringify(data, null, 2);
        const jsonLines = sourceMap.json.split('\n');

        validateFn.errors.forEach(error => {
          errorMessage += '\n\n' + ajvFactory.errorsText([error]);
          const errorPointer = sourceMap.pointers[error.instancePath || error.dataPath];
          if (errorPointer) {
            errorMessage += '\n> ' + jsonLines
              .slice(errorPointer.value.line, errorPointer.valueEnd.line)
              .join('\n> ');
          }
        });

        console.error(`❌ Schema validation failed for ${reg.name} registry:\n${errorMessage}`);
        throw new Error(`Schema validation failed for ${reg.name}`);
      }
    }

    console.log(`✅ Schema validation passed for ${reg.name}`);

    // ---- Clear separation for registry-specific validation ----
    console.log(`🔍 Running additional validation for ${reg.name}...`);

    try {
      if (fs.existsSync(reg.validatePath)) {
        const additionalChecks = require(reg.validatePath);
        if (typeof additionalChecks === "function") {
          additionalChecks(data, reg.name);
        }
      }
    } catch (err) {
      if (err.code !== "MODULE_NOT_FOUND") throw err;
    }

    regs[reg.name] = { name: reg.name, data, dataFilePath: reg.dataPath };
  }

  return regs;
}

async function validateAll() {
  const keywordMode = applyValidationModeFromArgs(process.argv.slice(2));
  console.log("Starting full schema + additional validation...");
  console.log(`Keyword validation mode: ${keywordMode}`);
  const regs = await registries();

  // --- Portals validation (non-registry landing pages) ---
  try {
    const portalsPath = "src/main/data/portals.json";
    const portalsSchemaPath = "src/main/schemas/portals.schema.json";

    if (fs.existsSync(portalsPath)) {
      console.log("\nChecking portals definition...");
      const schema = JSON.parse(fs.readFileSync(portalsSchemaPath, "utf8"));
      const data = JSON.parse(fs.readFileSync(portalsPath, "utf8"));

      const ajvFactory = new Ajv({ allErrors: true });
      const validateFn = ajvFactory.compile(schema);
      const valid = validateFn(data);

      if (!valid) {
        let errorMessage = '';
        const sourceMap = jsonSourceMap.stringify(data, null, 2);
        const jsonLines = sourceMap.json.split('\n');

        validateFn.errors.forEach(error => {
          errorMessage += '\n\n' + ajvFactory.errorsText([error]);
          const errorPointer = sourceMap.pointers[error.instancePath || error.dataPath];
          if (errorPointer) {
            errorMessage += '\n> ' + jsonLines
              .slice(errorPointer.value.line, errorPointer.valueEnd.line)
              .join('\n> ');
          }
        });

        console.error(`❌ Schema validation failed for portals:\n${errorMessage}`);
        throw new Error('Schema validation failed for portals');
      }

      console.log("✅ Schema validation passed for portals");
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }

  console.log(`\nAll ${Object.keys(regs).length} registries validated successfully.`);
}

if (require.main === module) {
  validateAll().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { registries }; 
