# Manual extraction (`npm run extract-manual`)

For publishers without an extractor (CST, small consortia, one-off specifications), a person or an AI agent reads the publisher's site and PDFs and writes a **records file**. `extract-manual` then runs those records through the same `extractDocs.js` pipeline the SMPTE and IETF extractors use. The pipeline handles everything after the reading:

- reference parsing (`parseRefId`: `refMap.json`, then the publisher families);
- MRI sightings, and orphan slugs for citations it can't parse;
- `$meta` provenance and URL resolution;
- merging with existing records, re-homing per-doc files, the PR log and the MRI flush.

This is the **preferred way to add documents by hand, and the required way for AI tools.** Hand-editing per-doc files and running `canonicalize` still works for small corrections. But new documents should go through `extract-manual`, so they get exactly the same reference handling, provenance and validation as everything else. That way nothing behaves unexpectedly when it reaches a PR.

AI agents: in Claude Code, the project skill `.claude/skills/msrbot-extract/` walks through the whole workflow. Other tools should follow the steps below.

## When to use it, and when not

- **It is a first pass, never the final word.** Whatever the extraction produces, especially when an AI did the reading, a person must verify it by hand against the publisher's sources before it merges. That means:
  - before running: every field, date, title and translation, and every citation's mapping, checked in the review step;
  - after running: the built doc pages.

  Unverified AI-read values don't go into the registry.
- **Small jobs may be quicker by hand.** For one or two documents with few citations, scaffolding with `npm run new-doc`, editing the per-doc files and running `npm run canonicalize` / `npm run validate` can be simpler. If an AI tool is doing the work, though, use `extract-manual`, so the shared tooling runs.
- **Sources that change over time need a real extractor.** If the publisher issues new editions or revisions, withdraws documents, or is something we'd want to re-check regularly, write a provider in `src/main/scripts/providers/` with a scheduled workflow, as for SMPTE and IETF. A manual extraction is a one-time snapshot: it won't notice later editions, supersessions or withdrawals.

## Workflow

1. **Scope:**
   - List the documents wanted and check what's already in `src/main/data/docs/`.
   - A new publisher needs:
     - keying in `src/main/lib/keying.js`;
     - a `parseRefId` family, if other documents cite it;
     - `site.json` abbreviation, logo and link.
2. **Read** each document's cover or title block, dates, scope section and references section, word for word. How depends on what you were pointed at:

   | Source you were pointed at | What to read | `sourceUrl` / `href` | Dates and references |
   |---|---|---|---|
   | **Listing page linking PDFs** (CST's recommendations page) | The whole page, then each linked PDF | `sourceUrl` = the PDF. `href` = the PDF link. `href`, `publisher` and `docType` come from the listing page, so put that URL in `metaSourceUrls` | Printed in the PDF. News items and posts on the page can supply a missing day (`datePublished`) |
   | **One document landing page** (an HTML page with metadata plus a PDF or HTML link) | The page, its metadata (`<meta>`, JSON-LD, `og:`/`article:` tags) and the linked document | `sourceUrl` = the landing page for fields read there, and the document URL for fields read from the document. `href` = the document, or the landing page if that is the canonical place to get it | Prefer the document; the page's structured metadata comes next |
   | **Direct PDF URL** | The PDF only. Ask the user for the publisher's page if one exists | `sourceUrl` = `href` = the PDF | From the PDF. If none is printed, the PDF's `CreationDate` is **not** a publication date: leave the date out or ask |
   | **Document published as HTML** (a spec page with no PDF) | The page itself: title block, status or version, scope, references section | `sourceUrl` = `href` = the page | Dates from the page's title block or metadata. Citations from the page's own references section. When a cited item is a hyperlink, copy that URL into the same citation's `href`, next to its `cite` text |
   
   Mixed cases (several PDFs per document, language editions, annexes, consultation drafts, near-duplicate titles) are judgment calls: flag them before writing records.

3. **Write the records file** (format below).
4. **Preview the reference mapping.** Fix parser misses in the shared tooling, not in the records:
   - a `referencing.js` family plus tests, for a recurring pattern;
   - a `refMap.json` entry, for a one-off;
   - then a whole-corpus parse diff;
   - shipped as a separate tooling PR first. Repository maintainers may combine tooling and data in one PR, as separate commits.
5. **Review:** the person requesting the extraction checks every judgment call: labels, dates, titles, translations, dropped citations, explicit refIds, and what each reference resolves to.
6. **Run:**
   ```bash
   npm run extract-manual -- --input path/to/records.json
   npm run canonicalize && npm run validate
   npm run validate-mri-coverage
   npm run build        # then look at build/docs/<docId>/index.html
   ```
7. **PR:**
   - data (docs + MRI) in its own PR, separate from any tooling changes from your findings (maintainers: its own commit is enough);
   - use the PR template;
   - include a provenance table and a citation mapping table.

## Records file

```json
{
  "records": [
    {
      "docId": "CST.RT028.2026",
      "docLabel": "CST-RT-028-2026",
      "docTitle": "Digital Projection – Subtitles – Characteristics, Dimensions and Positioning",
      "docTitleOriginal": "Projection numérique – Sous-titres – Caractéristiques, dimensions et positionnement",
      "abstract": "The purpose of this technical recommendation is …",
      "abstractOriginal": "La présente recommandation technique a pour objet …",
      "language": "fr",
      "translatedBy": "msrbot",
      "docType": "Recommendation",
      "publisher": "CST",
      "docNumber": "028",
      "publicationDate": "2026-09-18",
      "href": "https://cst.fr/download/33/recommandations-techniques/1004/cst-rt-028.pdf",
      "details": "French-language technical recommendation …",
      "keywords": ["DCinema", "Subtitles"],
      "status": { "active": true, "latestVersion": true },

      "sourceUrl": "https://cst.fr/download/33/recommandations-techniques/1004/cst-rt-028.pdf",
      "metaSources": { "docId": "inferred", "docTitle": "inferred", "abstract": "inferred", "translatedBy": "inferred", "details": "inferred", "keywords": "inferred", "status.active": "inferred", "status.latestVersion": "inferred" },
      "metaSourceUrls": { "href": "https://cst.fr/recommandations-techniques-cst/", "publicationDate": "https://cst.fr/reco-tech-revision-sous-titres/" },
      "metaNotes": { "docTitle": "English translation of the publisher's French text", "publicationDate": "Announcement datePublished; PDF: \"Publiée septembre 2026\"" },
      "metaFlags": { "docTitle": { "reviewRequired": true }, "abstract": { "reviewRequired": true } },

      "citations": {
        "normative": [
          { "cite": "La norme AFNOR NF S27-100 - Cinématographie - Salles de projection électronique de type cinéma numérique" },
          { "cite": "SMPTE ST 428-7:2014 Digital Cinema Distribution Master – Subtitle" },
          { "cite": "Subtitle Specification for Projection Technology DLP Cinema - TEXAS INSTRUMENTS INCORPORATED", "refId": "TI.DLP-CCC.1.1-rC.2005" }
        ],
        "bibliographic": []
      }
    }
  ]
}
```

- **Document fields:** any field in `src/main/schemas/documents.schema.json`. `publicationDate` must be a full `YYYY-MM-DD`; if only the year or month is known, pad it (`2007-01-01`) and say so in `metaNotes.publicationDate` ("Month/day absent in source — padded to 01-01"). `docId`, `docLabel`, `docTitle`, `docType` and `publisher` are required. Leave out anything you don't have; never add empty placeholders.
- **Several language editions:** one record. `href` is the primary link (the **English** edition when one exists); list the others in `hrefAlternates: [{ "language": "fr", "href": "…" }]`. An edition translated by an outside contributor, not the publisher, adds `"translatedBy": "contributor"` to its entry. With an official English edition, set `translatedBy: "publisher"` and read `docTitle`/`abstract` from it (they're `parsed`); the originals come from the original-language edition. No field states the `href` edition's language; it is derived: English when `translatedBy` is `"publisher"`, otherwise `language` (English when absent). The page lists every edition language from that plus `hrefAlternates`, so English appears only when an English edition exists.
- **`sourceUrl`:** where the record was read from, usually the PDF. It becomes each field's `$meta.sourceUrl` unless `metaSourceUrls` overrides it.
- **`metaSources`:** the provenance source for each field.
  - Fields not listed are `parsed`, meaning read from the publisher.
  - Use `inferred` for derived values: translations, summaries, docIds built from conventions, and status.
  - Use `manual` for a value a person decided.
  - Status fields use `"status.<field>"` keys.
- **`metaNotes` / `metaFlags`:** per-field `$meta.note`, and `{ reviewRequired, flag }`. A `reviewRequired` field drops to medium confidence.
- **`citations`:** one entry per item in the document's own references section.
  - `cite` is the text exactly as printed, never a cleaned-up identifier.
  - `href` is optional: the URL when that reference is a hyperlink, usually in HTML documents. `parseRefId` reads it alongside the text, and an unmapped citation renders as a clickable external link.
  - The parser maps them. Citations it can't map become orphan slugs that keep the text.
  - `refId` is only for a documented judgment call. It's recorded as `mapSource: manual:explicit` and must appear in the review.
- **Existing documents:** a record whose `docId` already exists updates that document through the pipeline's normal update path. Changed fields get `originalValue` and `overridden` in their `$meta`.

Provenance describes method, not tool: never name the person or AI that did the reading. See `CONTRIBUTING.md` › Data and Provenance.
