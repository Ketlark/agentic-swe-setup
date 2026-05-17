// Assumption: models lack internal safety gating for shell operations —
// they'll `rm -rf /` as readily as `ls`. This extension intercepts
// dangerous commands before execution.
// Re-evaluate when models demonstrate reliable self-censoring of
// destructive commands across adversarial prompts.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerCommands } from "./commands.js";
import { registerInterceptor } from "./interceptor.js";
import { createState, registerSessionHooks } from "./session.js";
import { registerSubagentGuard } from "./subagent.js";

const _subagentDepth = Number(process.env.PI_SUBAGENT_DEPTH ?? "0");
const _isSubagent = Number.isFinite(_subagentDepth) && _subagentDepth >= 1;

export default function (pi: ExtensionAPI) {
	if (_isSubagent) {
		registerSubagentGuard(pi);
		return;
	}

	const state = createState();

	pi.registerFlag("bash-guard-auto-allow", {
		description: "Auto-allow flagged commands when no UI is available.",
		type: "boolean",
		default: false,
	});

	pi.registerFlag("bash-guard-yolo", {
		description: "Disable bash-guard interception entirely (YOLO mode).",
		type: "boolean",
		default: false,
	});

	registerCommands(pi, state);
	registerInterceptor(pi, state);
	registerSessionHooks(pi, state);
}
