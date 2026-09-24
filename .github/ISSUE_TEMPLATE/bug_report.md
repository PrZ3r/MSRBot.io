---
name:  "Bug Report"
about: Use this to report a problem with the site, data, or automation
title: "[BUG] {Insert your title here}"
labels: ["bug"]
assignees: ["SteveLLamb"]
---

## Describe the bug
A clear and concise description of what happened.

## Where
- [ ] Site / page rendering ([msrbot.io](https://msrbot.io/))
- [ ] Registry data (a document, group, project or portal record)
- [ ] Reports (MSI / MRI / presence audit / URL audit)
- [ ] Automation (a GitHub Actions workflow)
- [ ] Local tooling (an `npm run …` script)

If it's a document or reference, give the `docId` / `refId`. If it's automation, name the workflow (for example `Build MSRBot.io Site and Test`, `Build MSI + MRI (PR)`, `Sync MSI/MRI issues`, `Refresh open data PRs`, `Validate Document URLs`, `Extract Documents - SMPTE` / `- IETF`) and link the run.

## Expected behavior
What should have happened?

## Steps to reproduce
1. Run `...` (script or workflow)
2. See error `...`

## Logs or Screenshots
Attach logs, console output, or screenshots if applicable. For a failed workflow, the failing step's log is the useful part.
