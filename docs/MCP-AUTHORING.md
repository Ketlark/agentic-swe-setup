# Authoring an MCP bridge

An MCP (Model Context Protocol) server exposes tools to the agent over JSON-RPC
stdio. This repo runs MCP servers as local subprocesses spawned by a Pi
extension built on `lib/mcp-bridge`.

Two flavours:

1. **External MCP** — server lives in another repo (e.g. `hugin-mcp`). Cloned via `setup.sh`, bridged via an extension here.
2. **Internal MCP** — server lives under `mcps/` here (e.g. `docs-proxy`). We own the code.

## Canonical examples (read these first)

| Bridge | What to learn |
|---|---|
| [`extensions/hugin/index.ts`](../extensions/hugin/index.ts) | External MCP, ~39 lines. Smart defaults from `label`. |
| [`extensions/docs-proxy/index.ts`](../extensions/docs-proxy/index.ts) | Internal MCP, ~24 lines. Override `statusCommand` for backward compat. |
| [`mcps/docs-proxy/`](../mcps/docs-proxy/) | Internal MCP server: `handlers/` (I/O), `text/` (pure transforms), `parsers/`, `security/`. |

## Bridge entry point

The whole bridge is a `createMcpExtension(config)` call:

```typescript
import { resolve, dirname } from "node:path";
import { createMcpExtension, resolveEntry } from "@swe/mcp-bridge";

const here = dirname(new URL(import.meta.url).pathname);
const entry = resolveEntry({
  envVar: "MY_MCP_PATH",
  candidates: [
    resolve(here, "../../mcps/my-mcp/dist/index.js"),
    resolve(here, "../my-mcp/dist/index.js"),
  ],
});

if (!entry) throw new Error("my-mcp not found — set MY_MCP_PATH or run setup.sh");

export default createMcpExtension({
  label: "my-mcp",          // → /my-mcp-status, log prefix, default tool label
  entry,
  // Optional overrides:
  // statusCommand: "my-status",
  // toolLabel: "MyMCP",
  // promptHint: { intro: "...", examples: ["..."] },
});
```

| Field | Default derived from `label` | Override when |
|---|---|---|
| `statusCommand` | `<label>-status` | Backward compat with an existing slash command. |
| `toolLabel` | Title-cased `label` | Brand displayed in the model's tool listing. |
| `promptHint` | none | You want the model to prefer this MCP for certain queries. |
| `clientInfo.name` / `version` | `pi-<label>` / `0.1.0` | The MCP server cares (rare). |

## Auto-clone (external MCPs only)

Add an entry to `MCP_REPOS` in [`setup.sh`](../setup.sh):

```bash
MCP_REPOS=(
  "https://github.com/<org>/<mcp-name>.git mcps/<mcp-name>"
)
```

`./setup.sh mcps` clones (or `git pull`s) and runs `pnpm install` inside.

## Internal MCP server layout

```
mcps/<name>/
├── src/
│   ├── index.ts            entry point — starts the server
│   ├── handlers/           tool implementations (one per surface)
│   ├── text/               pure text transforms (no I/O)
│   ├── parsers/            data shape transforms (HTML, etc.)
│   ├── security/           SSRF, validation
│   └── data/               static lookups
├── __tests__/
└── package.json
```

Keep modules small and pure where possible. The split between `handlers/` (I/O)
and `text/` or `parsers/` (pure) makes the latter trivially testable. See
[`mcps/docs-proxy/src/`](../mcps/docs-proxy/src/) for the canonical shape.

## Slash command

`createMcpExtension` registers `/<label>-status` automatically. It reports:

- whether the subprocess is connected
- number of tools discovered
- per-tool call count (session-scoped)

Override the command name via `statusCommand` if needed.

## Testing

- Unit-test handlers + pure transforms as plain functions (no MCP transport).
- For SSRF / parsing, test exhaustively — these are the security boundary.
- `lib/mcp-bridge` itself is exercised end-to-end on every Pi session start; no
  unit tests needed unless you change the bridge wiring.

## Checklist

- [ ] Extension uses `createMcpExtension` (no hand-rolled JSON-RPC).
- [ ] `resolveEntry` candidates work on both fresh clone (external) and zero-clone (internal) setups.
- [ ] `<MCP_NAME>_PATH` env var documented in extension README.
- [ ] If external: added to `MCP_REPOS` in `setup.sh`.
- [ ] `pnpm validate` passes.
- [ ] Listed in root `README.md` MCP table.
