/**
 * hugin — Pi extension
 *
 * Bridges [hugin-mcp](https://github.com/Ketlark/hugin-mcp) into pi as native tools.
 * Spawns hugin-mcp as a subprocess, performs the MCP initialize handshake,
 * discovers tool schemas, and registers each tool via `pi.registerTool`.
 *
 * Zero external API calls. Zero API keys. Everything runs locally.
 *
 * Tools exposed (from hugin-mcp):
 *   - web_search  — search via SearXNG (70+ engines) or Bing fallback
 *   - web_read    — read any URL → clean markdown (14+ specialized handlers)
 *
 * Configuration (env vars):
 *   HUGIN_MCP_PATH    — path to hugin-mcp entry point (default: auto-detect)
 *   HUGIN_SEARXNG_URL — SearXNG instance URL (default: http://localhost:8888)
 */

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { McpStdioClient, type McpTool } from "./mcp-client.js";

// ─── Auto-detect hugin-mcp ─────────────────────────────────────────────────

function findHuginMcp(): string | null {
	// 1. Explicit env override
	if (process.env.HUGIN_MCP_PATH) {
		const p = resolve(process.env.HUGIN_MCP_PATH);
		if (existsSync(p)) return p;
	}

	const base = dirname(import.meta.dirname ?? __dirname);
	const home = process.env.HOME ?? "/root";

	// 2. Sibling repo (common dev layout)
	const candidates = [
		resolve(base, "../hugin-mcp/src/index.js"),
		resolve(base, "../mcp-local-websearch/src/index.js"),
		resolve(home, "dev/hugin-mcp/src/index.js"),
		resolve(home, "projects/hugin-mcp/src/index.js"),
	];

	for (const c of candidates) {
		if (existsSync(c)) return c;
	}

	return null;
}

// ─── Stats ──────────────────────────────────────────────────────────────────

interface Stats {
	toolCalls: number;
	errors: number;
	connected: boolean;
}

// ─── Extension factory ──────────────────────────────────────────────────────

const HUGIN_REPO = "https://github.com/Ketlark/hugin-mcp.git";

export default function (pi: ExtensionAPI) {
	const stats: Stats = { toolCalls: 0, errors: 0, connected: false };
	const client = new McpStdioClient();

	// ── Locate hugin-mcp ──

	const entryPoint = findHuginMcp();

	pi.on("session_start", async () => {
		if (!entryPoint) {
			pi.ui.notify(
				[
					"[hugin] hugin-mcp not found.",
					"",
					"To install:",
					`  git clone ${HUGIN_REPO} ../hugin-mcp`,
					"  cd ../hugin-mcp && npm install",
					"",
					"Or set HUGIN_MCP_PATH to the entry point.",
				].join("\n"),
				"warning",
			);
			return;
		}

		try {
			await client.connect("node", [entryPoint]);
			stats.connected = true;

			for (const tool of client.toolList) {
				registerTool(pi, client, tool, stats);
			}

			pi.ui.notify(
				`[hugin] connected — ${client.toolList.length} tool(s): ${client.toolList.map((t) => t.name).join(", ")}`,
				"info",
			);
		} catch (err) {
			pi.ui.notify(`[hugin] failed to start: ${(err as Error).message}`, "error");
		}
	});

	pi.on("session_shutdown", () => {
		client.disconnect();
		stats.connected = false;
	});

	// ── Commands ──

	pi.registerCommand("hugin-status", {
		description: "Show hugin-mcp connection status and stats",
		handler: async (_args, ctx) => {
			const lines = [
				"hugin-mcp status:",
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

// ─── Tool registration ──────────────────────────────────────────────────────

function registerTool(
	pi: ExtensionAPI,
	client: McpStdioClient,
	tool: McpTool,
	stats: Stats,
) {
	const schema = tool.inputSchema;
	const properties = schema?.properties ?? {};
	const required = schema?.required ?? [];

	// Build a JSON Schema object for pi's registerTool
	const params: Record<string, unknown> = { type: "object", properties: {}, required: [] };

	for (const [key, prop] of Object.entries(properties)) {
		(params.properties as Record<string, unknown>)[key] = {
			type: prop.type ?? "string",
			description: prop.description,
			enum: prop.enum,
			default: prop.default,
			items: prop.items,
		};
		if (required.includes(key)) {
			(params.required as string[]).push(key);
		}
	}

	pi.registerTool({
		name: tool.name,
		label: tool.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
		description: tool.description ?? `hugin-mcp: ${tool.name}`,
		parameters: params as any,
		promptSnippet: `Use ${tool.name} via hugin-mcp (local, no API key).`,
		promptGuidelines: [
			tool.description ?? "",
			"All processing happens locally on your machine — no data leaves.",
		].filter(Boolean),
		async execute(_toolCallId, callArgs, signal) {
			stats.toolCalls++;

			try {
				const result = await client.callTool(tool.name, callArgs as Record<string, unknown>);

				const text = result.content
					?.filter((c) => c.type === "text")
					.map((c) => c.text)
					.join("\n") ?? "";

				return {
					content: [{ type: "text", text }],
					isError: result.isError,
				};
			} catch (err) {
				stats.errors++;
				const message = err instanceof Error ? err.message : String(err);

				if (signal?.aborted) {
					return {
						content: [{ type: "text", text: `(hugin) ${tool.name} cancelled` }],
						isError: true,
					};
				}

				return {
					content: [{ type: "text", text: `(hugin) ${tool.name} error: ${message}` }],
					isError: true,
				};
			}
		},
	});
}
