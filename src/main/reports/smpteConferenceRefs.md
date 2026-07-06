# Phase 3b — Conference Paper inline `<ref-list>` extraction

> Generated at: 2026-07-06T20:02:43.384Z
> Mode: **APPLY**
> Scope: Conference Paper

## Totals
- HIGHWIRE XML files parsed  : 21389
- Conf articles matched to registry: 1703
- Articles with ref-list     : 832
- Total refs processed       : **6608**
- Distinct source docs touched: 712
- Leftover `unresolved.json` entries handled: 14

## Outcome
| outcome | count |
|---|---:|
| canonical refId → registry doc (direct link) | 188 |
| canonical refId → `mri-known-no-doc` (MRI carries slug) | 42 |
| slug-minted (fresh, orphan) | 6350 |
| **slug-mint reused via #1229 pre-check** (cited existing MRI refId instead of new slug) | 1000 |
| ambiguous vol+pages → slug-minted | 28 |

## #1229 pre-check breakdown
| trigger | count |
|---|---:|
| contentHash matched existing MRI entry (would-be-straggler prevented) | 997 |
| normalized-cite matched existing slug on same source doc (twin-pair prevented) | 3 |

## By resolution path
| path | count |
|---|---:|
| `orphan-slug` | 6350 |
| `vol+pages` | 180 |
| `parseRefId:title` | 50 |
| `vol+pages-ambig` | 28 |

## Notes
- Under MRI v2 slug system, slug-minted refs are NOT silent. Each lands in the source doc's `references.bibliographic[]` and renders inline as `<cite>` with an `EXTERNAL` badge.
- Pre-check pattern (#1229) prevents both the leaked-slug class (contentHash collision) AND the twin-pair class (APTARA↔HIGHWIRE same-ref-different-shape) that surfaced in Phase 3a.
- Full per-entry detail in `smpteConferenceRefs.json`.
