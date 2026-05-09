/**
 * web-search — Pi extension
 *
 * Provides a `web_search` tool backed by the Z.AI Web Search MCP Server.
 *
 * Uses the MCP (Model Context Protocol) Streamable HTTP transport to communicate
 * with https://api.z.ai/api/mcp/web_search_prime/mcp via JSON-RPC 2.0.
 *
 * The server responds with either JSON or SSE (text/event-stream). Both are
 * handled transparently by the MCP client.
 *
 * Features:
 *  - Discovers tool schema from the MCP server at startup
 *  - Structured results (title, link, content, media, icon, publish_date)
 *  - Configurable: count, domain filter, recency filter
 *  - Session management with automatic re-initialization on expiry
 *  - Graceful error handling (auth, balance, rate limit, network)
 *  - /web-search-stats command
 *
 * API key: reads Z_AI_API_KEY env var, falls back to .env file.
 *
 * @see https://docs.z.ai/guides/tools/web-search
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// ─── Constants ───────────────────────────────────────────────────────────────

const MCP_URL = "https://api.z.ai/api/mcp/web_search_prime/mcp";
const MCP_PROTOCOL_VERSION = "2025-03-26";
const CLIENT_NAME = "pi-web-search";
const CLIENT_VERSION = "1.0.0";
const TIMEOUT_MS = 15_000;

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
 *
 * SSE format:
 *   event: message
 *   data: {"jsonrpc":"2.0","id":1,"result":{...}}
 *
 *   event: message
 *   data: {"jsonrpc":"2.0","id":1,"result":{...}}
 *
 * Multiple events may be sent. We collect all `data:` payloads for the matching
 * JSON-RPC id and return the last one (which contains the final result).
 */
function parseSseBody(body: string): McpJsonRpcResponse {
	const lines = body.split("\n");
	let currentData = "";
	let lastResponse: McpJsonRpcResponse | null = null;

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.startsWith("data:")) {
			// Append data line (strip the "data:" prefix)
			const dataContent = trimmed.slice(5).trimStart();
			currentData += dataContent;
		} else if (trimmed === "" && currentData) {
			// Empty line = end of event — try to parse accumulated data
			try {
				const parsed = JSON.parse(currentData) as McpJsonRpcResponse;
				if (parsed) lastResponse = parsed;
			} catch {
				// Not valid JSON, skip
			}
			currentData = "";
		}
		// Ignore "event:", "id:", "retry:" and other SSE fields
	}

	// Handle final event if body doesn't end with a blank line
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

class ZaiMcpClient {
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
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

		try {
			const res = await fetch(MCP_URL, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
				signal: controller.signal,
			});

			clearTimeout(timer);

			// Persist session ID from server
			const sid = res.headers.get("mcp-session-id");
			if (sid) this.sessionId = sid;

			// Notifications get 202 Accepted — nothing to parse
			if (notification) return null;

			if (!res.ok) {
				// Try to extract error message from body (may be JSON or SSE)
				const text = await res.text().catch(() => "");
				let message = text || `HTTP ${res.status} ${res.statusText}`;

				// Try to extract a cleaner message from JSON or SSE
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

			// Parse response based on Content-Type
			const contentType = res.headers.get("content-type") ?? "";
			let data: McpJsonRpcResponse;

			if (contentType.includes("text/event-stream")) {
				// SSE response — parse event stream
				const text = await res.text();
				data = parseSseBody(text);
			} else {
				// Plain JSON response
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

	/**
	 * Perform the MCP initialization handshake.
	 */
	async initialize(): Promise<void> {
		if (this._initialized) return;

		await this.rpc("initialize", {
			protocolVersion: MCP_PROTOCOL_VERSION,
			capabilities: {},
			clientInfo: { name: CLIENT_NAME, version: CLIENT_VERSION },
		});

		// Send initialized notification (fire-and-forget, no id)
		await this.rpc("notifications/initialized", undefined, true);

		this._initialized = true;
	}

	/**
	 * Reset session state (e.g. after expiry).
	 */
	reset(): void {
		this.sessionId = undefined;
		this._initialized = false;
		this.nextId = 1;
	}

	/**
	 * List available tools from the MCP server.
	 */
	async listTools(): Promise<McpToolDefinition[]> {
		await this.initialize();
		const result = (await this.rpc("tools/list")) as { tools?: McpToolDefinition[] };
		return result.tools ?? [];
	}

	/**
	 * Call a tool on the MCP server. Automatically re-initializes on session errors.
	 */
	async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
		try {
			await this.initialize();
			return (await this.rpc("tools/call", {
				name,
				arguments: args,
			})) as McpToolResult;
		} catch (err) {
			// Session may have expired — reset and retry once
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
	// 1. Direct environment variable
	if (process.env.Z_AI_API_KEY) return process.env.Z_AI_API_KEY;

	// 2. Parse .env in cwd
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
	if (!result.content?.length) return "No results returned from search.";

	const parts: string[] = [];
	for (const block of result.content) {
		if (block.type === "text" && block.text) {
			parts.push(block.text);
		}
	}
	return parts.join("\n") || "No results returned from search.";
}

// ─── Stats ───────────────────────────────────────────────────────────────────

interface Stats {
	searches: number;
	errors: number;
	lastQuery?: string;
	lastError?: string;
	mcpSchemaDiscovered: boolean;
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const stats: Stats = { searches: 0, errors: 0, mcpSchemaDiscovered: false };
	let client: ZaiMcpClient | null = null;

	// ── Helper: resolve or create MCP client ──

	function getClient(ctx: { cwd: string }): ZaiMcpClient | null {
		const apiKey = getApiKey(ctx.cwd);
		if (!apiKey) return null;
		if (!client) client = new ZaiMcpClient(apiKey);
		return client;
	}

	// ── Helper: build error result ──

	function errorResult(message: string, code?: string): {
		content: Array<{ type: "text"; text: string }>;
		details: Record<string, unknown>;
	} {
		stats.errors++;
		stats.lastError = message;
		return {
			content: [{ type: "text", text: `❌ Web search error: ${message}` }],
			details: { error: code ?? message },
		};
	}

	// ── Register the web_search tool ──

	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description:
			"Search the web via Z.AI Web Search MCP Server. Returns structured results with titles, URLs, summaries, and source information. Use this to find current information, documentation, APIs, or any web content.",
		promptSnippet: "Search the web for current information, documentation, or any online content.",
		promptGuidelines: [
			"Use web_search when you need up-to-date information not in your training data.",
			"Prefer specific queries over broad ones for better results.",
			"Use domain_filter to restrict results to a specific site (e.g. 'docs.python.org').",
			"Use recency_filter for time-sensitive queries (e.g. 'oneWeek' for recent news).",
		],
		parameters: Type.Object({
			query: Type.String({ description: "The search query string" }),
			count: Type.Optional(
				Type.Integer({
					description: "Number of results to return (1–50, default 5)",
					minimum: 1,
					maximum: 50,
				}),
			),
			domain_filter: Type.Optional(
				Type.String({
					description: "Restrict results to this domain (e.g. 'github.com', 'docs.python.org')",
				}),
			),
			recency_filter: Type.Optional(
				Type.Union([
					Type.Literal("oneDay"),
					Type.Literal("oneWeek"),
					Type.Literal("oneMonth"),
					Type.Literal("oneYear"),
					Type.Literal("noLimit"),
				], { description: "Time range filter for search results" }),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			// Resolve API key
			const c = getClient(ctx);
			if (!c) {
				return errorResult(
					"No API key configured. Set Z_AI_API_KEY in your environment or .env file.",
					"missing_api_key",
				);
			}

			onUpdate?.({
				content: [{ type: "text", text: `🔍 Searching: "${params.query}"...` }],
				details: undefined,
			});

			// Build MCP arguments
			const args: Record<string, unknown> = { search_query: params.query };
			if (params.count) args.content_size = params.count >= 10 ? "high" : "medium";
			if (params.domain_filter) args.search_domain_filter = params.domain_filter;
			if (params.recency_filter) args.search_recency_filter = params.recency_filter;

			// Wire abort signal
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
			if (signal) {
				signal.addEventListener("abort", () => {
					clearTimeout(timer);
					controller.abort();
				}, { once: true });
			}

			try {
				const result = await c.callTool("web_search_prime", args);

				clearTimeout(timer);
				stats.searches++;
				stats.lastQuery = params.query;

				const text = formatMcpResult(result);
				return {
					content: [{ type: "text", text }],
					details: { query: params.query, timestamp: new Date().toISOString() },
				};
			} catch (err) {
				clearTimeout(timer);

				const error = err as McpError;
				const message = error.message || String(err);

				// Friendly messages for known error codes
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
				if (error.code === 429 || message.includes("Rate")) {
					return errorResult(
						"Rate limited. Please wait a moment before searching again.",
						"rate_limited",
					);
				}
				if (error.code === -1 || (error as Error).name === "AbortError") {
					return {
						content: [{ type: "text", text: `⏹ Web search cancelled: "${params.query}"` }],
						details: { error: "aborted" },
					};
				}

				return errorResult(message, "unknown_error");
			}
		},
	});

	// ── Stats command ──

	pi.registerCommand("web-search-stats", {
		description: "Show web search session statistics",
		handler: async (_args, ctx) => {
			if (stats.searches === 0 && stats.errors === 0) {
				ctx.ui.notify("web-search: No searches performed yet.", "info");
				return;
			}
			const lines = [
				"web-search session statistics:",
				`  Searches: ${stats.searches}`,
				`  Errors:   ${stats.errors}`,
				`  MCP:      ${stats.mcpSchemaDiscovered ? "schema discovered ✓" : "not connected"}`,
			];
			if (stats.lastQuery) lines.push(`  Last query: ${stats.lastQuery}`);
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
			const searchTool = tools.find((t) => t.name === "web_search_prime");
			if (searchTool) {
				stats.mcpSchemaDiscovered = true;
				ctx.ui.setStatus(
					"web-search",
					`MCP connected · ${searchTool.description ?? "web_search_prime"}`,
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
