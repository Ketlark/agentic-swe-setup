# Authoring a Pi extension

A Pi extension is a TypeScript module that registers tools, slash commands, and
event handlers (`tool_call`, `session_start`, `session_shutdown`). Pi loads it
at session start.

For the upstream Pi API reference, see the
[pi-coding-agent extensions docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).

## Canonical examples (read these first)

| Extension | Use as a template for |
|---|---|
| [`extensions/rtk-rewrite/`](../extensions/rtk-rewrite/) | A simple `tool_call` mutator. ~46-line `index.ts`. |
| [`extensions/bash-guard/`](../extensions/bash-guard/) | Multi-file extension with rules engine, slash commands, interactive UI, subagent fallback. |
| [`extensions/hugin/`](../extensions/hugin/) | MCP bridge — see [`MCP-AUTHORING.md`](MCP-AUTHORING.md) instead. |

Copy the closest match, rename, then edit. Faster than starting from a blank file.

## File layout

```
extensions/<name>/
├── index.ts          default export — wiring only
├── package.json      name, type: "module", peerDeps on pi
├── tsconfig.json     extends ../../tsconfig.base.json
├── README.md         what this extension does (only if non-trivial)
└── __tests__/        vitest, only for non-trivial logic
```

## Minimal `package.json`

```json
{
  "name": "pi-<name>",
  "private": true,
  "type": "module",
  "description": "What this extension does in one sentence.",
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "^0.74.0",
    "@earendil-works/pi-tui": "^0.74.0"
  },
  "pi": { "extensions": ["./index.ts"] }
}
```

## Wiring vs logic

Keep `index.ts` thin — only `register*` calls and imports from sibling files.
Real logic goes in:

- `interceptor.ts` — `pi.on("tool_call")` handlers
- `commands.ts` — slash command handlers
- `session.ts` — `session_start` / `session_shutdown` hooks + per-session state
- Domain files (`rules/`, `handlers/`, etc.)

## Mutating `tool_call` input

`event.input` is mutable. Extensions run in `settings.json` order, so a later
extension sees the mutations of earlier ones (this is how `rtk-rewrite` runs
*after* `bash-guard` — see [ARCHITECTURE.md § Extension ordering](../ARCHITECTURE.md#extension-ordering)).
To block instead of mutate, return `{ block: true, reason: "..." }` from the
handler.

## Subagent awareness

Pi can spawn subagents (non-interactive child sessions). They cannot prompt the
user. If your extension shows interactive UI, gate it behind `ctx.hasUI` and
provide a non-interactive fallback (hard-block, auto-allow flag, etc.). See
[`extensions/bash-guard/subagent.ts`](../extensions/bash-guard/subagent.ts) for
the canonical pattern (separate handler registered when `PI_SUBAGENT_DEPTH >= 1`).

## Slash commands

Prefix with the extension name to avoid collisions:
`/bash-guard-stats`, `/rtk-status`, `/hugin-status`, `/docs-status`.

## Configuration

Use environment variables prefixed with `<EXT>_` (e.g. `HUGIN_MCP_PATH`).
Document them in the extension's README.

## Registering the extension

Add it to `settings.json`:

```json
{ "extensions": ["extensions/bash-guard", "extensions/<name>"] }
```

## Checklist before opening a PR

- [ ] `index.ts` is wiring-only.
- [ ] Non-trivial sibling modules have focused unit tests (skip for one-shot wiring).
- [ ] README explains what the extension does + slash commands + env vars (skip for trivial extensions).
- [ ] `pnpm validate` passes.
- [ ] Added to `settings.json` and to the table in the root `README.md`.
- [ ] CHANGELOG `[Unreleased]` updated.
