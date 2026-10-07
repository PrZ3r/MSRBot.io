# Reference files truth table — SMPTE journal + conference papers, 2015–2023

> Generated: 2026-10-07T20:20:20.783Z
> Scope: the 1045 papers from 2015–2023 that MSRBot holds without references (research papers, plus any paper whose record names a reference file).
> Evidence per paper: the IEEE metadata record in SMPTE’s journal library (`articlereferenceflag`, `filetype="REFXML"`); the library export and SMPTE’s AWS bucket (searched by exact file name, DOI and article number); MSRBot’s older local source tree (file names); references deposited with the DOI (Crossref `reference-count`); and the paper’s published PDF from the AWS library.
> Per-paper detail: `referenceFilesTruthTable.csv`.

## Verdict summary

- **A — 410 papers: the record names a reference file that SMPTE’s delivery does not contain.** Each record names a `-ref.xml` (e.g. `10-5594_M001855-ref.xml`), but the file is in neither the library export nor the AWS bucket (0 of 410). 150 of these names survive in an older local copy of SMPTE’s source (contents not yet verified); 263 have references deposited with their DOI; 297 have a references section in the published PDF. ➜ **SMPTE: supply these files.**
- **B — 415 papers: the record lists no reference file, yet references exist.** 415 of them carry `articlereferenceflag=F` (“no references”). Evidence: references deposited with the DOI (399) and/or a references section in the published PDF (408). All 415 are journal articles: 376 from 2017–2023 and 39 from 2016, the IEEE Xplore era; Xplore showed references for articles of this period. ➜ **SMPTE: correct the records and supply reference data.**
- **C — 220 papers: no evidence of references** (no file named, nothing deposited, no references section found in the PDF). Likely papers without a reference list; listed for completeness.

MSRBot will meanwhile extract references from the published PDFs, so the registry is complete regardless; this report is the record of what SMPTE’s delivery is missing.

## By year

| docType | year | papers | ref file named | in AWS bucket | in older local source | deposited (Crossref) | PDF has references | A | B | C |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Conference Paper | 2015 | 97 | 67 | 0 | 57 | 57 | 27 | 67 | 0 | 30 |
| Conference Paper | 2016 | 59 | 50 | 0 | 50 | 50 | 31 | 50 | 0 | 9 |
| Conference Paper | 2017 | 57 | 49 | 0 | 0 | 0 | 31 | 49 | 0 | 8 |
| Conference Paper | 2018 | 51 | 46 | 0 | 0 | 45 | 36 | 46 | 0 | 5 |
| Conference Paper | 2019 | 24 | 22 | 0 | 0 | 22 | 18 | 22 | 0 | 2 |
| Conference Paper | 2020 | 30 | 26 | 0 | 0 | 26 | 21 | 26 | 0 | 4 |
| Conference Paper | 2021 | 23 | 21 | 0 | 0 | 0 | 20 | 21 | 0 | 2 |
| Conference Paper | 2022 | 39 | 32 | 0 | 0 | 5 | 27 | 32 | 0 | 7 |
| Conference Paper | 2023 | 40 | 39 | 0 | 0 | 0 | 31 | 39 | 0 | 1 |
| Journal Article | 2015 | 59 | 43 | 0 | 43 | 43 | 40 | 43 | 0 | 16 |
| Journal Article | 2016 | 75 | 15 | 0 | 0 | 54 | 54 | 15 | 39 | 21 |
| Journal Article | 2017 | 60 | 0 | 0 | 0 | 48 | 47 | 0 | 48 | 12 |
| Journal Article | 2018 | 73 | 0 | 0 | 0 | 55 | 55 | 0 | 55 | 18 |
| Journal Article | 2019 | 73 | 0 | 0 | 0 | 53 | 56 | 0 | 58 | 15 |
| Journal Article | 2020 | 74 | 0 | 0 | 0 | 53 | 52 | 0 | 54 | 20 |
| Journal Article | 2021 | 69 | 0 | 0 | 0 | 53 | 53 | 0 | 53 | 16 |
| Journal Article | 2022 | 75 | 0 | 0 | 0 | 53 | 55 | 0 | 57 | 18 |
| Journal Article | 2023 | 67 | 0 | 0 | 0 | 45 | 51 | 0 | 51 | 16 |

## ➜ SMPTE action list

1. **Supply the 410 named reference files (verdict A).** File names and issue folders: `referenceFilesTruthTable.csv`, rows with verdict A. Add them to the AWS library beside each article’s XML.
2. **Correct the 415 records that omit existing references (verdict B)** — set `articlereferenceflag`, and supply the reference data (IEEE held it for Xplore). Rows with verdict B.
3. Going forward, include each paper’s reference list in the library delivery (as the 2024+ FTXML already does).
