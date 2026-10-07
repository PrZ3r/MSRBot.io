---
name: msrbot-extract
description: Add documents to the MSRBot.io registry when there is no purpose-built extractor. The source can be a publisher page linking PDFs, a document landing page, a direct PDF URL or a document published as HTML (CST, small consortia, one-off specs) — the agent reads the sources and writes a records file, and `npm run extract-manual` runs it through the same extractDocs pipeline as the SMPTE/IETF extractors. Use when asked to add, ingest, extract or "pull in" a document or list of documents from a publisher URL into MSRBot, or to add a new publisher. Repo-only: needs an MSRBot.io checkout. Not for SMPTE/IETF (they have extractors), and not for SMPTE journal or conference papers (`npm run extract-smpte-journal`, local library only) or for answering questions about standards (use msrbot-research).
metadata:
  version: "1.2.0"
---

# MSRBot extract (agent-driven, manual provider)

You are the **discovery and reading** step of an extractor. The publisher has no scraper, so you read its site and PDFs and write a **records file**. Everything after that — reference parsing, MRI sightings, orphan slugs, `$meta`, URL resolution, merge with existing records, PR log — is done by `npm run extract-manual`, the same `extractDocs.js` pipeline the SMPTE and IETF extractors use. That is the point: a hand extraction and a scripted one produce the same kind of output, and anything you learn improves the shared tooling.

Read `AGENTS.md` first; it overrides anything here. Record format: `docs/manual-extraction.md`.

## When to use it, and when not

- **First pass only.** What you produce must be verified by hand by the requester against the sources before it merges. The review step (4) and the built-page check (5) are how that happens; they aren't optional.
- **Small jobs:** for one or two documents with few citations, editing by hand (`new-doc`, `canonicalize`, `validate`) may be quicker. Say so and offer that route. If you do the work, still use `extract-manual`.
- **Changing or versioned sources:** if the publisher revises, supersedes or withdraws documents over time, recommend a real provider in `src/main/scripts/providers/` with a scheduled run instead. A manual extraction is a one-time snapshot.

## Rules

1. **Read sources whole.** The whole listing page (news posts and page metadata carry dates the download list doesn't) and each PDF's cover, contents, scope, references and annex list. Listing titles are often all-caps, truncated or misspelt; the PDF cover wins.
2. **Never guess, never "clean up" identifiers.** Unknown edition, ambiguous date, unclear docType: leave it out or ask. Citations go into the records file **verbatim**; the parser maps them, not you.
3. **Provenance describes method, not tool.** `parsed` = read from the publisher's document/page (with a source URL); `inferred` = derived (translation, summary, constructed docId, status); `manual` = a person decided it. Never name the AI tool in data. See `references/fields.md`.
4. **English in `docTitle`/`abstract`;** non-English documents also get `language`, `docTitleOriginal`, `abstractOriginal`, `translatedBy: "msrbot"`. Translations are `inferred` with `reviewRequired`.
5. **Fix the shared tooling, not the output.** If `parseRefId` misses or misparses a citation, extend the publisher family in `src/main/lib/referencing.js` (recurring pattern) or add a `src/main/input/refMap.json` entry (one-off; then `npm run config-sort`), with tests and a whole-corpus parse diff — as its own tooling PR before the data. Contributors open tooling changes based on extraction findings as a separate PR from the data. Repository maintainers may combine the two in one PR, keeping them as separate commits. An explicit `refId` on a citation is only for a judgment call you list in the review.
6. **The requester vets every judgment call before you run the extraction** (rule of the house: no extractor scripts catch your mistakes). See step 4.
7. **Edit source inputs only.** Never hand-edit `documents.json`, `src/main/reports/`, or build output.

## Workflow

### 1. Scope: what were you pointed at?

| Source you were pointed at | What to read | `sourceUrl` / `href` | Dates and references |
|---|---|---|---|
| **Listing page linking PDFs** (CST's recommendations page) | The whole page, then each linked PDF | `sourceUrl` = the PDF. `href` = the PDF link. `href`, `publisher` and `docType` come from the listing page, so put that URL in `metaSourceUrls` | Printed in the PDF. News items and posts on the page can supply a missing day (`datePublished`) |
| **One document landing page** (an HTML page with metadata plus a PDF or HTML link) | The page, its metadata (`<meta>`, JSON-LD, `og:`/`article:` tags) and the linked document | `sourceUrl` = the landing page for fields read there, and the document URL for fields read from the document. `href` = the document, or the landing page if that is the canonical place to get it | Prefer the document; the page's structured metadata comes next |
| **Direct PDF URL** | The PDF only. Ask the user for the publisher's page if one exists | `sourceUrl` = `href` = the PDF | From the PDF. If none is printed, the PDF's `CreationDate` is **not** a publication date: leave the date out or ask |
| **Document published as HTML** (a spec page with no PDF) | The page itself: title block, status or version, scope, references section | `sourceUrl` = `href` = the page | Dates from the page's title block or metadata. Citations from the page's own references section. When a cited item is a hyperlink, copy that URL into the same citation's `href`, next to its `cite` text |

Mixed cases (several PDFs per document, language editions, annexes, consultation drafts, near-duplicate titles) are judgment calls: flag them before writing records.

- Save every page you use (`curl -sL URL -o $SCRATCH/<name>.html`) and enumerate the documents: id, listed title, document link(s), language editions, annexes, drafts/consultations.
- What MSRBot already has: `find src/main/data/docs -iname '<PUB>.*'`.
- **Scope is media.** Propose only documents within MSRBot's media scope (picture, sound, cinema, broadcast, files, archive, accessibility, immersive…). List out-of-scope ones (e.g. safety, building or HR rules) in the PR under "Not extracted (and why)" rather than silently skipping them.
- **Fill reference gaps recursively, within scope.** When an audit finds a document that records you have (or are adding) cite, propose it too, and follow its citations the same way. Stop at the first non-media reference, such as fire-safety regulations; those stay "not in registry" or orphans.
- **Language editions of one document are one record:** `href` = the English edition when one exists, the others in `hrefAlternates` (`references/fields.md`).
- New publisher: it needs keying (`src/main/lib/keying.js` `keyFromDocId`, else the MSI files an UNKEYED issue), a parser family if others cite it, and `site.json` abbreviation/logo/link (ask the user for the logo).
- Flag anything that isn't one-doc-one-PDF (separate language editions, annexes, consultations, near-duplicates) and ask how to model it.

### 2. Read each document
- **PDF:** `node .claude/skills/msrbot-extract/scripts/pdf_text.mjs <pdf|url> [pages]` prints the metadata and text. It installs `pdfjs-dist` into the skill folder on first run; the repo has no PDF tooling. A PDF with no text layer (a scan) is out of scope: tell the user, don't guess from images.
- **HTML:** read the saved page, including its `<head>` metadata (`<meta>`, JSON-LD, `og:` and `article:` tags) as well as the visible text. Copy each entry of its references section verbatim into `cite`. If the entry is a link, its URL goes in that citation's `href`; the parser reads it too (a DOI or W3C `/TR/` URL maps exactly), and an unmapped citation then renders as a clickable external link.
- For a batch, parallel readers are fine, but give them the verbatim-only rules and own the records yourself.
- Collect: label as printed, every printed date with its line, cover title, scope/"Objet" text, the references section verbatim, authoring body, version/supersedes notes.
- **Predecessor (`revisionOf`):** read the front page's "Revision of" / "Supersedes" line. `node src/main/scripts/extras/scanRevisionOf.js --pdf <url|path>` prints it and the predecessor's refId, parsed with `parseRefId`. Older pages omit "SMPTE" ("Revision of RP 87-1995"), and only the first designator is the predecessor. Set `revisionOf` to that refId. If the predecessor isn't in the registry, propose a placeholder record for it (see `docs/manual-extraction.md` › Predecessors and placeholder records).
- Dates: a printed "publiée/validée" line beats a header date beats the label year; an announcement's `datePublished` can fill a missing day. Record which in `metaNotes.publicationDate`.

### 3. Write the records file and preview the mapping
- One record per document (`docs/manual-extraction.md`): fields, `sourceUrl`, per-field `metaSources` / `metaSourceUrls` / `metaNotes` / `metaFlags`, and `citations.normative|bibliographic` as `{ "cite": "<verbatim>" }`.
- Preview what the parser will do — no writes:
  ```bash
  node -e 'const r=require("./src/main/lib/referencing"),{loadDoc}=require("./src/main/lib/registry");for(const d of require(process.argv[1]).records)for(const t of ["normative","bibliographic"])for(const c of (d.citations||{})[t]||[]){const id=c.refId||r.parseRefId(c.cite,c.href||"");const to=id&&r.findSourceDocIdForRefId(id);console.log(d.docId,t,id||"ORPHAN","→",to?to+": "+loadDoc(to).docTitle:"-","|",c.cite.slice(0,70))}' records.json
  ```
- The "→" column is the **real** resolver (`findSourceDocIdForRefId`, the same lookup `mriFlush` uses). Never re-implement resolution in a preview: an approximation missed the #2068 guard and showed `ISO.2969` resolving to an unrelated ISO doc. Compare each registry title with the cited title.
- Misses/misparses → rule 5. Generic phrases that aren't documents ("les normes ISO") are simply not listed as citations; note them in the review.

### 4. Review with the requester (required)
Write a review (markdown in your scratchpad) and wait for a go-ahead:
- per doc: docId, label (printed → normalised), publicationDate + source line + confidence, titles, status;
- every citation: verbatim text → refId → what it resolves to (registry title, or "not in registry"); flag wrong parts, unexpected editions, explicit refIds;
- dropped citations and why; registry problems you noticed (report them, fix them in their own commit).

### 5. Run the extraction
```bash
npm run extract-manual -- --input <records.json>
npm run canonicalize && npm run validate
npm run validate-mri-coverage
```
Then sanity-check resolution for the docs you added (read-only):
```bash
node -e 'const {loadMri}=require("./src/main/lib/mriStore");const {loadDoc}=require("./src/main/lib/registry");const m=loadMri();for(const id of process.argv.slice(1)){const d=loadDoc(id);for(const t of ["normative","bibliographic"])for(const r of (d.references||{})[t]||[]){const e=m.refs[r];const to=loadDoc(r)?r:(e&&e.resolvedDocId)||"-";const base=r.replace(/\.(\d{4}(-\d{2}){0,2}|\d{6,8})$/,"");console.log(id,t,r,"->",to,(to!=="-"&&!r.startsWith("orphan/")&&!to.startsWith(base))?"  CHECK":"")}}' <docId> ...
```
A `CHECK` (resolves outside its own lineage) is a resolver or mapping bug: stop and fix it at the source.

`npm run build` (~70 s) and read `build/docs/<docId>/index.html`: title/original title, Metadata (Language, Translation), references render as links / external citations / NOT IN REGISTRY as intended.

### 6. Ship
- Branch first (`feature/<publisher>-<topic>`), never `main`. `git pull` rebases here; on branches with merges use `git fetch` + `git merge`.
- PRs: tooling changes from your findings go in a separate PR from the data, unless the requester is a repository maintainer who wants them together.
- Commits: tooling, data (docs + MRI), reports, CHANGELOG — separate. Leave `src/main/logs/extract-runs/pr-log-*` out unless asked (scratch logs).
- PR from `.github/pull_request_template.md`, existing labels only (`enhancement`, `mri`, `claude`…): provenance table, citation mapping table, what was left out, open questions.

## Report back
Docs added (docId, label, English title), fields left empty and why, references not in the registry, decisions needed, and whether anything is uncommitted.

## Known pitfalls
- French/European typography ("ISO 26 428 – 3", "RP 200 :2012", UIT-R, CEI) is handled by `parseRefId` since #2088; new typography belongs there too.
- **An undated or unparted citation never resolves to a part.** "SMPTE 299M" maps to `SMPTE.ST299` (drop the M, no part), and resolves only to an edition of that base (`SMPTE.ST299.2004`). If no base edition is in the registry, it stays unresolved. Never give it an explicit refId to `-1` or the newest part. The path to the parted successor is the base edition's `supersededBy` (ST 377M → `SMPTE.ST377.2004` → ST 377-1), and the reader takes it from there. Don't change the MSI to bridge it. If the base edition is missing, propose adding it (with `supersededBy`) as a follow-up. ITU `-N` revisions are editions, not parts.
- A stored MRI pointer can outlive the bug that set it; `mriFlush` drops pointers it set itself once unconfirmed (#2068) — run the CHECK above anyway.
- **A citation of a whole series** ("ISO 15444", "SMPTE ST 429-*"): if the MSI has a suite for it (`src/main/reports/masterSuiteIndex.json` `suites[].key`), cite `<id>.ALLPARTS` (an explicit refId, listed in the review). It renders as a link to the suite page.
- **Cited papers and books may already be in the registry** (SMPTE journal and conference papers have DOI docIds). Search titles before accepting an orphan, and map the citation with a `refMap.json` entry.
- **Some publishers file errata under the same version prefix** (DCI's DCSS). Ranking by date then picks an errata sheet. Map the version to its specification record in `refMap.json`.
- **Portals select by keyword** (`src/main/data/portals.json`: D-Cinema takes DCinema/DCP/…, Captions-Subtitles-Accessibility takes Accessibility/Captions/Subtitles/…). Choose controlled keywords so documents land in the right portals.
- **Use `npm run extract-manual` for changes to already-added records too**: the update path records `originalValue` and `overridden`, and keeps the record's provenance.
- Listing titles can be wrong; a "révision" means an earlier edition exists. Don't link `revisionOf` unless you can identify it, ideally from the document's own "Revision of" line.
