// Post-agent handler: checks execution completion or presents the human gate
// menu (Execute / Refine / Follow up / Exit) when a plan is ready.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { updatePlansManifest } from "../manifest.js";
import { extractTodoItems } from "../parse.js";
import { buildExecFallbackPrompt, buildRefinePrompt } from "../prompts/index.js";
import {
	type State,
	completeExecution,
	exitPlanMode,
	startExecution,
} from "../state.js";
import { MESSAGE_TYPE, toPlanName } from "../constants.js";
import { notifyTransition, updateUI } from "../ui.js";

export function registerAgentEnd(pi: ExtensionAPI, state: State): void {
	pi.on("agent_end", async (_event, ctx) => {
		if (state.phase === "executing") {
			await handleExecutionEnd(pi, ctx, state);
			return;
		}
		if (state.phase === "planning" && ctx.hasUI && state.planDir) {
			await handlePlanReady(pi, ctx, state);
		}
	});
}

// ─── Execution completion ────────────────────────────────────────────────────

async function handleExecutionEnd(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: State,
): Promise<void> {
	if (state.todos.length === 0 || !state.todos.every((t) => t.completed)) return;

	if (state.planDir) {
		await updatePlansManifest(toPlanName(state.planDir), "done");
	}

	const summary = state.todos.map((t) => `~~${t.text}~~`).join("\n");
	pi.sendMessage(
		{
			customType: MESSAGE_TYPE.COMPLETE,
			content: `**Plan Complete!** ✓\n\n${summary}`,
			display: true,
		},
		{ triggerTurn: false },
	);

	await completeExecution(pi, ctx, state);
	updateUI(ctx, state);
}

// ─── Human gate menu ─────────────────────────────────────────────────────────

async function handlePlanReady(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: State,
): Promise<void> {
	const planDir = state.planDir;
	if (!planDir) return;

	const choice = await ctx.ui.select("Plan ready — what next?", [
		"Execute Plan",
		"Refine Plan",
		"Follow up",
		"Exit plan mode",
	]);

	switch (choice) {
		case "Execute Plan":
			await executeChoice(pi, ctx, state, planDir);
			break;
		case "Refine Plan":
			refineChoice(pi, planDir);
			break;
		case "Follow up":
			await followUpChoice(ctx, pi);
			break;
		case "Exit plan mode":
			await exitChoice(pi, ctx, state);
			break;
	}
}

async function executeChoice(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: State,
	planDir: string,
): Promise<void> {
	const planMdPath = `${planDir}/PLAN.md`;
	const startPromptPath = `${planDir}/START-PROMPT.md`;

	const planContent = await readFileSafe(planMdPath);
	const extracted = extractTodoItems(planContent);
	if (extracted.length > 0) state.todos = extracted;

	const startPrompt = (await readFileSafe(startPromptPath)).trim();

	const message = await startExecution(pi, ctx, state);
	notifyTransition(ctx, state, message);

	pi.sendMessage(
		{
			customType: MESSAGE_TYPE.EXECUTE,
			content: startPrompt || buildExecFallbackPrompt(planMdPath),
			display: true,
		},
		{ triggerTurn: true },
	);
}

function refineChoice(pi: ExtensionAPI, planDir: string): void {
	pi.sendMessage(
		{
			customType: MESSAGE_TYPE.REFINE,
			content: buildRefinePrompt(planDir),
			display: true,
		},
		{ triggerTurn: true },
	);
}

async function followUpChoice(
	ctx: ExtensionContext,
	pi: ExtensionAPI,
): Promise<void> {
	const followUp = await ctx.ui.editor("Follow-up instructions for the planner:", "");
	if (followUp?.trim()) pi.sendUserMessage(followUp.trim());
}

async function exitChoice(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: State,
): Promise<void> {
	const message = await exitPlanMode(pi, ctx, state);
	notifyTransition(ctx, state, message);
}

async function readFileSafe(path: string): Promise<string> {
	try {
		return await readFile(path, "utf-8");
	} catch {
		return "";
	}
}
