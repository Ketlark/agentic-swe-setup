// Barrel — registers all event handlers in one call.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { State } from "../state.js";
import { registerAgentEnd } from "./agent-end.js";
import { registerContextFilter } from "./context-filter.js";
import { registerContextInjection } from "./context-injection.js";
import { registerDoneTracking } from "./done-tracking.js";
import { registerPlanDetection } from "./plan-detection.js";
import { registerSessionStart } from "./session-start.js";

export function registerHandlers(
	pi: ExtensionAPI,
	state: State,
	settingsPath: string,
): void {
	registerContextInjection(pi, state, settingsPath);
	registerContextFilter(pi, state);
	registerDoneTracking(pi, state);
	registerPlanDetection(pi, state);
	registerAgentEnd(pi, state);
	registerSessionStart(pi, state);
}
