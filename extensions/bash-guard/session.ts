import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Allowlist } from "./allowlist.js";

export interface Stats {
	blocked: number;
	allowed: number;
	blockedReasons: Map<string, number>;
}

export interface State {
	stats: Stats;
	allowlist: Allowlist;
	yoloMode: boolean;
	recentlyAborted: Map<string, number>;
	cleanup: ReturnType<typeof setInterval>;
}

/** How long an aborted command stays "remembered" so the agent can't immediately
 *  retry the same risky command and bypass the user's previous abort. */
export const ABORT_MS = 60_000;

export function createState(): State {
	const recentlyAborted = new Map<string, number>();

	const cleanup = setInterval(() => {
		const now = Date.now();
		for (const [k, ts] of recentlyAborted) {
			if (now - ts > ABORT_MS) recentlyAborted.delete(k);
		}
	}, 120_000);
	cleanup.unref?.();

	return {
		stats: { blocked: 0, allowed: 0, blockedReasons: new Map() },
		allowlist: new Allowlist(),
		yoloMode: false,
		recentlyAborted,
		cleanup,
	};
}

export function registerSessionHooks(pi: ExtensionAPI, state: State): void {
	pi.on("session_start", async (_event, ctx: ExtensionContext) => {
		if (pi.getFlag("bash-guard-yolo")) state.yoloMode = true;
		if (state.yoloMode) ctx.ui.setStatus("bash-guard", "YOLO");
	});

	pi.on("session_shutdown", async () => {
		clearInterval(state.cleanup);
		state.recentlyAborted.clear();
	});
}
