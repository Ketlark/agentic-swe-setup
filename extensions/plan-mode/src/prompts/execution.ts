// System prompt injected during the execution phase, and the fallback prompt
// used when START-PROMPT.md is missing or empty.

import type { TodoItem } from "../types.js";

export function buildExecSystemPrompt(remainingTodos: readonly TodoItem[]): string {
	const todoList = remainingTodos.map((t) => `${t.step}. ${t.text}`).join("\n");

	return `[EXECUTING PLAN — full tool access]

Remaining steps:
${todoList}

Execute each step in order. Mark each step done with [DONE:n] before moving to the next.
Write raw tool output (error logs, test results) to .pi/traces/ — they survive compaction.`;
}

export function buildExecFallbackPrompt(planMdPath: string): string {
	return `Execute the plan in ${planMdPath}. Read it first, then work through each step in order. Mark each step done with [DONE:n] before moving to the next.`;
}
