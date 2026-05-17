# HOW-TO

Personal cheat-sheet. Commands first, no prose. Update when workflows change.

---

## Plan mode

```
/plan <prompt>          enter plan mode with a starting prompt
/plan                   toggle plan mode off
Ctrl+Alt+P              toggle plan mode
/todos                  show current plan progress
--plan                  start session in plan mode (CLI flag)
```

**Cycle:** plan → [Execute | Refine | Follow up | Exit]

- **Execute** — switches to executeModel, clean context from `START-PROMPT.md`, tracks `[DONE:n]`
- **Refine** — adversarial self-critique + narrowing bias (shortest plan = best plan)
- **Follow up** — open editor to add instructions to the planner
- **Exit** — restore original model, discard plan session

**Key files:**

```
.plans/                         committed plan artifacts
.plans/plans.json               manifest of all plans and their status
.plans/<name>/PLAN.md           numbered checklist + acceptance criteria
.plans/<name>/START-PROMPT.md   self-contained handoff for executor
```

**After merge:**

```bash
npx pi-plan-mode clean          remove completed plans from .plans/
```

**Configure models** in `settings.json`:

```json
"planMode": {
  "planModel":    { "provider": "anthropic", "id": "claude-opus-4-6", "thinking": "medium" },
  "executeModel": { "provider": "openai",    "id": "gpt-5.5",         "thinking": "low"    }
}
```

---

## Skills

Activated by the model based on context. No slash command needed.

| Trigger words | Skill |
|---|---|
| bug, error, broken, failing, throwing, performance regression | `diagnose` |
| review, check changes, PR, since branch/commit | `review` |
| architecture, refactor, improve, deepen, testability | `improve-codebase-architecture` |
| prototype, try, mock up, explore | `prototype` |
| stress-test a plan, challenge assumptions, grill me | `grill-me` |
| grill + domain docs, ADR | `grill-with-docs` |
| handoff, switch session, context dump | `handoff` |
| multiple strategies, broad approach failed, where to start | `narrow-first` |
| zoom out, step back, losing the thread | `zoom-out` |

---

## Bash-guard

```
--bash-guard-yolo           disable entirely for this session
--bash-guard-auto-allow     auto-allow flagged commands (no UI)
/bash-guard-status          show blocked/allowed stats
/bash-guard-allowlist        show session allowlist
```

**Modes:**

| Mode | Behaviour |
|------|-----------|
| `main` | Prompt user for flagged commands |
| `subagent` | Hard-block high-severity commands silently |
| `plan` | Whitelist only — read-only commands + `.plans/` writes |

Mode switches automatically: plan-mode extension sets `PI_PLAN_PHASE`, bash-guard reads it.

---

## MCP tools

```
/hugin-status               web search + web read status
/docs-status                docs-proxy status
```

**Usage:**

```
"search for X"              → hugin web_search
"fetch docs for library Y"  → docs-proxy get_docs
"read this URL: ..."        → hugin web_read
```

---

## Handoff

```
"hand off"
"handoff to next session"
"handoff — focus on <X>"
```

- If plan active (`PI_PLAN_PHASE` is `planning` or `executing`):
  writes `START-PROMPT.md` in `.plans/<name>/`
- If no active plan:
  writes to `mktemp -t handoff-XXXXXX.md`, gives you the path

Both paths use the same format: goal, context, decisions, work done, work remaining,
acceptance criteria, blockers, suggested skills, raw traces.

---

## Debug workflow (plan mode + diagnose)

```
/plan <bug description>
```

1. Planner writes `PLAN.md` shaped by the `diagnose` contract
2. Refine → narrow the plan
3. Execute → feedback loop → hypotheses → instrument → fix → regression test
4. Raw output to `.pi/traces/`

---

## Review workflow (plan mode + review)

```
/plan review since <branch|commit|tag>
```

1. Planner writes `PLAN.md` with two-axis structure (Standards + Spec)
2. Execute → two sub-agents run in parallel
3. Standards report + Spec report + summary

---

## Raw traces

```
.pi/traces/                 gitignored, raw working memory
```

Write raw tool output here (test runs, error logs, search results) when it
needs to survive compaction or be referenced in a handoff.
Clean up when the task is done.

---

## Key files

```
settings.json               Pi config: extensions, skills, models, planMode
ARCHITECTURE.md             Layer diagram, contracts, storage map
docs/FILE-BACKED-STATE.md   .pi/traces/ convention
docs/adr/                   Why decisions were made
templates/AGENTS.md         Drop into projects for agent behavioural rules
```
