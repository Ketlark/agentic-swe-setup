# Architecture Decision Records

This directory holds ADRs (Architecture Decision Records) for `agentic-swe-setup`.

Format: [MADR](https://adr.github.io/madr/) — Markdown, lightweight.

## Index

| # | Title | Status |
|---|---|---|
| [0000](0000-template.md) | Template (do not link from PRs) | n/a |
| [0001](0001-versioning-strategy.md) | Single fixed version | accepted |
| [0002](0002-biome-over-eslint.md) | Biome over ESLint + Prettier | accepted |
| [0003](0003-no-verifiers-without-data.md) | No verifiers or multi-candidate search without measured improvement | accepted |
| [0004](0004-plan-mode-lifecycle.md) | Plan-mode as runtime lifecycle layer (fork dreki-gg) | accepted |

## When to write an ADR

Write one when you decide:

- A new dependency that affects the whole project (linter, test runner, framework).
- A change to a layer boundary (move code between `extensions/`, `lib/`, `mcps/`).
- A non-obvious trade-off where the next contributor would ask "why?".

Skip it for:

- Renaming a function.
- Bumping a patch version of a dep.
- Cosmetic refactors.

## How to write one

```bash
cp docs/adr/0000-template.md docs/adr/NNNN-short-title.md
```

Number sequentially. Status starts at `proposed`, becomes `accepted` once merged. Never delete an ADR — supersede it with a new one and link both ways.
