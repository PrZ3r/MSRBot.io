# FTXML reference catalog — canonical-audit todo #1

> Generated at: 2026-07-10T01:13:10.167Z
> Mode: **read-only catalog** (no registry / MRI writes)

## Corpus
| corpus | FTXML files | w/ article DOI | empty DOI | source in registry | files w/ refs | total refs | refs w/ DOI | ref-DOI target in registry | refs already in MRI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| journal | 213 | 211 | 2 | 0 | 97 | 1943 | 95 | 19 | 0 |
| conference | 76 | 0 | 76 | 0 | 71 | 1052 | 56 | 11 | 0 |
| **total** | 289 | 211 | 78 | 0 | 168 | 2995 | 151 | 30 | 0 |

## Ordering finding — routing is blocked on ingestion

- **0/289** FTXML source articles exist in the registry. Every FTXML article is
  a **canonical-only** doc (handoff todo #2): it has a per-issue `content_batch` sibling that SMPTE's
  importer ingested, but that primary was never added to *our* registry, and the FTXML secondary
  (which carries the refs) was skipped as "Aptara secondary".
- The Phase-3a extractor (`extractSmpteJournalRefs.js`) attached each ref to its **source registry doc**.
  Here the source docs do not exist yet, so there is nowhere to hang these refs. **Ref routing must wait
  for new-doc ingestion (todo #2).** This walker only catalogs.
- **Conference FTXML carry an empty `<article-id pub-id-type="doi">`** — no DOI is assigned yet, so those
  source docs cannot be matched by DOI at all; ingestion will have to key them by title/issue/author.

## What the refs give us today

- **2995** structured references across **168** files carry them; **151** cite a DOI.
- **30** of those cited DOIs already resolve to a registry doc — i.e. once the source
  docs land, that many refs become direct canonical links immediately (exact-case DOI match).
- **0** refs are already known to the MRI by contentHash (#1229 pre-check) — the future
  apply pass would dedup against these rather than mint fresh orphan slugs.

## Next step

1. Ingest the FTXML/`content_batch` canonical-only docs (todo #2) — 2024+ `<article>` NLM items can reuse
   `readNlmArticleXml` in `extractSourceMetadata.js`.
2. Re-run a Phase-3a-style apply over this catalog: for each source docId, attach the cataloged refs —
   direct canonical link where `refDoiTargetInRegistry`, else content-hash-guarded orphan-slug mint.

_Full per-file / per-ref detail in `ftxmlRefCatalog.json`._
