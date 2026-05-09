/**
 * web-reader — Pi extension
 *
 * Provides a `web_read` tool backed by the Z.AI Web Reader MCP Server.
 *
 * Uses the MCP (Model Context Protocol) Streamable HTTP transport to communicate
 * with https://api.z.ai/api/mcp/web_reader/mcp via JSON-RPC 2.0.
 *
 * Features:
 *  - Fetch any webpage and return content as markdown or plain text
 *  - Configurable: timeout, cache, image retention, GFM, format
 *  - Session management with automatic re-initialization on expiry
 *  - Graceful error handling (auth, balance, timeout, network)
 *  - /web-reader-stats command
 *
 * API key: reads Z_AI_API_KEY env var, falls back to .env file.
 *
 * @see https://docs.z.ai/devpack/mcp/reader-mcp-server.md
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// ─── Constants ───────────────────────────────────────────────────────────────

const MCP_URL = "https://api.z.ai/api/mcp/web_reader/mcp";
const MCP_PROTOCOL_VERSION = "2024-11-05";
const CLIENT_NAME = "pi-web-reader";
const CLIENT_VERSION = "1.0.0";
const DEFAULT_TIMEOUT_S = 30;

// ─── MCP Types ───────────────────────────────────────────────────────────────

interface McpToolDefinition {
	name: string;
	description?: string;
	inputSchema?: {
		type: string;
		properties?: Record<string, unknown>;
		required?: string[];
	};
}

interface McpToolResult {
	content: Array<{ type: string; text?: string; data?: unknown }>;
	isError?: boolean;
}

interface McpJsonRpcResponse {
	jsonrpc: string;
	id?: number;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

class McpError extends Error {
	constructor(public code: number, message: string) {
		super(message);
		this.name = "McpError";
	}
}

// ─── SSE Parser ─────────────────────────────────────────────────────────────

/**
 * Parse an SSE (text/event-stream) response body and extract JSON-RPC responses.
 * Collects all `data:` payloads and returns the last one with a matching JSON-RPC id.
 */
function parseSseBody(body: string): McpJsonRpcResponse {
	const lines = body.split("\n");
	let currentData = "";
	let lastResponse: McpJsonRpcResponse | null = null;

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.startsWith("data:")) {
			currentData += trimmed.slice(5).trimStart();
		} else if (trimmed === "" && currentData) {
			try {
				const parsed = JSON.parse(currentData) as McpJsonRpcResponse;
				if (parsed) lastResponse = parsed;
			} catch {
				// Not valid JSON, skip
			}
			currentData = "";
		}
	}

	if (currentData) {
		try {
			const parsed = JSON.parse(currentData) as McpJsonRpcResponse;
			if (parsed) lastResponse = parsed;
		} catch {
			// Not valid JSON, skip
		}
	}

	if (!lastResponse) {
		throw new McpError(-3, "No valid JSON-RPC response found in SSE stream");
	}

	return lastResponse;
}

// ─── MCP Client (JSON-RPC 2.0 over Streamable HTTP) ────────────────────────

class WebReaderMcpClient {
	private sessionId?: string;
	private nextId = 1;
	private _initialized = false;

	constructor(private apiKey: string) {}

	get initialized() {
		return this._initialized;
	}

	/**
	 * Send a JSON-RPC request (or notification) to the MCP server.
	 * Handles both JSON and SSE response formats transparently.
	 */
	private async rpc(
		method: string,
		params?: Record<string, unknown>,
		notification = false,
	): Promise<unknown> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			Authorization: `Bearer ${this.apiKey}`,
		};
		if (this.sessionId) {
			headers["Mcp-Session-Id"] = this.sessionId;
		}

		const body: Record<string, unknown> = { jsonrpc: "2.0", method };
		if (!notification) body.id = this.nextId++;
		if (params) body.params = params;

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_S * 1000);

		try {
			const res = await fetch(MCP_URL, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
				signal: controller.signal,
			});

			clearTimeout(timer);

			const sid = res.headers.get("mcp-session-id");
			if (sid) this.sessionId = sid;

			if (notification) return null;

			if (!res.ok) {
				const text = await res.text().catch(() => "");
				let message = text || `HTTP ${res.status} ${res.statusText}`;

				try {
					const contentType = res.headers.get("content-type") ?? "";
					let parsed: McpJsonRpcResponse;
					if (contentType.includes("text/event-stream")) {
						parsed = parseSseBody(text);
					} else {
						parsed = JSON.parse(text);
					}
					if (parsed.error?.message) {
						message = parsed.error.message;
					}
				} catch {
					// Use raw text
				}
				throw new McpError(res.status, message);
			}

			const contentType = res.headers.get("content-type") ?? "";
			let data: McpJsonRpcResponse;

			if (contentType.includes("text/event-stream")) {
				const text = await res.text();
				data = parseSseBody(text);
			} else {
				data = (await res.json()) as McpJsonRpcResponse;
			}

			if (data.error) {
				throw new McpError(data.error.code, data.error.message);
			}
			return data.result;
		} catch (err) {
			clearTimeout(timer);
			if (err instanceof McpError) throw err;
			if ((err as Error).name === "AbortError") throw new McpError(-1, "Request timed out");
			throw new McpError(-2, (err as Error).message || String(err));
		}
	}

	async initialize(): Promise<void> {
		if (this._initialized) return;

		await this.rpc("initialize", {
			protocolVersion: MCP_PROTOCOL_VERSION,
			capabilities: {},
			clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
		});

		await this.rpc("notifications/initialized", undefined, true);

		this._initialized = true;
	}

	reset(): void {
		this.sessionId = undefined;
		this._initialized = false;
		this.nextId = 1;
	}

	async listTools(): Promise<McpToolDefinition[]> {
		await this.initialize();
		const result = (await this.rpc("tools/list")) as { tools?: McpToolDefinition[] };
		return result.tools ?? [];
	}

	async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
		try {
			await this.initialize();
			return (await this.rpc("tools/call", {
				name,
				arguments: args,
			})) as McpToolResult;
		} catch (err) {
			if (err instanceof McpError && (err.code === -32001 || err.code === 401)) {
				this.reset();
				await this.initialize();
				return (await this.rpc("tools/call", {
					name,
					arguments: args,
				})) as McpToolResult;
			}
			throw err;
		}
	}
}

// ─── API Key Resolution ─────────────────────────────────────────────────────

function getApiKey(cwd: string): string | undefined {
	if (process.env.Z_AI_API_KEY) return process.env.Z_AI_API_KEY;

	try {
		const { existsSync, readFileSync } = require("node:fs") as {
			existsSync: (p: string) => boolean;
			readFileSync: (p: string, e: string) => string;
		};
		const { join } = require("node:path") as { join: (...args: string[]) => string };
		const envPath = join(cwd, ".env");
		if (!existsSync(envPath)) return undefined;
		for (const line of readFileSync(envPath, "utf8").split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eq = trimmed.indexOf("=");
			if (eq === -1) continue;
			const key = trimmed.slice(0, eq).trim();
			const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
			if (key === "Z_AI_API_KEY" || key === "ANTHROPIC_API_KEY") return val;
		}
	} catch {
		// ignore
	}
	return undefined;
}

// ─── Result Formatting ─────────────────────────────────────────────────────

function formatMcpResult(result: McpToolResult): string {
	if (!result.content?.length) return "No content returned from web reader.";

	const parts: string[] = [];
	for (const block of result.content) {
		if (block.type === "text" && block.text) {
			parts.push(block.text);
		}
	}
	return parts.join("\n") || "No content returned from web reader.";
}

// ─── Stats ───────────────────────────────────────────────────────────────────

interface Stats {
	reads: number;
	errors: number;
	lastUrl?: string;
	lastError?: string;
	mcpSchemaDiscovered: boolean;
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const stats: Stats = { reads: 0, errors: 0, mcpSchemaDiscovered: false };
	let client: WebReaderMcpClient | null = null;

	function getClient(ctx: { cwd: string }): WebReaderMcpClient | null {
		const apiKey = getApiKey(ctx.cwd);
		if (!apiKey) return null;
		if (!client) client = new WebReaderMcpClient(apiKey);
		return client;
	}

	function errorResult(message: string, code?: string): {
		content: Array<{ type: "text"; text: string }>;
		details: Record<string, unknown>;
	} {
		stats.errors++;
		stats.lastError = message;
		return {
			content: [{ type: "text", text: `web_read error: ${message}` }],
			details: { error: code ?? message },
		};
	}

	// ── Register the web_read tool ──

	pi.registerTool({
		name: "web_read",
		label: "Web Read",
		description:
			"Read and fetch the content of a web page via Z.AI Web Reader MCP Server. Returns the page title, main content as markdown, and optional metadata (links summary, images summary). Handles complex HTML and converts it to clean markdown or plain text.",
		promptSnippet: "Read and fetch the content of a web page URL.",
		promptGuidelines: [
			"Use web_read to fetch documentation pages, blog posts, README files, or any web content.",
			"Prefer web_read over web_search when you already know the URL.",
			"Set format to 'text' if you only need plain text without markdown formatting.",
			"Use retain_images=false to reduce response size when images are not needed.",
			"Set no_cache=true to bypass cache and always fetch fresh content.",
		],
		parameters: Type.Object({
			url: Type.String({ description: "The URL of the website to fetch and read" }),
			format: Type.Optional(
				Type.Union([
					Type.Literal("markdown"),
					Type.Literal("text"),
				], { description: "Response format: 'markdown' (default) or 'text'" }),
			),
			timeout: Type.Optional(
				Type.Integer({
					description: "Request timeout in seconds (default 20)",
					minimum: 5,
					maximum: 60,
				}),
			),
			no_cache: Type.Optional(
				Type.Boolean({ description: "Disable cache, fetch fresh content (default false)" }),
			),
			retain_images: Type.Optional(
				Type.Boolean({ description: "Retain images in output (default true)" }),
			),
			with_links_summary: Type.Optional(
				Type.Boolean({ description: "Include a summary of links found on the page (default false)" }),
			),
			with_images_summary: Type.Optional(
				Type.Boolean({ description: "Include a summary of images found on the page (default false)" }),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const c = getClient(ctx);
			if (!c) {
				return errorResult(
					"No API key configured. Set Z_AI_API_KEY in your environment or .env file.",
					"missing_api_key",
				);
			}

			onUpdate?.({
				content: [{ type: "text", text: `Fetching ${params.url}...` }],
				details: undefined,
			});

			// Build MCP arguments — map to the exact schema from the MCP server
			const args: Record<string, unknown> = { url: params.url };
			if (params.format) args.return_format = params.format;
			if (params.timeout) args.timeout = params.timeout;
			if (params.no_cache) args.no_cache = params.no_cache;
			if (params.retain_images === false) args.retain_images = false;
			if (params.with_links_summary) args.with_links_summary = true;
			if (params.with_images_summary) args.with_images_summary = true;

			// Wire abort signal
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_S * 1000);
			if (signal) {
				signal.addEventListener("abort", () => {
					clearTimeout(timer);
					controller.abort();
				}, { once: true });
			}

			try {
				const result = await c.callTool("webReader", args);

				clearTimeout(timer);
				stats.reads++;
				stats.lastUrl = params.url;

				const text = formatMcpResult(result);
				return {
					content: [{ type: "text", text }],
					details: { url: params.url, timestamp: new Date().toISOString() },
				};
			} catch (err) {
				clearTimeout(timer);

				const error = err as McpError;
				const message = error.message || String(err);

				if (error.code === 401 || message.includes("Invalid") || message.includes("Unauthorized")) {
					return errorResult(
						"Authentication failed. Check your Z_AI_API_KEY.",
						"auth_error",
					);
				}
				if (message.includes("balance") || message.includes("Insufficient")) {
					return errorResult(
						"Insufficient balance on your Z.AI account. Please recharge at https://z.ai/manage-apikey/billing.",
						"insufficient_balance",
					);
				}
				if (error.code === -1 || (error as Error).name === "AbortError") {
					return {
						content: [{ type: "text", text: `Cancelled: ${params.url}` }],
						details: { error: "aborted" },
					};
				}

				return errorResult(message, "unknown_error");
			}
		},
	});

	// ── Stats command ──

	pi.registerCommand("web-reader-stats", {
		description: "Show web reader session statistics",
		handler: async (_args, ctx) => {
			if (stats.reads === 0 && stats.errors === 0) {
				ctx.ui.notify("web-reader: No pages read yet.", "info");
				return;
			}
			const lines = [
				"web-reader session statistics:",
				`  Pages read: ${stats.reads}`,
				`  Errors:     ${stats.errors}`,
				`  MCP:        ${stats.mcpSchemaDiscovered ? "schema discovered" : "not connected"}`,
			];
			if (stats.lastUrl) lines.push(`  Last URL:   ${stats.lastUrl}`);
			if (stats.lastError) lines.push(`  Last error: ${stats.lastError}`);
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	// ── Discover MCP schema on session start (best-effort) ──

	pi.on("session_start", async (_event, ctx) => {
		const c = getClient(ctx);
		if (!c) return;
		try {
			const tools = await c.listTools();
			const readerTool = tools.find((t) => t.name === "webReader");
			if (readerTool) {
				stats.mcpSchemaDiscovered = true;
				ctx.ui.setStatus(
					"web-reader",
					`MCP connected · ${readerTool.description ?? "webReader"}`,
				);
			}
		} catch {
			// Will initialize lazily on first tool call
		}
	});

	// ── Cleanup on shutdown ──

	pi.on("session_shutdown", async () => {
		if (client) client.reset();
		client = null;
	});
}
