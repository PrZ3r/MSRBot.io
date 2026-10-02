# Reading an MSRBot record

`GET https://msrbot.io/api/doc/{docId}.json` returns:

```json
{
  "$schema": "/api/schemas/documents.schema.json",
  "apiVersion": "1.0.0",
  "lastModified": "2026-06-17T16:55:09.355Z",
  "sourcePath": "src/main/data/docs",
  "docId": "SMPTE.ST2067-21.2020",
  "document": { "...": "..." }
}
```

`lastModified` is the date the record's content last changed, not the build date. Cite it as "Record updated".

## Core fields (`document.*`)

| Field | Meaning |
| --- | --- |
| `docId` | MSRBot's stable identifier. Dated editions end in the year (`.2020`), sometimes with a month (`.2023-09`). Amendments look like `…2020Am1.2020`. |
| `docLabel` | The publisher's human label, e.g. `SMPTE ST 2067-21:2020`. Use it in prose. |
| `docTitle` | Title, always in English. Suite-level titles, where present, are in `docSuiteTitle`. |
| `language`, `docTitleOriginal`, `abstractOriginal` | Non-English documents only: the published language (BCP 47, e.g. `fr`) and the publisher's own title and abstract. No `language` means English. |
| `translatedBy` | `msrbot` means the English `docTitle`/`abstract` are MSRBot.io's translation, not the publisher's wording: cite `docTitleOriginal` as the title and give the English as a translation. `publisher` (or absent) means the English is official. |
| `publisher`, `docType` | e.g. `SMPTE`, `Standard` / `Recommended Practice` / `Engineering Guideline` / `Journal Article`. |
| `docNumber`, `docPart` | Number and part, as separate fields. |
| `publicationDate` | Always a full `YYYY-MM-DD`, but it can be **padded**. When a source gives only a year or month, the missing part is filled with `01`, and `publicationDate$meta.note` says so (e.g. "Month/day absent in source — padded to 01-01", "Day absent … padded to 01"). Check the note before stating a day or month. For a padded date, give only the year (or month and year). |
| `doi`, `href` | Publisher links. Send users here for the actual text. |
| `references.normative[]`, `references.bibliographic[]` | docIds this document cites. |
| `abstract`, `keywords`, `authors` | Present on some records (common for journal articles and RFCs). |

## Status (`document.status`)

| Field | Meaning |
| --- | --- |
| `active` | This edition is in force. |
| `latestVersion` | This is the newest edition in its lineage. |
| `superseded`, `supersededBy[]`, `supersededDate` | Replaced by the listed docId(s) on that date. |
| `withdrawn`, `withdrawnDate` | Withdrawn by the publisher, with no replacement implied. |
| `stabilized` | Kept in force but no longer maintained. |
| `reaffirmed` | Confirmed again without technical change. |
| `amended`, `amendedBy[]`, `amendedDate` | Modified by the listed amendment docId(s). The edition is **still the base document**. |
| `versionless` | The document has no edition years. |

**Finding the current edition:**
1. Start from any edition.
2. While `superseded` is true, fetch `supersededBy[0]`. If there are several successors, report all of them.
3. The edition you stop at is current if `active` is true. Report its `amendedBy[]` too: "current" means the base edition plus its amendments.
4. If `withdrawn` is true and there is no `supersededBy`, say it was withdrawn with no replacement in MSRBot.

Each status field has a sibling `…$meta` (e.g. `supersededBy$meta`) showing whether the value was parsed from the publisher, resolved from release data, or entered manually.

**Worked example (verified 2026-09-28):** `SMPTE.ST2067-21.2020` has `superseded: true`, `supersededBy: ["SMPTE.ST2067-21.2022"]`, `supersededDate: 2022-11-24` and `amendedBy: ["SMPTE.ST2067-21.2020Am1.2020"]`. `SMPTE.ST2067-21.2022` has `active: true`, `latestVersion: true`. So the current edition is ST 2067-21:2022.

## References

- `references.normative` / `references.bibliographic` contain **dated** docIds when the edition is known (e.g. `SMPTE.ST2067-2.2020`). Fetch a record before stating anything about it.
- **Undated references** (e.g. `SMPTE.ST2067-2`) mean "the current edition". Resolve one with `mri-cite-map.json` (`resolvedDocId`), then follow the supersession chain above to confirm what is current now.
- `mri-cite-map.json` entries with `resolvedDocId: null` are references MSRBot knows about but that aren't registry documents. Use the `cite` / `href` it gives, and say the reference isn't a registry document.

## Provenance (`<field>$meta`)

Most fields have a sibling `$meta` object:

```json
"publicationDate$meta": {
  "source": "parsed",
  "confidence": "high",
  "updated": "2025-10-26T21:41:04.646Z",
  "note": "Parsed from HTML pubDateTime meta tag",
  "originalValue": "2020-05-12",
  "overridden": true
}
```

| Key | Meaning |
| --- | --- |
| `source` | `parsed` (extracted from publisher data), `resolved` (computed, e.g. from release tags or redirects), `manual` (curated by hand) |
| `confidence` | `high` / `medium` / `low` |
| `updated` | When this field last changed |
| `sourceUrl` | Where the value was read from, when recorded |
| `originalValue`, `overridden` | An earlier or source value was replaced by this one |
| `version`, `note` | Which extractor produced the value, plus a free-text note |

Mention confidence when a field your answer depends on is `medium` or `low`. `$meta` is stripped from the per-publisher slices, so fetch `/api/doc/{docId}.json` when provenance matters.
