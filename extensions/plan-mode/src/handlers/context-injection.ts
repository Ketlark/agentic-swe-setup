// Injects phase-appropriate system context before each agent turn.
// Planning phase gets the plan-mode instructions + skill contracts.
// Execution phase gets the remaining todo list.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildContractBlock } from "../contracts.js";
import { buildExecSystemPrompt, buildPlanSystemPrompt } from "../prompts/index.js";
import type { State } from "../state.js";
import { MESSAGE_TYPE } from "../constants.js";

export function registerContextInjection(
	pi: ExtensionAPI,
	state: State,
	settingsPath: string,
): void {
	pi.on("before_agent_start", async () => {
		if (state.phase === "planning") {
			const contractBlock = await buildContractBlock(settingsPath);
			return {
				message: {
					customType: MESSAGE_TYPE.PLAN_CONTEXT,
					content: buildPlanSystemPrompt(contractBlock),
					display: false,
				},
			};
		}

		if (state.phase === "executing" && state.todos.length > 0) {
			const remaining = state.todos.filter((t) => !t.completed);
			return {
				message: {
					customType: MESSAGE_TYPE.EXEC_CONTEXT,
					content: buildExecSystemPrompt(remaining),
					display: false,
				},
			};
		}
	});
}
