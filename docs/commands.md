# Command Reference

This is the canonical CLI reference for local scripts in `package.json`.

## Quick Reference

- `extract` / `extract-smpte`: run SMPTE document extraction.
- `extract-ietf`: run IETF document extraction.
- `build-msi`: build Master Suite Index (lineages/suites metadata).
- `build-mri`: build Master Reference Index (cross-doc reference map).
- `seed-backfill-ietf`: backfill missing RFC seeds from MRI presence-audit.
- `validate`: schema + registry validation (`--warn` for keyword warn-only mode).
- `docs-sort`: sort `documents.json` by `docId` using validator-compatible ordering.
- `docs-validate`: run the standard validation script.
- `docs-fix`: sort then validate in one command.
- `review-refs`: list and resolve reference review flags in `documents.json`.
- `validate-url`: run URL reachability/audit checks.
- `normalize-url`: apply URL normalization/backfill from URL audit.
- `canonicalize`: normalize/sort registry JSON output format.
- `keywords-sync`: detect (or `--write` append) controlled keyword updates.
- `config-sort`: canonicalize/sort `src/main/config/site.json` key ordering.
- `build-index`: build search index artifacts.
- `build-stats`: build API/site stats artifact.
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
  - Optional args:
    - `npm run build-index -- src/main/data/documents.json` (override input path)

- `npm run build-stats`
  - Runs: `node src/main/scripts/utils/buildStats.js`
  - Action: Generates stats payload for API viewer and site badges/cards.

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
  - Runs: `node src/main/scripts/buildMasterSuiteIndex.js --in src/main/data/documents.json --out src/main/reports/masterSuiteIndex.json`
  - Action: Rebuilds suite/collection lineage index from `documents.json`.
  - Key outputs:
    - `src/main/reports/masterSuiteIndex.json`
    - `src/main/reports/masterSuiteIndex-publisherCounts.json`
    - `src/main/reports/masterSuiteIndex-skippedDocs.json`
  - Supported flags:
    - `--in <path>`
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
    - `--in <path>`
    - `--presence-only`
    - `--audit-out <path>`
    - `--limit <N>`
    - `--force`
    - `--quiet`
    - `--no-prune`

- `npm run seed-backfill-ietf`
  - Runs: `node src/main/scripts/utils/seedBackfill.ietf.js`
  - Action: Compares `src/main/reports/mri_presence_audit.json` missing RFC refs against `src/main/input/seedUrls.ietf.json` and reports RFC seeds that are missing.
  - Modes:
    - Dry-run (default): prints missing RFC seed URLs only.
    - Apply + canonicalize: `npm run seed-backfill-ietf -- --write` (appends missing RFC URLs, de-duplicates, and canonical-orders the full seed list).

### Validation and Normalization

- `npm run validate`
  - Runs: `node src/main/scripts/validate.js`
  - Action: Runs schema validation + registry-specific validation checks.
  - Keyword mode flags:
    - `npm run validate -- --error` (strict; default)
    - `npm run validate -- --warn` (warn-only for unknown keywords)

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
  - Action: Canonicalizes JSON ordering/shape for stable diffs.

### Documents Registry Helpers

- `npm run docs-sort`
  - Runs: `node src/main/scripts/utils/docIdSort.js`
  - Action: Sorts `src/main/data/documents.json` by `docId` in the same order expected by validation.

- `npm run docs-validate`
  - Runs: `npm run validate`
  - Action: Alias to run standard schema + registry validation checks.

- `npm run docs-fix`
  - Runs: `npm run docs-sort && npm run docs-validate`
  - Action: One-shot helper for manual doc edits: reorder then validate.

- `npm run review-refs -- list`
  - Runs: `node src/main/scripts/utils/review.refs.js list`
  - Action: Lists review flags across all docs/providers for both reference types:
    - `references.normative$meta.reviewRequired === true`
    - `references.bibliographic$meta.reviewRequired === true`
  - Includes per-entry ref count, `badRefs.latest` count, and summary gap reporting for docs with bad refs but no review flag.

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
