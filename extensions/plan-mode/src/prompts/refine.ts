// Adversarial self-critique prompt with narrowing bias from narrow-first.
// Sent when the user picks "Refine Plan" from the human gate menu.

export function buildRefinePrompt(planDir: string): string {
	return `Review the plan in ${planDir}/PLAN.md with an adversarial lens.

Challenge it on two axes:

**Correctness** — find gaps, wrong assumptions, missing edge cases:
- Are any steps based on incorrect assumptions about the codebase?
- Are dependencies between steps correct?
- Could any step be misinterpreted?
- Are there missing error-handling steps?

**Scope** — bias toward the narrowest viable plan:
- For each step, ask: could this be eliminated or reduced without compromising the outcome?
- The shortest plan that achieves the goal is the best plan.
- Too-narrow recovers in one Refine cycle. Too-broad wastes execution tokens irreversibly.

After your review, update \`${planDir}/PLAN.md\` and \`${planDir}/START-PROMPT.md\` with improvements.`;
}
