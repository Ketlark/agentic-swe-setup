// Slash commands and keyboard shortcut registration.
// Mirrors bash-guard/commands.ts: receives pi + state, registers everything.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import { type State, enterPlanMode, exitPlanMode } from "./state.js";
import { notifyTransition } from "./ui.js";

export function registerCommands(pi: ExtensionAPI, state: State): void {
	pi.registerCommand("plan", {
		description: "Enter plan mode, optionally with a starting prompt",
		handler: async (args, ctx) => {
			if (state.phase !== "idle") {
				await toggle(pi, ctx, state);
				return;
			}
			const message = await enterPlanMode(pi, ctx, state);
			notifyTransition(ctx, state, message);

			const prompt = args?.trim();
			if (prompt) pi.sendUserMessage(prompt);
		},
	});

	pi.registerCommand("todos", {
		description: "Show current plan progress",
		handler: async (_args, ctx) => {
			if (state.todos.length === 0) {
				ctx.ui.notify("No plan yet. Use /plan to start planning.", "info");
				return;
			}
			const list = state.todos
				.map((t, i) => `${i + 1}. ${t.completed ? "✓" : "○"} ${t.text}`)
				.join("\n");
			ctx.ui.notify(`Plan Progress:\n${list}`, "info");
		},
	});

	pi.registerShortcut(Key.ctrlAlt("p"), {
		description: "Toggle plan mode",
		handler: async (ctx) => toggle(pi, ctx, state),
	});
}

async function toggle(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: State,
): Promise<void> {
	const message =
		state.phase === "idle"
			? await enterPlanMode(pi, ctx, state)
			: await exitPlanMode(pi, ctx, state);
	notifyTransition(ctx, state, message);
}
