# Credits

Skills in this directory are adapted from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT License).

Vendored from upstream commit [`e74f006`](https://github.com/mattpocock/skills/tree/e74f0061bb67222181640effa98c675bdb2fdaa7) on 2026-05-13.

## Vendored skills

| Skill | Source | Reference files |
|---|---|---|
| diagnose | [engineering/diagnose](https://github.com/mattpocock/skills/tree/main/skills/engineering/diagnose) | `scripts/hitl-loop.template.sh` |
| grill-me | [productivity/grill-me](https://github.com/mattpocock/skills/tree/main/skills/productivity/grill-me) | — |
| grill-with-docs | [engineering/grill-with-docs](https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs) | `ADR-FORMAT.md`, `CONTEXT-FORMAT.md` |
| handoff | [productivity/handoff](https://github.com/mattpocock/skills/tree/main/skills/productivity/handoff) | — |
| improve-codebase-architecture | [engineering/improve-codebase-architecture](https://github.com/mattpocock/skills/tree/main/skills/engineering/improve-codebase-architecture) | `DEEPENING.md`, `INTERFACE-DESIGN.md`, `LANGUAGE.md` |
| prototype | [engineering/prototype](https://github.com/mattpocock/skills/tree/main/skills/engineering/prototype) | `LOGIC.md`, `UI.md` |
| review | [in-progress/review](https://github.com/mattpocock/skills/tree/main/skills/in-progress/review) | — |
| write-a-skill | [productivity/write-a-skill](https://github.com/mattpocock/skills/tree/main/skills/productivity/write-a-skill) | — |
| zoom-out | [engineering/zoom-out](https://github.com/mattpocock/skills/tree/main/skills/engineering/zoom-out) | — |

## Pi-specific adaptations

`SKILL.md` files are vendored verbatim except for the following minimal Claude → Pi adaptations (per [`docs/SKILL-AUTHORING.md`](../docs/SKILL-AUTHORING.md)):

- `zoom-out`: removed `disable-model-invocation: true` frontmatter (Claude-only directive).
- `handoff`: removed `argument-hint` frontmatter (Claude slash-command directive); rephrased the description so Pi's auto-load matches on "switching sessions / handing off / compacting context".
- `review`: removed references to `/setup-matt-pocock-skills` and `docs/agents/issue-tracker.md` (not part of this repo); replaced "two `Agent` tool calls" with a harness-agnostic note about Pi's subagent mechanism (`PI_SUBAGENT_DEPTH` + `bash-guard` subagent hard-block).
- `improve-codebase-architecture`: replaced "Agent tool with `subagent_type=Explore`" with a harness-agnostic equivalent (in `SKILL.md` and `INTERFACE-DESIGN.md`).

All other content (workflow steps, philosophies, checklists, examples) is preserved verbatim.

## Original skill (not from mattpocock)

| Skill | Source |
|---|---|
| no-slop | Original — anti-AI-writing enforcement |

## Intentionally not vendored

| Skill | Reason |
|---|---|
| `engineering/tdd` (+ 5 reference files) | Not aligned with the maintainer's preferred workflow. Re-import from upstream commit `e74f006` if needed. |
