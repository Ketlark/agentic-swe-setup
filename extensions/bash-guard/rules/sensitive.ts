import type { Rule } from "../types.js";

const READERS = new Set(["cat", "head", "tail", "less", "more", "tee", "echo", "printf"]);

export const sensitiveRules: Rule[] = [
	{
		id: "sensitive.file-read",
		match: (ctx) => READERS.has(ctx.cmd),
		analyze: (ctx) => {
			const hits = ctx.touchesSensitive();
			return hits.length > 0 ? { severity: "medium", reasons: hits } : null;
		},
	},
];
