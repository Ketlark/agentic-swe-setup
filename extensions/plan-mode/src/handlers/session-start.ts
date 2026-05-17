// Restores persisted state on session start or resume, re-scans [DONE:n]
// markers from the conversation history, and applies the correct phase
// configuration (tools, model, thinking level).

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getTextContent, isAssistantMessage } from "../messages.js";
import { markCompletedSteps } from "../parse.js";
import { type State, applyPhase, restoreFrom } from "../state.js";
import { MESSAGE_TYPE } from "../constants.js";
import type { PersistedState } from "../types.js";
import { updateUI } from "../ui.js";

export function registerSessionStart(pi: ExtensionAPI, state: State): void {
	pi.on("session_start", async (_event, ctx) => {
		if (pi.getFlag("plan") === true) state.phase = "planning";

		const saved = findLastPersistedState(ctx);
		if (saved) restoreFrom(state, saved);

		if (state.phase === "executing" && state.todos.length > 0) {
			rescanDoneMarkers(ctx, state);
		}

		await applyPhase(pi, ctx, state);
		updateUI(ctx, state);
	});
}

function findLastPersistedState(
	ctx: ExtensionContext,
): Partial<PersistedState> | undefined {
	const entries = ctx.sessionManager.getEntries();
	const saved = entries
		.filter(
			(e: { type: string; customType?: string }) =>
				e.type === "custom" && e.customType === MESSAGE_TYPE.PERSISTENCE_KEY,
		)
		.pop() as { data?: Partial<PersistedState> } | undefined;
	return saved?.data;
}

function rescanDoneMarkers(ctx: ExtensionContext, state: State): void {
	const entries = ctx.sessionManager.getEntries();

	let execIdx = -1;
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as { type: string; customType?: string };
		if (entry.customType === MESSAGE_TYPE.EXECUTE) {
			execIdx = i;
			break;
		}
	}

	const texts: string[] = [];
	for (let i = execIdx + 1; i < entries.length; i++) {
		const entry = entries[i];
		if (
			entry.type === "message" &&
			"message" in entry &&
			isAssistantMessage(entry.message as AgentMessage)
		) {
			texts.push(getTextContent(entry.message as AssistantMessage));
		}
	}

	markCompletedSteps(texts.join("\n"), state.todos);
}
