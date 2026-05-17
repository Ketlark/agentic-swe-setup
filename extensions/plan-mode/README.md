# plan-mode

Two-phase workflow extension: **planning** (read-only, strong model) then **execution** (full tools, fast model) with a human gate in between.

Forked from [`dreki-gg/pi-plan-mode`](https://github.com/dreki-gg/pi-plan-mode), adapted for this harness.

## Module map

```
plan-mode/
├── index.ts                  ← Pi entry point (re-exports src/extension.ts)
├── src/
│   ├── extension.ts          ← Bootstrap: config → state → register commands + handlers
│   ├── types.ts              ← Pure type definitions (PlanPhase, TodoItem, ModelRef, PersistedState)
│   ├── constants.ts          ← Value constants (PLAN_TOOLS, EXEC_TOOLS, MESSAGE_TYPE, WIDGET_ID)
│   ├── config.ts             ← Reads planMode block from settings.json
│   ├── state.ts              ← Mutable State + phase transitions (enter/exit/start/complete)
│   ├── messages.ts           ← Pi message type guards (isAssistantMessage, getTextContent)
│   ├── commands.ts           ← /plan, /todos, Ctrl+Alt+P
│   ├── ui.ts                 ← Status bar + todo widget (pure presentation)
│   ├── parse.ts              ← Plan content parsing: titles, todos, [DONE:n] tracking
│   ├── contracts.ts          ← Skill contract loading from SKILL.md frontmatters
│   ├── manifest.ts           ← .plans/plans.json read/write
│   ├── handlers/             ← One file per Pi event handler
│   │   ├── index.ts          ← Barrel: registerHandlers()
│   │   ├── context-injection.ts ← before_agent_start: injects phase prompts
│   │   ├── context-filter.ts    ← context: strips stale plan markers
│   │   ├── done-tracking.ts     ← turn_end: tracks [DONE:n] in execution
│   │   ├── plan-detection.ts    ← tool_result: detects .plans/<name>/ writes
│   │   ├── agent-end.ts         ← agent_end: completion check + human gate menu
│   │   └── session-start.ts     ← session_start: restore state + rescan markers
│   └── prompts/              ← One file per system prompt template
│       ├── index.ts          ← Barrel: re-exports all prompt builders
│       ├── planning.ts       ← [PLAN MODE ACTIVE] instructions + contract injection
│       ├── execution.ts      ← Remaining todos + [DONE:n] instructions
│       └── refine.ts         ← Adversarial self-critique with narrowing bias
├── package.json
└── tsconfig.json
```

## Key concepts

| Concept | Where |
|---------|-------|
| Phase state machine | `src/state.ts` — idle → planning → executing → idle |
| Model switching | `src/state.ts` — saves/restores model per phase from `src/config.ts` |
| Bash-guard integration | `src/state.ts` sets `PI_PLAN_PHASE` env var, read by `bash-guard/rules/plan-only.ts` |
| Skill contracts | `src/contracts.ts` — reads `triggers/outputs/done_when` from SKILL.md frontmatters |
| Plan manifest | `src/manifest.ts` — tracks plan lifecycle in `.plans/plans.json` |
| Human gate | `src/handlers/agent-end.ts` — Execute / Refine / Follow up / Exit |

## Modifying prompts

Each prompt lives in its own file under `src/prompts/`. Edit the specific file — the barrel `src/prompts/index.ts` re-exports them all.

## Adding a new event handler

1. Create `src/handlers/<event-name>.ts` with a `registerXxx(pi, state)` function
2. Import and call it from `src/handlers/index.ts`
