// In non-interactive subagent mode, catastrophic operations are hard-blocked.
// No prompting — the subagent gets a block reason and must defer to the parent.
//
// Runs the rule engine in "subagent" mode (skips main-only rules, includes
// subagent-only rules) and blocks on any high-severity finding.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { analyzeBashCommand } from "./analyze.js";

export function registerSubagentGuard(pi: ExtensionAPI): void {
	pi.on("tool_call", async (event) => {
		if (!isToolCallEventType("bash", event)) return;

		const risk = analyzeBashCommand(event.input.command, { mode: "subagent" });
		if (!risk || risk.severity !== "high") return;

		const reason = risk.reasons[0] ?? "high-risk command";
		return {
			block: true,
			reason: `Blocked by bash-guard: ${reason}. Non-interactive subagent — catastrophic operations not permitted.`,
		};
	});
}
