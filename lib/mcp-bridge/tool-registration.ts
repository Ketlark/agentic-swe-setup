// Wraps a single MCP tool as a Pi tool: schema translation, prompt hints,
// execute() handler with error/cancellation handling and per-bridge stats.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { McpStdioClient, McpTool } from "./client.js";
import type { Stats } from "./types.js";

export interface PromptHint {
	snippet: string;
	guidelines: string[];
}

export const defaultPromptHint =
	(label: string) =>
	(tool: McpTool): PromptHint => ({
		snippet: `Use ${tool.name} via ${label}.`,
		guidelines: tool.description ? [tool.description] : [],
	});

function toolDisplayLabel(toolName: string): string {
	return toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ToolParams {
	type: "object";
	properties: Record<string, unknown>;
	required: string[];
}

function translateSchema(tool: McpTool): ToolParams {
	const properties = tool.inputSchema?.properties ?? {};
	const required = tool.inputSchema?.required ?? [];
	const params: ToolParams = { type: "object", properties: {}, required: [] };

	for (const [key, prop] of Object.entries(properties)) {
		params.properties[key] = {
			type: prop.type ?? "string",
			description: prop.description,
			enum: prop.enum,
			default: prop.default,
			items: prop.items,
		};
		if (required.includes(key)) {
			params.required.push(key);
		}
	}
	return params;
}

export interface RegisterToolDeps {
	pi: ExtensionAPI;
	client: McpStdioClient;
	tool: McpTool;
	stats: Stats;
	label: string;
	promptHint: (tool: McpTool) => PromptHint;
}

export function registerMcpTool({
	pi,
	client,
	tool,
	stats,
	label,
	promptHint,
}: RegisterToolDeps): void {
	const params = translateSchema(tool);
	const hint = promptHint(tool);

	pi.registerTool({
		name: tool.name,
		label: toolDisplayLabel(tool.name),
		description: tool.description ?? `${label}: ${tool.name}`,
		// biome-ignore lint/suspicious/noExplicitAny: pi registerTool params typing is loose
		parameters: params as any,
		promptSnippet: hint.snippet,
		promptGuidelines: hint.guidelines,
		async execute(_toolCallId, callArgs, signal) {
			stats.toolCalls++;
			try {
				const result = await client.callTool(tool.name, callArgs as Record<string, unknown>);
				const text =
					result.content
						?.filter((c) => c.type === "text")
						.map((c) => c.text)
						.join("\n") ?? "";

				return {
					content: [{ type: "text", text }],
					isError: result.isError,
					details: undefined,
				};
			} catch (err) {
				stats.errors++;
				const message = err instanceof Error ? err.message : String(err);
				const reason = signal?.aborted ? "cancelled" : `error: ${message}`;
				return {
					content: [{ type: "text", text: `(${label}) ${tool.name} ${reason}` }],
					isError: true,
					details: undefined,
				};
			}
		},
	});
}
