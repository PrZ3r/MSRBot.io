# Change Log

> See [docs/buildlog.md](https://github.com/PrZ3r/MSRBot.io/blob/main/docs/buildlog.md) for details of [v1.0.0](https://github.com/PrZ3r/MSRBot.io/releases/tag/v1.0.0) released on Nov 26, 2025.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - yyyy-mm-dd

### Added

- **`npm run extract-smpte-journal`: SMPTE journal and conference papers from a local library (#2381).** New SMPTE Motion Imaging Journal issues and conferences reach MSRBot one way: the maintainer downloads them from SMPTE's AWS library. They can't be fetched on a schedule or from the web. The new `smpte-journal` provider reads that local copy and runs it through the same `extractDocs.js` pipeline as the other extractors. It reads each paper's `content_batch` file (metadata, keywords, authors) and its `FTXML/` full text (references).
  - **How it updates:** new papers are added, unchanged ones skipped, and a field SMPTE changed in a re-download is updated with its old value kept. Fields locked with `excludeChanges` stay as they are.
  - **It never deletes.** Hand-added keywords and authors' bios, affiliations and ORCIDs are kept. A paper's reference list replaces the stored one as a unit.
  - **Local copy required.** Without the library XML on disk (a missing path, an empty folder, or Dropbox online-only placeholders), it prints "nothing to do" and leaves the registry alone.
  - **Verified one-to-one.** Deleting the 300 SMPTE papers from 2025–2026 (and their 1,521 orphan references) and re-extracting them reproduced every doc and every reference exactly.
  - **Flags:** `--source <dir>` (default `_source/SMPTE`) and `--from <year>` (default 2025). See `docs/commands.md`.
- **References for 2015–2023 SMPTE papers, from their PDFs (`extract-smpte-journal --pdf-refs`).** SMPTE's library delivery for these years has no full text and no reference files (see `src/main/reports/smpte-upstream/referenceFilesTruthTable.md`), so these papers had no references. With `--pdf-refs`, the `smpte-journal` provider reads the reference section of each paper's published PDF (pulled from SMPTE's AWS library). It adds references only, to papers that have none, and never touches other fields.
  - **Splitting:** numbered lists are rebuilt by number, because two-column pages extract the right column first. Roman-numbered lists and unnumbered bibliographies are handled too. When the numbered pass finds fewer than two entries, a fallback reads bracket keys (`[Wang09]`, `[2]SMPTE`), footnote-style numbers and bullets, and is kept only when most entries read as citations. Page footers, figure captions, the conference disclaimer footer, run-on author bios, wrapped access dates and body text after the bibliography are dropped.
  - **Crossref cross-check, recorded per paper.** Each list's `$meta.note` gives Crossref's reference count for the DOI next to the count parsed from the PDF, as a record of what SMPTE's delivery lost. A mismatch sets `reviewRequired`. Crossref is never a source: no data from it is written.
  - **Resolution:** DOI, SMPTE volume + issue + first page, an SMPTE paper's exact title (venue and year checked), `refMap` (full citation, then title), then `parseCiteDesignator`; the rest become orphans with their printed text.
  - **Other Sources and Bibliography:** a second list after the main one ("Other Sources", "Additional References", or a "Bibliography" after numbered "References") is appended. A PDF that opens with the tail of the previous article in the issue has that article's references dropped, up to the paper's own title.
  - **Crossref fill (`--crossref-fill`), a reviewed one-time exception.** For papers where the PDF parse falls short of Crossref's list, Crossref's unmatched entries are added, after the maintainer reviewed the gaps against the PDFs. Entries already present are recognized by DOI, text, or the DOI's title; empty entries are skipped, and an ambiguous paper gets nothing. Each addition is marked `mapSource: crossref-fill` in the MRI, and the list's note says how many came from Crossref.
  - **Flags:** `--to <year>` (last year to read), `--pdf-refs` and `--crossref-fill`. See `docs/commands.md`.
- **Reference parser: more spelled-out lead-ins.** `normalizePublisherLeadIn` now accepts a dash-spaced name ("International Telecommunication Union – Radiocommunication (ITU-R), Recommendation BT.709-6" → `R-REC-BT.709-6`) and spelled-out SMPTE document types ("SMPTE Recommended Practice 168" → `SMPTE.RP168`, "SMPTE Standard 2084:2014" → `SMPTE.ST2084.2014`), and "EBU Technical Document 3344" → `EBU.Tech3344`.
- **One keyword rules file, shared by extractors.** `src/main/lib/keywordConform.js` conforms publisher keywords to `controlledKeywords`: it clusters spelling variants, folds acronyms and long forms, and title-cases ALL-CAPS terms while keeping acronyms. `src/main/config/keywordDecisions.json` holds all the rules (folds, drops, splits, acronym casing), merged from three earlier one-off cleanup passes. The rules reproduce the keywords of every SMPTE paper from 2024–2026 from its raw terms. `src/main/lib/authorBios.js` puts each author bio on the author whose name it contains.
- **`status.placeholder` and a placeholder banner (schema 2.8.0).** The flag marks an edition known to exist from evidence but not yet confirmed against the document: a later edition's "Revision of" line, citations, or earlier manual research. It's independent of `href`, since a copy may later come from the publisher, an archive or self-hosting. Flagged doc pages show a banner: "Placeholder record. This edition is known from evidence … but hasn't been confirmed against the document itself." `extract-manual` can set it, and a record's `metaSources` now set the provenance of status fields on update.
- **Placeholders report from the MSI.** Every MSI build marks flagged editions in their lineage (`statusPlaceholder`, plus a lineage `counts.placeholders`) and writes `src/main/reports/masterSuiteIndex-placeholders.json` and `.md`. Together they are the list of placeholder editions still to be confirmed, by lineage, with their evidence and the edition that confirms them. Cited editions with no record at all stay with their `MISSING REF` issues.
- **2,276 SMPTE journal articles and conference papers that were never in the registry.** These are SMPTE Motion Imaging Journal articles from 2016–2023 (1,856) and conference papers from 2015–2023 (420), the gap #1171 said must be filled before the `_source/` scrub. They come from SMPTE's IDAMS `<publication>` XML, a shape no earlier pass read. `src/main/scripts/extras/smpte-canonical-audit/idamsIngest.js` mints them, and its report is `idamsIngest.md`.
  - **Fields:** 1,321 abstracts, authors on 1,316 docs (with affiliations, ORCIDs and 1,019 bios), and keywords on 802. Labels, volume/number and publisher fields follow the 2010–2015 docs next to them. Conference papers carry the conference title, ISBN and start date. Author names use the source's Unicode spelling where it has one ("Hammershøj", not "Hammershoj").
  - **contentType:** SMPTE's own value, corrected in 792 docs where it contradicts settled registry rulings. Example: 352 "Ad Page" items SMPTE files as `content-announce` become `advert`, matching all 42 existing "Ad Page" docs. SMPTE's value stays in `contentType$meta.originalValue`.
  - **Facet chips:** eight keywords reach the 30-doc chip threshold and appear as chips: Artificial Intelligence, Video Compression, IP, Wide Color Gamut, 8K, PTP, Live Production, OTT.
- **Keywords and author bios for existing SMPTE journal and conference papers, from the same source.** `idamsFieldBackfill.js` fills empty fields on docs matched by exact DOI and skips `excludeChanges` locks. The `canonicalLibrary.*.json` dump that earlier passes used leaves these fields out.
  - **Keywords:** 65 docs (7 journal articles, 58 conference papers).
  - **Bios:** 1,060 bios on 469 docs. SMPTE's XML often files one author's bio under a co-author (swaps and rotations on 11 papers), so each bio goes to the author it names. The report lists all 23 moves.
- **Keyword handling shared by both passes** (`idamsPublication.js`). IEEE terms keep their own capitalization ("Digital TV", "DVB-S2", "192 kHz"). A term that is a variant of an existing one folds onto it: "High Dynamic Range (HDR)" → HDR, "Post-production" → "Post Production". Variants among new terms land once, under the spelling most docs use. Together the passes add about 2,780 `controlledKeywords`, mostly single-doc terms kept under the indexing policy.

### Changed

- **Retired the SMPTE backlog tooling.** The one-off scripts in `src/main/scripts/extras/smpte-canonical-audit/` (31) and their reports (41, about 37 MB) are gone. The parts worth keeping now live in shared code and the `smpte-journal` provider. `src/main/reports/smpte-upstream/` stays.
- **Standards cited publisher-first now parse.** Bibliographies (SMPTE's journal among them) often name the publisher before the designator: "SMPTE, ST 2084:2014", "International Organization for Standardization/International Electrotechnical Commission (ISO/IEC) 23009-1:2019", "… (ITU-R), Recommendation BT.709-6". `parseRefId` returned nothing for these. It now strips the publisher name first. The fix is in `referencing.js`, so manual extraction and every other extractor pick it up. It also corrects en-dash versions ("BT.2100–2"), "ST-2022-6" and the "IISO/IEC" typo. Author-date citations and designators followed by a parenthetical ("CEA-608-E (ANSI)") are left alone.
- **Two citation helpers in `referencing.js`.** `parseCiteDesignator()` reads a citation's designator only from the text before its title, so a paper whose title mentions a standard isn't linked to it. `tidyCiteText()` produces a JATS/NLM `<ref>` citation as printed, without the `<label>` number or the extra spaces around punctuation. `mriReplaceSighting()` lets a corrected re-parse replace citation text the MRI recorded earlier.
- **IETF runs keep the RFC index they used.** When an IETF extract adds or updates docs, it saves the live `rfc-index.xml` it parsed to `src/main/input/sources/ietf/rfc-index.xml`, and the workflow commits it with the data. Each IETF data PR then carries the index it was built from. Runs with no doc changes write nothing. That file is also the offline fallback, which before pointed at a path that never existed.
- **References list in paper order.** Doc pages sorted references as plain strings, so a paper's ref10 came before ref2 (1, 10, 11, …). The sort is now numeric-aware. This also puts ST 2 before ST 12.

### Fixed

- **ISBN showed "[object Object]" on 419 conference papers.** The schema allows `isbn` as a string or `{ print, electronic }`, like `issn`, but the doc template and citations printed it raw. The doc page now shows Print / Electronic like ISSN, and citations use one value.
- **Journal (FTXML) references, 2024–2026.** The #1248 extraction put the ref-list heading into each paper's first citation ("References 1. R. Xu …"), kept the reference number, and added spaces around punctuation ("Xu , “ Survey ,” 16 ( 3 )"). `extractFtxmlRefs.js --refresh` re-parses all 176 FTXML papers and replaces their citation text. Standards citations now link to the standard: 352 references resolve, up from 54.
- **IETF re-extracts rewrote data that hadn't changed.** The 2026-10-08 IETF run updated 40 RFCs when only two had real changes. The rest came from sources that changed on the RFC Editor and Datatracker side. A re-extract now keeps the stored value when the incoming one says the same thing in another form (`utils/reconcileIncoming.js`, run by `extractDocs.js` for every provider):
  - **Authors:** initials-form names from Datatracker `doc.json` ("R. Braden") no longer replace full names ("Robert T. Braden"). Order, "Dr." and accent folding ("Bjorklund" for "Björklund") don't count as changes. A different or added author still updates. The IETF parser also gets full names again: `doc.json` and the RFC index now give initials only, so it reads the Datatracker doc page's `article:author` meta (each author's profile name, in author order), when the count matches `doc.json`.
  - **URLs:** a `resolvedHref`/`href` that differs only by a trailing slash is kept. rfc-editor.org now redirects `/info/rfcN` to `/info/rfcN/`.
  - **Abstracts:** a whitespace-only difference is kept.
  - **Keywords:** held controlled keywords are never dropped. New ones are added unless they're a case, plural, hyphen or one-letter variant of a held one ("WOTS" for "W-OTS"). A held keyword outside `controlledKeywords` is first conformed to the shared rules: dropped if `drops` lists it, and replaced by the controlled term its fold or casing points to ("Aaa" → `AAA`, "Transport Layer Security" → `TLS`). A re-extract therefore cleans up keywords an earlier run stored, without a reset. The index's "eneryption" typo folds to `Encryption`.
  - **Status lists:** the same IDs in another order are kept.
- **IETF relations from the RFC index only.** `amends`, `amendedBy`, `supersedes` and `supersededBy` came from the RFC index merged with the RFC info page. The redesigned info page leaked stray IDs (RFC1035 "amended" the RFCs it obsoletes; RFC9190 "amended" RFC2119). The index is now the only source when it has the RFC, and the info page is a fallback.
- **Dated ITU-T references lost their year.** "ITU-T Recommendation X.660, July 2011" resolved to undated `T-REC-X.660` instead of `T-REC-X.660.2011` after #2380's lead-in rewrite. That rewrite now applies to ITU-R only.
- **Non-citation lines minted as orphan references.** The RFC8323 WebSocket example steps ("2. The CoAP client establishes …") were already filtered from the bad-refs report, but they still became orphan refs. The filter now runs before minting.
- **IETF keywords follow the shared rules.** IETF index keywords now go through the `folds` and `drops` in `keywordDecisions.json`, like SMPTE's. So "internet of things" becomes the controlled `IoT` instead of re-adding a term the June keyword scrub removed, and contentless index words ("values", "implementations") are left out. A word the index writes with capitals past its first letter keeps its casing (`BOOTP`, `TLSv1.0`, `IPv6`, `WebSocket`, `PKIX`; these came out as "Bootp" and "Ipv6"). A term already in `controlledKeywords` takes that casing instead ("MAIL" → `Mail`). "NNTP", "TLS", "WS" and "WSS" stay all caps, "of"/"in" stay lowercase, and an abbreviation listed on its own as "(MTU)" loses the parentheses.
  - **New rules from the first IETF backfill batch:** folds Maximum Transmission Unit → `MTU`, Uniform Resource Name → `URN`, Internet Assigned Numbers Authority → `IANA`, the index typo "emal address" → `Email Address`, Codepoint → `Code Point`, and TELNET/HOSTNAME → `Telnet`/`Hostname`. Drops: values, implementations, deprecate, symmetric, well-known, authenticator, protocol constant, protocol parameter, transport protocol layer, international data algorithm. 35 IETF terms join `controlledKeywords` (protocols, specs and registries such as `TLS`, `FTP`, `NETCONF`, `PKIX`, `X.509`, and the Telnet option names `TOPT-*`).
  - **Batch 2:** folds the long forms into their acronyms (Transport Layer Security → `TLS`, Datagram TLS → `DTLS`, Simple Network Management Protocol → `SNMP`, Internationalized Resource Identifier → `IRI`, Entertainment Identifier Registry → `EIDR`, and others) and the RSA variants into `RSA`, `RSA-OAEP` and `RSA-PSS`. Drops unauthenticated, security attacks, embedded internet. 42 terms join `controlledKeywords`. The parser also strips a leading "and"/"or" (the index lists "and URN" as a keyword) and keeps version tokens as written ("PKCS #1 v1.5", not "V1.5").
- **RFC appendices parsed as references.** For RFCs whose HTML is converted from text (most before 2019), the last References heading ran to the end of the page, so appendices, acknowledgments and author addresses were read as citations. RFC8446's state-machine diagrams, RFC7296's message flows, RFC8017's algorithm steps and page-break residue ("[Page 85") became orphan refs. A references block now ends at the first heading outside its own section ("Appendix A" after "12. References"), or at an unnumbered section ("Acknowledgments", "Authors' Addresses"), which htmlized RFCs print as unindented text. Page footers ("[Page 85]") are no longer read as reference labels. RFC821-style key lines ("[1]  ASCII", where the citation follows on the next line) and footnotes inside old reference lists ("[**] Editor's Note", "<4> …") are no longer reported or saved as orphans. On a 37-RFC sample, no real reference is lost.
- **Run log reports orphans as orphans.** The extract log and PR body listed every citation without a standard ID under "Unparseable References Found", on every run, including orphans already in the MRI. Those are parsed citations kept as orphan refs, not failures. The log now has three parts: **New orphan refs** (created by this run, with their slug; capped at 20 in the PR body), a count of orphans already in the MRI that were seen again, and **Unparseable references** for only the citations that couldn't be recorded at all. `mriRecordSighting` returns `created` for a newly minted orphan. Orphans also store the citation without its reference-list label: "[DH] Diffie, W. …" was saved as "DH ] Diffie, W. …". Since orphan IDs are hashes of that text, the labelled and unlabelled captures of one citation (RFC7296 had both for 2 citations) now collapse into one orphan. A citation's wrapped author line that looks like a new entry ("Kohlweiss, M., Pan, J., …" inside RFC8446's [BDFKPPRSZZ16]) is no longer saved as a second orphan holding the tail of the first. An old numbered-list label ("3. Pickens, J., …") is stripped like "[3]", and a citation's wrapped "Latest version available at <…>" line (RFC7303) is not a citation. A citation that resolves once its label is stripped is cited by its ID instead of becoming an orphan: RFC8439's "Zhenqing2012 ] Zhenqing, S., …" now matches its `refMap` entry and cites `10.1007-978-3-642-37682-5_24`. Simulated over the 143 RFCs the backfill covers so far: 202 orphans, each a real citation.
- **Standards as xml2rfc prints them.** `parseRefId` now reads "ISO Standard 10646:2014" / "ISO Standard 26324, 2012", "ANSI X3.106, 1983", "IEEE 802 Std 802.11F(TM)-2003", "IEEE 1003.1, 2013 Edition", and a closing "IEEE 754". Replaying all 63,771 recorded MRI citations: 11 newly resolve, and none that resolved before changes.
- **NIST SP revisions stay lowercase.** A NIST SP number read from citation text was uppercased whole, so a DOI in the text ("NIST.SP.800-56Ar3") became `NIST.SP.800-56AR3`, a second ID for the same publication. The revision now stays `rN`, as NIST writes it.

## [v2.9.0] - 2026-10-06

### Added

- **317 SMPTE placeholder editions and `revisionOf` on 627 SMPTE documents, read from PDF front pages (#2373).** A SMPTE front page names the edition it replaces ("SMPTE 259M-2008 — Revision of SMPTE 259M-2006"). A scan of every PDF release on pub.smpte.org found 628 such lines.
  - **Placeholders:** 317 named editions had no digital copy and weren't in the registry, so each is now a placeholder record. It has no `href`, is superseded by the edition that names it, and has a `statusNote` citing that document. One is the one-off Engineering Committee Report SMPTE ECR 1-1978.
  - **`revisionOf`:** the 627 documents that name a predecessor now carry it. Before this, only 15 HTML releases did. Some links cross document families (ST 12-2 ← RP 188, ST 377-1 ← ST 377M).
  - **Impact:** 91 of the 153 open SMPTE missing references now resolve (#2242). MSI lineages go from 1,446 to 1,454.
- **New docType "Engineering Committee Report" (schema 2.7.0).** A one-off SMPTE designation (ECR), abbreviated "ECR" on the site. The only known instance is ECR 1-1978, revised by EG 1:1990.
- **`src/main/scripts/extras/scanRevisionOf.js` reads a document's predecessor from its PDF front page.** A SMPTE front page names the edition it replaces ("SMPTE 259M-2008 — Revision of SMPTE 259M-2006"). The tool parses that line, including older RP/EG/RDD pages that omit "SMPTE" and lines that run on into the document's own designator, and maps the predecessor with `parseRefId`.
  - **Modes:** `--pdf <url|path>` reads one PDF, for manual extraction. `--docs` and `--all-smpte` scan registry documents through their pub.smpte.org release pages and write a JSON report. It never writes the registry.
  - **Docs:** `docs/manual-extraction.md` and the `msrbot-extract` skill now record `revisionOf` from that line, and describe placeholder records for predecessors with no digital copy.
  - **Guards against false matches:** it reads every predecessor named on the line, stops at the document's own designator (including one printed with a different year), and skips a number that follows an unrecognized prefix ("AES3-1992", "XYZ 4-1980").
  - **ECR:** SMPTE Engineering Committee Reports now parse ("SMPTE ECR 1-1978" → `SMPTE.ECR1.1978`).
  - **New devDependency `unpdf`** (MIT, 2.1 MB, no dependencies) for PDF text extraction. The repo had no PDF text tooling, and `pdfjs-dist` is 35 MB.
- **`src/main/scripts/extras/rekeyRefs.js` re-keys stored citations after a parser fix.** Citations written by earlier runs or one-off backfills keep the refId the parser produced at the time. `--refs A,B` re-parses each citing doc's verbatim cite (from the MRI sightings) and replaces the stored refId when the result differs. `--rename OLD=NEW` handles citations with no cite text, e.g. after a registry merge. Dry run by default; `--apply` writes, recording the prior list in `<type>$meta.originalValue`.
- **CTA, ICC, W3C author-date and GitHub citations parse.** New parser families read CTA designators ("CTA 861-G", "ANSI/CTA-608-E S-2019" → `CTA.608-ES.2019`), ICC specifications ("Specification ICC.1:2022" or a color.org `ICC.1-2022` link → `ICC.1.2022`) and W3C author-date cites ("World Wide Web Consortium (W3C) (2004, October 28). XML Schema Part 1: …" → `W3C.xmlschema-1.20041028`). A cite with no other match whose link is a GitHub repository root becomes `GITHUB.<owner>.<repo>`. New refMap entries cover Kakadu (`KAKADUSOFTWARE.COM`), OpenJPEG (`OPENJPEG.ORG`) and the MovieLabs BT.709-to-HDR10 best practice (`MOVIELABS.BT709-HDR10.v1.0`). These are the seven citations from ST 2067-21:2026-07 and ST 2094-50:2026-08 that were left unparsed. Across the 49,925 distinct citations in the MRI, 24 more now parse, with none lost or changed.

### Changed

- **Registry data cleanup from the SMPTE missing-ref audit (#2242).**
  - **Renamed:** `CMR.ML` → `MOVIELABS.CMR`, the publisher-prefixed form, matching `MOVIELABS.BT709-HDR10.v1.0` (#2164).
  - **Duplicate records merged into the one kept:**
    - `SMPTE.RP27.3.1989` → `SMPTE.RP27-3.1989` and `SMPTE.RP27.4.1994` → `SMPTE.RP27-4.1994`. Dotted part numbers aren't the registry's numbering.
    - `SMPTE.ST292-0.2011`, a Zoho duplicate, → the extractor's `SMPTE.OV292-0.2011`.
  - **What a merge keeps:** each merge only adds the duplicate's fields (abstract, ISBN, ICS codes, approval date and so on) and takes its DOI, the form registered at doi.org. `RP27-4` keeps its parsed reference `ANSI.IT2.19.1990`, not the duplicate's hand-entered `NAPM.IT2.19.1994`.
  - **Re-keyed citations:** 43 citations in 40 docs, all re-derived from their verbatim cites with `rekeyRefs.js` after the group C and D parser fixes. Each list keeps its prior value in `<type>$meta.originalValue`.
  - **Notes:** `SMPTE.ST386.2004` and `SMPTE.ST387.2004` gain a `details` note. They cite "SMPTE 305.2M-2002", an edition that was probably never published (ST 305 went from 305.2M-2000 to ST 305:2005). The citation is kept as printed.

### Fixed

- **ECR documents key into the MSI.** The SMPTE keying pattern didn't include the new ECR type, so `SMPTE.ECR1.1978` was filed as UNKEYED (#2374). It now has its own lineage.
- **Old SMPTE designators parse to the right id (#2242, group D).**
  - **Bare ANSI/SMPTE numbers:** "ANSI/SMPTE 40–1991" was caught by the ANSI co-designation rule and lost its type (`SMPTE.40.1991`). It is now `SMPTE.ST40.1991`.
  - **En and em dashes before the year:** "SMPTE 292M– 1998" and "SMPTE 2021–2008" are now read with their year. Before, the year was dropped (or the cite didn't parse), so the undated ref silently resolved to the newest edition.
  - **Dotted suffixes:**
    - A dotted suffix after a type is a part ("ST 363.2-2002" → `SMPTE.ST363-2.2002`).
    - RP 210 numbers its revisions with a dot ("RP 210.4-2002" → `SMPTE.RP210.2002`).
    - refMap maps ST 305's revision "305.2M" (and the typo "3052M") to `SMPTE.ST305.<year>`.
  - **Leading zeros** are dropped ("SMPTE 0352–2010" → `SMPTE.ST352.2010`, "RDD 09" → `SMPTE.RDD9`), except for AG, whose ids are zero-padded (`SMPTE.AG02`).
  - **Impact:** across the MRI, 61 citations change, and 36 of them now resolve to a registry doc (24 before). 13 that resolved only because their year was dropped now keep that year and show as missing.
- **SMPTE citations that parsed to the wrong id (#2242, group C).** "SMPTE ST 336M:2007" kept the legacy "M" (`SMPTE.ST336M.2007`, now `SMPTE.ST336.2007`; also `RP 160M-1991` → `SMPTE.RP160.1991`). Part 0 of a suite ("SMPTE ST 2081-0:2015 — … Roadmap") is its Overview Document, so it is now `SMPTE.OV2081-0.2015` whatever type it is cited as (also `OV2082-0`, `OV425-0`). New refMap entries: "SMPTE RP 27.3-1989" and "27.4-1994" → `SMPTE.RP27-3.1989` / `SMPTE.RP27-4.1994` (RP 27 parts; other dotted SMPTE designators are unchanged pending a decision); "SMPTE 299-2009" → `SMPTE.ST299-1.2009` (ST 299M became ST 299-1); "[SMPTE RP 2242] — SMPTE Labels Register" → `SMPTE.RP224` (the "2" is a footnote marker). Across the MRI, 10 citations change, all to these ids.
- **SMPTE citations by printed designation resolve to the released document.** Some SMPTE documents are printed with a different year from their library release. RP 86 was released 1990-06-05 but published as "RP 86-1991", so its docId is `SMPTE.RP86.1990` while citations say `SMPTE.RP86.1991`. The 1991 form is also its registered DOI (`10.5594/SMPTE.RP86.1991`, which resolves to the 1990 release). The resolver now treats a doc's SMPTE DOI as an alias for that doc, after an exact docId match and before any edition matching, so the citation keeps the designation it was written with and links to the document. This resolves `SMPTE.RP86.1991` → `SMPTE.RP86.1990`, `SMPTE.RP103.1995` → `SMPTE.RP103.1994` (`rp0103-1995` PDF) and `SMPTE.ST165.1999` → `SMPTE.ST165.1994` (`st0165-1999` PDF). Of the 116 SMPTE docs whose DOI differs from their docId, no two share a DOI. Where a DOI suffix is itself another doc's docId (`SMPTE.ST400.2004`), the exact docId wins.
- **A renamed or removed document no longer lingers in the MRI as a missing reference.** The MRI cleanup that drops uncited entries trusted each entry's stored "source present" flag, which is only refreshed after the cleanup runs. After `CMR.ML` was renamed to `MOVIELABS.CMR`, the uncited `CMR.ML` entry survived the rebuild and was counted as a missing reference. The cleanup now checks the registry directly.
- **SMPTE DOIs are checked at doi.org before they're written.** The extractor built the DOI for HTML releases from the year alone (`10.5594/SMPTE.ST2094-50.2026`), while SMPTE registered recent ones with the month (`10.5594/SMPTE.ST2094-50.2026-08`). PDF-only releases already took the month from the docId, so ST 2110-41:2026-06 was right while ST 2094-50:2026-08 and ST 2067-21:2026-07 got a DOI that doesn't resolve. SMPTE's registrations don't follow a date cutoff: 2024–2025 docs are registered year-only, and the month form starts in 2026. Both paths now start from the same default: the month form from 2026 on, the year-only form for 2023–2025. For every doc dated 2023 or later, the extractor then asks doi.org which form is registered, the default first and then the other one. That catches exceptions such as ST 2136-1:2026-02, registered year-only. If neither form can be confirmed, the doc keeps the default form, logs a warning and flags the DOI for review, instead of marking the link "verified". So a new 2026 document whose DOI isn't registered yet still gets the month. Four registry docs carried a DOI that didn't resolve: ST 2067-201:2026-03, EG 428-23:2026-04, ST 2067-21:2026-07 and ST 2094-50:2026-08. The SMPTE re-extract in #2164 corrected them.
- **A dated reference no longer resolves to a different edition.** When the cited edition wasn't in the registry, the MRI pointed it at the newest edition of the same document. "Specification ICC.1:2022" showed as ICC.1:2010, and SMPTE ST 274:1998 as ST 274:2008. A dated reference now resolves only to an edition from the year it cites, and otherwise is listed as a missing reference under its own id. Undated references still resolve to the newest edition. Across the 5,980 refIds in the MRI, 201 that pointed at another edition become missing (137 SMPTE, 40 ISO, 24 other), and no other resolution changes.

## [v2.8.0] - 2026-10-02

### Added

- **`hrefAlternates` for documents published in several languages (schema 2.6.0).** One record per document. `href` is the primary link, the English edition when one exists, and `hrefAlternates` lists the other editions as `{ language, href }`. The doc page lists each edition's URL in the Link row, followed by "(French edition)"-style labels (English first), lists every edition language in the Language row ("French, English"; English only when an English edition exists), links the original-language title to its edition, and the research skill's `records.md` documents the field. `translatedBy` gains `contributor` for third-party translations, at document level and on each `hrefAlternates` entry ("(French edition, contributor translation)"); the search API and `search.schema.json` emit it like `msrbot`. It is first used for CST-RT-040 and CST-RT-047, whose English editions are official (`translatedBy: "publisher"`).
- **More CST recommendations, added with `npm run extract-manual`.** Each has the French original title and abstract plus an English translation flagged for review, and its citations are parsed from CST's own text.
  - Batch 1, sound/picture sync: CST-RT-009-2000 (television), CST-RT-015-2007 (35 mm release prints), CST-RT-025-2011 (cinema).
  - Batch 2, cinema sound and acoustics: CST-RT-003-2009 (advertising and trailer loudness), CST-RT-007-2001 (processor level alignment), CST-RT-013 (auditorium sound level, 2006), CST-RT-014-2001 (background noise in technical facilities), CST-RT-022-2011 (AES channel assignment), CST-RT-041-2021 (auditorium acoustics).
  - Batch 3, projection and auditoriums: CST-RT-005-2002 (35 mm projection), CST-RT-012-2003 (spectator comfort), CST-RT-020-2023 (open-air projection), CST-RT-032-2012 and CST-RT-033-2012 (measurement methods for digital projection and sound), CST-RT-034-2012 and CST-RT-035-2012 (digital projection characteristics and auditorium dimensions, both cover-marked drafts), CST-RT-045-2019 (projection equipment maintenance).
  - Batch 4, files, archive, accessibility and TV:
    - CST-RT-018-2017 (TV advertising safe areas);
    - CST-RT-021-2016 (the "mezzanine file"), with its color annex CST-RT-021-Annexe-2016 as a linked record;
    - CST-RT-026-2012 (archival master);
    - CST-RT-039-2015 (DCP deliverables for accessibility), which appears in the D-Cinema and the Captions, Subtitles and Accessibility portals.
  - Batch 5, documents other CST records cite, plus VR:
    - CST-RT-031-2012 (surveying auditorium dimensions), cited by RT-035;
    - CST-RT-040-2016 ("ready for broadcast" files), cited by RT-018, with CST's official English edition as `href` and the French one in `hrefAlternates`;
    - CST-RT-047-2023 (virtual reality), with English and French editions.
  - `ISDCF.DCNC` (update path): the 14 normative references from ISDCF's [References page](https://www.isdcf.com/registry/references/) (ISO 639 and 3166, the IANA Language Subtag Registry, BCP 47 as RFC 5646 and RFC 4647, ISDCF Doc 7, SMPTE ST 428-12 and four ST 429 parts, and MovieLabs ratings). Also its French and Japanese contributor translations, with provenance from ISDCF's [Translations page](https://www.isdcf.com/registry/translations/).

    RT-011, RT-017, RT-030 and RT-043 (with its note) are not added, because they fall outside MSRBot's media scope.
- **DCI DCSS citations parse.** A new parser family reads "Digital Cinema System Specification Version 1.2", "V1. 0", "version 1.4.2" and similar citations. Across the 51,081 citations in the MRI, 13 more now parse, with none lost or changed.
- **`refMap.json` one-offs found during the CST extraction:**
  - "norme AES 3" → `AES3`;
  - the French "convention de nommage du cinéma numérique" → `ISDCF.DCNC`;
  - three SMPTE journal papers (*The Restoration Business Part 4*, *Stability of Photographic Film Part VI*, *Proposal of a System Architecture for Digital Film Archives*) → their DOI records;
  - the Helt & La Torre SMPTE 2014 conference paper → `10.5594-M001556`.

  Two non-CST citations of the film-archive paper now link too.
- **ISDCF document citations parse.** A new parser family maps ISDCF paper URLs (`…/papers/ISDCF-Doc8-…pdf`, in the cite text or its `href`) and "ISDCF Doc 7" / "ISDCF Document 10" to `ISDCF.D08`-style ids, which resolve to the registry edition; Doc 1 maps to `ISDCF.DCNC`. `refMap.json` adds the P-HFR paper URL and ISDCF's wording for the IANA Language Subtag Registry and MovieLabs Common Metadata Ratings. Across the 51,144 citations in the MRI, 4 more now parse (two SMPTE journal citations each of ISDCF Doc 8 and P-HFR), with none lost or changed.
- **A bare "BCP 47" citation records both of its RFCs.** BCP 47 is RFC 5646 (language tags) plus RFC 4647 (matching), and both are in the registry. `parseRefId` maps a bare "BCP 47" (or a `…/bcp47` link) to the set id `BCP47`. `mriRecordSighting` and `extractDocs` then record each member instead, through `expandRefId` and a small `REF_EXPANSIONS` table in `referencing.js`. A citation that names its RFC ("BCP 47 (RFC 5646)") keeps that RFC. No existing MRI citation changes.
- **`findSourceDocIdForRefId` exported from `referencing.js`.** This read-only lookup is what `mriFlush` uses, so previews and checks, such as the `msrbot-extract` mapping preview, show real resolutions instead of approximations.

### Changed

- **API versions bumped for the additive fields in this release.** Documents schema 2.6.0 (`hrefAlternates`, `translatedBy: contributor`). `/api/doc/{docId}.json` `apiVersion` goes `1.0.0 → 1.1.0`, and `/api/documents.json` and `/api/search/` go `2.0.0 → 2.1.0`, because rows can now carry `translatedBy: "contributor"`. `/api/stats.json` stays at 1.1.0. The API page used to say "Current API version: 1.0.0"; it now lists each endpoint's version and the schema version. The research skill's `msrbot.py` accepts any `2.x` search index, so it is unaffected.
- **`msrbot-extract` skill updated from the CST batches.** It now covers:
  - mapping previews with the real resolver;
  - the requester review step;
  - full-date padding;
  - series citations as `<id>.ALLPARTS` when an MSI suite exists;
  - looking up cited papers in the registry before accepting an orphan;
  - errata that share a version prefix;
  - portal keywords;
  - using the update path for later changes;
  - scope (media only, "Not extracted (and why)" in the PR) and filling reference gaps recursively, stopping at non-media references;
  - one record per language edition set (`hrefAlternates`);
  - unparted and "M" citations never resolve to a part: they go to their own base, and supersession leads on;
  - contributors open tooling fixes found during an extraction as a separate PR from the data (maintainers may combine them, as separate commits). `AGENTS.md` and `docs/manual-extraction.md` say the same.

### Fixed

- **Re-extracts don't mark an unchanged list of objects as overridden.** The update path compared values with plain `JSON.stringify`, so key order mattered. Canonicalize sorts keys inside array entries (such as `hrefAlternates`), and an unchanged value then came out `overridden`, with an `originalValue` identical to the new one. The comparison now sorts keys first.
- **An undated or unparted reference never rolls onto a different part.** When no edition of the cited base existed, the resolver fell back to any `<base>-N` or `<base>.N` document, so it picked the newest *part*. For example, "SMPTE 299M" and "SMPTE 299-2009" linked to ST 299-1 or 299-2, ISO 13818 to 13818-1, and RP 27 to RP 27-4. A reference now resolves only to an edition of its own base: a date suffix (`.2009`) or a DCI version (`.v1.4…`). ITU `-N` revisions are the exception, because they are editions. 22 refs that had rolled onto a part are now unresolved until their base edition is in the registry. Supersession is unchanged: ST 377M resolves to `SMPTE.ST377.2004`, whose `supersededBy` leads to ST 377-1, so the reader can follow it. This reverses the "SMPTE 299-2009 → ST299-1.2009" example from v2.7.0.
- **"All parts" references link to their suite page on doc pages again.** This had been broken site-wide since the MRI v2 doc-page work (#1097, 2026-06-18). Every ALLPARTS reference has an MRI entry, so the template rendered them as plain "EXTERNAL" citations instead of suite links; examples are SMPTE AG 16's ISO 80000, ST 382's ST 379 (MXF Generic Container) and DCI's ISO 11664. The reference tree was unaffected. An ALLPARTS reference with no MSI suite, such as RFC 1494's ISO 10021, now shows "NOT IN REGISTRY" instead of linking to the bare `/suites/` index.
- **DCSS version citations link to the specification, not an errata sheet.** The registry files each DCSS errata release under the same version prefix, so ranking sent "DCSS Version 1.2" to "Errata 44-45". `refMap.json` now maps each version that has a specification record (1.2, 1.3, 1.4, 1.4.1, 1.4.2, 1.4.5) to it.
- **DCI `YYYY-MMDD` editions are ranked by date.** Undated DCI references picked an arbitrary or older edition. Undated `DCI.DCSS` now resolves to the v1.4.5 specification (it was a 2019 v1.3 errata sheet), and `DCI.DCA-HDR` to its 2024-02-28 edition (it was 2022).
- **`extract-manual` updates keep the record's provenance, and re-extracts don't flag unchanged references.** When a manual record updates an existing document, its per-field source hints now apply; a keyword update had come out `parsed`, high confidence, instead of `inferred`. For every provider, orphan citations minted in the run are now counted when comparing references, so re-extracting a document whose citations haven't changed no longer marks them as overridden.
- **Manual records label `docLabel` and `href` as `parsed`.** The pipeline treats those two fields as `resolved` (computed), which is right for scrapers, but in a manual record they are read from the publisher. `docs/manual-extraction.md` and the skill also had it wrong that `publicationDate` could be `YYYY` or `YYYY-MM`. The schema requires a full date, and year-only or month-only dates are padded with the registry's standard note.
- **Research skill 1.5.4: padded dates aren't stated as exact days.** `publicationDate` is always a full date, but a source with only a year or month is padded to `-01-01` or `-01`, and `$meta.note` says so (about 2,500 records).
  - The skill and `prompt.md` now state only the known precision.
  - `msrbot.py get` reports `publicationDatePrecision: year|month`.
  - `records.md`, `endpoints.md` and `search.schema.json` no longer claim `YYYY`/`YYYY-MM` values appear.

  This was found while adding CST-RT-015, which is dated only by year.

## [v2.7.0] - 2026-10-01

### Added

- **Manual extraction through the extractor pipeline (`npm run extract-manual`).** For publishers without an extractor, a person or AI agent reads the publisher's site and PDFs and writes a records file. The new `manual` provider (`src/main/scripts/providers/manual.*`) feeds those records to `extractDocs.js`, which handles them exactly like SMPTE and IETF output:
  - citations go through `parseRefId` with MRI sightings, and unparsed ones become orphan slugs that keep their citation text;
  - `$meta`, URL resolution, merging with existing records, the PR log and the MRI flush all run as usual.

  Records can set provenance per field: `injectMeta` now honours per-field `source` and `sourceUrl` hints, so a translated title can be `inferred` while the label is `parsed`. An explicit `refId` on a citation is logged as a `manual:explicit` judgment call.

  This is the required path when an AI tool does the extraction. The output is a first pass that a person must verify by hand; for sources that change over time, a real provider with a scheduled run is still the right tool. In Claude Code, the new repo-only project skill `.claude/skills/msrbot-extract/` walks through it: reading sources, writing records, the requester review, running, and verification. AGENTS.md, CONTRIBUTING, `docs/commands.md`, the README and the new `docs/manual-extraction.md` all document it. New test: `manualProvider.test.js`.

- **The reference parser reads French and European citation styles, plus CST and AFNOR designators.** This came out of hand-extracting CST recommendations. `parseRefId` now normalises spaced thousands and dashes ("ISO 26 428 – 3" → `ISO.26428-3`, which used to parse as `ISO.26`), ISO/DIS, CD and R drafts, a space before ":year", French spellings (UIT-R → ITU-R, CEI → IEC), "ITU–R : BT 709 - 6", "SMPTE ST2067-40", `SMPTE, «RP 177-1993`, "ST 2110–10" and "EBU – R95". It also has two new families:
  - CST, e.g. "CST RT 031 – Projection – 2012" → `CST.RT031.2012`, plus `CST.RT021annex.2016` and `CST.NT001`;
  - AFNOR, e.g. "NF S27-100:2014" → `AFNOR.NFS27-100.2014`, and "NF EN 61947-2" → `AFNOR.NFEN61947-2`.

  Across all 50,972 citations in the MRI, 91 previously unparsed citations now parse, 189 gain a part or year, and none are lost. `refMap.json` gains three CST one-offs and is now alphabetised by `npm run config-sort`. New test: `referencing.citeTypography.test.js`, with 41 real citations. `keying.js` also gains a CST rule, so CST documents form MSI lineages (`CST|RT|028|`), with annexes keyed as supplements (#2085).

- **New publisher: CST (Commission Supérieure Technique de l'Image et du Son).** The first document is **CST-RT-028-2026** *Digital Projection – Subtitles – Characteristics, Dimensions and Positioning* (`CST.RT028.2026`), parsed from CST's PDF and site without an extractor. It is the first doc to use the language fields: `language: fr`, with the French title and abstract in `docTitleOriginal`/`abstractOriginal` and an English translation (`translatedBy: msrbot`, `$meta.source: inferred`, review required). Its eight cited references are recorded in the MRI with CST's citation text (`mapSource: parsed`):
  - registry docs link normally
  - ISO 26428-7 and ISO 8567 are canonical refs with no registry doc yet
  - the AFNOR NF S27-100 and ARCOM charter citations are orphan slugs

  CST also gets a site logo and publisher link.

- **Fields for non-English documents (schema 2.5.0).** `docTitle` and `abstract` stay in English. The new optional fields are:
  - `language`: the BCP 47 tag of the published language
  - `docTitleOriginal` and `abstractOriginal`: the publisher's own wording
  - `translatedBy`: `publisher` for an official English title, or `msrbot` for our translation

  Doc pages show the original title under the English one, with a **Translation** row in the Metadata card naming what MSRBot.io translated (e.g. "Title and abstract translated from French by MSRBot.io"), plus a Language row and the original-language abstract. The site search index and the API viewer also search `docTitleOriginal`. In the APIs, `/api/documents.json` rows gain `docTitleOriginal`, `language` and `translatedBy`, and `/api/search/` rows gain `titleOriginal`, `lang` and `translatedBy` (also in `search.schema.json`); all are emitted only for non-English documents, so English rows are unchanged. The research skill (1.5.3) and `prompt.md` cite the original title when the English is MSRBot's translation, and `msrbot.py find`/`search`/`get` match and return the new fields. CONTRIBUTING documents these fields and spells out `$meta.source` semantics: `parsed` means read from the publisher's document, `inferred` means derived (translation or constructed value), and `manual` means set by a person.

### Changed

- **The skill carries its own version (`msrbot-research` 1.5.1).** `SKILL.md` frontmatter gains `metadata.version`, the Agent Skills spec's place for it. The claude.ai zip contains only the skill folder, not `plugin.json`, so zip installs previously had no version of ours at all; claude.ai's "V1/V2" labels are its own upload counter. A new `npm test` check (`researchSkill.test.js`) fails if `metadata.version` and `research/.claude-plugin/plugin.json` differ, and also checks the frontmatter `name` and description length. AGENTS.md and `research/README.md` say to bump both.

### Fixed

- **ISO 26428-2 title, and stray "docLabel" text.** `ISO.26428-2.2008` carried Part 3's title; it is now "Part 2: Audio characteristics". A case-insensitive replace of "label" with "docLabel" during the per-doc migration (#1108) had also changed 7 more strings:
  - the titles of ISO 26428-3 and SMPTE ST 298:1997 (e.g. "Universal docLabels for …");
  - the `details` text of ST 291-1, ST 268-1 and ISDCF D04;
  - the recorded original title of both ST 400 editions.

- **ITU references link to the right Recommendation and edition.** `R-REC-BT.1680`-style ids lost their number as a fake year and resolved to the newest BT doc (21 refs, e.g. BT.1886, BT.1700, BS.2076, linked to BT.2020-2 or BS.1352-4). ITU `YYYYMM` editions weren't ranked, so undated BT.601 and BT.709 picked an arbitrary edition (601-4, 709-1); they now pick the newest (601-7, 709-6). A dated cite with no exact id now prefers the edition from that year (X.509 1997 → `T-REC-X.509.199706`; "SMPTE 299-2009" → `SMPTE.ST299-1.2009` instead of 299-2:2010).

- **Undated `Publisher.NNNN` references link to the right doc ([#2067](https://github.com/PrZ3r/MSRBot.io/issues/2067)).** The MRI read the document number in refs like `ISO.8601` as a year and stripped it, leaving the base `ISO`. As a result, 23 ISO refs (including ISO 3166 and ISO 8601) resolved to the newest ISO doc, ISO/CIE 11664-5:2024, and `IEC.1179` resolved to IEC 60958. The trailing number is no longer stripped when only a publisher prefix would remain. `mriFlush` now also drops a pointer it set itself once its presence check stops confirming it; extractor-set pointers are kept as before. 8 of the refs now resolve to their own registry editions (e.g. `ISO.8601` → `ISO.8601.2004`), and 16 become `known-publisher-no-doc`. A new `npm test` check, `referencing.datedTail.test.js`, covers this.
- **`msrbot.py search` no longer reads a stale search index (skill 1.5.2).** The helper cached the search files for 6 hours, so a copy from before the two-level format change (apiVersion 1 → 2) crashed `search` with `KeyError: 'index'`. The small `/api/search/` files are no longer cached, and an unsupported `apiVersion` is refused with a clear error.
- **Topic searches cover every document type and publisher (skill 1.5.2).** Internal claude.ai runs copied the skill's example scope ("SMPTE standards, RPs and EGs, plus ISDCF"). They missed **SMPTE RDD 52:2020** for a global DCP distribution question, and ISO 26432-2 for the LFE question. The skill now says to scope by publisher: search *all* of a publisher's document types (RDDs, overview documents and specifications included; papers only when asked), across every publisher in the domain (D-Cinema: SMPTE, ISO, DCI, ISDCF). New rules:
  - read **every** shard of every in-scope type and never pick shards by number range (a rerun skipped ST 1–402 as "unlikely"); say when journal articles and conference papers weren't searched;
  - don't characterize document types, approval processes or how binding a document is from memory (a run claimed RDDs skip due process, which is false);
  - don't claim more coverage than the search showed;
  - when a fetch tool's completeness answer is unclear, re-fetch asking only for count and last id.

  `prompt.md` mirrors these rules.
## [v2.6.0] - 2026-10-01

### Added

- **`msrbot-research` handles topic questions (skill 1.5.0).** A colleague's claude.ai test asked for D-Cinema standards on the LFE/subwoofer frequency range. Every fact in the answer was verified, but the *list* came from memory and missed SMPTE EG 432-2:2006. The skill now:
  - searches the `/api/search/` shards before recalling;
  - asks the fetch tool for complete lists and matches them itself;
  - fetches each candidate and follows its references one hop;
  - answers **PARTIAL**, naming the gaps and any recalled candidates, unless every in-scope shard was read whole.

  Search shards are now the preferred way to find a docId: a number with no row in a shard read whole is a true NOT FOUND, so "SMPTE ST 2067-99" no longer depends on the truncated `suites.json`. A truncated file that stops near the subject is treated as a lead. `scripts/msrbot.py` gains `search` (titles and keywords). `prompt.md`, `references/endpoints.md`, the `research/README.md` checklist and the `/ai` page are updated, with a new fifth test question (the LFE topic).

- **`/api/search/`: a compact search index sized for AI fetch tools** (first piece of #2036). There are three levels, and every file is ≤ ~25 KB so chat fetch tools read it whole:
  - `/api/search/index.json` (~18 KB) lists publishers, docTypes and counts.
  - `/api/search/{publisher}.json` lists that publisher's shards, with each shard's `first`/`last` docId range.
  - `/api/search/{publisher}/{docType}[-{n}].json` shards hold `{ id, label, title, keywords, status, date }` rows, natural-sorted by docId.

  Rows are **current editions**. Superseded editions are excluded when their replacement is in MSRBot, and kept (marked `superseded`) when it isn't, as for 13 older RFC/ITU/IEEE/ETSI documents, so every document MSRBot holds has a row. It totals 330 shards and 26,084 rows; SMPTE standards span 6 shards. The files are byte-stable (no build timestamps), validated by `/api/schemas/search.schema.json` (`apiVersion` 2.0.0; 1.0.0 was a single-level index with ~50 KB shards, live briefly before release), and listed on the API Explorer page and in the Dev Tools menu. Motivation: a claude.ai test asked a topic question about the LFE channel, and the skill couldn't search titles because the full slices are 0.4–5 MB, so it missed SMPTE EG 432-2:2006 even though "LFE" is in its title and keywords. A later run found ~50 KB shards reported as cut off when an agent asked for verbatim matches, hence 25 KB.

### Changed

- **`research/…/scripts/msrbot.py` carries the PrZ3 copyright header**, like the repo's other scripts. Skill plugin version 1.4.1; the next release's `msrbot-research.zip` includes it.

### Fixed

- **`Build MSI + MRI (PR)` no longer fails on Dependabot PRs.** Dependabot branches live in this repo, so the workflow took the privileged path and tried to mint the PrZ3 Unit app token — but `pull_request` events from Dependabot read the separate Dependabot secret store, where `APP_ID`/`APP_PRIVATE_KEY` do not exist, so the job died on its first step. Dependabot now takes the same read-only drift-check path as fork PRs. The `SAME_REPO` gate is renamed `CAN_WRITE`, which is what it actually decides.

## [v2.5.0] - 2026-09-28

### Added

- **"Use MSRBot with AI" page at [msrbot.io/ai/](https://msrbot.io/ai/).** It explains what the `msrbot-research` skill does and how to get it:
  - claude.ai / Desktop, with a download button pointing at `releases/latest/download/msrbot-research.zip`;
  - a whole Claude organization (Sync from GitHub);
  - Claude Code;
  - ChatGPT, Gemini and Copilot.

  It also has the copy-paste prompt with a Copy button, and the four test questions. The prompt is read from `research/prompt.md` at build time, so the site can't drift from the repo. The page is linked from the home page's Explore row and the Dev Tools menu, listed in `sitemap.xml`, and `ai` is reserved as a portal slug.

### Changed

- **Release zip is attached automatically again.** Immutable releases are now off for this repo, so the `Attach research skill to release` workflow can run on `release: published`. It attaches `msrbot-research.zip` seconds after any release is published, with no manual step (this replaces v2.4.1's draft-then-run-workflow flow). It can still be run by hand with a tag, and it skips releases that are immutable (v2.3.0 through v2.4.1). AGENTS.md and `research/README.md` are updated.

## [v2.4.1] - 2026-09-28

### Fixed

- **Release zip workflow works with immutable releases.** v2.4.0's attach step failed with "Cannot upload assets to an immutable release": the repo locks releases on publish, so a `release: published` trigger is always too late. The workflow is now **Publish release** (manual run with a tag). It attaches `msrbot-research.zip` to a **draft** release and then publishes it. v2.4.0 shipped without the zip and can't be amended; the next release carries it. AGENTS.md release hygiene and `research/README.md` document the draft-then-publish steps.

## [v2.4.0] - 2026-09-28

### Added

- **`research/`: MSRBot research skill for AI assistants.** `msrbot-research` is an Agent Skill, packaged as a Claude Code plugin. It makes assistants answer media-standards questions only from MSRBot records fetched during the conversation:
  - it cites each record's URL and `lastModified`;
  - it follows `supersededBy`, and cross-checks the family list, to find the current edition;
  - it names every medium- or low-confidence `$meta` field it relies on;
  - it separates **NOT FOUND** (a complete check) from **COULD NOT VERIFY** (a blocked or truncated lookup), so a cut-off search never reads as absence.

  It includes a read-only helper using only the Python standard library (`scripts/msrbot.py`: `find` / `family` / `get` / `current` / `editions` / `ref`). `research/prompt.md` carries the same rules as a copy-paste prompt for ChatGPT and other tools, and `research/README.md` is the install guide with a four-question test checklist. The skill was refined over four rounds of claude.ai testing (plugin version 1.4.0). It tracks epic #2032; update it as the lookup, search, lineage and MCP work lands.
- **Plugin marketplace at the repo root** (`.claude-plugin/marketplace.json`). Install with `/plugin marketplace add PrZ3r/MSRBot.io`, then `/plugin install msrbot-research@msrbot`. A claude.ai org Owner can also sync the repo under **Plugins & skills → Sync from GitHub**.
- **Every release carries the skill.** The new `Attach research skill to release` workflow (`.github/workflows/release-skill-zip.yml`) builds `msrbot-research.zip` from the release's tagged commit when a release is published, and attaches it. `releases/latest/download/msrbot-research.zip` is therefore always the newest copy. It can be run by hand for an existing release.

### Changed

- **README:** new **Use MSRBot with AI assistants** section, covering what the skill does and how to get it for claude.ai, a whole org, Claude Code, and other AI tools.
- **AGENTS.md release hygiene:** the zip is attached automatically; bump `research/.claude-plugin/plugin.json` `version` if the skill changed; publish releases from a user account (releases created with the workflow `GITHUB_TOKEN` don't fire the attach step).

## [v2.3.0] - 2026-09-24

### Changed

- **Contributor path documented** — `docs/CONTRIBUTING_SHORT.md` explains how a fork contributor graduates to a branch: what each stage gets from CI, that GitHub's approval step is asked once per new contributor (`first_time_contributors`) rather than per PR, and that the step guards runner time (`npm ci` runs the PR's own lifecycle scripts) rather than credentials, since fork runs get no secrets.
- **Fork PRs now run the checks** — the preview and MSI/MRI workflows gated their whole job on `head.repo.full_name == github.repository`, so a fork PR got no CI at all. Only writing needs privileges, so the gates moved onto the individual write steps: fork PRs now run checkout, canonicalize (sanity), `validate`, `npm test` and a full site build, and the MSI/MRI job rebuilds both reports and reports any drift in its job summary. What still can't happen for a fork is the preview deploy, the `chore(reports)` commit and the PR-body summary — GitHub withholds secrets and write tokens from fork PRs (not something "approve and run" changes on a public repo), and Actions cannot push to a fork's branch. Both workflows now check out the PR's **merge commit**, which is also what makes a fork's head usable. `npm test` added to the preview checks.
- **Issue + PR templates refreshed** for the post-#1266 workflows — PR validation checklist had the wrong script names (`build:msi` / `build:mri` → `build-msi` / `build-mri`), and now states that MSI/MRI are rebuilt by CI inside the PR (don't hand-edit `src/main/reports/`; `git pull` after the bot's `chore(reports)` commit), plus prompts for the data-change and refMap before/after callouts AGENTS.md asks for. Feature template gained **Acceptance** / **Related** sections and a pointer to the current surfaces; bug template gained a **Where** checklist with the live workflow names. Removed the duplicate `.github/PULL_REQUEST_TEMPLATE.md` (it differed from `pull_request_template.md` only in case, so the two couldn't coexist in a checkout on a case-insensitive filesystem). `docs/CONTRIBUTING_SHORT.md`: local-checks list de-duplicated and split into always-run vs depends-on-what-you-touched, CI-behaviour table replaced the stale "MSI/MRI run on push to main" list, and a **Branch or fork?** section explains that fork PRs get no secrets, so the preview deploy and MSI/MRI rebuild skip for them.

### Fixed

- **gh-pages publish no longer lazy-fetches from the remote** — `publishGhPages.sh` clones blob-less, so `git write-tree` couldn't find the blobs the carried-over tree references and fetched them from the promisor remote on every deploy; `git diff`'s rename detection did the same. Now `write-tree --missing-ok` and `diff --no-renames`, so a publish needs no extra round trip (and works where that fetch is refused — it failed outright when run outside Actions).
- **gh-pages deploy no longer fails after a successful publish** — `publishGhPages.sh` hashes ~50k files into its throwaway clone, which trips git's auto-`gc`; the background repack raced the `trap … EXIT` cleanup, so `rm -rf` hit "Directory not empty" and its exit code failed an already-finished deploy (seen on the PR #2022 preview: gh-pages published, step still red). Housekeeping is now disabled in the temp clone (`gc.auto=0`, `gc.autoDetach=false`, `maintenance.auto=false`) and cleanup can no longer set the step's exit status.

## [v2.2.0] - 2026-09-22

### Added

- **SMPTE canonical-repository audit (phase 1)** — new backfill project against the two canonical corpora SMPTE delivered under `_source/SMPTE/` (`Journal Article Repository`, 24,389 XMLs 1916–2026; `Conference Repository`, 2,075 XMLs 1969–2025). Corpus mapped across three XML shapes (`<publication>` IEEE IDAMS pre-2024 ~97%, `<content_batch>` IEEE content-delivery 2024–26 wind-down, `<article>` NLM JATS post-IEEE; 2024 = the SMPTE-leaves-IEEE transition with dual delivery). SMPTE's own published importer (smpte-journal-library, BSD-3) adopted as the required-minimum floor — `runSmpteCanonicalImport.mjs` dumps 24,173 journal + 1,999 conference articles to canonical JSON. Cross-check: 23,408 registry docs matched by DOI, ~2,753 canonical-only docs to ingest, 654 registry-only docs missing upstream. All project tooling/reports under `src/main/{scripts/extras,reports}/smpte-canonical-audit/` for one-line cleanup. (PR #1238)
- **Schema 2.4.0** — `authors[].email` + `authors[].orcid`, `isbn` media split (string | `{print, electronic}`, mirroring `issn`), `conferenceLocation`, `conferenceDate {start,end}`, `journalTitle` (era-accurate journal name at time of publication). Approved via a full-corpus source field census (`sourceFieldCensus.mjs`: 26,464 XMLs, 1,986 distinct element paths classified); license/sourceIds promotions reviewed and vetoed. (PR #1238)
- **Canonical field backfills** — era-accurate `journalTitle` on 21,905 journal docs (Transactions → JSMPE → SMPTE Journal → MIJ, as published); 2,378 `publicationDate` month corrections (Jan-1 placeholders → canonical month); 462 abstracts; 240 vocab-mapped keyword fills (56 curated additions to `controlledKeywords`, 294 → 350, with a 35-entry synonym fold table); 2,217 title updates from the 2,294-row drift review (canonical richer: subtitles, full book-review titles; 68 registry-richer rows kept for push-back; IEEE inline `<tex>/<sup>/<inf>` markup converted to Unicode — restored fractions the original HIGHWIRE import lost, e.g. "4½-Inch Image-Orthicon"); 60 author fixes (45 OCR/prefix name corrections + 15 count-mismatch rebuilds, bio/affiliation preserved); 5 pubYear digit-error fixes with shard re-homing. All writes `$meta`-stamped `smpte-canonical-repo@v1` with `originalValue`. (PR #1238)
- **XY twin merge + DOI truth table** — verified via the doi.org handle API that the DOI registrar is case-insensitive: `10.5594/J18049` ≡ `10.5594/j18049`, one DOI owned by ONE of the two same-numbered documents; SMPTE re-registered the other under the `XY` suffix. The registry had imported the re-registered article twice (HIGHWIRE plain-DOI mispointer + canonical XY): 147/147 pairs identical pages → merged via `mergeXyTwins.js` (XY survivor keeps richest fields — 45 reference unions, 4 author, 3 abstract, 2 title takes; survivor `doi$meta.note` records the duplicative plain-DOI registration; donors retired). J/j case-siblings (150 pairs, 0 same-year/title — genuinely different documents) never touched. `smpte-upstream/doiTruthTable.md`: all 147 XY DOIs correctly registered; 107 plain DOIs correctly owned by case-siblings; **39 plain DOIs still point at IEEE Xplore** (legacy registrations — registrar update list for SMPTE). `smpte-upstream/awsLibraryMissing.md`: 654 registry docs with resolving DOIs absent from the canonical library. (PR #1239)
- **`_source` opaque-file split** — `moveOpaqueSourceFiles.js` relocated 163,806 non-parseable files (PDF/images/zip/office, 165.49 GB) from `_source/` to a sibling `_archive/`, preserving directory structure; parseable XML/JSON/XSD stays in place for extractors.
- **Phase 3a/3b NLM ref-list extraction** — `extractSmpteJournalRefs.js` + `extractSmpteConferenceRefs.js` pulled ~38k journal-article and conference-paper references (canonical refIds + source-anchored slugs) from the HIGHWIRE NLM corpus into `references[]` + MRI, with the #1229 content-hash + cite-text pre-check baked into 3b. (PRs #1228, #1230)
- **Zoho status cross-fill** — `status.withdrawnDate` + `status.statusNote` field defs added to the Zoho cross-fill; statusNote transform drops supersession blurb (already derived from `supersedes*`) and Zoho-internal markers ("THIS IS A DUPLICATE RECORD…"). (PR #1235)
- **Phase 1a resolver** — new `resolveSmpteSourceRefs.v2.js` replays PR #1111's leftover unresolved-refs bucket against today's corpus + MRI v2 slug system. Filters to **602 entries from Standards-family source docs** (Standard / EG / RP / RDD / Specification / Technical Specification / Administrative Guideline); the remaining 359 entries from Journal Article + Conference Paper sources stay in the report for Phase 3a/3b. Resolution chain: vol+pages SMPTE-self-cite (against the ~18k ingested journal corpus) → `parseRefId(<standardnum>, <online-cite>)` → `parseRefId(cite, online-cite)` → `mapRefByCite` → conservative 1:1 title-match against the registry → MRI v2 slug-mint fall-through. Dry-run summary: **26 canonical resolutions** (17 direct registry hits + 9 `mri-known-no-doc`) and **576 slug-mints** for refs PR #1111 silently dropped. Under MRI v2, slug-minted refs are NOT silent — they land in the source doc's `references[]`, the MRI entry carries the raw `<ref>` XML + citation text, and the doc page renders them inline as `<cite>citation text</cite>` with an `EXTERNAL` badge instead of dropping them. Slugs can graduate to canonical refIds later via `resolveOrphans` once a new parser family or refMap entry covers them. Tooling commit lands the script + dry-run reports (`src/main/reports/smpteSourceRefs.v2.{json,md}`); the registry-mutating `--apply` is handed to the user per the bulk-apply convention. **`refsReaudit.{json,md}` refreshed** to reflect the post-apply state: total ref-entries audited goes **8,995 → 9,547** (+552 after content-hash dedup), `orphan-slug` count goes **70 → 598** (+528 — the slug-mint recovery), and headline "resolved %" goes **82.71% → 78.16%** — note: the % drop is the **right** direction. The earlier 82.71% was inflated by silently dropping the 602 unresolved refs; under the slug system they're visible as orphan slugs in the denominator, so the rate gets larger faster than the resolved numerator. The corpus is now more honest about what's known vs unknown, even if the headline number looks worse.
- **Pre-#1171 audit pass** — refreshed [`mriCoverageGaps.{json,md}`](src/main/reports/mriCoverageGaps.md) (PASS — slug-system invariant holds across the 528 new orphan slugs; every `doc.references[]` entry present in `MRI.refs[]`) and `refsReaudit.unmappedFields.{json,md}`. Establishes the baseline registry/refs state ahead of the [#1171](https://github.com/PrZ3r/MSRBot.io/issues/1171) `rawSource` envelope migration. Validators run clean: `npm run validate` (all 4 registries pass), `npm run validate-mri-coverage` (PASS, 9,547 entries audited).
- **Docs touch-up** — `docs/smpte-source-backfill.md` updated: original "~961 unresolved" markers now reflect the 602 → consumed-by-Phase-1a / 359 → remain-for-Phase-3a/3b split. Outcome block calls out PR #1210 explicitly.
- **Authors-to-object-form migration + SMPTE HIGHWIRE backfill** — closes [#1196](https://github.com/PrZ3r/MSRBot.io/issues/1196). Two-pass `migrateAuthorsToObjectForm.js`: (1) walk all 21,389 NLM XMLs under `_source/SMPTE/HIGHWIRE/` to build a `docId → [{name, affiliation?, bio?}]` index from `<contrib-group>` + `<aff>` + `<bio>` cross-references; (2) walk the registry and migrate every doc whose `authors[]` is still in legacy string form to schema 2.3.0 object form, enriching from the HIGHWIRE index where DOIs match and author counts agree. Idempotent — docs already in object form (e.g. the 10.5594-j18501 v2.1.0 demo) are skipped. Dry-run summary against the current corpus: 26,445 total docs, 15,694 with no `authors[]`, 1 already-object, **10,750 to migrate** — of those, **9,805 enriched from HIGHWIRE** (registry name preserved verbatim, NLM `<aff>` attached as `affiliation` and `<bio>` as `bio` per author), **945 shape-only** (non-SMPTE long tail with no HIGHWIRE source), **1 count-mismatch fallback** (HIGHWIRE author-count differs from registry — shape-only for safety). Net data added: **11,331 affiliations + 1,602 bios** across the SMPTE journal-article corpus. Tooling commit lands the script + dry-run report (`authorsMigration.{json,md}`); registry-mutating `--apply` is handed to the user per the bulk-apply convention. Invoke directly: `node src/main/scripts/extras/migrateAuthorsToObjectForm.js [--apply]`.
- **IETF extractor — shape-only authors object form** — [providers/ietf.parse.js](src/main/scripts/providers/ietf.parse.js) emits `[{name}]` instead of `["X"]` at both author boundaries (RFC docs + archive-XML docs). `pickFirstArrayWithSource` made polymorphic so it preserves objects with `.name` while still string-coercing other fields (keywords). No source-archive mining yet; affiliation/organization extraction from RFC XML `<organization>`, Datatracker JSON, and HTML meta tracked in [#1211](https://github.com/PrZ3r/MSRBot.io/issues/1211) (small focused PR, requires a re-extract of the 52 IETF docs).
- **Author Affiliation facet disabled** in [build.search-index.js](src/main/scripts/build.search-index.js) + [docList.js](src/site/js/docList.js). The #1196 backfill landed **6,936 distinct raw affiliation strings** — every spelling/punctuation variant from the source XML survives (`"RCA Manufacturing Co., Camden, N. J."` vs `"RCA Manufacturing Co., Camden, N.J."` vs `"RCA Manufacturing Co."` are 3 buckets for 1 institution). Even ~500 raw strings would be unusable as a picker. Per-doc `affiliations` array still emitted on each idx row so full-text search keeps matching affiliation strings and `?f.affiliations=<exact string>` URL filters still work. Affiliation normalization / fuzzy clustering (collapse ~7k raw → ~1–2k canonical institutions, then re-enable the picker) tracked in [#1214](https://github.com/PrZ3r/MSRBot.io/issues/1214).

### Changed

- **`articleType` → `contentType` (field + vocabulary)** — registry contentType values conform to SMPTE's ContentTypeEnum (10 value renames across 8,823 docs: `research-article`→`orig-research`, `abstract`→`summary-abstract`, `obituary`→`obit`, `book-review`→`review`, `calendar`→`future-events`, `announcement`→`content-announce`, `correction`/`addendum`→`errata`, `letter`→`opinion`, `reprint`→`orig-research`) PLUS nine retained MSRBot-finer values (meeting-report, news, other, editorial, discussion, review-article, introduction, oration, article-commentary). The field itself renamed `articleType` → `contentType` across 24,209 docs and 10 code surfaces (schema, templates, search index, page gate `noPageContentTypes`, `contentTypeLabels`, buildStats, extractors, client JS) with a `?f.articleType=` → `?f.contentType=` URL back-compat alias. The vestigial 1-doc `contentType` free-string field was dropped first. (PR #1238)
- **contentType distribution cleanup (small → big)** — every tier reviewed by title against the canonical labels: 1,504 `summary-abstract` conference/journal papers were full papers mislabeled by the HIGHWIRE delivery → `orig-research` (with 28 title-review exceptions to discussion/oration/tutorial/introduction); the `info-society` catch-all split 3,581 department pages onto the finer enum (`toc` 1,259, `front-cover` 1,020, `list-staff` 1,028, `advert` 274) + 710 review-approved reclasses (545 hidden research papers); `news` consolidated 1,137 moves incl. the New-Products split-brain; `orig-research` inverse-scan moved 376 departmental docs out (committee reports → meeting-report 252, Forewords → introduction, first use of `awards`); officer-message rule (all "Message from the …" → info-society, 53 caught in orig-research/toc); `other` emptied. Full decision trail in `smpte-canonical-audit/` reports.
- **gh-pages kept as a single commit; faster deploys** ([#1265](https://github.com/PrZ3r/MSRBot.io/issues/1265))
  - **Why:** gh-pages had about 1,419 commits of build output (most of the ~6.5 GB repo). Pages only serves the latest commit, and every version can be rebuilt from `main`.
  - **New `src/main/scripts/ci/publishGhPages.sh`** (modes `site`, `preview <n>`, `remove-previews <n…>`), used by all four gh-pages writers: `build-msr-site`, `pr-build-preview`, `pr-preview-cleanup` and `pr-preview-sweeper`.
    - It publishes gh-pages as **one commit with no parent**, so every deploy replaces the history.
    - Nothing is checked out: it clones only gh-pages' directory structure and builds the new tree in git's index, so only changed files are uploaded.
    - It replaces the clone → `rm -rf` → `cp -r` → `git add -A` sequence, the 152k-file checkout, and the `pull --rebase` retry loops.
  - **Safe with concurrent deploys, no lock:** it pushes with `--force-with-lease` against the commit it cloned. If another deploy landed first, it rebuilds on the new tip and retries, so no deploy can overwrite another's. (A shared `concurrency` group would drop all but one queued run.)
  - **Production checkout ~8 min faster:** `build-msr-site.yml` checked out with `fetch-depth: 0`, pulling every branch's full history including gh-pages (479 s per run). The build only needs `HEAD`'s SHA, so it now uses a depth-1 checkout.
  - **Rolling back:** re-run "Build MSRBot.io Site and Test" (`workflow_dispatch`) on an earlier `main` commit, or revert on `main`. There is no gh-pages history to revert.
  - The **first deploy after merge drops the old gh-pages history.** GitHub reclaims the space on its own garbage-collection schedule; ask GitHub Support to run GC if the reported repo size doesn't fall.
- **MSI/MRI rebuilt inside the PR; issue sync moved to after merge** ([#1266](https://github.com/PrZ3r/MSRBot.io/issues/1266), parts B–D)
  - **Why:** every data merge used to set off a chain: a site build (using stale MSI/MRI), then MSI (which polled up to 60 min for that build), then MRI (via `workflow_run`), then bot report PRs, then a second site build. Skip-marker artifacts and `onlyMeta` guards existed only to stop that loop.
  - **New `build-reports-pr.yml`:** runs on PRs touching data/input/config/`src/main/lib/` or the MSI/MRI scripts, including the bot's extract PRs.
    - It first merges the latest `main` into the branch, so reports are always "main + this PR". Conflicts only in report files resolve to `main`'s copy and are then regenerated; any other conflict stops for a human (`src/main/scripts/ci/mergeMainForReports.sh`).
    - It then rebuilds MSI and MRI (full replay) and commits any report change back to the PR branch as `chore(reports): rebuild MSI/MRI`. Contributors need to pull before pushing again.
    - It keeps an auto-updated **MSI / MRI** section in the PR body (`src/main/scripts/ci/reportsPrSummary.js`), rewritten in place between hidden markers: lineage and UNKEYED changes, MRI ref/resolved counts, newly resolved and newly missing refs, and the changed files.
    - **After any data/report merge to `main`,** the new `refresh-data-prs.yml` merges `main` into every other open data PR (nothing is rebuilt on `main` itself). That re-triggers the rebuild there, so overlapping PRs (e.g. the SMPTE and IETF extracts) never ship stale counts and never conflict on the reports' summary lines.
    - **The PR preview waits for the rebuild** (`pr-build-preview.yml` gets a `reports-gate` job). If the rebuild pushes a report commit, that commit's preview is the one that builds, so a preview never shows stale reports. Site/template-only PRs proceed after a ~90 s check.
    - One merge now ships data and reports together, and the site builds once.
    - A manual run on `main` opens a report PR instead.
  - **New `sync-report-issues.yml`:** runs on pushes to `main` that change `masterSuiteIndex.json` / `mri_presence_audit.json`, weekly (Wed 05:30 UTC), and on demand. It syncs `UNKEYED` and `MISSING REF` issues using scripts moved out of the inline workflow code into `src/main/scripts/ci/` (with tests).
  - **Fixes in the missing-ref sync:**
    - Issue bodies are compared without the per-run footer. Before this, every run "updated" up to 75 unchanged issues, used up its budget, and never created new issues. That's why only 295 of 974 missing refs had issues.
    - Resolved issues are closed before new ones are created.
    - Duplicate open issues (same title) are closed, keeping the oldest.
    - **Expect** the first runs to close about 70 resolved issues and 48 duplicates, then file about 680 new `MISSING REF` issues at up to 75 per run until the tracker matches the audit.
  - **MRI build ~18× faster** (275 s → 15 s locally for the full 26.8k-doc replay). `mriRecordSighting` recounted every MRI ref (`Object.keys(mri.refs).length`, 46k keys) on each of the 55k sightings, which was about 90% of the run. `mriFlush` already computes the stats once. The output is identical.
  - **No more timestamps in the reports.** `generatedAt` is gone from `masterSuiteIndex.json`, `mri/index.json` and `mri_presence_audit.json`, and MSI's `sourceHash` (a hash of the whole registry) is gone too. Git history records when they changed. Rebuilding an unchanged registry is now byte-identical, so there's nothing to "ignore", and concurrent data PRs no longer all rewrite the same header lines. `suites.json` drops the two pass-through fields; nothing read them.
  - The completed one-shot `migrateMriToShards.js` has been removed now that its migration is applied.
  - **UNKEYED issues now actually sync after merges.** The old step was gated on `github.ref == main`, which a `pull_request: closed` trigger never satisfies, so it only ran on manual dispatch.
  - **Removed:** `build-master-suite-index.yml` and `build-master-reference-index.yml` (the chain, skip markers and the `chore/build-mastersuite` / `chore/build-masterreference` bot PRs). `validate-urls.yml` is unchanged; its `workflow_run` trigger on the removed MRI workflow simply no longer fires, and its schedule and throttle are unaffected.
- **MRI stored as one file per ref** ([#1266](https://github.com/PrZ3r/MSRBot.io/issues/1266), part A)
  - **Why:** `src/main/reports/masterReferenceIndex.json` had reached 99.97 MB, about 4.9 MB under GitHub's 100 MB per-file push limit. The upcoming IETF extraction would have pushed it over.
  - **New layout:** the MRI now lives in a directory store at `src/main/reports/mri/`:
    - `index.json` holds everything except the refs.
    - Each ref is one pretty-printed file: `refs/{prefix}/{refId}.json` for canonical refs, and `refs/orphan/{sourceDoc}/{refXmlId}.json` for orphan slugs.
    - 46,349 files, the largest about 0.1 MB.
  - **Store library:** every reader and writer now goes through `src/main/lib/mriStore.js` (`loadMri` / `writeMri`).
    - `loadMri` returns the same object shape as before.
    - `writeMri` rewrites only shards whose content changed, and bumps `generatedAt` only when something changed. An unchanged MRI therefore produces no diff, and a changed one shows exactly which refs changed.
    - Directory names are lower-cased, and case-only siblings (SMPTE `J`/`j`) get a `~hash` suffix, so checkouts are safe on case-insensitive filesystems.
  - **Presence audit:** `mri_presence_audit.json` now lists only non-orphan missing refs, the rows the missing-ref issue workflow and `seedBackfill.ietf.js` use. Orphans are counted (`orphanCount`, `orphansListed: false`), not listed. Size drops from 41.5 MB to 1.0 MB.
  - **Migration:** one-shot `src/main/scripts/extras/migrateMriToShards.js` (dry-run by default, `--apply`) verifies the shards are byte-identical to the monolith before deleting it.
  - **Workflows:** the MRI and extract workflows now commit the `mri/` directory.
  - **Tests:** new `mriStore.test.js`; `referencing.flush.test.js` ported to the store.
- **Deterministic build output (smaller gh-pages deploys)** — per-item pages and files no longer embed build time or the git SHA, so a rebuild of unchanged data is byte-identical and the deploy's `git add -A` commits only files whose content changed (previously every one of ~50k files was rewritten on every deploy). Doc pages' footer now shows **Record updated** (latest `updated` in any `$meta` block of the record, falling back to `publicationDate`) instead of **Site version / Generated on**; reftree, suite, collection and portal pages show neither. Site-level pages (home, docs/groups/projects lists, suites/reftree indexes, API, changelog, about) keep the site version stamp. `/api/doc/{docId}.json` drops the per-build `generatedAt` in favour of a content-derived `lastModified` (the `/api/documents.json` index keeps `generatedAt`). `sitemap.xml` `lastmod` is the doc's content date (core pages: newest doc date) instead of build time.
- **Build speedups** — per-doc `/docs/{docId}/` pages are rendered once (documents pass) instead of in all three documents-registry passes; `referencedBy` is computed from a single reverse index instead of an O(N²) scan; reference-tree attach uses a key lookup instead of `Object.keys(...).includes`.
- **Extras + reports hygiene** — 15 completed one-shot backfill/migration scripts and 24 obsolete report artifacts removed (registry `$meta` provenance stamps survive independently); `docs/smpte-source-backfill.md` tracking doc deleted per its own checklist; ongoing tooling kept: `validateMriCoverage.js`, `resolveOrphans.js`, `auditRegistryFields.js`. Backfill-driven canonical-audit scripts and reports segregated under project subfolders; durable SMPTE handoff reports under `src/main/reports/smpte-upstream/`. (PR #1235, #1239)

### Fixed

- **Case-sensitive DOI joins** — SMPTE reuses DOI numbers across eras distinguished only by case (`10.5594/J18027` 1917 vs `10.5594/j18027` 2011 are different documents; ~148 registry pairs). Audit matching had lowercased DOIs, cross-matching 4 of 7,371 applied contentType writes — repaired, all audit joins now exact-case. pubYear drift collapsed 114 → 5 on rematch (the survivors were genuine digit errors, all canonical-confirmed and fixed). (PR #1238)
- **Per-doc page emission vs case-colliding docIds** — on a case-insensitive filesystem (macOS local dev) `build/docs/10.5594-J18049/` and `…/j18049/` are the same directory, so the page-gate cleanup `rm` for a gated doc could delete its ungated case-sibling's freshly built page. Gate removals now run as a first pass before any writes (order-independent), a gated doc only removes a page whose canonical URL matches its exact-case docId, and the 148 collision groups are logged once per build. Production (Linux → gh-pages, case-sensitive) was never affected. (PR #1239)
- **Orphan-slug re-anchoring after the XY merge** — the merge united donor references into XY survivors but left source-anchored orphan slugs (`orphan/<donorId>/…`) pointing at retired docIds; the build lost lineage keys for 477 refs and a subsequent MRI prune deleted their entries. `fixMergedOrphanSlugs.js` renamed all 477 slugs to survivor anchors across 45 docs and restored the pruned MRI entries (full citation text/raw XML) from the committed MRI via `git show` — 477/477 recovered, 0 collisions. (PR #1239)
- **`J18005` volume/issue** — carried `volume: 120, number: 1` leaked from its 2011 MIJ case-sibling; corrected to Transactions vol 2, issue 6 per the DOI registration and its own docLabel. (PR #1239)
- **smpte-journal-library `PubDate.month` getter returns `_year`** (copy-paste bug in model.mjs) — worked around locally by reading `_month` in our serializer; upstream PR candidate for the SMPTE repo. Also surfaced for upstream: `info-author` outside ContentTypeEnum, a duplicate Front Cover in the 2023 MIJ issue 7, a missing `issuenum` in a 2018 doc, canonical OCR errors ("are projector"), and the M001489 canonical mislabel.
- **`mriFlush` no longer clobbers extractor-set `resolvedDocId` pointers on every build.** The "resolution truth" branch in [referencing.js](src/main/lib/referencing.js) used to treat `_findSourceDocIdForRefId(e.refId)` (refId-as-its-own-docId lookup) as the sole authority — when an extractor mapped a non-docId refId to a real registry doc (the N-to-1 slug→docId case the slug architecture was designed for), flush demoted the entry back to `resolvedDocId: null, needsResolve: "known-publisher-no-doc"` every time. Surfaced in PR #1201's auto-generated MRI data diff: `IETF.draft-ietf-tls-rfc8446bis-03 → RFC8446` (mapped by the IETF `ietf-rfc-html-fallback` / `rfc-text` resolution) reverted to unresolved, and the resolved/known-pub-no-doc stats moved 1814→1813 / 932→933 — same shape would have hit every parser-family resolution Phase 1b lands. Fix: the `else` branch now preserves an existing `resolvedDocId` that still points at a registered doc (via `_hasDocIdOrBase`), and only demotes when the existing pointer has gone stale or was never set. Sibling logic in the secondary flush path patched the same way. New regression test ([referencing.flush.test.js](src/main/scripts/test/referencing.flush.test.js)) pins both branches; `npm test` runs it after the existing registry smoke tests.

### Removed

## [v2.1.0] - 2026-06-18

### Added

- **MRI v2 — slug-keyed citation system: every cited reference is now addressable, renderable, and auditable.** Closes [#902](https://github.com/PrZ3r/MSRBot.io/issues/902) (`[FEATURE] Slug info for missing refs` — the `[NOT IN REGISTRY]` bare-slug render is replaced by inline `<cite>refId — citation text</cite>` + `EXTERNAL` badge for every MRI-known ref). A foundational shift in how unresolved references are modelled, surfaced, and progressively resolved over time. Before: refs the parser couldn't shape into a canonical refId fell off into `badRefs.latest.json` (a stale-by-day-2 sidecar) or `MRI.orphans.unmapped[]` (a flat list with no slug identity, unable to be cited from `doc.references[]`). After: every ref the build sees lands in `MRI.refs[]` as a first-class entry — either as a **canonical-form slug** (`ASME.B1.1.1989`, `RFC1642`) when the parser recognised a publisher family, or as a **source-anchored slug** (`orphan/<sourceDoc>/<refXmlId>` for raw-XML refs, `orphan/<sourceDoc>/h:<contentHash>` for cite-only refs) when it didn't. Doc files cite slugs as strings in `references[]`; future resolution work touches only MRI's `resolvedDocId` pointer, not the doc files (re-extracts may converge a slug to its canonical refId, but the MRI entry retains the per-sighting audit trail). **Authoritative architecture reference: [docs/mri-citation-system.md](docs/mri-citation-system.md)** — covers how a `doc.references[]` string actually resolves, the slug ↔ docId relationship, the resolution lifecycle, and worked lookup recipes. Concretely:
  - Every `MRI.refs[]` entry now carries `resolvedDocId` (the registry doc this ref points at, or `null`), `needsResolve` (`null` / `"known-publisher-no-doc"` / `"unknown-publisher"`), and `contentHash` — a 16-hex SHA-256 of the normalised raw `<ref>` XML that groups sightings of the same citation across multiple source docs, so one resolution decision propagates to every sighting that shares the hash.
  - **New `synthesizeCiteFromRawRef` helper** parses authors/article-title/pub-title/standardnum/volume/pages/year out of raw `<ref>` XML (both APTARA `<ref_authorgrp>/<ref_author>/<init>/<ref_surname>` and NLM `<name>/<surname>/<given-names>` shapes) and composes a human-readable citation string. Wired into the mint path so new orphans auto-populate `citationText` when extractors pass `rawRef` but no explicit cite. Backfilled **1,283 existing MRI entries** that had raw XML but no `citationText` — including books like Ousterhout's _Tcl and the Tk Toolkit_ (2nd ed., Addison-Wesley, 2009) that previously rendered as the bare slug.
  - **`docId.hbs` renders MRI-known refs inline as `<cite>refId — citation text</cite>`** with an `EXTERNAL` badge, instead of the bare `NOT IN REGISTRY` pill. The Handlebars `getStatus` helper returns `"MRI-KNOWN"` and the new `mriCite` helper produces the markup, with optional `<a>` wrap when MRI carries an `href`. Applies to the normative + bibliographic refs list and the supersededBy / amendedBy lists.
  - **Client-side cite rendering on the reference tree.** New `build/api/mri-cite-map.json` sidecar (~150 KB, ~982 entries) ships alongside the docs API. `refTree.js` fetches it at init alongside `documents.json` / `suites.json`, and for tree nodes whose target isn't in the registry but is in MRI renders the citation text inline plus an `EXTERNAL` badge. Root-view of an MRI-only ref disables the **Set as new root** button since there's no doc to drill into.
  - **The 69 source-anchored orphan slugs are now cited from their source docs' `references[]`** (27 docs touched). PR #1111's source-ref extractor had written them into MRI's legacy `orphans.unmapped[]` flat list but never written a citing string into the source doc — the slug migration created MRI slug keys but the doc files were still unaware. Now backfilled: e.g. `SMPTE.RP2073-2.2014`'s normative refs are 3 canonical + 3 orphan slugs = the full six refs its source XML carries, including the previously-invisible Ousterhout book.
  - **Build console is silent now.** The two warning classes the slug system makes redundant (1,298 `No lineage key derivable` + 120-294 `[WARN:getStatus] docId "X" not found in registry`, the latter scaling with the number of citing docs) are both fully suppressed when MRI has the citation info, or — for refs in neither registry nor MRI — silenced entirely on the grounds that the MRI presence audit + the `build-master-reference-index.yml` auto-issue workflow (#937-style "MISSING REF: RFC1642" issues) already capture the same population. The `[Refs] X: missing-lineage refs (unique) = N` per-doc summary line counts genuinely-unknown refs only.
  - **Forward-compatible resolution.** When you later run the IETF extractor and `RFC1642` lands as a registry doc, MRI's entry just gets `resolvedDocId: "RFC1642"` set and `needsResolve` cleared — no doc file edits. The renderer's `followMriResolution` helper chases the pointer in `getStatus` / `refHref` / `getLabel` so the doc page link goes straight to the resolved doc. When a new parser family graduates a `contentHash` group of orphan slugs, every sibling sighting upgrades in one pass. The `MRI.refs where resolvedDocId === null` query is the live backlog — no more stale-by-day-2 reports.
  - **`extractDocs.js` writes orphan slugs from extract end-to-end.** `onBadRefs` now routes through `mriRecordSighting` (which returns the minted slug) and queues each slug for application to the source doc's `references[]` right before save. So a fresh ingestion of, e.g., RFC1101 lands with `["…", "orphan/RFC1101/h:e25f0fbf"]` in `references.bibliographic[]`, MRI gets the matching entry, and the post-extract prune leaves it alone because the doc cites it. The legacy `src/main/reports/badRefs.latest.json` sidecar is removed.
  - **`resolveOrphans.js` (new extras script)** — idempotent MRI-only retry pass. Walks every entry with `resolvedDocId === null`, runs each through `registry-direct` / `parseRefId` / `mapRefByCite`, and graduates anything that now hits. `contentHash`-sibling propagation means one resolution updates every entry in a hash group in the same pass. No doc files touched. Run as often as you want — each newly-ingested target doc or newly-added parser family / refMap entry gives this pass more to graduate.
  - **Auto-issue workflow filtered.** `build-master-reference-index.yml` now filters `audit.missing[]` to `needsResolve === 'known-publisher-no-doc'` before creating "MISSING REF: X" issues. Source-anchored orphan slugs stay queryable through the audit and MRI itself but no longer flood the issue tracker. The audit emits `knownPubNoDocCount` + `orphanCount` summary fields alongside `missingCount` so dashboards can read intent without re-scanning.
  - **New `src/main/scripts/extras/migrateMriToSlugSchema.js`** handles the in-place schema lift on existing MRI (idempotent); `referencing.js`'s `_ensureRef` and `mriRecordSighting` mint the slug schema going forward; `documents.validate.js` cross-checks `git ls-files` against `fs.readdirSync` per doc to catch macOS case-only drift locally before CI.
- **SMPTE NLM journal-article + conference-paper backfill** — ~19,587 NLM-extracted SMPTE journal articles (1916–2015 Transactions / SMPE / SMPTE Journal / MIJ era) and ~1,503 conference papers loaded into the per-doc registry from `_source/SMPTE/HIGHWIRE/`. New `src/main/scripts/extras/extractSmpteJournalArticles.js` handles the NLM XML; corpus selection via `--corpus journal|conference|both`. Closes [#1172](https://github.com/PrZ3r/MSRBot.io/pull/1172).
- **APTARA journal-issue cross-fill (~22.5k docs)** — `extractSmpteJournalIssues.js` enriches existing journal-article docs with structured metadata (ISSN, copyright, publisherLocation, articleType, abbrevTitle) from `_source/SMPTE/APTARA/...journal_metadata` XMLs. Limit-aware chunking counts actual writes, not iteration position, so resumable runs converge.
- **`articleType` page gate** — `site.json#noPageArticleTypes` lists `articleType` values that don't get rendered site pages. Initial set: `obituary`, `other`, `news`, `calendar`, `announcement`, `correction`, `addendum`, `reprint`. Gated docs are skipped at the per-doc page, reference-tree, and sitemap emit loops, and dropped from `search-index.json`/`facets.json` so they don't appear in the browse list either. Stale pages from earlier builds are removed on rebuild. Gated docs remain fully present in the API and registry — the gate only suppresses generated pages, not data. New `src/main/lib/pageGate.js` drives the decision; matching is case-insensitive but exact-value.
- **`articleType` shown on doc pages** — surfaced in `docId.hbs` directly below Doc Type when present.
- **Journal Article breakdown in `/api/stats.json`** — new `documents.journalArticles` block: `{ total, articleTypes, byArticleType }` (sorted descending by count). Stats `apiVersion` bumps `1.0.0 → 1.1.0`.
- **SMPTE DOI re-registration ask list** — `src/main/reports/smpteDoiReRegistrationAskList.{md,csv}` enumerates the 96 SMPTE docs where the registered DOI form drifted from the registry-canonical form (malformed double-prefix, year-mismatch, registrar typo, amendment-notation drift), grouped by pattern, with `should-be (canonical)` target per row — direct hand-off format for SMPTE DOI re-reg.
- **Keyword vocab scrub** — new `src/main/scripts/extras/scrubKeywordVocab.js` audits every doc's `keywords[]` against `site.json#controlledKeywords` (canonical / case-drift / out-of-vocab / synonym buckets) and applies AUTO_FIX renames + DROP cleanup in `--apply` mode. Report at `src/main/reports/keywordVocabScrub.md`.
- **Refs re-audit + schema 2.3.0 prep.** Two new extras walkers (`reaudit-refs`, `reaudit-unmapped-fields`) re-classify every ref-entry across the now-complete corpus and tally source-XML element paths against schema 2.2.0 + the existing `sourceInventory.smpte.schemaMap.md` decisions, so we can scope the upcoming ref-resolution/extraction passes without guessing. Headline numbers from the refs walker: **8,995 ref-entries** across **1,066 docs** at **82.71% resolved** (66.60% direct, 16.11% via MRI); **1,485** are `mri-known-no-doc` (canonical refIds whose targets aren't ingested — top families: IEC 127, ITU-R 108, ISO 107, ITU-T 61, ATSC 42, ANSI 39, intra-SMPTE 32) and **70** are source-anchored orphan slugs. **Zero `unparseable`** — every string in `references[]` already routes through `parseRefId` or the slug system. Source-XML walker confirms Phase 3a/3b's universe (~13,418 `component/reflist/ref` sightings in 1.5k sampled APTARA + Allen Press files; ~2,865 NLM-shape `article/back/ref-list/ref` in 1.5k HIGHWIRE Source Bak; full corpus scales to roughly hundreds of thousands of citation sightings, much of which dedupes through the MRI content-hash). Reports at `src/main/reports/refsReaudit.{json,md}` and `src/main/reports/refsReaudit.unmappedFields.{json,md}`.
- **Schema 2.3.0** — `authors[]` items now accept an object form `{ name, bio?, affiliation? }` in addition to the legacy string form, so NLM journal-article author metadata (1,939 `bios` sightings + 1,774 `organization` sightings surfaced by `reauditUnmappedFields.js`) can land as first-class data on Phase 3a extraction. `$id` bumps `2.2.0 → 2.3.0`; the legacy string form remains valid for every existing doc. Worked sample landed at [10.5594-j18501.json](src/main/data/docs/smpte/journal-article/2015/10.5594-j18501.json) — _Study on the Acceptance of Higher-Frame-Rate Stereoscopic 3D in Digital Cinema_ (Ruppel, Alff, Göllner) — all three authors populated with `name` + `bio` + `affiliation` parsed from `_source/SMPTE/APTARA/.../MIJR15Vol124No1.xml`. Validator passes (0 errors across 26,445 docs). Issue [#1196](https://github.com/PrZ3r/MSRBot.io/issues/1196) tracks the full migration sweep + extractor updates (IETF, NLM/HIGHWIRE, APTARA, Allen Press, Zoho cross-fill).
- **MRI coverage validator** — new `npm run validate-mri-coverage` ([validateMriCoverage.js](src/main/scripts/extras/validateMriCoverage.js)) asserts the slug-system invariant: every string in any doc's `references.{normative,bibliographic,supersededBy,amendedBy}[]` must exist as a key in `MRI.refs[]`. Exit 0 on clean, exit 1 with a structured per-leak report (`docId`, category, ref string, leak-kind classification) when broken, exit 2 on script-level errors. Runs clean on current corpus — 8,995 ref-entries across 1,066 docs all present in MRI's 2,816 entries (3.2× dedup via content-hash collapse). Locks in the invariant against future extractor regressions so a render-time "NOT IN MRI" never reaches the UI — the build should fail loudly first. Reports persist to `src/main/reports/mriCoverageGaps.{json,md}` even on success for the audit trail. CI wiring is the next pass; the script is meant to drop into `build-master-reference-index.yml` after the MRI flush.
- **Schema 2.2.0 + 2.3.0 fields rendered on doc pages, indexed for search, and added as browse facets — closes [#1097](https://github.com/PrZ3r/MSRBot.io/issues/1097).** Eleven new rows on `docId.hbs`: `volume` / `number` / `pages` / `chapter` (basic citation block — somehow never rendered before despite being in the schema since v1), `approvalDate`, `abbrevTitle`, `copyright` (`{holder, year}` as `© year holder`), `publisherLocation` (`{city, country}` inline next to publisher), `issn` (handles both legacy string + 2.2.0 `{print, electronic}` object — renders as `Print: 1545-0279 | Electronic: 2160-2492`), `icsCodes` (`[{code, description}]` — each code as a clickable link with the ISO description shown inline after), and a rewrite of the `authors[]` loop to handle the 2.3.0 object form — one author per line; `name` left, optional `affiliation` right-aligned as a muted text link to the affiliation facet; optional `<details>` bio expander matching the existing "Undated variant" pattern; subtle `border-top` divider between authors so multi-author blocks with bios don't crowd. Legacy string-form `authors[]` (the entire 26,444-doc corpus pre-#1196 migration) keeps rendering as before via fall-through. Doc list **card previews** also gain three new touches: `articleType` chip in the badge row right after `docType`; `Affiliation:` row between badge row and publication date; `ICS:` row above keywords with the ISO description as a hover tooltip. Search index ([build.search-index.js](src/main/scripts/build.search-index.js)) now indexes `doiAliases[]` (so ISBN-form / legacy DOIs resolve to canonical doc), `abbrevTitle`, `authors[].affiliation`, and `authors[].bio` (full-text). Three new browse facets on the doc list — `articleType` (`research-article` 6,147 docs, `orig-research` 683, etc.), `icsCodes.code` (top: `33.160.01` Audio/video/audiovisual systems @ 813 docs across 19 codes), and `authors[].affiliation` (sparse today — populates as #1196 migration + Phase 3a extraction land). Label maps emitted into `facets.json` so picker + applied-filter pills both render friendly forms: `articleTypeLabels` driven by [site.json](src/main/config/site.json)'s 22-entry map (`research-article → Research Article`, `orig-research → Original Research`, `info-society → Society Information`, etc., covering both gated and ungated values), and `icsCodeLabels` collected during build (first non-empty description per ISO code wins — ISO codes are canonical, so any doc's copy serves). The facet picker for ICS shows `<code>{{code}}</code> {{description}}` so the meaning is readable at a glance, not just on hover. Pure-internal fields (`standardId`, `productNumber`, `familyId`, `journalAcronym`, `releaseTag`, `contentType`, `docElement`, `depositDate`, `resolvedHref`, `workInfo`, `xmlNamespace`, status process internals like `stage` / `state` / `latestVersion` / `versionless` / `publicCd` / `withdrawnNotice`) remain API-only by design — the doc-page metadata block is for citation + browse context, not committee/process plumbing.

### Changed

- **`/api/documents.json` is now a lightweight index** (`apiVersion` bumps `1.0.0 → 2.0.0`) — the full-bundle shape grew past GitHub's 100 MB per-file limit on the `gh-pages` branch as the SMPTE journal-article backfill landed. The endpoint now emits one row per doc — `{ docId, publisher, docType, docLabel, docTitle, articleType?, path }` — each linking to `/api/doc/{docId}.json` for the full record with `$meta` provenance. Drops the file from ~120 MB to ~7 MB and stays small as the corpus grows. Per-doc shards are unchanged and remain the canonical full-data endpoint. Closes [#1173](https://github.com/PrZ3r/MSRBot.io/issues/1173).
- **SMPTE journal-article DOI case is preserved end-to-end** — `10.5594/J*` (uppercase J — pre-1955 Transactions era) and `10.5594/j*` (lowercase j — 2010+ Motion Imaging Journal series) are now treated as **distinct DOI namespaces** pointing to different articles. `doiToDocId` in `parseSourceName.js` no longer force-uppercases the leading letter; `documents.validate.js` + `lib/registry.js` sort case-sensitively so `j*`/`J*` occupy distinct positions. The earlier `fixLowercaseSmpteDocIds.js` cleanup that conflated lowercase-j with case drift is deleted; its 308 wrongly-deleted MIJ articles are restored. Closes [#1188](https://github.com/PrZ3r/MSRBot.io/pull/1188).
- **J/JXY same-article DOI twins cross-merged (130 docs)** — Transactions-era articles registered under both bare `J*` (NLM-extracted) and `J*XY` (APTARA-extracted) forms now share the union of metadata (NLM-rich abstract/authors/precise date + APTARA-structured ISSN/copyright/publisherLocation). 159 phantom bare `J*****` files that case-collide with their lowercase `j*****` sibling were deleted — their DOIs case-insensitively resolved to the 2010+ MIJ article, never to the 1917 Transactions content their files claimed.
- **30 MIJ ISSN corrections** — 2012-era lowercase-j docs that APTARA tagged with the predecessor SMPTE Journal print ISSN (`0036-1682`) are corrected to the MIJ ISSN pair (`1545-0279` / `2160-2492`). `$meta.originalValue` preserves the APTARA-source form.
- **`keyword.normalize.js` cleanups** — `normalizeKeyword` / `splitAndNormalizeKeywords` accept an optional `extraAcronyms` Map for per-corpus overrides. IETF XMLDSig spec-element names (`AgreementMethod`, `DigestMethod`, etc.) moved out of the global `ACRONYM_MAP` into an IETF-only map in `providers/ietf.parse.js`. The `signturemethod` typo is corrected on import while `$meta.originalValue` preserves the RFC source. `crossfillSmpteFromZoho.js` switched to the central normalizer (drops its duplicated local `KEYWORD_SYNONYMS`).
- **`controlledKeywords` once-over** — pluralised singular drift (`Subtitle → Subtitles`, `Interface → Interfaces`, `Network → Networks`, `Type → Types`), collapsed acronym/long-form pairs (`Look-up Table → LUT`, `Common LUT Format → CLF`, `Microservice → Microservices`, `Internet of Things → IoT`, `USB Type-C → USB-C`), promoted ~31 in-use external terms (AFD, DPX, MIB, LUT, CLF, RTP, TTML, IMSC, TIFF, etc.) into the vocab, removed the `SigntureMethod` typo + `Eneryption` duplicate, fixed Title-cased `Of` / `In` conjunctions in multi-word terms, and dropped redundant noise (`SMPTE`, `Society of Motion Picture and Television Engineers`, `Languages`, `Status`, `SNMP`).
- **Zoho standards cross-fill expanded** — `crossfillSmpteFromZoho.js` adds `keywords` (Keywords + Topics columns, deduped through the central normalizer) and a no-op short-circuit so identical-set merges don't churn `$meta` timestamps.
- **`validate-urls.yml` cadence dropped from weekly to biweekly** — cron now fires on the 1st and 15th of each month (was every Saturday). The duplicate-run throttle on `workflow_run`-triggered executions widens from 24 hours to 14 days, matching the cron cadence, so the upstream `Build MasterReference Index` trigger can no longer fire a redundant full URL sweep between scheduled runs. Driven by the corpus passing ~26k docs (each sweep now takes hours, publishers throttle the request rate, and standards URLs rarely drift inside a 14-day window). Throttle label renamed `daily-throttle` → `biweekly-throttle` in the skip-reason output for clarity.

### Fixed

- **`validate-urls.yml` App-token mid-job expiry** — the App token minted via `actions/create-github-app-token@v3` at job start is hard-capped at a 1-hour TTL by GitHub. The `Run URL validation` step routinely takes 90+ minutes against the now-26k-doc corpus, so by the time the `Auto-commit audit back to main` step ran the original token was dead and `git push` exited 128 with `fatal: could not read Username for 'https://github.com'` (see run [#27777168738](https://github.com/PrZ3r/MSRBot.io/actions/runs/27777168738)). Fix: re-mint the App token (`steps.app-token-refresh`) right after the audit read and before any push, then explicitly inject the fresh token into the `origin` remote URL via `git remote set-url` so `git push` uses it instead of the expired credential stored in `.git/config` by `actions/checkout`. All three downstream auth points (auto-commit push, base-sync fetch, `Create PR for normalized URLs` via peter-evans) switched to `steps.app-token-refresh.outputs.token`. Initial checkout still uses the original `steps.app-token` since it fires within seconds of mint.
- **CI `Validate registries` post-merge case-mismatch** — 683 SMPTE journal-article files were tracked by git with lowercase-j paths but carried uppercase-J `docId` fields (macOS case-insensitive FS hid the drift locally); renamed to match content. Closes [#1189](https://github.com/PrZ3r/MSRBot.io/pull/1189).

### Removed

- **`src/main/scripts/extras/fixLowercaseSmpteDocIds.js`** — actively harmful; conflated SMPTE's intentional lowercase-j DOI namespace with case drift and unlinked 308 real MIJ articles as "colliders" against pre-1955 Transactions counterparts.

## [v2.0.0] - 2026-05-19

Major release — the document registry model is inverted. The source of truth moves from the monolithic `src/main/data/documents.json` to one JSON file per document under `src/main/data/docs/`, sharded by `{publisher}/{docType}/` (with a `{year}/` level for title-identified docTypes). The monolith, per-publisher/docType slices, and the per-docId API all become build artifacts. See [#1108](https://github.com/PrZ3r/MSRBot.io/issues/1108).

### Added
- **Per-doc document registry** — the registry source of truth is now one JSON file per document under `src/main/data/docs/{publisher}/{docType}/{docId}.json`; title-identified docTypes (`site.json#titleLabelDocTypes`) add a `{year}/` level. Removes the single-file scale ceiling (GitHub's 50/100 MB limits, whole-file rewrites, unreviewable diffs) ahead of the journal-article backfill.
- New `src/main/lib/registry.js` — central registry access: `loadAllDocs`, `loadDoc`, `saveDoc`, `slug`, `docIdSlug`, `docPath`.
- New `npm run new-doc` — scaffolds a new per-doc file from the template straight into its correct shard path.
- New `npm run assemble` (`build.assemble-registry.js`) — emits per-publisher and per-publisher/docType registry slices under `build/`.
- New one-time `src/main/scripts/migrate.explode-documents.js` — explodes the legacy `documents.json` into the per-doc tree (dry-run by default; `--apply`). Removed after the v2.0.0 migration; preserved in the commit history if ever needed again.
- New `npm test` (`src/main/scripts/test/registry.test.js`) — self-contained smoke tests pinning the `slug` / `docIdSlug` / `docPath` invariants in `src/main/lib/registry.js` (including the `_unknown` / `_undated` buckets and the year third-shard).

### Changed
- `documents.json`, the per-publisher/docType slices, and the per-docId API are now **build artifacts** assembled from the per-doc registry — never hand-edited.
- `npm run canonicalize` runs per-file: key-sorts each doc, injects `$meta`, re-homes any file not at the shard path its own fields derive, and prunes emptied directories.
- `npm run validate` runs per-file and adds a path-consistency check — a file must sit where its `publisher`/`docType`/`docId`/`publicationDate` fields derive. Each per-doc file is validated directly against the item schema, so Ajv error paths read `/docId` etc. rather than `/0/docId`.
- `extractDocs` writes only the docs a run touched, each to its own shard file, via `saveDoc()` (which re-homes on publisher/docType/docId changes).
- `npm run build` now emits `build/api/stats.json` itself — the former `build-stats` workflow step is folded in.
- `build-msi` / `build-mri` `--in` is now optional, defaulting to the per-doc registry; ~13 registry read sites swapped to `loadAllDocs()`.
- Extract, URL-validate, and index-build workflows updated to operate on `src/main/data/docs/`.

### Removed
- `npm run docs-sort` and `npm run docs-fix` (and `src/main/scripts/utils/docIdSort.js`) — array order is now derived from filenames; `canonicalize` owns ordering and placement.
- The separate "Generate API stats" workflow step — folded into `npm run build`.

## [v1.4.2] - 2026-03-11

### Added
- Added `npm run seed-backfill-ietf` helper (`src/main/scripts/utils/seedBackfill.ietf.js`) to compare MRI presence-audit missing RFC refs against `src/main/input/seedUrls.ietf.json`, with:
  - dry-run reporting (default)
  - `--write` mode to append missing RFC seeds and canonicalize/dedupe the full seed list.

### Changed
- IETF RFC HTML reference extraction now includes a modern xml2rfc-HTML path:
  - Detects modern RFC pages via `xml2rfc` generator metadata and/or `application/rfc+xml` alternate links.
  - Parses structured `dl.references` entries using `dt`/`dd` boundaries for normative/informative sections.
  - Falls back to legacy section/anchor heuristics only when structured extraction is unavailable or incomplete.
- Expanded keyword normalization acronym map in `src/main/scripts/utils/keyword.normalize.js`:
  - added additional crypto/protocol acronyms (for example `XMSS`, `WOTS`, `W-OTS`, `WOTS+`, `W-OTS+`)
  - reformatted acronym definitions to sorted one-per-line entries for readability and safer diffs.
- Reference normalization now includes generic DOI/ISBN fallback parsing in `parseRefId`, reducing manual `refMap` backfills for citations that include canonical identifiers.
- Reference normalization now includes generic 3GPP Technical Specification parsing from cite text (including Draft TS forms), with month-aware suffixes (e.g., `3GPP.33.501.202107`).
- `badRefs.latest.json` writing now merges per provider into a single snapshot file:
  - each bad-ref item includes `provider`
  - each extract run replaces only the current provider's items and preserves other providers' entries
- Updated `npm run seed-backfill-ietf` (`src/main/scripts/utils/seedBackfill.ietf.js`) to also backfill missing `IETF.draft-*` refs from MRI presence-audit (in addition to RFC refs), including draft filename-extension normalization (`.txt/.xml/.html/.pdf`).

### Fixed
- **URL validation throttle false positives on skip-only runs** — refined `.github/workflows/validate-urls.yml` daily throttle to count only runs that actually executed `Run URL validation` successfully; skip-only successful runs (for example, upstream open-PR marker skips) no longer satisfy throttle.
- **IETF filter prefix overmatch in seed-first extraction** — fixed `src/main/scripts/providers/ietf.discovery.js` URL filtering so short RFC filters (for example, `.../rfc861`) no longer overmatch longer IDs (for example, `.../rfc8615`, `.../rfc8820`):
  - filter comparisons now use normalized URL forms
  - prefix matching now requires explicit intent via trailing `/` in the filter entry.
- **W3C dated TR stage references not resolving** — expanded W3C URL parsing in `parseRefId` to resolve dated `/TR/YYYY/<STAGE>-<shortname>-<date>` forms beyond REC (for example `WD-CSP3-20160913`, `CR-referrer-policy-20170126`).
- **MRI add-then-prune churn across extract/build-MRI workflows** — extraction now prunes MRI variants to current `documents.json` reference truth before flush, preventing transient rawVariants (for example self-cites or non-persisted sightings) from being added by extract and then removed by later `buildMasterReferenceIndex` runs.
- **Resolved citations leaking into `badRefs.latest.json`** — tightened bad-ref suppression in both `extractRefs` (`src/main/lib/referencing.js`) and extract report persistence (`src/main/scripts/extractDocs.js`) so any citation that resolves via `parseRefId` or `mapRefByCite` is excluded from bad-ref output, eliminating stale false positives during mixed parser-path runs.
- **NIST SP reference normalization gap** — added generic NIST SP parsing in `parseRefId` for CSRC `.../publications/detail/sp/.../rev-...` URLs and text forms like `NIST 800-67, Rev. 2`, producing canonical IDs such as `NIST.SP.800-67r2`.
- **Legacy RFC appendix/procedure spillover into unparseable refs** — tightened IETF HTML fallback boundaries and numbered-item badRef gating to avoid treating appendix example steps (for example CoAP WebSocket procedure lines) as bibliographic references.
- **IETF draft token misclassification/normalization issues** — improved draft extraction to:
  - strip filename extensions from draft IDs (`.txt/.xml/.html/.pdf`)
  - reject generic filename false positives (for example `...preliminary-draft-4.pdf`)
  - prefer `href`-derived draft IDs over cite-derived variants when both are present
  - choose the longest valid draft token to avoid truncated wrapped-text matches.
- **IETF legacy heading detection gaps** — broadened fallback heading recognition for `Normative References` / `Informative References` in `<span class="h2">` and `<span class="h3">` variants.
- **Reference mapping coverage gaps** — expanded `src/main/input/refMap.json` with additional DOI/IANA/IAB/OMA/GitHub/arXiv and legacy citation variants resolved during IETF backfill passes.
 
## [v1.4.1] - 2026-03-06
 
### Added
- Added `npm run local-server` shortcut to start a local HTTP server for previewing the built site.
- Added shared keyword normalization utility at `src/main/scripts/utils/keyword.normalize.js` to centralize acronym/special-case keyword casing rules used during ingestion and keyword sync.
- Added persistent bad-reference reporting snapshot at `src/main/reports/badRefs.latest.json` from extraction runs, so unresolved refs can be backfilled outside PR log text.
- Added `npm run review-refs` helper (`src/main/scripts/utils/review.refs.js`) to manage reference review state:
  - `npm run review-refs -- list` to enumerate flagged docs.
  - Expanded `npm run review-refs -- list` reporting to be provider/publisher agnostic and reference-type agnostic:
    - covers all docs/providers
    - reports both `normative` and `bibliographic` review flags
    - correlates with `badRefs.latest` and reports unflagged docs with bad refs
  - `npm run review-refs -- resolve <DOCID...>` to clear review flags after manual verification.
  - Updated `npm run review-refs -- resolve <DOCID...>` to clear review flags for both `references.normative$meta` and `references.bibliographic$meta`.
- Added extraction parser diagnostics flagging for mixed reference layouts (`MIXED_REF_LAYOUT_RISK`) and propagated this as structured review metadata instead of bad-ref noise.

### Changed
- Refactored `src/main/scripts/providers/ietf.parse.js` to use shared keyword normalization (`splitAndNormalizeKeywords`) instead of inline acronym/title-case logic.
- Refactored `src/main/scripts/utils/keywords.sync.js` to use shared keyword normalization (`normalizeKeyword`) instead of inline acronym/title-case logic.
- Extended keyword acronym normalization to preserve `SMTP` uppercase consistently across parser/sync flows.
- Extraction workflows (`extract-docs-ietf.yml`, `extract-docs-smpte.yml`) now append unknown-keyword warnings from `npm run validate -- --warn` output into PR notes, so warn-only keyword drift is visible before merge.
- Extraction workflows now track `src/main/reports/badRefs.latest.json` in extract PRs (and no longer depend on per-run bad-ref log artifacts).
- Removed old `stats` API veiwer template. 
- Mixed-layout reference risk now lands in `references.bibliographic$meta` with:
  - `reviewRequired: true`
  - `flag: "MIXED_REF_LAYOUT_RISK ..."`
  and downgrades confidence to `medium` for that field until reviewed.
- Updated docs schema to permit new `$meta` keys: `reviewRequired` and `flag`.

### Fixed
- **gh-pages push contention** (#910) — replaced `peaceiris/actions-gh-pages` with manual git deploy in PR Build Preview and main site build workflows; added push-with-retry (pull --rebase, up to 3 attempts) to all four workflows that push to `gh-pages` (site build, PR preview, PR cleanup, PR sweeper). The site build's two-step cleanup-then-publish is now a single atomic commit.
- **URL validation over-triggering** — added a daily throttle for workflow-chain URL validation so `Validate Document URLs` skips workflow-run invocations if a successful URL validation already completed within the previous 24 hours.
- **IETF references canonicalization noise on new extracts** — fixed new-document extraction/merge so empty `references.normative`/`references.bibliographic` arrays are not persisted; IETF parser now emits sparse `references` keys (only when non-empty), preventing canonicalization from injecting manual `references.normative$meta` for parser-empty placeholders.
- **Docs index search in PR previews** — fixed docs search asset loading in `src/site/js/docList.js` to use `window.msrAssetPrefix` with relative fallbacks instead of root-absolute `/docs/...` paths, so searches return results on preview URLs under subpaths (for example, `/pr/<num>/docs/`) while continuing to work locally.
- **IETF reference boundary/parsing regressions in legacy RFC HTML** — tightened fallback section detection and stop conditions to reduce non-reference soak-through while still capturing appendix-based reference content:
  - Added strict old-page bibliography boundary support for `<hr class='noprint'/> <!--NewPage--> <pre class='newpage'> ... Bibliography ... BIBLIOGRAPHY ...`.
  - Added appendix heading support for `Appendix <X>: Recommended reading` as bibliographic reference bounds.
  - Updated prose fallback stop logic so `Appendix` headings do not prematurely terminate parsing when the active bound is a recommended-reading reference section.
  - Backfilled cite→refId normalization rules in `src/main/input/refMap.json` for unresolved legacy citations (notably RFC732/RFC733/RFC2130 reference blocks, including ARPANET NIC, ANSI X3.51, and Jerman-Blazic bibliography entries).

## [v1.4.0] - 2026-02-28

### Added
- **API Explorer page** at `/api/` — searchable, filterable document browser with URL parameter syncing, pagination, and an inline JSON viewer for inspecting full provenance records.
- **Full-provenance JSON API** — static endpoints for machine consumption:
  - `/api/documents.json` — full registry with all source fields and provenance metadata.
  - `/api/doc/{docId}.json` — per-document JSON with full record.
  - `/api/stats.json` — registry statistics and metadata (with `meta.repoUrl`, `meta.changelogUrl`).
- **JSON Schema publishing** at `/api/schemas/` — existing schemas (`documents`, `groups`, `portals`, `projects`) are now served as static assets for consumer validation.
- **API versioning** — all API JSON responses include `$schema` and `apiVersion` fields; initial API version is `1.0.0`.
- **Machine-readable discovery** — added `<link rel="alternate" type="application/json">` and `<link rel="describedby" type="application/schema+json">` to the API Explorer page and all document detail pages.
- **OpenSearch JSON template** — `opensearch.xml` now includes a JSON response URL (`/api/?q={searchTerms}`) alongside the existing HTML template.
- **JSON-LD SearchAction** — structured data now includes search actions for both `/docs/` and `/api/` endpoints.
- **Source Data (JSON) panel** on document detail pages — collapsible card showing the full registry record with a direct link to the per-document API endpoint.
- **Internal Changelog page** at `/changelog/` — rendered from `CHANGELOG.md` as styled cards, replacing external GitHub blob links.
- Added API Explorer and schema links to the Dev Tools & Resources popover and site footer.
- Added API link on the homepage.

### Changed
- Renamed "Dev Tools" navigation label to "Dev Tools & Resources."
- Updated README badges and Key Artifacts to reference the new API Explorer and internal changelog.
- Updated sitemap to include `/api/` and `/changelog/` entries.

### Fixed
- Fixed suites/collections page document rendering when publisher labels differ by composite forms (for example, `ISO/IEC` docs under `ISO` collections); collection matching now normalizes publisher aliases/composites before filtering.
- Fixed JSON-LD `SearchAction` target URLs missing path separator after `canonicalBase`.

## [v1.3.0] - 2026-02-26
 
### Added
- Providerized extraction architecture:
  - Added SMPTE discovery provider module at `src/main/scripts/providers/smpte.discovery.js`.
  - Added SMPTE parser provider module at `src/main/scripts/providers/smpte.parse.js`.
  - Added IETF discovery provider module at `src/main/scripts/providers/ietf.discovery.js`.
  - Added IETF parser provider module at `src/main/scripts/providers/ietf.parse.js`.
  - Added provider-specific metadata configs:
    - `src/main/scripts/providers/smpte.meta.js`
    - `src/main/scripts/providers/ietf.meta.js`
  - Added provider registry at `src/main/scripts/providers/index.js`.
- Added optional document schema fields for citation structure:
  - `volume`, `number`, `pages`, `chapter`, `edition`.
- Added explicit npm alias `extract:smpte` for provider-targeted extraction.
- Added dedicated IETF extraction workflow: `.github/workflows/extract-docs-ietf.yml` (separate branch/PR path from SMPTE extraction).
- Added keyword governance utilities and config source:
  - Added `controlledKeywords` list in `src/main/config/site.json`.
  - Added `keywords-sync` utility at `src/main/scripts/utils/keywords.sync.js` (`npm run keywords-sync`, dry-run by default, `--write` to apply).
- Added centralized command/flags documentation at `docs/commands.md`.
- Added and expanded `AGENTS.md` guidance for branch naming, issue/PR label usage, PR hygiene, validation expectations, repo guardrails, and changelog/documentation/provenance expectations.

### Changed
- Refactored `extractDocs.js` to be provider-agnostic orchestration (merge, metadata, MRI, and logging), with provider-specific discovery/parsing moved out of main script.
- Extraction provider selection is now explicit via `--provider`; implicit/default provider execution was removed.
- Renamed SMPTE extraction workflow to `extract-docs-smpte.yml` (`Extract Documents - SMPTE`) and aligned workflow references/triggers accordingly.
- Updated docs and badges to reference the renamed SMPTE extraction workflow.
- Updated validation architecture for keywords:
  - Removed hard keyword enum enforcement from `documents.schema.json`.
  - Moved keyword conformance checks to `documents.validate.js` against `src/main/config/site.json#controlledKeywords`.
  - Added keyword validation mode controls for `npm run validate`:
    - default strict mode (`--error`)
    - optional warn mode (`--warn`) for unknown keyword drift checks.
  - Extraction workflows now run keyword validation in warn mode; build/local validation remains strict by default.
- Expanded IETF extraction behavior:
  - RFC extraction now uses RFC Index XML (`rfc-index.xml`) as first-pass canonical metadata for seeded RFCs, with per-document sources used as enrichment/fallback.
  - RFC field source precedence is now explicit; status relations (`obsoletes/obsoleted-by/updates/updated-by`) are sourced from RFC Index XML + RFC info `<dl>` merge, eliminating loose relation text fallback.
  - RFC author precedence now prefers Datatracker `doc.json` authors (richer names) over RFC Index XML, with HTML/info fallbacks.
  - Added RFC Index XML/XSD mapping contract and required-field coverage warnings in IETF parser for schema-backed extraction hygiene.
  - RFC relation fields now derive from RFC info page relation `<dl>` parsing (no broad relation text fallback injection).
  - Non-RFC extraction now enriches from archive XML (`/archive/id/*.xml`) for front-matter fields and keywords.
  - Non-RFC keywords are normalized to project keyword style (Title Case with preserved acronyms/common forms such as `JSON`, `URN`, `B-Chain`, `DCinema`, `DCP*`, `SHA-1`).
  - RFC reference parsing now uses RFC HTML section-aware extraction with strict `Normative` vs `Informative/Bibliographic` bucketing and overlap guards.
  - RFC fallback reference slicing is now bounded to reference sections, next section heading, and page-break markers to avoid body/header/footer soak-through.
  - IETF reference sightings now write to MRI for both RFC HTML and non-RFC XML paths using final document IDs.
- Expanded shared reference normalization rules in `src/main/lib/referencing.js`:
  - RFC IDs normalize leading zeros (e.g., `RFC0821` → `RFC821`).
  - W3C `REC-*` URL forms normalize to canonical W3C shortname IDs (no `REC-` prefix in docId).
  - Added href-first resolvers for Unicode and Mozilla Bugzilla references.
  - Added improved ISO hyphenated designator parsing (e.g., `ISO-8859-1:1987`).
- Updated project docs with provider extraction and keyword-governance guidance in `README.md` and `CONTRIBUTING.md`.
- Updated docs to link `docs/commands.md` from `README.md` and `CONTRIBUTING.md`.
- Enhanced Portal document listings with additional context fields:
  - Display of `docType` and `publicationDate` in document tables.
  - New **Doc Type** filter, aligned with existing Publisher filtering.
- Extended Portal sorting controls to support:
  - Sorting by **Type** and **Published date**.
  - Ascending / descending sort direction for all supported sort keys, consistent with Suites and Collections.
- Updated RefTree unresolved-document UX:
  - Unresolved nodes remain visible and navigable in-tree, but now display muted/italic labels with a `NOT IN REGISTRY` badge.
  - In the **Current Tree Root** card, unresolved docs no longer click through to `/docs/:docId/`; in-registry roots remain clickable.
- Improved docs page reference-list readability:
  - Added explicit spacing between normative/bibliographic reference labels and their status tokens (e.g., `[Active]`, `[SUITE]`).
- Updated `docs/CONTRIBUTING_SHORT.md` to align branch prefix guidance and add an explicit Unreleased changelog checklist item for workflow/policy/behavior changes.
- Simplified PR preview check behavior by removing custom check-run/status publication from preview workflow and relying on the single native workflow job check context.
- Added MSI→MRI chain guard in MRI workflow to skip MRI when MSI already opened a PR (artifact marker present), preventing duplicate chained data PRs.
- Hardened MRI missing-ref issue upsert behavior with no-op update skipping and per-run mutation budget (`MAX_MUTATIONS`), reducing secondary GitHub rate-limit failures.
- Stopped MSI/MRI metadata-only auto-commits to default branch; report timestamp/date-only churn is now ignored unless content-change PR criteria are met.
- Refined home page information architecture and responsive layout:
  - Reduced card density, improved section hierarchy, and rebalanced content columns.
  - Updated portal home rendering to a scalable list layout for growth.
- Refined footer layout/content hierarchy:
  - Improved responsive alignment/spacing, constrained divider width to container, and added explicit developer/issue links.
  - Standardized branding presentation with PrZ3/MSR marks and config-driven copyright year.
- Updated workflow trigger path:
  - Site build (`Build MSRBot.io Site and Test`) now runs on `push` to `main`.
  - URL validation now triggers from MRI completion (plus schedule/manual), not from site build completion.
  - PR gate remains `PR Build Preview (MSRBot.io site)` on `pull_request`.
- Added focused documents-registry helper scripts:
  - `npm run docs-sort` to sort `src/main/data/documents.json` by `docId`.
  - `npm run docs-validate` as explicit docs validation alias.
  - `npm run docs-fix` to run sort + validation in one step for manual doc edits.
- Updated `docIdSort` behavior for low-noise editing:
  - Removed legacy `.bak` sidecar creation.
  - Preserved per-entry object formatting and reordered entries only.
  - Aligned sort comparator with validator ordering (`toUpperCase()` lexical) to prevent sort/validate mismatch loops.

### Fixed
- Fixed OM remap path in extraction by correcting title variable scope usage, enabling OM ID remapping updates to apply correctly.
- Fixed README weekly schedule Markdown table separator to render correctly with all columns.
- Fixed doc citation “Copy (undated)” behavior on doc pages so undated snippet blocks copy correctly (no blank clipboard payload).
- Fixed undated citation snippet `<cite id>` generation to strip only terminal date suffixes for undated variants, while leaving dated variants unchanged.

## [v1.2.0] - 2026-02-05

> Primary changes delivered via <https://github.com/PrZ3r/MSRBot.io/pull/695>
 
### Added
- Automated extraction of `Scope` in HTML documents to map to `abstract`.
- Introduced **Portals**: curated, first-class landing pages that aggregate documents across suites, collections, publishers, and document types.
  - First (3) portals: `/dcinema/`, `/imf/`, `/accessibility/`
- Added a complete **Portal build and schema pipeline**, supporting:
  - Keyword-based document matching.
  - Explicit pinning and post-resolution filtering.
  - Shared narrative/overview sections.
  - Curated resource collections.
- Delivered a **Suites-aligned Portal UX**, including:
  - Searchable document tables with abstracts.
  - Expandable previews (shared behavior with Suites).
  - Visual muting of withdrawn and superseded documents.
  - Structured, card-based overview and resource sections.

#### Portal Behavior & UX Details
- Portals render as dedicated pages with stable URLs (e.g. `/dcinema/`).
- Portal document listings support:
  - Default sorting by `docLabel`.
  - Search, publisher filtering, and sortable columns.
  - Abstract previews with More/Less expansion.
- Portal overview sections support shared explanatory content using the same card patterns as Suites.
- Resource sections support:
  - Grouping by category.
  - Independent collapsible sections.
  - Per-resource description expansion for long content.
- Portal navigation dynamically adapts based on available content (Overview / Docs / Resources).
 
### Changed
- Backfilled (auto and manually) `abstract` fields for DC and IMF `collections`
 
### Fixed
- Fixed rendering of `abstract` paragraph breaks in `suites`. 

## [v1.1.0] - 2026-01-06

> Primary changes delivered via <https://github.com/PrZ3r/MSRBot.io/pull/678>

### Added
- Introduced first-class **Suites** and **Collections** as distinct core concepts:
  - Suites represent true multipart standards (shared lineage number).
  - Collections represent related documents without formal parts.
  - Suites and collections share UX but retain distinct semantics.
- Added full **Suites / Collections build pipeline**, emitting:
  - `build/suites/_data/suites.json` (mixed, with explicit `kind: suite | collection`).
  - Dedicated pages at `/suites/:slug/` for both suites and collections.
  - Index page supporting mixed display with filtering by kind.
- Implemented **docSuiteTitle** extraction and propagation:
  - HTML: derived directly from `pubSuiteTitle`.
  - PDF: parsed as text before first em-dash.
  - Integrated across search index, citations, RefTree roots, suite cards, and doc detail pages.
- Enabled full **ALLPARTS resolution**:
  - Supports ISO and SMPTE ALLPARTS identifiers.
  - Doc detail pages resolve ALLPARTS to suite pages with correct labels and status.
  - RefTree displays suites as non-clickable parents that expand to child documents.
- Added guardrails and explicit metadata to prevent future regressions:
  - Explicit `kind: suite | collection`.
  - Flags for `SUITE_TITLE_MISMATCH`.
  - Hard exclusions for unsupported publishers and document types.

### Changed
- Finalized and locked **build order** to ensure correctness and stability:
  - Documents → MSI → Suites/Collections → Pages.
- Updated suite and collection rendering:
  - Suites show all documents, including withdrawn (visually muted).
  - Collections hide parts column and sort by label.
  - Abstract previews and expand/collapse behavior added.
- Refined RefTree behavior:
  - RefTrees may display suites but never re-center on them.
  - Suite labels replace ALLPARTS identifiers where applicable.
- Normalized publisher handling for edge cases (e.g., ANSI/ASA) so suite and collection lookups resolve correctly.

### Fixed
- Fixed ALLPARTS resolution failures where document type previously blocked linking.
- Corrected publisher logo and link resolution on suite and collection pages.
- Resolved reference edge cases for W3C documents.
- Eliminated legacy suite/collection duplication and silent clobbering in the build process.
