// Assumption: models consume raw CLI output without compression,
// inflating context and degrading downstream reasoning. RTK rewrites
// compress noisy tool output before it enters the context window.
// Re-evaluate when context windows grow large enough (or models
// self-summarize well enough) that raw output stops hurting.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { detectRtk } from "./detect.js";
import { type RtkState, registerInterceptor } from "./interceptor.js";

export default function (pi: ExtensionAPI) {
	const state: RtkState = {
		available: false,
		version: null,
		disabled: false,
		stats: { rewrites: 0, errors: 0, bypassed: 0 },
		cache: new Map(),
	};

	pi.on("session_start", async (_event, ctx) => {
		const version = await detectRtk();
		if (version) {
			state.available = true;
			state.version = version;
			ctx.ui.notify(`[rtk] detected: ${version}`, "info");
		} else {
			ctx.ui.notify("[rtk] binary not found — extension disabled", "warning");
		}
	});

	pi.on("session_shutdown", async () => {
		state.cache.clear();
	});

	registerInterceptor(pi, state);

	pi.registerCommand("rtk-status", {
		description: "Show RTK rewrite status and stats",
		handler: async (_args, ctx) => {
			const lines = [
				"rtk-rewrite status:",
				`  Available: ${state.available ? `yes (${state.version})` : "no"}`,
				`  Disabled:  ${state.disabled ? "yes" : "no"}`,
				`  Rewrites:  ${state.stats.rewrites}`,
				`  Errors:    ${state.stats.errors}`,
				`  Bypassed:  ${state.stats.bypassed}`,
				`  Cache:     ${state.cache.size} entries`,
			];
			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
