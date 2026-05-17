import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { State } from "./session.js";

export function registerCommands(pi: ExtensionAPI, state: State): void {
	pi.registerCommand("bash-guard-stats", {
		description: "Show bash-guard session statistics",
		handler: async (_args, ctx) => {
			const total = state.stats.blocked + state.stats.allowed;
			if (total === 0) {
				ctx.ui.notify("bash-guard: No commands intercepted yet.", "info");
				return;
			}
			const lines = [
				"bash-guard stats:",
				`  Allowed: ${state.stats.allowed}  Blocked: ${state.stats.blocked}`,
				`  YOLO: ${state.yoloMode ? "ON" : "off"}  Session rules: ${state.allowlist.sessionCount}  Always rules: ${state.allowlist.alwaysCount}`,
			];
			if (state.stats.blockedReasons.size > 0) {
				lines.push("  Top blocked:");
				for (const [reason, count] of [...state.stats.blockedReasons.entries()]
					.sort((a, b) => b[1] - a[1])
					.slice(0, 5)) {
					lines.push(`    (${count}x) ${reason}`);
				}
			}
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("bash-guard-yolo", {
		description: "Toggle YOLO mode (skip all bash-guard checks)",
		handler: async (_args, ctx) => {
			state.yoloMode = !state.yoloMode;
			ctx.ui.setStatus("bash-guard", state.yoloMode ? "YOLO" : undefined);
			ctx.ui.notify(
				`bash-guard YOLO: ${state.yoloMode ? "ON" : "OFF"}`,
				state.yoloMode ? "warning" : "info"
			);
		},
	});

	pi.registerCommand("bash-guard-allow", {
		description:
			"Add regex pattern to allowlist. Usage: /bash-guard-allow <pattern> [session|always]",
		handler: async (args, ctx) => {
			const parts = (args ?? "").trim().split(/\s+/);
			const pattern = parts[0];
			const scope = parts[1] ?? "session";

			if (!pattern) {
				ctx.ui.notify("Usage: /bash-guard-allow <regex> [session|always]", "error");
				return;
			}
			try {
				new RegExp(pattern);
			} catch {
				ctx.ui.notify(`Invalid regex: ${pattern}`, "error");
				return;
			}

			if (scope === "always") {
				state.allowlist.addAlways(pattern);
				ctx.ui.notify(`bash-guard: ALWAYS rule /${pattern}/`, "info");
			} else {
				state.allowlist.addSession(pattern);
				ctx.ui.notify(`bash-guard: SESSION rule /${pattern}/`, "info");
			}
		},
	});

	pi.registerCommand("bash-guard-rules", {
		description: "List all active allowlist rules",
		handler: async (_args, ctx) => {
			const lines = ["bash-guard allowlist:"];
			if (state.allowlist.sessionCount === 0 && state.allowlist.alwaysCount === 0)
				lines.push("  (empty)");
			for (const p of state.allowlist.sessionRules) lines.push(`  [session] /${p}/`);
			for (const p of state.allowlist.alwaysRules) lines.push(`  [always]  /${p}/`);
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	pi.registerCommand("bash-guard-remove", {
		description: "Remove a specific allowlist rule. Usage: /bash-guard-remove <pattern>",
		handler: async (args, ctx) => {
			const pattern = (args ?? "").trim();
			if (!pattern) {
				ctx.ui.notify("Usage: /bash-guard-remove <pattern>", "error");
				return;
			}
			if (state.allowlist.removeSession(pattern)) {
				ctx.ui.notify(`Removed session rule /${pattern}/`, "info");
				return;
			}
			if (state.allowlist.removeAlways(pattern)) {
				ctx.ui.notify(`Removed always rule /${pattern}/`, "info");
				return;
			}
			ctx.ui.notify(`Rule not found: /${pattern}/`, "error");
		},
	});

	pi.registerCommand("bash-guard-clear", {
		description: "Clear allowlist rules. Usage: /bash-guard-clear [session|always|all]",
		handler: async (args, ctx) => {
			const scope = (args ?? "").trim() || "all";
			if (scope === "session" || scope === "all") state.allowlist.clearSession();
			if (scope === "always" || scope === "all") state.allowlist.clearAlways();
			ctx.ui.notify(`Cleared ${scope} allowlist rules.`, "info");
		},
	});
}
