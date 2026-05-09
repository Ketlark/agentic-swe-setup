// ─── MCP stdio client ───────────────────────────────────────────────────────
//
// Spawns hugin-mcp as a subprocess and communicates via JSON-RPC 2.0 over stdio.
// No dependency on @modelcontextprotocol/sdk — raw protocol is straightforward.

import { spawn, type ChildProcess } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// ─── Types ──────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: Record<string, unknown>;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id?: number;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

interface McpTool {
	name: string;
	description?: string;
	inputSchema?: Record<string, unknown>;
}

interface McpToolResult {
	content: Array<{ type: string; text: string }>;
	isError?: boolean;
}

// ─── Client ────────────────────────────────────────────────────────────────

export class McpStdioClient {
	private proc: ChildProcess | null = null;
	private nextId = 1;
	private pending = new Map<number, {
		resolve: (v: unknown) => void;
		reject: (e: Error) => void;
		timer: ReturnType<typeof setTimeout>;
	}>();
	private buffer = "";
	private tools: McpTool[] = [];

	get connected(): boolean {
		return this.proc !== null && !this.proc.killed;
	}

	get toolList(): readonly McpTool[] {
		return this.tools;
	}

	/** Spawn the MCP server process. Resolves when initialized (tools/list received). */
	async connect(command: string, args: string[], timeoutMs = 10_000): Promise<void> {
		this.proc = spawn(command, args, {
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env },
		});

		const proc = this.proc;

		proc.stderr?.on("data", (chunk: Buffer) => {
			// MCP servers log debug info to stderr — forward to our stderr
			process.stderr.write(chunk);
		});

		proc.stdout?.on("data", (chunk: Buffer) => {
			this.buffer += chunk.toString();
			this.drain();
		});

		proc.on("close", (code) => {
			if (code !== 0 && code !== null) {
				process.stderr.write(`[hugin] process exited with code ${code}\n`);
			}
			this.proc = null;
			this.rejectAll(new Error(`hugin-mcp process exited (code ${code})`));
		});

		proc.on("error", (err) => {
			process.stderr.write(`[hugin] spawn error: ${err.message}\n`);
			this.proc = null;
			this.rejectAll(err);
		});

		// Wait for the process to be ready, then list tools
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error("hugin-mcp: timed out waiting for process"));
			}, timeoutMs);

			// Give the process a moment to start
			proc.stdout?.once("data", () => {
				clearTimeout(timer);
				resolve();
			});

			// Also resolve if process is already flowing
			setTimeout(() => {
				clearTimeout(timer);
				resolve();
			}, 500);
		});

		// Discover tools
		this.tools = await this.request<McpTool[]>("tools/list", {}, timeoutMs);
	}

	/** Call a tool on the MCP server. */
	async callTool(name: string, args: Record<string, unknown>, timeoutMs = 30_000): Promise<McpToolResult> {
		return this.request<McpToolResult>("tools/call", { name, arguments: args }, timeoutMs);
	}

	/** Kill the subprocess. */
 disconnect(): void {
		if (this.proc && !this.proc.killed) {
			this.proc.kill("SIGTERM");
		}
		this.proc = null;
		this.rejectAll(new Error("disconnected"));
	}

	// ── Internals ────────────────────────────────────────────────────────────

	private request<T>(method: string, params: Record<string, unknown>, timeoutMs: number): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const id = this.nextId++;
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`hugin-mcp: ${method} timed out (${timeoutMs}ms)`));
			}, timeoutMs);

			this.pending.set(id, {
				resolve: resolve as (v: unknown) => void,
				reject,
				timer,
			});

			const msg: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
			this.proc?.stdin?.write(JSON.stringify(msg) + "\n");
		});
	}

	private drain(): void {
		// Parse newline-delimited JSON-RPC messages
		let start = 0;
		while (true) {
			const idx = this.buffer.indexOf("\n", start);
			if (idx === -1) break;

			const line = this.buffer.slice(start, idx).trim();
			start = idx + 1;

			if (!line) continue;

			try {
				const msg = JSON.parse(line) as JsonRpcResponse;
				this.handle(msg);
			} catch {
				// Not valid JSON — skip (could be server logging)
			}
		}

		this.buffer = this.buffer.slice(start);
	}

	private handle(msg: JsonRpcResponse): void {
		// Notifications (no id) — ignore
		if (msg.id === undefined) return;

		const entry = this.pending.get(msg.id);
		if (!entry) return;

		clearTimeout(entry.timer);
		this.pending.delete(msg.id);

		if (msg.error) {
			entry.reject(new Error(msg.error.message));
		} else {
			entry.resolve(msg.result);
		}
	}

	private rejectAll(err: Error): void {
		for (const [, entry] of this.pending) {
			clearTimeout(entry.timer);
			entry.reject(err);
		}
		this.pending.clear();
	}
}
