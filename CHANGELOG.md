# Change Log

> See [docs/buildlog.md](docs/buildlog.md) for details of [v1.0.0](https://github.com/PrZ3r/MSRBot.io/releases/tag/v1.0.0) released on Nov 26, 2025.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - yyyy-mm-dd
 
### Added

### Changed

### Fixed

## [v1.3.0] - 2026-02-24


 
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

### Changed
- Refactored `extractDocs.js` to be provider-agnostic orchestration (merge, metadata, MRI, and logging), with provider-specific discovery/parsing moved out of main script.
- Extraction provider selection is now explicit via `--provider`; implicit/default provider execution was removed.
- Renamed SMPTE extraction workflow to `extract-docs-smpte.yml` (`Extract Documents - SMPTE`) and aligned workflow references/triggers accordingly.
- Updated docs and badges to reference the renamed SMPTE extraction workflow.
- Updated validation architecture for keywords:
  - Removed hard keyword enum enforcement from `documents.schema.json`.
  - Moved keyword conformance checks to `documents.validate.js` against `src/main/config/site.json#controlledKeywords`.
- Expanded IETF extraction behavior:
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
- Enhanced Portal document listings with additional context fields:
  - Display of `docType` and `publicationDate` in document tables.
  - New **Doc Type** filter, aligned with existing Publisher filtering.
- Extended Portal sorting controls to support:
  - Sorting by **Type** and **Published date**.
  - Ascending / descending sort direction for all supported sort keys, consistent with Suites and Collections.

### Fixed
- Fixed OM remap path in extraction by correcting title variable scope usage, enabling OM ID remapping updates to apply correctly.

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
