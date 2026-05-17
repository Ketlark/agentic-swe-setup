// Owns .plans/plans.json — the tracking manifest for plan lifecycle.
// Single-file ownership of the manifest schema, reads, and writes.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DEFAULT_PLAN_TITLE, PLANS_DIR } from "./constants.js";

export type PlanStatus = "in-progress" | "done";

export type PlanEntry = {
	readonly status: PlanStatus;
	readonly title: string;
	readonly created: string;
	readonly completed: string | null;
};

export type PlansManifest = Record<string, PlanEntry>;

const PLANS_JSON = `${PLANS_DIR}/plans.json`;

export async function readPlansJson(): Promise<PlansManifest> {
	try {
		const text = await readFile(PLANS_JSON, "utf-8");
		if (text.trim()) return JSON.parse(text) as PlansManifest;
	} catch {
		// File missing or invalid JSON — start fresh
	}
	return {};
}

export async function updatePlansManifest(
	planName: string,
	status: PlanStatus,
	title?: string,
): Promise<void> {
	const manifest = await readPlansJson();
	const existing = manifest[planName];
	const now = new Date().toISOString();

	manifest[planName] = {
		status,
		title: title ?? existing?.title ?? DEFAULT_PLAN_TITLE,
		created: existing?.created ?? now,
		completed: status === "done" ? now : null,
	};

	await mkdir(PLANS_DIR, { recursive: true });
	await writeFile(PLANS_JSON, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}
