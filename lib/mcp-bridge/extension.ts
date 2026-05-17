// Public factory turning a config into a Pi extension. Owns the session
// lifecycle (spawn / shutdown) and wires the per-tool registration and the
// status slash command via dedicated helper modules.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { McpStdioClient, type McpTool } from "./client.js";
import { registerStatusCommand } from "./status-command.js";
import { type PromptHint, defaultPromptHint, registerMcpTool } from "./tool-registration.js";
import type { Stats } from "./types.js";

export type { PromptHint } from "./tool-registration.js";

export interface McpExtensionConfig {
	/** Short identifier — used in logs, default clientInfo, status command name. */
	label: string;
	/** Resolved path to the MCP entry point, or null if discovery failed. */
	entryPoint: string | null;
	/** Shown to the user when entryPoint is null. String[] is joined with "\n". */
	notFoundMessage: string | readonly string[];

	/** Override the spawn command (default: `node`). */
	spawn?: { command: string; args?: readonly string[] };
	/** Override the JSON-RPC clientInfo (default: `{ name: "pi-${label}", version: "1.0.0" }`). */
	clientInfo?: { name: string; version: string };
	/** Override the slash command name (default: `${label}-status`). */
	statusCommand?: string;
	/** Override per-tool prompt copy (default: neutral "Use ${tool} via ${label}"). */
	promptHint?: (tool: McpTool) => PromptHint;
}

interface ResolvedConfig {
	label: string;
	entryPoint: string | null;
	notFoundText: string;
	spawn: { command: string; args: readonly string[] };
	clientInfo: { name: string; version: string };
	statusCommandName: string;
	promptHint: (tool: McpTool) => PromptHint;
}

function resolveConfig(config: McpExtensionConfig): ResolvedConfig {
	return {
		label: config.label,
		entryPoint: config.entryPoint,
		notFoundText: Array.isArray(config.notFoundMessage)
			? config.notFoundMessage.join("\n")
			: (config.notFoundMessage as string),
		spawn: {
			command: config.spawn?.command ?? "node",
			args: config.spawn?.args ?? [],
		},
		clientInfo: config.clientInfo ?? { name: `pi-${config.label}`, version: "1.0.0" },
		statusCommandName: config.statusCommand ?? `${config.label}-status`,
		promptHint: config.promptHint ?? defaultPromptHint(config.label),
	};
}

export function createMcpExtension(config: McpExtensionConfig): (pi: ExtensionAPI) => void {
	const cfg = resolveConfig(config);

	return (pi: ExtensionAPI) => {
		const stats: Stats = { toolCalls: 0, errors: 0, connected: false };
		const client = new McpStdioClient(cfg.label);

		pi.on("session_start", async (_event, ctx: ExtensionContext) => {
			if (!cfg.entryPoint) {
				ctx.ui.notify(cfg.notFoundText, "warning");
				return;
			}

			try {
				const args = [...cfg.spawn.args, cfg.entryPoint];
				await client.connect(cfg.spawn.command, args, cfg.clientInfo);
				stats.connected = true;

				for (const tool of client.toolList) {
					registerMcpTool({
						pi,
						client,
						tool,
						stats,
						label: cfg.label,
						promptHint: cfg.promptHint,
					});
				}

				ctx.ui.notify(
					`[${cfg.label}] connected — ${client.toolList.length} tool(s): ${client.toolList
						.map((t) => t.name)
						.join(", ")}`,
					"info"
				);
			} catch (err) {
				ctx.ui.notify(`[${cfg.label}] failed to start: ${(err as Error).message}`, "error");
			}
		});

		pi.on("session_shutdown", () => {
			client.disconnect();
			stats.connected = false;
		});

		registerStatusCommand({
			pi,
			name: cfg.statusCommandName,
			label: cfg.label,
			entryPoint: cfg.entryPoint,
			client,
			stats,
		});
	};
}
