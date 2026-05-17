// Tracks [DONE:n] markers in assistant messages during the execution phase.
// Updates todo completion status and refreshes the UI widget.

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getTextContent, isAssistantMessage } from "../messages.js";
import { markCompletedSteps } from "../parse.js";
import { type State, persist } from "../state.js";
import { updateUI } from "../ui.js";

export function registerDoneTracking(pi: ExtensionAPI, state: State): void {
	pi.on("turn_end", async (event, ctx) => {
		if (state.phase !== "executing" || state.todos.length === 0) return;
		if (!isAssistantMessage(event.message)) return;

		const text = getTextContent(event.message as AssistantMessage);
		if (markCompletedSteps(text, state.todos) > 0) updateUI(ctx, state);
		persist(pi, state);
	});
}
