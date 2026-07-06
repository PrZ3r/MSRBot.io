# Phase 3a — Journal (+ Conference) inline `<ref-list>` extraction

> Generated at: 2026-07-06T17:47:19.108Z
> Mode: **APPLY**
> Scope: Journal Article (limit 1000)

## Totals
- HIGHWIRE XML files parsed  : 1213
- Articles matched to registry: 1000
- Articles with ref-list     : 160
- Total refs processed       : **1272**
- Distinct source docs touched: 158
- Leftover `unresolved.json` entries handled: 0

## Outcome
| outcome | count |
|---|---:|
| canonical refId → registry doc (direct link)                 | 144 |
| canonical refId → `mri-known-no-doc` (MRI carries slug)     | 2 |
| slug-minted (orphan; MRI carries cite + raw XML)             | 1124 |
| ambiguous vol+pages → slug-minted                             | 2 |

## By resolution path
| path | count |
|---|---:|
| `orphan-slug` | 1124 |
| `vol+pages` | 144 |
| `vol+pages-ambig` | 2 |
| `parseRefId:title` | 2 |

## Notes
- Under MRI v2, slug-minted refs are NOT silent. Each lands in the source doc's `references.bibliographic[]` and renders inline as `<cite>` with an `EXTERNAL` badge.
- Slugs graduate to canonical refIds later via `resolveOrphans` once a new parser family or refMap entry covers them — no doc-file edits needed then.
- Full per-entry detail in `smpteJournalRefs.json`.
