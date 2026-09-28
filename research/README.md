# MSRBot research

Ask an AI assistant about media standards (SMPTE, ISO, ITU, AES, IETF, D-Cinema, IMF…) and get answers **checked against [MSRBot.io](https://msrbot.io)**, not the AI's memory. Each answer links to the MSRBot record it came from and tells you when a document has been replaced by a newer edition. When MSRBot doesn't have something, the assistant says **"Not found in MSRBot"** instead of guessing.

Contents:

1. [Get it](#1-get-it): pick the line that describes you
2. [Check that it works](#2-check-that-it-works): four questions, about five minutes
3. [For advanced users](#3-for-advanced-users)
4. [Maintaining it](#4-maintaining-it)

---

## 1. Get it

| You… | Do this |
| --- | --- |
| **use Claude through work** and your admin has set this up | Nothing to install. Go to [Check that it works](#2-check-that-it-works). |
| **use Claude** (claude.ai or the Claude desktop app) on your own | Follow [Add it to Claude](#add-it-to-claude). |
| **manage your organization's Claude account**, or want to share it with colleagues | Follow [Set it up for everyone](#set-it-up-for-everyone-admins). |
| **use ChatGPT, Gemini, Copilot or another AI** | Follow [Other AI tools](#other-ai-tools). |
| **use Claude Code** | See [For advanced users](#3-for-advanced-users). |

### Add it to Claude

1. Download **[msrbot-research.zip](https://github.com/PrZ3r/MSRBot.io/releases/latest/download/msrbot-research.zip)**. Don't unzip it. It's attached to every [MSRBot release](https://github.com/PrZ3r/MSRBot.io/releases/latest), so this link always gets the newest version.
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

**Not an Owner? Share it or publish it from your own account.** On Team and Enterprise plans, after you've [added it to Claude](#add-it-to-claude):

1. Open **[Customize → Skills](https://claude.ai/customize/skills)** and select **msrbot-research**.
2. Choose **Share** to give it to specific colleagues (good for a pilot), or **Publish to org** to offer it to everyone.
3. Depending on your organization's publishing policy, an Owner may need to approve it under **Plugins & skills → Requests** before others see it.

A published or shared copy is a snapshot: to update it, upload the new zip as a new version. **Sync from GitHub** (above) picks up changes from the repository, so it's the better long-term option.

### Other AI tools

1. Open [`prompt.md`](prompt.md) and copy everything inside the grey box.
2. Paste it where the tool keeps standing instructions: **ChatGPT**: a custom GPT's *Instructions*, or a Project's instructions. **Gemini**: a Gem. **Copilot**: custom instructions. Anywhere else: paste it as your first message.
3. Make sure the tool can **browse the web**. Without web access it can't check MSRBot, and it will tell you so.

---

## 2. Check that it works

Open a **new chat** for each question and ask it exactly as written. Tick each one off.

### Question 1: does it catch an outdated edition?
> We're building off SMPTE ST 2067-21:2020. Is that still the edition to target?

- [ ] It says the 2020 edition was **replaced by SMPTE ST 2067-21:2022**
- [ ] It includes links that start with `https://msrbot.io/`
- [ ] Its **Confidence** line names the 2020 record's medium status fields: `active`, `superseded`, `amended`, `amendedBy`, `amendedDate`
- [ ] It ends with **Status: VERIFIED**

### Question 2: does it refuse to make things up?

This standard doesn't exist.
> What's the title of SMPTE ST 2067-99?

- [ ] It says **Not found in MSRBot**, or **Status: NOT FOUND**. It should have checked the ST 2067 family list, which has no part 99. **COULD NOT VERIFY** is an honest answer but means the lookup was blocked or cut off; see the table below.
- [ ] It does **not** make up a title
- [ ] It lists the **full URLs** it tried. If it guessed IDs, it stopped after **about three**; which years it tried doesn't matter.
- [ ] A COULD NOT VERIFY answer **opens with what it couldn't check**, not "didn't find"
- [ ] It doesn't speculate about *why* it's missing or suggest nearby part numbers. It asks for the title, or where you saw it cited.

### Question 3: an everyday question
> What's the current edition of SMPTE ST 2110-20?

- [ ] It says **SMPTE ST 2110-20:2022**, with an `msrbot.io` link

### Question 4: can it confirm something isn't there?

This one should end in a clean **NOT FOUND**. ISDCF's documents fit in one small file, so the check is complete.

> What is ISDCF Doc 20 about?

- [ ] It says **Not found in MSRBot**, or **Status: NOT FOUND**, and **not** COULD NOT VERIFY
- [ ] It checked the **whole ISDCF file**, `https://msrbot.io/docs/_data/by-publisher/isdcf.json` (17 records, highest is Doc 15), not just one document-type file
- [ ] It names the file's **last entry** (`ISDCF.RP-430-10.2018`) as evidence it read the whole file
- [ ] It doesn't describe Doc 20 from memory, guess why it's missing, or suggest nearby numbers

### If something's off

| What you see | What to do |
| --- | --- |
| A confident answer with **no msrbot.io links** | The skill didn't switch on. In Claude, check **Customize → Skills** shows it **on**, then start a new chat. In other tools, check the prompt was pasted as instructions. |
| **COULD NOT VERIFY**, mentioning a blocked script or a cut-off file | It reached MSRBot, but not the right file. Send us the answer: that's a gap we're closing with a small lookup API ([#2035](https://github.com/PrZ3r/MSRBot.io/issues/2035)). At work, an admin can also allow `msrbot.io` for Claude's code sandbox, so the helper script can run. |
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

Add `--output-format stream-json --verbose` to see the tool calls. A good run shows a `Skill` call to `msrbot-research`, then `msrbot.py` or `WebFetch` calls to `msrbot.io`. Use the four questions in [section 2](#2-check-that-it-works) as the pass/fail set; for a with/without-skill comparison, run them through the `skill-creator` skill or `claude plugin eval`.

### Where it can't run

Claude API skills execute without network access, so the skill can't reach msrbot.io there. For API agents, use `prompt.md` as the system prompt and give the model a web-fetch tool.

---

## 4. Maintaining it

- **Change the skill and the prompt together.** `prompt.md` restates `SKILL.md` plus `references/`. After any change, bump `version` in `.claude-plugin/plugin.json`.
- **Every release carries the zip.** Releases are published through the [`Publish release`](../.github/workflows/release-skill-zip.yml) workflow: draft the release, then run the workflow with its tag. It builds `msrbot-research.zip` from the draft's commit, attaches it, and publishes. Published releases are immutable, so the zip can't be added afterwards. The download link above always points at the latest release and never needs editing. A skill fix ships with the next MSRBot release; if it can't wait, cut a patch release. The full steps are in [AGENTS.md → Release hygiene](../AGENTS.md#release-hygiene).
- **Follow the API roadmap.** The skill uses today's static endpoints. The planned lookup, search, lineage and provenance APIs and the MCP server are tracked in epic [#2032](https://github.com/PrZ3r/MSRBot.io/issues/2032). As each ships, update `references/endpoints.md`, the procedure in `SKILL.md`, `scripts/msrbot.py` and `prompt.md`.
- **Re-run [section 2](#2-check-that-it-works)** after every change, and after big registry changes.
