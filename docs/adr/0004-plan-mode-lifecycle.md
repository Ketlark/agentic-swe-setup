# ADR-0004: Plan-mode as runtime lifecycle layer

- Status: accepted
- Date: 2026-05-15

## Context

Multi-step coding tasks have a recurring failure mode: the model starts executing
before the problem is understood, burns tokens on the wrong approach, and hands
back a half-complete result. The fix is a human gate between planning and
execution — but building one from scratch in a Pi extension requires significant
plumbing (state machine, model switching, `.plans/` lifecycle, UI menu).

`dreki-gg/pi-plan-mode` (v0.6.1) implements this plumbing. However, it has
two design choices that conflict with our harness:

1. **Internal bash restriction**: plan-mode maintains its own `isSafeCommand`
   allowlist (via `@dreki-gg/pi-command-sandbox`). This duplicates bash-guard's
   responsibility. Two allowlists diverge silently.

2. **Hardcoded models**: `claude-opus-4-6:medium` for planning and `gpt-5.5:low`
   for execution are compiled into the extension. Models evolve faster than
   harness code — locking them in creates churn.

A third design choice in the harness itself (this repo) was also resolved here:
where should skill contracts live? A separate `CONTRACTS.md` file was considered
but rejected because it would drift from the SKILL.md source. The solution is to
embed contract fields (`triggers`, `outputs`, `budget`, `done_when`) directly in
each SKILL.md's YAML frontmatter, which plan-mode reads at planning phase start.

## Decision

Fork `dreki-gg/pi-plan-mode` into `extensions/plan-mode/` and adapt it:

1. **Strip internal bash restriction.** Remove the `tool_call` handler that calls
   `isSafeCommand`. bash-guard owns plan-phase safety via `rules/plan-only.ts` —
   a whitelist rule that fires when `process.env.PI_PLAN_PHASE === "planning"`.

2. **Configurable models.** Replace hardcoded constants with a `planMode` config
   block in `settings.json` read by `extensions/plan-mode/config.ts`.

3. **Skill contract injection.** At planning phase start, read all SKILL.md
   frontmatters from the installed skills (via the paths in `settings.json`),
   filter to those with `triggers`/`outputs`/`done_when` fields, and inject a
   compact summary into the planning system prompt. No separate CONTRACTS.md.

4. **Handoff format.** Replace dreki-gg's START-PROMPT.md template with our
   handoff format (goal, context, decisions, work done, work remaining, acceptance
   criteria, blockers, suggested skills, raw traces).

5. **Phase export.** Set `process.env.PI_PLAN_PHASE` to `"planning"` /
   `"executing"` / `"idle"` so bash-guard can read the current phase without
   coupling to plan-mode's internal state.

### What is kept from dreki-gg

- State machine (idle → planning → executing) and transitions
- `.plans/` directory structure + `plans.json` manifest
- `/plan`, `/todos`, `Ctrl+Alt+P` commands
- Execute / Refine / Follow up / Exit menu
- `[DONE:n]` progress tracking + status bar

### Why fork rather than depend on the package

The required changes touch the core state machine and the tool_call handler —
they cannot be achieved by wrapping or configuring the upstream package.
A fork gives us full control and keeps the allowlist single-source (bash-guard).

## Alternatives considered

### Not forking — build from scratch

Rejected. dreki-gg's state machine, plans.json tracking, and UI menu are
well-tested plumbing. Re-implementing them would be pure duplication.

### Using a different extension (plannotator, etc.)

The other plan-mode extensions found in the Pi ecosystem either lack model
switching, lack the `.plans/` committed-artifact approach, or lack the
Execute/Refine/Follow up menu. dreki-gg's design most closely matches our
needs.

### Keeping dreki-gg's internal bash restriction alongside bash-guard

Rejected. Two allowlists is the failure mode bash-guard was built to prevent.
If plan-mode's `isSafeCommand` allows X but bash-guard's whitelist blocks it,
the model gets inconsistent behaviour. Single authority, single audit path.

### A separate CONTRACTS.md file

Rejected. The contract for a skill belongs in the skill's own file. A separate
CONTRACTS.md would need manual sync on every skill edit — the exact drift risk
this setup is designed to avoid. Frontmatter fields are Pi-native, additive, and
auto-discovered.

## Consequences

### Good

- Single bash-guard authority for all modes (main, subagent, plan).
- Models configurable in `settings.json` without code changes.
- Skill contracts are single-source: edit SKILL.md, plan-mode picks it up automatically.
- Committed `.plans/` artifacts provide decision history (same culture as ADRs).
- Narrowing bias in Refine phase (from narrow-first discipline) reduces plan scope asymmetrically.

### Risky

- Forking diverges from upstream. If dreki-gg ships fixes we want, we need to
  cherry-pick manually. Mitigated by: the fork is small, the diverged sections
  are clearly commented.
- Pi extension API (`pi.on(...)`, `pi.setModel(...)`, etc.) is not stable. Both
  bash-guard and plan-mode would break on breaking API changes. This risk is
  shared with all extensions and not specific to the fork.
- `process.env.PI_PLAN_PHASE` is a loose contract (string env var, not typed).
  If plan-mode fails to set it, bash-guard silently falls back to `"main"` mode
  (permissive). This is the safe failure direction.

## References

- dreki-gg/pi-extensions: https://github.com/dreki-gg/pi-extensions/tree/main/packages/plan-mode
- Plan mode flow: `ARCHITECTURE.md` (plan mode lifecycle section)
- Bash-guard plan rules: `extensions/bash-guard/rules/plan-only.ts`
- Skill contract injection: `extensions/plan-mode/contracts.ts`
- Configurable models: `extensions/plan-mode/config.ts`
