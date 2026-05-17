# Architecture

High-level structure of `agentic-swe-setup`. Stays short on purpose — for the
rationale behind individual decisions, see [`docs/adr/`](docs/adr/).

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      Pi coding agent                        │
│            (external — installed separately)                │
└────────┬───────────────────────────────────┬────────────────┘
         │                                   │
         │ loads on startup                  │ activates contextually
         │ (settings.json)                   │
         ▼                                   ▼
┌──────────────────┐                ┌─────────────────────┐
│   extensions/    │                │      skills/        │
│  (TypeScript)    │                │     (markdown)      │
│                  │                │                     │
│  - bash-guard    │◀── reads ──────│  - plan contracts   │
│  - plan-mode     │    phase env   │    (SKILL.md FM)    │
│  - rtk-rewrite   │                │  - diagnose         │
│  - hugin         │                │  - review, …        │
│  - docs-proxy    │                │                     │
└────────┬─────────┘                └─────────────────────┘
         │ uses
         ▼
┌──────────────────┐                ┌─────────────────────┐
│      lib/        │                │       mcps/         │
│  (shared TS)     │                │  (subprocesses)     │
│                  │                │                     │
│  - mcp-bridge    │◀────spawns─────│  - docs-proxy       │
│                  │                │  - hugin-mcp (ext.) │
└──────────────────┘                │  + pi-subagents     │
                                    │    (npm, user-wide) │
                                    └─────────────────────┘
```

## Three-layer harness

| Layer | Owner | Responsibility |
|-------|-------|---------------|
| **Runtime** | `extensions/plan-mode` | Session sequencing, model switching, human gate, `.plans/` lifecycle |
| **Task logic** | `skills/` | Domain-specific procedures, contracts, acceptance criteria |
| **Safety + efficiency** | `extensions/bash-guard`, `rtk-rewrite`, `hugin`, `docs-proxy` | Command safety, token compression, tool access |

## Folders

| Path | Role | Stability boundary |
|---|---|---|
| `extensions/` | Pi extensions — TypeScript modules loaded by Pi at session start. | Pi extension API (`pi.on(...)`, `pi.registerCommand(...)`) |
| `lib/` | Internal workspace packages. Not published — depended on via `workspace:*`. | Internal — free to evolve |
| `mcps/` | MCP servers spawned as subprocesses, bridged into Pi via the matching extension. | MCP protocol (JSON-RPC over stdio) |
| `skills/` | Pi skills — markdown with YAML frontmatter, activated by the model based on context. | `description` + `triggers` frontmatter fields are the trigger surface |
| `templates/` | Files copied as-is into end-user projects (e.g. `AGENTS.md`). | Plain text |
| `docs/` | Authoring guides + ADRs. | Living docs |
| `.plans/` | Plan artifacts — committed. Contains `plans.json` manifest + one subdirectory per plan. | Committed; cleaned via `pi-plan-mode clean` after merge |

## Session lifecycle

1. User runs `pi` from this repo's root.
2. Pi reads `settings.json` to discover extensions and skills.
3. For each extension, Pi imports `index.ts` and calls the default export with `(pi: ExtensionAPI)`.
4. Extensions register tools, slash commands, and event handlers.
5. When the model issues a tool call, Pi fires `tool_call`. Extensions in registration order can mutate or block it.
6. MCP bridges spawn their subprocesses on `session_start`, register the discovered tools, and tear them down on `session_shutdown`.

### Plan mode lifecycle

```
/plan <prompt>
     │
     ▼ plan-mode: enterPlanMode()
     │   - switches to planModel (from settings.json)
     │   - sets PI_PLAN_PHASE=planning
     │   - sets PLAN_TOOLS active
     │   - injects skill contracts from SKILL.md frontmatters
     │
     ▼ agent explores codebase (bash-guard enforces whitelist via plan-only.ts)
     │
     ▼ agent writes .plans/<name>/{PLAN.md, START-PROMPT.md}
     │
     ▼ human gate: Execute / Refine / Follow up / Exit
         │
         ├── Refine → adversarial critique + narrowing bias → loops back
         │
         └── Execute
               │
               ▼ plan-mode: startExecution()
                   - switches to executeModel
                   - sets PI_PLAN_PHASE=executing
                   - loads START-PROMPT.md as clean context
                   - tracks [DONE:n] markers
```

## Extension ordering

Loaded in `settings.json` order. For `tool_call`, that order matters:

- **bash-guard first** — analyse and possibly block before any rewrite. In plan phase,
  reads `PI_PLAN_PHASE=planning` and applies whitelist rules.
- **plan-mode second** — exports phase via `process.env.PI_PLAN_PHASE`.
- **rtk-rewrite third** — rewrite approved commands for token compression.
- **MCP bridges (hugin, docs-proxy)** — register tools, do not intercept `bash`.

## Storage

| Location | Owner | Committed | Contents |
|----------|-------|-----------|----------|
| `.plans/<name>/` | plan-mode extension | Yes | PLAN.md, START-PROMPT.md, decision artifacts |
| `.plans/plans.json` | plan-mode extension | Yes | Manifest of all plans and their status |
| `.pi/traces/` | agent (convention) | No | Raw tool output, error logs, measurements |

## Cross-package contracts

Named types and env vars crossing module boundaries. Treat as versioning surface.

| Contract | Owner | Consumer |
|---|---|---|
| `McpExtensionConfig` | `lib/mcp-bridge/extension.ts` | `extensions/hugin`, `extensions/docs-proxy` |
| `EntryResolverConfig` | `lib/mcp-bridge/discover.ts` | `extensions/hugin`, `extensions/docs-proxy` |
| `McpStdioClient` | `lib/mcp-bridge/client.ts` | `lib/mcp-bridge/extension.ts` |
| `Rule` (rule shape) | `extensions/bash-guard/types.ts` | `extensions/bash-guard/rules/*` |
| `Mode` (`"main" \| "subagent" \| "plan"`) | `extensions/bash-guard/types.ts` | `extensions/bash-guard/interceptor.ts`, `rules/plan-only.ts` |
| `PI_PLAN_PHASE` env var | `extensions/plan-mode/index.ts` | `extensions/bash-guard/interceptor.ts` |
| `planMode` config block | `settings.json` | `extensions/plan-mode/config.ts` |
| Skill contract fields (`triggers`, `outputs`, `budget`, `done_when`) | `skills/*/SKILL.md` frontmatter | `extensions/plan-mode/contracts.ts` |
| MCP `tools/list` JSON-RPC | `mcps/*` | `lib/mcp-bridge/extension.ts` |

## Where to start

- Add an extension → [`docs/EXTENSION-AUTHORING.md`](docs/EXTENSION-AUTHORING.md)
- Add an MCP server bridge → [`docs/MCP-AUTHORING.md`](docs/MCP-AUTHORING.md)
- Add a skill → [`docs/SKILL-AUTHORING.md`](docs/SKILL-AUTHORING.md)
- Add a bash-guard rule → [`extensions/bash-guard/README.md#adding-a-rule`](extensions/bash-guard/README.md#adding-a-rule)
- Plan mode internals → [`docs/adr/0004-plan-mode-lifecycle.md`](docs/adr/0004-plan-mode-lifecycle.md)
