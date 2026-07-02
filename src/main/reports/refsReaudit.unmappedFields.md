# Refs Re-Audit — Unmapped Source-XML Fields

> Generated at: 2026-06-22
> Schema fields modeled in 2.2.0: **110**
> Decisions captured in sourceInventory.smpte.schemaMap.md: **105**

## Top 50 'new-unseen' XML element paths across all samples

> Paths that appear in source XML but were never mentioned in `sourceInventory.smpte.schemaMap.md` — real gaps to evaluate for schema 2.3.0 vs #1171 envelope capture.

| Path | Total sightings | Per-source |
|---|---:|---|
| `component/reflist/ref` | 13418 | APTARA journal: 12485 · ALLEN PRESS journal: 933 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author` | 8705 | APTARA journal: 8035 · ALLEN PRESS journal: 670 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/init` | 8705 | APTARA journal: 8035 · ALLEN PRESS journal: 670 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/ref_surname` | 8705 | APTARA journal: 8035 · ALLEN PRESS journal: 670 |
| `component/reflist/ref/periodical` | 8208 | APTARA journal: 7987 · ALLEN PRESS journal: 221 |
| `component/reflist/ref/periodical/date` | 7487 | APTARA journal: 7272 · ALLEN PRESS journal: 215 |
| `journal_article` | 7257 | APTARA journal: 7183 · ALLEN PRESS journal: 74 |
| `journal_article/pubitype` | 7257 | APTARA journal: 7183 · ALLEN PRESS journal: 74 |
| `component/reflist/ref/periodical/pageinfo` | 6515 | APTARA journal: 6319 · ALLEN PRESS journal: 196 |
| `component/reflist/ref/periodical/pageinfo/startpage` | 6515 | APTARA journal: 6319 · ALLEN PRESS journal: 196 |
| `pages/first_page` | 6144 | APTARA journal: 6144 |
| `pages/last_page` | 6144 | APTARA journal: 6144 |
| `copyright_statement` | 6144 | APTARA journal: 6144 |
| `article_status` | 6144 | APTARA journal: 6144 |
| `article_editstate` | 5898 | APTARA journal: 5898 |
| `component/reflist/ref/periodical/date/month` | 5469 | APTARA journal: 5344 · ALLEN PRESS journal: 125 |
| `component/reflist/ref/periodical/ref_authorgrp` | 5091 | APTARA journal: 4871 · ALLEN PRESS journal: 220 |
| `journal_article/month` | 4859 | APTARA journal: 4859 |
| `component/reflist/ref/periodical/ref_articletitle` | 4776 | APTARA journal: 4555 · ALLEN PRESS journal: 221 |
| `journal_article/contributors/author` | 4085 | APTARA journal: 3984 · ALLEN PRESS journal: 101 |
| `journal_article/contributors/author/person_name` | 4085 | APTARA journal: 3984 · ALLEN PRESS journal: 101 |
| `journal_article/contributors/author/person_name/given_name` | 4085 | APTARA journal: 3984 · ALLEN PRESS journal: 101 |
| `journal_article/contributors/author/person_name/surname` | 4085 | APTARA journal: 3984 · ALLEN PRESS journal: 101 |
| `article/back/ref-list/ref/citation/person-group/name/surname` | 3409 | HIGHWIRE Source Bak: 3409 |
| `article/back/ref-list/ref/citation/person-group/name/given-names` | 3362 | HIGHWIRE Source Bak: 3362 |
| `article/front/journal-meta/journal-id` | 3000 | HIGHWIRE Source Bak: 3000 |
| `article/front/article-meta/article-id` | 3000 | HIGHWIRE Source Bak: 3000 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author` | 2941 | APTARA journal: 2517 · ALLEN PRESS journal: 424 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author/init` | 2941 | APTARA journal: 2517 · ALLEN PRESS journal: 424 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author/ref_surname` | 2941 | APTARA journal: 2517 · ALLEN PRESS journal: 424 |
| `article/back/ref-list/ref` | 2865 | HIGHWIRE Source Bak: 2865 |
| `article/back/ref-list/ref/citation` | 2865 | HIGHWIRE Source Bak: 2865 |
| `article/back/ref-list/ref/citation/source` | 2596 | HIGHWIRE Source Bak: 2596 |
| `article/back/ref-list/ref/label` | 2582 | HIGHWIRE Source Bak: 2582 |
| `component/reflist/ref/periodical/pageinfo/endpage` | 2541 | APTARA journal: 2361 · ALLEN PRESS journal: 180 |
| `journal_article/contributors` | 2408 | APTARA journal: 2364 · ALLEN PRESS journal: 44 |
| `article/back/ref-list/ref/citation/person-group` | 2386 | HIGHWIRE Source Bak: 2386 |
| `component/reflist/ref/book/ref_authorgrp/ref_author` | 1945 | APTARA journal: 1563 · ALLEN PRESS journal: 382 |
| `component/reflist/ref/book/ref_authorgrp/ref_author/init` | 1945 | APTARA journal: 1563 · ALLEN PRESS journal: 382 |
| `component/reflist/ref/book/ref_authorgrp/ref_author/ref_surname` | 1945 | APTARA journal: 1563 · ALLEN PRESS journal: 382 |
| `journal_article/contributors/author/organization` | 1774 | APTARA journal: 1774 |
| `component/reflist/ref/book` | 1756 | APTARA journal: 1476 · ALLEN PRESS journal: 280 |
| `component/reflist/ref/book/ref_city` | 1756 | APTARA journal: 1476 · ALLEN PRESS journal: 280 |
| `component/reflist/ref/book/publishername` | 1756 | APTARA journal: 1476 · ALLEN PRESS journal: 280 |
| `article/back/ref-list/ref/citation/fpage` | 1725 | HIGHWIRE Source Bak: 1725 |
| `article/back/ref-list/ref/citation/article-title` | 1659 | HIGHWIRE Source Bak: 1659 |
| `component/reflist/ref/periodical/issuenum` | 1639 | APTARA journal: 1480 · ALLEN PRESS journal: 159 |
| `component/reflist/ref/book/date` | 1634 | APTARA journal: 1355 · ALLEN PRESS journal: 279 |
| `article` | 1500 | HIGHWIRE Source Bak: 1500 |
| `article/front` | 1500 | HIGHWIRE Source Bak: 1500 |

## HIGHWIRE standards (originals) — 8 files sampled

| status | distinct paths |
|---|---:|
| modeled | 9 |
| deferred | 0 |
| mapped-meta | 0 |
| new-unseen | 62 |

Top 25 new-unseen paths in this source:

| path | count |
|---|---:|
| `book/body/book-part/back/ref-list/ref` | 118 |
| `book/body/book-part/back/ref-list/ref/mixed-citation` | 117 |
| `book/body/book-part/back/ref-list/ref/mixed-citation/std` | 114 |
| `book/body/book-part/back/ref-list/ref/mixed-citation/pub-id` | 34 |
| `book/book-meta/book-id` | 32 |
| `book/body/book-part/book-part-meta/book-part-categories/subj-group/subject` | 30 |
| `book/book-meta/custom-meta-group/custom-meta` | 26 |
| `book/book-meta/custom-meta-group/custom-meta/meta-name` | 26 |
| `book/book-meta/custom-meta-group/custom-meta/meta-value` | 26 |
| `book/body/book-part/book-part-meta/kwd-group/kwd` | 17 |
| `book/book-meta/publisher/publisher-name/named-content` | 16 |
| `book/body/book-part/book-part-meta/book-part-categories/subj-group` | 16 |
| `book/body/book-part/book-part-meta/abstract/p` | 12 |
| `book/body/book-part/back/ref-list` | 12 |
| `book/body/book-part/back/ref-list/title` | 12 |
| `book/body/book-part/book-part-meta/abstract/list/list-item` | 10 |
| `book/body/book-part/book-part-meta/abstract/list/list-item/p` | 10 |
| `book/body/book-part/back/ref-list/p` | 9 |
| `book` | 8 |
| `book/book-meta` | 8 |
| `book/book-meta/book-title-group` | 8 |
| `book/book-meta/book-title-group/book-title` | 8 |
| `book/book-meta/publisher/publisher-name` | 8 |
| `book/book-meta/publisher/publisher-loc` | 8 |
| `book/book-meta/publisher/publisher-loc/addr-line` | 8 |

## HIGHWIRE Source Bak — 1500 files sampled

| status | distinct paths |
|---|---:|
| modeled | 16 |
| deferred | 0 |
| mapped-meta | 0 |
| new-unseen | 101 |

Top 25 new-unseen paths in this source:

| path | count |
|---|---:|
| `article/back/ref-list/ref/citation/person-group/name/surname` | 3409 |
| `article/back/ref-list/ref/citation/person-group/name/given-names` | 3362 |
| `article/front/journal-meta/journal-id` | 3000 |
| `article/front/article-meta/article-id` | 3000 |
| `article/back/ref-list/ref` | 2865 |
| `article/back/ref-list/ref/citation` | 2865 |
| `article/back/ref-list/ref/citation/source` | 2596 |
| `article/back/ref-list/ref/label` | 2582 |
| `article/back/ref-list/ref/citation/person-group` | 2386 |
| `article/back/ref-list/ref/citation/fpage` | 1725 |
| `article/back/ref-list/ref/citation/article-title` | 1659 |
| `article` | 1500 |
| `article/front` | 1500 |
| `article/front/journal-meta` | 1500 |
| `article/front/journal-meta/journal-title` | 1500 |
| `article/front/journal-meta/publisher/publisher-name` | 1500 |
| `article/front/journal-meta/publisher/publisher-loc` | 1500 |
| `article/front/article-meta` | 1500 |
| `article/front/article-meta/article-categories` | 1500 |
| `article/front/article-meta/article-categories/subj-group` | 1500 |
| `article/front/article-meta/article-categories/subj-group/subject` | 1500 |
| `article/front/article-meta/title-group` | 1500 |
| `article/front/article-meta/title-group/article-title` | 1500 |
| `article/front/article-meta/pub-date` | 1500 |
| `article/front/article-meta/pub-date/month` | 1500 |

## APTARA journal — 1500 files sampled

| status | distinct paths |
|---|---:|
| modeled | 61 |
| deferred | 5 |
| mapped-meta | 2 |
| new-unseen | 349 |

Top 25 new-unseen paths in this source:

| path | count |
|---|---:|
| `component/reflist/ref` | 12485 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author` | 8035 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/init` | 8035 |
| `component/reflist/ref/periodical/ref_authorgrp/ref_author/ref_surname` | 8035 |
| `component/reflist/ref/periodical` | 7987 |
| `component/reflist/ref/periodical/date` | 7272 |
| `journal_article` | 7183 |
| `journal_article/pubitype` | 7183 |
| `component/reflist/ref/periodical/pageinfo` | 6319 |
| `component/reflist/ref/periodical/pageinfo/startpage` | 6319 |
| `pages/first_page` | 6144 |
| `pages/last_page` | 6144 |
| `copyright_statement` | 6144 |
| `article_status` | 6144 |
| `article_editstate` | 5898 |
| `component/reflist/ref/periodical/date/month` | 5344 |
| `component/reflist/ref/periodical/ref_authorgrp` | 4871 |
| `journal_article/month` | 4859 |
| `component/reflist/ref/periodical/ref_articletitle` | 4555 |
| `journal_article/contributors/author` | 3984 |
| `journal_article/contributors/author/person_name` | 3984 |
| `journal_article/contributors/author/person_name/given_name` | 3984 |
| `journal_article/contributors/author/person_name/surname` | 3984 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author` | 2517 |
| `component/reflist/ref/confproc/ref_authorgrp/ref_author/init` | 2517 |

## ALLEN PRESS journal — 96 files sampled

| status | distinct paths |
|---|---:|
| modeled | 41 |
| deferred | 6 |
| mapped-meta | 5 |
| new-unseen | 183 |

Top 25 new-unseen paths in this source:

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
| `content_batch/body/journal/journal_article` | 233 |
| `content_batch/body/journal/journal_article/pubitype` | 233 |
| `content_batch/body/journal/journal_article/title` | 233 |
| `content_batch/body/journal/journal_article/pages/first_page` | 233 |
| `content_batch/body/journal/journal_article/pages/last_page` | 233 |
| `component/reflist/ref/book/chaptertitle` | 231 |
| `content_batch/body/journal/journal_article/article_status` | 229 |
| `component/reflist/ref/periodical` | 221 |
| `component/reflist/ref/periodical/ref_articletitle` | 221 |
| `component/reflist/ref/periodical/ref_authorgrp` | 220 |

---
Full per-source detail with all paths + status in `refsReaudit.unmappedFields.json`.