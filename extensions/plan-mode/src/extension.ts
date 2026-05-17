// Extension bootstrap — the orchestrator. Resolves configuration, creates
// state, and registers all commands + event handlers. Delegates everything
// to domain-specific modules.
//
// Forked from dreki-gg/pi-plan-mode, adapted for this harness.
// Re-evaluate when Pi ships a native plan-mode lifecycle.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { dirname, resolve } from "node:path";
import { registerCommands } from "./commands.js";
import { loadConfig } from "./config.js";
import { registerHandlers } from "./handlers/index.js";
import { createState } from "./state.js";

export default async function planMode(pi: ExtensionAPI): Promise<void> {
	const extensionDir = dirname(new URL(import.meta.url).pathname);
	const settingsPath = resolve(extensionDir, "../../../settings.json");
	const config = await loadConfig(settingsPath);
	const state = createState(config);

	pi.registerFlag("plan", {
		description: "Start in plan mode (read-only + configured thinking level)",
		type: "boolean",
		default: false,
	});

	registerCommands(pi, state);
	registerHandlers(pi, state, settingsPath);
}
