# Keyword vocab scrub

Generated: 2026-06-17T17:31:03.862Z
Source vocab: `src/main/config/site.json` (`controlledKeywords`, 294 terms)

## Summary

| bucket | distinct | usages |
|---|---:|---:|
| exact-match to vocab | 294 | 6633 |
| case-only drift | 0 | 0 |
| **out of vocab** | **4** | **4** |
| &nbsp;&nbsp; auto-fix (variant of existing vocab) | 4 | 4 |
| &nbsp;&nbsp; drop (redundant noise) | 0 | 0 |
| &nbsp;&nbsp; promote → controlledKeywords | 0 | 0 |
| &nbsp;&nbsp; synonym pair (pick one) | 0 | 0 |
| &nbsp;&nbsp; unknown / manual review | 0 | 0 |
| **total distinct keywords** | **298** | **6637** |

## Auto-fix candidates (4)

| keyword | usages | action | sample docIds |
|---|---:|---|---|
| `Internet of Things` | 1 | rewrite `→ IoT` | RFC8323 |
| `WOTS` | 1 | rewrite `→ W-OTS` | RFC8391 |
| `WOTS+` | 1 | rewrite `→ W-OTS+` | RFC8391 |
| `USB Type-C` | 1 | rewrite `→ USB-C` | SMPTE.ST2139.2025-12 |
