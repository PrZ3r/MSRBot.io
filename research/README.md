# MSRBot research

Ask an AI assistant about media standards (SMPTE, ISO, ITU, AES, IETF, D-Cinema, IMF…) and get answers **checked against [MSRBot.io](https://msrbot.io)**, not the AI's memory. Each answer links to the MSRBot record it came from and tells you when a document has been replaced by a newer edition. When MSRBot doesn't have something, the assistant says **"Not found in MSRBot"** instead of guessing.

Contents:

1. [Get it](#1-get-it): pick the line that describes you
2. [Check that it works](#2-check-that-it-works): three questions, about five minutes
3. [For advanced users](#3-for-advanced-users)
4. [Maintaining it](#4-maintaining-it)

---

## 1. Get it

| You… | Do this |
| --- | --- |
| **use Claude through work** and your admin has set this up | Nothing to install. Go to [Check that it works](#2-check-that-it-works). |
| **use Claude** (claude.ai or the Claude desktop app) on your own | Follow [Add it to Claude](#add-it-to-claude). |
| **manage your organization's Claude account** | Follow [Set it up for everyone](#set-it-up-for-everyone-admins). |
| **use ChatGPT, Gemini, Copilot or another AI** | Follow [Other AI tools](#other-ai-tools). |
| **use Claude Code** | See [For advanced users](#3-for-advanced-users). |

### Add it to Claude

1. Get **msrbot-research.zip**, either from the [Releases page](https://github.com/PrZ3r/MSRBot.io/releases) (under **Assets**) or from whoever shared this with you. Don't unzip it.
2. In Claude, open **[Customize → Skills](https://claude.ai/customize/skills)**.
3. Choose **Add** / **Upload**, and pick the zip file.
4. Make sure **msrbot-research** is switched **on**.

That's it. Claude uses it automatically when you ask about a standard; you don't have to mention it.

### Set it up for everyone (admins)

For organization Owners (or Enterprise roles that can manage libraries). Once this is done, your colleagues don't have to install anything.

1. Go to **[Organization settings → Plugins & skills](https://claude.ai/admin-settings/skills?tab=inventory)**.
2. Select **Add → Sync from GitHub**, and enter the repository **`PrZ3r/MSRBot.io`**.
3. On the **Inventory** tab, open the **msrbot-research** row menu → **Default access** → **Installed by default**, or **Required** if nobody should be able to turn it off.
4. Updates: after changes land in the repository, open the **Marketplaces** tab and select **Re-sync**. Alternatively, turn on **Sync automatically**, which needs a webhook on the repo.

Prefer a one-off upload instead? Use **Add → Upload a skill** with the zip from [Add it to Claude](#add-it-to-claude). Anthropic's guide: <https://claude.com/docs/plugins/admin>.

### Other AI tools

1. Open [`prompt.md`](prompt.md) and copy everything inside the grey box.
2. Paste it where the tool keeps standing instructions: **ChatGPT**: a custom GPT's *Instructions*, or a Project's instructions. **Gemini**: a Gem. **Copilot**: custom instructions. Anywhere else: paste it as your first message.
3. Make sure the tool can **browse the web**. Without web access it can't check MSRBot, and it will tell you so.

---

## 2. Check that it works

Open a **new chat** and ask these three questions exactly as written. Tick each one off.

### Question 1: does it catch an outdated edition?
> We're building off SMPTE ST 2067-21:2020. Is that still the edition to target?

- [ ] It says the 2020 edition was **replaced by SMPTE ST 2067-21:2022**
- [ ] It includes links that start with `https://msrbot.io/`
- [ ] It ends with **Status: VERIFIED**

### Question 2: does it refuse to make things up?

This standard doesn't exist.
> What's the title of SMPTE ST 2067-99?

- [ ] It says **Not found in MSRBot**, or **Status: NOT FOUND**
- [ ] It does **not** make up a title
- [ ] (Nice to have) it suggests what you might have meant

### Question 3: an everyday question
> What's the current edition of SMPTE ST 2110-20?

- [ ] It says **SMPTE ST 2110-20:2022**, with an `msrbot.io` link

### If something's off

| What you see | What to do |
| --- | --- |
| A confident answer with **no msrbot.io links** | The skill didn't switch on. In Claude, check **Customize → Skills** shows it **on**, then start a new chat. In other tools, check the prompt was pasted as instructions. |
| "I can't access msrbot.io" / "I can't browse" | Turn on web search or browsing for that chat. At work, your admin may need to allow it. |
| Anything else odd | Copy the question and the answer and send them to whoever shared this with you, or [open an issue](https://github.com/PrZ3r/MSRBot.io/issues/new?template=bug_report.md). |

In Claude you can also open the reply's **thinking / tool steps** to confirm it loaded **msrbot-research** and fetched `msrbot.io` URLs.

---

## 3. For advanced users

### What's in this folder

| Path | What it is |
| --- | --- |
| [`skills/msrbot-research/SKILL.md`](skills/msrbot-research/SKILL.md) | The skill: rules, lookup procedure, answer format |
| [`skills/msrbot-research/references/`](skills/msrbot-research/references/) | `endpoints.md` (approved URLs and fallbacks) and `records.md` (status, supersession, references, `$meta` provenance), loaded only when needed |
| [`skills/msrbot-research/scripts/msrbot.py`](skills/msrbot-research/scripts/msrbot.py) | Read-only helper (standard-library Python): `find`, `get`, `current`, `editions`, `ref` |
| [`prompt.md`](prompt.md) | The same rules as a portable prompt |
| [`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) | Plugin manifest; the repo root's [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) lists it |

### Install in Claude Code

```text
/plugin marketplace add PrZ3r/MSRBot.io
/plugin install msrbot-research@msrbot
```

Update later with `/plugin marketplace update msrbot`. Alternatively, copy `skills/msrbot-research/` into `~/.claude/skills/` (just you) or into a project's `.claude/skills/` (everyone in that project). In claude.ai you can also add the repo under **Customize → Plugins → Add** as a marketplace URL.

### Build the zip yourself

The skill folder must be the zip's top level:

```bash
cd research/skills && zip -r msrbot-research.zip msrbot-research -x "*.DS_Store"
unzip -l msrbot-research.zip   # every entry should start with msrbot-research/
```

### Test from the terminal

```bash
# Manifests
claude plugin validate research && claude plugin validate .

# Helper against the live site (expect current = SMPTE.ST2067-21.2022)
python3 research/skills/msrbot-research/scripts/msrbot.py current SMPTE.ST2067-21.2020

# End to end, headless: the skill should trigger without being named
claude -p "Is SMPTE ST 2067-21:2020 still current?" --plugin-dir research \
  --allowedTools "Skill,Read,WebFetch,Bash(python3:*)" < /dev/null
```

Add `--output-format stream-json --verbose` to see the tool calls. A good run shows a `Skill` call to `msrbot-research`, then `msrbot.py` or `WebFetch` calls to `msrbot.io`. Use the three questions in [section 2](#2-check-that-it-works) as the pass/fail set; for a with/without-skill comparison, run them through the `skill-creator` skill or `claude plugin eval`.

### Where it can't run

Claude API skills execute without network access, so the skill can't reach msrbot.io there. For API agents, use `prompt.md` as the system prompt and give the model a web-fetch tool.

---

## 4. Maintaining it

- **Change the skill and the prompt together.** `prompt.md` restates `SKILL.md` plus `references/`. After any change, bump `version` in `.claude-plugin/plugin.json` and rebuild the zip.
- **Follow the API roadmap.** The skill uses today's static endpoints. The planned lookup, search, lineage and provenance APIs and the MCP server are tracked in epic [#2032](https://github.com/PrZ3r/MSRBot.io/issues/2032). As each ships, update `references/endpoints.md`, the procedure in `SKILL.md`, `scripts/msrbot.py` and `prompt.md`.
- **Re-run [section 2](#2-check-that-it-works)** after every change, and after big registry changes.
