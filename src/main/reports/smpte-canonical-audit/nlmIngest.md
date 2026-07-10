# NLM canonical new-doc ingestion — todo #2

> Generated: 2026-07-10T19:59:18.355Z
> Mode: **DRY-RUN**

## Totals
- content_batch primaries staged as new docs: **491**
- skipped (DOI already in registry): 0
- **docId collisions: 0** ✓

## By corpus
| corpus | primaries | staged | already in registry |
|---|---:|---:|---:|
| journal | 415 | 415 | 0 |
| conference | 76 | 76 | 0 |

## docId key mode
| mode | count | example format |
|---|---:|---|
| DOI → dash | 266 | `10.5594-JMI.2025-LZES6606` |
| ISBN + seq (conference DOI-less) | 36 | `978-1-61482-965-2-1` |
| ISSN + vol.issue + seq (journal DOI-less) | 189 | `2160-2492-v133.1-1` |

## contentType distribution (from `<pubitype>`, verbatim registry vocab)
| contentType | count |
|---|---:|
| `orig-research` | 197 |
| `advert` | 98 |
| `opinion` | 52 |
| `info-society` | 38 |
| `awards` | 19 |
| `front-cover` | 17 |
| `toc` | 17 |
| `list-staff` | 17 |
| `future-events` | 12 |
| `review` | 10 |
| `content-announce` | 8 |
| `obit` | 4 |
| `errata` | 1 |
| `info-author` | 1 |

## Duplicate-DOI upstream errors (2 DOIs → 4 papers)
SMPTE assigned one DOI to multiple distinct papers. Both sides staged with a disambiguated docId (re-key once fixed). **→ smpte-upstream register (todo #3).**

| DOI | disambiguated docId | title |
|---|---|---|
| `10.5594/JMI.2024/IPYX8877` | `10.5594-JMI.2024-IPYX8877__2024-SMPTEMIJAPRIL2024_17-17` | The Future of Video Compression—Moving Beyond Hybrid Codecs  |
| `10.5594/JMI.2024/IPYX8877` | `10.5594-JMI.2024-IPYX8877__2024-SMPTEMIJAPRIL2024_18-18` | Automatic Speech Recognition with Machine Learning: Techniqu |
| `10.5594/JMI.2024/KOCV9658` | `10.5594-JMI.2024-KOCV9658__2024-SMPTENOVDEC2024JOURNAL_11-11` | Introduction to the 2024 Progress Report |
| `10.5594/JMI.2024/KOCV9658` | `10.5594-JMI.2024-KOCV9658__2024-SMPTENOVDEC2024JOURNAL_12-12` | SMPTE 2024 Review: A Year of Growth, Innovation, and Expande |

## Notes
- Source = `content_batch` PRIMARY (authoritative DOI/seq/isbn), not the FTXML secondary.
- Front-matter (advert/front-cover/toc/list-staff/…) is ingested per the 2026-07-10 decision; those
  contentTypes sit in `noPageContentTypes`, so they populate the registry without rendering pages.
- Refs are NOT attached here — `ftxmlRefWalker.js`'s catalog routes onto these docIds in a later pass.
- Full staged doc bodies (with `$meta`) in `nlmIngest.json`.
