## Automated Workflow Chain (With Samples)

[MSRBot.io](https://msrbot.io/) automation operates as a linked chain—from document extraction to site build and URL validation.  
Each stage runs on a scheduled cron and triggers follow-ups automatically after merges or upstream data changes.

---

### Schedule Overview
Most core workflows execute on a weekly cron, with triggered rebuilds after PR merges or manual dispatch. **`Validate Document URLs` runs biweekly** (1st + 15th of each month) — the corpus passed ~26k docs and each sweep takes 90+ minutes.

---

### 1. Extract Documents
_Crawls defined URL maps to parse and populate data (currently only SMPTE). Creates a PR if changes are found._

**Workflow:** [Extract Documents - SMPTE](https://github.com/PrZ3r/MSRBot.io/actions/workflows/extract-docs-smpte.yml)  
**Sample Run:** [Run #18390426360](https://github.com/PrZ3r/MSRBot.io/actions/runs/18390426360/job/52399243873)

**Dataset:**  
- [`src/main/data/docs/`](https://github.com/PrZ3r/MSRBot.io/tree/main/src/main/data/docs)  
- [`src/main/reports/masterSuiteIndex.json`](https://github.com/PrZ3r/MSRBot.io/blob/main/src/main/reports/masterSuiteIndex.json)

**Reports (as needed):**  
- [`src/main/reports/mri/`](https://github.com/PrZ3r/MSRBot.io/tree/main/src/main/reports/mri)

**Sample PR:** - [Update documents.json (20251010-193337) (#520)](https://github.com/PrZ3r/MSRBot.io/pull/520)  

>  **Trigger:** weekly schedule or manual dispatch

---

### 2. Build MasterSuite Index (MSI)
_Builds a master lineage of documents, mapping each family, suite, and amendment relationship. Rebuilt inside every data PR (committed back to the PR branch); `UNKEYED` issues are synced after merge._

**Workflow:** [Build MSI + MRI (PR)](https://github.com/PrZ3r/MSRBot.io/actions/workflows/build-reports-pr.yml) · issues: [Sync MSI/MRI issues](https://github.com/PrZ3r/MSRBot.io/actions/workflows/sync-report-issues.yml)  

**Dataset:** [`src/main/data/docs/`](https://github.com/PrZ3r/MSRBot.io/tree/main/src/main/data/docs)  
**Reports:**  
- [`src/main/reports/masterSuiteIndex.json`](https://github.com/PrZ3r/MSRBot.io/blob/main/src/main/reports/masterSuiteIndex.json)

**Sample Issue:** [UNKEYED: x509-sg.2000 (#469)](https://github.com/PrZ3r/MSRBot.io/issues/469)

> **Trigger:** PRs that touch data/input/config/lib or the MSI/MRI scripts (incl. extract PRs), or manual dispatch

---

### 3. Build MasterReference Index (MRI)
_Builds a master reference map and determines whether referenced documents are present in the dataset. Rebuilt in the same PR-time job as MSI, right after it; `MISSING REF` issues are synced after merge._

**Workflow:** [Build MSI + MRI (PR)](https://github.com/PrZ3r/MSRBot.io/actions/workflows/build-reports-pr.yml) · issues: [Sync MSI/MRI issues](https://github.com/PrZ3r/MSRBot.io/actions/workflows/sync-report-issues.yml)  

**Dataset:** [`src/main/data/docs/`](https://github.com/PrZ3r/MSRBot.io/tree/main/src/main/data/docs)

**Reports:**  
- [`src/main/reports/mri/`](https://github.com/PrZ3r/MSRBot.io/tree/main/src/main/reports/mri)  
- [`src/main/reports/mri_presence_audit.json`](https://github.com/PrZ3r/MSRBot.io/blob/main/src/main/reports/mri_presence_audit.json) (generated to resolve issues)

**Sample Issue:** [MISSING REF: W3C.xml-names.20091208 (#467)](https://github.com/PrZ3r/MSRBot.io/issues/467)

> **Trigger:** same job as MSI (runs right after it)

---

### 4. Build MSR Site and Test
_Builds the front-end site from data and publishes to GitHub Pages._

**Workflow:** [Build MSR](https://github.com/PrZ3r/MSRBot.io/actions/workflows/build-msr-site.yml)  
**Sample Run:** [Run #18388295172](https://github.com/PrZ3r/MSRBot.io/actions/runs/18388295172) → [Publish to GH Pages](https://github.com/PrZ3r/MSRBot.io/actions/runs/18388308918)

**Dataset:**  
- [`src/main/data/docs/`](https://github.com/PrZ3r/MSRBot.io/tree/main/src/main/data/docs)  
- [`src/main/reports/masterSuiteIndex.json`](https://github.com/PrZ3r/MSRBot.io/blob/main/src/main/reports/masterSuiteIndex.json)  
- [`src/main/reports/mri/`](https://github.com/PrZ3r/MSRBot.io/tree/main/src/main/reports/mri)

**Build Output:** [msrbot.io](https://msrbot.io/)

> **Trigger:** completion of Build MRI

---

### 5. Validate Document URLs
_Validates and normalizes URLs in the dataset. Creates PRs and manages issues as needed._

**Workflow:** [Validate URLs](https://github.com/PrZ3r/MSRBot.io/actions/workflows/validate-urls.yml)  
**Sample Run:** [Run #18388310278](https://github.com/PrZ3r/MSRBot.io/actions/runs/18388310278)

**Reports:**  
- [`src/main/reports/url_validate_audit.json`](https://github.com/PrZ3r/MSRBot.io/blob/main/src/main/reports/url_validate_audit.json)  
- [`src/main/reports/url_validate_normalize.json`](https://github.com/PrZ3r/MSRBot.io/blob/main/src/main/reports/url_validate_normalize.json) (generated to resolve issues)

**Sample PR:** [URL Backfill resolved for X entries (#491)](https://github.com/PrZ3r/MSRBot.io/pull/491)  
**Sample Issues:**  
- [URL ERROR (400): T-REC-H.264.202108 (#501)](https://github.com/PrZ3r/MSRBot.io/issues/501)  
- [URL ERROR (404): ISDCF (#496)](https://github.com/PrZ3r/MSRBot.io/issues/496)

> **Trigger:** completion of Build MSR

---

---

### 6. PR Build Preview (MSR site)
_Build preview of MSR site during PR creation, prior to publication to manually check rendering._

**Workflow:** [Build Preview](https://github.com/PrZ3r/MSRBot.io/actions/workflows/pr-build-preview.yml)  
**Sample Run:** [Run #18398206332](https://github.com/PrZ3r/MSRBot.io/actions/runs/18398206332)

**Sample PRs:** 
- [Fix 404 - ITUR (#514)](https://github.com/PrZ3r/MSRBot.io/pull/514)  
- [Update documents.json (20251010-193337) (#520)](https://github.com/PrZ3r/MSRBot.io/pull/520)  

> **Trigger:** creation of PR with changes to `src/main/data/docs/` or site rendering. 

---

### Summary
- Fully autonomous workflow chain:  
  Extract → MSI → MRI → MSR → URL Validate  
- Each stage runs independently but triggers the next when changes are detected and generates auditable JSON reports.  
- PRs are opened only when data changes; metadata and validation commits go directly to `main`. 
- PR generate MSR preview links when appropriate; when closed and/or merged, self cleans to remove stale preview links and branches. 
- Permanent artifacts reports are stored in `src/main/reports`.  
- All runs are concurrency-protected, idempotent, and self-healing.

---

### Dependencies
- Node.js 20+ (LTS)  
- GitHub Actions with `contents`, `issues`, and `pull-requests` write permissions  
- Access to HTML/PDF publication URLs
