---
name: narrow-first
description: Acceptance-gated narrowing loop for complex multi-step tasks. Start with the smallest viable approach, broaden only after measured failure. Use when a task has multiple possible strategies, when you're tempted to reach for heavy tooling upfront, or when a broad approach just failed and you need to reset.
assumption: Models default to broad, exhaustive approaches — reading every file, using every tool, generating maximal context — when a narrow attempt would succeed faster and cheaper. Without explicit narrowing discipline, models burn 10-15x the tokens for equivalent results.
triggers: multiple strategies, broad approach failed, tempted to use heavy tooling, unclear scope, "where do I start"
outputs: working solution via narrowest viable path, documented failure trace if escalated
budget: 3 broadening attempts before escalating; each attempt max 15 tool calls
done_when: acceptance check passes (test green, build green, behaviour matches spec)
---

# Narrow First

The only harness module that consistently improves agent performance is acceptance-gated narrowing. Verifiers hurt. Multi-candidate search hurts. Discipline narrowing beats expensive broadening every time.

## The loop

```
attempt(narrow) → check → pass? → done
                         fail? → diagnose WHY it failed
                                → broaden ONLY the dimension that failed
                                → attempt again
```

### 1. Define the narrowest viable attempt

Before touching code, write a one-paragraph plan (inline or in `.pi/traces/`):

- **Goal**: what "done" looks like (one sentence)
- **Approach**: the smallest set of actions that could achieve it
- **Scope**: what you're deliberately NOT doing yet

The narrowest attempt uses the fewest files, fewest tools, fewest assumptions. If the task is "fix the login bug," the narrow attempt is: read the error, read the handler, find the bug, fix it, run the test. Not: map the entire auth module, read every middleware, trace every call path.

### 2. Execute the attempt

Do the work. Stay within the scope you defined. If you notice something outside scope that needs attention, note it — don't chase it now.

### 3. Check acceptance

Does the result meet the goal? Concrete signals only:

- Test passes
- Build succeeds
- Behaviour matches spec
- Output matches expectation

"I think it's right" is not acceptance. Run the check.

### 4. On failure: diagnose before broadening

When the attempt fails, the reflex is to broaden — read more files, add more tools, try a different approach. Resist.

First, diagnose **which dimension** failed:

| Failure mode | Broadening response |
|---|---|
| Wrong file / wrong location | Expand search scope (one level up) |
| Missing context about a dependency | Read that specific dependency |
| Approach fundamentally wrong | Revise the plan, keep the scope |
| Tool output insufficient | Try one additional tool |
| Task is actually multiple tasks | Decompose; narrow-first each sub-task |

Log the failure mode before broadening. This trace is the raw material for knowing what to change.

### 5. Broaden one dimension, re-attempt

Change ONE thing. Not two, not three. If you broaden scope AND switch approach AND add tools simultaneously, you can't tell what helped.

Re-execute from step 2 with the broadened plan.

### 6. Escalate after 3 failed broadenings

If three successive broadenings haven't produced acceptance, the task likely needs human input — unclear requirements, missing access, wrong mental model. Stop and say what you've tried, what failed, and what you think is missing.

## Anti-patterns

- **Shotgun broadening**: reading 20 files "just in case." Each file costs context and attention. Read when you have a specific question.
- **Premature tool reach**: using a sub-agent or search engine when `grep` at the call site would answer the question. Start with the cheapest tool.
- **Invisible broadening**: expanding scope without updating the plan. If your attempt now covers 8 files instead of 2, that's a broadening — make it explicit.
- **One-shotting**: trying to solve the entire task in a single massive action. Break it into steps; narrow-first each step.
