# PROMPT_LOG

A log of the AI prompts used in this exercise. Each entry records the prompt, why I sent it, and what I kept, changed, or rejected.

## Agent setup

Tools used: Claude Code (main session, plan mode first) and one custom subagent.

| Agent | Definition | Purpose |
|---|---|---|
| Main session | n/a | Planning and implementation, in small slices with a commit after each |
| `reviewer` | `.claude/agents/reviewer.md` | Fresh-context, read-only review of the finished code against the brief and SOLID/error-handling expectations. I triage its findings myself. |

Subagent runs happen in a separate context, so they do not appear in the main transcript. Where one is used, the entry below records the prompt I gave it, a summary of what it returned, and what I did with each finding.

## Entries

<!-- Copy the template for each prompt. Write each entry right after sending the prompt. -->

### Entry 0: Repo scaffold (Claude chat, before Claude Code)

- **Prompt:** Asked Claude how to approach the assessment and to scaffold the repo with the full brief as context (`ASSESSMENT.md`), a `CLAUDE.md`, this log, and a reviewer agent definition.
- **Why:** I wanted the AI to have the full brief from the start and I wanted to understand what the assessors were grading before writing any code.
- **Kept / changed / rejected:** _TODO: fill in honestly. For example, what you changed in `CLAUDE.md` (stack, endpoint name, aggregation rules) after reading it._

### Entry 1: Inspected raw Yahoo response (manual, no AI)

- **What I did:** Ran the curl from the brief with `range=1mo`, saved to `fixtures/tsla-15m-1mo.json`, read it.
- **Why:** Wanted to know the real data shape before prompting, so I could spot AI mistakes later.
- **What I noticed:** _TODO: null entries in the arrays? `exchangeTimezoneName`? `gmtoffset`? What does an invalid symbol return?_

### Entry N: _title_

- **Prompt:**
  ```
  <paste the exact prompt>
  ```
- **Why I chose it:** _what I was trying to learn or achieve_
- **Kept:** _..._
- **Changed:** _... and why_
- **Rejected:** _... and why_

## Manual changes (outside of AI)

Changes I made by hand, with the reasoning for each.

| File / area | What I changed | Why |
|Github Repo and git Setup|Created the repo need a working remote. No AI generated Code|
|fixtures/tsla/15-1mo.json|Fetched the raw Yahoo Data with curl.exe and read it myself|to learn the real data shape before prompting|
|.claude/settings.json|Wired the hook in by hand and restarted Claude Code|Enable automatic prompt loggin|
|---|---|---|
|---|---|---|

### Entry 0b: Prompt-logging hook and QA agent (Claude chat)
- **Prompt:** Asked for a way to auto-log every prompt, and for a QA agent alongside the reviewer.
- **Why:** The assessment grades the prompt log, and I didn't want to lose entries or reconstruct them at the end. I also wanted QA separate from review.
- **Kept / changed / rejected:** _TODO: what you actually changed_
