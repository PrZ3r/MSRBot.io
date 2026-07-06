# Deep Source-XML Inventory — pre-#1171 Audit Part 2

> Generated at: 2026-07-06T20:28:19.930Z
> Schema fields modeled in 2.3.0: **110**
> Decisions captured in sourceInventory.smpte.schemaMap.md: **105**

## Per-subtree overview

| subtree | files sampled | distinct paths | new-unseen paths |
|---|---:|---:|---:|
| APTARA / DL Project Files | 5000 | 2067 | 1858 |
| APTARA / METADATA and PDFs | 5000 | 724 | 616 |
| HIGHWIRE / HW Usage Data | 0 | 0 | 0 |
| HIGHWIRE / ORIGINAL SAMPLES | 361 | 232 | 207 |
| HIGHWIRE / Source Bak | 5000 | 136 | 120 |
| ALLEN PRESS / DELIVERED TO IEEEE | 112 | 227 | 178 |
| ALLEN PRESS / JOURNAL SAMPLES | 96 | 235 | 183 |
| IEEE / IEEE FTP FILES | 194 | 695 | 551 |
| IEEE DL Usage Data (all years) | 0 | 0 | 0 |
| Zoho | 0 | 0 | 0 |

## Top 60 new-unseen element paths across all subtrees

> Paths that appear in `_source/` XML but were never mentioned in `sourceInventory.smpte.schemaMap.md` and are not among the schema 2.3.0 field names. Real gaps — evaluate for schema promotion vs #1171 envelope capture vs deferred.

| path | total | per-subtree |
|---|---:|---|
| `component/reflist/ref` | 47473 | APTARA / DL Project Files: 21586 · APTARA / METADATA and PDFs: 23828 · ALLEN PRESS / DELIVERED TO IEEEE: 1126 · ALLEN PRESS / JOURNAL SAMPLES: 933 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author` | 34011 | APTARA / DL Project Files: 15911 · APTARA / METADATA and PDFs: 16749 · ALLEN PRESS / DELIVERED TO IEEEE: 681 · ALLEN PRESS / JOURNAL SAMPLES: 670 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/init` | 34011 | APTARA / DL Project Files: 15911 · APTARA / METADATA and PDFs: 16749 · ALLEN PRESS / DELIVERED TO IEEEE: 681 · ALLEN PRESS / JOURNAL SAMPLES: 670 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/ref_surname` | 34011 | APTARA / DL Project Files: 15911 · APTARA / METADATA and PDFs: 16749 · ALLEN PRESS / DELIVERED TO IEEEE: 681 · ALLEN PRESS / JOURNAL SAMPLES: 670 |
| `component/reflist/ref/periodical` | 27639 | APTARA / DL Project Files: 13383 · APTARA / METADATA and PDFs: 13795 · ALLEN PRESS / DELIVERED TO IEEEE: 240 · ALLEN PRESS / JOURNAL SAMPLES: 221 |
| `component/reflist/ref/periodical/date` | 26380 | APTARA / DL Project Files: 13059 · APTARA / METADATA and PDFs: 12870 · ALLEN PRESS / DELIVERED TO IEEEE: 236 · ALLEN PRESS / JOURNAL SAMPLES: 215 |
| `component/reflist/ref/periodical/pageinfo` | 24066 | APTARA / DL Project Files: 12365 · APTARA / METADATA and PDFs: 11302 · ALLEN PRESS / DELIVERED TO IEEEE: 203 · ALLEN PRESS / JOURNAL SAMPLES: 196 |
| `component/reflist/ref/periodical/pageinfo/startpage` | 24066 | APTARA / DL Project Files: 12365 · APTARA / METADATA and PDFs: 11302 · ALLEN PRESS / DELIVERED TO IEEEE: 203 · ALLEN PRESS / JOURNAL SAMPLES: 196 |
| `component/reflist/ref/periodical/ref_articletitle` | 20946 | APTARA / DL Project Files: 10930 · APTARA / METADATA and PDFs: 9555 · ALLEN PRESS / DELIVERED TO IEEEE: 240 · ALLEN PRESS / JOURNAL SAMPLES: 221 |
| `component/reflist/ref/periodical/ref_authorgrp` | 20737 | APTARA / DL Project Files: 10237 · APTARA / METADATA and PDFs: 10042 · ALLEN PRESS / DELIVERED TO IEEEE: 238 · ALLEN PRESS / JOURNAL SAMPLES: 220 |
| `component/reflist/ref/periodical/date/month` | 19850 | APTARA / DL Project Files: 10029 · APTARA / METADATA and PDFs: 9548 · ALLEN PRESS / DELIVERED TO IEEEE: 148 · ALLEN PRESS / JOURNAL SAMPLES: 125 |
| `journal_article` | 19622 | APTARA / DL Project Files: 9669 · APTARA / METADATA and PDFs: 9699 · ALLEN PRESS / DELIVERED TO IEEEE: 14 · ALLEN PRESS / JOURNAL SAMPLES: 74 · IEEE / IEEE FTP FILES: 166 |
| `journal_article/pubitype` | 19622 | APTARA / DL Project Files: 9669 · APTARA / METADATA and PDFs: 9699 · ALLEN PRESS / DELIVERED TO IEEEE: 14 · ALLEN PRESS / JOURNAL SAMPLES: 74 · IEEE / IEEE FTP FILES: 166 |
| `pages/first_page` | 19211 | APTARA / DL Project Files: 9318 · APTARA / METADATA and PDFs: 9693 · ALLEN PRESS / DELIVERED TO IEEEE: 9 · IEEE / IEEE FTP FILES: 191 |
| `pages/last_page` | 19211 | APTARA / DL Project Files: 9318 · APTARA / METADATA and PDFs: 9693 · ALLEN PRESS / DELIVERED TO IEEEE: 9 · IEEE / IEEE FTP FILES: 191 |
| `article_status` | 19211 | APTARA / DL Project Files: 9318 · APTARA / METADATA and PDFs: 9693 · ALLEN PRESS / DELIVERED TO IEEEE: 9 · IEEE / IEEE FTP FILES: 191 |
| `copyright_statement` | 19202 | APTARA / DL Project Files: 9318 · APTARA / METADATA and PDFs: 9693 · IEEE / IEEE FTP FILES: 191 |
| `article_editstate` | 15200 | APTARA / DL Project Files: 7332 · APTARA / METADATA and PDFs: 7768 · IEEE / IEEE FTP FILES: 100 |
| `journal_article/month` | 12783 | APTARA / DL Project Files: 6988 · APTARA / METADATA and PDFs: 5657 · IEEE / IEEE FTP FILES: 138 |
| `component/reflist/ref/periodical/pageinfo/endpage` | 11357 | APTARA / DL Project Files: 6552 · APTARA / METADATA and PDFs: 4432 · ALLEN PRESS / DELIVERED TO IEEEE: 193 · ALLEN PRESS / JOURNAL SAMPLES: 180 |
| `article/back/ref-list/ref/citation/person-group/name/surname` | 10968 | HIGHWIRE / ORIGINAL SAMPLES: 1454 · HIGHWIRE / Source Bak: 9514 |
| `article/back/ref-list/ref/citation/person-group/name/given-names` | 10837 | HIGHWIRE / ORIGINAL SAMPLES: 1439 · HIGHWIRE / Source Bak: 9398 |
| `article/front/journal-meta/journal-id` | 10700 | HIGHWIRE / ORIGINAL SAMPLES: 700 · HIGHWIRE / Source Bak: 10000 |
| `article/front/article-meta/article-id` | 10700 | HIGHWIRE / ORIGINAL SAMPLES: 700 · HIGHWIRE / Source Bak: 10000 |
| `journal_article/contributors/author` | 9418 | APTARA / DL Project Files: 4983 · APTARA / METADATA and PDFs: 4230 · ALLEN PRESS / JOURNAL SAMPLES: 101 · IEEE / IEEE FTP FILES: 104 |
| `journal_article/contributors/author/person_name` | 9418 | APTARA / DL Project Files: 4983 · APTARA / METADATA and PDFs: 4230 · ALLEN PRESS / JOURNAL SAMPLES: 101 · IEEE / IEEE FTP FILES: 104 |
| `journal_article/contributors/author/person_name/given_name` | 9418 | APTARA / DL Project Files: 4983 · APTARA / METADATA and PDFs: 4230 · ALLEN PRESS / JOURNAL SAMPLES: 101 · IEEE / IEEE FTP FILES: 104 |
| `journal_article/contributors/author/person_name/surname` | 9418 | APTARA / DL Project Files: 4983 · APTARA / METADATA and PDFs: 4230 · ALLEN PRESS / JOURNAL SAMPLES: 101 · IEEE / IEEE FTP FILES: 104 |
| `article/back/ref-list/ref` | 9130 | HIGHWIRE / ORIGINAL SAMPLES: 1152 · HIGHWIRE / Source Bak: 7978 |
| `article/back/ref-list/ref/citation` | 9130 | HIGHWIRE / ORIGINAL SAMPLES: 1152 · HIGHWIRE / Source Bak: 7978 |
| `component/reflist/ref/other` | 8821 | APTARA / DL Project Files: 5449 · APTARA / METADATA and PDFs: 3000 · ALLEN PRESS / DELIVERED TO IEEEE: 257 · ALLEN PRESS / JOURNAL SAMPLES: 115 |
| `article/back/ref-list/ref/citation/source` | 8294 | HIGHWIRE / ORIGINAL SAMPLES: 1015 · HIGHWIRE / Source Bak: 7279 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author` | 8233 | APTARA / DL Project Files: 2468 · APTARA / METADATA and PDFs: 4787 · ALLEN PRESS / DELIVERED TO IEEEE: 554 · ALLEN PRESS / JOURNAL SAMPLES: 424 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author/init` | 8233 | APTARA / DL Project Files: 2468 · APTARA / METADATA and PDFs: 4787 · ALLEN PRESS / DELIVERED TO IEEEE: 554 · ALLEN PRESS / JOURNAL SAMPLES: 424 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author/ref_surname` | 8233 | APTARA / DL Project Files: 2468 · APTARA / METADATA and PDFs: 4787 · ALLEN PRESS / DELIVERED TO IEEEE: 554 · ALLEN PRESS / JOURNAL SAMPLES: 424 |
| `article/back/ref-list/ref/label` | 7722 | HIGHWIRE / ORIGINAL SAMPLES: 547 · HIGHWIRE / Source Bak: 7175 |
| `component/objid` | 7651 | APTARA / DL Project Files: 4737 · APTARA / METADATA and PDFs: 2585 · ALLEN PRESS / DELIVERED TO IEEEE: 97 · ALLEN PRESS / JOURNAL SAMPLES: 84 · IEEE / IEEE FTP FILES: 148 |
| `article/back/ref-list/ref/citation/person-group` | 7306 | HIGHWIRE / ORIGINAL SAMPLES: 815 · HIGHWIRE / Source Bak: 6491 |
| `component/reflist/ref/periodical/issuenum` | 5984 | APTARA / DL Project Files: 2141 · APTARA / METADATA and PDFs: 3543 · ALLEN PRESS / DELIVERED TO IEEEE: 141 · ALLEN PRESS / JOURNAL SAMPLES: 159 |
| `journal_article/contributors` | 5865 | APTARA / DL Project Files: 3189 · APTARA / METADATA and PDFs: 2576 · ALLEN PRESS / JOURNAL SAMPLES: 44 · IEEE / IEEE FTP FILES: 56 |
| `component/reflist/ref/book/ref_authorgrp/ref_author` | 5636 | APTARA / DL Project Files: 1552 · APTARA / METADATA and PDFs: 3252 · ALLEN PRESS / DELIVERED TO IEEEE: 450 · ALLEN PRESS / JOURNAL SAMPLES: 382 |
| `component/reflist/ref/book/ref_authorgrp/ref_author/init` | 5636 | APTARA / DL Project Files: 1552 · APTARA / METADATA and PDFs: 3252 · ALLEN PRESS / DELIVERED TO IEEEE: 450 · ALLEN PRESS / JOURNAL SAMPLES: 382 |
| `component/reflist/ref/book/ref_authorgrp/ref_author/ref_surname` | 5636 | APTARA / DL Project Files: 1552 · APTARA / METADATA and PDFs: 3252 · ALLEN PRESS / DELIVERED TO IEEEE: 450 · ALLEN PRESS / JOURNAL SAMPLES: 382 |
| `content_batch/body/standard/productinfo_table/productinfo/price/price_list` | 5389 | APTARA / DL Project Files: 1686 · APTARA / METADATA and PDFs: 3688 · IEEE / IEEE FTP FILES: 15 |
| `content_batch/body/standard/productinfo_table/productinfo/price/price_list/list_name` | 5389 | APTARA / DL Project Files: 1686 · APTARA / METADATA and PDFs: 3688 · IEEE / IEEE FTP FILES: 15 |
| `content_batch/body/standard/productinfo_table/productinfo/price/price_list/list_price` | 5389 | APTARA / DL Project Files: 1686 · APTARA / METADATA and PDFs: 3688 · IEEE / IEEE FTP FILES: 15 |
| `content_batch/body/standard/productinfo_table/productinfo/price/price_list/list_start_date` | 5389 | APTARA / DL Project Files: 1686 · APTARA / METADATA and PDFs: 3688 · IEEE / IEEE FTP FILES: 15 |
| `content_batch/body/standard/productinfo_table/productinfo/price/price_list/list_start_date/day` | 5389 | APTARA / DL Project Files: 1686 · APTARA / METADATA and PDFs: 3688 · IEEE / IEEE FTP FILES: 15 |
| `content_batch/body/standard/productinfo_table/productinfo/price/price_list/list_start_date/month` | 5389 | APTARA / DL Project Files: 1686 · APTARA / METADATA and PDFs: 3688 · IEEE / IEEE FTP FILES: 15 |
| `content_batch/body/standard/productinfo_table/productinfo/price/price_list/list_end_date` | 5389 | APTARA / DL Project Files: 1686 · APTARA / METADATA and PDFs: 3688 · IEEE / IEEE FTP FILES: 15 |
| `content_batch/body/standard/productinfo_table/productinfo/price/price_list/list_end_date/day` | 5389 | APTARA / DL Project Files: 1686 · APTARA / METADATA and PDFs: 3688 · IEEE / IEEE FTP FILES: 15 |
| `content_batch/body/standard/productinfo_table/productinfo/price/price_list/list_end_date/month` | 5389 | APTARA / DL Project Files: 1686 · APTARA / METADATA and PDFs: 3688 · IEEE / IEEE FTP FILES: 15 |
| `component` | 5355 | APTARA / DL Project Files: 2441 · APTARA / METADATA and PDFs: 2585 · ALLEN PRESS / DELIVERED TO IEEEE: 97 · ALLEN PRESS / JOURNAL SAMPLES: 84 · IEEE / IEEE FTP FILES: 148 |
| `component/reflist` | 5355 | APTARA / DL Project Files: 2441 · APTARA / METADATA and PDFs: 2585 · ALLEN PRESS / DELIVERED TO IEEEE: 97 · ALLEN PRESS / JOURNAL SAMPLES: 84 · IEEE / IEEE FTP FILES: 148 |
| `article` | 5350 | HIGHWIRE / ORIGINAL SAMPLES: 350 · HIGHWIRE / Source Bak: 5000 |
| `article/front` | 5350 | HIGHWIRE / ORIGINAL SAMPLES: 350 · HIGHWIRE / Source Bak: 5000 |
| `article/front/journal-meta` | 5350 | HIGHWIRE / ORIGINAL SAMPLES: 350 · HIGHWIRE / Source Bak: 5000 |
| `article/front/journal-meta/journal-title` | 5350 | HIGHWIRE / ORIGINAL SAMPLES: 350 · HIGHWIRE / Source Bak: 5000 |
| `article/front/journal-meta/publisher/publisher-name` | 5350 | HIGHWIRE / ORIGINAL SAMPLES: 350 · HIGHWIRE / Source Bak: 5000 |
| `article/front/journal-meta/publisher/publisher-loc` | 5350 | HIGHWIRE / ORIGINAL SAMPLES: 350 · HIGHWIRE / Source Bak: 5000 |

## Per-subtree detail — status breakdown + top 15 new-unseen

### APTARA / DL Project Files

- Files sampled: 5000
- Directory: `_source/SMPTE/APTARA/DL Project Files`

| status | distinct paths |
|---|---:|
| modeled | 185 |
| deferred | 10 |
| mapped-meta | 14 |
| new-unseen | 1858 |

Top 15 new-unseen paths in this subtree:

| path | count |
|---|---:|
| `component/reflist/ref` | 21586 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author` | 15911 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/init` | 15911 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/ref_surname` | 15911 |
| `component/reflist/ref/periodical` | 13383 |
| `component/reflist/ref/periodical/date` | 13059 |
| `component/reflist/ref/periodical/pageinfo` | 12365 |
| `component/reflist/ref/periodical/pageinfo/startpage` | 12365 |
| `component/reflist/ref/periodical/ref_articletitle` | 10930 |
| `component/reflist/ref/periodical/ref_authorgrp` | 10237 |
| `component/reflist/ref/periodical/date/month` | 10029 |
| `journal_article` | 9669 |
| `journal_article/pubitype` | 9669 |
| `pages/first_page` | 9318 |
| `pages/last_page` | 9318 |

### APTARA / METADATA and PDFs

- Files sampled: 5000
- Directory: `_source/SMPTE/APTARA/METADATA and PDFs ALL CONTENT`

| status | distinct paths |
|---|---:|
| modeled | 93 |
| deferred | 9 |
| mapped-meta | 6 |
| new-unseen | 616 |

Top 15 new-unseen paths in this subtree:

| path | count |
|---|---:|
| `component/reflist/ref` | 23828 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author` | 16749 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/init` | 16749 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/ref_surname` | 16749 |
| `component/reflist/ref/periodical` | 13795 |
| `component/reflist/ref/periodical/date` | 12870 |
| `component/reflist/ref/periodical/pageinfo` | 11302 |
| `component/reflist/ref/periodical/pageinfo/startpage` | 11302 |
| `component/reflist/ref/periodical/ref_authorgrp` | 10042 |
| `journal_article` | 9699 |
| `journal_article/pubitype` | 9699 |
| `pages/first_page` | 9693 |
| `pages/last_page` | 9693 |
| `copyright_statement` | 9693 |
| `article_status` | 9693 |

### HIGHWIRE / HW Usage Data

- Files sampled: 0
- Directory: `_source/SMPTE/HIGHWIRE/HW Usage Data`

| status | distinct paths |
|---|---:|
| modeled | 0 |
| deferred | 0 |
| mapped-meta | 0 |
| new-unseen | 0 |

_(no new-unseen paths — all element paths modeled or classified)_

### HIGHWIRE / ORIGINAL SAMPLES

- Files sampled: 361
- Directory: `_source/SMPTE/HIGHWIRE/ORIGINAL SAMPLES`

| status | distinct paths |
|---|---:|
| modeled | 25 |
| deferred | 0 |
| mapped-meta | 0 |
| new-unseen | 207 |

Top 15 new-unseen paths in this subtree:

| path | count |
|---|---:|
| `article/back/ref-list/ref/citation/person-group/name/surname` | 1454 |
| `article/back/ref-list/ref/citation/person-group/name/given-names` | 1439 |
| `article/back/ref-list/ref` | 1152 |
| `article/back/ref-list/ref/citation` | 1152 |
| `article/back/ref-list/ref/citation/source` | 1015 |
| `article/front/article-meta/custom-meta-wrap/custom-meta` | 1007 |
| `article/front/article-meta/custom-meta-wrap/custom-meta/meta-name` | 1007 |
| `article/front/article-meta/custom-meta-wrap/custom-meta/meta-value` | 1007 |
| `article/back/ref-list/ref/citation/person-group` | 815 |
| `article/front/article-meta/kwd-group/kwd` | 786 |
| `article/front/journal-meta/journal-id` | 700 |
| `article/front/article-meta/article-id` | 700 |
| `article/front/article-meta/contrib-group/contrib/xref` | 609 |
| `article/back/ref-list/ref/label` | 547 |
| `article/front/article-meta/contrib-group/contrib` | 490 |

### HIGHWIRE / Source Bak

- Files sampled: 5000
- Directory: `_source/SMPTE/HIGHWIRE/Source Bak`

| status | distinct paths |
|---|---:|
| modeled | 16 |
| deferred | 0 |
| mapped-meta | 0 |
| new-unseen | 120 |

Top 15 new-unseen paths in this subtree:

| path | count |
|---|---:|
| `article/front/journal-meta/journal-id` | 10000 |
| `article/front/article-meta/article-id` | 10000 |
| `article/back/ref-list/ref/citation/person-group/name/surname` | 9514 |
| `article/back/ref-list/ref/citation/person-group/name/given-names` | 9398 |
| `article/back/ref-list/ref` | 7978 |
| `article/back/ref-list/ref/citation` | 7978 |
| `article/back/ref-list/ref/citation/source` | 7279 |
| `article/back/ref-list/ref/label` | 7175 |
| `article/back/ref-list/ref/citation/person-group` | 6491 |
| `article` | 5000 |
| `article/front` | 5000 |
| `article/front/journal-meta` | 5000 |
| `article/front/journal-meta/journal-title` | 5000 |
| `article/front/journal-meta/publisher/publisher-name` | 5000 |
| `article/front/journal-meta/publisher/publisher-loc` | 5000 |

### ALLEN PRESS / DELIVERED TO IEEEE

- Files sampled: 112
- Directory: `_source/SMPTE/ALLEN PRESS/DELIVERED TO IEEEE`

| status | distinct paths |
|---|---:|
| modeled | 40 |
| deferred | 3 |
| mapped-meta | 6 |
| new-unseen | 178 |

Top 15 new-unseen paths in this subtree:

| path | count |
|---|---:|
| `component/reflist/ref` | 1126 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author` | 681 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/init` | 681 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/ref_surname` | 681 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author` | 554 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author/init` | 554 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author/ref_surname` | 554 |
| `component/reflist/ref/book/ref_authorgrp/ref_author` | 450 |
| `component/reflist/ref/book/ref_authorgrp/ref_author/init` | 450 |
| `component/reflist/ref/book/ref_authorgrp/ref_author/ref_surname` | 450 |
| `content_batch/body/journal/journal_article` | 404 |
| `content_batch/body/journal/journal_article/pubitype` | 404 |
| `content_batch/body/journal/journal_article/title` | 399 |
| `content_batch/body/journal/journal_article/pages/first_page` | 399 |
| `content_batch/body/journal/journal_article/pages/last_page` | 399 |

### ALLEN PRESS / JOURNAL SAMPLES

- Files sampled: 96
- Directory: `_source/SMPTE/ALLEN PRESS/JOURNAL SAMPLES`

| status | distinct paths |
|---|---:|
| modeled | 41 |
| deferred | 6 |
| mapped-meta | 5 |
| new-unseen | 183 |

Top 15 new-unseen paths in this subtree:

| path | count |
|---|---:|
| `component/reflist/ref` | 933 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author` | 670 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/init` | 670 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/ref_surname` | 670 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author` | 424 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author/init` | 424 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author/ref_surname` | 424 |
| `component/reflist/ref/book/ref_authorgrp/ref_author` | 382 |
| `component/reflist/ref/book/ref_authorgrp/ref_author/init` | 382 |
| `component/reflist/ref/book/ref_authorgrp/ref_author/ref_surname` | 382 |
| `component/reflist/ref/book` | 280 |
| `component/reflist/ref/book/ref_city` | 280 |
| `component/reflist/ref/book/publishername` | 280 |
| `component/reflist/ref/book/date` | 279 |
| `component/reflist/ref/book/ref_authorgrp` | 274 |

### IEEE / IEEE FTP FILES

- Files sampled: 194
- Directory: `_source/SMPTE/IEEE/IEEE FTP FILES`

| status | distinct paths |
|---|---:|
| modeled | 122 |
| deferred | 9 |
| mapped-meta | 13 |
| new-unseen | 551 |

Top 15 new-unseen paths in this subtree:

| path | count |
|---|---:|
| `component/reflist/topic/ref` | 1164 |
| `content_batch/body/conference/conference_article/index_terms/term` | 789 |
| `component/reflist/topic/ref/periodical/ref_authorgrp/ref_author` | 566 |
| `component/reflist/topic/ref/periodical/ref_authorgrp/ref_author/init` | 566 |
| `component/reflist/topic/ref/periodical/ref_authorgrp/ref_author/ref_surname` | 566 |
| `component/reflist/topic/ref/confproc/ref_authorgrp/ref_author` | 496 |
| `component/reflist/topic/ref/confproc/ref_authorgrp/ref_author/init` | 496 |
| `component/reflist/topic/ref/confproc/ref_authorgrp/ref_author/ref_surname` | 496 |
| `component/reflist/topic/ref/periodical` | 297 |
| `component/reflist/topic/ref/other` | 292 |
| `component/reflist/topic/ref/periodical/ref_authorgrp` | 288 |
| `component/reflist/topic/ref/periodical/date` | 288 |
| `component/reflist/topic/ref/periodical/ref_articletitle` | 281 |
| `content_batch/body/conference/conference_article/contributors/author` | 258 |
| `content_batch/body/conference/conference_article/contributors/author/person_name` | 258 |

### IEEE DL Usage Data (all years)

- Files sampled: 0
- Directory: `_source/SMPTE/IEEE DL Usage Data`

| status | distinct paths |
|---|---:|
| modeled | 0 |
| deferred | 0 |
| mapped-meta | 0 |
| new-unseen | 0 |

_(no new-unseen paths — all element paths modeled or classified)_

### Zoho

- Files sampled: 0
- Directory: `_source/SMPTE/Zoho`

| status | distinct paths |
|---|---:|
| modeled | 0 |
| deferred | 0 |
| mapped-meta | 0 |
| new-unseen | 0 |

_(no new-unseen paths — all element paths modeled or classified)_

---
Full detail per subtree lives in `sourceInventory.deep.json`.