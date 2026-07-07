# Schema promotion review — data-bearing unmapped paths

> Generated: 2026-07-07T23:12:05.993Z
> Input: sourceFieldCensus.paths.json
> Data-bearing unmapped paths: **1037**

| verdict | paths | shape variants dedupe |
|---|---:|---:|
| 🎯 PROMOTE (new schema field) | 11 | 9 distinct |
| ✅ MAP (variant of existing schema field) | 17 | 10 distinct |
| 🗑️ SKIP | 434 + 296 attrs | — |
| ❓ REVIEW (no heuristic) | 279 | — |

## 🎯 PROMOTE — new schema fields (consolidated)

| target field | example path | files | sample values |
|---|---|---:|---|
| **issn/isbn.medium (Paper|Electronic)** | `publication/publicationinfo/issn/@mediatype` (23761)<br>`publication/publicationinfo/isbn/@mediatype` (1846) | 23761 | `Paper` · `Electronic` |
| **sourceIds.publicationSource** | `publication/publicationinfo/pubsourceid` (4066) | 4066 | `0073400` |
| **conferenceLocation** | `publication/publicationinfo/confgroup/conflocation` (1923) | 1923 | `Los Angeles, CA, USA` · `New York, NY, USA` · `Montreal, QC, Canada` |
| **license (enum: SMPTE|IEEE|open-access)** | `publication/volume/article/articleinfo/articlelicense` (1711) | 1711 | `SMPTE` · `IEEE` |
| **authors[].orcid** | `publication/volume/article/articleinfo/authorgroup/author/orcid` (333) | 333 | `0000-0002-0769-5306` · `0000-0002-6191-5154` · `0000-0003-2129-1516` |
| **sourceIds.manuscriptCentral** | `publication/volume/article/articleinfo/articlemancentralid` (225) | 225 | `editorial-Pena` · `2021-4` · `editorial-lange` |
| **license.uri** | `publication/volume/article/articleinfo/article_license_uri` (221) | 221 | `https://ieeexplore.ieee.org/Xplorehelp/d` |
| **authors[].email** | `publication/volume/article/articleinfo/authorgroup/author/email` (182)<br>`article/front/article-meta/contrib-group/contrib/email` (31) | 182 | `phil.tudor@rd.bbc.co.uk` · `hdtvpete@comcast.net` · `gongbo@crifst.ac.cn` |
| **license.note** | `article/front/article-meta/permissions/license/license-p` (113) | 113 | `Presented at the SMPTE 2023 Media Techno` · `Presented at IBC 2023, Amsterdam, The Ne` · `Presented at IBC 2023. Amsterdam, The Ne` |

## ✅ MAP — extractor-variant of existing schema field

| target field (existing) | source paths (all shape variants) | max-files | reason |
|---|---|---:|---|
| `journalTitle` | `publication/normtitle`<br>`article/front/journal-meta/journal-title-group/journal-title` | 25684 | IDAMS variant of journal title (already in schema) |
| `pages.last` | `publication/volume/article/articleinfo/artpagenums/@endpage` | 25684 | IDAMS end page |
| `pages.first` | `publication/volume/article/articleinfo/artpagenums/@startpage` | 25684 | IDAMS start page |
| `journalAcronym` | `publication/titleabbrev`<br>`article/front/journal-meta/journal-title-group/abbrev-journal-title` | 25204 | IDAMS variant of journal acronym |
| `topics` | `publication/volume/article/majortopic`<br>`publication/volume/article/articleinfo/articlejournaltopicset/articlejournaltopic`<br>`article/front/article-meta/article-categories/subj-group/subject` | 18818 | IDAMS variant of major_topic |
| `authors[].bio` | `publication/volume/article/articleinfo/authorgroup/author/authorbio` | 1606 | IDAMS variant of author bio |
| `keywords` | `publication/volume/article/articleinfo/keywordset/keyword/keywordterm` | 1107 | IDAMS keyword atom |
| `docTitle` | `article/front/article-meta/title-group/article-title`<br>`back/ref-list/ref/mixed-citation/article-title`<br>`article/back/ref-list/ref/mixed-citation/article-title`<br>`article/back/ref-list/ref-list/ref/mixed-citation/article-title` | 289 | NLM variant of article title |
| `conferenceTitle` | `publication/publicationinfo/confgroup/conftitle` | 134 | IDAMS conf title |
| `authors[].affiliation` | `article/front/article-meta/aff/institution-wrap/institution` | 88 | NLM structured affiliation |

## ❓ REVIEW — no heuristic; needs your eyeballs

_(top 60 by file coverage)_

| shape | path | files | samples |
|---|---|---:|---|
| `article` | `article/front/journal-meta/journal-id` | 289 | `MIJ` · `MTS` |
| `article` | `article/front/article-meta/article-id` | 289 | `10.5594/JMI.2024.PRBC4004` · `10.5594/JMI.2024.VLUN9330` · `10.5594/JMI.2024.GHEN8084` |
| `article` | `article/front/article-meta/article-id/@pub-id-type` | 289 | `doi` |
| `article` | `back/ref-list/ref/mixed-citation` | 97 | `, &#x201C;` · `,&#x201D;` · `, pp.` |
| `article` | `back/ref-list/ref/mixed-citation/@publication-type` | 97 | `confproc` · `periodical` · `online` |
| `article` | `back/ref-list/ref/mixed-citation/source` | 95 | `Proc. 2076 IEEE 72th International Confe` · `Proc. SPIE 9217, Applications of Digital` · `Specification of Power Efficient Encoder` |
| `publication` | `publication/volume/article/articleinfo/csarticlehtmlflag` | 86 | `F` |
| `publication` | `publication/volume/article/articleinfo/ipcset/ipc` | 77 | `Transforming electric information into l` · `Arrangements for executing specific prog` · `In which a programme is changed accordin` |
| `content_batch` | `content_batch/body/conference/conference_metadata/conference_acronym` | 76 | `MTS` |
| `article` | `article/back/ref-list/ref/mixed-citation` | 70 | `, &#x201C;` · `&#x201D;,` · `.` |
| `article` | `article/back/ref-list/ref/mixed-citation/@publication-type` | 70 | `periodical` · `confproc` · `book` |
| `article` | `article/back/ref-list/ref/mixed-citation/source` | 69 | `Use Cases and Requirements for JPEG XS v` · `2016 VSF October Meeting Series` · `Acta Neurobiologiae Experimentalis` |
| `article` | `body/sec/p/list/@list-type` | 68 | `bullet` · `ordered` · `simple` |
| `article` | `article/front/article-meta/contrib-group/author-comment/p/email` | 67 | `jwelch@smpte.org` · `dpurrier@smpte.org` · `education@smpte.org` |
| `article` | `back/ref-list/ref/mixed-citation/collab` | 55 | `SMPTE` · `ISO/IEC` · `Advanced Television Systems Committee (A` |
| `article` | `article/front/article-meta/contrib-group/contrib/role` | 53 | `Associate Dean for the School of Arts &#` · `Assistant Professor in the Department of` · `Professor of 3D Animation and Visual Eff` |
| `article` | `body/sec/sec/p/list/@list-type` | 49 | `bullet` · `ordered` · `simple` |
| `article` | `back/ref-list/ref/mixed-citation/conf-date` | 46 | `2016` · `2018` · `Dec. 2016` |
| `publication` | `publication/volume/article/articleinfo/abstract/inf` | 45 | `0` · `m` · `1` |
| `article` | `article/body/sec/sec/p/list/@list-type` | 41 | `bullet` · `ordered` · `simple` |
| `article` | `back/ref-list/ref/mixed-citation/pub-id` | 37 | `10.1109/WiMOB.2016.7763234` · `10.1017/atsip.2019.23` · `10.1109/tcsvt.2012.2221192` |
| `article` | `article/back/ref-list/ref/mixed-citation/collab` | 36 | `ISO/IEC 29170&#x2013;2:2015` · `SMPTE ST 2110&#x2013;22:2022` · `VSF TR-07: 2022` |
| `article` | `back/ref-list/ref/mixed-citation/pub-id/@pub-id-type` | 36 | `doi` · `art-access-id` · `arxiv` |
| `article` | `article/body/sec/p/list/@list-type` | 36 | `bullet` · `ordered` · `simple` |
| `article` | `back/ref-list/ref/mixed-citation/conf-loc` | 35 | `New York, NY` · `Italy` · `Nuremberg, Germany` |
| `publication` | `publication/volume/volumeinfo/issue/issuepart` | 31 | `1` · `2` |
| `publication` | `publication/volume/article/articleinfo/issuepart` | 31 | `1` · `2` |
| `article` | `body/sec/sec/p/table-wrap/table/tbody/tr/td` | 30 | `RAM` · `16 GB` · `CPU` |
| `article` | `body/sec/sec/p/table-wrap/table/thead/tr/th` | 30 | `Parameter` · `Value` · `#` |
| `article` | `body/sec/sec/p/table-wrap/table/@rules` | 30 | `all` |
| `article` | `body/sec/sec/p/table-wrap/table/@frame` | 30 | `box` |
| `article` | `body/sec/sec/p/table-wrap/table/@cellpadding` | 30 | `5` |
| `article` | `body/sec/sec/p/table-wrap/table/colgroup/col/@span` | 30 | `2` · `7` · `10` |
| `publication` | `publication/volume/article/articleinfo/abstract/tex` | 28 | `$\frac{\mathrm{D}}{\mathrm{d}}$` · `$\mathrm{M}+\mathrm{M}=\frac{\mathrm{D}}` · `$D\|\|\, = QD\parallel\!\!\!\!\!-$` |
| `article` | `body/sec/sec/p/inline-formula/tex-math` | 27 | `$4 \times 4$` · `$8 \times 8,\ 16\times 16,\ 32\times 32$` · `$64 \times 64$` |
| `article` | `body/sec/sec/p/inline-formula/tex-math/@notation` | 27 | `LaTeX` |
| `article` | `body/sec/p/table-wrap/table/tbody/tr/td` | 26 | `Initial Search` · `2,753` · `0.068` |
| `article` | `body/sec/p/table-wrap/table/@rules` | 26 | `all` |
| `article` | `body/sec/p/table-wrap/table/@frame` | 26 | `box` |
| `article` | `body/sec/p/table-wrap/table/@cellpadding` | 26 | `5` |
| `article` | `body/sec/p/table-wrap/table/colgroup/col/@span` | 26 | `3` · `4` · `6` |
| `article` | `article/back/ref-list/ref/mixed-citation/conf-date` | 25 | `2016` · `2023 Jun 2` · `2019` |
| `article` | `body/sec/p/table-wrap/table/thead/tr/th` | 24 | `Step` · `Computations` · `Processing Time (seconds)` |
| `article` | `article/back/ref-list/ref/mixed-citation/pub-id` | 24 | `10.1109/JPROC.2021.3080916` · `200806534 [cs]` · `210414786 [cs` |
| `article` | `article/back/ref-list/ref/mixed-citation/pub-id/@pub-id-type` | 24 | `doi` · `arxiv` |
| `article` | `article/front/article-meta/title-group/subtitle` | 24 | `Historical Briefs From Past Issues` · `Archiving the Past While Creating a Sust` · `A Scene Description Framework for Intera` |
| `article` | `article/body/sec/sec/p/table-wrap/table/tbody/tr/td` | 23 | `2P5D` · `UHD-1@8-bit (3840x2160)` · `5` |
| `article` | `body/sec/p/inline-formula/tex-math` | 23 | `$n$` · `$\text{YC}_{\mathrm{B}}\mathrm{C}_{\math` · `$\mathrm{C}_{\mathrm{B}}/\mathrm{C}_{\ma` |
| `article` | `body/sec/p/inline-formula/tex-math/@notation` | 23 | `LaTeX` |
| `article` | `article/front/article-meta/contrib-group/contrib/degrees` | 23 | `MA, MBA, MFA` · `Dipl. Engineer Media Technology` · `PhD` |
| `article` | `article/body/sec/sec/p/table-wrap/table/@rules` | 23 | `all` |
| `article` | `article/body/sec/sec/p/table-wrap/table/@frame` | 23 | `box` |
| `article` | `article/body/sec/sec/p/table-wrap/table/@cellpadding` | 23 | `5` |
| `article` | `article/body/sec/sec/p/table-wrap/table/colgroup/col/@span` | 23 | `4` · `3` · `13` |
| `article` | `article/body/sec/sec/p/table-wrap/table/thead/tr/th` | 21 | `Name` · `Format` · `Duration (secs)` |
| `article` | `back/ref-list/ref/mixed-citation/date-in-citation` | 20 | `,` · `.` · `-` |
| `article` | `article/back/ref-list/ref/mixed-citation/person-group/etal` | 20 | `et al.` |
| `publication` | `publication/volume/article/articleinfo/abstract/inline-formula/tex-math` | 19 | `$\times$` · `$10.000\times1.920$` · `$\Delta $` |
| `article` | `article/front/article-meta/funding-group/award-group/funding-source/institution-wrap/institution` | 19 | `Erlangen National High Performance Compu` · `Friedrich-Alexander-Universitat Erlanqen` · `German Research Foundation (DFG)` |
| `publication` | `publication/volume/article/articleinfo/abstract/inline-formula/tex-math/@notation` | 19 | `LaTeX` |

_… 219 more (see JSON)_

## 🗑️ SKIP — filed for the record

- 434 structural / boilerplate / delivery-metadata / editorial-workflow paths
- 296 type-marker attributes

Full list in `sourceFieldCensus.paths.json` — filter by `bucket: "unmapped"` and cross-check against your reader.

