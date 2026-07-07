# Registry Field Census — Deep pre-#1171 Audit Part 1

> Generated at: 2026-07-06T20:28:19.779Z
> Registry docs: **26445**
> Distinct schema fields: **110**

## Classification summary

- 🔴 **Gaps** (populated but not rendered/searchable): **23**
- 🟢 Covered (populated + downstream visible): 69
- ⚪ Unused (schema-only, no docs populate it): 18

## 🔴 Gaps — fields with populated data but no downstream surface

| field | type | populated | rendered | searchable | in client JS | in extractor |
|---|---|---:|:---:|:---:|:---:|:---:|
| `resolvedHref` | string | 25100 | — | — | — | ✓ |
| `journalAcronym` | string | 22684 | — | — | — | — |
| `docNumber` | string | 1766 | — | — | — | ✓ |
| `productNumber` | string | 1228 | — | — | — | — |
| `standardId` | string | 766 | — | — | — | — |
| `docPart` | string | 724 | — | — | — | ✓ |
| `familyId` | string | 690 | — | — | — | — |
| `depositDate` | string | 80 | — | — | — | — |
| `status.errataExist` | boolean | 51 | — | — | — | ✓ |
| `status.state` | enum(2) | 46 | — | — | ✓ | ✓ |
| `docElement` | string | 28 | — | — | — | — |
| `status.errataUrl` | array | 26 | — | — | — | ✓ |
| `status.stage` | enum(5) | 23 | — | — | — | ✓ |
| `status.supersedes` | array | 20 | — | — | — | ✓ |
| `xmlNamespace[].imported` | boolean | 20 | — | — | — | — |
| `xmlNamespace[].schemaIncluded` | boolean | 20 | — | — | — | — |
| `xmlNamespace[].targetNamespace` | boolean | 20 | — | — | — | — |
| `xmlNamespace[].uriPublished` | boolean | 20 | — | — | — | — |
| `xmlNamespace[].uriResolved` | string | 19 | — | — | — | — |
| `status.amends` | array | 15 | — | — | — | ✓ |
| `xmlNamespace[].schemaInline` | boolean | 14 | — | — | — | — |
| `xmlNamespace[].note` | string | 6 | — | — | — | — |
| `xmlNamespace[].schemaLocation` | string | 1 | — | — | — | — |

## 🟢 Covered fields (top 40 by population)

| field | type | populated | rendered | searchable | in extractor |
|---|---|---:|:---:|:---:|:---:|
| `docId` | string | 26445 | ✓ | ✓ | ✓ |
| `docLabel` | string | 26445 | ✓ | ✓ | ✓ |
| `docTitle` | string | 26445 | ✓ | ✓ | ✓ |
| `docType` | enum(42) | 26445 | ✓ | ✓ | ✓ |
| `status` | object | 26445 | ✓ | ✓ | ✓ |
| `publisher` | string | 26442 | ✓ | ✓ | ✓ |
| `status.active` | boolean | 26420 | ✓ | ✓ | ✓ |
| `publicationDate` | string | 26246 | ✓ | ✓ | ✓ |
| `href` | string | 26239 | ✓ | ✓ | ✓ |
| `doi` | string | 25566 | ✓ | ✓ | ✓ |
| `copyright` | object | 25425 | ✓ | ✓ | ✓ |
| `copyright.year` | string | 25425 | ✓ | ✓ | ✓ |
| `pages` | string | 25007 | ✓ | — | ✓ |
| `publisherLocation` | object | 24960 | ✓ | — | — |
| `publisherLocation.city` | string | 24960 | ✓ | — | — |
| `copyright.holder` | string | 24949 | ✓ | ✓ | ✓ |
| `articleType` | string | 24208 | ✓ | ✓ | — |
| `number` | string | 24208 | ✓ | — | ✓ |
| `volume` | string | 24208 | ✓ | — | — |
| `publisherLocation.country` | string | 23436 | ✓ | — | — |
| `issn` | variant | 22747 | ✓ | — | ✓ |
| `issn.print` | string | 22706 | ✓ | — | — |
| `abbrevTitle` | string | 21380 | ✓ | ✓ | — |
| `authors` | array | 10751 | ✓ | ✓ | ✓ |
| `authors[].name` | string | 10751 | ✓ | ✓ | ✓ |
| `abstract` | string | 9880 | ✓ | — | ✓ |
| `authors[].affiliation` | string | 7251 | ✓ | ✓ | ✓ |
| `references` | object | 5477 | ✓ | — | ✓ |
| `references.bibliographic` | array | 5194 | ✓ | — | ✓ |
| `status.superseded` | boolean | 1696 | ✓ | ✓ | ✓ |
| `issn.electronic` | string | 1593 | ✓ | — | — |
| `keywords` | array | 1409 | ✓ | ✓ | ✓ |
| `status.latestVersion` | boolean | 1323 | ✓ | ✓ | ✓ |
| `releaseTag` | string | 1255 | ✓ | ✓ | ✓ |
| `isbn` | string | 1252 | ✓ | — | — |
| `approvalDate` | string | 1228 | ✓ | — | — |
| `icsCodes` | array | 1223 | ✓ | ✓ | — |
| `icsCodes[].code` | string | 1223 | ✓ | ✓ | — |
| `icsCodes[].description` | string | 1223 | ✓ | ✓ | — |
| `status.amended` | boolean | 1222 | ✓ | ✓ | ✓ |

## ⚪ Unused fields (schema-only, 0 docs populate)

| field | type |
|---|---|
| `chapter` | string |
| `doiAliases` | array |
| `edition` | string |
| `status.publicCd` | boolean |
| `versions` | array |
| `versions[].versionHref` | string |
| `versions[].versionNum` | string |
| `workInfo` | object |
| `workInfo.project` | array |
| `workInfo.project[].projectId` | string |
| `workInfo.review` | array |
| `workInfo.review[].assignedGroup` | string |
| `workInfo.review[].recApproved` | boolean |
| `workInfo.review[].reviewDate` | string |
| `workInfo.review[].reviewNeeded` | boolean |
| `workInfo.review[].reviewNotes` | string |
| `workInfo.review[].reviewPeriod` | enum(3) |
| `workInfo.review[].reviewRec` | enum(7) |

## Notes

- "populated" counts docs with a non-null / non-empty value at the field path (arrays require ≥1 element; objects require ≥1 key).
- "rendered" / "searchable" / "in extractor" are grep-based token checks against the relevant files — they can false-positive on shared substrings, so treat as first-pass triage rather than authoritative.
- Companion source-XML side lives in `sourceInventory.deep.{json,md}` from `auditSourceFoldersDeep.js`.
- Cross-reference with source-XML tally: fields with `source_XML: yes` and `populated: 0` are "extractor never captured this even though the data is on disk."