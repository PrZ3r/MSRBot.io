# Canonical field backfill — passes 1-3

> Generated: 2026-07-09T01:17:38.009Z
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
| 6 | docTitle (canonical wins per drift review; --apply-titles) | 2217 |

Title pass extras: 68 registry-richer rows kept (push-back), 0 skipped for unconvertible markup, 6 TeX/sup/inf→Unicode conversions.

### Markup→Unicode conversions (verify each)

| docId | registry (old) | canonical converted (new) |
|---|---|---|
| `10.5594-J06228` | A Studio-Type and a Portable-Type System for Synchronizing -Inch Magnetic Tape w | A Studio-Type and a Portable-Type System for Synchronizing ¼-Inch Magnetic Tape  |
| `10.5594-J08383` | 2nd Annual SMPTE Film Conference | 2nd Annual SMPTE Film Conference: LA Convention Center Los Angeles, CA, June 12– |
| `10.5594-J13451` | A Portable Color Camera with -in Video Recorder for Electronic Journalism | A Portable Color Camera with ½-in Video Recorder for Electronic Journalism |
| `10.5594-J14415` | The Design of a 4-Inch Image-Orthicon Camera Channel | The Design of a 4½-Inch Image-Orthicon Camera Channel |
| `10.5594-J16656` | A Recent Innovation in Digital Special Effects | A Recent Innovation in Digital Special Effects: The CBS “Action Track”TM System |
| `10.5594-M00175` | High Performance Electro-optic Camera Prototype | High Performance Electro-Optic Camera Prototype: 142nd Conference of the Society |

## Samples (first 25 per pass)
