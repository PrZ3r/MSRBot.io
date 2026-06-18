# Refs Re-Audit

> Generated at: 2026-06-18
> MRI version: 2.0.0

## Scope

- Registry docs: **26445**
- Docs with non-empty `references[]`: **1066**
- Total ref-entries audited: **8995**
- Currently resolved (direct + via-MRI): **82.71%**

## Classification breakdown

| Kind | Count | % |
|---|---:|---:|
| `resolved-direct` | 5991 | 66.60% |
| `resolved-via-mri` | 1449 | 16.11% |
| `mri-known-no-doc` | 1485 | 16.51% |
| `orphan-slug` | 70 | 0.78% |
| `unparseable` | 0 | 0.00% |

## By source doc type

| docType | resolved-direct | resolved-via-mri | mri-known-no-doc | orphan-slug | unparseable |
|---|---:|---:|---:|---:|---:|
| Standard | 4263 | 966 | 1093 | 9 | 0 |
| Recommended Practice | 772 | 211 | 89 | 38 | 0 |
| Registered Disclosure Document | 320 | 60 | 58 | 12 | 0 |
| Engineering Guideline | 200 | 104 | 83 | 0 | 0 |
| Specification | 92 | 75 | 52 | 1 | 0 |
| Journal Article | 162 | 3 | 5 | 10 | 0 |
| Administrative Guideline | 104 | 22 | 1 | 0 | 0 |
| Informational | 15 | 6 | 83 | 0 | 0 |
| Technical Bulletin | 44 | 0 | 0 | 0 | 0 |
| Best Practice | 5 | 0 | 16 | 0 | 0 |
| White Paper | 7 | 0 | 0 | 0 | 0 |
| Experimental | 2 | 0 | 4 | 0 | 0 |
| Procedure | 4 | 0 | 0 | 0 | 0 |
| Recommendation | 0 | 2 | 1 | 0 | 0 |
| Conference Paper | 1 | 0 | 0 | 0 | 0 |

## By reference category

| category | resolved-direct | resolved-via-mri | mri-known-no-doc | orphan-slug | unparseable |
|---|---:|---:|---:|---:|---:|
| normative | 3380 | 725 | 530 | 20 | 0 |
| bibliographic | 2611 | 724 | 955 | 50 | 0 |

## Top 15 publishers by total ref-count (as source doc)

| publisher | refs |
|---|---:|
| SMPTE | 7873 |
| IETF | 783 |
| ISO | 143 |
| DCI | 111 |
| AMPAS | 75 |
| IEEE | 7 |
| ITU-R | 3 |

## Top 20 publisher families — `mri-known-no-doc`

> Canonical refIds we recognise, but the target doc is not in the registry. These are the docs we should ingest to unblock resolution. Feeds Phase 1b + #1195.

| family | count |
|---|---:|
| IEC | 127 |
| R | 108 |
| ISO | 107 |
| T | 61 |
| W3C | 42 |
| ATSC | 42 |
| ANSI | 39 |
| DOI:10.5594 | 39 |
| SMPTE | 32 |
| IETF | 26 |
| ISBN | 24 |
| TIA | 23 |
| EBU | 22 |
| DOI:10.1007 | 18 |
| EIA | 17 |
| IEEE | 15 |
| ETSI | 14 |
| RFC8174 | 13 |
| SCTE | 13 |
| RFC822 | 12 |

## Top 20 publisher families — `unparseable`

> Ref strings that don't match any known publisher pattern. These need new `parseRefId` families or `refMap.json` entries. Direct scope for #1195.

| family | count |
|---|---:|

---

Full per-doc detail in `refsReaudit.json` (every ref-entry tagged with classification + MRI resolution pointer when present).
