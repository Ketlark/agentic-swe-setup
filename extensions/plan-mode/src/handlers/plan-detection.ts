// Detects when the agent writes files into .plans/<name>/ during planning.
// Sets planDir on first write and updates the plans.json manifest with
// the plan title extracted from PLAN.md.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { PLANS_DIR, toPlanDir } from "../constants.js";
import { updatePlansManifest } from "../manifest.js";
import { extractPlanTitle } from "../parse.js";
import { type State, persist } from "../state.js";

const PLAN_DIR_PATTERN = new RegExp(`${PLANS_DIR}/([^/]+)/`);

export function registerPlanDetection(pi: ExtensionAPI, state: State): void {
	pi.on("tool_result", async (event) => {
		if (state.phase !== "planning") return;
		if (event.toolName !== "write" && event.toolName !== "edit") return;
		if (event.isError) return;

		const path = (event.input as { path?: string }).path;
		if (!path) return;

		const planName = path.match(PLAN_DIR_PATTERN)?.[1];
		if (!planName) return;

		const title = path.endsWith("PLAN.md")
			? await readTitleSafe(path)
			: undefined;

		if (!state.planDir) {
			state.planDir = toPlanDir(planName);
			await updatePlansManifest(planName, "in-progress", title);
			persist(pi, state);
		} else if (title) {
			await updatePlansManifest(planName, "in-progress", title);
		}
	});
}

async function readTitleSafe(path: string): Promise<string | undefined> {
	try {
		return extractPlanTitle(await readFile(path, "utf-8"));
	} catch {
		return undefined;
	}
}
