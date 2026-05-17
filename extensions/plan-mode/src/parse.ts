// Plan text parsing: todo extraction from PLAN.md, [DONE:n] marker tracking,
// title extraction, and step text cleanup.
// Pure functions — no I/O, no state mutation.

import { DEFAULT_PLAN_TITLE } from "./constants.js";
import type { TodoItem } from "./types.js";

// ─── Plan title extraction ───────────────────────────────────────────────────

export function extractPlanTitle(planContent: string): string {
	const match = planContent.match(/^#\s+(.+)$/m);
	return match ? match[1].trim() : DEFAULT_PLAN_TITLE;
}

// ─── Todo extraction from PLAN.md ────────────────────────────────────────────

const MAX_STEP_LENGTH = 60;
const MIN_STEP_LENGTH = 4;
const NOISE_PREFIXES = ["`", "/", "-"];

function cleanStepText(text: string): string {
	let cleaned = text
		.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\s+/g, " ")
		.trim();

	if (cleaned.length > 0) {
		cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
	}
	if (cleaned.length > MAX_STEP_LENGTH) {
		cleaned = `${cleaned.slice(0, MAX_STEP_LENGTH - 3)}...`;
	}
	return cleaned;
}

export function extractTodoItems(planContent: string): TodoItem[] {
	const headerMatch = planContent.match(/\*{0,2}Plan:\*{0,2}\s*\n/i);
	if (!headerMatch) return [];

	const planSection = planContent.slice(
		planContent.indexOf(headerMatch[0]) + headerMatch[0].length,
	);
	const numberedPattern = /^\s*(\d+)[.)]\s+\*{0,2}([^*\n]+)/gm;
	const items: TodoItem[] = [];

	for (const match of planSection.matchAll(numberedPattern)) {
		const rawText = match[2].trim().replace(/\*{1,2}$/, "").trim();

		if (rawText.length <= MIN_STEP_LENGTH) continue;
		if (NOISE_PREFIXES.some((p) => rawText.startsWith(p))) continue;

		const cleaned = cleanStepText(rawText);
		if (cleaned.length <= MIN_STEP_LENGTH) continue;

		items.push({ step: items.length + 1, text: cleaned, completed: false });
	}

	return items;
}

// ─── [DONE:n] tracking ───────────────────────────────────────────────────────

export function extractDoneSteps(message: string): number[] {
	const steps: number[] = [];
	for (const match of message.matchAll(/\[DONE:(\d+)\]/gi)) {
		const step = Number(match[1]);
		if (Number.isFinite(step)) steps.push(step);
	}
	return steps;
}

export function markCompletedSteps(text: string, items: TodoItem[]): number {
	const doneSteps = extractDoneSteps(text);
	let marked = 0;
	for (const step of doneSteps) {
		const item = items.find((t) => t.step === step);
		if (item && !item.completed) {
			item.completed = true;
			marked++;
		}
	}
	return marked;
}
