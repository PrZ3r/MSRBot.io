# MSRBot research

This folder helps AI assistants answer media-standards questions **with MSRBot.io as the verified source of truth**. The assistant looks each fact up in MSRBot instead of answering from memory, cites the record it used, flags superseded editions, and says "Not found in MSRBot" rather than guessing.

| What | For |
| --- | --- |
| [`skills/msrbot-research/`](skills/msrbot-research/) | The **skill**, for Claude (Claude Code, claude.ai, Claude Desktop). It includes a small read-only helper script (`scripts/msrbot.py`, Python standard library only). |
| [`prompt.md`](prompt.md) | The same rules as a **copy-paste prompt**, for ChatGPT, Gemini, Copilot or any other AI tool. |
| [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) | Makes this folder a Claude Code plugin; it's listed in the repo's marketplace ([`/.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json)). |

## Install

### Claude Code

```text
/plugin marketplace add PrZ3r/MSRBot.io
/plugin install msrbot-research@msrbot
```

To update later, run `/plugin marketplace update msrbot`. Alternatively, copy `skills/msrbot-research/` into `~/.claude/skills/` (just for you) or into a project's `.claude/skills/` (everyone working in that project).

### claude.ai / Claude Desktop, for yourself

1. Download the skill as a zip, with `msrbot-research/` as the top-level folder:
   ```bash
   cd research/skills && zip -r msrbot-research.zip msrbot-research
   ```
2. In Claude, open **Settings** and upload it where skills are managed. See Anthropic's guide: <https://claude.com/docs/skills/how-to>.

### claude.ai, for everyone in an organization (Team / Enterprise)

An org admin can make the skill available to, or installed by default for, everyone:
**Organization settings → Plugins & skills → Add**. Either upload the zip above, or **sync from GitHub** (`PrZ3r/MSRBot.io`) so updates arrive automatically. See <https://claude.com/docs/plugins/admin>.

### ChatGPT and other tools

Paste the block in [`prompt.md`](prompt.md) into the tool's custom instructions, GPT instructions, or system prompt. The tool must be able to browse the web or fetch URLs.

### Claude API

API skills run in a code-execution container **without network access**, so this skill can't reach msrbot.io there. For API agents, use `prompt.md` as the system prompt together with a web-fetch tool.

## How it answers

Question: *"We're building off SMPTE ST 2067-21:2020. Is that still the edition to target?"*

> **Answer:** No. Target **SMPTE ST 2067-21:2022**. MSRBot lists the 2020 edition as superseded by the 2022 edition as of 2022-11-24. The 2022 edition is marked active and latest.
> **Source URL(s):** https://msrbot.io/api/doc/SMPTE.ST2067-21.2020.json, https://msrbot.io/api/doc/SMPTE.ST2067-21.2022.json
> **Record updated:** 2026-06-17; 2026-01-08
> **Publisher link:** https://doi.org/10.5594/SMPTE.ST2067-21.2022
> **Status:** VERIFIED

Asked about a part that doesn't exist (*"SMPTE ST 2067-99"*), it answers **NOT FOUND**, suggests the nearest real parts, and doesn't guess a title.

## Maintaining it

- **Keep the skill and the prompt in sync.** `prompt.md` restates `SKILL.md` plus `references/`. Change both together, and bump `version` in `.claude-plugin/plugin.json` when the skill changes.
- **Update when the API changes.** The skill uses today's static endpoints. The planned lookup, search, lineage and provenance APIs and the MCP server are tracked in epic [#2032](https://github.com/PrZ3r/MSRBot.io/issues/2032). When each ships, update `references/endpoints.md`, the procedure in `SKILL.md`, `scripts/msrbot.py` and `prompt.md`.
- **Smoke-test the helper** against the live site:
  ```bash
  python3 research/skills/msrbot-research/scripts/msrbot.py current SMPTE.ST2067-21.2020
  ```
- **Test the plugin end to end** (Claude Code):
  ```bash
  claude plugin validate research && claude plugin validate .
  claude -p "Is SMPTE ST 2067-21:2020 current?" --plugin-dir research
  ```
