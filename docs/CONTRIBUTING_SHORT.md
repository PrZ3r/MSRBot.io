# Quick Contributor Guide — Media Standards Registry (MSR)

Before you open a pull request (PR), please review this quick checklist.  

For the full contributor guide, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Branch & Workflow
- **Branch name:** use `feature/<topic>`, `issues/<topic>`, `fix/<topic>`, `chore/<topic>`, `hotfix/<topic>`, or `release/<topic>` (as context dictates).
- **Base branch:** always `main`.
- Keep branches focused; avoid mixing unrelated changes.
- PRs should not be bloated, too many changes at one time require extra review.

## Local Checks
Run the following before opening a PR:

```bash
npm run validate
npm run canonicalize
npm run build
npm run build-msi
npm run build-mri
npm run validate-url
npm run build
npm run local-server
```

Using a browser, open http://127.0.0.1:8080/ after starting the http-server to inspect the local built pages.

> These commands ensure your changes don’t break MSR’s automated workflows or data chain. The last commands build the site locally and initiates a local server to render the client side pages. 

---

## Source of Truth vs Generated Files

The document registry source of truth is the per-doc files under `src/main/data/docs/`
(one JSON file per document, sharded by `{publisher}/{docType}/`; title-identified
docTypes such as journal articles add a `{year}/` level). Edit those files directly, or
scaffold a new one with `npm run new-doc`.

A file's path is derived from its own `publisher`, `docType`, `docId` (and
`publicationDate`) — if you change any of those, run `npm run canonicalize` and it
re-homes the file to the correct shard and prunes any emptied folder. `npm run validate`
fails if a file is not at its derived path.

The following are built automatically — **do not edit**:

- The assembled `documents.json` monolith, registry slices, and per-docId API (all under `build/`)
- All reports under `src/main/reports/`

Changes to generated files must come from running the proper workflows or scripts, not manual edits.

## Schema Compliance
If you modify metadata or structure, validate against the appropriate schema:
- such as `src/main/schemas/documents.schema.json`

Each field must include correct `$meta` provenance tracking where applicable:
- `source`
- `confidence`
- `updated`
- `overridden`

> The `npm run canonicalize` will auto fill this info for you as a "manual" edit. 

## Pull Request Checklist
- [ ] Update `CHANGELOG.md` under **[Unreleased]** when behavior, workflow, or policy changes.
- [ ] Clear, descriptive title.
- [ ] Summary of what changed and why.
- [ ] References the relevant workflow(s) or scripts.
- [ ] Includes test data or validation steps if relevant.
- [ ] Avoids triggering unnecessary workflow runs (keep commits lean).

## Best Practices
- Use small, targeted PRs for reviewability.
- Prefer descriptive commit messages (e.g., *“Fix URL normalizer mismatch for SMPTE”*).
- Reference related issues with `Closes #<issue>` in PR body.
- Use `npm run extract` for data auto refreshes instead of editing JSON manually, when appropriate.

## CI Behavior
All automation workflows (Extract, MSI, MRI, MSR, URL Validate) run on:
- Weekly cron schedules
- Push to `main`
- Manual dispatch

Only automation workflows should modify report files — human PRs should focus on logic, schema, or documentation changes.

## Need Help?
If you’re unsure where a change belongs, open a [discussion or issue](https://github.com/PrZ3r/MSRBot.io/issues) before submitting a PR.

Thanks for helping keep the registry consistent, accurate, and automated!
