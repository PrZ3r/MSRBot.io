# Phase 3a — Journal (+ Conference) inline `<ref-list>` extraction

> Generated at: 2026-07-06T18:12:18.173Z
> Mode: **APPLY**
> Scope: Journal Article (limit 2000)

## Totals
- HIGHWIRE XML files parsed  : 2213
- Articles matched to registry: 2000
- Articles with ref-list     : 374
- Total refs processed       : **3244**
- Distinct source docs touched: 372
- Leftover `unresolved.json` entries handled: 0

## Outcome
| outcome | count |
|---|---:|
| canonical refId → registry doc (direct link)                 | 541 |
| canonical refId → `mri-known-no-doc` (MRI carries slug)     | 2 |
| slug-minted (orphan; MRI carries cite + raw XML)             | 2697 |
| ambiguous vol+pages → slug-minted                             | 4 |

## By resolution path
| path | count |
|---|---:|
| `orphan-slug` | 2697 |
| `vol+pages` | 541 |
| `vol+pages-ambig` | 4 |
| `parseRefId:title` | 2 |

## Notes
- Under MRI v2, slug-minted refs are NOT silent. Each lands in the source doc's `references.bibliographic[]` and renders inline as `<cite>` with an `EXTERNAL` badge.
- Slugs graduate to canonical refIds later via `resolveOrphans` once a new parser family or refMap entry covers them — no doc-file edits needed then.
- Full per-entry detail in `smpteJournalRefs.json`.
