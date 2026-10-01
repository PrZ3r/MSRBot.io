# Manual extraction (`npm run extract-manual`)

For publishers without an extractor (CST, small consortia, one-off specifications), a person or an AI agent reads the publisher's site and PDFs and writes a **records file**. `extract-manual` then runs those records through the same `extractDocs.js` pipeline the SMPTE and IETF extractors use. The pipeline handles everything after the reading:

- reference parsing (`parseRefId`: `refMap.json`, then the publisher families);
- MRI sightings, and orphan slugs for citations it can't parse;
- `$meta` provenance and URL resolution;
- merging with existing records, re-homing per-doc files, the PR log and the MRI flush.

This is the **preferred way to add documents by hand, and the required way for AI tools.** Hand-editing per-doc files and running `canonicalize` still works for small corrections. But new documents should go through `extract-manual`, so they get exactly the same reference handling, provenance and validation as everything else. That way nothing behaves unexpectedly when it reaches a PR.

AI agents: in Claude Code, the project skill `.claude/skills/msrbot-extract/` walks through the whole workflow. Other tools should follow the steps below.

## Workflow

1. **Scope:**
   - List the documents wanted and check what's already in `src/main/data/docs/`.
   - A new publisher needs:
     - keying in `src/main/lib/keying.js`;
     - a `parseRefId` family, if other documents cite it;
     - `site.json` abbreviation, logo and link.
2. **Read:** for each document, the cover, the dates, the scope section and the references section, word for word.
3. **Write the records file** (format below).
4. **Preview the reference mapping.** Fix parser misses in the shared tooling, not in the records:
   - a `referencing.js` family plus tests, for a recurring pattern;
   - a `refMap.json` entry, for a one-off;
   - then a whole-corpus parse diff;
   - shipped as a tooling PR first.
5. **Review:** the person requesting the extraction checks every judgment call: labels, dates, titles, translations, dropped citations, explicit refIds, and what each reference resolves to.
6. **Run:**
   ```bash
   npm run extract-manual -- --input path/to/records.json
   npm run canonicalize && npm run validate
   npm run validate-mri-coverage
   npm run build        # then look at build/docs/<docId>/index.html
   ```
7. **PR:**
   - data (docs + MRI) in its own commit, separate from tooling;
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

- **Document fields:** any field in `src/main/schemas/documents.schema.json`. `docId`, `docLabel`, `docTitle`, `docType` and `publisher` are required. Leave out anything you don't have; never add empty placeholders.
- **`sourceUrl`:** where the record was read from, usually the PDF. It becomes each field's `$meta.sourceUrl` unless `metaSourceUrls` overrides it.
- **`metaSources`:** the provenance source for each field.
  - Fields not listed are `parsed`, meaning read from the publisher.
  - Use `inferred` for derived values: translations, summaries, docIds built from conventions, and status.
  - Use `manual` for a value a person decided.
  - Status fields use `"status.<field>"` keys.
- **`metaNotes` / `metaFlags`:** per-field `$meta.note`, and `{ reviewRequired, flag }`. A `reviewRequired` field drops to medium confidence.
- **`citations`:** each citation's text exactly as printed, never a cleaned-up identifier.
  - The parser maps them. Citations it can't map become orphan slugs that keep the text.
  - `refId` is only for a documented judgment call. It's recorded as `mapSource: manual:explicit` and must appear in the review.
- **Existing documents:** a record whose `docId` already exists updates that document through the pipeline's normal update path. Changed fields get `originalValue` and `overridden` in their `$meta`.

Provenance describes method, not tool: never name the person or AI that did the reading. See `CONTRIBUTING.md` › Data and Provenance.
