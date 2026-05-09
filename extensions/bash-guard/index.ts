/**
 * bash-guard — Pi extension
 *
 * Intercepts agent-issued `bash` tool calls and applies different protection depending
 * on whether the session is interactive (main session) or non-interactive (spawned subagent).
 *
 * Modules:
 *   types.ts     — shared types and constants
 *   analyze.ts   — command risk analysis (tokenize, segment, detect)
 *   allowlist.ts — pattern allowlist (session + always scopes, pre-compiled regex)
 *   ui.ts        — interactive overlay prompt (bottom-anchored)
 *   subagent.ts  — headless blocklist for non-interactive subagents
 *   index.ts     — extension factory (wiring only)
 *
 * Original: https://github.com/amosblomqvist/pi-config/tree/main/extensions/bash-guard
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { analyzeBashCommand } from "./analyze.js";
import { Allowlist } from "./allowlist.js";
import { promptDecision } from "./ui.js";
import { registerSubagentGuard } from "./subagent.js";

// ─── Stats ──────────────────────────────────────────────────────────────────

interface Stats {
	blocked: number;
	allowed: number;
	blockedReasons: Map<string, number>;
}

function recordBlock(stats: Stats, reason: string) {
	stats.blocked++;
	stats.blockedReasons.set(reason, (stats.blockedReasons.get(reason) ?? 0) + 1);
}

/** Normalize whitespace for comparison (prevents retry bypass via spaces). */
function normalize(cmd: string): string {
	return cmd.replace(/\s+/g, " ").trim();
}

// ─── Subagent detection ─────────────────────────────────────────────────────

const _subagentDepth = Number(process.env.PI_SUBAGENT_DEPTH ?? "0");
const _isSubagent = Number.isFinite(_subagentDepth) && _subagentDepth >= 1;

// ─── Extension factory ──────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	const stats: Stats = { blocked: 0, allowed: 0, blockedReasons: new Map() };
	const allowlist = new Allowlist();
	let yoloMode = false;

	// ── Subagent: hard-block only, no prompting ──

	if (_isSubagent) {
		registerSubagentGuard(pi);
		return;
	}

	// ── Main session ──

	pi.registerFlag("bash-guard-auto-allow", {
		description: "Auto-allow flagged commands when no UI is available.",
		type: "boolean",
		default: false,
	});

	pi.registerFlag("bash-guard-yolo", {
		description: "Disable bash-guard interception entirely (YOLO mode).",
		type: "boolean",
		default: false,
	});

	// Recently-aborted cache to prevent retry loops
	const recentlyAborted = new Map<string, number>();
	const ABORT_MS = 60_000;

	const cleanup = setInterval(() => {
		const now = Date.now();
		for (const [k, ts] of recentlyAborted) {
			if (now - ts > ABORT_MS) recentlyAborted.delete(k);
		}
	}, 120_000);
	cleanup.unref?.();

	// ── Commands ──

	pi.registerCommand("bash-guard-stats", {
		description: "Show bash-guard session statistics",
		handler: async (_args, ctx) => {
			const total = stats.blocked + stats.allowed;
			if (total === 0) { ctx.ui.notify("bash-guard: No commands intercepted yet.", "info"); return; }
			const lines = [
				`bash-guard stats:`,
				`  Allowed: ${stats.allowed}  Blocked: ${stats.blocked}`,
				`  YOLO: ${yoloMode ? "ON" : "off"}  Session rules: ${allowlist.sessionCount}  Always rules: ${allowlist.alwaysCount}`,
			];
			if (stats.blockedReasons.size > 0) {
				lines.push("  Top blocked:");
				for (const [reason, count] of [...stats.blockedReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
					lines.push(`    (${count}x) ${reason}`);
				}
			}
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("bash-guard-yolo", {
		description: "Toggle YOLO mode (skip all bash-guard checks)",
		handler: async (_args, ctx) => {
			yoloMode = !yoloMode;
			ctx.ui.setStatus("bash-guard", yoloMode ? "YOLO" : undefined);
			ctx.ui.notify(`bash-guard YOLO: ${yoloMode ? "ON" : "OFF"}`, yoloMode ? "warning" : "info");
		},
	});

	pi.registerCommand("bash-guard-allow", {
		description: "Add regex pattern to allowlist. Usage: /bash-guard-allow <pattern> [session|always]",
		handler: async (args, ctx) => {
			const parts = (args ?? "").trim().split(/\s+/);
			const pattern = parts[0];
			const scope = parts[1] ?? "session";

			if (!pattern) { ctx.ui.notify("Usage: /bash-guard-allow <regex> [session|always]", "error"); return; }
			try { new RegExp(pattern); } catch { ctx.ui.notify(`Invalid regex: ${pattern}`, "error"); return; }

			if (scope === "always") {
				allowlist.addAlways(pattern);
				ctx.ui.notify(`bash-guard: ALWAYS rule /${pattern}/`, "info");
			} else {
				allowlist.addSession(pattern);
				ctx.ui.notify(`bash-guard: SESSION rule /${pattern}/`, "info");
			}
		},
	});

	pi.registerCommand("bash-guard-rules", {
		description: "List all active allowlist rules",
		handler: async (_args, ctx) => {
			const lines = ["bash-guard allowlist:"];
			if (allowlist.sessionCount === 0 && allowlist.alwaysCount === 0) lines.push("  (empty)");
			for (const p of allowlist.sessionRules) lines.push(`  [session] /${p}/`);
			for (const p of allowlist.alwaysRules) lines.push(`  [always]  /${p}/`);
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("bash-guard-remove", {
		description: "Remove a specific allowlist rule. Usage: /bash-guard-remove <pattern>",
		handler: async (args, ctx) => {
			const pattern = (args ?? "").trim();
			if (!pattern) { ctx.ui.notify("Usage: /bash-guard-remove <pattern>", "error"); return; }
			if (allowlist.removeSession(pattern)) { ctx.ui.notify(`Removed session rule /${pattern}/`, "info"); return; }
			if (allowlist.removeAlways(pattern)) { ctx.ui.notify(`Removed always rule /${pattern}/`, "info"); return; }
			ctx.ui.notify(`Rule not found: /${pattern}/`, "error");
		},
	});

	pi.registerCommand("bash-guard-clear", {
		description: "Clear allowlist rules. Usage: /bash-guard-clear [session|always|all]",
		handler: async (args, ctx) => {
			const scope = (args ?? "").trim() || "all";
			if (scope === "session" || scope === "all") allowlist.clearSession();
			if (scope === "always" || scope === "all") allowlist.clearAlways();
			ctx.ui.notify(`Cleared ${scope} allowlist rules.`, "info");
		},
	});

	// ── Tool call interception ──

	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const command = event.input.command;

		if (yoloMode) return;

		if (allowlist.allows(command)) { stats.allowed++; return; }

		const risk = analyzeBashCommand(command);
		if (!risk) return;

		// Auto-block retries of recently-aborted commands (normalized to prevent space-bypass)
		const now = Date.now();
		const key = normalize(command);
		if (recentlyAborted.has(key) && now - (recentlyAborted.get(key) ?? 0) < ABORT_MS) {
			recordBlock(stats, risk.reasons[0] ?? "retry");
			return { block: true, reason: "Blocked by bash-guard: already aborted recently. Do not retry." };
		}

		// No UI fallbacks
		if (!ctx.hasUI && pi.getFlag("bash-guard-auto-allow")) { stats.allowed++; return; }
		if (!ctx.hasUI) {
			recordBlock(stats, risk.reasons[0] ?? "no-UI");
			return { block: true, reason: `Blocked by bash-guard (no UI): ${risk.reasons.join("; ")}. Use --bash-guard-auto-allow or /bash-guard-yolo.` };
		}

		// Prompt user
		const decision = await promptDecision(ctx, command, risk);

		if (decision === "run") { stats.allowed++; return; }
		if (decision === "run-session") { allowlist.allowSessionCommand(command); stats.allowed++; return; }
		if (decision === "run-always") { allowlist.allowAlwaysCommand(command); stats.allowed++; return; }

		// Abort
		recordBlock(stats, risk.reasons[0] ?? "user-abort");
		recentlyAborted.set(normalize(command), now);
		return { block: true, reason: "Blocked by user via bash-guard. Propose a non-destructive alternative." };
	});

	// ── Session lifecycle ──

	pi.on("session_start", async (_event, ctx: ExtensionContext) => {
		if (pi.getFlag("bash-guard-yolo")) yoloMode = true;
		if (yoloMode) ctx.ui.setStatus("bash-guard", "YOLO");
	});

	pi.on("session_shutdown", async () => {
		clearInterval(cleanup);
		recentlyAborted.clear();
	});
}
