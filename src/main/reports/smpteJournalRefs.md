# Phase 3a — Journal (+ Conference) inline `<ref-list>` extraction

> Generated at: 2026-07-02T19:02:47.402Z
> Mode: **dry-run**
> Scope: Journal Article

## Totals
- HIGHWIRE XML files parsed  : 21389
- Articles matched to registry: 18669
- Articles with ref-list     : 3756
- Total refs processed       : **38184**
- Distinct source docs touched: 3742
- Leftover `unresolved.json` entries handled: 345

## Outcome
| outcome | count |
|---|---:|
| canonical refId → registry doc (direct link)                 | 5892 |
| canonical refId → `mri-known-no-doc` (MRI carries slug)     | 105 |
| slug-minted (orphan; MRI carries cite + raw XML)             | 32074 |
| ambiguous vol+pages → slug-minted                             | 113 |

## By resolution path
| path | count |
|---|---:|
| `orphan-slug` | 32074 |
| `vol+pages` | 5875 |
| `parseRefId:title` | 122 |
| `vol+pages-ambig` | 113 |

## Notes
- Under MRI v2, slug-minted refs are NOT silent. Each lands in the source doc's `references.bibliographic[]` and renders inline as `<cite>` with an `EXTERNAL` badge.
- Slugs graduate to canonical refIds later via `resolveOrphans` once a new parser family or refMap entry covers them — no doc-file edits needed then.
- Full per-entry detail in `smpteJournalRefs.json`.
