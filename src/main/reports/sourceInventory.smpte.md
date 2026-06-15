# _source/SMPTE Inventory — 2026-06-15T18:23:21.733Z

Registry snapshot: per-doc registry [src/main/data/docs/](../data/docs/) (26286 docs at scan time)

## Totals
- Directories walked: 16413
- Files scanned: 229776
- Files skipped: failed-extraction 982, zip containers 121, noise 67
- Unique assets (dedup by docId): 21190
- Duplicate copies detected: 128787

## Buckets
| Bucket          | Count | Notes                                          |
|-----------------|-------|------------------------------------------------|
| Found (verified)| 46    | XML read AND every comparable field matched    |
| Found (unverif.)| 14441 | docId matches registry but no source XML found |
| Update          | 6331  | in registry, source has new or different fields|
| Gap             | 372   | in source, not in registry — new records       |
| Registry-only   | 4653  | in registry (SMPTE), no local source archived  |
| Unidentifiable  | 8     | in source, no DOI derivable — manual triage    |
| Non-record      | 37227 | not a document (analytics/schema/db/image)     |

## By vendor
| Vendor            | Found | Update | Gap | Unid. | Non-rec |
|-------------------|-------|--------|-----|-------|---------|
| ALLEN PRESS       | 0     | 657    | 2   | 0     | 116     |
| APTARA            | 70242 | 34520  | 2529 | 2     | 33288   |
| HIGHWIRE          | 29002 | 12473  | 182 | 5     | 2439    |
| IEEE              | 6     | 362    | 2   | 0     | 1363    |
| IEEE DL Usage     | 0     | 0      | 0   | 0     | 18      |
| Zoho              | 0     | 0      | 0   | 1     | 2       |

## Field deltas across the Update bucket (registry vs source)

Per-field counts of how registry values compare to what the source XML provides. Tallies are per registry-matched bucket entry (Found + Update = 20818) where the source XML actually carries that field.

- **Delta** = both sides populated, normalized values differ → review
- **Narrowed** = source is more precise (e.g. year → full date) → safe to auto-accept
- **Fillable** = registry empty, source has a value
- **Agree** = both populated and equal after normalization (no action)

| Field             | Delta | Narrowed | Fillable | Agree | Total |
|-------------------|-------|----------|----------|-------|-------|
| docType           |  1500 |        0 |        0 | 19305 | 20805 |
| references        |   769 |        0 |     4125 |     0 |  4894 |
| docTitle          |   458 |        0 |        0 |   647 |  1105 |
| publisher         |    96 |        0 |        0 | 20721 | 20817 |
| publisherLocation |    96 |        0 |        0 |  1035 |  1131 |
| articleType       |    96 |        0 |        0 |   283 |   379 |
| docSuiteTitle     |    70 |        0 |      382 |   131 |   583 |
| keywords          |    66 |        0 |      263 |   686 |  1015 |
| abbrevTitle       |    15 |        0 |       46 |   318 |   379 |
| doi               |     0 |        0 |        0 | 20818 | 20818 |
| publicationDate   |     0 |        0 |        0 |  1165 |  1165 |
| pages             |     0 |        0 |        0 |  1131 |  1131 |
| copyright         |     0 |        0 |        0 |  1129 |  1129 |
| docNumber         |     0 |        0 |        0 |   867 |   867 |
| abstract          |     0 |        0 |        6 |   836 |   842 |
| standardId        |     0 |        0 |        0 |   766 |   766 |
| isbn              |     0 |        0 |        0 |   752 |   752 |
| productNumber     |     0 |        0 |        0 |   752 |   752 |
| approvalDate      |     0 |        0 |        0 |   752 |   752 |
| icsCodes          |     0 |        0 |        0 |   750 |   750 |
| familyId          |     0 |        0 |        0 |   690 |   690 |
| group             |     0 |        0 |        0 |   573 |   573 |
| issn              |     0 |        0 |        0 |   379 |   379 |
| journalAcronym    |     0 |        0 |       96 |   283 |   379 |
| volume            |     0 |        0 |        0 |   379 |   379 |
| number            |     0 |        0 |        0 |   379 |   379 |
| docPart           |     0 |        0 |        0 |   278 |   278 |
| authors           |     0 |        0 |        1 |   153 |   154 |

## Sample value deltas (first 30 of all in JSON)
- `10.5594-J00802` `publisher`: registry=`SMPTE` vs source=`Society of Motion Picture and Television Engineers, Inc.`
- `10.5594-J00802` `articleType`: registry=`research-article` vs source=`orig-research`
- `10.5594-J00802` `publisherLocation`: registry=`{"city":"White Plains, NY","city$meta":{"confidence":"high","note":"Parsed from NLM article XML (_so…` vs source=`{"city":"White Plains, NY","country":"USA"}`
- `10.5594-J00803` `publisher`: registry=`SMPTE` vs source=`Society of Motion Picture and Television Engineers, Inc.`
- `10.5594-J00803` `articleType`: registry=`research-article` vs source=`orig-research`
- `10.5594-J00803` `publisherLocation`: registry=`{"city":"White Plains, NY","city$meta":{"confidence":"high","note":"Parsed from NLM article XML (_so…` vs source=`{"city":"White Plains, NY","country":"USA"}`
- `10.5594-J00804` `publisher`: registry=`SMPTE` vs source=`Society of Motion Picture and Television Engineers, Inc.`
- `10.5594-J00804` `articleType`: registry=`other` vs source=`orig-research`
- `10.5594-J00804` `publisherLocation`: registry=`{"city":"White Plains, NY","city$meta":{"confidence":"high","note":"Parsed from NLM article XML (_so…` vs source=`{"city":"White Plains, NY","country":"USA"}`
- `10.5594-J00805` `publisher`: registry=`SMPTE` vs source=`Society of Motion Picture and Television Engineers, Inc.`
- `10.5594-J00805` `articleType`: registry=`research-article` vs source=`orig-research`
- `10.5594-J00805` `publisherLocation`: registry=`{"city":"White Plains, NY","city$meta":{"confidence":"high","note":"Parsed from NLM article XML (_so…` vs source=`{"city":"White Plains, NY","country":"USA"}`
- `10.5594-J00806` `publisher`: registry=`SMPTE` vs source=`Society of Motion Picture and Television Engineers, Inc.`
- `10.5594-J00806` `articleType`: registry=`other` vs source=`orig-research`
- `10.5594-J00806` `publisherLocation`: registry=`{"city":"White Plains, NY","city$meta":{"confidence":"high","note":"Parsed from NLM article XML (_so…` vs source=`{"city":"White Plains, NY","country":"USA"}`
- `10.5594-J00807` `publisher`: registry=`SMPTE` vs source=`Society of Motion Picture and Television Engineers, Inc.`
- `10.5594-J00807` `articleType`: registry=`other` vs source=`orig-research`
- `10.5594-J00807` `publisherLocation`: registry=`{"city":"White Plains, NY","city$meta":{"confidence":"high","note":"Parsed from NLM article XML (_so…` vs source=`{"city":"White Plains, NY","country":"USA"}`
- `10.5594-J00808` `publisher`: registry=`SMPTE` vs source=`Society of Motion Picture and Television Engineers, Inc.`
- `10.5594-J00808` `articleType`: registry=`other` vs source=`orig-research`
- `10.5594-J00808` `publisherLocation`: registry=`{"city":"White Plains, NY","city$meta":{"confidence":"high","note":"Parsed from NLM article XML (_so…` vs source=`{"city":"White Plains, NY","country":"USA"}`
- `10.5594-J00809` `publisher`: registry=`SMPTE` vs source=`Society of Motion Picture and Television Engineers, Inc.`
- `10.5594-J00809` `articleType`: registry=`other` vs source=`orig-research`
- `10.5594-J00809` `publisherLocation`: registry=`{"city":"White Plains, NY","city$meta":{"confidence":"high","note":"Parsed from NLM article XML (_so…` vs source=`{"city":"White Plains, NY","country":"USA"}`
- `10.5594-J00810` `publisher`: registry=`SMPTE` vs source=`Society of Motion Picture and Television Engineers, Inc.`
- `10.5594-J00810` `articleType`: registry=`other` vs source=`toc`
- `10.5594-J00810` `publisherLocation`: registry=`{"city":"White Plains, NY","city$meta":{"confidence":"high","note":"Parsed from NLM article XML (_so…` vs source=`{"city":"White Plains, NY","country":"USA"}`
- `10.5594-J00811` `publisher`: registry=`SMPTE` vs source=`Society of Motion Picture and Television Engineers, Inc.`
- `10.5594-J00811` `articleType`: registry=`other` vs source=`toc`
- `10.5594-J00811` `publisherLocation`: registry=`{"city":"White Plains, NY","city$meta":{"confidence":"high","note":"Parsed from NLM article XML (_so…` vs source=`{"city":"White Plains, NY","country":"USA"}`

## Top duplicates
- `SMPTE.ST2021-1.2009` — 29 copies (aptara:24, highwire:3, ieee:2)
- `SMPTE.ST429-6.2006` — 29 copies (aptara:24, highwire:3, ieee:2)
- `SMPTE.EG2021-3.2013` — 28 copies (aptara:24, highwire:2, ieee:2)
- `SMPTE.OV2021-0.2012` — 28 copies (aptara:23, ieee:2, highwire:3)
- `SMPTE.ST2021-1.2012` — 28 copies (aptara:24, highwire:2, ieee:2)
- `SMPTE.ST429-7.2006` — 28 copies (aptara:24, highwire:2, ieee:2)
- `SMPTE.ST429-9.2014` — 28 copies (aptara:23, highwire:3, ieee:2)
- `10.5594-S9781614820130` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820192` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820215` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820048` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820697` — 28 copies (aptara:26, highwire:2)
- `SMPTE.RP17.1964` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820727` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820734` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820833` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820840` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820895` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820901` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820918` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820925` — 28 copies (aptara:26, highwire:2)
- `10.5594-S9781614820642` — 28 copies (aptara:26, highwire:2)
- `SMPTE.OV2021-0.2009` — 27 copies (aptara:23, ieee:2, highwire:2)
- `SMPTE.RP2021-5.2013` — 27 copies (aptara:23, highwire:2, ieee:2)
- `SMPTE.ST12-1.2013Am1` — 27 copies (aptara:25, highwire:2)

## Updates (6331 — details in JSON)
- `10.5594-J00022` — fillable: references
- `10.5594-J00023` — fillable: references
- `10.5594-J00024` — fillable: references
- `10.5594-J00025` — fillable: references
- `10.5594-J00029` — fillable: references
- `10.5594-J00030` — fillable: references
- `10.5594-J00038` — fillable: references
- `10.5594-J00042` — fillable: references
- `10.5594-J00078` — fillable: references
- `10.5594-J00079` — fillable: references
- `10.5594-J00081` — fillable: references
- `10.5594-J00095` — fillable: references
- `10.5594-J00096` — fillable: references
- `10.5594-J00097` — fillable: references
- `10.5594-J00098` — fillable: references
- `10.5594-J00100` — fillable: references
- `10.5594-J00116` — fillable: references
- `10.5594-J00117` — fillable: references
- `10.5594-J00120` — fillable: references
- `10.5594-J00138` — fillable: references
- `10.5594-J00139` — fillable: references
- `10.5594-J00142` — fillable: references
- `10.5594-J00161` — fillable: references
- `10.5594-J00164` — fillable: references
- `10.5594-J00167` — fillable: references
- `10.5594-J00181` — fillable: references
- `10.5594-J00182` — fillable: references
- `10.5594-J00185` — fillable: references
- `10.5594-J00196` — fillable: references
- `10.5594-J00197` — fillable: references
- `10.5594-J00199` — fillable: references
- `10.5594-J00200` — fillable: references
- `10.5594-J00201` — fillable: references
- `10.5594-J00202` — fillable: references
- `10.5594-J00224` — fillable: references
- `10.5594-J00225` — fillable: references
- `10.5594-J00227` — fillable: references
- `10.5594-J00229` — fillable: references
- `10.5594-J00230` — fillable: references
- `10.5594-J00246` — fillable: references
- `10.5594-J00247` — fillable: references
- `10.5594-J00248` — fillable: references
- `10.5594-J00250` — fillable: references
- `10.5594-J00251` — fillable: references
- `10.5594-J00269` — fillable: references
- `10.5594-J00270` — fillable: references
- `10.5594-J00272` — fillable: references
- `10.5594-J00273` — fillable: references
- `10.5594-J00289` — fillable: references
- `10.5594-J00292` — fillable: references
- `10.5594-J00293` — fillable: references
- `10.5594-J00307` — fillable: references
- `10.5594-J00308` — fillable: references
- `10.5594-J00310` — fillable: references
- `10.5594-J00311` — fillable: references
- `10.5594-J00328` — fillable: references
- `10.5594-J00342` — fillable: references
- `10.5594-J00343` — fillable: references
- `10.5594-J00348` — fillable: references
- `10.5594-J00349` — fillable: references
- `10.5594-J00350` — fillable: references
- `10.5594-J00351` — fillable: references
- `10.5594-J00358` — fillable: references
- `10.5594-J00373` — fillable: references
- `10.5594-J00375` — fillable: references
- `10.5594-J00376` — fillable: references
- `10.5594-J00392` — fillable: references
- `10.5594-J00394` — fillable: references
- `10.5594-J00395` — fillable: references
- `10.5594-J00396` — fillable: references
- `10.5594-J00413` — fillable: references
- `10.5594-J00414` — fillable: references
- `10.5594-J00415` — fillable: references
- `10.5594-J00416` — fillable: references
- `10.5594-J00445` — fillable: references
- `10.5594-J00446` — fillable: references
- `10.5594-J00447` — fillable: references
- `10.5594-J00448` — fillable: references
- `10.5594-J00462` — fillable: references
- `10.5594-J00463` — fillable: references
- `10.5594-J00464` — fillable: references
- `10.5594-J00465` — fillable: references
- `10.5594-J00467` — fillable: references
- `10.5594-J00468` — fillable: references
- `10.5594-J00478` — fillable: references
- `10.5594-J00480` — fillable: references
- `10.5594-J00481` — fillable: references
- `10.5594-J00500` — fillable: references
- `10.5594-J00501` — fillable: references
- `10.5594-J00502` — fillable: references
- `10.5594-J00503` — fillable: references
- `10.5594-J00504` — fillable: references
- `10.5594-J00505` — fillable: references
- `10.5594-J00506` — fillable: references
- `10.5594-J00522` — fillable: references
- `10.5594-J00524` — fillable: references
- `10.5594-J00525` — fillable: references
- `10.5594-J00527` — fillable: references
- `10.5594-J00564` — fillable: references
- `10.5594-J00565` — fillable: references
- `10.5594-J00566` — fillable: references
- `10.5594-J00567` — fillable: references
- `10.5594-J00585` — fillable: references
- `10.5594-J00586` — fillable: references
- `10.5594-J00587` — fillable: references
- `10.5594-J00609` — fillable: references
- `10.5594-J00610` — fillable: references
- `10.5594-J00611` — fillable: references
- `10.5594-J00626` — fillable: references
- `10.5594-J00627` — fillable: references
- `10.5594-J00630` — fillable: references
- `10.5594-J00631` — fillable: references
- `10.5594-J00645` — fillable: references
- `10.5594-J00646` — fillable: references
- `10.5594-J00647` — fillable: references
- `10.5594-J00690` — fillable: references
- `10.5594-J00712` — fillable: references
- `10.5594-J00716` — fillable: references
- `10.5594-J00717` — fillable: references
- `10.5594-J00730` — fillable: references
- `10.5594-J00731` — fillable: references
- `10.5594-J00732` — fillable: references
- `10.5594-J00733` — fillable: references
- `10.5594-J00734` — fillable: references
- `10.5594-J00735` — fillable: references
- `10.5594-J00736` — fillable: references
- `10.5594-J00757` — fillable: references
- `10.5594-J00758` — fillable: references
- `10.5594-J00773` — fillable: references
- `10.5594-J00802` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00803` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00804` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00805` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00806` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00807` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00808` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00809` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00810` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00811` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00812` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00813` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00814` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00815` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00816` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00817` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00818` — fillable: keywords, docSuiteTitle, journalAcronym
- `10.5594-J00820` — fillable: references
- `10.5594-J00821` — fillable: references
- `10.5594-J00822` — fillable: references
- `10.5594-J00823` — fillable: references
- `10.5594-J00827` — fillable: references
- `10.5594-J00839` — fillable: references
- `10.5594-J00842` — fillable: references
- `10.5594-J00850` — fillable: references
- `10.5594-J00852` — fillable: references
- `10.5594-J00853` — fillable: references
- `10.5594-J00885` — fillable: references
- `10.5594-J00886` — fillable: references
- `10.5594-J00887` — fillable: references
- `10.5594-J00888` — fillable: references
- `10.5594-J00901` — fillable: references
- `10.5594-J00902` — fillable: references
- `10.5594-J00903` — fillable: references
- `10.5594-J00916` — fillable: references
- `10.5594-J00917` — fillable: references
- `10.5594-J00918` — fillable: references
- `10.5594-J00944` — fillable: references
- `10.5594-J00945` — fillable: references
- `10.5594-J00963` — fillable: references
- `10.5594-J00964` — fillable: references
- `10.5594-J00981` — fillable: references
- `10.5594-J00982` — fillable: references
- `10.5594-J00985` — fillable: references
- `10.5594-J00986` — fillable: references
- `10.5594-J00993` — fillable: references
- `10.5594-J00995` — fillable: references
- `10.5594-J00997` — fillable: references
- `10.5594-J00999` — fillable: references
- `10.5594-J01039` — fillable: references
- `10.5594-J01042` — fillable: references
- `10.5594-J01044` — fillable: references
- `10.5594-J01046` — fillable: references
- `10.5594-J01047` — fillable: references
- `10.5594-J01067` — fillable: references
- `10.5594-J01070` — fillable: references
- `10.5594-J01072` — fillable: references
- `10.5594-J01073` — fillable: references
- `10.5594-J01084` — fillable: references
- `10.5594-J01088` — fillable: references
- `10.5594-J01092` — fillable: references
- `10.5594-J01104` — fillable: references
- `10.5594-J01105` — fillable: references
- `10.5594-J01106` — fillable: references
- `10.5594-J01107` — fillable: references
- `10.5594-J01125` — fillable: references
- `10.5594-J01129` — fillable: references
- `10.5594-J01131` — fillable: references
- `10.5594-J01145` — fillable: references
- `10.5594-J01148` — fillable: references
- `10.5594-J01149` — fillable: references
- … 6131 more

## Gaps (372 — details in JSON)
- `10.5594-J00496a`
- `10.5594-J00496b`
- `10.5594-J00536a`
- `10.5594-J00536b`
- `10.5594-J01060a`
- `10.5594-J01060b`
- `10.5594-J01167a`
- `10.5594-J01167b`
- `10.5594-J01306a`
- `10.5594-J01306b`
- `10.5594-J01348a`
- `10.5594-J01348b`
- `10.5594-J01399a`
- `10.5594-J01399b`
- `10.5594-J01721a`
- `10.5594-J01721b`
- `10.5594-J01746a`
- `10.5594-J01746b`
- `10.5594-J03331a`
- `10.5594-J03331b`
- `10.5594-J03678a`
- `10.5594-J03678b`
- `10.5594-J04114a`
- `10.5594-J04114b`
- `10.5594-J04866a`
- `10.5594-J04866b`
- `10.5594-J05047a`
- `10.5594-J05047b`
- `10.5594-J05454a`
- `10.5594-J05454b`
- `10.5594-J05484a`
- `10.5594-J05484b`
- `10.5594-J05505a`
- `10.5594-J05505b`
- `10.5594-J05564a`
- `10.5594-J05564b`
- `10.5594-J05594a`
- `10.5594-J05594b`
- `10.5594-J05619a`
- `10.5594-J05619b`
- `10.5594-J06185a`
- `10.5594-J06185b`
- `10.5594-J06256a`
- `10.5594-J06256b`
- `10.5594-J06531a`
- `10.5594-J06531b`
- `10.5594-J07118a`
- `10.5594-J07118b`
- `10.5594-J07314a`
- `10.5594-J07314b`
- `10.5594-J07360a`
- `10.5594-J07360b`
- `10.5594-J07497a`
- `10.5594-J07497b`
- `10.5594-J07595a`
- `10.5594-J07595b`
- `10.5594-J07903a`
- `10.5594-J07903b`
- `10.5594-J08021a`
- `10.5594-J08021b`
- `10.5594-J08089a`
- `10.5594-J08089b`
- `10.5594-J08282a`
- `10.5594-J08282b`
- `10.5594-J08994a`
- `10.5594-J08994b`
- `10.5594-J09083A`
- `10.5594-J09083B`
- `10.5594-J09411a`
- `10.5594-J09411b`
- `10.5594-J09465a`
- `10.5594-J09465b`
- `10.5594-J10155a`
- `10.5594-J10155b`
- `10.5594-J10370a`
- `10.5594-J10370b`
- `10.5594-J10457a`
- `10.5594-J10457b`
- `10.5594-J10748a`
- `10.5594-J10959a`
- `10.5594-J10959b`
- `10.5594-J10976a`
- `10.5594-J10976b`
- `10.5594-J11118a`
- `10.5594-J11118b`
- `10.5594-J11162a`
- `10.5594-J11162b`
- `10.5594-J11283a`
- `10.5594-J11283b`
- `10.5594-J11369a`
- `10.5594-J11369b`
- `10.5594-J11914a`
- `10.5594-J11914b`
- `10.5594-J13037a`
- `10.5594-J13037b`
- `10.5594-J13292a`
- `10.5594-J13292b`
- `10.5594-J13558a`
- `10.5594-J13558b`
- `10.5594-J13680a`
- `10.5594-J13680b`
- `10.5594-J13745a`
- `10.5594-J13745b`
- `10.5594-J14020a`
- `10.5594-J14020b`
- `10.5594-J14473a`
- `10.5594-J14473b`
- `10.5594-J14520a`
- `10.5594-J14520b`
- `10.5594-J14797a`
- `10.5594-J14797b`
- `10.5594-J15397a`
- `10.5594-J15397b`
- `10.5594-J15461a`
- `10.5594-J15461b`
- `10.5594-J15597a`
- `10.5594-J15597b`
- `10.5594-J15617a`
- `10.5594-J15617b`
- `10.5594-J15648a`
- `10.5594-J15648b`
- `10.5594-J16567a`
- `10.5594-J16567b`
- `10.5594-J16621a`
- `10.5594-J16621b`
- `10.5594-J16765a`
- `10.5594-J16765b`
- `10.5594-J17070a`
- `10.5594-J17070b`
- `10.5594-J17418a`
- `10.5594-J17418b`
- `10.5594-J18503`
- `10.5594-M001596`
- `10.5594-M001597`
- `10.5594-M001598`
- `10.5594-M001599`
- `10.5594-M001600`
- `10.5594-M001601`
- `10.5594-M001602`
- `10.5594-M001603`
- `10.5594-M001604`
- `10.5594-M001605`
- `10.5594-M001606`
- `10.5594-M001607`
- `10.5594-M001608`
- `10.5594-M001609`
- `10.5594-M001610`
- `10.5594-M001611`
- `10.5594-M001612`
- `10.5594-M001613`
- `10.5594-M001614`
- `10.5594-M001615`
- `10.5594-M001616`
- `10.5594-M001617`
- `10.5594-M001618`
- `10.5594-M001619`
- `10.5594-M001620`
- `10.5594-M001621`
- `10.5594-M001622`
- `10.5594-M001623`
- `10.5594-M001624`
- `10.5594-M001625`
- `10.5594-M001626`
- `10.5594-M001627`
- `10.5594-M001628`
- `10.5594-M001629`
- `10.5594-M001630`
- `10.5594-M001631`
- `10.5594-M001632`
- `10.5594-M001633`
- `10.5594-M001634`
- `10.5594-M001635`
- `10.5594-M001636`
- `10.5594-M001637`
- `10.5594-M001638`
- `10.5594-M001639`
- `10.5594-M001640`
- `10.5594-M001641`
- `10.5594-M001642`
- `10.5594-M001643`
- `10.5594-M001644`
- `10.5594-M001645`
- `10.5594-M001646`
- `10.5594-M001647`
- `10.5594-M001648`
- `10.5594-M001649`
- `10.5594-M001650`
- `10.5594-M001651`
- `10.5594-M001652`
- `10.5594-M001653`
- `10.5594-M001654`
- `10.5594-M001655`
- `10.5594-M001656`
- `10.5594-M001657`
- `10.5594-M001658`
- `10.5594-M001659`
- `10.5594-M001660`
- `10.5594-M001661`
- `10.5594-M001662`
- `10.5594-M001663`
- `10.5594-M001664`
- `10.5594-M001665`
- `10.5594-M001666`
- `10.5594-M001667`
- `10.5594-M001668`
- `10.5594-M001669`
- `10.5594-M001670`
- `10.5594-M001671`
- `10.5594-M001672`
- `10.5594-M001673`
- `10.5594-M001674`
- `10.5594-M001675`
- `10.5594-M001676`
- `10.5594-M001677`
- `10.5594-M001678`
- `10.5594-M001679`
- `10.5594-M001680`
- `10.5594-M001681`
- `10.5594-M001682`
- `10.5594-M001683`
- `10.5594-M001684`
- `10.5594-M001685`
- `10.5594-M001686`
- `10.5594-M001687`
- `10.5594-M001688`
- `10.5594-M001689`
- `10.5594-M001690`
- `10.5594-M001691`
- `10.5594-M001692`
- `10.5594-M001693`
- `10.5594-M001694`
- `10.5594-M001695`
- `10.5594-M001696`
- `10.5594-M001697`
- `10.5594-M001698`
- `10.5594-M001699`
- `10.5594-M001700`
- `10.5594-M001701`
- `10.5594-M001702`
- `10.5594-M001703`
- `10.5594-M001704`
- `10.5594-M001705`
- `10.5594-M001706`
- `10.5594-M001707`
- `10.5594-M001708`
- `10.5594-M001709`
- `10.5594-M001710`
- `10.5594-M001711`
- `10.5594-M001712`
- `10.5594-M001713`
- `10.5594-M001714`
- `10.5594-M001715`
- `10.5594-M001716`
- `10.5594-M001717`
- `10.5594-M001718`
- `10.5594-M001719`
- `10.5594-M001720`
- `10.5594-M001721`
- `10.5594-M001722`
- `10.5594-M001723`
- `10.5594-M001724`
- `10.5594-M001725`
- `10.5594-M001726`
- `10.5594-M001727`
- `10.5594-M001728`
- `10.5594-M001729`
- `10.5594-M001730`
- `10.5594-M001731`
- `10.5594-M001732`
- `10.5594-M001733`
- `10.5594-M001734`
- `10.5594-S9781614820048`
- `10.5594-S9781614820079`
- `10.5594-S9781614820116`
- `10.5594-S9781614820130`
- `10.5594-S9781614820147`
- `10.5594-S9781614820192`
- `10.5594-S9781614820215`
- `10.5594-S9781614820413`
- `10.5594-S9781614820468`
- `10.5594-S9781614820475`
- `10.5594-S9781614820482`
- `10.5594-S9781614820499`
- `10.5594-S9781614820505`
- `10.5594-S9781614820536`
- `10.5594-S9781614820567`
- `10.5594-S9781614820574`
- `10.5594-S9781614820581`
- `10.5594-S9781614820598`
- `10.5594-S9781614820604`
- `10.5594-S9781614820628`
- `10.5594-S9781614820642`
- `10.5594-S9781614820697`
- `10.5594-S9781614820727`
- `10.5594-S9781614820734`
- `10.5594-S9781614820833`
- `10.5594-S9781614820840`
- `10.5594-S9781614820895`
- `10.5594-S9781614820901`
- `10.5594-S9781614820918`
- `10.5594-S9781614820925`
- `10.5594-S9781614822509`
- `10.5594-S9781614822684`
- `10.5594-S9781614822691`
- `10.5594-S9781614825616`
- `10.5594-S9781614825708`
- `10.5594-S9781614825944`
- `10.5594-S9781614826880`
- `10.5594-S9781614826958`
- `10.5594-S9781614827498`
- `10.5594-S9781614827856`
- `10.5594-S9781614827962`
- `10.5594-S9781614827993`
- `10.5594-S9781614828006`
- `10.5594-S9781614828143`
- `10.5594-S9781614828303`
- `10.5594-S9781614828310`
- `10.5594-S9781614828327`
- `10.5594-S9781614828365`
- `10.5594-S9781614828433`
- `10.5594-S9781614828488`
- `10.5594-S9781614828495`
- `10.5594-S9781614828501`
- `10.5594-S9781614828518`
- `SMPTE.EG2032-4.2007`
- `SMPTE.RP103.1995`
- `SMPTE.RP107.1995`
- `SMPTE.RP163-1992`
- `SMPTE.RP168-2009`
- `SMPTE.RP170-1993`
- `SMPTE.RP171-1993`
- `SMPTE.RP172-1993`
- `SMPTE.RP191-1996`
- `SMPTE.RP2027.2011`
- `SMPTE.RP2052-10.2010-A1`
- `SMPTE.RP210.10.2007`
- `SMPTE.RP210v13.2012`
- `SMPTE.RP224-11.2011`
- `SMPTE.RP224-9.2008`
- `SMPTE.RP224v12.2012`
- `SMPTE.RP27.1.1989`
- `SMPTE.RP27.2.1989`
- `SMPTE.RP27.5.1989`
- `SMPTE.RP38.1.1989`
- `SMPTE.RP86.1991`
- `SMPTE.SMPTE430-3-2008Am2.2012`
- `SMPTE.SMPTEEG16.2014`
- `SMPTE.SMPTEST12-3.2016`
- `SMPTE.SMPTEST2001-1.2015`
- `SMPTE.SMPTEST217.2015`
- `SMPTE.ST11-1995`
- `SMPTE.ST12-1.2013Am1`
- `SMPTE.ST12-2.2013Am1`
- `SMPTE.ST165.1999`
- `SMPTE.ST2021M.2008`
- `SMPTE.ST2036-0.2013`
- `SMPTE.ST2036-2-2008`
- `SMPTE.ST2051.2010AM1.2013`
- `SMPTE.ST2052-0.2013`
- `SMPTE.ST292-0.2011`
- `SMPTE.ST370.2006_Amt1.2009`
- `SMPTE.ST377-1.2011Amt.2.2012`
- `SMPTE.ST379M.2004`
- `SMPTE.ST421-A1.2006`
- `SMPTE.ST421-A2.2011`
- `SMPTE.ST425-1.2014Am1`
- `SMPTE.ST429-9Am1.2010`
- `SMPTE.ST430-1.2006Am1`
- `SMPTE.ST430-1.2009Am1`
- `SMPTE.ST434.2014`
- `SMPTE.ST435-2.2009`
- `SMPTE.ST55.2011`

## Registry-only (4653 — indexed but no archived source)
- `10.5594-J00021C1`
- `10.5594-J00021iiA`
- `10.5594-J00021iiiiA`
- `10.5594-J00036C1`
- `10.5594-J00036iiA`
- `10.5594-J00036iiiiA`
- `10.5594-J0005911A`
- `10.5594-J00059C1`
- `10.5594-J00059iiA`
- `10.5594-J00059iiiiA`
- `10.5594-J00076C1`
- `10.5594-J00076iiA`
- `10.5594-J00076iiiiA`
- `10.5594-J00076iiiiiiA`
- `10.5594-J00093801801A`
- `10.5594-J00093C1`
- `10.5594-J00093iiA`
- `10.5594-J00113C1`
- `10.5594-J00113iiA`
- `10.5594-J00113iiiiA`
- `10.5594-J00135C1`
- `10.5594-J00135iiA`
- `10.5594-J00135iiiiA`
- `10.5594-J00157C1`
- `10.5594-J00157C2`
- `10.5594-J00157C3`
- `10.5594-J00157iiA`
- `10.5594-J00157iiiiA`
- `10.5594-J00178C1`
- `10.5594-J00178iiA`
- `10.5594-J00178iiiiA`
- `10.5594-J00194C1`
- `10.5594-J00194iiA`
- `10.5594-J00194iiiiA`
- `10.5594-J00221C1`
- `10.5594-J00221C2`
- `10.5594-J00221C3`
- `10.5594-J00221iiA`
- `10.5594-J00221iiiiA`
- `10.5594-J00244C1`
- `10.5594-J00244C2`
- `10.5594-J00244C3`
- `10.5594-J00244iiA`
- `10.5594-J00244iiiiA`
- `10.5594-J00267C1`
- `10.5594-J00267iiA`
- `10.5594-J00267iiiiA`
- `10.5594-J00287C1`
- `10.5594-J00287iiA`
- `10.5594-J00287iiiiA`
- `10.5594-J00305C1`
- `10.5594-J00305iiA`
- `10.5594-J00305iiiiA`
- `10.5594-J00323C1`
- `10.5594-J00323iiA`
- `10.5594-J00323iiiiA`
- `10.5594-J00340C1`
- `10.5594-J00340iiA`
- `10.5594-J00340iiiiA`
- `10.5594-J00369C1`
- `10.5594-J00369iiA`
- `10.5594-J00369iiiiA`
- `10.5594-J00390C1`
- `10.5594-J00390iiA`
- `10.5594-J00390iiiiA`
- `10.5594-J00410C1`
- `10.5594-J00410iiA`
- `10.5594-J00410iiiiA`
- `10.5594-J00427C1`
- `10.5594-J00427iiA`
- `10.5594-J00427iiiiA`
- `10.5594-J00443C1`
- `10.5594-J00443iiA`
- `10.5594-J00443iiiiA`
- `10.5594-J00462C1`
- `10.5594-J00462iiA`
- `10.5594-J00478C1`
- `10.5594-J00478iiA`
- `10.5594-J00496491492A`
- `10.5594-J00500C1`
- `10.5594-J00500iiA`
- `10.5594-J00522C1`
- `10.5594-J00522iiA`
- `10.5594-J00522iiiiA`
- `10.5594-J00536142142A`
- `10.5594-J00562202202A`
- `10.5594-J00562C1`
- `10.5594-J00563207207A`
- `10.5594-J00585767767A`
- `10.5594-J00585768768A`
- `10.5594-J00585C1`
- `10.5594-J00609481481A`
- `10.5594-J00609482482A`
- `10.5594-J00609C1`
- `10.5594-J006259259A`
- `10.5594-J00643371371A`
- `10.5594-J00643C1`
- `10.5594-J00643iiA`
- `10.5594-J006481481A`
- `10.5594-J006482482A`
- `10.5594-J00664259259A`
- `10.5594-J00664C1`
- `10.5594-J00664C2`
- `10.5594-J00664iiA`
- `10.5594-J00688179179A`
- `10.5594-J00688C1`
- `10.5594-J00688iiA`
- `10.5594-J00710C1`
- `10.5594-J00710iiA`
- `10.5594-J00710iiiiA`
- `10.5594-J00728C1`
- `10.5594-J00728iiA`
- `10.5594-J00728iiiiA`
- `10.5594-J00749C1`
- `10.5594-J00749C2`
- `10.5594-J00749C3`
- `10.5594-J00749C4`
- `10.5594-J00749IIA`
- `10.5594-J00749IIIIA`
- `10.5594-J00749IIIIIIA`
- `10.5594-J00784C1`
- `10.5594-J00784iiA`
- `10.5594-J00784iiiiA`
- `10.5594-J00784iiiiiiA`
- `10.5594-J007IVIIIA`
- `10.5594-J008022`
- `10.5594-J008023`
- `10.5594-J00802C1`
- `10.5594-J008181`
- `10.5594-J00819C1`
- `10.5594-J00819iiA`
- `10.5594-J00819iiiiA`
- `10.5594-J00839C1`
- `10.5594-J00839iiA`
- `10.5594-J00839iiiiA`
- `10.5594-J00866C1`
- `10.5594-J00866iiA`
- `10.5594-J00866iiiiA`
- `10.5594-J00866iiiiiiA`
- `10.5594-J00884C1`
- `10.5594-J00884iiA`
- `10.5594-J00884iiiiA`
- `10.5594-J00899C1`
- `10.5594-J00899iiA`
- `10.5594-J008C1`
- `10.5594-J008C2`
- `10.5594-J008C3`
- `10.5594-J008I`
- `10.5594-J00914C1`
- `10.5594-J00914iiA`
- `10.5594-J00941C1`
- `10.5594-J00941C2`
- `10.5594-J00941iiA`
- `10.5594-J00963C1`
- `10.5594-J00963iiA`
- `10.5594-J00980C1`
- `10.5594-J00980iiA`
- `10.5594-J00993C1`
- `10.5594-J00993iiA`
- `10.5594-J01038C1`
- `10.5594-J01038iiA`
- `10.5594-J01060743743A`
- `10.5594-J01067C1`
- `10.5594-J01067C2`
- `10.5594-J01067iiA`
- `10.5594-J01084C1`
- `10.5594-J01084iiA`
- `10.5594-J01104C1`
- `10.5594-J01104iiA`
- `10.5594-J01125C1`
- `10.5594-J01125iiA`
- `10.5594-J01144C1`
- `10.5594-J01144C2`
- `10.5594-J01144iiA`
- `10.5594-J011544545A`
- `10.5594-J01167544545A`
- `10.5594-J01177C1`
- `10.5594-J01177iiA`
- `10.5594-J01196C1`
- `10.5594-J01196C2`
- `10.5594-J01196iiA`
- `10.5594-J01215C1`
- `10.5594-J01215C2`
- `10.5594-J01215iiA`
- `10.5594-J01232C1`
- `10.5594-J01232C2`
- `10.5594-J01232C3`
- `10.5594-J01232C4`
- `10.5594-J01232iiA`
- `10.5594-J01232iiiiA`
- `10.5594-J01244C1`
- `10.5594-J01244iiA`
- `10.5594-J01244iiiiA`
- `10.5594-J01256C1`
- `10.5594-J01256C2`
- `10.5594-J01256C3`
- `10.5594-J01256iiA`
- `10.5594-J01256iiiiA`
- `10.5594-J01268C1`
- `10.5594-J01268IIA`
- `10.5594-J01268IIIA`
- `10.5594-J01268IIIIA`
- `10.5594-J01280C1`
- `10.5594-J01280iiA`
- `10.5594-J01280iiiiA`
- `10.5594-J01293C1`
- `10.5594-J01293iiA`
- `10.5594-J01293iiiiA`
- `10.5594-J01306306306A`
- `10.5594-J01313C1`
- `10.5594-J01313iiA`
- `10.5594-J01313iiiiA`
- `10.5594-J01335C1`
- `10.5594-J01335iiA`
- `10.5594-J01335iiiiA`
- `10.5594-J01348536536A`
- `10.5594-J01355C1`
- `10.5594-J01355C2`
- `10.5594-J01355C3`
- `10.5594-J01355iiA`
- `10.5594-J01355iiiiA`
- `10.5594-J01383C1`
- `10.5594-J01383C2`
- `10.5594-J01383C3`
- `10.5594-J01383iiA`
- `10.5594-J01383iiiiA`
- `10.5594-J013868883A`
- `10.5594-J01399868883A`
- `10.5594-J01407C1`
- `10.5594-J01407iiA`
- `10.5594-J01407iiiiA`
- `10.5594-J01423C1`
- `10.5594-J01423iiA`
- `10.5594-J01423iiiiA`
- `10.5594-J01444C1`
- `10.5594-J01444iiA`
- `10.5594-J01444iiiiA`
- `10.5594-J01459C1`
- `10.5594-J01459C2`
- `10.5594-J01459C3`
- `10.5594-J01459iiA`
- `10.5594-J01459iiiiA`
- `10.5594-J01481C1`
- `10.5594-J01481iiA`
- `10.5594-J01481iiiiA`
- `10.5594-J01498C1`
- `10.5594-J01498iiA`
- `10.5594-J01498iiiiA`
- `10.5594-J01520C1`
- `10.5594-J01520iiA`
- `10.5594-J01520iiiiA`
- `10.5594-J01539C1`
- `10.5594-J01539C2`
- `10.5594-J01539C3`
- `10.5594-J01539iiA`
- `10.5594-J01539iiiiA`
- `10.5594-J01558C1`
- `10.5594-J01558C2`
- `10.5594-J01558C3`
- `10.5594-J01558iiA`
- `10.5594-J01558iiiiA`
- `10.5594-J01581C1`
- `10.5594-J01581iiA`
- `10.5594-J01581iiiiA`
- `10.5594-J01604C1`
- `10.5594-J01604C2`
- `10.5594-J01604iiA`
- `10.5594-J01627C1`
- `10.5594-J01627iiA`
- `10.5594-J01627iiiiA`
- `10.5594-J0165010931093A`
- `10.5594-J0165010941094A`
- `10.5594-J01650C1`
- `10.5594-J01667401401A`
- `10.5594-J01667C1`
- `10.5594-J01667iiA`
- `10.5594-J01689C1`
- `10.5594-J01689iiA`
- `10.5594-J01689iiiiA`
- `10.5594-J01706C1`
- `10.5594-J01706iiA`
- `10.5594-J01706iiiiA`
- `10.5594-J017186186A`
- `10.5594-J017219798A`
- `10.5594-J01725C1`
- `10.5594-J01725C2`
- `10.5594-J01725iiA`
- `10.5594-J01746186186A`
- `10.5594-J01750C1`
- `10.5594-J01750C2`
- `10.5594-J01750iiA`
- `10.5594-J01778C1`
- `10.5594-J01778C2`
- `10.5594-J01778iiA`
- `10.5594-J01826C1`
- `10.5594-J01826iiivA`
- `10.5594-J01847C1`
- `10.5594-J01847iiA`
- `10.5594-J01869C1`
- `10.5594-J01869iiA`
- `10.5594-J01869iiiiA`
- `10.5594-J01878182184A`
- `10.5594-J01883123123A`
- `10.5594-J01883C1`
- `10.5594-J01883iiA`
- `10.5594-J01905C1`
- `10.5594-J01905IIA`
- `10.5594-J01905IIIIA`
- `10.5594-J01905IIIIB`
- `10.5594-J01952329329A`
- `10.5594-J01952C1`
- `10.5594-J01952iiA`
- `10.5594-J01961C1`
- `10.5594-J01961C2`
- `10.5594-J01961C3`
- `10.5594-J01961iiA`
- `10.5594-J01961iiiiA`
- `10.5594-J01982C1`
- `10.5594-J01982iiA`
- `10.5594-J01982iiiiA`
- `10.5594-J02003C1`
- `10.5594-J02003iiA`
- `10.5594-J02003iiiiA`
- `10.5594-J02036C1`
- `10.5594-J02036iiA`
- `10.5594-J02047C1`
- `10.5594-J02047iiA`
- `10.5594-J02047iiiiA`
- `10.5594-J020642642A`
- `10.5594-J020643643A`
- `10.5594-J02069642642A`
- `10.5594-J02069643643A`
- `10.5594-J02069C1`
- `10.5594-J02069C2`
- `10.5594-J02069iiA`
- `10.5594-J0208711A`
- `10.5594-J02087C1`
- `10.5594-J02087iiA`
- `10.5594-J02111A`
- `10.5594-J02122305305A`
- `10.5594-J02122C1`
- `10.5594-J02122iiA`
- `10.5594-J02122iiiiA`
- `10.5594-J0214211A`
- `10.5594-J02142C1`
- `10.5594-J02142C2`
- `10.5594-J02142iiA`
- `10.5594-J02167841841A`
- `10.5594-J02167C1`
- `10.5594-J02167C2`
- `10.5594-J02167iiA`
- `10.5594-J021769769A`
- `10.5594-J021841841A`
- `10.5594-J02185769769A`
- `10.5594-J02185C1`
- `10.5594-J02185C2`
- `10.5594-J02185iiA`
- `10.5594-J02201673673A`
- `10.5594-J02201C1`
- `10.5594-J02201C2`
- `10.5594-J02201iiA`
- `10.5594-J02222601601A`
- `10.5594-J02222C1`
- `10.5594-J02222iiA`
- `10.5594-J02239465465A`
- `10.5594-J02239C1`
- `10.5594-J02239iiA`
- `10.5594-J02260393393`
- `10.5594-J02260C1`
- `10.5594-J02260iiA`
- `10.5594-J022673673A`
- `10.5594-J02280321321A`
- `10.5594-J02280C1`
- `10.5594-J02280iiA`
- `10.5594-J02300225225A`
- `10.5594-J02300C1`
- `10.5594-J02300iiA`
- `10.5594-J02319C1`
- `10.5594-J02320129129A`
- `10.5594-J02320iiiiA`
- `10.5594-J02338C1`
- `10.5594-J02338iiA`
- `10.5594-J023396565A`
- `10.5594-J0235311A`
- `10.5594-J02355C1`
- `10.5594-J02355iiA`
- `10.5594-J02375937937A`
- `10.5594-J02375C1`
- `10.5594-J02375C2`
- `10.5594-J02375C3`
- `10.5594-J02375iiA`
- `10.5594-J02375iiiiA`
- `10.5594-J023937937A`
- `10.5594-J02403857857A`
- `10.5594-J02403C1`
- `10.5594-J02403iiA`
- `10.5594-J02403iiiiA`
- `10.5594-J02425777777A`
- `10.5594-J02425C1`
- `10.5594-J02425iiA`
- `10.5594-J02425iiiiA`
- `10.5594-J02447665665A`
- `10.5594-J02447C1`
- `10.5594-J02447iiA`
- `10.5594-J02447iiiiA`
- `10.5594-J02473593593A`
- `10.5594-J02473C1`
- `10.5594-J02473iiA`
- `10.5594-J02473iiiiA`
- `10.5594-J02494153153A`
- `10.5594-J02494C1`
- `10.5594-J02494iiA`
- `10.5594-J02494iiiiA`
- `10.5594-J025168989A`
- `10.5594-J02516C1`
- `10.5594-J02516iiA`
- `10.5594-J02516iiiiA`
- `10.5594-J02534969969A`
- `10.5594-J02534C1`
- `10.5594-J02534iiA`
- `10.5594-J02534iiiiA`
- `10.5594-J02563881881A`
- `10.5594-J02563C1`
- `10.5594-J02563iiA`
- `10.5594-J02563iiiiA`
- `10.5594-J02583C1`
- `10.5594-J02583iiA`
- `10.5594-J02583iiiiA`
- `10.5594-J02583iiiiiiA`
- `10.5594-J02606609609A`
- `10.5594-J02606C1`
- `10.5594-J02606C2`
- `10.5594-J02606C3`
- `10.5594-J02606iiA`
- `10.5594-J02606iiiiA`
- `10.5594-J02635729729A`
- `10.5594-J02635C1`
- `10.5594-J02635iiA`
- `10.5594-J02635iiiiA`
- `10.5594-J02659633633A`
- `10.5594-J02659C1`
- `10.5594-J02659C2`
- `10.5594-J02659C3`
- `10.5594-J02659iiA`
- `10.5594-J02659iiiiA`
- `10.5594-J026609609A`
- `10.5594-J026633633A`
- `10.5594-J02686553553A`
- `10.5594-J02686C1`
- `10.5594-J02686iiA`
- `10.5594-J02686iiiiA`
- `10.5594-J02711481481A`
- `10.5594-J02711C1`
- `10.5594-J02711iiA`
- `10.5594-J027233233A`
- `10.5594-J02733417417A`
- `10.5594-J02733C1`
- `10.5594-J02733iiA`
- `10.5594-J02733iiiiA`
- `10.5594-J02754345345A`
- `10.5594-J02754C1`
- `10.5594-J02754iiA`
- `10.5594-J02754iiiiA`
- `10.5594-J02778233233A`
- `10.5594-J02778C1`
- `10.5594-J02778C2`
- `10.5594-J02778C3`
- `10.5594-J02778iiA`
- `10.5594-J02778iiiiA`
- `10.5594-J02801161161A`
- `10.5594-J02801C1`
- `10.5594-J02801iiA`
- `10.5594-J02801iiiiA`
- `10.5594-J028219797A`
- `10.5594-J02821C1`
- `10.5594-J02821iiA`
- `10.5594-J02821iiiiA`
- `10.5594-J02844963963A`
- `10.5594-J02844C1`
- `10.5594-J02844iiA`
- `10.5594-J02844iiiiA`
- `10.5594-J028675675A`
- `10.5594-J02867803803A`
- `10.5594-J02867C1`
- `10.5594-J02867iiA`
- `10.5594-J02888675675A`
- `10.5594-J02888C1`
- `10.5594-J02888C2`
- `10.5594-J02888C3`
- `10.5594-J02888iiA`
- `10.5594-J02888iiiiA`
- `10.5594-J02911A`
- `10.5594-J02916523523A`
- `10.5594-J02916C1`
- `10.5594-J02916iiA`
- `10.5594-J02916iiiiA`
- `10.5594-J02940443443A`
- `10.5594-J02940C1`
- `10.5594-J02940iiA`
- `10.5594-J0296311A`
- … 4153 more

## DOI reconciliation — where filename and XML disagree
- agree: 5341
- xmlWins:scheme (e.g. symbolic vs ISBN form): 53
- xmlWins:year (folder year vs DOI year): 2
- xmlWins:other: 63
- xmlMissing (no DOI in any sibling XML — kept name-derived): 15632
- xmlBogus (XML DOI was a collection-level / shared placeholder — reverted to name-derived): 99

### First 50 xmlWins reconciliations
| Outcome | Name-derived docId | XML-derived docId | XML source |
|---|---|---|---|
| xmlWins:other | `10.5594-J10748b` | `10.5594-J10748158161A` | `_source/SMPTE/APTARA/DL Project Files/08182015 BACKFILE JOURNAL FRESH/smptej_79_2/10-5594_J10748b-ref.xml` |
| xmlWins:other | `10.5594-M00112` | `10.5594-M001120` | `_source/SMPTE/APTARA/DL Project Files/08092015 CONFERENCES DEPOSIT/smptem_1996_15/10-5594_M00112-ref.xml` |
| xmlWins:other | `10.5594-M00113` | `10.5594-M001130` | `_source/SMPTE/APTARA/DL Project Files/08092015 CONFERENCES DEPOSIT/smptem_1996_15/10-5594_M00113-ref.xml` |
| xmlWins:other | `10.5594-M00127` | `10.5594-M001276` | `_source/SMPTE/APTARA/DL Project Files/08092015 CONFERENCES DEPOSIT/smptem_1996_15/10-5594_M00127-ref.xml` |
| xmlWins:scheme | `SMPTE.EG10.2003` | `10.5594-S9781614820079` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/22 JUNE/eg0010-2003_stable2010-ref.xml` |
| xmlWins:scheme | `SMPTE.EG15.2005` | `10.5594-S9781614820116` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/22 JUNE/eg0015-2005_stable2010-ref.xml` |
| xmlWins:other | `SMPTE.EG16.2014` | `SMPTE.SMPTEEG16.2014` | `_source/SMPTE/APTARA/DL Project Files/08242015 STANDARDS REVISED DEPOSIT/smptes_eg-16-2014_1/eg0016-2014.xml` |
| xmlWins:scheme | `SMPTE.EG17.2002` | `10.5594-S9781614820130` | `_source/SMPTE/APTARA/DL Project Files/05252015 MANUAL REFERENCE SAMPLES/smptes_eg-17-2002_1/eg0017-2002_stable2009-ref.xml` |
| xmlWins:scheme | `SMPTE.EG20.1997` | `10.5594-S9781614820147` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/22 JUNE/eg0020-1997_stable2010-ref.xml` |
| xmlWins:scheme | `SMPTE.EG2021-3.2009` | `10.5594-S9781614820413` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/eg2021-3-2009-ref.xml` |
| xmlWins:scheme | `SMPTE.EG2021-4.2012` | `10.5594-S9781614826880` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/26 JUNE/eg2021-4-2012-ref.xml` |
| xmlWins:scheme | `SMPTE.EG25.2003` | `10.5594-S9781614820192` | `_source/SMPTE/APTARA/DL Project Files/05252015 MANUAL REFERENCE SAMPLES/smptes_eg-25-2003_1/eg0025-2003_stable2009-ref.xml` |
| xmlWins:scheme | `SMPTE.EG27.2004` | `10.5594-S9781614820215` | `_source/SMPTE/APTARA/DL Project Files/05252015 MANUAL REFERENCE SAMPLES/smptes_eg-27-2004_1/eg0027-2004_stable2010-ref.xml` |
| xmlWins:year | `SMPTE.EG43.2004` | `SMPTE.EG43.2009` | `_source/SMPTE/APTARA/DL Project Files/08242015 STANDARDS REVISED DEPOSIT/smptes_eg-43-2004_1/eg0043-2009.xml` |
| xmlWins:scheme | `SMPTE.EG7.1994` | `10.5594-S9781614820048` | `_source/SMPTE/APTARA/DL Project Files/05252015 MANUAL REFERENCE SAMPLES/smptes_eg-7-1994_1/eg0007-1994_stable2004-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD1.2003` | `10.5594-S9781614820468` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0001-2003-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD14.2010` | `10.5594-S9781614820567` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0014-2010-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD15.2007` | `10.5594-S9781614820574` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0015-2007-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD16.2008` | `10.5594-S9781614820581` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0016-2008-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD17.2009` | `10.5594-S9781614820598` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0017-2009-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD18.2010` | `10.5594-S9781614820604` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0018-2010-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD2.2007` | `10.5594-S9781614820475` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0002-2007-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD20.2010` | `10.5594-S9781614820628` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0020-2010-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD25.2014` | `10.5594-S9781614827962` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd25-2014-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD26.2014` | `10.5594-S9781614828006` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd26-2014-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD28.2014` | `10.5594-S9781614828143` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd28-2014-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD3.2008` | `10.5594-S9781614820482` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0003-2008-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD30.2014` | `10.5594-S9781614828303` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd30-2014-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD31.2014` | `10.5594-S9781614828310` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd31-2014-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD32.2014` | `10.5594-S9781614828365` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd32-2014-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD4.2005` | `10.5594-S9781614820499` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0004-2005-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD5.2006` | `10.5594-S9781614820505` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0005-2006-ref.xml` |
| xmlWins:scheme | `SMPTE.RDD9.2006` | `10.5594-S9781614820536` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rdd0009-2006-ref.xml` |
| xmlWins:scheme | `SMPTE.RP16.1993` | `10.5594-S9781614820697` | `_source/SMPTE/APTARA/DL Project Files/05252015 MANUAL REFERENCE SAMPLES/smptes_rp-16-1993_1/rp0016-1993_stable2010-ref.xml` |
| xmlWins:other | `SMPTE.RP163.1992` | `SMPTE.RP163-1992` | `_source/SMPTE/APTARA/DL Project Files/08252015 STANDARDS REVISED DEPOSIT/smptes_rp-163-1992_1/rp0163-1992_stable2003.xml` |
| xmlWins:other | `SMPTE.RP168.2002` | `SMPTE.RP168-2009` | `_source/SMPTE/APTARA/DL Project Files/08262015 STANDARDS REVISED DEPOSIT/smptes_rp-168-2002_1/rp0168-2009.xml` |
| xmlWins:other | `SMPTE.RP170.1993` | `SMPTE.RP170-1993` | `_source/SMPTE/APTARA/DL Project Files/08252015 STANDARDS REVISED DEPOSIT/smptes_rp-170-1993_1/rp0170-1993_stable2003.xml` |
| xmlWins:other | `SMPTE.RP171.1993` | `SMPTE.RP171-1993` | `_source/SMPTE/APTARA/DL Project Files/08252015 STANDARDS REVISED DEPOSIT/smptes_rp-171-1993_1/rp0171-1993_stable2003.xml` |
| xmlWins:other | `SMPTE.RP172.1993` | `SMPTE.RP172-1993` | `_source/SMPTE/APTARA/DL Project Files/08252015 STANDARDS REVISED DEPOSIT/smptes_rp-172-1993_1/rp0172-1993_stable2003.xml` |
| xmlWins:scheme | `SMPTE.RP19.2003` | `10.5594-S9781614820727` | `_source/SMPTE/APTARA/DL Project Files/05252015 MANUAL REFERENCE SAMPLES/smptes_rp-19-2003_1/rp0019-2003_stable2008-ref.xml` |
| xmlWins:other | `SMPTE.RP191.1996` | `SMPTE.RP191-1996` | `_source/SMPTE/APTARA/DL Project Files/08262015 STANDARDS REVISED DEPOSIT/smptes_rp-191-1996_1/rp0191-1996_stable2003.xml` |
| xmlWins:scheme | `SMPTE.RP20.2003` | `10.5594-S9781614820734` | `_source/SMPTE/APTARA/DL Project Files/05252015 MANUAL REFERENCE SAMPLES/smptes_rp-20-2003_1/rp0020-2003_stable2010-ref.xml` |
| xmlWins:scheme | `SMPTE.RP2021-9.2009` | `10.5594-S9781614822509` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/25 JUNE/rp2021-9-2009-ref.xml` |
| xmlWins:scheme | `SMPTE.RP2021-9.2012` | `10.5594-S9781614826958` | `_source/SMPTE/APTARA/DL Project Files/06302015 INITIAL LEGACY CONVERSION BATCH FOR STANDARDS/26 JUNE/rp2021-9-2012-ref.xml` |
| xmlWins:other | `SMPTE.RP2052-10.2012Am1` | `SMPTE.RP2052-10.2010-A1` | `_source/SMPTE/APTARA/DL Project Files/08262015 STANDARDS REVISED DEPOSIT/smptes_rp-2052-10-2010-a1_1/rp2052-10-A1-2012.xml` |
| xmlWins:other | `SMPTE.RP2057.2013Am1` | `SMPTE.RP2057.2011Am1.2013` | `_source/SMPTE/APTARA/DL Project Files/08262015 STANDARDS REVISED DEPOSIT/smptes_rp-2057-2011-am1-2013_1/rp2057-Am1-2013.xml` |
| xmlWins:other | `SMPTE.RP2092-1.2017Am1` | `SMPTE.RP2092-1.2015Am1.2017` | `_source/SMPTE/APTARA/METADATA and PDFs ALL CONTENT/Standard/rp2092-1-Am1-2017/rp2092-1-Am1-2017.xml` |
| xmlWins:other | `SMPTE.RP210-10.2007` | `SMPTE.RP210.10.2007` | `_source/SMPTE/APTARA/DL Project Files/08262015 STANDARDS REVISED DEPOSIT/smptes_rp-210-10-2007_1/rp0210-10-2007.xml` |
| xmlWins:other | `SMPTE.RP210-13.2012` | `SMPTE.RP210v13.2012` | `_source/SMPTE/APTARA/DL Project Files/11122015 BACKFILES STANDARDS REVISED/smptes_rp-210v13-2012_1/rp0210v13-2012.xml` |
| xmlWins:year | `SMPTE.RP218.2002` | `SMPTE.RP218.2009` | `_source/SMPTE/APTARA/DL Project Files/08262015 STANDARDS REVISED DEPOSIT/smptes_rp-218-2002_1/rp0218-2009.xml` |

## Field conflicts — XML vs filename / year drift (20090 — details in JSON)
- `year`: 20087
- `docType`: 3

## Unidentifiable (8 — details in JSON)
