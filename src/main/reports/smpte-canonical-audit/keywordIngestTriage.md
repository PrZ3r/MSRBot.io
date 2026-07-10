# Keyword triage — NLM-ingest keywords (≥3 docs) + casing conform

> Proposal for review. Scope: the 491 NLM-ingested docs' `index_terms` keywords.
> 762 distinct forms → 51 already handled (39 in vocab, 11 folds, 1 drop) →
> **711 unknown**, of which only **28 reach ≥3 docs** (683 are 1–2-doc long-tail,
> DEFERRED to a later pass). Edit any verdict below, then I encode into
> `keywordVocabDecisions.json` + the acronym map and run the conform.

## A. Acronym-map additions (mechanical casing conform)

The `index_terms` arrive ALL-CAPS; `normalizeKeyword` title-cases unknown tokens,
so acronyms come out wrong (`Srt`, `Rist`, `Ai`, …). Add these to
`keyword.normalize.js` so they case correctly **everywhere** they appear:

`SRT`, `RIST`, `DASH`, `RDMA`, `AV1`, `COTS`, `AWS`, `MXL`, `AI`, `LLMs`

## B. ✅ ADD — new `controlledKeywords` (22)

| add as | docs | note |
|---|---:|---|
| **Machine Learning** | 9 | |
| **Virtual Production** | 8 | |
| **Artificial Intelligence** | 7 | AI folds here (§D) |
| **SRT** | 6 | acronym |
| **RIST** | 6 | acronym |
| **Generative AI** | 5 | casing fix |
| **DASH** | 5 | acronym (MPEG-DASH) |
| **Live Production** | 5 | |
| **RDMA** | 5 | acronym |
| **AV1** | 4 | acronym; vocab has HEVC/H.265 alongside |
| **Virtual Reality** | 4 | |
| **Color Grading** | 4 | vocab has Color/Color Management |
| **COTS** | 4 | acronym |
| **Sustainability** | 3 | |
| **Mixed Reality** | 3 | |
| **Bitrate Ladder** | 3 | |
| **Rate-Quality Curves** | 3 | ⚠️ methodology — ADD or DROP? |
| **Large Language Models (LLMs)** | 3 | casing fix |
| **AWS** | 3 | acronym |
| **IP Media** | 3 | |
| **Libfabric** | 3 | |
| **Media Exchange Layer (MXL)** | 3 | MXL folds here (§D) |

## C. 🔀 FOLD — map to an existing/canonical vocab term (6)

| source form | docs | fold → | note |
|---|---:|---|---|
| Live Streaming | 5 | **Streaming** | or keep distinct? |
| AI | 4 | **Artificial Intelligence** | acronym expansion |
| SMPTE ST 2110 | 4 | **ST 2110** | vocab form drops the `SMPTE ` prefix |
| Video Coding | 3 | **Compression** | or ADD distinct "Video Coding"? |
| MXL | 3 | **Media Exchange Layer (MXL)** | expand the bare acronym |
| Live | 3 | **Live Production** | ⚠️ generic alone — fold or DROP? |

## D. Open questions for you

1. **Rate-Quality Curves** — keep as a topic (ADD) or drop as methodology? Add
2. **Live Streaming** → fold to `Streaming`, or keep as its own entry? Fold
3. **Video Coding** → fold to `Compression`, or ADD distinct (vocab already has `Video Compression`)? Add
4. **Live** → fold to `Live Production` or DROP as too generic? Fold

## Not in this pass
- 683 long-tail keywords (1–2 docs each) — casing-normalized but held for the next triage.
- No docs mutated and no vocab written yet — this is the proposal only.
