# Authors Migration (#1196) — string-form → object form

> Generated at: 2026-06-23T00:04:25.562Z
> Mode: **APPLY**

## HIGHWIRE backfill index
- XML files parsed: 21389
- Articles indexed: 10185
- Distinct docIds  : 9931
- With affiliation : 7560
- With bio         : 952

## Migration scope
- Total registry docs        : 26445
- Docs with no `authors[]`   : 15694
- Already object form (skip) : 1
- To migrate                 : **10750**

## Migration outcome
| outcome | count |
|---|---:|
| enriched from HIGHWIRE (name + affiliation [+ bio]) | 9805 |
| shape-only (`"X"` → `{name: "X"}`) | 945 |
| count-mismatch fallback (HIGHWIRE author count ≠ registry — shape-only for safety) | 1 |

**Data added:** 11,331 affiliations, 1,602 bios.

## Corpus snapshot (post-apply)

| metric | value |
|---|---:|
| Docs with `authors[]` populated | 10,751 |
| Total author entries (sum) | **17,240** |
| Distinct author names | 9,415 |
| Distinct affiliations | 6,936 |

Average ~1.6 authors per author-bearing doc; ~73% of total authors carry an affiliation.

## By publisher (to-migrate)
| publisher | count |
|---|---:|
| SMPTE | 10594 |
| IETF | 52 |
| W3C | 37 |
| IEEE | 12 |
| Addison-Wesley | 5 |
| John Wiley & Sons, Inc. | 4 |
| Acoustical Society of America | 3 |
| AES | 3 |
| Society for Imaging Science and Technology | 3 |
| Optical Society of America | 3 |
| The Royal Photographic Society | 3 |
| Nokia Bell Labs | 2 |
| Franklin Institute | 2 |
| ScienceDirect | 1 |
| Physics Today | 1 |
| IOP Publishing Ltd | 1 |
| American Institute for Conservation | 1 |
| Institute of Noise Control Engineering of the USA | 1 |
| ASC | 1 |
| RSA | 1 |
| BBC | 1 |
| British Kinematography | 1 |
| CIE | 1 |
| FIAF | 1 |
| IANA | 1 |
| McGraw Hill | 1 |
| Pearson | 1 |
| University of California Irvine | 1 |
| Cambridge University Press | 1 |
| Illuminating Engineering Society | 1 |
| Image Technology | 1 |
| Live Sound International | 1 |
| MacMillan Co. | 1 |
| US Dept of Commerce | 1 |
| Society of American Archivists | 1 |
| Audio Magazine | 1 |
| DLP | 1 |
| USPTO | 1 |
| De Gruyter Brill | 1 |
| University of Auckland | 1 |

## Sample HIGHWIRE-enriched docs

**10.5594-J00022**
Before:
- `"C. R. Daily"`
After:
- C. R. Daily @ Paramount Pictures, Inc., Hollywood, Cal

**10.5594-J00023**
Before:
- `"F. W. Roberts"`
- `"E. Taenzer"`
After:
- F. W. Roberts
- E. Taenzer @ Ace Film Laboratories, Inc., Brooklyn, N

**10.5594-J00024**
Before:
- `"F. W. Roberts"`
- `"H. R. Cook"`
After:
- F. W. Roberts
- H. R. Cook @ Ace Film Laboratories, Inc., Brooklyn, N

**10.5594-J00025**
Before:
- `"R. O. Drew"`
- `"E. W. Kellogg"`
After:
- R. O. Drew
- E. W. Kellogg @ RCA Manufacturing Co., Camden, N. J.

**10.5594-J00026**
Before:
- `"S. L. Reiches"`
After:
- S. L. Reiches @ Case School of Applied Science, Clevelan

## Sample count-mismatch (shape-only fallback)
- 10.5594-J07544 — registry has 1 authors, HIGHWIRE has 2
