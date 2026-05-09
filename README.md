# agentic-swe-setup

Pi coding agent configuration — extensions, skills, and project templates.

[Pi](https://github.com/earendil-works/pi-coding-agent) is a terminal-based coding agent. This repo holds a portable setup you can clone on any machine and start working immediately.

## What's inside

### Extensions

| Extension | Purpose |
|---|---|
| [bash-guard](extensions/bash-guard/) | Intercepts dangerous shell commands before they run. Interactive overlay prompts the user; non-interactive subagents get hard-blocked on catastrophic operations. |
| [hugin](extensions/hugin/) | Bridges [hugin-mcp](https://github.com/Ketlark/hugin-mcp) into pi. Provides `web_search` (70+ engines via SearXNG) and `web_read` (14+ specialized handlers). 100% local, zero API keys. |

### Skills

| Skill | Purpose |
|---|---|
| [no-slop](skills/no-slop/) | Anti-AI-writing-patterns enforcement. Activates on every prose output — commits, PRs, docs, READMEs, reviews. Banned vocabulary, structural variety, authentic voice. |

### Templates

| Template | Purpose |
|---|---|
| [AGENTS.md](templates/AGENTS.md) | Project-level agent configuration. Copy to a project root to guide coding agents. |

## Install

```bash
git clone git@github.com:Ketlark/agentic-swe-setup.git
cd agentic-swe-setup
./setup.sh
```

The script:

1. Checks that [pi](https://github.com/earendil-works/pi-coding-agent) is installed
2. Creates `~/.config/pi-coding-agent` and symlinks `settings.json` into it
3. Installs peer dependencies (`pnpm install`)
4. Validates the setup

After that, launch pi from this directory:

```bash
pi
```

Pi reads `settings.json` from the working directory and loads extensions and skills relative to it.

## bash-guard

The main extension. Intercepts every `bash` tool call issued by the agent and runs risk analysis before execution.

### How it works

```
Agent issues bash tool call
        │
        ▼
   Allowlist match? ──yes──▶ Allow silently
        │
        no
        ▼
   Analyze command
   (shell-quote tokenizer)
        │
   Risk found?
   ├─ no  → Allow silently
   └─ yes → Show interactive overlay
            ├─ Allow once
            ├─ Allow session  (similar commands skip prompt)
            ├─ Allow always   (persist rule to ~/.pi/)
            └─ Abort         (block + tell agent)
```

In **subagent mode** (non-interactive), the overlay is replaced by hard-blocks on catastrophic operations — no prompting possible.

### Slash commands

| Command | Description |
|---|---|
| `/bash-guard-stats` | Session statistics (allowed, blocked, top reasons) |
| `/bash-guard-yolo` | Toggle YOLO mode (skip all checks) |
| `/bash-guard-allow <regex> [session\|always]` | Add a pattern to the allowlist |
| `/bash-guard-remove <pattern>` | Remove a rule |
| `/bash-guard-rules` | List all active rules |
| `/bash-guard-clear [session\|always\|all]` | Clear rules |

### Flags

| Flag | Default | Description |
|---|---|---|
| `--bash-guard-yolo` | off | Start in YOLO mode |
| `--bash-guard-auto-allow` | off | Auto-allow flagged commands when no UI |

### Architecture

```
extensions/bash-guard/
├── index.ts       Entry point — event handlers, commands, flags
├── analyze.ts     Command tokenizer + risk rules (shell-quote)
├── allowlist.ts   Pattern allowlist (session + always, pre-compiled regex)
├── ui.ts          Interactive overlay (bottom-anchored SelectList)
├── subagent.ts    Subagent hard-block (delegates to analyze.ts)
├── types.ts       Shared types and constants
└── package.json
```

### What gets flagged

- **File deletion**: `rm -rf`, `find -delete`, `truncate`
- **Privilege escalation**: `sudo`, `doas`, `su`
- **Disk operations**: `dd`, `mkfs`, `wipefs`, `diskutil erase`, `parted`
- **Destructive git**: `push --force`, `reset --hard`, `clean -f`, `filter-branch`
- **In-place modification**: `sed -i`, `perl -i`
- **Pipe to shell**: `curl | bash`, `wget | sh`
- **Permissions**: `chmod 777`, `chown -R`
- **Package publish**: `npm publish`, `cargo publish`, `yarn publish`
- **Container/infra teardown**: `kubectl delete`, `terraform destroy`, `docker system prune`
- **Sensitive file access**: `.env`, `.ssh/`, `.pem`, credentials

Read-only git commands (`status`, `log`, `diff`, `branch`, `tag`, …) are whitelisted and never flagged.

## no-slop skill

A writing-quality skill that activates on every prose output. Enforces:

- Banned vocabulary (80+ words, 50+ phrases)
- No anaphora, no sentence starters from a fixed set
- Structural variety in paragraph length
- Plain jargon instead of marketing speak
- Authentic voice, no filler

See [skills/no-slop/SKILL.md](skills/no-slop/SKILL.md) for the full rule set.

## Project structure

```
agentic-swe-setup/
├── settings.json           Pi configuration (extensions, skills, model)
├── setup.sh                Install script
├── extensions/
│   ├── bash-guard/         Shell command safety net
│   └── hugin/              hugin-mcp bridge (web search + reader)
├── skills/
│   └── no-slop/            Anti-AI-writing enforcement
│       ├── SKILL.md
│       └── references/
│           ├── banned-words.md
│           └── examples.md
├── templates/
│   └── AGENTS.md           Project-level agent config template
└── bin/                    Local CLI tools (fd, etc.)
```

## hugin

Bridges [hugin-mcp](https://github.com/Ketlark/hugin-mcp) — a local MCP server for web search and reading — into pi as native tools.

### Setup

Clone hugin-mcp next to this repo (or set `HUGIN_MCP_PATH`):

```bash
cd /path/to/agentic-swe-setup/..
git clone https://github.com/Ketlark/hugin-mcp.git
cd hugin-mcp && npm install
```

Optional — start SearXNG for full search (70+ engines):

```bash
cd hugin-mcp && docker compose up -d
```

Without SearXNG, hugin falls back to Bing scraping automatically.

### How it works

The extension spawns hugin-mcp as a subprocess at session start, discovers its tools via `tools/list`, and registers each one with `pi.registerTool`. Communication is JSON-RPC 2.0 over stdio — no HTTP, no SDK dependency.

### Tools

| Tool | Description |
|---|---|
| `web_search` | Search the web via SearXNG (70+ engines) or Bing fallback. Cached 24h. |
| `web_read` | Read any URL → clean markdown. 14+ specialized site handlers. Batch mode. |

See the [hugin-mcp README](https://github.com/Ketlark/hugin-mcp) for full parameter docs.

### Slash commands

| Command | Description |
|---|---|
| `/hugin-status` | Connection status, tool count, call stats |

## Requirements

- [Node.js](https://nodejs.org/) 22+
- [pi](https://github.com/earendil-works/pi-coding-agent) 0.74+
- [pnpm](https://pnpm.io/) 9+
- [hugin-mcp](https://github.com/Ketlark/hugin-mcp) (cloned next to this repo, or set `HUGIN_MCP_PATH`)
- [Docker](https://www.docker.com/) (optional, for SearXNG)

## License

MIT
