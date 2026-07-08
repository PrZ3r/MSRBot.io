# Canonical field backfill — passes 1-3

> Generated: 2026-07-08T23:56:29.541Z
> Mode: **DRY-RUN**

| pass | field | changes |
|---|---|---:|
| 0 | publicationDate year (5 approved digit-error fixes) | 0 |
| 1 | publicationDate month (Jan-1 placeholder → canonical month) | 0 |
| 2 | journalTitle (era-accurate, journal-kind) | 0 |
| 3a | abstract (canonical-only fill) | 0 |
| 3b | keywords (empty-doc fill, vocab-mapped) | 0 |
| 4b | keywords merge (union into existing; --apply-keywords-merge) | 0 |
| 5 | authors (name fixes; written under --apply-authors) | 0 |

## Samples (first 25 per pass)
