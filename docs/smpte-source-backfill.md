# SMPTE source-reference backfill

**Branch:** `feature/source-smpte-backfill-refs` · **Status:** complete (one-time run)

One-time pass that extracted SMPTE document references from the `_source/SMPTE/`
vendor XML deliveries (`-ref.xml` side-cars) into the registry and Master
Reference Index (MRI). Before this, SMPTE `references` were almost all
hand-curated `source: "manual"` and SMPTE refs had never reached the MRI.

It follows the IETF model: rich raw `<ref>` data lives in the MRI as sightings;
`documents.json` `references[]` holds **resolved short refIds only**. Unresolved
refs go to a report + MRI orphans — never into the registry.

## Outcome

- ~557 SMPTE docs with empty `references` filled.
- ~1,326 of 2,287 source refs resolved to canonical refIds.
- MRI gained SMPTE sightings with full raw `<ref>` XML in `rawVariants`.
- ~961 still unresolved — mostly free-text journal/book titles.

## What to delete later

The backfill is a one-time job — `_source/SMPTE/` is a static legacy archive,
nothing new arrives. Once this branch is merged and the follow-up below lands,
the runner scripts and ad-hoc reports can be pruned.

### Temporary — prune after merge

| File | Role |
|---|---|
| `src/main/scripts/extras/extractSmpteSourceRefs.js` | one-time `-ref.xml` extraction runner |
| `src/main/scripts/extras/resolveSmpteSourceRefs.js` | one-time unresolved-refs resolver pass |
| `src/main/scripts/extras/fixUndatedSourceRefs.js` | one-time fixup — date undated org-lineage refIds |
| `src/main/reports/smpteSourceRefs.standards.txt` | ad-hoc dump used while scanning for refMap/parser additions |

### Keep until the follow-up lands

| File | Why hold it |
|---|---|
| `src/main/reports/smpteSourceRefs.unresolved.json` | authoritative record of the ~961 unresolved refs; feeds the #1108 Gap-journal backfill. Prune once that lands. |

### Permanent — NOT temp, do not delete

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

> Note: `src/main/scripts/extras/inventorySource.smpte.js` is in `extras/` but is
> the **pre-existing** SMPTE audit tool — not part of this backfill. Leave it.

## Follow-ups (out of scope here)

- The ~221 "delta" docs with existing hand-curated `references` — reconcile
  source vs. registry in a later pass.
- Journal-paper resolution: SMPTE journal bibliographic refs (`J. SMPE` +
  volume + pages) → `10.5594-J*` docIds via a volume/page index. High-value
  once the ~20k Gap journal articles are backfilled (#1108).
- The legacy-SMPTE registry-aware resolver could move into
  `lib/referencing.js` / `refMap.json` so all extraction shares it.
