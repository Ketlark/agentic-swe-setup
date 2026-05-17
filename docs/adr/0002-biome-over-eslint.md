# ADR-0002: Biome over ESLint + Prettier

- Status: accepted
- Date: 2026-05-12

## Context

The project needs a linter and a formatter. Two practical options in 2026:

1. ESLint (with `typescript-eslint`) + Prettier — the historical default.
2. Biome — a single Rust-based binary that does both.

The project is small (~10 packages, ~3k LOC). Tooling overhead matters.

## Decision

Use Biome 1.9 for both linting and formatting.

## Alternatives considered

- **ESLint + Prettier** — battle-tested, larger ecosystem, but two configs, two binaries, slow on large repos, and `typescript-eslint` requires a TS program for type-aware rules (extra setup). For a personal setup that values low ceremony, the gain is minimal.
- **Biome with `noExplicitAny` only, formatting elsewhere** — adds a second tool for no reason.
- **dprint** — no built-in linter, would still need another tool.

## Consequences

### Good

- Single binary, single config (`biome.json`), single command (`biome check`).
- Faster than ESLint+Prettier by an order of magnitude on this codebase.
- Native LSP via the `biomejs.biome` VS Code extension.
- `biome ci` is purpose-built for CI (no auto-fix, exit code on diff).

### Bad / risky

- Smaller plugin ecosystem than ESLint. If we ever need a custom rule (e.g. forbid `as`), we cannot write it as a Biome plugin yet — must rely on convention + review.
- Some teammates may expect ESLint and need to install a different VS Code extension. Documented in `.vscode/extensions.json`.
