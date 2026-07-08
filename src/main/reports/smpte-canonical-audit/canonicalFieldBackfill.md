# Canonical field backfill — passes 1-3

> Generated: 2026-07-08T23:52:57.741Z
> Mode: **APPLY**

| pass | field | changes |
|---|---|---:|
| 0 | publicationDate year (5 approved digit-error fixes) | 0 |
| 1 | publicationDate month (Jan-1 placeholder → canonical month) | 0 |
| 2 | journalTitle (era-accurate, journal-kind) | 0 |
| 3a | abstract (canonical-only fill) | 0 |
| 3b | keywords (canonical-only — REPORT ONLY, pending vocab decision) | 240 |
| 4 | authors (same-count name fixes; written under --apply-authors) | 0 |

## Samples (first 25 per pass)

### keywords

| docId | old | new |
|---|---|---|
| `10.5594-M001020` | "" | ["Metadata"] |
| `10.5594-M001047` | "" | ["MXF"] |
| `10.5594-M00105` | "" | ["HDTV","Compression","Edit","MPEG"] |
| `10.5594-M001052` | "" | ["MXF","IMF"] |
| `10.5594-M001053` | "" | ["LTFS","Tape","Storage","AXF","LTO"] |
| `10.5594-M001054` | "" | ["Virtualization"] |
| `10.5594-M001055` | "" | ["Stereoscopic"] |
| `10.5594-M001056` | "" | ["LCD","OLED"] |
| `10.5594-M001057` | "" | ["Color Management"] |
| `10.5594-M001058` | "" | ["File-Based Workflow","Automation"] |
| `10.5594-M001059` | "" | ["File-Based Workflow","Edit","Archive"] |
| `10.5594-M001060` | "" | ["OLED","LCD"] |
| `10.5594-M001062` | "" | ["Stereoscopic"] |
| `10.5594-M001063` | "" | ["Workflow","Media Asset Management"] |
| `10.5594-M001064` | "" | ["UMID","MXF","AAF"] |
| `10.5594-M001065` | "" | ["File-Based Workflow"] |
| `10.5594-M001068` | "" | ["Image Processing"] |
| `10.5594-M001070` | "" | ["SDI","2K","4K","UHDTV"] |
| `10.5594-M001071` | "" | ["SDI","Stereoscopic","2K","4K","Standards"] |
| `10.5594-M001072` | "" | ["Audio","B-Chain","Measurement"] |
| `10.5594-M001073` | "" | ["Color","HDR","Time & Sync","Alignment","Stereoscopic"] |
| `10.5594-M001074` | "" | ["DCinema"] |
| `10.5594-M001075` | "" | ["Post Production"] |
| `10.5594-M001078` | "" | ["UHDTV","Colorimetry","HFR","Super Hi-Vision"] |
| `10.5594-M001079` | "" | ["Super Hi-Vision"] |
