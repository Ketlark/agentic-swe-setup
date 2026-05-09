// ─── MCP stdio client ───────────────────────────────────────────────────────
//
// Spawns hugin-mcp as a subprocess and communicates via JSON-RPC 2.0 over stdio.
// No dependency on @modelcontextprotocol/sdk — raw protocol is straightforward.
//
// MCP lifecycle:
//   1. Client sends "initialize" (with capabilities + client info)
//   2. Server responds with server info + capabilities
//   3. Client sends "initialized" notification (no id, no response)
//   4. Normal operation: tools/list, tools/call, etc.

import { spawn, type ChildProcess } from "node:child_process";

// ─── Types ──────────────────────────────────────────────────────────────────

interface JsonRpcMessage {
	jsonrpc: "2.0";
	id?: number;
	method?: string;
	params?: Record<string, unknown>;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

export interface McpTool {
	name: string;
	description?: string;
	inputSchema?: {
		type: string;
		properties?: Record<string, Record<string, unknown>>;
		required?: string[];
	};
}

export interface McpToolResult {
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

	/**
	 * Spawn the MCP server, perform the initialize handshake, then discover tools.
	 */
	async connect(command: string, args: string[], timeoutMs = 15_000): Promise<void> {
		this.proc = spawn(command, args, {
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env },
		});

		const proc = this.proc;

		proc.stderr?.on("data", (chunk: Buffer) => {
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

		// Step 1: initialize handshake
		const initResult = await this.request<Record<string, unknown>>("initialize", {
			protocolVersion: "2024-11-05",
			capabilities: {},
			clientInfo: { name: "pi-hugin", version: "1.0.0" },
		}, timeoutMs);

		// Step 2: initialized notification (no id — server won't respond)
		this.send({ jsonrpc: "2.0", method: "notifications/initialized" });

		// Step 3: discover tools
		const listResult = await this.request<{ tools: McpTool[] }>("tools/list", {}, timeoutMs);
		this.tools = listResult.tools ?? [];
	}

	/** Call a tool on the MCP server. */
	async callTool(name: string, args: Record<string, unknown>, timeoutMs = 60_000): Promise<McpToolResult> {
		return this.request<McpToolResult>("tools/call", { name, arguments: args }, timeoutMs);
	}

	/** Kill the subprocess and reject pending requests. */
	disconnect(): void {
		if (this.proc && !this.proc.killed) {
			this.proc.stdin?.end();
			this.proc.kill("SIGTERM");
		}
		this.proc = null;
		this.rejectAll(new Error("disconnected"));
	}

	// ── Internals ────────────────────────────────────────────────────────────

	private send(msg: JsonRpcMessage): void {
		this.proc?.stdin?.write(JSON.stringify(msg) + "\n");
	}

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

			this.send({ jsonrpc: "2.0", id, method, params });
		});
	}

	private drain(): void {
		let start = 0;
		while (true) {
			const idx = this.buffer.indexOf("\n", start);
			if (idx === -1) break;

			const line = this.buffer.slice(start, idx).trim();
			start = idx + 1;

			if (!line) continue;

			try {
				const msg = JSON.parse(line) as JsonRpcMessage;
				this.handle(msg);
			} catch {
				// Not valid JSON — skip
			}
		}

		this.buffer = this.buffer.slice(start);
	}

	private handle(msg: JsonRpcMessage): void {
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
