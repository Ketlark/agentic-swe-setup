// Reads skill contracts from SKILL.md frontmatters and builds a compact
// injection block for the planning system prompt. Skills without contract
// fields are silently skipped — single source of truth, no CONTRACTS.md.

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type SkillContract = {
	readonly name: string;
	readonly triggers: string;
	readonly outputs: string;
	readonly budget?: string;
	readonly done_when: string;
};

function parseFrontmatter(content: string): Record<string, string> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return {};

	const fields: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const colon = line.indexOf(":");
		if (colon === -1) continue;
		const key = line.slice(0, colon).trim();
		const value = line.slice(colon + 1).trim();
		if (key && value) fields[key] = value;
	}
	return fields;
}

async function readSkillContract(
	baseDir: string,
	skillPath: string,
): Promise<SkillContract | undefined> {
	const skillMdPath = resolve(baseDir, skillPath, "SKILL.md");
	const content = await readFile(skillMdPath, "utf-8");
	const fm = parseFrontmatter(content);
	if (!fm.triggers || !fm.outputs || !fm.done_when) return undefined;
	return {
		name: fm.name ?? skillPath,
		triggers: fm.triggers,
		outputs: fm.outputs,
		budget: fm.budget,
		done_when: fm.done_when,
	};
}

function formatContract(contract: SkillContract): string {
	const lines = [
		contract.name,
		`  triggers: ${contract.triggers}`,
		`  outputs: ${contract.outputs}`,
	];
	if (contract.budget) lines.push(`  budget: ${contract.budget}`);
	lines.push(`  done_when: ${contract.done_when}`, "");
	return lines.join("\n");
}

export async function buildContractBlock(settingsPath: string): Promise<string> {
	const baseDir = dirname(settingsPath);

	let skillPaths: string[];
	try {
		const settings = JSON.parse(await readFile(settingsPath, "utf-8")) as {
			skills?: string[];
		};
		skillPaths = settings.skills ?? [];
	} catch {
		return "";
	}

	if (skillPaths.length === 0) return "";

	const results = await Promise.allSettled(
		skillPaths.map((path) => readSkillContract(baseDir, path)),
	);
	const contracts = results
		.filter(
			(r): r is PromiseFulfilledResult<SkillContract | undefined> =>
				r.status === "fulfilled",
		)
		.map((r) => r.value)
		.filter((c): c is SkillContract => c !== undefined);

	if (contracts.length === 0) return "";

	const header =
		"Available task disciplines (infer the best match; write a standard checklist if none fits):\n";
	return header + contracts.map(formatContract).join("\n");
}
