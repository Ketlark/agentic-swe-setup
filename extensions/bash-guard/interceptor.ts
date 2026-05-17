import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { analyzeBashCommand } from "./analyze.js";
import { ABORT_MS, type State } from "./session.js";
import type { Mode } from "./types.js";
import { promptDecision } from "./ui.js";

function recordBlock(state: State, reason: string): void {
	state.stats.blocked++;
	state.stats.blockedReasons.set(reason, (state.stats.blockedReasons.get(reason) ?? 0) + 1);
}

function normalize(cmd: string): string {
	return cmd.replace(/\s+/g, " ").trim();
}

function currentMode(): Mode {
	const phase = process.env.PI_PLAN_PHASE;
	if (phase === "planning") return "plan";
	return "main";
}

export function registerInterceptor(pi: ExtensionAPI, state: State): void {
	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const command = event.input.command;

		if (state.yoloMode) return;

		if (state.allowlist.allows(command)) {
			state.stats.allowed++;
			return;
		}

		const mode = currentMode();
		const risk = analyzeBashCommand(command, { mode });
		if (!risk) return;

		// In plan mode, whitelist violations are always hard-blocked — no prompt needed.
		// The planner should only be running read-only commands.
		if (mode === "plan") {
			recordBlock(state, risk.reasons[0] ?? "plan-mode");
			return {
				block: true,
				reason: `Blocked by bash-guard (plan mode): ${risk.reasons.join("; ")}. Exit plan mode to run this command.`,
			};
		}

		const now = Date.now();
		const key = normalize(command);
		if (state.recentlyAborted.has(key) && now - (state.recentlyAborted.get(key) ?? 0) < ABORT_MS) {
			recordBlock(state, risk.reasons[0] ?? "retry");
			return {
				block: true,
				reason: "Blocked by bash-guard: already aborted recently. Do not retry.",
			};
		}

		if (!ctx.hasUI && pi.getFlag("bash-guard-auto-allow")) {
			state.stats.allowed++;
			return;
		}
		if (!ctx.hasUI) {
			recordBlock(state, risk.reasons[0] ?? "no-UI");
			return {
				block: true,
				reason: `Blocked by bash-guard (no UI): ${risk.reasons.join("; ")}. Use --bash-guard-auto-allow or /bash-guard-yolo.`,
			};
		}

		const decision = await promptDecision(ctx, command, risk);

		if (decision === "run") {
			state.stats.allowed++;
			return;
		}
		if (decision === "run-session") {
			state.allowlist.allowSessionCommand(command);
			state.stats.allowed++;
			return;
		}
		if (decision === "run-always") {
			state.allowlist.allowAlwaysCommand(command);
			state.stats.allowed++;
			return;
		}

		recordBlock(state, risk.reasons[0] ?? "user-abort");
		state.recentlyAborted.set(normalize(command), now);
		return {
			block: true,
			reason: "Blocked by user via bash-guard. Propose a non-destructive alternative.",
		};
	});
}
