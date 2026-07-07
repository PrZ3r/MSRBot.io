# Change Log

> See [docs/buildlog.md](https://github.com/PrZ3r/MSRBot.io/blob/main/docs/buildlog.md) for details of [v1.0.0](https://github.com/PrZ3r/MSRBot.io/releases/tag/v1.0.0) released on Nov 26, 2025.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - yyyy-mm-dd

### Added

- **Phase 1a resolver** — new `resolveSmpteSourceRefs.v2.js` replays PR #1111's leftover unresolved-refs bucket against today's corpus + MRI v2 slug system. Filters to **602 entries from Standards-family source docs** (Standard / EG / RP / RDD / Specification / Technical Specification / Administrative Guideline); the remaining 359 entries from Journal Article + Conference Paper sources stay in the report for Phase 3a/3b. Resolution chain: vol+pages SMPTE-self-cite (against the ~18k ingested journal corpus) → `parseRefId(<standardnum>, <online-cite>)` → `parseRefId(cite, online-cite)` → `mapRefByCite` → conservative 1:1 title-match against the registry → MRI v2 slug-mint fall-through. Dry-run summary: **26 canonical resolutions** (17 direct registry hits + 9 `mri-known-no-doc`) and **576 slug-mints** for refs PR #1111 silently dropped. Under MRI v2, slug-minted refs are NOT silent — they land in the source doc's `references[]`, the MRI entry carries the raw `<ref>` XML + citation text, and the doc page renders them inline as `<cite>citation text</cite>` with an `EXTERNAL` badge instead of dropping them. Slugs can graduate to canonical refIds later via `resolveOrphans` once a new parser family or refMap entry covers them. Tooling commit lands the script + dry-run reports (`src/main/reports/smpteSourceRefs.v2.{json,md}`); the registry-mutating `--apply` is handed to the user per the bulk-apply convention. **`refsReaudit.{json,md}` refreshed** to reflect the post-apply state: total ref-entries audited goes **8,995 → 9,547** (+552 after content-hash dedup), `orphan-slug` count goes **70 → 598** (+528 — the slug-mint recovery), and headline "resolved %" goes **82.71% → 78.16%** — note: the % drop is the **right** direction. The earlier 82.71% was inflated by silently dropping the 602 unresolved refs; under the slug system they're visible as orphan slugs in the denominator, so the rate gets larger faster than the resolved numerator. The corpus is now more honest about what's known vs unknown, even if the headline number looks worse.
- **Pre-#1171 audit pass** — refreshed [`mriCoverageGaps.{json,md}`](src/main/reports/mriCoverageGaps.md) (PASS — slug-system invariant holds across the 528 new orphan slugs; every `doc.references[]` entry present in `MRI.refs[]`) and `refsReaudit.unmappedFields.{json,md}`. Establishes the baseline registry/refs state ahead of the [#1171](https://github.com/PrZ3r/MSRBot.io/issues/1171) `rawSource` envelope migration. Validators run clean: `npm run validate` (all 4 registries pass), `npm run validate-mri-coverage` (PASS, 9,547 entries audited).
- **Docs touch-up** — `docs/smpte-source-backfill.md` updated: original "~961 unresolved" markers now reflect the 602 → consumed-by-Phase-1a / 359 → remain-for-Phase-3a/3b split. Outcome block calls out PR #1210 explicitly.
- **Authors-to-object-form migration + SMPTE HIGHWIRE backfill** — closes [#1196](https://github.com/PrZ3r/MSRBot.io/issues/1196). Two-pass `migrateAuthorsToObjectForm.js`: (1) walk all 21,389 NLM XMLs under `_source/SMPTE/HIGHWIRE/` to build a `docId → [{name, affiliation?, bio?}]` index from `<contrib-group>` + `<aff>` + `<bio>` cross-references; (2) walk the registry and migrate every doc whose `authors[]` is still in legacy string form to schema 2.3.0 object form, enriching from the HIGHWIRE index where DOIs match and author counts agree. Idempotent — docs already in object form (e.g. the 10.5594-j18501 v2.1.0 demo) are skipped. Dry-run summary against the current corpus: 26,445 total docs, 15,694 with no `authors[]`, 1 already-object, **10,750 to migrate** — of those, **9,805 enriched from HIGHWIRE** (registry name preserved verbatim, NLM `<aff>` attached as `affiliation` and `<bio>` as `bio` per author), **945 shape-only** (non-SMPTE long tail with no HIGHWIRE source), **1 count-mismatch fallback** (HIGHWIRE author-count differs from registry — shape-only for safety). Net data added: **11,331 affiliations + 1,602 bios** across the SMPTE journal-article corpus. Tooling commit lands the script + dry-run report (`authorsMigration.{json,md}`); registry-mutating `--apply` is handed to the user per the bulk-apply convention. Invoke directly: `node src/main/scripts/extras/migrateAuthorsToObjectForm.js [--apply]`.
- **IETF extractor — shape-only authors object form** — [providers/ietf.parse.js](src/main/scripts/providers/ietf.parse.js) emits `[{name}]` instead of `["X"]` at both author boundaries (RFC docs + archive-XML docs). `pickFirstArrayWithSource` made polymorphic so it preserves objects with `.name` while still string-coercing other fields (keywords). No source-archive mining yet; affiliation/organization extraction from RFC XML `<organization>`, Datatracker JSON, and HTML meta tracked in [#1211](https://github.com/PrZ3r/MSRBot.io/issues/1211) (small focused PR, requires a re-extract of the 52 IETF docs).
- **Author Affiliation facet disabled** in [build.search-index.js](src/main/scripts/build.search-index.js) + [docList.js](src/site/js/docList.js). The #1196 backfill landed **6,936 distinct raw affiliation strings** — every spelling/punctuation variant from the source XML survives (`"RCA Manufacturing Co., Camden, N. J."` vs `"RCA Manufacturing Co., Camden, N.J."` vs `"RCA Manufacturing Co."` are 3 buckets for 1 institution). Even ~500 raw strings would be unusable as a picker. Per-doc `affiliations` array still emitted on each idx row so full-text search keeps matching affiliation strings and `?f.affiliations=<exact string>` URL filters still work. Affiliation normalization / fuzzy clustering (collapse ~7k raw → ~1–2k canonical institutions, then re-enable the picker) tracked in [#1214](https://github.com/PrZ3r/MSRBot.io/issues/1214).

### Changed

### Fixed

- **`mriFlush` no longer clobbers extractor-set `resolvedDocId` pointers on every build.** The "resolution truth" branch in [referencing.js](src/main/lib/referencing.js) used to treat `_findSourceDocIdForRefId(e.refId)` (refId-as-its-own-docId lookup) as the sole authority — when an extractor mapped a non-docId refId to a real registry doc (the N-to-1 slug→docId case the slug architecture was designed for), flush demoted the entry back to `resolvedDocId: null, needsResolve: "known-publisher-no-doc"` every time. Surfaced in PR #1201's auto-generated MRI data diff: `IETF.draft-ietf-tls-rfc8446bis-03 → RFC8446` (mapped by the IETF `ietf-rfc-html-fallback` / `rfc-text` resolution) reverted to unresolved, and the resolved/known-pub-no-doc stats moved 1814→1813 / 932→933 — same shape would have hit every parser-family resolution Phase 1b lands. Fix: the `else` branch now preserves an existing `resolvedDocId` that still points at a registered doc (via `_hasDocIdOrBase`), and only demotes when the existing pointer has gone stale or was never set. Sibling logic in the secondary flush path patched the same way. New regression test ([referencing.flush.test.js](src/main/scripts/test/referencing.flush.test.js)) pins both branches; `npm test` runs it after the existing registry smoke tests.

### Removed

## [v2.1.0] - 2026-06-18

### Added

- **MRI v2 — slug-keyed citation system: every cited reference is now addressable, renderable, and auditable.** Closes [#902](https://github.com/PrZ3r/MSRBot.io/issues/902) (`[FEATURE] Slug info for missing refs` — the `[NOT IN REGISTRY]` bare-slug render is replaced by inline `<cite>refId — citation text</cite>` + `EXTERNAL` badge for every MRI-known ref). A foundational shift in how unresolved references are modelled, surfaced, and progressively resolved over time. Before: refs the parser couldn't shape into a canonical refId fell off into `badRefs.latest.json` (a stale-by-day-2 sidecar) or `MRI.orphans.unmapped[]` (a flat list with no slug identity, unable to be cited from `doc.references[]`). After: every ref the build sees lands in `MRI.refs[]` as a first-class entry — either as a **canonical-form slug** (`ASME.B1.1.1989`, `RFC1642`) when the parser recognised a publisher family, or as a **source-anchored slug** (`orphan/<sourceDoc>/<refXmlId>` for raw-XML refs, `orphan/<sourceDoc>/h:<contentHash>` for cite-only refs) when it didn't. Doc files cite slugs as strings in `references[]`; future resolution work touches only MRI's `resolvedDocId` pointer, not the doc files (re-extracts may converge a slug to its canonical refId, but the MRI entry retains the per-sighting audit trail). **Authoritative architecture reference: [docs/mri-citation-system.md](docs/mri-citation-system.md)** — covers how a `doc.references[]` string actually resolves, the slug ↔ docId relationship, the resolution lifecycle, and worked lookup recipes. Concretely:
  - Every `MRI.refs[]` entry now carries `resolvedDocId` (the registry doc this ref points at, or `null`), `needsResolve` (`null` / `"known-publisher-no-doc"` / `"unknown-publisher"`), and `contentHash` — a 16-hex SHA-256 of the normalised raw `<ref>` XML that groups sightings of the same citation across multiple source docs, so one resolution decision propagates to every sighting that shares the hash.
  - **New `synthesizeCiteFromRawRef` helper** parses authors/article-title/pub-title/standardnum/volume/pages/year out of raw `<ref>` XML (both APTARA `<ref_authorgrp>/<ref_author>/<init>/<ref_surname>` and NLM `<name>/<surname>/<given-names>` shapes) and composes a human-readable citation string. Wired into the mint path so new orphans auto-populate `citationText` when extractors pass `rawRef` but no explicit cite. Backfilled **1,283 existing MRI entries** that had raw XML but no `citationText` — including books like Ousterhout's _Tcl and the Tk Toolkit_ (2nd ed., Addison-Wesley, 2009) that previously rendered as the bare slug.
  - **`docId.hbs` renders MRI-known refs inline as `<cite>refId — citation text</cite>`** with an `EXTERNAL` badge, instead of the bare `NOT IN REGISTRY` pill. The Handlebars `getStatus` helper returns `"MRI-KNOWN"` and the new `mriCite` helper produces the markup, with optional `<a>` wrap when MRI carries an `href`. Applies to the normative + bibliographic refs list and the supersededBy / amendedBy lists.
  - **Client-side cite rendering on the reference tree.** New `build/api/mri-cite-map.json` sidecar (~150 KB, ~982 entries) ships alongside the docs API. `refTree.js` fetches it at init alongside `documents.json` / `suites.json`, and for tree nodes whose target isn't in the registry but is in MRI renders the citation text inline plus an `EXTERNAL` badge. Root-view of an MRI-only ref disables the **Set as new root** button since there's no doc to drill into.
  - **The 69 source-anchored orphan slugs are now cited from their source docs' `references[]`** (27 docs touched). PR #1111's source-ref extractor had written them into MRI's legacy `orphans.unmapped[]` flat list but never written a citing string into the source doc — the slug migration created MRI slug keys but the doc files were still unaware. Now backfilled: e.g. `SMPTE.RP2073-2.2014`'s normative refs are 3 canonical + 3 orphan slugs = the full six refs its source XML carries, including the previously-invisible Ousterhout book.
  - **Build console is silent now.** The two warning classes the slug system makes redundant (1,298 `No lineage key derivable` + 120-294 `[WARN:getStatus] docId "X" not found in registry`, the latter scaling with the number of citing docs) are both fully suppressed when MRI has the citation info, or — for refs in neither registry nor MRI — silenced entirely on the grounds that the MRI presence audit + the `build-master-reference-index.yml` auto-issue workflow (#937-style "MISSING REF: RFC1642" issues) already capture the same population. The `[Refs] X: missing-lineage refs (unique) = N` per-doc summary line counts genuinely-unknown refs only.
  - **Forward-compatible resolution.** When you later run the IETF extractor and `RFC1642` lands as a registry doc, MRI's entry just gets `resolvedDocId: "RFC1642"` set and `needsResolve` cleared — no doc file edits. The renderer's `followMriResolution` helper chases the pointer in `getStatus` / `refHref` / `getLabel` so the doc page link goes straight to the resolved doc. When a new parser family graduates a `contentHash` group of orphan slugs, every sibling sighting upgrades in one pass. The `MRI.refs where resolvedDocId === null` query is the live backlog — no more stale-by-day-2 reports.
  - **`extractDocs.js` writes orphan slugs from extract end-to-end.** `onBadRefs` now routes through `mriRecordSighting` (which returns the minted slug) and queues each slug for application to the source doc's `references[]` right before save. So a fresh ingestion of, e.g., RFC1101 lands with `["…", "orphan/RFC1101/h:e25f0fbf"]` in `references.bibliographic[]`, MRI gets the matching entry, and the post-extract prune leaves it alone because the doc cites it. The legacy `src/main/reports/badRefs.latest.json` sidecar is removed.
  - **`resolveOrphans.js` (new extras script)** — idempotent MRI-only retry pass. Walks every entry with `resolvedDocId === null`, runs each through `registry-direct` / `parseRefId` / `mapRefByCite`, and graduates anything that now hits. `contentHash`-sibling propagation means one resolution updates every entry in a hash group in the same pass. No doc files touched. Run as often as you want — each newly-ingested target doc or newly-added parser family / refMap entry gives this pass more to graduate.
  - **Auto-issue workflow filtered.** `build-master-reference-index.yml` now filters `audit.missing[]` to `needsResolve === 'known-publisher-no-doc'` before creating "MISSING REF: X" issues. Source-anchored orphan slugs stay queryable through the audit and MRI itself but no longer flood the issue tracker. The audit emits `knownPubNoDocCount` + `orphanCount` summary fields alongside `missingCount` so dashboards can read intent without re-scanning.
  - **New `src/main/scripts/extras/migrateMriToSlugSchema.js`** handles the in-place schema lift on existing MRI (idempotent); `referencing.js`'s `_ensureRef` and `mriRecordSighting` mint the slug schema going forward; `documents.validate.js` cross-checks `git ls-files` against `fs.readdirSync` per doc to catch macOS case-only drift locally before CI.
- **SMPTE NLM journal-article + conference-paper backfill** — ~19,587 NLM-extracted SMPTE journal articles (1916–2015 Transactions / SMPE / SMPTE Journal / MIJ era) and ~1,503 conference papers loaded into the per-doc registry from `_source/SMPTE/HIGHWIRE/`. New `src/main/scripts/extras/extractSmpteJournalArticles.js` handles the NLM XML; corpus selection via `--corpus journal|conference|both`. Closes [#1172](https://github.com/PrZ3r/MSRBot.io/pull/1172).
- **APTARA journal-issue cross-fill (~22.5k docs)** — `extractSmpteJournalIssues.js` enriches existing journal-article docs with structured metadata (ISSN, copyright, publisherLocation, articleType, abbrevTitle) from `_source/SMPTE/APTARA/...journal_metadata` XMLs. Limit-aware chunking counts actual writes, not iteration position, so resumable runs converge.
- **`articleType` page gate** — `site.json#noPageArticleTypes` lists `articleType` values that don't get rendered site pages. Initial set: `obituary`, `other`, `news`, `calendar`, `announcement`, `correction`, `addendum`, `reprint`. Gated docs are skipped at the per-doc page, reference-tree, and sitemap emit loops, and dropped from `search-index.json`/`facets.json` so they don't appear in the browse list either. Stale pages from earlier builds are removed on rebuild. Gated docs remain fully present in the API and registry — the gate only suppresses generated pages, not data. New `src/main/lib/pageGate.js` drives the decision; matching is case-insensitive but exact-value.
- **`articleType` shown on doc pages** — surfaced in `docId.hbs` directly below Doc Type when present.
- **Journal Article breakdown in `/api/stats.json`** — new `documents.journalArticles` block: `{ total, articleTypes, byArticleType }` (sorted descending by count). Stats `apiVersion` bumps `1.0.0 → 1.1.0`.
- **SMPTE DOI re-registration ask list** — `src/main/reports/smpteDoiReRegistrationAskList.{md,csv}` enumerates the 96 SMPTE docs where the registered DOI form drifted from the registry-canonical form (malformed double-prefix, year-mismatch, registrar typo, amendment-notation drift), grouped by pattern, with `should-be (canonical)` target per row — direct hand-off format for SMPTE DOI re-reg.
- **Keyword vocab scrub** — new `src/main/scripts/extras/scrubKeywordVocab.js` audits every doc's `keywords[]` against `site.json#controlledKeywords` (canonical / case-drift / out-of-vocab / synonym buckets) and applies AUTO_FIX renames + DROP cleanup in `--apply` mode. Report at `src/main/reports/keywordVocabScrub.md`.
- **Refs re-audit + schema 2.3.0 prep.** Two new extras walkers (`reaudit-refs`, `reaudit-unmapped-fields`) re-classify every ref-entry across the now-complete corpus and tally source-XML element paths against schema 2.2.0 + the existing `sourceInventory.smpte.schemaMap.md` decisions, so we can scope the upcoming ref-resolution/extraction passes without guessing. Headline numbers from the refs walker: **8,995 ref-entries** across **1,066 docs** at **82.71% resolved** (66.60% direct, 16.11% via MRI); **1,485** are `mri-known-no-doc` (canonical refIds whose targets aren't ingested — top families: IEC 127, ITU-R 108, ISO 107, ITU-T 61, ATSC 42, ANSI 39, intra-SMPTE 32) and **70** are source-anchored orphan slugs. **Zero `unparseable`** — every string in `references[]` already routes through `parseRefId` or the slug system. Source-XML walker confirms Phase 3a/3b's universe (~13,418 `component/reflist/ref` sightings in 1.5k sampled APTARA + Allen Press files; ~2,865 NLM-shape `article/back/ref-list/ref` in 1.5k HIGHWIRE Source Bak; full corpus scales to roughly hundreds of thousands of citation sightings, much of which dedupes through the MRI content-hash). Reports at `src/main/reports/refsReaudit.{json,md}` and `src/main/reports/refsReaudit.unmappedFields.{json,md}`.
- **Schema 2.3.0** — `authors[]` items now accept an object form `{ name, bio?, affiliation? }` in addition to the legacy string form, so NLM journal-article author metadata (1,939 `bios` sightings + 1,774 `organization` sightings surfaced by `reauditUnmappedFields.js`) can land as first-class data on Phase 3a extraction. `$id` bumps `2.2.0 → 2.3.0`; the legacy string form remains valid for every existing doc. Worked sample landed at [10.5594-j18501.json](src/main/data/docs/smpte/journal-article/2015/10.5594-j18501.json) — _Study on the Acceptance of Higher-Frame-Rate Stereoscopic 3D in Digital Cinema_ (Ruppel, Alff, Göllner) — all three authors populated with `name` + `bio` + `affiliation` parsed from `_source/SMPTE/APTARA/.../MIJR15Vol124No1.xml`. Validator passes (0 errors across 26,445 docs). Issue [#1196](https://github.com/PrZ3r/MSRBot.io/issues/1196) tracks the full migration sweep + extractor updates (IETF, NLM/HIGHWIRE, APTARA, Allen Press, Zoho cross-fill).
- **MRI coverage validator** — new `npm run validate-mri-coverage` ([validateMriCoverage.js](src/main/scripts/extras/validateMriCoverage.js)) asserts the slug-system invariant: every string in any doc's `references.{normative,bibliographic,supersededBy,amendedBy}[]` must exist as a key in `MRI.refs[]`. Exit 0 on clean, exit 1 with a structured per-leak report (`docId`, category, ref string, leak-kind classification) when broken, exit 2 on script-level errors. Runs clean on current corpus — 8,995 ref-entries across 1,066 docs all present in MRI's 2,816 entries (3.2× dedup via content-hash collapse). Locks in the invariant against future extractor regressions so a render-time "NOT IN MRI" never reaches the UI — the build should fail loudly first. Reports persist to `src/main/reports/mriCoverageGaps.{json,md}` even on success for the audit trail. CI wiring is the next pass; the script is meant to drop into `build-master-reference-index.yml` after the MRI flush.
- **Schema 2.2.0 + 2.3.0 fields rendered on doc pages, indexed for search, and added as browse facets — closes [#1097](https://github.com/PrZ3r/MSRBot.io/issues/1097).** Eleven new rows on `docId.hbs`: `volume` / `number` / `pages` / `chapter` (basic citation block — somehow never rendered before despite being in the schema since v1), `approvalDate`, `abbrevTitle`, `copyright` (`{holder, year}` as `© year holder`), `publisherLocation` (`{city, country}` inline next to publisher), `issn` (handles both legacy string + 2.2.0 `{print, electronic}` object — renders as `Print: 1545-0279 | Electronic: 2160-2492`), `icsCodes` (`[{code, description}]` — each code as a clickable link with the ISO description shown inline after), and a rewrite of the `authors[]` loop to handle the 2.3.0 object form — one author per line; `name` left, optional `affiliation` right-aligned as a muted text link to the affiliation facet; optional `<details>` bio expander matching the existing "Undated variant" pattern; subtle `border-top` divider between authors so multi-author blocks with bios don't crowd. Legacy string-form `authors[]` (the entire 26,444-doc corpus pre-#1196 migration) keeps rendering as before via fall-through. Doc list **card previews** also gain three new touches: `articleType` chip in the badge row right after `docType`; `Affiliation:` row between badge row and publication date; `ICS:` row above keywords with the ISO description as a hover tooltip. Search index ([build.search-index.js](src/main/scripts/build.search-index.js)) now indexes `doiAliases[]` (so ISBN-form / legacy DOIs resolve to canonical doc), `abbrevTitle`, `authors[].affiliation`, and `authors[].bio` (full-text). Three new browse facets on the doc list — `articleType` (`research-article` 6,147 docs, `orig-research` 683, etc.), `icsCodes.code` (top: `33.160.01` Audio/video/audiovisual systems @ 813 docs across 19 codes), and `authors[].affiliation` (sparse today — populates as #1196 migration + Phase 3a extraction land). Label maps emitted into `facets.json` so picker + applied-filter pills both render friendly forms: `articleTypeLabels` driven by [site.json](src/main/config/site.json)'s 22-entry map (`research-article → Research Article`, `orig-research → Original Research`, `info-society → Society Information`, etc., covering both gated and ungated values), and `icsCodeLabels` collected during build (first non-empty description per ISO code wins — ISO codes are canonical, so any doc's copy serves). The facet picker for ICS shows `<code>{{code}}</code> {{description}}` so the meaning is readable at a glance, not just on hover. Pure-internal fields (`standardId`, `productNumber`, `familyId`, `journalAcronym`, `releaseTag`, `contentType`, `docElement`, `depositDate`, `resolvedHref`, `workInfo`, `xmlNamespace`, status process internals like `stage` / `state` / `latestVersion` / `versionless` / `publicCd` / `withdrawnNotice`) remain API-only by design — the doc-page metadata block is for citation + browse context, not committee/process plumbing.

### Changed

- **`/api/documents.json` is now a lightweight index** (`apiVersion` bumps `1.0.0 → 2.0.0`) — the full-bundle shape grew past GitHub's 100 MB per-file limit on the `gh-pages` branch as the SMPTE journal-article backfill landed. The endpoint now emits one row per doc — `{ docId, publisher, docType, docLabel, docTitle, articleType?, path }` — each linking to `/api/doc/{docId}.json` for the full record with `$meta` provenance. Drops the file from ~120 MB to ~7 MB and stays small as the corpus grows. Per-doc shards are unchanged and remain the canonical full-data endpoint. Closes [#1173](https://github.com/PrZ3r/MSRBot.io/issues/1173).
- **SMPTE journal-article DOI case is preserved end-to-end** — `10.5594/J*` (uppercase J — pre-1955 Transactions era) and `10.5594/j*` (lowercase j — 2010+ Motion Imaging Journal series) are now treated as **distinct DOI namespaces** pointing to different articles. `doiToDocId` in `parseSourceName.js` no longer force-uppercases the leading letter; `documents.validate.js` + `lib/registry.js` sort case-sensitively so `j*`/`J*` occupy distinct positions. The earlier `fixLowercaseSmpteDocIds.js` cleanup that conflated lowercase-j with case drift is deleted; its 308 wrongly-deleted MIJ articles are restored. Closes [#1188](https://github.com/PrZ3r/MSRBot.io/pull/1188).
- **J/JXY same-article DOI twins cross-merged (130 docs)** — Transactions-era articles registered under both bare `J*` (NLM-extracted) and `J*XY` (APTARA-extracted) forms now share the union of metadata (NLM-rich abstract/authors/precise date + APTARA-structured ISSN/copyright/publisherLocation). 159 phantom bare `J*****` files that case-collide with their lowercase `j*****` sibling were deleted — their DOIs case-insensitively resolved to the 2010+ MIJ article, never to the 1917 Transactions content their files claimed.
- **30 MIJ ISSN corrections** — 2012-era lowercase-j docs that APTARA tagged with the predecessor SMPTE Journal print ISSN (`0036-1682`) are corrected to the MIJ ISSN pair (`1545-0279` / `2160-2492`). `$meta.originalValue` preserves the APTARA-source form.
- **`keyword.normalize.js` cleanups** — `normalizeKeyword` / `splitAndNormalizeKeywords` accept an optional `extraAcronyms` Map for per-corpus overrides. IETF XMLDSig spec-element names (`AgreementMethod`, `DigestMethod`, etc.) moved out of the global `ACRONYM_MAP` into an IETF-only map in `providers/ietf.parse.js`. The `signturemethod` typo is corrected on import while `$meta.originalValue` preserves the RFC source. `crossfillSmpteFromZoho.js` switched to the central normalizer (drops its duplicated local `KEYWORD_SYNONYMS`).
- **`controlledKeywords` once-over** — pluralised singular drift (`Subtitle → Subtitles`, `Interface → Interfaces`, `Network → Networks`, `Type → Types`), collapsed acronym/long-form pairs (`Look-up Table → LUT`, `Common LUT Format → CLF`, `Microservice → Microservices`, `Internet of Things → IoT`, `USB Type-C → USB-C`), promoted ~31 in-use external terms (AFD, DPX, MIB, LUT, CLF, RTP, TTML, IMSC, TIFF, etc.) into the vocab, removed the `SigntureMethod` typo + `Eneryption` duplicate, fixed Title-cased `Of` / `In` conjunctions in multi-word terms, and dropped redundant noise (`SMPTE`, `Society of Motion Picture and Television Engineers`, `Languages`, `Status`, `SNMP`).
- **Zoho standards cross-fill expanded** — `crossfillSmpteFromZoho.js` adds `keywords` (Keywords + Topics columns, deduped through the central normalizer) and a no-op short-circuit so identical-set merges don't churn `$meta` timestamps.
- **`validate-urls.yml` cadence dropped from weekly to biweekly** — cron now fires on the 1st and 15th of each month (was every Saturday). The duplicate-run throttle on `workflow_run`-triggered executions widens from 24 hours to 14 days, matching the cron cadence, so the upstream `Build MasterReference Index` trigger can no longer fire a redundant full URL sweep between scheduled runs. Driven by the corpus passing ~26k docs (each sweep now takes hours, publishers throttle the request rate, and standards URLs rarely drift inside a 14-day window). Throttle label renamed `daily-throttle` → `biweekly-throttle` in the skip-reason output for clarity.

### Fixed

- **`validate-urls.yml` App-token mid-job expiry** — the App token minted via `actions/create-github-app-token@v3` at job start is hard-capped at a 1-hour TTL by GitHub. The `Run URL validation` step routinely takes 90+ minutes against the now-26k-doc corpus, so by the time the `Auto-commit audit back to main` step ran the original token was dead and `git push` exited 128 with `fatal: could not read Username for 'https://github.com'` (see run [#27777168738](https://github.com/PrZ3r/MSRBot.io/actions/runs/27777168738)). Fix: re-mint the App token (`steps.app-token-refresh`) right after the audit read and before any push, then explicitly inject the fresh token into the `origin` remote URL via `git remote set-url` so `git push` uses it instead of the expired credential stored in `.git/config` by `actions/checkout`. All three downstream auth points (auto-commit push, base-sync fetch, `Create PR for normalized URLs` via peter-evans) switched to `steps.app-token-refresh.outputs.token`. Initial checkout still uses the original `steps.app-token` since it fires within seconds of mint.
- **CI `Validate registries` post-merge case-mismatch** — 683 SMPTE journal-article files were tracked by git with lowercase-j paths but carried uppercase-J `docId` fields (macOS case-insensitive FS hid the drift locally); renamed to match content. Closes [#1189](https://github.com/PrZ3r/MSRBot.io/pull/1189).

### Removed

- **`src/main/scripts/extras/fixLowercaseSmpteDocIds.js`** — actively harmful; conflated SMPTE's intentional lowercase-j DOI namespace with case drift and unlinked 308 real MIJ articles as "colliders" against pre-1955 Transactions counterparts.

## [v2.0.0] - 2026-05-19

Major release — the document registry model is inverted. The source of truth moves from the monolithic `src/main/data/documents.json` to one JSON file per document under `src/main/data/docs/`, sharded by `{publisher}/{docType}/` (with a `{year}/` level for title-identified docTypes). The monolith, per-publisher/docType slices, and the per-docId API all become build artifacts. See [#1108](https://github.com/PrZ3r/MSRBot.io/issues/1108).

### Added
- **Per-doc document registry** — the registry source of truth is now one JSON file per document under `src/main/data/docs/{publisher}/{docType}/{docId}.json`; title-identified docTypes (`site.json#titleLabelDocTypes`) add a `{year}/` level. Removes the single-file scale ceiling (GitHub's 50/100 MB limits, whole-file rewrites, unreviewable diffs) ahead of the journal-article backfill.
- New `src/main/lib/registry.js` — central registry access: `loadAllDocs`, `loadDoc`, `saveDoc`, `slug`, `docIdSlug`, `docPath`.
- New `npm run new-doc` — scaffolds a new per-doc file from the template straight into its correct shard path.
- New `npm run assemble` (`build.assemble-registry.js`) — emits per-publisher and per-publisher/docType registry slices under `build/`.
- New one-time `src/main/scripts/migrate.explode-documents.js` — explodes the legacy `documents.json` into the per-doc tree (dry-run by default; `--apply`). Removed after the v2.0.0 migration; preserved in the commit history if ever needed again.
- New `npm test` (`src/main/scripts/test/registry.test.js`) — self-contained smoke tests pinning the `slug` / `docIdSlug` / `docPath` invariants in `src/main/lib/registry.js` (including the `_unknown` / `_undated` buckets and the year third-shard).

### Changed
- `documents.json`, the per-publisher/docType slices, and the per-docId API are now **build artifacts** assembled from the per-doc registry — never hand-edited.
- `npm run canonicalize` runs per-file: key-sorts each doc, injects `$meta`, re-homes any file not at the shard path its own fields derive, and prunes emptied directories.
- `npm run validate` runs per-file and adds a path-consistency check — a file must sit where its `publisher`/`docType`/`docId`/`publicationDate` fields derive. Each per-doc file is validated directly against the item schema, so Ajv error paths read `/docId` etc. rather than `/0/docId`.
- `extractDocs` writes only the docs a run touched, each to its own shard file, via `saveDoc()` (which re-homes on publisher/docType/docId changes).
- `npm run build` now emits `build/api/stats.json` itself — the former `build-stats` workflow step is folded in.
- `build-msi` / `build-mri` `--in` is now optional, defaulting to the per-doc registry; ~13 registry read sites swapped to `loadAllDocs()`.
- Extract, URL-validate, and index-build workflows updated to operate on `src/main/data/docs/`.

### Removed
- `npm run docs-sort` and `npm run docs-fix` (and `src/main/scripts/utils/docIdSort.js`) — array order is now derived from filenames; `canonicalize` owns ordering and placement.
- The separate "Generate API stats" workflow step — folded into `npm run build`.

## [v1.4.2] - 2026-03-11

### Added
- Added `npm run seed-backfill-ietf` helper (`src/main/scripts/utils/seedBackfill.ietf.js`) to compare MRI presence-audit missing RFC refs against `src/main/input/seedUrls.ietf.json`, with:
  - dry-run reporting (default)
  - `--write` mode to append missing RFC seeds and canonicalize/dedupe the full seed list.

### Changed
- IETF RFC HTML reference extraction now includes a modern xml2rfc-HTML path:
  - Detects modern RFC pages via `xml2rfc` generator metadata and/or `application/rfc+xml` alternate links.
  - Parses structured `dl.references` entries using `dt`/`dd` boundaries for normative/informative sections.
  - Falls back to legacy section/anchor heuristics only when structured extraction is unavailable or incomplete.
- Expanded keyword normalization acronym map in `src/main/scripts/utils/keyword.normalize.js`:
  - added additional crypto/protocol acronyms (for example `XMSS`, `WOTS`, `W-OTS`, `WOTS+`, `W-OTS+`)
  - reformatted acronym definitions to sorted one-per-line entries for readability and safer diffs.
- Reference normalization now includes generic DOI/ISBN fallback parsing in `parseRefId`, reducing manual `refMap` backfills for citations that include canonical identifiers.
- Reference normalization now includes generic 3GPP Technical Specification parsing from cite text (including Draft TS forms), with month-aware suffixes (e.g., `3GPP.33.501.202107`).
- `badRefs.latest.json` writing now merges per provider into a single snapshot file:
  - each bad-ref item includes `provider`
  - each extract run replaces only the current provider's items and preserves other providers' entries
- Updated `npm run seed-backfill-ietf` (`src/main/scripts/utils/seedBackfill.ietf.js`) to also backfill missing `IETF.draft-*` refs from MRI presence-audit (in addition to RFC refs), including draft filename-extension normalization (`.txt/.xml/.html/.pdf`).

### Fixed
- **URL validation throttle false positives on skip-only runs** — refined `.github/workflows/validate-urls.yml` daily throttle to count only runs that actually executed `Run URL validation` successfully; skip-only successful runs (for example, upstream open-PR marker skips) no longer satisfy throttle.
- **IETF filter prefix overmatch in seed-first extraction** — fixed `src/main/scripts/providers/ietf.discovery.js` URL filtering so short RFC filters (for example, `.../rfc861`) no longer overmatch longer IDs (for example, `.../rfc8615`, `.../rfc8820`):
  - filter comparisons now use normalized URL forms
  - prefix matching now requires explicit intent via trailing `/` in the filter entry.
- **W3C dated TR stage references not resolving** — expanded W3C URL parsing in `parseRefId` to resolve dated `/TR/YYYY/<STAGE>-<shortname>-<date>` forms beyond REC (for example `WD-CSP3-20160913`, `CR-referrer-policy-20170126`).
- **MRI add-then-prune churn across extract/build-MRI workflows** — extraction now prunes MRI variants to current `documents.json` reference truth before flush, preventing transient rawVariants (for example self-cites or non-persisted sightings) from being added by extract and then removed by later `buildMasterReferenceIndex` runs.
- **Resolved citations leaking into `badRefs.latest.json`** — tightened bad-ref suppression in both `extractRefs` (`src/main/lib/referencing.js`) and extract report persistence (`src/main/scripts/extractDocs.js`) so any citation that resolves via `parseRefId` or `mapRefByCite` is excluded from bad-ref output, eliminating stale false positives during mixed parser-path runs.
- **NIST SP reference normalization gap** — added generic NIST SP parsing in `parseRefId` for CSRC `.../publications/detail/sp/.../rev-...` URLs and text forms like `NIST 800-67, Rev. 2`, producing canonical IDs such as `NIST.SP.800-67r2`.
- **Legacy RFC appendix/procedure spillover into unparseable refs** — tightened IETF HTML fallback boundaries and numbered-item badRef gating to avoid treating appendix example steps (for example CoAP WebSocket procedure lines) as bibliographic references.
- **IETF draft token misclassification/normalization issues** — improved draft extraction to:
  - strip filename extensions from draft IDs (`.txt/.xml/.html/.pdf`)
  - reject generic filename false positives (for example `...preliminary-draft-4.pdf`)
  - prefer `href`-derived draft IDs over cite-derived variants when both are present
  - choose the longest valid draft token to avoid truncated wrapped-text matches.
- **IETF legacy heading detection gaps** — broadened fallback heading recognition for `Normative References` / `Informative References` in `<span class="h2">` and `<span class="h3">` variants.
- **Reference mapping coverage gaps** — expanded `src/main/input/refMap.json` with additional DOI/IANA/IAB/OMA/GitHub/arXiv and legacy citation variants resolved during IETF backfill passes.
 
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
