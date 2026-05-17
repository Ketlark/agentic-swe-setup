import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

const RTK_TIMEOUT_MS = Number(process.env.RTK_TIMEOUT_MS ?? "500");
const RTK_MAX_CMD_BYTES = 64 * 1024;
const CACHE_TTL_MS = 5_000;

export interface RtkState {
	available: boolean;
	version: string | null;
	disabled: boolean;
	stats: { rewrites: number; errors: number; bypassed: number };
	cache: Map<string, { result: string; ts: number }>;
}

export function rtkRewrite(command: string, state: RtkState): Promise<string> {
	if (Buffer.byteLength(command, "utf8") > RTK_MAX_CMD_BYTES) {
		state.stats.bypassed++;
		return Promise.resolve(command);
	}

	const cached = state.cache.get(command);
	if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
		return Promise.resolve(cached.result);
	}

	return new Promise((resolve) => {
		const proc = spawn("rtk", ["rewrite", command], {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let timedOut = false;

		const timer = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGKILL");
		}, RTK_TIMEOUT_MS);

		proc.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		proc.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		proc.on("close", (code) => {
			clearTimeout(timer);
			if (timedOut) {
				console.warn(`[rtk] timeout (${RTK_TIMEOUT_MS}ms), bypassed: ${command.slice(0, 50)}`);
				state.stats.bypassed++;
				return resolve(command);
			}
			if (code !== 0) {
				if (stderr) console.warn(`[rtk] exit ${code}: ${stderr.slice(0, 200)}`);
				state.stats.errors++;
				return resolve(command);
			}
			const result = stdout.trim() || command;
			state.cache.set(command, { result, ts: Date.now() });
			resolve(result);
		});

		proc.on("error", () => {
			clearTimeout(timer);
			state.stats.errors++;
			resolve(command);
		});
	});
}

export function registerInterceptor(pi: ExtensionAPI, state: RtkState): void {
	pi.on("tool_call", async (event) => {
		if (!isToolCallEventType("bash", event)) return;
		if (state.disabled || !state.available) return;

		const original: string = event.input.command;
		const rewritten = await rtkRewrite(original, state);
		if (rewritten && rewritten !== original) {
			event.input.command = rewritten;
			state.stats.rewrites++;
		}
	});
}
