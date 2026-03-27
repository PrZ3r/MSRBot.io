# AGENTS.md

## Branch naming
Use context-appropriate branch prefixes:

- `chore/`
- `issues/`
- `feature/`
- `fix/`
- `hotfix/`
- `release/`

Choose the prefix that best matches the work being done.

## Git safety preflight
Before any `git commit` or `git push`:

- Run `git branch --show-current` and `git status --short`.
- If the current branch is `main` or `master`, stop and ask for explicit user confirmation before proceeding.
- Default to creating/switching to a topic branch (`chore/`, `fix/`, `feature/`, etc.) before making commits.
- Do not push directly to protected/default branches unless the user explicitly asks for it.

## Issue and PR tags
When creating an issue or pull request:

- Add tags/labels that already exist in the repository/project.
- Do **not** invent new tags/labels.
- Choose tags/labels that fit the context of the work.
- Include a tag/label that identifies the creating entity when available (for example: `codex`, `cursor`, `claude`, etc.).

## Issue and PR templates
When creating an issue or pull request:

- Always use the repository’s existing issue and pull request templates.
- Do not bypass templates unless the task explicitly requires a non-template format.

## PR hygiene (recommended)
- Keep PRs focused and small when possible.
- In PR descriptions, include: **what changed**, **why**, and **how it was validated**.
- If data files are changed, call that out explicitly.

## Validation expectations by change type
- **Docs-only changes**: sanity-check formatting and links where practical.
- **Data changes** (for example `src/main/data/*.json`): run `npm run validate` and `npm run canonicalize`.
- **URL/normalization changes**: run `npm run validate-url` and, when appropriate, `npm run normalize-url`.
- **Build/output-affecting changes**: run `npm run build` (or the smallest relevant build script).

## Repo-specific guardrails
- Prefer editing source inputs over generated outputs unless the task explicitly asks for generated artifacts.
- Do not add new dependencies unless they are necessary and justified in the PR description.
- Avoid unrelated refactors in the same PR.

## Engineering defaults
- Prefer vanilla JavaScript and existing Bootstrap patterns already used in this repository.
- Do not introduce new frontend frameworks or CSS systems unless explicitly requested.
- Preserve existing template structure and visual language when editing UI files.
- For extraction/reference parser work: enforce section boundaries first, then parse items inside those bounds.
- Prefer `refMap` mappings for isolated citation fixes; only add parser-level special-cases when broadly justified.
- For extraction/data-only changes, avoid running full-site builds unless explicitly requested.
- For reference/data mapping changes, include at least one concrete before/after example in the PR description.

## DocId conventions
- Keep date/version suffixes at the end of `docId` when present.
- Use repository DOI normalization conventions for DOI-based IDs.
- For provisional external identifiers (for example Semantic Scholar corpus IDs), use clear source-prefixed IDs and replace with canonical IDs later when available.

## Release hygiene
- Before creating a release tag, run a final data sweep: `npm run validate` and `npm run canonicalize`.
- When bumping a release version, update `CHANGELOG.md` and keep `package.json` + `package-lock.json` versions in sync.

## Changelog, documentation, and provenance
- If behavior, workflow, policy, or contributor expectations change, update `CHANGELOG.md` in **[Unreleased]**.
- Update supporting documentation (for example `README.md`, `CONTRIBUTING.md`, or `docs/`) when contributor behavior or project workflows are affected.
- For data/model edits, preserve and/or update provenance-related metadata and explain provenance impacts in the PR description.

## Cursor Cloud specific instructions

This is a Node.js static-site-generator project with no backend, no Docker, and no databases. All data lives as committed JSON files.

**Runtime:** Node.js 22+ and npm are pre-installed. Dependencies are installed by the update script (`npm install`).

**Key commands** are documented in `README.md` and `docs/commands.md`. The most common ones:

| Task | Command |
|------|---------|
| Validate data | `npm run validate` |
| Canonicalize JSON | `npm run canonicalize` |
| Build static site | `npm run build` |
| Preview site | `npm run local-server` (serves `build/` on port 8080) |

**Build before preview:** `npm run build` must complete before `npm run local-server` will serve anything useful. The build takes ~70 seconds and emits non-fatal `[WARN:getStatus]` messages for referenced RFCs not yet in the registry — these are expected and safe to ignore.

**No linter configured:** The project does not have ESLint or any JS linter. Validation is done via `npm run validate` (JSON schema + registry checks).

**Extraction scripts require network:** `npm run extract-smpte` and `npm run extract-ietf` fetch live data and will fail without internet access. All other commands work fully offline with committed data.
