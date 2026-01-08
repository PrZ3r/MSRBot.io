# Change Log

> See [docs/buildlog.md](docs/buildlog.md) for details of [v1.0.0](https://github.com/PrZ3r/MSRBot.io/releases/tag/v1.0.0) released on Nov 26, 2025.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - yyyy-mm-dd
 
### Added
- Automated extraction of `Scope` in HTML documents to map to `abstract`.
 
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