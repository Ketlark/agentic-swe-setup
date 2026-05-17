// Reads plan-mode model configuration from settings.json.
// Falls back to defaults if the planMode block is absent.

import { readFile } from "node:fs/promises";
import type { ModelPreset } from "./types.js";

export type PlanModeConfig = {
	readonly planModel: ModelPreset;
	readonly executeModel: ModelPreset;
};

const DEFAULTS: PlanModeConfig = {
	planModel: { provider: "anthropic", id: "claude-opus-4-6", thinking: "medium" },
	executeModel: { provider: "openai", id: "gpt-5.5", thinking: "low" },
};

export async function loadConfig(settingsPath: string): Promise<PlanModeConfig> {
	try {
		const raw = JSON.parse(await readFile(settingsPath, "utf-8")) as {
			planMode?: Partial<{
				planModel: Partial<ModelPreset>;
				executeModel: Partial<ModelPreset>;
			}>;
		};
		const pm = raw.planMode ?? {};
		return {
			planModel: { ...DEFAULTS.planModel, ...(pm.planModel ?? {}) },
			executeModel: { ...DEFAULTS.executeModel, ...(pm.executeModel ?? {}) },
		};
	} catch {
		return DEFAULTS;
	}
}
