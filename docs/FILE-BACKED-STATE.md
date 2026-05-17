# File-Backed State Convention

## Purpose

Context windows compact. Raw working memory — error logs, test output, search
results — survives on disk when conversation state does not. Stanford's
Meta-Harness confirms this: removing raw traces drops accuracy from 50 → 34.6%;
replacing them with summaries recovers only to 34.9%. The signal lives in the
raw detail.

This convention defines a single storage location for that raw working memory.
**Planning state lives in `.plans/`** (owned by the plan-mode extension, committed).
**Raw traces live in `.pi/traces/`** (gitignored, ephemeral).

## Convention

Long-running tasks write raw tool output to `.pi/traces/` in the project root.

```
.pi/
└── traces/
    ├── build-error-01.txt
    ├── test-run-03.txt
    └── search-results-api-calls.txt
```

## Rules

1. **Raw over summarised.** Save the raw tool output, not a paraphrase. If a
   trace is large, truncate with a clear marker:
   `[... 847 more lines — full output in .pi/traces/build-error-01.txt]`

2. **Path-addressable.** Stable, predictable names. A subagent can read
   `.pi/traces/test-run-03.txt` without discovering it first.

3. **Survives compaction.** After a compaction event, re-read the relevant
   trace files to re-orient without re-running the tool.

4. **Referenced, not duplicated.** When handing off (via the `handoff` skill
   or `START-PROMPT.md`), point the executor at `.pi/traces/` rather than
   pasting trace content inline.

5. **Clean up when done.** Delete traces at the end of the task. Stale traces
   from a prior task mislead the next one.

## Gitignore

Add to the project's `.gitignore`:

```
# Agent raw working memory (ephemeral)
.pi/
```

## Storage boundary

| Location | Owner | Committed | Contents |
|----------|-------|-----------|----------|
| `.plans/<name>/` | plan-mode extension | Yes | PLAN.md, START-PROMPT.md, decision artifacts |
| `.pi/traces/` | agent (this convention) | No | Raw tool output, error logs, measurements |

The two locations have disjoint scope. Traces exist outside plan-mode too —
debug sessions, ad-hoc diagnose runs, anything that produces reusable raw
output.
