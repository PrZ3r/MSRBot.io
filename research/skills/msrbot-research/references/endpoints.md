# MSRBot endpoints

Everything is static JSON served from `https://msrbot.io`: no API key, read-only. The site is rebuilt whenever the registry changes, and publisher data is re-extracted weekly.

## Approved sources

Use the JSON endpoints for facts and citations. The HTML pages are for linking a human reader.

| URL | Returns | Size | Use it for |
| --- | --- | --- | --- |
| `https://msrbot.io/api/doc/{docId}.json` | One full record: `{ $schema, apiVersion, lastModified, sourcePath, docId, document }` | ~5–20 KB | **Every fact and citation.** URL-encode the docId (`encodeURIComponent`). Exists for every docId. |
| `https://msrbot.io/api/documents.json` | Index of all documents: `{ generatedAt, total, documents: [{ docId, publisher, docType, docLabel, docTitle, contentType?, path }] }` | ~9 MB | Finding a docId. Rows have **no status or dates**, so always fetch the record. |
| `https://msrbot.io/docs/_data/by-publisher/{publisher}/{docType}.json` | A JSON array of full records (without `$meta`) for one publisher + doc type | 20 KB–5 MB | A **smaller alternative to the index** when your fetch tool truncates large files. Slugs are lowercase and hyphenated: `smpte/standard`, `smpte/recommended-practice`, `smpte/engineering-guideline`, `ietf/standard`, `ietf/informational`, `isdcf/technical-doc`. `/docs/_data/by-publisher/{publisher}.json` holds a whole publisher (SMPTE is ~57 MB). Not yet a documented API (tracked in PrZ3r/MSRBot.io#1170), so treat the path as subject to change. |
| `https://msrbot.io/api/mri-cite-map.json` | `{ refId: { cite, href, isOrphan, resolvedDocId } }` for ~46k cited references | ~12 MB | Resolving a reference id (including undated ones like `SMPTE.ST2067-2`) to a registry docId, or getting citation text for references that aren't registry documents. |
| `https://msrbot.io/api/stats.json` | Registry counts (documents, publishers, doc types, references) and `generatedAt` | 4 KB | "How many…" questions about the registry itself. |
| `https://msrbot.io/api/schemas/documents.schema.json` | JSON Schema for document records | small | Field definitions. |
| `https://msrbot.io/docs/{docId}/` | Human-readable document page | — | A link for the reader. **Not every document has one**: many journal articles are JSON-only and return 404 here even though `/api/doc/{docId}.json` exists. |
| `https://msrbot.io/suites/` and `https://msrbot.io/suites/{slug}/` | Suite and collection pages (families of related documents) | — | Linking a reader to a document family. |

## Don't use these as data sources

- **`https://msrbot.io/api/?q=…`** and the search boxes on `/docs/`. Search runs as JavaScript in the browser, so a fetch tool gets back an HTML shell with no results. (The site's OpenSearch file currently advertises `/api/?q=` as JSON. That is a known bug, PrZ3r/MSRBot.io#2033.)
- **`https://msrbot.io/reftree/`**. The reference tree is drawn in the browser. Get references from the record instead (`document.references`).
- **`https://msrbot.io/docs/_data/documents.json`** (~59 MB). It is an internal site file and too large for most fetch tools.

## When a fetch fails

| Symptom | Meaning | What to do |
| --- | --- | --- |
| 404 on `/api/doc/{docId}.json` | Wrong docId, not proof of absence | Look the id up in the index or a publisher slice. |
| Output truncated / too large | The index or cite map exceeds your tool's limit | Use a publisher slice, `scripts/msrbot.py`, or ask the user to paste the relevant part. |
| Tool refuses the URL | Your environment restricts fetching | Tell the user and ask them to open the URL and paste the JSON. |
| Timeout / 5xx | Transient | Retry once, then report. Don't answer from memory. |

## Coming later

A lookup API (identifier → docId, PrZ3r/MSRBot.io#2035), JSON search (#2036), version-lineage endpoints (#1190), provenance envelopes on every response (#2034), and an MCP server (#2039) are tracked under epic PrZ3r/MSRBot.io#2032. When they ship, prefer them over the index scans described here.
