# agentic-swe-setup

Pi coding agent configuration — extensions, skills, and project templates.

[Pi](https://github.com/earendil-works/pi-coding-agent) is a terminal-based coding agent. This repo holds a portable setup you can clone on any machine and start working immediately.

## What's inside

### Extensions

| Extension | Purpose |
|---|---|
| [bash-guard](extensions/bash-guard/) | Intercepts dangerous shell commands before they run. Interactive overlay prompts the user; non-interactive subagents get hard-blocked on catastrophic operations. |
| [web-search](extensions/web-search/) | `web_search` tool backed by Z.AI's MCP server. Structured results with domain and recency filters. |
| [web-reader](extensions/web-reader/) | `web_read` tool backed by Z.AI's MCP server. Fetches any URL and returns markdown or plain text. |

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
│   ├── web-search/         Z.AI web search tool
│   └── web-reader/         Z.AI web reader tool
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

## Requirements

- [Node.js](https://nodejs.org/) 22+
- [pi](https://github.com/earendil-works/pi-coding-agent) 0.74+
- [pnpm](https://pnpm.io/) 9+
- API keys for Z.AI web-search and web-reader extensions (see `.env`)

## License

MIT
