---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up. Use when switching sessions, handing off to a fresh agent, or compacting context. If invocation includes a description of the next session's focus, tailor the doc to it.
assumption: Context windows reset between sessions. Without explicit structure, the next agent starts from zero or misreads stale context. Re-evaluate when agents gain persistent cross-session memory that doesn't degrade.
---

## Contract

**required_outputs**: A single handoff document containing: decisions made, work completed, work remaining, blockers, and suggested skills for the next session.

**done_when**: The handoff doc is written, the path is surfaced to the user, and a fresh agent could continue the work by reading only that doc plus the referenced artifacts.

---

Write a handoff document summarising the current conversation so a fresh agent can continue the work.

## Output path

Determine where to write the handoff:

1. **If a plan is active** — a `.plans/<name>/` directory exists and `PI_PLAN_PHASE` is `planning` or `executing`:
   Write to `.plans/<name>/START-PROMPT.md`. This file doubles as the executor's
   clean-context start prompt when the Execute action is chosen from the plan menu.

2. **No active plan** — write to the path produced by:
   ```
   mktemp -t handoff-XXXXXX.md
   ```
   Read the file first to confirm it's empty before writing.

Both paths use the same document format below.

## Document format

```markdown
# Handoff: <one-sentence goal>

## Context
<Relevant files, modules, APIs, patterns — what a new agent must know to operate>

## Decisions made
<Numbered list: what was decided and why>

## Work completed
<Numbered list: what is done>

## Work remaining
<Numbered list: what is left, in order>

## Acceptance criteria
<What "done" looks like — tests, build, behaviour>

## Blockers / open questions
<Anything that requires human input or external access>

## Suggested skills
<Skills the next session should activate, if any>

## Raw traces
<If .pi/traces/ contains relevant artifacts, list them by path — do not paste their contents>
```

## Rules

- Do NOT duplicate content already captured in other artifacts (PRDs, ADRs, commits, diffs, plans). Reference by path or URL instead.
- If `.pi/traces/` exists with relevant files, reference them under "Raw traces" — do not paste their contents inline.
- If the user passed arguments, treat them as a description of what the next session will focus on and tailor "Work remaining" and "Suggested skills" accordingly.
- Surface the written path to the user at the end.
