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
npm test                      # registry, mriStore, referencing.flush, syncIssues
npm run validate              # all 4 registries against their schemas
npm run canonicalize          # only needed if you changed data
npm run build                 # full site build into build/
npm run local-server          # serves build/ on :8080
```

Using a browser, open http://127.0.0.1:8080/ after starting the http-server to inspect the local built pages.

Depending on what you touched:

```bash
npm run validate-mri-coverage   # reference / MRI changes
npm run validate-url            # URL or link changes
npm run build-msi               # optional: see the MSI delta before pushing
npm run build-mri               # optional: see the MRI delta before pushing
```

> These commands ensure your changes don’t break MSR’s automated workflows or data chain. `build-msi` / `build-mri` are optional locally — CI rebuilds both inside your PR (see **CI Behavior**). 

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
What runs when:

| Workflow | Trigger |
|:--|:--|
| `Extract Documents - SMPTE` / `- IETF` | Weekly cron (Mon / Tue) + manual |
| `Build MSI + MRI (PR)` | PRs touching data / input / config / `src/main/lib/` / the MSI-MRI scripts + manual |
| `Refresh open data PRs` | Push to `main` that changes data or reports (merges `main` into other open data PRs; builds nothing) |
| `Sync MSI/MRI issues` | Push to `main` that changes MSI or the presence audit, weekly (Wed), + manual |
| `Build MSRBot.io Site and Test` | Push to `main` + manual |
| `PR Build Preview (MSRBot.io site)` | PRs touching the site, templates, config, lib, data or reports |
| `Validate Document URLs` | Cron (1st + 15th, throttled to a 14-day window) + manual |

### Branch or fork?

**Fork PRs run the full checks.** Checkout, `npm run canonicalize` (sanity), `npm run validate`, `npm test` and a complete site build need no secrets, so a fork PR gets the same pass/fail as a branch PR, and the MSI/MRI job rebuilds both reports and shows any drift in its job summary.

**What a fork PR can't do** is anything that writes, because GitHub gives fork PRs a read-only token and no secrets — which "approve and run" does not change on a public repo:

| | Branch in this repo | Fork PR |
|:--|:--|:--|
| Validate / tests / site build | ✅ | ✅ |
| MSI + MRI rebuilt and drift reported | ✅ | ✅ (summary only) |
| Reports committed to the PR branch | ✅ | ❌ — Actions can't push to a fork |
| Preview deployed to `msrbot.io/pr/<N>/` | ✅ | ❌ — no secrets to publish with |

So **data changes are best made from a branch**, since the rebuilt reports need to land in the PR. For a fork PR, a maintainer can push the same commits to a branch here to get a preview and the report commit, or the reports get rebuilt after merge.

### Getting from a fork to a branch

| | New / occasional contributor | Regular contributor |
|:--|:--|:--|
| How | Fork PR | Branch in this repo (needs write access) |
| First PR | A maintainer clicks **Approve and run** once — GitHub asks for first-time contributors only, not every time | No approval step |
| Checks | Full: canonicalize sanity, `validate`, `npm test`, site build, MSI/MRI drift summary | Same, plus the preview and the report commit |
| Preview URL | — | `msrbot.io/pr/<N>/` |

Contribute a few PRs from a fork and you'll be invited as a collaborator, which drops the approval step and gives you previews and automatic report commits. Nothing is gatekept beyond that: fork PRs are reviewed and merged on their merits.

_Why the approval step exists at all:_ a fork PR's run gets no secrets and a read-only token, so it can't touch the site or the registry. The click is about the runner, not credentials — `npm ci` executes lifecycle scripts from the PR's own `package.json`, and each push costs a few minutes of build time.

MSI and MRI are rebuilt **inside your PR**: when a PR touches data, input, config, `src/main/lib/`, or the MSI/MRI scripts, `Build MSI + MRI (PR)` commits the refreshed reports (`chore(reports): rebuild MSI/MRI`) back to the PR branch, first merging the latest `main` in (report-only conflicts are resolved automatically; data conflicts are left to you), and keeps an **MSI / MRI** summary section in the PR body up to date. **Pull before pushing again** (`git pull`). When another data PR merges, open data PRs are refreshed from `main` automatically. After merge, `Sync MSI/MRI issues` opens/closes the `UNKEYED` and `MISSING REF` issues from the merged reports.

The site is published to `gh-pages` as a **single commit with no history** (`src/main/scripts/ci/publishGhPages.sh`). To roll back the live site, re-run **Build MSRBot.io Site and Test** on an earlier `main` commit, or revert the change on `main`.

Only automation workflows should modify report files — human PRs should focus on logic, schema, or documentation changes.

## Need Help?
If you’re unsure where a change belongs, open a [discussion or issue](https://github.com/PrZ3r/MSRBot.io/issues) before submitting a PR.

Thanks for helping keep the registry consistent, accurate, and automated!
