# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to a single fixed version (see [ADR-0001](docs/adr/0001-versioning-strategy.md)).

## [Unreleased]

### Added

- TypeScript strict toolchain (`tsconfig.base.json`, per-package `tsconfig.json`).
- Biome 1.9 for linting and formatting (`biome.json`), tab indentation, no `any`, no `!`.
- Vitest 2.x with V8 coverage and 80%/75% thresholds (scoped to `lib/**`; extensions and MCP servers validated end-to-end).
- Lefthook git hooks: pre-commit (biome + typecheck), pre-push (vitest), commit-msg (conventional).
- GitHub Actions CI workflow (`.github/workflows/ci.yml`).
- `LICENSE` (MIT).
- `ARCHITECTURE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`.
- `docs/adr/` initialised with template + ADR-0001 (versioning) and ADR-0002 (Biome over ESLint).
- `docs/EXTENSION-AUTHORING.md`, `docs/MCP-AUTHORING.md`, `docs/SKILL-AUTHORING.md`.
- `extensions/bash-guard/README.md` — moved per-extension docs out of the root `README.md`.
- `.editorconfig`, `.nvmrc`, `.node-version`, `.vscode/{settings,extensions}.json`, `.gitignore`.

### Changed

- **`lib/mcp-bridge` deepened into a Pi-extension factory**: new `createMcpExtension(config)` and `resolveEntry(config)` helpers. The factory itself is split for clarity (`extension.ts` orchestrator + `tool-registration.ts` + `status-command.ts` + internal `types.ts`) and documented in a dedicated package `README.md`. `extensions/hugin` (167→39 lines) and `extensions/docs-proxy` (154→24 lines) reduced to pure config; ~250 lines of duplication eliminated. Adding a new MCP bridge now requires ~25 lines.
- **`bash-guard` rule scope unification**: `Rule` now carries `appliesIn?: "main" | "subagent" | "both"` (default `"both"`). The legacy `SUBAGENT_ONLY` regex list and `isCatastrophic()` are gone — `git commit/pull/push` blocking lives in a regular rule (`rules/subagent-only.ts`). `analyzeBashCommand(cmd, { mode })` is the single seam; the subagent guard calls it with `mode: "subagent"`. The hand-written `analyzeRaw` regex fallback is replaced by a fail-closed high-severity finding when `shell-quote` cannot parse — main mode prompts, subagent blocks. `analyze.ts` shrunk 91→48 lines.
- `__tests__/rules.test.ts` renamed to `__tests__/analyze.test.ts` (it tests the orchestrator, not individual rules) and extended with 7 new cases for the subagent scope.
- **`bash-guard` housekeeping**: `lifecycle.ts` → `session.ts` (was a misnomer — this file owns session state, not just lifecycle hooks); `registerLifecycle` → `registerSessionHooks`. `ABORT_MS` constant deduplicated (now exported from `session.ts`, single source of truth). `isOpToken` deduplicated (now lives in `types.ts` next to `Token`/`OpToken`).
- **`mcps/docs-proxy` I/O / pure split**: extracted `truncate`, `extractRelevantSections`, `processFetchedText` from `handlers/url.ts` into a new `text/processing.ts`. `handlers/url.ts` shrunk to pure HTTP I/O (~30 lines, uses `truncate` from the new module — DRY). `handlers/github.ts` updated import path.
- **Documentation deepening**: root `README.md` slimmed (extension internals moved to `extensions/bash-guard/README.md`; `templates/AGENTS.md` usage now documented explicitly as copy-by-hand); `ARCHITECTURE.md` updated (corrected `pi-subagents` placement under `mcps/`, added the `tools/list` JSON-RPC schema as a contract); `lib/mcp-bridge/README.md` added (package surface API + canonical examples). `docs/{EXTENSION,MCP,SKILL}-AUTHORING.md` rewritten with explicit pointers to canonical example files (drift-resistant). `docs/RULE-AUTHORING.md` removed — was stale (referenced non-existent `severity: "low"`, wrong file names, dead Phase-1 wording); the canonical "Adding a rule" section now lives in `extensions/bash-guard/README.md`. Stale "Phase 1" wording removed from `vitest.config.ts`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `docs/adr/0002` — the project's testing strategy is now described in steady-state terms.
- `package.json` license corrected from `ISC` to `MIT` (matches README and `LICENSE`).
- `pnpm-workspace.yaml` extended with `lib/*` and `mcps/docs-proxy`.
- **bash-guard refactored**: `analyze.ts` now delegates to a rule registry (`rules/destructive.ts`, `rules/elevated.ts`, `rules/sensitive.ts`) with try/catch fail-closed per rule.
- **bash-guard split**: `index.ts` (33 lines, wiring only) + `commands.ts` + `interceptor.ts` + `lifecycle.ts`.
- `mcp-client.ts` extracted to `lib/mcp-bridge/client.ts` with configurable label — shared by hugin and docs-proxy bridges.
- `mcps/docs-proxy/src/index.js` split into `handlers/github.js`, `handlers/url.js`, `handlers/library.js`, `security/ssrf.js`, `parsers/html.js`.
- `extensions/docs-proxy/` bridge created (mirrors hugin structure).
- `known-repos.json` moved from `src/` to `data/`.
- `allowlist.ts` catch-all errors now logged via `console.warn` instead of being silently swallowed.
- Fixed: `git branch`, `git stash`, `git reflog` removed from `GIT_READONLY` (they have destructive variants).
- `extensions/rtk-rewrite/` — transparent RTK proxy with timeout (500ms), cache (5s TTL), byte cap (64KB), fake-binary test suite.
- 9 skills vendored verbatim from [mattpocock/skills](https://github.com/mattpocock/skills) `e74f006` (MIT): diagnose, grill-me, grill-with-docs, handoff, zoom-out, review, improve-codebase-architecture, prototype, write-a-skill. `tdd` intentionally not vendored (see `skills/CREDITS.md`).
- 8 reference files vendored alongside their skills: `grill-with-docs/{ADR-FORMAT,CONTEXT-FORMAT}.md`, `improve-codebase-architecture/{DEEPENING,INTERFACE-DESIGN,LANGUAGE}.md`, `prototype/{LOGIC,UI}.md`, `diagnose/scripts/hitl-loop.template.sh`.
- `skills/CREDITS.md` with upstream attribution, commit pin, and explicit list of Pi-specific adaptations (Claude-only frontmatter stripped, broken `docs/agents/issue-tracker.md` and `/setup-matt-pocock-skills` references removed, `Agent` tool refs replaced with harness-agnostic phrasing).
