# SMPTE source-reference backfill — cleanup checklist

**Branch:** `feature/source-smpte-backfill-refs` · **Status:** complete (one-time project)

One-time project that extracted SMPTE document references from the
`_source/SMPTE/` vendor XML deliveries (`-ref.xml` side-cars) into the registry
and Master Reference Index (MRI). Before this, SMPTE `references` were almost
all hand-curated `source: "manual"` and SMPTE refs had never reached the MRI.

It follows the IETF model: rich raw `<ref>` data lives in the MRI as sightings;
the registry's `references[]` holds **resolved short refIds only**. Unresolved
refs go to a report + MRI orphans — never into the registry.

## Outcome

- ~557 SMPTE docs with empty `references` filled.
- ~1,326 of 2,287 source refs resolved to canonical refIds.
- MRI gained SMPTE sightings with full raw `<ref>` XML in `rawVariants`.
- ~961 still unresolved — mostly free-text journal/book titles.

## Cleanup checklist — delete when the project fully wraps

Everything below is one-time scaffolding for this project. `_source/SMPTE/` is a
static legacy archive — nothing new arrives, so none of it runs again. Delete
the lot once this branch is merged and the follow-ups below have landed.

Scripts (one-time runners + the audit tool, all built for this project):

- [ ] `src/main/scripts/extras/extractSmpteSourceRefs.js` — `-ref.xml` extraction runner
- [ ] `src/main/scripts/extras/extractSmpteJournalArticles.js` — NLM journal-article + conference-paper backfill runner
- [ ] `src/main/scripts/extras/extractSmpteJournalIssues.js` — APTARA/Allen Press journal_metadata coverage + cross-fill runner
- [ ] `src/main/scripts/extras/resolveSmpteSourceRefs.js` — unresolved-refs resolver pass
- [ ] `src/main/scripts/extras/fixUndatedSourceRefs.js` — fixup, dates undated org-lineage refIds
- [ ] `src/main/scripts/extras/inventorySource.smpte.js` — SMPTE source-vs-registry audit tool
- [ ] `src/main/scripts/extras/fixLowercaseSmpteDocIds.js` — APTARA lowercase-j docId cleanup (rename + collider delete)
- [ ] `src/main/scripts/extras/crossfillSmpteFromZoho.js` — per-field Zoho cross-fill runner (`--field <name>`)
- [ ] `src/main/scripts/extras/dedupIcsCodes.js` — collapse duplicate `icsCodes` entries from APTARA artifacts
- [ ] `src/main/scripts/extras/importSmpteFromZoho.js` — wholesale-import individual Zoho records (`--docs <id1,id2,…>`)
- [ ] `src/main/scripts/extras/fixSmpteDoubleSmpteDoi.js` — bad-DOI registration fixes (6 patterns: double-SMPTE, separator drift, manual registrar errors, month-strip, library release-tag, year-mismatch) + extra-field cascades
- [ ] `src/main/scripts/extras/fixMissingNestedMeta.js` — backfill missing top-level `$meta` for nested non-container objects (copyright, issn, publisherLocation) where sub-fields exist but parent `$meta` was missed

Reports / ad-hoc outputs:

- [ ] `src/main/reports/smpteSourceRefs.standards.txt` — dump used while scanning for refMap/parser additions
- [ ] `src/main/reports/smpteSourceRefs.unresolved.json` — record of the ~961 unresolved refs (feeds #1108)
- [ ] `src/main/reports/sourceInventory.smpte.json` — audit-tool output (stale post-backfill)
- [ ] `src/main/reports/sourceInventory.smpte.md` — audit-tool output (stale post-backfill)
- [ ] `src/main/reports/sourceInventory.smpte.schemaMap.md` — audit-tool output (stale post-backfill)
- [ ] `src/main/reports/smpteJournalImport.json` — journal-backfill runner output
- [ ] `src/main/reports/smpteJournalImport.md` — journal-backfill runner output
- [ ] `src/main/reports/smpteJournalIssueImport.json` — journal-issue (APTARA) runner output
- [ ] `src/main/reports/smpteJournalIssueImport.md` — journal-issue (APTARA) runner output
- [ ] `src/main/reports/zohoCrossfill.{field}.md` — per-field Zoho cross-fill conflict reports (one per `--field` run: isbn, copyright_year, productNumber, numberOfPages, status_reaffirmDate, status_stabilizedDate, approvalDate, icsCodes, status_superseded, status_withdrawn, docTitle)
- [ ] `src/main/reports/zohoCoverage.newDocs.md` — Zoho coverage categorisation (junk / punct-only / doi-match / new-edition / brand-new buckets)
- [ ] `src/main/reports/zohoCoverage.newEditions.md` — Zoho new-editions breakdown with year-delta + sibling DOIs

This tracking doc itself:

- [ ] `docs/smpte-source-backfill.md` — delete last, once everything above is gone

> Hold the report files until their follow-ups land: `smpteSourceRefs.unresolved.json`
> feeds the #1108 Gap-journal backfill, and the `sourceInventory.smpte.*` reports
> feed the ~221 delta-docs reconciliation (regenerate them via `inventorySource.smpte.js`
> first — they're stale, generated before 557 docs were filled).

## Permanent — NOT temp, do not delete

These are the actual product of the backfill, not scaffolding:

- `src/main/scripts/utils/extractSourceMetadata.js` — `readRefXml` restructured
  to return per-`<ref>` records; `readNlmArticleXml` added for the HIGHWIRE
  NLM journal-article corpus.
- `src/main/lib/referencing.js` — new `parseRefId` parser families (ITU, ANSI,
  AES, EBU, CIE, IEEE, ETSI, ARIB, ATSC, TIA, EIA, DVB, CEA, FCC, legacy-SMPTE,
  patents, ISO drafts, FIPS).
- `src/main/input/refMap.json` — ISBN book + one-off entries.
- `src/main/data/docs/`, `src/main/reports/masterReferenceIndex.json` —
  the registry and MRI (the output).
- `src/site/js/refTree.js`, `src/main/templates/refTree.hbs` — refTree dedup +
  depth-cap fix shipped alongside.

## Follow-ups (out of scope here)

- The ~221 "delta" docs with existing hand-curated `references` — reconcile
  source vs. registry in a later pass (uses `inventorySource.smpte.js`).
- Journal-paper resolution: SMPTE journal bibliographic refs (`J. SMPE` +
  volume + pages) → `10.5594-J*` docIds via a volume/page index. High-value
  once the ~20k Gap journal articles are backfilled (#1108).
- The legacy-SMPTE registry-aware resolver could move into
  `lib/referencing.js` / `refMap.json` so all extraction shares it.
