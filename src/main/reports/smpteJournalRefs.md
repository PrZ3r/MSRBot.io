# Phase 3a — Journal (+ Conference) inline `<ref-list>` extraction

> Generated at: 2026-07-06T17:38:58.703Z
> Mode: **APPLY**
> Scope: Journal Article (limit 500)

## Totals
- HIGHWIRE XML files parsed  : 713
- Articles matched to registry: 500
- Articles with ref-list     : 78
- Total refs processed       : **914**
- Distinct source docs touched: 100
- Leftover `unresolved.json` entries handled: 345

## Outcome
| outcome | count |
|---|---:|
| canonical refId → registry doc (direct link)                 | 39 |
| canonical refId → `mri-known-no-doc` (MRI carries slug)     | 1 |
| slug-minted (orphan; MRI carries cite + raw XML)             | 873 |
| ambiguous vol+pages → slug-minted                             | 1 |

## By resolution path
| path | count |
|---|---:|
| `orphan-slug` | 873 |
| `vol+pages` | 39 |
| `vol+pages-ambig` | 1 |
| `parseRefId:title` | 1 |

## Notes
- Under MRI v2, slug-minted refs are NOT silent. Each lands in the source doc's `references.bibliographic[]` and renders inline as `<cite>` with an `EXTERNAL` badge.
- Slugs graduate to canonical refIds later via `resolveOrphans` once a new parser family or refMap entry covers them — no doc-file edits needed then.
- Full per-entry detail in `smpteJournalRefs.json`.
