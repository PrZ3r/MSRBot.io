# Citations, references and the MRI

Background: `docs/mri-citation-system.md`. Every string in `doc.references.*` resolves (in order) to a registry doc, an MRI entry with `resolvedDocId`, or an MRI entry rendered as an external citation.

## What you do

List every citation from the document's references section **verbatim** in the record's `citations.normative` / `citations.bibliographic` (`{ "cite": "...", "href": "..." }`). Split a bullet that names two documents into two citations. Choose normative vs bibliographic from how the publisher frames the section and say which in the PR. Don't list generic phrases that aren't documents.

## What the pipeline does (`npm run extract-manual`)

| Parser result | Reference string | MRI |
|---|---|---|
| registry docId (exact) | that docId | sighting with your cite text |
| canonical refId, no registry doc (`ISO.26428-7`, `AFNOR.NFS27-100`) | the refId | sighting; resolves later when the doc is added, or to the latest edition of an undated base |
| nothing | `orphan/<docId>/h:<hash>` | orphan minted by `onBadRefs`, carrying your cite text |
| explicit `refId` on the citation | that refId | sighting with `mapSource: manual:explicit` — list it in the review |

Undated citations stay undated; the resolver links them to the latest edition **of the same base**. It never rolls an unparted citation onto a part (`SMPTE.ST299` doesn't resolve to ST 299-1 or 299-2). Supersession records lead from the base edition to its parted successor. Don't pick an edition or part the publisher didn't cite.

**Set citations** expand to their members: a bare "BCP 47" records both RFC 5646 and RFC 4647 (`REF_EXPANSIONS` in `referencing.js`). A citation that names its RFC keeps that RFC. Add a new set there, not as explicit refIds.

## When the parser is wrong

Fix `parseRefId` (family in `src/main/lib/referencing.js`, test cases in `src/main/scripts/test/referencing.citeTypography.test.js`) or add a `refMap.json` entry (`npm run config-sort` afterwards). Before shipping a parser change, parse every MRI citation before and after and diff (≈51k cites, seconds):

```bash
node -e 'const fs=require("fs"),r=require("./src/main/lib/referencing"),{loadMri}=require("./src/main/lib/mriStore");const m=loadMri(),o={};for(const e of Object.values(m.refs))for(const v of [...(e.rawVariants||[]),{cite:e.citationText,href:e.href}])if(v&&v.cite)o[v.cite+"\u0000"+(v.href||"")]=r.parseRefId(v.cite,v.href||"");fs.writeFileSync(process.argv[1],JSON.stringify(o))' parse-before.json
```

Zero citations lost; every change to a different document explained in the PR.
