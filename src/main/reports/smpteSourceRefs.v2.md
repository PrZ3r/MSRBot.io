# Phase 1a — Standards source-refs resolution

> Generated at: 2026-06-22T22:55:59.838Z
> Mode: **dry-run**

## Scope
- Standards-family source-doc unresolved refs (filtered from PR #1111's 961 leftover): **602**

## Outcome
| outcome | count |
|---|---:|
| canonical refId → registry doc (direct link) | 17 |
| canonical refId → `mri-known-no-doc` (MRI carries slug) | 9 |
| slug-minted (orphan; MRI carries cite + raw XML) | 573 |
| ambiguous vol+pages → slug-minted | 3 |

## By resolution path
| path | count |
|---|---:|
| `orphan-slug` | 573 |
| `vol+pages` | 13 |
| `parseRefId:cite` | 10 |
| `vol+pages-ambig` | 3 |
| `title-exact-match` | 3 |

## Notes
- Under MRI v2, slug-minted refs are NOT silent. Each lands in `doc.references[]` and renders inline as `<cite>citation text</cite>` with an `EXTERNAL` badge.
- Slugs can graduate to canonical refIds later via `resolveOrphans` once a new parser family or refMap entry covers them.
- The `mri-known-no-doc` bucket is the target population for the auto-issue workflow + future external-publisher ingest (#1195).

Full per-entry detail in `smpteSourceRefs.v2.json`.
