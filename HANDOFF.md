# Handoff — commits to apply on the destination machine

**Context.** This snapshot of `agentic-swe-setup` was produced offline (no
upstream git remote available). The work is structured as 6 atomic commits.
After copying this folder over the existing repo on the destination machine,
hand this file to your agent and ask it to apply the commits in order.

**This file deletes itself in the last commit** — see commit 6.

## Preflight (agent must run first)

```bash
# 1. Confirm you're on the right branch.
git status -sb
# Expected: a feature branch off `main` (or whatever your trunk is).

# 2. Confirm pnpm + node are at the project's expected versions.
node --version  # should be ≥ 22
pnpm --version  # should be ≥ 9

# 3. Confirm the working tree contains the new state (this snapshot).
test -f lib/mcp-bridge/extension.ts && echo "factory present"
test -f extensions/bash-guard/session.ts && echo "session.ts present"
test -f mcps/docs-proxy/src/text/processing.ts && echo "text/processing.ts present"
test -f extensions/plan-mode/src/extension.ts && echo "plan-mode present"
test ! -f extensions/bash-guard/lifecycle.ts && echo "lifecycle.ts removed"
test ! -f docs/RULE-AUTHORING.md && echo "RULE-AUTHORING.md removed"
# All six lines must print.

# 4. Stage nothing yet — we'll do it commit-by-commit.
git status
```

If `cp -r` was used to drop the snapshot in, git will see the renamed/deleted
files as **untracked new file + still-tracked old file**. The instructions
below use `git rm` explicitly to handle that.

## Commit grouping rationale

Each commit is **file-disjoint** (no commit modifies a file modified by
another), so the agent can stage by `git add <path>` without `git add -p`
gymnastics. Each commit must leave `pnpm validate` green.

| # | Commit | Files | Why standalone |
|---|---|---|---|
| 1 | `feature(mcp-bridge)` | `lib/mcp-bridge/*` + 2 extension entry points | New library + its first 2 consumers; ~250 lines of duplication eliminated |
| 2 | `refactor(bash-guard)` | All `extensions/bash-guard/*.ts` changes | Rule scope unification + dedup + plan-mode safety; one mental model |
| 3 | `refactor(docs-proxy)` | `mcps/docs-proxy/src/{handlers,text}/` | I/O ↔ pure split |
| 4 | `docs` | Top-level docs + new bash-guard README + delete stale guide | Documentation refresh |
| 5 | `feature(plan-mode)` | `extensions/plan-mode/**` (26 files) | Two-phase plan/execute workflow; self-contained extension |
| 6 | `chore(harness)` | Skills, config, ADR, HOW-TO + `git rm HANDOFF.md` | Harness integration: contracts, docs, config wiring |

---

## Commit 1 — `feature(mcp-bridge)`

**Subject.** `feature(mcp-bridge): introduce createMcpExtension factory + resolveEntry helper`

**Stage these files:**

```bash
# New files — public surface
git add lib/mcp-bridge/discover.ts
git add lib/mcp-bridge/extension.ts             # orchestrator (~112 lines)
git add lib/mcp-bridge/index.ts                 # barrel

# New files — internal helpers (not exported from package barrel)
git add lib/mcp-bridge/tool-registration.ts     # registerMcpTool + schema translation + prompt hints
git add lib/mcp-bridge/status-command.ts        # /<label>-status registration
git add lib/mcp-bridge/types.ts                 # internal Stats type

# New file — package documentation
git add lib/mcp-bridge/README.md                # surface API + canonical examples

# Modified files
git add lib/mcp-bridge/client.ts        # added McpToolProperty interface
git add lib/mcp-bridge/package.json     # description + exports updated

# Rewritten extensions (now ~24-39 lines each, pure config)
git add extensions/hugin/index.ts
git add extensions/docs-proxy/index.ts
```

**Validate before committing:**

```bash
pnpm validate
```

**Commit message:**

```bash
git commit -m "$(cat <<'EOF'
feature(mcp-bridge): introduce createMcpExtension factory + resolveEntry helper

Deepen lib/mcp-bridge from a low-level JSON-RPC client into a Pi-extension
factory. Adding a new MCP bridge now requires ~25 lines of pure configuration
instead of ~150 of boilerplate (lifecycle, discovery, registration, status
command).

- lib/mcp-bridge/extension.ts: createMcpExtension(config) — orchestrator that
  owns the session lifecycle (spawn / shutdown) and wires per-tool
  registration and the status slash command via dedicated helpers. Smart
  defaults derived from `label`, per-field overrides.
- lib/mcp-bridge/tool-registration.ts: registerMcpTool — schema translation
  (MCP inputSchema → Pi tool params), prompt hints, execute() wrapper with
  error / cancellation handling.
- lib/mcp-bridge/status-command.ts: registerStatusCommand — /<label>-status
  slash command (connection state, entry path, call/error counters).
- lib/mcp-bridge/discover.ts: resolveEntry({ envVar, candidates }) — env-var
  override, then first existing candidate path.
- lib/mcp-bridge/types.ts: internal Stats type shared between the
  orchestrator and helpers (not re-exported).
- lib/mcp-bridge/client.ts: McpToolProperty interface added so consumers can
  access prop.type without tripping noPropertyAccessFromIndexSignature.
- lib/mcp-bridge/README.md: documents the surface API and points at the
  canonical consumer examples.
- extensions/hugin/index.ts: 167 → 39 lines.
- extensions/docs-proxy/index.ts: 154 → 24 lines (overrides statusCommand to
  preserve /docs-status).
EOF
)"
```

### Smoke test (highly recommended before commit 2)

`pnpm validate` covers lint + typecheck + unit tests but does NOT spawn the
MCP subprocesses. The factory is new; runtime regressions slip past static
checks. Verify manually:

```bash
# Launch Pi from the repo root.
pi

# Inside Pi, run:
/hugin-status        # expect: "Connected: yes — N tool(s)"; tool list non-empty
/docs-status         # expect: "Connected: yes — 1 tool"; "get_docs" listed

# Optionally invoke a tool to confirm the JSON-RPC round-trip works:
# (Ask the agent: "Use docs-proxy to fetch the README of vercel/next.js")
```

If either status command shows `Connected: no` or the tool list is empty:
- Check that `mcps/hugin-mcp/` exists (run `./setup.sh mcps` if not).
- Check that `mcps/docs-proxy/dist/index.js` exists (it ships in the repo).
- Set `HUGIN_MCP_PATH` or `DOCS_PROXY_PATH` to a known good location.

Only proceed once both bridges report connected.

---

## Commit 2 — `refactor(bash-guard)`

**Subject.** `refactor(bash-guard): unify rule scope, fail-closed parsing, dedup helpers`

**Stage these files:**

```bash
# Renames (use git mv if the old files are still present after cp)
git rm extensions/bash-guard/lifecycle.ts                    # → session.ts
git rm extensions/bash-guard/__tests__/rules.test.ts         # → analyze.test.ts
git add extensions/bash-guard/session.ts                     # rename target (with edits)
git add extensions/bash-guard/__tests__/analyze.test.ts      # rename target (with new cases)

# New files
git add extensions/bash-guard/rules/subagent-only.ts
git add extensions/bash-guard/rules/plan-only.ts             # whitelist-based rule for plan-mode read-only safety

# Modified files
git add extensions/bash-guard/types.ts                       # +RuleScope, +Mode ("plan"), +appliesIn, +isOpToken
git add extensions/bash-guard/analyze.ts                     # mode param, fail-closed, drop SUBAGENT_ONLY/isCatastrophic/analyzeRaw
git add extensions/bash-guard/subagent.ts                    # delegates to analyzeBashCommand({ mode: "subagent" })
git add extensions/bash-guard/rules/registry.ts              # scope filter, ALL_RULES adds subagentOnlyRules + planOnlyRules, dedup isOpToken
git add extensions/bash-guard/index.ts                       # registerLifecycle → registerSessionHooks, import from session.js
git add extensions/bash-guard/commands.ts                    # import State from session.js
git add extensions/bash-guard/interceptor.ts                 # import ABORT_MS from session.js, reads PI_PLAN_PHASE for plan-mode blocking
```

> If `git rm` complains the file doesn't exist, the destination already lacks
> it — that's fine, just skip that line.

**Validate before committing:**

```bash
pnpm validate
# Expect: 67 tests in extensions/bash-guard/__tests__/analyze.test.ts pass.
```

**Commit message:**

```bash
git commit -m "$(cat <<'EOF'
refactor(bash-guard): unify rule scope, fail-closed parsing, plan-mode safety

Single seam for shell-command analysis: analyzeBashCommand(cmd, { mode }).
Eliminates three parallel code paths (analyzeBashCommand + analyzeRaw +
isCatastrophic) and three regex copies of the subagent blocklist.

Behaviour changes
- Rule type carries appliesIn?: "main" | "subagent" | "both" (default "both").
- Subagent-specific rules (git commit/pull/push) live in
  rules/subagent-only.ts as regular declarative rules — same engine, different
  scope filter — instead of a hand-maintained regex list.
- shell-quote parse failure now returns a high-severity finding ("unparseable
  shell command, blocked by precaution") rather than falling back to a
  parallel regex scanner. Main mode prompts; subagent blocks. Fail-closed.
- subagent.ts calls analyzeBashCommand(cmd, { mode: "subagent" }) directly.
- rules/plan-only.ts: whitelist-based rule for plan mode — only read-safe
  commands (ls, cat, grep, find, head, tail, wc, etc.) are allowed.
  PI_PLAN_PHASE env var read by interceptor.ts to activate plan-mode blocking.

Housekeeping (same module, easier in one commit)
- lifecycle.ts → session.ts (file owns session state, not just hooks).
  registerLifecycle → registerSessionHooks. ABORT_MS now exported from
  session.ts (was duplicated in interceptor.ts).
- isOpToken moved to types.ts next to Token/OpToken (was duplicated in
  analyze.ts and rules/registry.ts).

Tests
- __tests__/rules.test.ts → __tests__/analyze.test.ts (it tests the
  orchestrator, not individual rules).
- 7 new cases for the subagent scope: git commit/pull/push blocked in
  subagent / medium in main; sudo rm -rf still blocks both modes; safe
  commands still pass; fail-closed on unparseable input.

Net: analyze.ts shrunk 91 → 44 lines.
EOF
)"
```

---

## Commit 3 — `refactor(docs-proxy)`

**Subject.** `refactor(docs-proxy): split pure text processing out of url handler`

**Stage these files:**

```bash
# New file
git add mcps/docs-proxy/src/text/processing.ts

# Modified files
git add mcps/docs-proxy/src/handlers/url.ts                  # only HTTP I/O now, uses truncate from text/
git add mcps/docs-proxy/src/handlers/github.ts               # import processFetchedText from ../text/processing.js
```

**Validate before committing:**

```bash
pnpm validate
```

**Commit message:**

```bash
git commit -m "$(cat <<'EOF'
refactor(docs-proxy): split pure text processing out of url handler

handlers/url.ts mixed HTTP I/O (fetch + SSRF guard + content-type sniff) with
pure text utilities (truncate, extractRelevantSections, processFetchedText).
The pure functions are now in text/processing.ts and reused by both url and
github handlers.

- mcps/docs-proxy/src/text/processing.ts: truncate, extractRelevantSections,
  processFetchedText. No I/O, trivially testable.
- mcps/docs-proxy/src/handlers/url.ts: 80 → 33 lines, only HTTP I/O. The
  inline truncate-with-marker block is gone (it duplicated truncate()).
- mcps/docs-proxy/src/handlers/github.ts: import path updated.
EOF
)"
```

---

## Commit 4 — `docs`

**Subject.** `docs: slim README, refresh ARCHITECTURE, point authoring guides at canonical examples`

**Stage these files:**

```bash
# Modified — top-level docs
git add README.md                                            # 314 → ~95 lines + templates usage section
git add ARCHITECTURE.md                                      # pi-subagents reclassified, contracts table refreshed
git add CHANGELOG.md                                         # all 4 commits' bullets land here
git add CONTRIBUTING.md                                      # RULE-AUTHORING reference replaced + Phase-1 wording removed

# Modified — authoring guides
git add docs/EXTENSION-AUTHORING.md                          # canonical-example pointers, less prose
git add docs/MCP-AUTHORING.md                                # createMcpExtension API, no more "Phase 1" wording
git add docs/SKILL-AUTHORING.md                              # tightened, points at improve-codebase-architecture as multi-ref example

# Modified — Phase-1 wording cleanup (the project no longer uses Phase-N labels)
git add vitest.config.ts                                     # comment block updated
git add docs/adr/0002-biome-over-eslint.md                   # "after Phase 1" wording removed

# New
git add extensions/bash-guard/README.md                      # canonical "Adding a rule" lives here now

# Deleted
git rm docs/RULE-AUTHORING.md                                # was stale (severity:"low" doesn't exist, file names wrong, Phase-1 wording)

# HANDOFF.md self-deletion moved to commit 6 (needs to survive for commits 5-6 instructions)
```

> Same caveat: if `git rm docs/RULE-AUTHORING.md` reports the file doesn't
> exist, it was never tracked on this side — skip.

**Validate before committing:**

```bash
pnpm validate
# All 74 tests still green; lint + typecheck pass.
```

**Commit message:**

```bash
git commit -m "$(cat <<'EOF'
docs: slim README, refresh ARCHITECTURE, point authoring guides at canonical examples

The root README had grown to 314 lines duplicating per-extension architecture,
slash commands, and rule lists. ARCHITECTURE.md miscategorised pi-subagents
as a regular extension. The docs/*-AUTHORING.md guides referenced "Phase 1"
work as if it were future, used wrong API names (createMcpBridge vs the
actual createMcpExtension), and wrong rule severities (no "low" exists).

- README.md: 314 → 89 lines. Per-extension internals moved out. Just
  orientation + install + tables.
- extensions/bash-guard/README.md (new): full per-extension docs — decision
  flow, what gets flagged, slash commands, flags, module layout, "Adding a
  rule" walkthrough.
- ARCHITECTURE.md: pi-subagents now correctly grouped under mcps/ (it's an
  npm-distributed MCP, not an extension). Cross-package contracts table
  expanded with the MCP tools/list JSON-RPC schema.
- docs/EXTENSION-AUTHORING.md: rewritten around explicit pointers to
  canonical example files (extensions/rtk-rewrite, extensions/bash-guard).
  Drift-resistant — when the examples evolve, the doc stays accurate.
- docs/MCP-AUTHORING.md: documents the actual createMcpExtension factory
  (was describing a hypothetical createMcpBridge that never shipped).
  Pointers to extensions/hugin and mcps/docs-proxy as canonical examples.
- docs/SKILL-AUTHORING.md: tightened, points at improve-codebase-architecture
  as a canonical multi-reference-file skill.
- docs/RULE-AUTHORING.md: removed. Was stale across the board (severity:"low"
  doesn't exist in Severity, file names didn't match rules/*, references
  Phase 1 as future). Canonical "Adding a rule" now lives in
  extensions/bash-guard/README.md.
- README.md (Templates section): adds explicit usage instructions —
  templates/AGENTS.md is a copy-by-hand artifact, not auto-installed.
- vitest.config.ts, CONTRIBUTING.md, CHANGELOG.md, docs/adr/0002: drop
  stale "Phase 1" wording. The project no longer uses Phase-N labels;
  testing strategy is now documented in steady-state terms (lib/ unit-tested,
  extensions and MCP servers exercised end-to-end).
- CHANGELOG.md: bullets for commits 1-4 in this series (5-6 added separately).
- CONTRIBUTING.md: RULE-AUTHORING.md link replaced.
EOF
)"
```

---

## Commit 5 — `feature(plan-mode)`

**Subject.** `feature(plan-mode): introduce two-phase plan/execute workflow extension`

**Stage these files:**

```bash
# Entry point + package config
git add extensions/plan-mode/index.ts
git add extensions/plan-mode/package.json
git add extensions/plan-mode/tsconfig.json
git add extensions/plan-mode/README.md

# Core modules
git add extensions/plan-mode/src/extension.ts                # bootstrap orchestrator
git add extensions/plan-mode/src/types.ts                    # PlanPhase, ModelRef, ModelPreset, TodoItem, PersistedState
git add extensions/plan-mode/src/constants.ts                # tool sets, message keys, widget IDs, PLANS_DIR, toPlanDir/toPlanName
git add extensions/plan-mode/src/config.ts                   # settings.json planMode block reader
git add extensions/plan-mode/src/state.ts                    # mutable State + phase transitions (applyPhase, restorePreviousConfig)
git add extensions/plan-mode/src/messages.ts                 # Pi message type guards (isAssistantMessage, getTextContent)
git add extensions/plan-mode/src/commands.ts                 # /plan, /todos, Ctrl+Alt+P
git add extensions/plan-mode/src/ui.ts                       # status bar + todo widget + notifyTransition
git add extensions/plan-mode/src/parse.ts                    # plan title/todo extraction, [DONE:n] tracking
git add extensions/plan-mode/src/contracts.ts                # skill contract loading from SKILL.md frontmatters
git add extensions/plan-mode/src/manifest.ts                 # .plans/plans.json read/write

# Event handlers — one file per Pi event
git add extensions/plan-mode/src/handlers/index.ts           # barrel: registerHandlers()
git add extensions/plan-mode/src/handlers/context-injection.ts
git add extensions/plan-mode/src/handlers/context-filter.ts
git add extensions/plan-mode/src/handlers/done-tracking.ts
git add extensions/plan-mode/src/handlers/plan-detection.ts
git add extensions/plan-mode/src/handlers/agent-end.ts
git add extensions/plan-mode/src/handlers/session-start.ts

# Prompt templates — one file per phase
git add extensions/plan-mode/src/prompts/index.ts            # barrel
git add extensions/plan-mode/src/prompts/planning.ts
git add extensions/plan-mode/src/prompts/execution.ts
git add extensions/plan-mode/src/prompts/refine.ts
```

**Validate before committing:**

```bash
pnpm validate
```

**Commit message:**

```bash
git commit -m "$(cat <<'EOF'
feature(plan-mode): introduce two-phase plan/execute workflow extension

Forked from dreki-gg/pi-plan-mode, restructured to library-grade standards:
src/ with handlers/, prompts/, strict SRP/DRY separation.

Two-phase workflow: planning (read-only, strong model) → human gate
(Execute / Refine / Follow up / Exit) → execution (full tools, fast model).

Architecture:
- src/state.ts: phase state machine (idle → planning → executing → idle)
  with applyPhase/restorePreviousConfig primitives. Bash-guard integration
  via PI_PLAN_PHASE env var.
- src/handlers/: one file per Pi event (context-injection, context-filter,
  done-tracking, plan-detection, agent-end, session-start).
- src/prompts/: one file per system prompt template (planning, execution,
  refine with narrowing bias from narrow-first discipline).
- src/contracts.ts: reads skill contracts from SKILL.md frontmatters and
  injects them into the planning prompt.
- src/manifest.ts: tracks plan lifecycle in .plans/plans.json.
- src/config.ts: model switching reads from settings.json planMode block.
- src/constants.ts: single source of truth for all magic strings.
- src/types.ts: pure types only (ModelPreset extends ModelRef).
- src/messages.ts: generic Pi message type guards.

26 files, each 15-155 lines. README.md serves as module map for agents.
EOF
)"
```

---

## Commit 6 — `chore(harness)`

**Subject.** `chore(harness): skill contracts, plan-mode config, ADR-0004, HOW-TO`

**Stage these files:**

```bash
# Config — plan-mode registration + model presets
git add settings.json

# New documentation
git add HOW-TO.md
git add docs/adr/0004-plan-mode-lifecycle.md
git add docs/FILE-BACKED-STATE.md

# Updated docs
git add docs/adr/README.md                                   # +ADR-0004

# New skill
git add skills/narrow-first/SKILL.md

# Skill frontmatter updates (triggers/outputs/budget/done_when contracts)
git add skills/diagnose/SKILL.md
git add skills/improve-codebase-architecture/SKILL.md
git add skills/review/SKILL.md
git add skills/handoff/SKILL.md
git add skills/write-a-skill/SKILL.md

# Extension assumption comments
git add extensions/rtk-rewrite/index.ts

# Self-delete this handoff doc
git rm HANDOFF.md
```

**Validate before committing:**

```bash
pnpm validate
```

**Commit message:**

```bash
git commit -m "$(cat <<'EOF'
chore(harness): skill contracts, plan-mode config, ADR-0004, HOW-TO

Wires plan-mode into the harness and enriches skill contracts for
automatic inference during planning.

- settings.json: registers plan-mode extension, adds planMode block with
  configurable model presets (plan: claude-opus-4-6/medium, execute:
  gpt-5.5/low).
- skills/{diagnose,improve-codebase-architecture,review,handoff}/SKILL.md:
  enriched frontmatters with triggers/outputs/budget/done_when fields.
  Plan-mode reads these to inject skill contracts into the planning prompt.
- skills/narrow-first/SKILL.md: new narrowing discipline — acceptance-gated
  approach that biases toward minimal viable scope.
- skills/write-a-skill/SKILL.md: updated template with contract fields.
- docs/adr/0004-plan-mode-lifecycle.md: documents plan-mode integration
  decisions (whitelist bash-guard, configurable models, opt-in with suggest).
- docs/FILE-BACKED-STATE.md: scoped to .pi/traces/ (raw working memory).
- HOW-TO.md: personal cheat-sheet for daily workflows.
- extensions/rtk-rewrite/index.ts: assumption comment added.
EOF
)"
```

---

## Final check

```bash
git log --oneline -7      # should show the 6 new commits + parent
pnpm validate             # all green
git status                # clean
```

If any commit's `pnpm validate` fails, you applied the file split wrong —
check that ALL files for that commit's mental model were staged together. The
6 commits are intentionally file-disjoint, so per-commit validation must pass
independently.

## Optional — push & PR

```bash
git push -u origin HEAD
gh pr create --fill
```

Suggest title: **`refactor: deepen mcp-bridge, unify bash-guard, plan-mode extension, slim docs`**

Suggest summary bullets:
- New `lib/mcp-bridge` factory eliminates ~250 lines of MCP bridge boilerplate
- `bash-guard` rule engine unified across main/subagent/plan contexts; plan-mode gets whitelist-based read-only safety
- New `plan-mode` extension: two-phase plan/execute workflow with model switching, human gate, skill contract injection (26 files, library-grade structure)
- Skill contracts enriched in SKILL.md frontmatters for automatic inference during planning
- Docs slimmed: per-extension internals moved into per-extension READMEs; authoring guides now point at canonical example files
