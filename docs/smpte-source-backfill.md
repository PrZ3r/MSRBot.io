# SMPTE source-reference backfill — cleanup checklist

**Branch:** `feature/source-smpte-backfill-refs` · **Status:** complete (one-time project)

One-time project that extracted SMPTE document references from the
`_source/SMPTE/` vendor XML deliveries (`-ref.xml` side-cars) into the registry
and Master Reference Index (MRI). Before this, SMPTE `references` were almost
all hand-curated `source: "manual"` and SMPTE refs had never reached the MRI.

It follows the IETF model: rich raw `<ref>` data lives in the MRI as sightings;
`documents.json` `references[]` holds **resolved short refIds only**. Unresolved
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
- [ ] `src/main/scripts/extras/resolveSmpteSourceRefs.js` — unresolved-refs resolver pass
- [ ] `src/main/scripts/extras/fixUndatedSourceRefs.js` — fixup, dates undated org-lineage refIds
- [ ] `src/main/scripts/extras/inventorySource.smpte.js` — SMPTE source-vs-registry audit tool

Reports / ad-hoc outputs:

- [ ] `src/main/reports/smpteSourceRefs.standards.txt` — dump used while scanning for refMap/parser additions
- [ ] `src/main/reports/smpteSourceRefs.unresolved.json` — record of the ~961 unresolved refs (feeds #1108)
- [ ] `src/main/reports/sourceInventory.smpte.json` — audit-tool output (stale post-backfill)
- [ ] `src/main/reports/sourceInventory.smpte.md` — audit-tool output (stale post-backfill)
- [ ] `src/main/reports/sourceInventory.smpte.schemaMap.md` — audit-tool output (stale post-backfill)

This tracking doc itself:

- [ ] `docs/smpte-source-backfill.md` — delete last, once everything above is gone

> Hold the report files until their follow-ups land: `smpteSourceRefs.unresolved.json`
> feeds the #1108 Gap-journal backfill, and the `sourceInventory.smpte.*` reports
> feed the ~221 delta-docs reconciliation (regenerate them via `inventorySource.smpte.js`
> first — they're stale, generated before 557 docs were filled).

## Permanent — NOT temp, do not delete

These are the actual product of the backfill, not scaffolding:

- `src/main/scripts/utils/extractSourceMetadata.js` — `readRefXml` restructured
  to return per-`<ref>` records.
- `src/main/lib/referencing.js` — new `parseRefId` parser families (ITU, ANSI,
  AES, EBU, CIE, IEEE, ETSI, ARIB, ATSC, TIA, EIA, DVB, CEA, FCC, legacy-SMPTE,
  patents, ISO drafts, FIPS).
- `src/main/input/refMap.json` — ISBN book + one-off entries.
- `src/main/data/documents.json`, `src/main/reports/masterReferenceIndex.json` —
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
