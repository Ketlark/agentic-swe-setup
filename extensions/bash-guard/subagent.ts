// ─── Subagent headless blocklist ─────────────────────────────────────────────
//
// In non-interactive subagent mode, catastrophic operations are hard-blocked.
// No prompting — the subagent gets a block reason and must ask the parent agent.
//
// Delegates to `isCatastrophic()` from analyze.ts (single source of truth, DRY).

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { isCatastrophic } from "./analyze.js";

export function registerSubagentGuard(pi: ExtensionAPI): void {
	pi.on("tool_call", async (event) => {
		if (!isToolCallEventType("bash", event)) return;
		const reason = isCatastrophic(event.input.command);
		if (reason) {
			return {
				block: true,
				reason: `Blocked by bash-guard: ${reason}. Non-interactive subagent — catastrophic operations not permitted.`,
			};
		}
	});
}
