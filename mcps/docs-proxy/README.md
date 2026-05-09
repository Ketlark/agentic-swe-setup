# docs-proxy

Single MCP tool that fetches documentation from GitHub repos, direct URLs, or a built-in library-name map. Pure HTTP — no external doc server dependency.

## How it works

One tool: `get_docs(query)`

```
Agent → get_docs("next.js middleware")
              │
              ├── GitHub repo ? ──→ fetch llms.txt / README from raw.githubusercontent.com
              ├── Direct URL ?  ──→ fetch + extract readable text (strip HTML)
              └── Library name ? ──→ known-repo map → GitHub fetch
```

## Query routing

| Query | Source |
|-------|--------|
| `"vercel/next.js"` | GitHub (explicit owner/repo) |
| `"https://github.com/prisma/prisma"` | GitHub (parsed from URL) |
| `"next.js"` | GitHub (vercel/next.js) via known repo map |
| `"prisma schema relations"` | GitHub + topic filter |
| `"https://docs.stripe.com/api"` | Direct URL fetch + HTML-to-text |
| `"unknown-lib"` | Helpful error with suggestions |

## Install

```bash
cd mcps/docs-proxy
pnpm install
```

## Test

```bash
pnpm test
```

## Run standalone

```bash
node src/index.js
```

## Configure in pi

Add to `.pi/settings.json` or project settings:

```json
{
  "mcpServers": {
    "docs-proxy": {
      "command": "node",
      "args": ["/path/to/mcps/docs-proxy/src/index.js"]
    }
  }
}
```

## Adding entries to the known-repo map

Edit `KNOWN_REPOS` in `src/index.js` to add new library-name → GitHub-repo mappings. The map covers the most popular JS/TS libraries. Contributions welcome.

## Response truncation

All responses are truncated to 8 KB to avoid context bloat. Topic extraction works on up to 12 KB of the source document for efficiency.
