# bash-guard

Intercepts every `bash` tool call before execution and runs risk analysis. The
agent gets either silent passthrough (safe), an interactive overlay prompt
(risky in main session), or a hard block (risky in non-interactive subagent).

## Decision flow

```
Agent issues bash tool call
        │
        ▼
   Allowlist match? ──yes──▶ Allow silently
        │
        no
        ▼
   Tokenize (shell-quote)
   + run rule registry
        │
   Finding?
   ├─ no                                 → Allow silently
   └─ yes (severity = medium | high)
        │
   ┌────┴─────┐
   │ main UI? │
   ├──yes──── Show interactive overlay
   │          ├─ Allow once
   │          ├─ Allow session  (similar commands skip prompt)
   │          ├─ Allow always   (persist to ~/.pi/)
   │          └─ Abort         (block + tell agent, remembered 60s)
   │
   ├──no, --bash-guard-auto-allow → Allow
   ├──no                          → Block (forces user to flip a flag)
   └──subagent context, severity=high → Block hard (no prompt possible)
```

## What gets flagged

| Category | Examples |
|---|---|
| File deletion | `rm -rf`, `find -delete`, `truncate` |
| Privilege escalation | `sudo`, `doas`, `su` |
| Disk operations | `dd`, `mkfs`, `wipefs`, `diskutil erase`, `parted` |
| Destructive git | `push --force`, `reset --hard`, `clean -f`, `filter-branch` |
| In-place modification | `sed -i`, `perl -i` |
| Pipe-to-shell | `curl ... \| bash`, `wget ... \| sh` |
| Permissions | `chmod 777`, `chown -R` |
| Package publish | `npm publish`, `cargo publish`, `yarn publish` |
| Container / infra teardown | `kubectl delete`, `terraform destroy`, `docker system prune` |
| Sensitive file access | `.env`, `.ssh/`, `.pem`, credentials |
| Subagent-only block | `git commit`, `git pull`, `git push` (main session must drive these) |

Read-only git commands (`status`, `log`, `diff`, `branch`, `tag`, …) are
whitelisted and never flagged.

## Slash commands

| Command | Description |
|---|---|
| `/bash-guard-stats` | Session statistics (allowed, blocked, top reasons) |
| `/bash-guard-yolo` | Toggle YOLO mode (skip all checks) |
| `/bash-guard-allow <regex> [session\|always]` | Add a pattern to the allowlist |
| `/bash-guard-remove <pattern>` | Remove a rule |
| `/bash-guard-rules` | List all active rules |
| `/bash-guard-clear [session\|always\|all]` | Clear rules |

## Flags

| Flag | Default | Description |
|---|---|---|
| `--bash-guard-yolo` | off | Start in YOLO mode |
| `--bash-guard-auto-allow` | off | Auto-allow flagged commands when no UI is available |

## Module layout

```
extensions/bash-guard/
├── index.ts        Entry point — wires session/interceptor/commands
├── session.ts      Session state (stats, allowlist, recently-aborted) + start/shutdown hooks
├── interceptor.ts  tool_call hook — allowlist → analyze → prompt
├── analyze.ts      shell-quote tokenizer; delegates to rules/registry
├── rules/
│   ├── registry.ts       Orchestration + scope filtering (main / subagent / both)
│   ├── destructive.ts    rm, git push --force, dd, kubectl delete, …
│   ├── elevated.ts       sudo, chmod 777, kill -9, iptables, …
│   ├── sensitive.ts      Reads of .env, .ssh/, .pem, credentials
│   └── subagent-only.ts  git commit/pull/push (main-session only)
├── allowlist.ts    Pattern allowlist (session + always, pre-compiled regex)
├── ui.ts           Interactive overlay (bottom-anchored SelectList)
├── subagent.ts     Subagent guard — analyzeBashCommand({ mode: "subagent" })
├── commands.ts     Slash commands
└── types.ts        Rule + protocol types + shared helpers (isOpToken)
```

## Adding a rule

```ts
// extensions/bash-guard/rules/my-rule.ts
import type { Rule } from "../types.js";

export const myRules: Rule[] = [
  {
    id: "destructive.my-tool",
    appliesIn: "both", // "main" | "subagent" | "both" — defaults to "both"
    match: (ctx) => ctx.cmd === "my-tool" && ctx.hasFlag("--purge"),
    analyze: () => ({ severity: "high", reasons: ["my-tool --purge wipes data"] }),
  },
];
```

Then add `...myRules` to the `ALL_RULES` list in `rules/registry.ts`. That's
the entire surface — no boilerplate, no glue, no separate test file required
unless your rule has interesting boundary cases.
