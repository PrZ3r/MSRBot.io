# Pull Request — MSRBot.io

> Before submitting, please review the [Quick Contributor Guide](../docs/CONTRIBUTING_SHORT.md).

## Summary
Briefly describe what this PR does.

- What changed?
- Why was it needed?
- Which workflows/scripts does it affect?

## Type of Change
Select all that apply:
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / internal improvement
- [ ] Documentation update
- [ ] Workflow / CI update
- [ ] Data or metadata update (auto-generated)

## Validation
Tick what you ran; strike out or note anything that doesn't apply.

- [ ] `npm test`
- [ ] `npm run validate` (and `npm run canonicalize` if data changed)
- [ ] `npm run build` — local site build
- [ ] Data changes only: edited the per-doc files under `src/main/data/docs/{publisher}/{docType}/[{year}/]{docId}.json`, never the assembled `documents.json`
- [ ] Reference / MRI changes: `npm run validate-mri-coverage`
- [ ] URL changes: `npm run validate-url`

**MSI and MRI are rebuilt for you.** `Build MSI + MRI (PR)` runs on any PR touching `src/main/data/`, `src/main/input/`, `src/main/config/`, `src/main/lib/` or the MSI/MRI scripts. It merges the latest `main` in, rebuilds, commits `chore(reports): rebuild MSI/MRI` to this branch, and posts an **MSI / MRI** summary into this description. So:

- Don't hand-edit `src/main/reports/` — let the rebuild own it.
- **`git pull` before your next push**, or you'll hit a non-fast-forward.
- Running `npm run build-msi` / `npm run build-mri` locally is optional (useful to see the delta before pushing).

## Notes / Screenshots
Include any relevant log snippets or before/after examples.

- **Data files changed?** Say so explicitly, and whether a `--apply` step is pending, applied, or not needed.
- **Reference / refMap mapping changes:** include at least one concrete before/after example.

## Related Issues
Closes #<issue_number>  
References #<issue_number>
