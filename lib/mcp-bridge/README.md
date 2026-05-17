# @swe/mcp-bridge

Internal workspace package — shared MCP integration primitives for Pi
extensions. Not published.

Two pieces of public surface:

| Export | Purpose |
|---|---|
| `createMcpExtension(config)` | Factory turning an MCP server config into a complete Pi extension (lifecycle + tool registration + `/<label>-status` slash command). |
| `resolveEntry({ envVar, candidates })` | Helper to locate an MCP server's entry point — env-var override first, then first existing candidate path. |

Plus the lower-level `McpStdioClient` for ad-hoc JSON-RPC needs (rarely used
directly — the factory wraps it).

## Canonical examples

The fastest way to use this package is to copy one of the live consumers:

| Consumer | Use as a template for |
|---|---|
| [`extensions/hugin/index.ts`](../../extensions/hugin/index.ts) | External MCP cloned via `setup.sh`. ~39 lines. |
| [`extensions/docs-proxy/index.ts`](../../extensions/docs-proxy/index.ts) | Internal MCP shipped in `mcps/`. ~24 lines. Overrides `statusCommand` for backward compat. |

## `createMcpExtension(config)`

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

export default createMcpExtension({
  label: "my-mcp",
  entryPoint: entry,
  notFoundMessage: [
    "[my-mcp] entry point not found.",
    "Set MY_MCP_PATH or run ./setup.sh mcps to clone it.",
  ],
});
```

### Config fields

| Field | Required | Default | Notes |
|---|---|---|---|
| `label` | yes | — | Used in logs, `clientInfo.name`, status command name, prompt copy. |
| `entryPoint` | yes | — | Pass `null` to surface a friendly "not found" message via `notFoundMessage`. |
| `notFoundMessage` | yes | — | Shown to the user when `entryPoint` is null. `string` or `string[]` (joined with `\n`). |
| `spawn` | no | `{ command: "node", args: [] }` | Override to spawn under `python`, `bun`, etc. |
| `clientInfo` | no | `{ name: "pi-${label}", version: "1.0.0" }` | Override when the MCP server cares (rare). |
| `statusCommand` | no | `${label}-status` | Override to preserve a legacy slash command name. |
| `promptHint` | no | neutral copy | Override to bias the model toward this MCP for certain queries. |

### Lifecycle

1. **`session_start`** — spawn subprocess, JSON-RPC handshake, call `tools/list`, register every discovered tool with `pi.registerTool`. If `entryPoint` is null, surface `notFoundMessage` and skip the rest.
2. **`tool_call`** — Pi routes calls to the registered tool; the bridge proxies them as JSON-RPC `tools/call` against the subprocess. Errors and cancellations are surfaced as `isError: true` results so the model can recover.
3. **`session_shutdown`** — disconnect the subprocess.

### Slash command

Auto-registered: `/<label>-status` (or `statusCommand` override). Reports
connection state, entry-point path, call counter, and error counter.

## `resolveEntry(config)`

```typescript
const entry = resolveEntry({
  envVar: "HUGIN_MCP_PATH",
  candidates: [
    resolve(here, "../../mcps/hugin-mcp/dist/index.js"),
    resolve(here, "../hugin-mcp/dist/index.js"),
  ],
});
// entry: string | null
```

Returns the first existing path. `envVar` (if set) wins over the candidates list.

## Module layout

```
lib/mcp-bridge/
├── index.ts              barrel — package's public surface
├── extension.ts          createMcpExtension orchestrator (lifecycle + wiring)
├── tool-registration.ts  registerMcpTool helper — schema translation, execute() wrapper, prompt hints
├── status-command.ts     /<label>-status registration
├── discover.ts           resolveEntry helper
├── client.ts             low-level McpStdioClient (JSON-RPC over stdio)
├── types.ts              internal Stats type
└── package.json
```

`tool-registration.ts`, `status-command.ts`, and `types.ts` are internal —
they are NOT exported from the package barrel. Consumers always go through
`@swe/mcp-bridge` or one of the explicitly exported subpaths
(`@swe/mcp-bridge/client`, `@swe/mcp-bridge/discover`, `@swe/mcp-bridge/extension`).

## Testing

No unit tests in this package. The factory is exercised end-to-end every Pi
session, and the surface is small enough to validate via the smoke test
documented in [`HANDOFF.md`](../../HANDOFF.md) (or, post-handoff, by running
`/hugin-status` and `/docs-status` after a `pi` launch).
