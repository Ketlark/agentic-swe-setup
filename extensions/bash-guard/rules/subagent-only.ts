// Rules that fire only in non-interactive subagent contexts. They cover
// commands that are perfectly fine for a human-driven main session but
// catastrophic for an autonomous subagent (no human review).

import type { Rule } from "../types.js";

const SUBAGENT_FORBIDDEN_GIT = new Set(["commit", "pull", "push"]);

export const subagentOnlyRules: Rule[] = [
	{
		id: "subagent.git-write",
		appliesIn: "subagent",
		match: (ctx) => ctx.cmd === "git" && SUBAGENT_FORBIDDEN_GIT.has(ctx.args[0] ?? ""),
		analyze: (ctx) => ({
			severity: "high",
			reasons: [`git ${ctx.args[0]} (main-session only — subagent must defer)`],
		}),
	},
];
