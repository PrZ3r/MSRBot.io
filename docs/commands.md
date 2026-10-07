# Command Reference

This is the canonical CLI reference for local scripts in `package.json`.

## Quick Reference

- `extract` / `extract-smpte`: run SMPTE document extraction.
- `extract-ietf`: run IETF document extraction.
- `extract-manual`: run hand/AI-prepared records (`--input <records.json>`) through the extractor pipeline.
- `extract-smpte-journal`: add/update SMPTE journal and conference papers from a **local** copy of the SMPTE journal library (maintainer only).
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
- `config-sort`: canonicalize/sort key ordering of `src/main/config/site.json` and `src/main/input/refMap.json`.
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

- `npm run extract-manual -- --input <records.json>`
  - Runs: `node src/main/scripts/extractDocs.js --provider manual --input <records.json>`
  - Action: Adds/updates documents from a records file prepared by a person or AI agent (publishers without an extractor). Citations go through `parseRefId` with MRI sightings and orphan slugs; per-field provenance comes from the record's `metaSources` / `metaSourceUrls` / `metaNotes` / `metaFlags`. Format: [manual-extraction.md](manual-extraction.md).

- `npm run extract-smpte-journal [-- --source <dir>] [-- --from <year>] [-- --to <year>] [-- --pdf-refs [--crossref-fill]]`
  - Runs: `node src/main/scripts/extractDocs.js --provider smpte-journal`
  - **Requires a local copy of the SMPTE journal library XML.** The library isn't public: the maintainer downloads each new SMPTE Motion Imaging Journal issue and conference from SMPTE's AWS library. Without a readable local copy (missing path, empty folder, or Dropbox online-only 0-byte placeholders) the command prints "No local SMPTE journal source … nothing to do" and exits without touching the registry. It can't run on a schedule or in CI.
  - Action: reads each paper's `content_batch` file (metadata, keywords, authors) and its `FTXML/` full text (references), and feeds them through the extractDocs pipeline like the other extractors:
    - a new paper is added;
    - an unchanged paper is skipped;
    - a field SMPTE changed in a re-download is updated, with the old value in `originalValue`;
    - a field locked with `excludeChanges` / `excludeOverwrite` in its `$meta` is never changed.

    The command only adds or changes what it extracts; it never deletes. Hand-added keywords and authors' bios, affiliations and ORCIDs are kept. The exception is references: a paper's reference list from its FTXML replaces the stored bibliographic list as a unit, and a paper with no FTXML keeps what it has.
  - Flags:
    - `--source <dir>`: library root. Default `_source/SMPTE`, the maintainer's symlink to the library. It must contain `Journal Article Repository/` and/or `Conference Repository/Conference Papers/`.
    - `--from <year>`: first year to read. Default `2025`; earlier years are already in the registry.
    - `--to <year>`: last year to read. Default: no limit.
    - `--pdf-refs`: also read the IEEE-era `<publication>` records (2015–2023). SMPTE's delivery for those years has no FTXML and no reference file, so this pass takes **references only**, parsed from the paper's PDF in the same folder. The PDFs aren't in the default download; pull them from AWS first (records without a PDF are skipped).
      - It fills papers with no bibliographic references, and re-runs replace only lists this pass wrote. It never overwrites references from another source, and never touches a paper's other fields.
      - Each list's `bibliographic$meta.note` names the PDF and records a **Crossref cross-check**: how many references Crossref holds for the DOI against how many were parsed. Crossref is a check, never a source; nothing from it is written. A count mismatch, or a bibliography with no entry numbers, sets `reviewRequired` with a `flag` saying what to check.
      - Citations resolve like the FTXML path: DOI, SMPTE volume + issue + first page, an SMPTE paper's exact title (venue and year must agree), `refMap`, then `parseCiteDesignator`. Anything else becomes an orphan with its printed text.
      - A second, unnumbered list after the main one ("Other Sources", "Additional References") is part of the references and is appended.
      - `--crossref-fill` (with `--pdf-refs`): where the PDF parse finds fewer references than Crossref lists for the DOI, Crossref's unmatched entries are added. This is a deliberate maintainer exception to "Crossref is a check, never a source", approved for the 2015–2023 backfill after reviewing the gaps. An entry counts as present when its DOI is in a parsed citation or resolves to a doc already cited, when its text matches, or (DOI-only entries) when the DOI's title matches. Empty entries are skipped. If more unmatched entries remain than the paper is short, the match is ambiguous and nothing is added. Additions carry MRI `mapSource: crossref-fill`, and the list's note says how many came from Crossref.
      - Typical run: `npm run extract-smpte-journal -- --from 2015 --to 2023 --pdf-refs` (needs network for the Crossref check; without it, the note says the check was unavailable).
  - Keywords are conformed with `src/main/lib/keywordConform.js`, using the rules in `src/main/config/keywordDecisions.json` (folds, drops, splits, acronyms). Add a rule there, not in the extractor.
  - Typical use after downloading a new issue:
    ```bash
    npm run extract-smpte-journal
    npm run canonicalize && npm run validate
    git diff        # review; commit, or `git checkout -- src/main/data src/main/reports` to discard
    ```

### Index Builders

- `npm run build-msi`
  - Runs: `node src/main/scripts/buildMasterSuiteIndex.js --out src/main/reports/masterSuiteIndex.json`
  - Action: Rebuilds suite/collection lineage index from the per-doc registry (`src/main/data/docs/`).
  - Key outputs:
    - `src/main/reports/masterSuiteIndex.json`
    - `src/main/reports/masterSuiteIndex-publisherCounts.json`
    - `src/main/reports/masterSuiteIndex-skippedDocs.json`
    - `src/main/reports/masterSuiteIndex-placeholders.json` and `.md`: every edition flagged `status.placeholder` (known from evidence, not yet confirmed against the document), by lineage, with its evidence (front page or earlier research) and the edition that confirms it. Written on every MSI build; flagged records the MSI doesn't place in a lineage are listed separately.
  - Supported flags:
    - `--in <path>` (optional; defaults to the per-doc registry when omitted)
    - `--out <path>`
    - `--pub-out <path>`
    - `--skips-out <path>`
    - `--placeholders-out <path>` (the `.md` is written next to it)
    - `--count-only`
    - `--separate-aux`
    - `--publisher-counts`

- `npm run build-mri`
  - Runs: `node src/main/scripts/buildMasterReferenceIndex.js`
  - Action: Rebuilds global reference index and source-presence audit.
  - Key outputs:
    - `src/main/reports/mri/` — sharded MRI store: `index.json` + one file per ref under `refs/` (only changed files are rewritten; no timestamps, so an unchanged MRI produces no diff)
    - `src/main/reports/mri_presence_audit.json` — counts + every non-orphan missing ref (orphan slugs are counted, not listed)
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
  - Action: Canonicalizes and key-sorts `src/main/config/site.json` and `src/main/input/refMap.json` (refIds alphabetical; pattern order inside each entry is kept) for stable diffs and easy lookup.

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
