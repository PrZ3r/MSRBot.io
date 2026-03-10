# Change Log

> See [docs/buildlog.md](https://github.com/PrZ3r/MSRBot.io/blob/main/docs/buildlog.md) for details of [v1.0.0](https://github.com/PrZ3r/MSRBot.io/releases/tag/v1.0.0) released on Nov 26, 2025.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - yyyy-mm-dd

### Added
- Added `npm run seed-backfill-ietf` helper (`src/main/scripts/utils/seedBackfill.ietf.js`) to compare MRI presence-audit missing RFC refs against `src/main/input/seedUrls.ietf.json`, with:
  - dry-run reporting (default)
  - `--write` mode to append missing RFC seeds and canonicalize/dedupe the full seed list.

### Changed
- IETF RFC HTML reference extraction now includes a modern xml2rfc-HTML path:
  - Detects modern RFC pages via `xml2rfc` generator metadata and/or `application/rfc+xml` alternate links.
  - Parses structured `dl.references` entries using `dt`/`dd` boundaries for normative/informative sections.
  - Falls back to legacy section/anchor heuristics only when structured extraction is unavailable or incomplete.
- Reference normalization now includes generic DOI/ISBN fallback parsing in `parseRefId`, reducing manual `refMap` backfills for citations that include canonical identifiers.
- Reference normalization now includes generic 3GPP Technical Specification parsing from cite text (including Draft TS forms), with month-aware suffixes (e.g., `3GPP.33.501.202107`).
- `badRefs.latest.json` writing now merges per provider into a single snapshot file:
  - each bad-ref item includes `provider`
  - each extract run replaces only the current provider's items and preserves other providers' entries

### Fixed
- **URL validation throttle false positives on skip-only runs** — refined `.github/workflows/validate-urls.yml` daily throttle to count only runs that actually executed `Run URL validation` successfully; skip-only successful runs (for example, upstream open-PR marker skips) no longer satisfy throttle.
- **IETF filter prefix overmatch in seed-first extraction** — fixed `src/main/scripts/providers/ietf.discovery.js` URL filtering so short RFC filters (for example, `.../rfc861`) no longer overmatch longer IDs (for example, `.../rfc8615`, `.../rfc8820`):
  - filter comparisons now use normalized URL forms
  - prefix matching now requires explicit intent via trailing `/` in the filter entry.
- **W3C dated TR stage references not resolving** — expanded W3C URL parsing in `parseRefId` to resolve dated `/TR/YYYY/<STAGE>-<shortname>-<date>` forms beyond REC (for example `WD-CSP3-20160913`, `CR-referrer-policy-20170126`).
- **MRI add-then-prune churn across extract/build-MRI workflows** — extraction now prunes MRI variants to current `documents.json` reference truth before flush, preventing transient rawVariants (for example self-cites or non-persisted sightings) from being added by extract and then removed by later `buildMasterReferenceIndex` runs.
- **Resolved citations leaking into `badRefs.latest.json`** — tightened bad-ref suppression in both `extractRefs` (`src/main/lib/referencing.js`) and extract report persistence (`src/main/scripts/extractDocs.js`) so any citation that resolves via `parseRefId` or `mapRefByCite` is excluded from bad-ref output, eliminating stale false positives during mixed parser-path runs.
- **NIST SP reference normalization gap** — added generic NIST SP parsing in `parseRefId` for CSRC `.../publications/detail/sp/.../rev-...` URLs and text forms like `NIST 800-67, Rev. 2`, producing canonical IDs such as `NIST.SP.800-67r2`.
 
## [v1.4.1] - 2026-03-06
 
### Added
- Added `npm run local-server` shortcut to start a local HTTP server for previewing the built site.
- Added shared keyword normalization utility at `src/main/scripts/utils/keyword.normalize.js` to centralize acronym/special-case keyword casing rules used during ingestion and keyword sync.
- Added persistent bad-reference reporting snapshot at `src/main/reports/badRefs.latest.json` from extraction runs, so unresolved refs can be backfilled outside PR log text.
- Added `npm run review-refs` helper (`src/main/scripts/utils/review.refs.js`) to manage reference review state:
  - `npm run review-refs -- list` to enumerate flagged docs.
  - Expanded `npm run review-refs -- list` reporting to be provider/publisher agnostic and reference-type agnostic:
    - covers all docs/providers
    - reports both `normative` and `bibliographic` review flags
    - correlates with `badRefs.latest` and reports unflagged docs with bad refs
  - `npm run review-refs -- resolve <DOCID...>` to clear review flags after manual verification.
  - Updated `npm run review-refs -- resolve <DOCID...>` to clear review flags for both `references.normative$meta` and `references.bibliographic$meta`.
- Added extraction parser diagnostics flagging for mixed reference layouts (`MIXED_REF_LAYOUT_RISK`) and propagated this as structured review metadata instead of bad-ref noise.

### Changed
- Refactored `src/main/scripts/providers/ietf.parse.js` to use shared keyword normalization (`splitAndNormalizeKeywords`) instead of inline acronym/title-case logic.
- Refactored `src/main/scripts/utils/keywords.sync.js` to use shared keyword normalization (`normalizeKeyword`) instead of inline acronym/title-case logic.
- Extended keyword acronym normalization to preserve `SMTP` uppercase consistently across parser/sync flows.
- Extraction workflows (`extract-docs-ietf.yml`, `extract-docs-smpte.yml`) now append unknown-keyword warnings from `npm run validate -- --warn` output into PR notes, so warn-only keyword drift is visible before merge.
- Extraction workflows now track `src/main/reports/badRefs.latest.json` in extract PRs (and no longer depend on per-run bad-ref log artifacts).
- Removed old `stats` API veiwer template. 
- Mixed-layout reference risk now lands in `references.bibliographic$meta` with:
  - `reviewRequired: true`
  - `flag: "MIXED_REF_LAYOUT_RISK ..."`
  and downgrades confidence to `medium` for that field until reviewed.
- Updated docs schema to permit new `$meta` keys: `reviewRequired` and `flag`.

### Fixed
- **gh-pages push contention** (#910) — replaced `peaceiris/actions-gh-pages` with manual git deploy in PR Build Preview and main site build workflows; added push-with-retry (pull --rebase, up to 3 attempts) to all four workflows that push to `gh-pages` (site build, PR preview, PR cleanup, PR sweeper). The site build's two-step cleanup-then-publish is now a single atomic commit.
- **URL validation over-triggering** — added a daily throttle for workflow-chain URL validation so `Validate Document URLs` skips workflow-run invocations if a successful URL validation already completed within the previous 24 hours.
- **IETF references canonicalization noise on new extracts** — fixed new-document extraction/merge so empty `references.normative`/`references.bibliographic` arrays are not persisted; IETF parser now emits sparse `references` keys (only when non-empty), preventing canonicalization from injecting manual `references.normative$meta` for parser-empty placeholders.
- **Docs index search in PR previews** — fixed docs search asset loading in `src/site/js/docList.js` to use `window.msrAssetPrefix` with relative fallbacks instead of root-absolute `/docs/...` paths, so searches return results on preview URLs under subpaths (for example, `/pr/<num>/docs/`) while continuing to work locally.
- **IETF reference boundary/parsing regressions in legacy RFC HTML** — tightened fallback section detection and stop conditions to reduce non-reference soak-through while still capturing appendix-based reference content:
  - Added strict old-page bibliography boundary support for `<hr class='noprint'/> <!--NewPage--> <pre class='newpage'> ... Bibliography ... BIBLIOGRAPHY ...`.
  - Added appendix heading support for `Appendix <X>: Recommended reading` as bibliographic reference bounds.
  - Updated prose fallback stop logic so `Appendix` headings do not prematurely terminate parsing when the active bound is a recommended-reading reference section.
  - Backfilled cite→refId normalization rules in `src/main/input/refMap.json` for unresolved legacy citations (notably RFC732/RFC733/RFC2130 reference blocks, including ARPANET NIC, ANSI X3.51, and Jerman-Blazic bibliography entries).

## [v1.4.0] - 2026-02-28

### Added
- **API Explorer page** at `/api/` — searchable, filterable document browser with URL parameter syncing, pagination, and an inline JSON viewer for inspecting full provenance records.
- **Full-provenance JSON API** — static endpoints for machine consumption:
  - `/api/documents.json` — full registry with all source fields and provenance metadata.
  - `/api/doc/{docId}.json` — per-document JSON with full record.
  - `/api/stats.json` — registry statistics and metadata (with `meta.repoUrl`, `meta.changelogUrl`).
- **JSON Schema publishing** at `/api/schemas/` — existing schemas (`documents`, `groups`, `portals`, `projects`) are now served as static assets for consumer validation.
- **API versioning** — all API JSON responses include `$schema` and `apiVersion` fields; initial API version is `1.0.0`.
- **Machine-readable discovery** — added `<link rel="alternate" type="application/json">` and `<link rel="describedby" type="application/schema+json">` to the API Explorer page and all document detail pages.
- **OpenSearch JSON template** — `opensearch.xml` now includes a JSON response URL (`/api/?q={searchTerms}`) alongside the existing HTML template.
- **JSON-LD SearchAction** — structured data now includes search actions for both `/docs/` and `/api/` endpoints.
- **Source Data (JSON) panel** on document detail pages — collapsible card showing the full registry record with a direct link to the per-document API endpoint.
- **Internal Changelog page** at `/changelog/` — rendered from `CHANGELOG.md` as styled cards, replacing external GitHub blob links.
- Added API Explorer and schema links to the Dev Tools & Resources popover and site footer.
- Added API link on the homepage.

### Changed
- Renamed "Dev Tools" navigation label to "Dev Tools & Resources."
- Updated README badges and Key Artifacts to reference the new API Explorer and internal changelog.
- Updated sitemap to include `/api/` and `/changelog/` entries.

### Fixed
- Fixed suites/collections page document rendering when publisher labels differ by composite forms (for example, `ISO/IEC` docs under `ISO` collections); collection matching now normalizes publisher aliases/composites before filtering.
- Fixed JSON-LD `SearchAction` target URLs missing path separator after `canonicalBase`.

## [v1.3.0] - 2026-02-26
 
### Added
- Providerized extraction architecture:
  - Added SMPTE discovery provider module at `src/main/scripts/providers/smpte.discovery.js`.
  - Added SMPTE parser provider module at `src/main/scripts/providers/smpte.parse.js`.
  - Added IETF discovery provider module at `src/main/scripts/providers/ietf.discovery.js`.
  - Added IETF parser provider module at `src/main/scripts/providers/ietf.parse.js`.
  - Added provider-specific metadata configs:
    - `src/main/scripts/providers/smpte.meta.js`
    - `src/main/scripts/providers/ietf.meta.js`
  - Added provider registry at `src/main/scripts/providers/index.js`.
- Added optional document schema fields for citation structure:
  - `volume`, `number`, `pages`, `chapter`, `edition`.
- Added explicit npm alias `extract:smpte` for provider-targeted extraction.
- Added dedicated IETF extraction workflow: `.github/workflows/extract-docs-ietf.yml` (separate branch/PR path from SMPTE extraction).
- Added keyword governance utilities and config source:
  - Added `controlledKeywords` list in `src/main/config/site.json`.
  - Added `keywords-sync` utility at `src/main/scripts/utils/keywords.sync.js` (`npm run keywords-sync`, dry-run by default, `--write` to apply).
- Added centralized command/flags documentation at `docs/commands.md`.
- Added and expanded `AGENTS.md` guidance for branch naming, issue/PR label usage, PR hygiene, validation expectations, repo guardrails, and changelog/documentation/provenance expectations.

### Changed
- Refactored `extractDocs.js` to be provider-agnostic orchestration (merge, metadata, MRI, and logging), with provider-specific discovery/parsing moved out of main script.
- Extraction provider selection is now explicit via `--provider`; implicit/default provider execution was removed.
- Renamed SMPTE extraction workflow to `extract-docs-smpte.yml` (`Extract Documents - SMPTE`) and aligned workflow references/triggers accordingly.
- Updated docs and badges to reference the renamed SMPTE extraction workflow.
- Updated validation architecture for keywords:
  - Removed hard keyword enum enforcement from `documents.schema.json`.
  - Moved keyword conformance checks to `documents.validate.js` against `src/main/config/site.json#controlledKeywords`.
  - Added keyword validation mode controls for `npm run validate`:
    - default strict mode (`--error`)
    - optional warn mode (`--warn`) for unknown keyword drift checks.
  - Extraction workflows now run keyword validation in warn mode; build/local validation remains strict by default.
- Expanded IETF extraction behavior:
  - RFC extraction now uses RFC Index XML (`rfc-index.xml`) as first-pass canonical metadata for seeded RFCs, with per-document sources used as enrichment/fallback.
  - RFC field source precedence is now explicit; status relations (`obsoletes/obsoleted-by/updates/updated-by`) are sourced from RFC Index XML + RFC info `<dl>` merge, eliminating loose relation text fallback.
  - RFC author precedence now prefers Datatracker `doc.json` authors (richer names) over RFC Index XML, with HTML/info fallbacks.
  - Added RFC Index XML/XSD mapping contract and required-field coverage warnings in IETF parser for schema-backed extraction hygiene.
  - RFC relation fields now derive from RFC info page relation `<dl>` parsing (no broad relation text fallback injection).
  - Non-RFC extraction now enriches from archive XML (`/archive/id/*.xml`) for front-matter fields and keywords.
  - Non-RFC keywords are normalized to project keyword style (Title Case with preserved acronyms/common forms such as `JSON`, `URN`, `B-Chain`, `DCinema`, `DCP*`, `SHA-1`).
  - RFC reference parsing now uses RFC HTML section-aware extraction with strict `Normative` vs `Informative/Bibliographic` bucketing and overlap guards.
  - RFC fallback reference slicing is now bounded to reference sections, next section heading, and page-break markers to avoid body/header/footer soak-through.
  - IETF reference sightings now write to MRI for both RFC HTML and non-RFC XML paths using final document IDs.
- Expanded shared reference normalization rules in `src/main/lib/referencing.js`:
  - RFC IDs normalize leading zeros (e.g., `RFC0821` → `RFC821`).
  - W3C `REC-*` URL forms normalize to canonical W3C shortname IDs (no `REC-` prefix in docId).
  - Added href-first resolvers for Unicode and Mozilla Bugzilla references.
  - Added improved ISO hyphenated designator parsing (e.g., `ISO-8859-1:1987`).
- Updated project docs with provider extraction and keyword-governance guidance in `README.md` and `CONTRIBUTING.md`.
- Updated docs to link `docs/commands.md` from `README.md` and `CONTRIBUTING.md`.
- Enhanced Portal document listings with additional context fields:
  - Display of `docType` and `publicationDate` in document tables.
  - New **Doc Type** filter, aligned with existing Publisher filtering.
- Extended Portal sorting controls to support:
  - Sorting by **Type** and **Published date**.
  - Ascending / descending sort direction for all supported sort keys, consistent with Suites and Collections.
- Updated RefTree unresolved-document UX:
  - Unresolved nodes remain visible and navigable in-tree, but now display muted/italic labels with a `NOT IN REGISTRY` badge.
  - In the **Current Tree Root** card, unresolved docs no longer click through to `/docs/:docId/`; in-registry roots remain clickable.
- Improved docs page reference-list readability:
  - Added explicit spacing between normative/bibliographic reference labels and their status tokens (e.g., `[Active]`, `[SUITE]`).
- Updated `docs/CONTRIBUTING_SHORT.md` to align branch prefix guidance and add an explicit Unreleased changelog checklist item for workflow/policy/behavior changes.
- Simplified PR preview check behavior by removing custom check-run/status publication from preview workflow and relying on the single native workflow job check context.
- Added MSI→MRI chain guard in MRI workflow to skip MRI when MSI already opened a PR (artifact marker present), preventing duplicate chained data PRs.
- Hardened MRI missing-ref issue upsert behavior with no-op update skipping and per-run mutation budget (`MAX_MUTATIONS`), reducing secondary GitHub rate-limit failures.
- Stopped MSI/MRI metadata-only auto-commits to default branch; report timestamp/date-only churn is now ignored unless content-change PR criteria are met.
- Refined home page information architecture and responsive layout:
  - Reduced card density, improved section hierarchy, and rebalanced content columns.
  - Updated portal home rendering to a scalable list layout for growth.
- Refined footer layout/content hierarchy:
  - Improved responsive alignment/spacing, constrained divider width to container, and added explicit developer/issue links.
  - Standardized branding presentation with PrZ3/MSR marks and config-driven copyright year.
- Updated workflow trigger path:
  - Site build (`Build MSRBot.io Site and Test`) now runs on `push` to `main`.
  - URL validation now triggers from MRI completion (plus schedule/manual), not from site build completion.
  - PR gate remains `PR Build Preview (MSRBot.io site)` on `pull_request`.
- Added focused documents-registry helper scripts:
  - `npm run docs-sort` to sort `src/main/data/documents.json` by `docId`.
  - `npm run docs-validate` as explicit docs validation alias.
  - `npm run docs-fix` to run sort + validation in one step for manual doc edits.
- Updated `docIdSort` behavior for low-noise editing:
  - Removed legacy `.bak` sidecar creation.
  - Preserved per-entry object formatting and reordered entries only.
  - Aligned sort comparator with validator ordering (`toUpperCase()` lexical) to prevent sort/validate mismatch loops.

### Fixed
- Fixed OM remap path in extraction by correcting title variable scope usage, enabling OM ID remapping updates to apply correctly.
- Fixed README weekly schedule Markdown table separator to render correctly with all columns.
- Fixed doc citation “Copy (undated)” behavior on doc pages so undated snippet blocks copy correctly (no blank clipboard payload).
- Fixed undated citation snippet `<cite id>` generation to strip only terminal date suffixes for undated variants, while leaving dated variants unchanged.

## [v1.2.0] - 2026-02-05

> Primary changes delivered via <https://github.com/PrZ3r/MSRBot.io/pull/695>
 
### Added
- Automated extraction of `Scope` in HTML documents to map to `abstract`.
- Introduced **Portals**: curated, first-class landing pages that aggregate documents across suites, collections, publishers, and document types.
  - First (3) portals: `/dcinema/`, `/imf/`, `/accessibility/`
- Added a complete **Portal build and schema pipeline**, supporting:
  - Keyword-based document matching.
  - Explicit pinning and post-resolution filtering.
  - Shared narrative/overview sections.
  - Curated resource collections.
- Delivered a **Suites-aligned Portal UX**, including:
  - Searchable document tables with abstracts.
  - Expandable previews (shared behavior with Suites).
  - Visual muting of withdrawn and superseded documents.
  - Structured, card-based overview and resource sections.

#### Portal Behavior & UX Details
- Portals render as dedicated pages with stable URLs (e.g. `/dcinema/`).
- Portal document listings support:
  - Default sorting by `docLabel`.
  - Search, publisher filtering, and sortable columns.
  - Abstract previews with More/Less expansion.
- Portal overview sections support shared explanatory content using the same card patterns as Suites.
- Resource sections support:
  - Grouping by category.
  - Independent collapsible sections.
  - Per-resource description expansion for long content.
- Portal navigation dynamically adapts based on available content (Overview / Docs / Resources).
 
### Changed
- Backfilled (auto and manually) `abstract` fields for DC and IMF `collections`
 
### Fixed
- Fixed rendering of `abstract` paragraph breaks in `suites`. 

## [v1.1.0] - 2026-01-06

> Primary changes delivered via <https://github.com/PrZ3r/MSRBot.io/pull/678>

### Added
- Introduced first-class **Suites** and **Collections** as distinct core concepts:
  - Suites represent true multipart standards (shared lineage number).
  - Collections represent related documents without formal parts.
  - Suites and collections share UX but retain distinct semantics.
- Added full **Suites / Collections build pipeline**, emitting:
  - `build/suites/_data/suites.json` (mixed, with explicit `kind: suite | collection`).
  - Dedicated pages at `/suites/:slug/` for both suites and collections.
  - Index page supporting mixed display with filtering by kind.
- Implemented **docSuiteTitle** extraction and propagation:
  - HTML: derived directly from `pubSuiteTitle`.
  - PDF: parsed as text before first em-dash.
  - Integrated across search index, citations, RefTree roots, suite cards, and doc detail pages.
- Enabled full **ALLPARTS resolution**:
  - Supports ISO and SMPTE ALLPARTS identifiers.
  - Doc detail pages resolve ALLPARTS to suite pages with correct labels and status.
  - RefTree displays suites as non-clickable parents that expand to child documents.
- Added guardrails and explicit metadata to prevent future regressions:
  - Explicit `kind: suite | collection`.
  - Flags for `SUITE_TITLE_MISMATCH`.
  - Hard exclusions for unsupported publishers and document types.

### Changed
- Finalized and locked **build order** to ensure correctness and stability:
  - Documents → MSI → Suites/Collections → Pages.
- Updated suite and collection rendering:
  - Suites show all documents, including withdrawn (visually muted).
  - Collections hide parts column and sort by label.
  - Abstract previews and expand/collapse behavior added.
- Refined RefTree behavior:
  - RefTrees may display suites but never re-center on them.
  - Suite labels replace ALLPARTS identifiers where applicable.
- Normalized publisher handling for edge cases (e.g., ANSI/ASA) so suite and collection lookups resolve correctly.

### Fixed
- Fixed ALLPARTS resolution failures where document type previously blocked linking.
- Corrected publisher logo and link resolution on suite and collection pages.
- Resolved reference edge cases for W3C documents.
- Eliminated legacy suite/collection duplication and silent clobbering in the build process.
