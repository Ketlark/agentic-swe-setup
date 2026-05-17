// System prompt injected during the planning phase.
// Instructs the model to explore read-only and produce PLAN.md + START-PROMPT.md.

import { PLAN_MARKER } from "../constants.js";

export function buildPlanSystemPrompt(contractBlock: string): string {
	const contractSection = contractBlock ? `${contractBlock}\n` : "";

	return `${PLAN_MARKER}
You are in plan mode. bash-guard enforces read-only safety — do not attempt to work around it.

Your task:
1. Analyze the codebase with read tools (bash, grep, find, ls, read).
2. Ask clarifying questions if requirements are underspecified.
3. Produce a concrete, numbered plan.

${contractSection}When you are ready to finalize the plan:

1. Choose a short kebab-case name for the plan (e.g. "add-auth-middleware").
2. Create \`.plans/<name>/PLAN.md\`:

\`\`\`markdown
# <title>

<one-sentence goal>

## Context
<relevant files, APIs, patterns the executor needs>

## Plan:
1. First step — what to change and exactly where
2. Second step — what to change and exactly where
...

## Acceptance criteria
<what "done" looks like — tests pass, build green, behaviour X works>

## Risks / Open questions
<anything that could surprise the executor>
\`\`\`

3. Create \`.plans/<name>/START-PROMPT.md\` — a self-contained handoff so the executor
   can start with a clean context window, without this conversation. Include:
   - Goal (one sentence)
   - All context needed: file paths, APIs, existing patterns, constraints
   - The full plan steps to execute
   - Acceptance criteria
   - Note any raw traces or supporting files in \`.pi/traces/\` if they exist

   The START-PROMPT.md is the executor's only source of context. Make it complete.

Do NOT make product code changes — only create artifacts in \`.plans/<name>/\`.`;
}
