# Contributing

This is a personal Pi setup, but the engineering bar is the same as a small open-source tool. Everything below is enforced by tooling — if `pnpm validate` passes, you are good.

## Development setup

```bash
git clone git@github.com:Ketlark/agentic-swe-setup.git
cd agentic-swe-setup
pnpm install        # also installs git hooks via the `prepare` script
```

## Required toolchain

- Node 22+
- pnpm 9+
- Git 2.40+ (for `lefthook`)

Use the version pinned in `.nvmrc` / `.node-version`. If you have `fnm` or `nvm`, run `nvm use` (or equivalent).

## Day-to-day commands

| Command | What it does |
|---|---|
| `pnpm lint` | Biome check (read-only) |
| `pnpm lint:fix` | Biome check with auto-fixes |
| `pnpm format` | Biome format only |
| `pnpm typecheck` | `tsc --noEmit` against `tsconfig.json` |
| `pnpm test` | Vitest single run |
| `pnpm test:watch` | Vitest watch |
| `pnpm test:coverage` | Vitest with coverage thresholds |
| `pnpm validate` | Lint + typecheck + test (same as CI) |

## Code conventions

These are mechanically enforced unless noted:

- **No `any`** (`noExplicitAny: error` in Biome)
- **No `!` non-null assertion** (`noNonNullAssertion: error`)
- **Prefer `import type`** for type-only imports (`useImportType: error`)
- **`node:` protocol for built-ins** (`useNodejsImportProtocol: error`)
- **Tabs for indentation** (`.editorconfig`, Biome `indentStyle: "tab"`)
- **kebab-case** for file names (`.ts`)
- **PascalCase** for types/classes
- **camelCase** for variables and functions

Not mechanically enforced but expected on review:

- **No `as` type assertions** unless absolutely necessary; prefer narrowing or schema validation.
- **No `// @ts-ignore` / `// @ts-expect-error`** without an inline justification comment.

## Tests

- Co-locate tests in `__tests__/` next to the code under test.
- Vitest, AAA pattern.
- Coverage thresholds are enforced in `vitest.config.ts` and scoped to packages under `lib/**`. Extensions and MCP servers are exercised end-to-end on each `pi` launch (see the smoke-test flow in [HANDOFF.md](HANDOFF.md)) rather than unit-tested — keep that boundary unless an extension grows non-trivial domain logic worth isolating.

## Commits

Conventional commits, enforced by `lefthook` + `commitlint`. Allowed types: `feature`, `fix`, `refactor`, `chore`, `test`, `docs`, `perf`, `style`, `build`, `ci`.

```
feature(bash-guard): add rule for unsafe ssh forwarding
fix(hugin): handle stdio EPIPE on subprocess shutdown
docs(adr): record decision to use Biome over ESLint
```

Subject in imperative mood, max 100 characters, no trailing period. The first line is what shows up in `git log --oneline` — make it count.

## Branching

- `main` is the deployable trunk.
- Feature branches: `feature/<short-description>` or `feature/TNS-<id>-<desc>` if linked to a Linear issue.
- One PR = one logical change. If you find yourself writing "and also" in the description, split it.

## Adding things to the setup

| What you want to add | Where to look |
|---|---|
| Pi extension | [`docs/EXTENSION-AUTHORING.md`](docs/EXTENSION-AUTHORING.md) |
| MCP server bridge | [`docs/MCP-AUTHORING.md`](docs/MCP-AUTHORING.md) |
| Pi skill (markdown) | [`docs/SKILL-AUTHORING.md`](docs/SKILL-AUTHORING.md) |
| `bash-guard` rule | [`extensions/bash-guard/README.md#adding-a-rule`](extensions/bash-guard/README.md#adding-a-rule) |

## Architectural decisions

Any non-trivial choice (new dependency, layer change, new pattern) gets an ADR in [`docs/adr/`](docs/adr/). Use the [template](docs/adr/0000-template.md). Link the ADR from the PR description.

## What gets rejected

- A change with no test (unless purely docs/config) — coverage will drop and CI will fail.
- A `// @ts-ignore` with no justification.
- A god function: > 80 lines, more than one reason to change.
- A direct mutation of `event.input` without going through bash-guard's analysis pipeline first (cf. extension ordering in [ARCHITECTURE.md](ARCHITECTURE.md)).
