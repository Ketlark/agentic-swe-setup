# Authoring a Pi skill

A Pi skill is a markdown file with YAML frontmatter that activates on certain
prompts. No code, no compilation. The agent reads `SKILL.md` and follows it.

## Canonical examples

- [`skills/no-slop/`](../skills/no-slop/) — `SKILL.md` (rules) + `references/{banned-words,examples}.md` (catalogues). Good shape for a self-authored skill with bulky reference material.
- [`skills/improve-codebase-architecture/`](../skills/improve-codebase-architecture/) — `SKILL.md` + `DEEPENING.md` + `INTERFACE-DESIGN.md` + `LANGUAGE.md`. Good shape for a methodology skill with multiple lenses.
- [`skills/CREDITS.md`](../skills/CREDITS.md) — attribution conventions for vendored skills (most come from [mattpocock/skills](https://github.com/mattpocock/skills)).

## File layout

```
skills/<name>/
├── SKILL.md          frontmatter + instructions
└── references/       optional supporting files
    ├── *.md
    └── ...
```

## SKILL.md frontmatter

```markdown
---
name: <name>
description: One-sentence description of when this skill activates.
---

# Skill: <Display Name>

## When to use
- Bullet of trigger conditions.

## How to use
1. Step one.
2. Step two.

## References
- [tests.md](references/tests.md) — when to use this reference file.
```

The `name` field must match the directory name. The `description` is what the
agent reads to decide whether to load the skill — be precise. Vague
descriptions cause unwanted activations.

## Reference files

If your skill is longer than ~100 lines, split it. Long-form content goes into
`references/*.md` (or sibling `*.md` files at the skill root, as
`improve-codebase-architecture` does), with `SKILL.md` linking to each with a
one-line summary of when it applies. This keeps the default load cheap and
lets the agent fetch detail on demand.

## Naming

- Directory: kebab-case (`no-slop`, `grill-with-docs`).
- Reference files: usually UPPERCASE for "format" docs (`CONTEXT-FORMAT.md`, `ADR-FORMAT.md`) and lowercase for guides (`tests.md`, `mocking.md`). Match the source skill if you are porting one.

## Adapting external skills

Many skills come from [mattpocock/skills](https://github.com/mattpocock/skills).
When adapting:

- Keep the structure identical when possible — don't rewrite for the sake of it.
- Strip Claude-specific directives (`disable-model-invocation: true`, `Agent` tool refs).
- Replace tool-specific commands with their Pi equivalents (`Agent` → pi-subagents `/run` / `/parallel`).
- Strip refs to project files that don't exist in this repo.
- Document the adaptation in [`skills/CREDITS.md`](../skills/CREDITS.md) with the upstream commit pinned.

## Registering the skill

```json
{ "skills": ["skills/no-slop", "skills/<name>"] }
```

Path is relative to the repo root.

## Verifying

There is no automated test for skills. Verify manually:

1. Start `pi` from the repo root.
2. Issue a prompt that should trigger the skill.
3. Check the agent loaded `SKILL.md` (Pi shows skill loads in its trace).
4. Iterate on the description if the skill loads too often or never.

## Checklist

- [ ] `SKILL.md` has frontmatter with `name` and `description`.
- [ ] Description is precise (no false positives, no false negatives).
- [ ] Long content lives in reference files.
- [ ] No Claude-specific directives left (for vendored skills).
- [ ] Registered in `settings.json`.
- [ ] Listed in root `README.md` skills table.
- [ ] If vendored: documented in `skills/CREDITS.md`.
- [ ] CHANGELOG `[Unreleased]` updated.
