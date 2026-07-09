# SMPTE canonical-library import — summary

> Generated: 2026-07-07T23:57:42.349Z
> Library entry: `/Users/llambs/LLux Operon Dropbox/Steve LLamb/Documents/DCin/Repos/SMPTE/smpte-journal-library/src/library/js/importLibrary.mjs`

## Per-corpus results

| corpus | articles | errors/warnings | seconds | output |
|---|---:|---:|---:|---|
| journal | 24173 | 11 | 25.3 | `src/main/reports/smpte-canonical-audit/canonicalLibrary.journal.json` |
| conference | 1999 | 1 | 2.5 | `src/main/reports/smpte-canonical-audit/canonicalLibrary.conference.json` |

## First 20 errors/warnings

- `journal` **error**: Error at /Users/llambs/LLux Operon Dropbox/Steve LLamb/Documents/DCin/Repos/PrZ3r/MSRBot.io/_source/SMPTE/Journal Article Repository/2024/SMPTENOVDEC2024JOURNAL_19/035-ISOTCMIJ-NovDec2024-HR-19.xml: Error: Unknown enum value info-author
- `journal` **error**: Error at /Users/llambs/LLux Operon Dropbox/Steve LLamb/Documents/DCin/Repos/PrZ3r/MSRBot.io/_source/SMPTE/Journal Article Repository/2023/7261654/10196059/10196064.xml: Article Front Cover with number 1 already exists in issue 7
- `journal` **warn**: Article 8807401 has duplicate author Thomas Edwards
- `journal` **warn**: Article 8807401 has duplicate author Marc Zorn
- `journal` **warn**: Article 8807401 has duplicate author Ben Waggoner
- `journal` **warn**: Article 8807401 has duplicate author Eric Gsell
- `journal` **error**: Error at /Users/llambs/LLux Operon Dropbox/Steve LLamb/Documents/DCin/Repos/PrZ3r/MSRBot.io/_source/SMPTE/Journal Article Repository/2018/7261654/8395464/08395469.xml: Path //publication/volume/volumeinfo/issue/issuenum does not exist
- `journal` **warn**: Article 7263907 has duplicate author Pierre Mertz
- `journal` **warn**: Article 7263968 has duplicate author F. P. Brackett
- `journal` **warn**: Article 7262773 has duplicate author Pierre Mertz
- `journal` **warn**: Article 7262356 has duplicate author Pierre Mertz
- `conference` **warn**: Article 7819618 has duplicate author Jennifer Zeidan

## Notes

- The `<article>` NLM-shape files (2024+ post-IEEE dupes) are deliberately skipped by the importer.
- Article-level fields captured: number, title, doi, abstract, contentType, pubDate, authors[], keywords[], mainPath, isOpenAccess.
- Structural fields (Periodical→Volume→Issue→Article for journal; Conference→Article for conference) preserved in the dump.
