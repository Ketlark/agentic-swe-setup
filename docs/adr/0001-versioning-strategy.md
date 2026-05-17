# ADR-0001: Single fixed version for the whole repo

- Status: accepted
- Date: 2026-05-12

## Context

This repo holds several packages (extensions, libs, MCPs) that are only ever consumed together. They are not published to npm individually. They evolve as one unit.

The two obvious models are:

1. Independent semver per package (Lerna / changesets-style).
2. A single version tag on the root, mirrored in each package or omitted entirely.

## Decision

We use a single version, set on the root `package.json`. Internal packages (`lib/*`, `extensions/*`, `mcps/*`) keep their own `version` field for tooling compatibility but it is not bumped independently.

The repo as a whole follows semver in spirit:

- Major: breaking change to the user-visible setup (e.g. `settings.json` schema break, removed extension).
- Minor: new extension, new skill, new MCP, new feature.
- Patch: bugfixes, internal refactors.

## Alternatives considered

- **Independent versions via changesets** — overkill for a 4-package internal tool. Would force ceremony (changeset files, release notes per package) for zero gain since nothing is published.
- **No version at all** — breaks pnpm/Node tooling that expects a `version` field.

## Consequences

### Good

- Zero release ceremony.
- `CHANGELOG.md` at the root is the single source of truth.
- A `git tag v0.X.Y` is enough to pin a known-good combination.

### Bad / risky

- If a single package ever needs to be published to npm, this decision must be revisited (likely superseded by an ADR adopting changesets).
