// Filters stale plan-mode context messages from the conversation when not
// in planning phase. Prevents leftover [PLAN MODE ACTIVE] markers from
// confusing the model in non-plan sessions.

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { State } from "../state.js";
import { MESSAGE_TYPE, PLAN_MARKER } from "../constants.js";

export function registerContextFilter(pi: ExtensionAPI, state: State): void {
	pi.on("context", async (event) => {
		if (state.phase === "planning") return;
		return {
			messages: event.messages.filter((m) => {
				const msg = m as AgentMessage & { customType?: string };
				if (msg.customType === MESSAGE_TYPE.PLAN_CONTEXT) return false;
				if (msg.role !== "user") return true;
				return !containsPlanMarker(msg.content);
			}),
		};
	});
}

function containsPlanMarker(content: unknown): boolean {
	if (typeof content === "string") return content.includes(PLAN_MARKER);
	if (Array.isArray(content)) {
		return content.some(
			(c) => c.type === "text" && (c as TextContent).text?.includes(PLAN_MARKER),
		);
	}
	return false;
}
