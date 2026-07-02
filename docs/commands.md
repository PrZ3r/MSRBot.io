# Command Reference

This is the canonical CLI reference for local scripts in `package.json`.

## Quick Reference

- `extract` / `extract-smpte`: run SMPTE document extraction.
- `extract-ietf`: run IETF document extraction.
- `build-msi`: build Master Suite Index (lineages/suites metadata).
- `build-mri`: build Master Reference Index (cross-doc reference map).
- `seed-backfill-ietf`: backfill missing IETF seeds (RFC + `IETF.draft-*`) from MRI presence-audit.
- `validate`: schema + registry validation (`--warn` for keyword warn-only mode).
- `docs-validate`: run the standard validation script.
- `test`: run the `registry.js` smoke tests (slug / docPath / year-shard invariants).
- `new-doc`: scaffold a new per-doc registry file from the blank template.
- `review-refs`: list and resolve reference review flags in the document registry.
- `validate-url`: run URL reachability/audit checks.
- `normalize-url`: apply URL normalization/backfill from URL audit.
- `canonicalize`: canonicalize the per-doc registry files (key-sort, inject `$meta`, re-home strays).
- `assemble`: emit per-publisher/docType registry slices under `build/`.
- `keywords-sync`: detect (or `--write` append) controlled keyword updates.
- `config-sort`: canonicalize/sort `src/main/config/site.json` key ordering.
- `build-index`: build search index artifacts.
- `build-stats`: regenerate the API/site stats artifact standalone (also run automatically by `build`).
- `build`: build full static site output.
- `local-server`: start a local HTTP server to preview the built site.
- `audit`: generate document audit report.

## NPM Scripts

### Build and Site

- `npm run build`
  - Runs: `node src/main/scripts/build.js`
  - Action: Builds full static site output and page artifacts under `build/`.
  - Key outputs: HTML pages, data payloads, static assets, API JSON endpoints (`/api/`), JSON schemas (`/api/schemas/`), changelog page (`/changelog/`).

- `npm run local-server`
  - Runs: `npx http-server build --no-cache`
  - Action: Starts a local HTTP server on `http://127.0.0.1:8080/` to preview the built site in a browser.

- `npm run build-index`
  - Runs: `node src/main/scripts/build.search-index.js`
  - Action: Builds search index artifacts consumed by docs/portal search UI.
  - Input: the per-doc registry under `src/main/data/docs/` by default.
  - Optional args:
    - `npm run build-index -- <path>` (override with a built `documents.json` snapshot)

- `npm run build-stats`
  - Runs: `node src/main/scripts/utils/buildStats.js`
  - Action: Generates `build/api/stats.json` (API viewer + site badges/cards).
  - Note: `npm run build` already runs this automatically — `build-stats` is only needed to regenerate stats standalone.

- `npm run assemble`
  - Runs: `node src/main/scripts/build.assemble-registry.js`
  - Action: Assembles per-publisher and per-publisher/docType registry slices from the per-doc registry.
  - Key outputs: `build/docs/_data/by-publisher/{publisher}.json` and `.../{publisher}/{docType}.json` (`$meta` stripped). Also run automatically as part of `npm run build`.

### Extraction

- `npm run extract`
  - Runs: SMPTE provider (`--provider smpte`).
  - Action: Convenience alias for SMPTE extraction.

- `npm run extract-smpte`
  - Runs: `node src/main/scripts/extractDocs.js --provider smpte`
  - Action: Extracts/updates SMPTE-seeded docs, references, and provenance metadata.

- `npm run extract-ietf`
  - Runs: `node src/main/scripts/extractDocs.js --provider ietf`
  - Action: Extracts/updates IETF-seeded docs, references, and provenance metadata.

### Index Builders

- `npm run build-msi`
  - Runs: `node src/main/scripts/buildMasterSuiteIndex.js --out src/main/reports/masterSuiteIndex.json`
  - Action: Rebuilds suite/collection lineage index from the per-doc registry (`src/main/data/docs/`).
  - Key outputs:
    - `src/main/reports/masterSuiteIndex.json`
    - `src/main/reports/masterSuiteIndex-publisherCounts.json`
    - `src/main/reports/masterSuiteIndex-skippedDocs.json`
  - Supported flags:
    - `--in <path>` (optional; defaults to the per-doc registry when omitted)
    - `--out <path>`
    - `--pub-out <path>`
    - `--skips-out <path>`
    - `--count-only`
    - `--separate-aux`
    - `--publisher-counts`

- `npm run build-mri`
  - Runs: `node src/main/scripts/buildMasterReferenceIndex.js`
  - Action: Rebuilds global reference index and source-presence audit.
  - Key outputs:
    - `src/main/reports/masterReferenceIndex.json`
    - `src/main/reports/mri_presence_audit.json`
  - Supported flags:
    - `--in <path>` (optional; defaults to the per-doc registry when omitted)
    - `--presence-only`
    - `--audit-out <path>`
    - `--limit <N>`
    - `--force`
    - `--quiet`
    - `--no-prune`

- `npm run seed-backfill-ietf`
  - Runs: `node src/main/scripts/utils/seedBackfill.ietf.js`
  - Action: Compares `src/main/reports/mri_presence_audit.json` missing IETF refs (`RFC####` and `IETF.draft-*`) against `src/main/input/seedUrls.ietf.json` and reports missing seeds.
  - Modes:
    - Dry-run (default): prints missing draft + RFC seed URLs.
    - Apply + canonicalize: `npm run seed-backfill-ietf -- --write` (appends missing draft + RFC URLs, de-duplicates, and canonical-orders the full seed list).

### Validation and Normalization

- `npm run validate`
  - Runs: `node src/main/scripts/validate.js`
  - Action: Runs schema validation + registry-specific validation checks. For the per-doc document registry, each file is validated directly against the item schema (clean `/docId`-style error paths) and asserted to sit at the shard path its own fields derive.
  - Keyword mode flags:
    - `npm run validate -- --error` (strict; default)
    - `npm run validate -- --warn` (warn-only for unknown keywords)

- `npm test`
  - Runs: `node src/main/scripts/test/registry.test.js`
  - Action: Smoke-tests the path-derivation invariants in `src/main/lib/registry.js` — `slug` / `docIdSlug` / `docPath`, the `_unknown` and `_undated` buckets, and the year third-shard for title-identified docTypes. Self-contained (no test framework), exits non-zero on any failure.

- `npm run validate-url`
  - Runs: `node src/main/scripts/url.validate.js`
  - Action: Runs URL audit/reachability checks and writes validation report artifacts.
  - Optional positional arg:
    - `npm run validate-url -- documents.json`

- `npm run normalize-url`
  - Runs: `node src/main/scripts/url.normalize.js --apply`
  - Action: Applies URL normalization/backfill based on URL validation report.

- `npm run canonicalize`
  - Runs: `node src/main/scripts/canonicalize.js`
  - Action: Canonicalizes each per-doc registry file (key-sort via `json-stable-stringify`, inject missing `$meta`).
  - Re-homing: the shard path is derived from a doc's own fields — `{publisher}/{docType}/{docId}.json`, plus a `{year}/` level (from `publicationDate`) for title-identified docTypes listed in `site.json#titleLabelDocTypes`. If you edit any of those fields, canonicalize moves the file to its new derived path and prunes any directory left empty. (`validate` independently fails if a file is not at its derived path.)

### Documents Registry Helpers

- `npm run new-doc`
  - Runs: `node src/main/scripts/new-doc.js`
  - Action: Scaffolds a new per-doc registry file from `src/main/data/templates/documents.json`, written straight to the correct shard path under `src/main/data/docs/`.
  - Required args: `--docId <id> --publisher <pub> --docType <type>` (these derive the file path). Any other `--field value` is copied onto the template.
  - Example:
    - `npm run new-doc -- --docId SMPTE.ST2067-2.2020 --publisher SMPTE --docType Standard`
  - After scaffolding, fill in remaining fields and run `npm run canonicalize && npm run validate`.

- `npm run docs-validate`
  - Runs: `npm run validate`
  - Action: Alias to run standard schema + registry validation checks.

- `npm run review-refs -- list`
  - Runs: `node src/main/scripts/utils/review.refs.js list`
  - Action: Lists review flags across all docs/providers for both reference types:
    - `references.normative$meta.reviewRequired === true`
    - `references.bibliographic$meta.reviewRequired === true`
  - Includes per-entry ref count, count of MRI orphan slugs cited from the doc (`refs[]` entries with `isOrphan: true` and `resolvedDocId: null` — the modern replacement for the deprecated `badRefs.latest` sidecar), and summary gap reporting for docs with unresolved refs but no review flag. See [docs/mri-citation-system.md](mri-citation-system.md) for the full slug-citation architecture.

- `npm run resolve-orphans`
  - Runs: `node src/main/scripts/extras/resolveOrphans.js`
  - Action: Idempotent retry pass — walks every `MRI.refs[]` entry where `resolvedDocId` is `null` and tries to graduate it via:
    - direct match of `refId` against a registry `docId` (canonical-form refs whose target doc has since been ingested);
    - `parseRefId` on the entry's `citationText` / `href` (a new parser family may now produce a refId that's in the registry);
    - `mapRefByCite` (a new `refMap.json` entry may now resolve).
  - One resolution propagates across every sibling sharing a `contentHash` in the same pass.
  - Doc files are never touched — only `MRI.refs[…].resolvedDocId` flips, and the renderer chain (`registry[ref] || MRI.refs[ref].resolvedDocId`) automatically follows the pointer on the next build. Safe to run as often as you want.
  - Dry-run by default; pass `--apply` to write MRI.

- `npm run validate-mri-coverage`
  - Runs: `node src/main/scripts/extras/validateMriCoverage.js`
  - Action: Build-time assertion of the MRI v2 slug-system invariant — every string in any doc's `references.{normative,bibliographic,supersededBy,amendedBy}[]` must exist as a key in `MRI.refs[]`. If anything leaks, the slug-mint path is broken; the fix is to patch the mint logic, not to silence this check.
  - Persists `src/main/reports/mriCoverageGaps.{json,md}` with the totals and (on failure) a per-leak report including `docId`, ref category, ref string, and a leak-kind classification.
  - Exit codes: `0` clean, `1` one or more leaks, `2` script-level error (couldn't load registry or MRI).

- `npm run reaudit-refs`
  - Runs: `node src/main/scripts/extras/reauditRefs.js`
  - Action: Full-corpus reference audit. Walks every doc in the per-doc registry and classifies each `references[]` entry against MRI state: `resolved-direct` (docId already in registry), `resolved-via-mri` (MRI's `resolvedDocId` pointer hits a registry doc), `mri-known-no-doc` (canonical refId known to MRI but target not yet ingested — Phase 1b / #1195 territory), `orphan-slug` (source-anchored slug), or `unparseable` (parser-family gap; should be 0 under the slug system).
  - Reports: `src/main/reports/refsReaudit.{json,md}` — per-doc breakdown + top publisher families for the `mri-known-no-doc` and `unparseable` buckets so the next ref-resolution / ingest passes can be sized without guessing.

- `npm run reaudit-unmapped-fields`
  - Runs: `node src/main/scripts/extras/reauditUnmappedFields.js`
  - Action: Samples `_source/SMPTE/*` XML deliveries (HIGHWIRE, APTARA, Allen Press), tallies every element path, and cross-references against schema 2.3.0 + the decisions captured in [`sourceInventory.smpte.schemaMap.md`](../src/main/reports/sourceInventory.smpte.schemaMap.md). Surfaces `new-unseen` paths that may warrant a future schema field promotion.
  - Reports: `src/main/reports/refsReaudit.unmappedFields.{json,md}`.

- `npm run review-refs -- resolve <docId...>`
  - Runs: `node src/main/scripts/utils/review.refs.js resolve <docId...>`
  - Action: Clears `reviewRequired`, removes `flag`, and appends a manual-review note on both:
    - `references.normative$meta`
    - `references.bibliographic$meta`
  - Example:
    - `npm run review-refs -- resolve RFC2130 RFC2141`

### Audit and Utilities

- `npm run audit`
  - Runs: `node src/main/scripts/audit.documents.js`
  - Action: Generates audit summary JSON from document registry.
  - Supported flags:
    - `--in <path>`
    - `--out <path>`
    - `--publisher <name>` (repeatable)
    - `--pretty <n>`

- `npm run keywords-sync`
  - Runs: `node src/main/scripts/utils/keywords.sync.js`
  - Action: Compares observed document keywords against controlled list and optionally writes updates.
  - Modes:
    - Dry-run (default): `npm run keywords-sync`
    - Apply updates: `npm run keywords-sync -- --write`

- `npm run config-sort`
  - Runs: `node src/main/scripts/utils/configSort.js`
  - Action: Canonicalizes and key-sorts `src/main/config/site.json` for stable diffs.

## Runtime Environment Variables

### Validation

- `KEYWORD_VALIDATION_MODE`
  - `error` (default): unknown keywords fail validation
  - `warn`: unknown keywords are warnings only
  - Equivalent CLI flags for `npm run validate`:
    - `--error`
    - `--warn`

### Extraction Logging / PR-Run Behavior

- `IS_PR_RUN=true`
  - Enables PR-oriented logging behavior.

- `PR_LOG_PATH`
  - File path or directory for PR log output.

- `MSR_CONSOLE_BUDGET`
  - Console output budget in bytes for smart logger tripwire.

- `MSR_HEARTBEAT_EVERY`
  - Heartbeat line interval for long extraction runs.

- `MSR_HEARTBEAT_PREFIX`
  - Prefix text for heartbeat lines.
