// Registers a /<label>-status slash command that reports connection state,
// entry-point path, and per-bridge call/error counters.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { McpStdioClient } from "./client.js";
import type { Stats } from "./types.js";

export interface StatusCommandDeps {
	pi: ExtensionAPI;
	name: string;
	label: string;
	entryPoint: string | null;
	client: McpStdioClient;
	stats: Stats;
}

export function registerStatusCommand({
	pi,
	name,
	label,
	entryPoint,
	client,
	stats,
}: StatusCommandDeps): void {
	pi.registerCommand(name, {
		description: `Show ${label} MCP connection status and stats`,
		handler: async (_args, ctx) => {
			const lines = [
				`${label} status:`,
				`  Connected: ${stats.connected ? "yes" : "no"}`,
				`  Entry:     ${entryPoint ?? "(not found)"}`,
				`  Calls:     ${stats.toolCalls}`,
				`  Errors:    ${stats.errors}`,
			];
			if (client.connected) {
				lines.push(`  Tools:     ${client.toolList.map((t) => t.name).join(", ")}`);
			}
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
