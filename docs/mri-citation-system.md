# MRI v2 — slug-keyed citation system

How references work in MSRBot.io. This is the live architecture doc for the
Master Reference Index (`src/main/reports/masterReferenceIndex.json`) and the
slug-based citation model that landed in the Unreleased
[CHANGELOG.md](../CHANGELOG.md) entry. Read this when you want to understand
*how a `doc.references[]` string actually resolves*, *where citation data
comes from*, or *how unresolved refs get tracked without flooding GitHub
issues*.

> **TL;DR.** Every cited reference in every doc is a string in
> `doc.references.normative[]` or `doc.references.bibliographic[]`. That
> string is either a real `docId` (the target is in the registry), a
> **canonical-form refId** the parser recognised (`RFC1642`, `ASME.B1.1.1989`)
> that may or may not yet have a registry doc, or a **source-anchored
> orphan slug** (`orphan/<sourceDoc>/<suffix>`) the parser couldn't shape.
> All three forms live in `MRI.refs[]`, all three render correctly, and all
> three can graduate to a real `docId` later without touching the doc file.

---

## The three forms a `doc.references[]` string can take

```js
"RFC1642"                                  // canonical-form refId, parser-derived
"orphan/SMPTE.RP2073-2.2014/ref-norm-6"    // source-anchored slug (raw XML)
"orphan/RFC1101/h:e25f0fbf"                // source-anchored slug (cite-only)
```

Every string in `doc.references[]` is one of these. They're all opaque to
the renderer — it doesn't care about the shape — because every one of them
is a key into `MRI.refs[]`.

### Canonical-form refId

The parser (`src/main/lib/referencing.js`, `parseRefId`) recognised the
citation as a known publisher pattern (`RFC####`, `IETF.draft-...`,
`ASME.B1.1.1989`, `SMPTE.ST429-2.2023-09`, etc.). The refId IS the
canonical identifier — it's what someone would type if asked "what's the
ID for that doc". If the registry has a doc with `docId === refId`, it
resolves straight through with no MRI lookup needed.

### Source-anchored slug (raw XML form)

Used when the parser fails on a raw `<ref>` block that *does* carry a
`<ref id="X">` attribute (PR #1111-style SMPTE source-ref extraction). The
slug suffix is the XML id verbatim:

```text
orphan/SMPTE.RP2073-2.2014/ref-norm-6
        └── sourceDoc        └── refXmlId
```

Stable per source XML — re-extracting the same XML produces the same slug.

### Source-anchored slug (cite-only form)

Used when the parser fails on a citation that has no raw XML id (IETF/W3C
HTML scraping, free-text providers, anywhere `<ref id>` doesn't exist).
The suffix is a content-hash prefix of the cite text:

```text
orphan/RFC1101/h:e25f0fbf
        └── sourceDoc  └── short contentHash
```

Stable per content — identical citations across multiple source docs
produce slugs whose suffix portions collide, so cross-doc dedup at
resolve-time just works.

---

## The MRI entry behind every slug

Every string in `doc.references[]` has a corresponding `MRI.refs[<that
string>]` entry, structured like:

```json
{
  "refId":          "<the string in doc.references[]>",
  "resolvedDocId":  "RFC8446",          // null until graduated
  "needsResolve":   null,                // null | "known-publisher-no-doc" | "unknown-publisher"
  "contentHash":    "e25f0fbfc7f96170",  // 16-hex SHA-256 of normalised raw <ref> or cite|href seed
  "isOrphan":       true,                // true for orphan/... slugs only
  "sourceDoc":      "RFC1101",           // orphan-only — the doc that minted this slug
  "sourceRefId":    "h:e25f0fbf",        // orphan-only — the suffix portion
  "citationText":   "Braden, B., editor, …",   // human-readable cite
  "href":           "https://…",         // when source carried one
  "rawRef":         "<ref id=\"…\">…</ref>",   // raw XML when source had it
  "rawVariants":    [ … ],               // per-sighting variants {docId, type, cite, href, rawRef}
  "provenance":     { "firstSeen": "…", "mapSource": [...], "mapDetails": [...] }
}
```

**Key fields**:

- `resolvedDocId` — the registry `docId` this slug ultimately points at,
  or `null`. When set, every renderer that touches this slug treats it as
  if the doc had cited the resolved doc directly.
- `needsResolve` — `"known-publisher-no-doc"` for canonical-form refs
  whose registry doc isn't ingested yet (the auto-issue workflow's input);
  `"unknown-publisher"` for source-anchored slugs (no canonical name; the
  resolver pool); `null` once `resolvedDocId` is set.
- `contentHash` — groups equivalent citations across sightings. The
  resolver propagates one decision across every sibling sharing the hash.
- `rawVariants[]` — one entry per sighting (each `docId` that cited this
  slug). This is the audit trail — preserved even after the slug
  graduates to a `resolvedDocId`.

---

## How a reference renders

The renderer (build-time `getStatus`/`refHref`/`getLabel`/`mriCite`
Handlebars helpers + client-side `refTree.js`) follows this chain for
every string in `doc.references[]`:

```text
       reference string
              │
              ▼
   ┌──────────────────────┐
   │ registry[<string>]?  │── yes ──► link to /docs/<string>/, normal doc render
   └──────────────────────┘
              │ no
              ▼
   ┌──────────────────────────┐
   │ MRI.refs[<string>]?      │── no ──► [NOT IN REGISTRY] badge (truly unknown)
   └──────────────────────────┘
              │ yes
              ▼
   ┌────────────────────────────────┐
   │ MRI entry has resolvedDocId?   │── yes ──► link to /docs/<resolvedDocId>/, uses that doc's label/status
   └────────────────────────────────┘
              │ no
              ▼
       inline <cite>…</cite> + EXTERNAL badge, citation text from MRI entry
```

A few practical consequences:

- A canonical-form ref to a doc that just isn't ingested yet (`ASME.B1.1.1989`)
  renders as `<cite>ASME.B1.1.1989 — ANSI/ASME B1.1-1989 — Unified Inch
  Screw Threads</cite> [EXTERNAL]`. Useful, not broken.
- An orphan slug (`orphan/SMPTE.RP2073-2.2014/ref-norm-6`) renders as
  `<cite>John K. Ousterhout, Ken Jones Tcl, Tk Toolkit, 2nd Edition,
  Addison-Wesley, 2009</cite> [EXTERNAL]`. Still useful.
- A graduated ref (`IETF.draft-ietf-tls-rfc8446bis-03 → RFC8446`) renders
  as a normal `<a>` link to `/docs/RFC8446/` with RFC8446's actual status.
  The bare slug never appears.

Client-side: the `build/api/mri-cite-map.json` sidecar (~150 KB) is
fetched by `src/site/js/refTree.js` and carries the same `{cite, href,
isOrphan, resolvedDocId}` so the reference tree renders the same way the
doc page does.

---

## Where citations come from

For the cite text to render inline, MRI's entry needs `citationText`.
There are three ways it gets populated:

1. **Extractor passes it explicitly** — most provider parsers compute a
   human-readable cite before they hand off to `onBadRefs`.
2. **`synthesizeCiteFromRawRef`** — when `rawRef` XML is present but
   `cite` wasn't passed, the helper in `src/main/lib/referencing.js`
   parses authors / article-title / pub-title / standardnum / volume /
   pages / year out of the XML and composes a citation string. Handles
   both APTARA (`<ref_authorgrp>/<ref_author>/<init>/<ref_surname>`,
   `<ref_articletitle>`, …) and NLM (`<name>/<surname>/<given-names>`,
   `<article-title>`, …) shapes. Called automatically during MRI mint
   and during cite-map emission for entries that lack an explicit cite.
3. **One-time backfill** — `migrateMriToSlugSchema.js` (and the synthesis
   backfill it ran during the v2 cutover) walked every MRI entry that
   had `rawRef` but no `citationText` and ran synthesis. Doc that
   landed: ~1,283 entries gained inline-renderable citations.

For canonical-form refs that came from `refMap.json` directly (the
~1,463 "hand-entered" entries), there's no source XML to synthesise
from — the refId itself IS the identifier and that's enough.

---

## Slug ↔ docId is N-to-1 by design

Multiple slugs can ultimately resolve to the same `docId`. That's a
feature, not a bug:

```text
"IETF.draft-ietf-tls-rfc8446bis-03"  ──►  RFC8446
"IETF.draft-ietf-tls-rfc8446bis-04"  ──►  RFC8446
"orphan/SomeDoc/h:abc12345"          ──►  RFC8446    (cite text was "RFC 8446 (TLS 1.3)")
```

Wins:

- **Per-sighting audit trail preserved**. Each slug remembers exactly
  where the citation came from (`sourceDoc`, `sourceRefId`,
  `rawVariants[]`). You can ask "show me every doc that cited *the draft
  form*" separately from "show me every doc that cited *the published
  RFC*".
- **One reverse lookup answers the union**. The `MRI.reverse` index
  ([issue #1190](https://github.com/PrZ3r/MSRBot.io/issues/1190) — coming) will
  produce `{ docId: [refId, refId, …] }` so "every place that cites
  RFC8446 directly OR via any draft form" is one fetch.
- **Doc files don't need back-patches**. The string in `references[]`
  never changes from a graduation alone — only MRI's pointer flips. So a
  five-year-old SMPTE doc citing a never-published draft can later
  resolve cleanly to its successor without anyone touching the SMPTE
  doc.
- **Recovery is trivial**. If a graduation turns out wrong (parser
  misidentified the target), flip MRI's pointer on that one entry; every
  citing doc snaps to the new target on the next build.

---

## What happens on re-extract after a refMap improves

There's a subtle but important behaviour to know about. **The
extractor's parser output is what gets written to `doc.references[]`.**
If `parseRefId` is improved between extracts (a new parser family lands,
or a new `refMap.json` entry maps a previously-orphan cite to a real
refId), then on the next extract of the same source the string in
`doc.references[]` will *change* — from the slug to the canonical refId.

Concrete example:

**Before** any mapping exists:

```js
doc.references.bibliographic[]  =  [ "orphan/RFC1101/h:e25f0fbf" ]
MRI.refs["orphan/RFC1101/h:e25f0fbf"]  =  { citationText: "…", resolvedDocId: null }
```

**After** you add a `refMap.json` entry mapping the cite text to
`RFC1122` AND re-extract RFC1101:

```js
doc.references.bibliographic[]  =  [ "RFC1122" ]              // ← changed
MRI.refs["orphan/RFC1101/h:e25f0fbf"]  =  ( pruned away — last sighting gone )
MRI.refs["RFC1122"]  =  { sightings include RFC1101, … }       // ← cited from RFC1101 now
```

**Why this is desirable**:

- The doc converges on the canonical form over time. `doc.references[]`
  reads cleanly as `["RFC8446", "RFC1122"]` instead of accumulating
  `orphan/.../h:...` strings forever.
- Two docs that cite the same thing end up with identical strings in
  `references[]`, which makes cross-doc queries clean.
- The orphan was a placeholder for "we couldn't shape this"; once the
  parser can shape it, the placeholder is no longer needed.

**What's preserved**:

- MRI keeps the full per-sighting record in `rawVariants[]` for every
  entry, including the historical raw text and href.
- `provenance.mapDetails[]` carries timestamps and which parser pass
  produced what.

**What's lost** (intentionally):

- The specific `orphan/...` string that previously sat in
  `doc.references[]`. If you ever needed to reconstruct "what
  unparseable form was this once written as", `git log` on the doc file
  is the source.

The model "self-heals" — over enough extracts and enough mapping work,
`doc.references[]` strings tend to converge on canonical refIds, and
the orphan slug pool naturally drains.

---

## The four hooks that drive resolution

1. **`mriRecordSighting` (in `referencing.js`)** — every time the
   extractor sees a ref, it calls this. Canonical refIds upsert into
   `MRI.refs[refId]`; unparseable refs mint an orphan slug, return it
   to the caller, and the caller pushes it into `doc.references[]`. See
   the `onBadRefs` callback in `extractDocs.js` for the wiring.
2. **`synthesizeCiteFromRawRef` (in `referencing.js`)** — runs during
   mint when no `cite` was passed but `rawRef` XML is present, so the
   MRI entry always has actionable `citationText`. Reusable by any
   extractor that wants to derive a cite from raw XML.
3. **`npm run resolve-orphans` (alias for `src/main/scripts/extras/resolveOrphans.js`)** — idempotent retry pass.
   Walks every `MRI.refs[]` entry with `resolvedDocId === null`, runs
   each through the current registry / `parseRefId` / `mapRefByCite`
   chain, and flips `resolvedDocId` on anything that now hits. One
   resolution propagates across every sibling sharing a `contentHash`.
   Safe to run as often as you want. No doc files touched.
4. **`mriFlush` (in `referencing.js`)** — runs at the end of every
   extract / build-mri. Recomputes `resolution.sourcePresent` against
   the current registry; when it flips a canonical-form entry to
   present, it also sets `resolvedDocId` and clears `needsResolve`. This
   is the "graduate automatically when the target gets ingested" hook.

---

## Working lookup recipes

### "Given a `references[]` string, where does it resolve?"

```js
function resolveRef(refString, registry, mri) {
  if (registry.has(refString)) return refString;            // direct doc
  const entry = mri.refs?.[refString];
  if (!entry) return null;                                  // truly unknown
  if (entry.resolvedDocId) return entry.resolvedDocId;     // graduated
  return null;                                              // unresolved (inline cite renders)
}
```

This is what `build.js`'s `followMriResolution` helper does (the
`refHref` / `getStatus` / `getLabel` helpers all call it before doing
their normal work).

### "Show me every ref this doc cites that's not in the registry yet"

```js
const unresolved = [];
for (const r of [...doc.references.normative, ...doc.references.bibliographic]) {
  if (registry.has(r)) continue;
  const entry = mri.refs?.[r];
  if (entry?.resolvedDocId && registry.has(entry.resolvedDocId)) continue;
  unresolved.push({ refString: r, mriEntry: entry || null });
}
```

### "Show me every orphan that needs review"

```js
const orphans = Object.values(mri.refs).filter(e =>
  e.isOrphan && !e.resolvedDocId);
```

### "Show me every canonical-form ref whose target doc we haven't ingested yet"

```js
const ingestionBacklog = Object.values(mri.refs).filter(e =>
  !e.isOrphan && e.needsResolve === 'known-publisher-no-doc');
```

(That's the same filter the auto-issue workflow uses to decide which
"MISSING REF: X" issues to open.)

### "What graduated this last extract?"

Look at `mri.refs[...].provenance.mapSource` and `.mapDetails` —
`resolveOrphans@<via>` and `resolved-at:<timestamp>` entries are added
each pass.

### "Which docs cite this ref?"

Today: scan `rawVariants[]` on every entry — `entry.rawVariants.map(v
=> v.docId)`. Coming with [#1190](https://github.com/PrZ3r/MSRBot.io/issues/1190):
`MRI.reverse[<refId>]` will give the same answer in O(1).

### "Group of refs all citing the same physical citation"

Filter `MRI.refs[]` by `contentHash`. Anything sharing a hash is the
same citation across multiple sightings. `resolveOrphans.js` already
uses this to propagate one decision across the group.

---

## The presence audit + auto-issue workflow

`src/main/scripts/buildMasterReferenceIndex.js` writes
`src/main/reports/mri_presence_audit.json` with:

- `presentCount` — refs whose `resolution.sourcePresent === true`
  (registry has the doc).
- `missingCount` — total of the two unresolved buckets below.
- `knownPubNoDocCount` — canonical-form refs (`RFC1642`,
  `ASME.B1.1.1989`, …) whose target doc isn't in the registry yet.
  This is the **ingestion backlog**.
- `orphanCount` — source-anchored slugs (`orphan/...`). These are the
  resolver / parser-improvement backlog.
- `missing[]` — per-entry detail, each with `refId`, `sourceDocId`,
  `sightingCount`, `sightings[]`, `isOrphan`, `needsResolve`.

The `.github/workflows/build-master-reference-index.yml` workflow's
auto-issue creator (the thing that produces "MISSING REF: RFC1642"
GitHub issues — e.g. [#937](https://github.com/PrZ3r/MSRBot.io/issues/937))
filters `missing[]` to `needsResolve === 'known-publisher-no-doc'`
before iterating. Orphan slugs are **excluded from issue creation** —
their citation data already lives in `MRI.refs[]`, so there's no
"missing ref" to file. They stay queryable via the audit and via MRI
itself.

`src/main/scripts/utils/seedBackfill.ietf.js` reads the same
`audit.missing[]` to pick RFCs / IETF drafts to add to
`seedUrls.ietf.json` for the next extract.

---

## Lifecycle of a single ref, end to end

```text
                              ┌─ Source XML / HTML
                              │   "Braden, B., editor, …, RFC in preparation."
                              ▼
1. EXTRACT       parser fails → onBadRefs(…)
                                  │
                                  ▼
                 mriRecordSighting → mints `orphan/RFC1101/h:e25f0fbf`
                                  │  (sourceDoc=RFC1101, contentHash=…, citationText=…)
                                  ▼
                 onBadRefs callback queues the slug → drained right before saveDoc
                                  │
                                  ▼
                 RFC1101's `doc.references.bibliographic[]` gains the slug

2. BUILD         renderer chain: registry-miss → MRI hit → no resolvedDocId
                                  │
                                  ▼
                 Doc page + refTree show `<cite>Braden, B., editor, …</cite>` [EXTERNAL]
                 Presence audit lists it under `orphanCount` — no GitHub issue opened

3. PARSER WORK   refMap.json gains an entry; or IETF parser improves
                 to recognise the cite text → maps to RFC1122.

4. RESOLVE PASS  `resolveOrphans.js`:
                                  │ tryResolve(entry):
                                  │   - registry has 'RFC1122'? yes
                                  ▼ → resolvedDocId = 'RFC1122'; needsResolve = null
                 All siblings sharing the same contentHash inherit the same
                 resolution in the same pass.

5. NEXT BUILD    renderer chain: MRI hit → resolvedDocId set
                                  │
                                  ▼
                 Doc page + refTree show a normal `<a>` link to RFC1122's doc.
                 RFC1101's `doc.references[]` still says `"orphan/RFC1101/h:e25f0fbf"` —
                 unchanged; the renderer just follows the MRI pointer.

6. NEXT EXTRACT  Re-extracting RFC1101 with the improved parser:
                                  │ parser now returns 'RFC1122' directly
                                  ▼
                 doc.references.bibliographic[] changes from
                 `["orphan/…", …]` → `["RFC1122", …]`
                 Old orphan loses its only sighting → pruned out of MRI on next flush.
                 Doc has converged on the canonical form. Audit history lives in git.
```

---

## What's NOT here (deprecated)

- `src/main/reports/badRefs.latest.json` — removed. Every unparseable
  ref now lives in MRI as an orphan slug; the "what failed to parse?"
  question is answered by `MRI.refs[]` where `isOrphan: true`. The
  legacy file is gone, the persistence code in `extractDocs.js` is
  gone.
- `MRI.orphans.unmapped[]` — emptied. The legacy flat list of
  unmapped citations was lifted into `MRI.refs[]` keyed by
  source-anchored slugs during the v2 migration. The field remains as
  an escape hatch only (kept for backwards-compat with consumers that
  still read the shape) and the migration / new mint path never write
  to it.
- `[WARN] No lineage key derivable: ref="X"` and `[WARN:getStatus]
  docId "X" not found in registry` console noise — silenced. The same
  population is fully tracked by the presence audit + the auto-issue
  workflow. Console silence ≠ data loss.

---

## Files to know

- `src/main/lib/referencing.js` — MRI access (`_loadMRI`, `_ensureRef`,
  `mriRecordSighting`, `mriPruneToSightings`, `mriFlush`,
  `synthesizeCiteFromRawRef`).
- `src/main/scripts/buildMasterReferenceIndex.js` — emits
  `masterReferenceIndex.json` and `mri_presence_audit.json`.
- `src/main/scripts/extras/resolveOrphans.js` — idempotent retry pass.
- `src/main/scripts/extras/migrateMriToSlugSchema.js` — one-time v2
  schema migration (already applied; idempotent if re-run).
- `src/main/scripts/extractDocs.js` — `onBadRefs` callback wires
  unparseable refs into MRI; queues minted slugs into the source doc's
  `references[]` before save.
- `src/main/scripts/build.js` — `getStatus`, `refHref`, `getLabel`,
  `mriCite` Handlebars helpers + `followMriResolution` pointer chase.
- `src/site/js/refTree.js` — client-side render of the reference tree;
  consumes `build/api/mri-cite-map.json`.
- `.github/workflows/build-master-reference-index.yml` — auto-issue
  workflow (filters `needsResolve === 'known-publisher-no-doc'`).
