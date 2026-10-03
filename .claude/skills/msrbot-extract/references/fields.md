# Fields and provenance

The worked example is `src/main/data/docs/cst/recommendation/CST.RT028.2026.json`.

## `$meta` per field

You don't write `$meta` yourself: `extract-manual` builds it from the record. Set the record's `sourceUrl` (usually the PDF), then per-field hints:

```json
"metaSources":    { "docTitle": "inferred", "docId": "inferred", "status.active": "inferred" },
"metaSourceUrls": { "href": "<listing page>", "publicationDate": "<announcement>" },
"metaNotes":      { "publicationDate": "Announcement datePublished; PDF says …" },
"metaFlags":      { "docTitle": { "reviewRequired": true } }
```

Fields not named are `parsed` from `sourceUrl`. The table says which source to use:

| Field | Usually | source | confidence | sourceUrl |
|---|---|---|---|---|
| `docLabel` | Reference exactly as printed on the cover (`CST-RT-028-2026`) | parsed | high | PDF |
| `docTitle` | English title. If the original is English: parsed. If translated: inferred + `note` + `reviewRequired: true` | parsed / inferred | high / medium | PDF |
| `docTitleOriginal` | Non-English only. Cover title in sentence case, wording unchanged | parsed | high | PDF |
| `abstract` | English scope/purpose text. Translated → inferred + note + reviewRequired | parsed / inferred | high / medium | PDF |
| `abstractOriginal` | Non-English only. The scope/"Objet" section verbatim (fix hyphenation from line breaks; note any dropped footnote markers) | parsed | high | PDF |
| `language` | BCP 47 (`fr`); omit for English | parsed | high | PDF |
| `translatedBy` | `msrbot` when the English is ours; `contributor` when it is an outside contributor's translation; `publisher` when an official English edition exists | inferred | high | — |
| `hrefAlternates` | Other language editions of the **same** document: `[{ "language": "fr", "href": "<PDF>" }]`, plus `"translatedBy": "contributor"` on an edition an outside contributor translated (absent = publisher; category only, no translator names). `href` is the primary link, the English edition when one exists. With an official English edition, English title/abstract come from it (`parsed`, no `reviewRequired`). The `href` edition's language is never stated: English with `translatedBy: "publisher"`, else `language` (English if absent) | parsed | high | listing page |
| `docNumber`, `docPart` | As printed (`028`) | parsed | high | PDF |
| `docType` | From the schema enum, matching how the publisher names it (Recommendation, Standard, Specification, Guideline…) | parsed | high | listing page |
| `publisher` | Registry publisher string (`CST`); must match `site.json` keys | parsed | high | listing page |
| `publicationDate` | Always a full `YYYY-MM-DD` (the schema requires it). Printed date first; else announcement `datePublished`. If only a year or month is known, pad it (`2007-01-01`) and note "Month/day absent in source — padded to 01-01" (registry convention). Explain the source in `note` | parsed | high / medium | PDF or announcement |
| `href` | Direct PDF/download URL from the publisher | parsed | high | listing page |
| `docId` | See below | inferred | medium | — |
| `details` | Your short English summary | inferred | medium | PDF |
| `keywords` | Only values in `site.json` `controlledKeywords` (validate fails otherwise). Reuse common ones (`DCinema`, `Subtitles`, `Cinema Sound`…) | inferred | medium | — |
| `group` | Authoring committee/department if printed and the registry has a group for it; otherwise put it in `details` | parsed | high | PDF |
| `status.active`, `status.latestVersion` | `true` for the current edition on the publisher's list | inferred | medium | listing page |
| `references.normative` / `.bibliographic` | See `mri.md` | parsed | high | PDF |

Leave out anything you don't have. Don't copy empty template fields.

## docId

- Pattern: `<PUBLISHER>.<designator>.<date>`; date suffix last (`.2026`, `.2025-06`). Examples: `EBU.R128.2020`, `ISDCF.D02.2011`, `CST.RT028.2026`, `SMPTE.ST428-7.2014`.
- Hyphens inside the designator mean *part* (`ST428-7`), so drop publisher hyphens that aren't parts (`RT-028` → `RT028`). Keep leading zeros the publisher uses.
- Undated documents: no date suffix. Never use a bare 4-digit number as the last segment unless it really is a year — `ISO.8567` style ids are document numbers.
- Check uniqueness: `find src/main/data/docs -name '<docId>.json'`.
- The file path is derived from publisher/docType/docId by `new-doc` and `canonicalize`; don't hand-place files.

## Translation style

- Faithful, plain English; keep the publisher's structure (dashes between title parts).
- Keep standard names and quotes as written (`ISO 26428-7 "DCDM Part 7 – Subtitle"`); quote marks « » become " ".
- Don't expand or "improve" the content. If a term is ambiguous (e.g. PAD = prêt-à-diffuser, "ready-to-broadcast"), translate it once and keep the acronym.

## Publisher setup (first document only)

`site.json` needs the publisher in three maps: abbreviation (full name → short), logo (`resources/logos/<file>`), and link (homepage). Ask the user for the logo file; don't scrape one.
