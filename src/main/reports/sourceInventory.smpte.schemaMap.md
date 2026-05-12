# _source/SMPTE → documents.schema mapping & gap analysis

Generated as a companion to [sourceInventory.smpte.md](sourceInventory.smpte.md).
Schema reference: [src/main/schemas/documents.schema.json](../schemas/documents.schema.json) (v2.1.1).

## Scope
This analysis covers what can be extracted from the four XML source formats sitting alongside the PDFs in `_source/SMPTE/`:

1. **SMPTE standard content XML** — e.g. `smptes_st-2036-1-2013_1/st2036-1-2013.xml` (APTARA + HIGHWIRE). Schema ns: `http://www.ieee.org/schema/content_delivery/1.6`.
2. **SMPTE journal-article issue XML** — `<vol>-<issue>-issue-metadata.xml` (Allen Press) plus the per-article fragments extracted by APTARA's `10-5594_J#####.pdf` deliveries.
3. **Reference side-car XML** — `*-ref.xml` files next to both standards and articles. Schema DTD: `reflist-component.dtd`.
4. **Folder / filename identity** — already covered by the first-pass inventory; listed here only for completeness.

All field paths below are the *element path* inside each source XML.

---

## 1. SMPTE standard content XML (`standard_metadata` + `standard_issue` + `standard_article`)

### Maps cleanly to existing schema fields

| Source path | Schema field | Notes / transform |
|---|---|---|
| `standard_metadata/normalized_title` (e.g. *"SMPTE ST 2036-1:2013"*) | `docLabel` | direct |
| `standard_metadata/standard_type@type` + `standard_subtype@type` | `docType` | table map (`Standard Docs`+`SMPTE Standard` → *Standard*, `Recommended Practice Docs` → *Recommended Practice*, etc.) |
| `standard_metadata/publisher/publisher_name` | `publisher` | direct ("SMPTE") |
| `standard_metadata/sponsor/committee` (e.g. *"10E - Technology Committee on Essence"*) | `group` | needs normalization to existing format (e.g. `smpte-10e-st`) |
| `standard_metadata/isbn@type=electronic` | `isbn` | direct |
| `standard_metadata/pubtopicalbrowse/topic` + `standardtopicset/standard_topic` | `keywords` | merge arrays, Title Case per repo convention |
| `standard_metadata/standard_status@status` + `standard_modifier@type` | `status.superseded`, `status.withdrawn`, `status.active` | map: `inactive`+`Superseded` → `superseded: true, active: false`; `inactive`+`Withdrawn` → `withdrawn: true` |
| `standard_metadata/standard_relationship@type="S"` + `@relationship_date` | `status.supersededDate`, `status.supersededBy` | relationship_date → supersededDate; inner text DOI lookup → supersededBy |
| `standard_issue/publication_date/{day,month,year}` | `publicationDate` | compose ISO `YYYY-MM-DD` |
| `standard_article/title` | `docTitle` | direct (decode HTML entities) |
| `standard_article/pages/{first_page,last_page}` | `pages` | format as `"1–9"` (schema takes string) |
| `standard_article/abstract` | `abstract` | strip inline HTML, join paragraphs |
| `standard_article/references` (if inline) | `references.normative` / `references.bibliographic` | parse; see §3 |
| `standard_metadata/root_title` (e.g. *"Ultra High Definition Television"*) | `docSuite` | direct — family-level title |
| `standard_metadata/root` + `family` | `docNumber` + `docPart` | confirm against filename-derived values |

### Fields with **no existing schema home** (gaps — candidate additions)

| Source path | Proposed schema field | Example value | Rationale |
|---|---|---|---|
| `standard_metadata/standard_id` | `standardId` (string) | `"20540"` | Internal SMPTE asset id; useful for cross-ref to IEEE Xplore deposits |
| `standard_metadata/product_number@type=electronic` | `productNumber` (string) | `"SSD001741"` | SMPTE electronic product code |
| `standard_metadata/family` | `familyId` (string) | `"2036-1"` | Family grouping distinct from docNumber+docPart when the family spans parts |
| `standard_metadata/approval_date` | `approvalDate` (date) | `"2013-05-09"` | Distinct from `publicationDate` — approval often predates publication by weeks/months |
| `standard_metadata/copyright/{copyright_holder,year}` | `copyright` (object `{holder, year}`) | `{holder: "SMPTE, Inc.", year: "2013"}` | Non-obvious attribution (some standards' holders differ from publisher) |
| `standard_metadata/publisher/publisher_location/{city,country}` | `publisherLocation` (object `{city, country}`) | `{city:"White Plains, NY", country:"USA"}` | Useful for international citation formats |
| `standard_metadata/ICS_codes/code_term[@codenum,text]` | `icsCodes` (array of `{code, description}`) | `[{code:"33.160.01", description:"Audio, video and audiovisual systems in general"}]` | ISO ICS classification — enables cross-org topic search |
| `standard_article/file` | (metadata-only; carry as `$meta.sourceFile` instead of new field) | `"st2036-1-2013.pdf"` | No schema change needed — attach via companion `$meta` |
| `standard_article/label` + `standard_article/index_terms/term` | `keywords` (merge in) | section terms | Already fits existing `keywords` |

---

## 2. Journal-article issue XML (Allen Press / APTARA)

### Maps cleanly

| Source path | Schema field | Notes |
|---|---|---|
| `journal_metadata/full_title` (e.g. *"SMPTE Motion Imaging Journal"*) | `docSuite` | journal title serves as suite |
| `journal_metadata/issn@type=paper` | `issn` | current schema takes one string — see gap below |
| `journal_metadata/publisher_name` | `publisher` | direct |
| `journal_issue/publication_date/{month,year}` | `publicationDate` | compose `YYYY-MM-01` (no day in source) |
| `journal_volume/volume` | `volume` | direct |
| `journal_volume/issue` | `number` | schema has `number` — use this for issue |
| `journal_article/title` | `docTitle` | direct |
| `journal_article/contributors/author/person_name/{given_name,surname}` | `authors` | concat as `"Given Surname"` per entry (schema takes string[]) |
| `journal_article/pages/{first_page,last_page}` | `pages` | format `"3–3"` |
| `journal_article/doi` | `doi` | direct (docId already derived per first-pass rule) |
| `journal_article/major_topic` + `minor_topic` | `keywords` | merge; these are single strings per article |
| `journal_article/article_status` (`active` / `inactive`) | `status.active` | `active → true`, `inactive → false` |
| `journal_article/abstract` (when present) | `abstract` | direct |
| `journal_article/references` (inline) | `references.bibliographic` | parse; see §3 |

### Fields with no existing schema home (gaps)

| Source path | Proposed schema field | Example | Rationale |
|---|---|---|---|
| `journal_metadata/abbrev_title` | `abbrevTitle` (string) | `"SMPTE Mot. Imag J."` | Standard NLM-style short form, used in citations |
| `journal_metadata/journal_acronym` | `journalAcronym` (string) | `"MIJR"` | Publisher-internal short code |
| `journal_metadata/issn@type=electronic` | **Restructure `issn`** → `{print, electronic}` OR add `issnElectronic` | `"2160-2492"` | Schema currently has a single `issn` string — journals regularly have both print and electronic ISSNs |
| `journal_metadata/copyright/{copyright_holder,year}` | `copyright` (shared with §1) | | Same as §1 |
| `journal_metadata/publisher_location/{city,country}` | `publisherLocation` (shared) | | Same as §1 |
| `journal_volume/issue_pdf` | (optional) `issuePdfFilename` | `"mijr-124-01-completeissue.pdf"` | Minor — useful for linking to the full-issue package |
| `journal_article/pubitype@type` | `articleType` (string) | `"info-society"`, `"article"`, `"review"` | NISO-style article-type classification — not the same as `docType` |
| `journal_article/article_sequence` | (optional) `articleSequence` (integer) | `5` | Within-issue ordering; low-value, skip unless wanted |
| `journal_article/cover_image` | (optional) `coverImage` (string) | `"mijr-124-01-cov.jpg"` | Minor |
| `journal_article/reference_flag` | *(derive from refs length, don't add)* | `"Y"` / `"N"` | Redundant once references are extracted |
| `journal_article/file` | *($meta.sourceFile)* | `"mijr-124-01-3.pdf"` | Carry as companion meta |

---

## 3. Reference side-car XML (`*-ref.xml` for both standards and articles)

The current schema allows `references.normative[]` and `references.bibliographic[]` as arrays of plain strings.

| Source path | Schema field | Notes |
|---|---|---|
| `component/reflist/ref[id^="ref-norm-"]` | `references.normative[]` | each ref → a citation string built from `standardnum` / `ref_pubtitle`, with `objidref@objidreftype=doi` parsed via [src/main/lib/referencing.js](../../lib/referencing.js) `parseRefId` to produce a canonical docId when possible |
| `component/reflist/ref[id^="ref-bib-"]` | `references.bibliographic[]` | same, but bibliographic bucket |
| `ref/standard` (status, medium, ref_pubtitle, standardnum) | element text | structured citation |
| `ref/periodical` (ref_articletitle, ref_pubtitle, pageinfo, date) | element text | journal article citation |
| `ref/other` (chaptertitle, publishername, date) | element text | book / misc citation |
| `ref/ref_authorgrp/ref_author/{init,ref_surname}` | embedded in citation | `"C. Clos"` style |

### Schema consideration

Current string-array shape preserves the citation but loses structured author/title/doi fields. **Recommendation:** keep `references.normative/bibliographic` as string arrays (existing MRI tooling expects this) and rely on `parseRefId` to surface the resolved docId during the `buildMasterReferenceIndex` step. Do **not** restructure `references` in the schema for this pass.

---

## 4. Proposed schema additions (consolidated)

Minimum viable additions to cover the clean-map gaps above without churning existing consumers:

```json
{
  "standardId":       { "type": "string" },
  "productNumber":    { "type": "string" },
  "familyId":         { "type": "string" },
  "approvalDate":     { "type": "string", "format": "date" },
  "abbrevTitle":      { "type": "string" },
  "journalAcronym":   { "type": "string" },
  "articleType":      { "type": "string" },
  "issn":             {
    "oneOf": [
      { "type": "string" },
      { "type": "object",
        "properties": {
          "print":      { "type": "string" },
          "electronic": { "type": "string" }
        },
        "additionalProperties": false }
    ]
  },
  "copyright": {
    "type": "object",
    "properties": {
      "holder": { "type": "string" },
      "year":   { "type": "string" }
    },
    "additionalProperties": false
  },
  "publisherLocation": {
    "type": "object",
    "properties": {
      "city":    { "type": "string" },
      "country": { "type": "string" }
    },
    "additionalProperties": false
  },
  "icsCodes": {
    "type": "array",
    "items": {
      "type": "object",
      "required": ["code"],
      "properties": {
        "code":        { "type": "string" },
        "description": { "type": "string" }
      },
      "additionalProperties": false
    }
  }
}
```

Each new field gets a companion `<field>$meta` per the existing pattern (source/confidence/note/updated).

Fields **not** worth adding (captured elsewhere or low value):
- `ieee_acronym` — always `"SMPTE-Std"`, no signal.
- `standard_number` / `full_title` — redundant with `docLabel`.
- `reference_flag` — derivable from `references.bibliographic.length > 0`.
- `article_sequence`, `issue_pdf`, `cover_image`, `file` — carry as companion `$meta` if needed rather than first-class.

---

## 5. Normalization tables needed

### docType mapping (`standard_type@type` + `standard_subtype@type` → schema enum)

| source | schema docType |
|---|---|
| `Standard Docs` + `SMPTE Standard` | `Standard` |
| `Recommended Practice Docs` + `SMPTE Recommended Practice` | `Recommended Practice` |
| `Engineering Guideline Docs` + `SMPTE Engineering Guideline` | `Engineering Guideline` |
| `Registered Disclosure Doc Docs` + `SMPTE Registered Disclosure Doc` | `Registered Disclosure Document` |
| `Technical Specification Docs` + `SMPTE Technical Specification` | `Technical Specification` (add to enum — currently missing) |
| `Administrative Guideline Docs` + `SMPTE Administrative Guideline` | `Administrative Guideline` |
| `Operations Manual` / `OM` | `Operations Manual` |

**Enum gap:** `Technical Specification` is present in SMPTE source but not in the current `docType` enum. Add it.

### Group format normalization

Source: `"10E - Technology Committee on Essence"` (free-form)
Registry: `"smpte-10e-st"` (slug)

Need a lookup table `committee_code → slug`. Sample: `"10E" → "smpte-10e-st"`, `"35PM" → "smpte-35pm-st"`, etc. Committee slug list already implied by existing registry entries — scrape via a one-time map build.

### Status modifier mapping

| source `standard_modifier@type` | schema `status` field(s) |
|---|---|
| `Superseded` | `superseded: true`, `active: false` |
| `Withdrawn` | `withdrawn: true`, `active: false` |
| `Stabilized` | `stabilized: true` |
| `Reaffirmed` | `reaffirmed: true` |
| `Amended` | `amended: true` |

---

## 6. What this changes for the inventory report

Rerunning the inventory with XML-enrichment will move most of the **20,211 gap candidates** from sparse (docId/doi/docType/publisher only) to fully populated — each gap entry will carry title, abstract, publicationDate, keywords, group, status, pages, and (where available) references. It will also move the **3 update candidates** to likely hundreds or thousands: every registry entry whose matching source XML has an abstract, keywords, or status info that the registry currently lacks becomes a fillable update.

## 7. Next-step recommendations

1. **Extend the schema** with the §4 additions + `Technical Specification` docType enum.
2. **Extend the inventory script** with an `--enrich` pass: when a recorded docId has a sibling `<stem>.xml` (for standards) or is referenced in a sibling `*-issue-metadata.xml` (for journals), parse and merge the mapped fields into `gap[].candidateRecord` / `update[].fillableFields`.
3. **Build the committee-slug lookup** from the existing registry before the enrichment pass, to emit normalized `group` values from day one.
4. **Reference resolution** — invoke `parseRefId` from [referencing.js](../../lib/referencing.js) on each `standardnum` / `objidref@doi` so `references.normative` / `references.bibliographic` come out as resolved docIds where possible.

Steps 1 and 2 can ship together in the next PR. Step 3 is a dependency of step 2 for clean `group` values; step 4 can follow in a separate pass since it touches MRI logic.
