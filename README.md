# agentic-swe-setup

Portable Pi configuration — extensions, skills, MCP bridges, and templates.
Clone on any machine, run `./setup.sh`, start working.

[Pi](https://github.com/earendil-works/pi-coding-agent) is a terminal coding
agent. This repo holds the opinionated personal harness layered on top.

## Install

```bash
git clone git@github.com:Ketlark/agentic-swe-setup.git
cd agentic-swe-setup
./setup.sh
```

The script checks Pi is installed, symlinks `settings.json` into
`~/.config/pi-coding-agent`, runs `pnpm install`, and clones the MCP servers
declared in `setup.sh`. Then launch Pi from this directory:

```bash
pi
```

## What's inside

### Extensions

| Extension | Purpose |
|---|---|
| [bash-guard](extensions/bash-guard/) | Intercepts dangerous shell commands. Interactive in main session, hard-block in subagents, whitelist-only in plan phase. |
| [plan-mode](extensions/plan-mode/) | Two-phase planning workflow: plan (strong model + read-only) → human gate → execute (fast model + full tools). Plans committed to `.plans/`. |
| [rtk-rewrite](extensions/rtk-rewrite/) | Rewrites shell commands through [RTK](https://github.com/rtk-ai/rtk) to compress noisy command output. |
| [hugin](extensions/hugin/) | Bridges [hugin-mcp](https://github.com/Ketlark/hugin-mcp) — `web_search` (SearXNG, 70+ engines) + `web_read` (14+ specialized handlers). |
| [docs-proxy](extensions/docs-proxy/) | Bridges the local [docs-proxy](mcps/docs-proxy/) MCP — `get_docs` for libraries, GitHub repos, or arbitrary URLs. |

### Skills

Skills are markdown capability packages activated by the model when relevant.
See [`skills/CREDITS.md`](skills/CREDITS.md) for sources and adaptations.

| Skill | Purpose |
|---|---|
| [no-slop](skills/no-slop/) | Anti-AI-writing-patterns enforcement on every prose output. |
| [diagnose](skills/diagnose/) | Structured root-cause analysis with HITL loop. |
| [grill-me](skills/grill-me/) | Constrained design dialogue: one question at a time, explicit recommendations. |
| [grill-with-docs](skills/grill-with-docs/) | Same, but produces ADR-formatted artifacts. |
| [improve-codebase-architecture](skills/improve-codebase-architecture/) | Deepen modules, raise leverage. The methodology behind this repo's refactors. |
| [prototype](skills/prototype/) | Throwaway exploration mode — single-file, decision-driven. |
| [review](skills/review/) | High-level review against initial intent (vs spec conformity). |
| [zoom-out](skills/zoom-out/) | Pull back from tactical loops to strategic context. |
| [narrow-first](skills/narrow-first/) | Acceptance-gated narrowing loop — broaden only after measured failure. |
| [handoff](skills/handoff/) | Compose context handoffs between sessions or agents. |

### MCP servers

| MCP | Source | Tools |
|---|---|---|
| [hugin-mcp](https://github.com/Ketlark/hugin-mcp) | `mcps/hugin-mcp/` (cloned by `setup.sh`) | `web_search`, `web_read` |
| [docs-proxy](mcps/docs-proxy/) | `mcps/docs-proxy/` (tracked) | `get_docs` |
| [pi-subagents](https://github.com/nicobailon/pi-subagents) | npm (user) | `subagent` tool, `/run`, `/chain`, `/parallel`, `/subagents-doctor` |

### Templates

Drop-in files for end-user projects. Not auto-installed — copy by hand into
the target project's root, then commit it there. The agent picks them up on
the next session in that project.

| Template | Drop into | Purpose |
|---|---|---|
| [AGENTS.md](templates/AGENTS.md) | `<your-project>/AGENTS.md` | Karpathy-inspired behavioural rules read by the agent on every session: think first, simplicity, surgical changes, goal-driven, fail loud. |

```bash
cp ~/path/to/agentic-swe-setup/templates/AGENTS.md /path/to/your-project/AGENTS.md
# Edit the file to match your project's conventions, then commit it.
```

## Architecture & contributing

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — layers, lifecycle, cross-package contracts.
- [`HOW-TO.md`](HOW-TO.md) — personal cheat-sheet: plan mode, skills, bash-guard, workflows.
- [`docs/FILE-BACKED-STATE.md`](docs/FILE-BACKED-STATE.md) — convention for raw trace storage (`.pi/traces/`).
- [`CHANGELOG.md`](CHANGELOG.md) — what's changed and why.
- [`docs/adr/`](docs/adr/) — Architectural Decision Records.
- [`docs/EXTENSION-AUTHORING.md`](docs/EXTENSION-AUTHORING.md), [`MCP-AUTHORING.md`](docs/MCP-AUTHORING.md), [`SKILL-AUTHORING.md`](docs/SKILL-AUTHORING.md) — how-to guides.
- New bash-guard rule? See [`extensions/bash-guard/README.md`](extensions/bash-guard/README.md#adding-a-rule).
- Plan mode internals? See [`extensions/plan-mode/`](extensions/plan-mode/) and [`docs/adr/0004-plan-mode-lifecycle.md`](docs/adr/0004-plan-mode-lifecycle.md).

To add a new MCP bridge: add an entry to `MCP_REPOS` in `setup.sh`, then write
a 25-line extension via `createMcpExtension(...)` from `lib/mcp-bridge`. See
the existing `extensions/hugin/` and `extensions/docs-proxy/` for canonical
examples.

## Requirements

- [Node.js](https://nodejs.org/) 22+
- [pi](https://github.com/earendil-works/pi-coding-agent) 0.74+
- [pnpm](https://pnpm.io/) 9+
- [Docker](https://www.docker.com/) (optional, for SearXNG behind hugin)

## License

MIT
