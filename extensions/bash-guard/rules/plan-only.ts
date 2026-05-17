// Plan-mode bash whitelist. In planning phase (PI_PLAN_PHASE=planning) only
// read-only commands and .plans/ writes are permitted. Everything else is
// blocked at high severity — the agent should be exploring, not executing.
//
// Safe set mirrors dreki-gg's PLAN_TOOLS spirit but is enforced here as a
// declarative rule so the rule is auditable alongside all other bash-guard rules.

import type { Rule } from "../types.js";

const READ_ONLY_COMMANDS = new Set([
	// Filesystem inspection
	"ls",
	"find",
	"cat",
	"head",
	"tail",
	"less",
	"more",
	"file",
	"stat",
	"wc",
	"du",
	"df",
	// Search
	"grep",
	"rg",
	"ack",
	"ag",
	// Text processing (read-only)
	"awk",
	"sed",
	"sort",
	"uniq",
	"cut",
	"tr",
	"jq",
	// Git read-only
	"git",
	// Node/package read-only
	"node",
	"which",
	"type",
	"echo",
	"printf",
	"pwd",
	"env",
	// Curl (read-only fetches)
	"curl",
	"wget",
]);

/** Returns true if the command is a safe git subcommand (read-only). */
function isSafeGit(args: string[]): boolean {
	const sub = args[0];
	if (!sub) return false;
	const SAFE_GIT_SUBS = new Set([
		"status", "log", "diff", "show", "tag", "remote", "describe",
		"name-rev", "rev-parse", "ls-files", "ls-tree", "ls-remote",
		"shortlog", "blame", "annotate", "count-objects", "fsck",
		"config", "for-each-ref", "whatchanged", "branch",
	]);
	return SAFE_GIT_SUBS.has(sub);
}

/** Returns true if the command creates a directory inside .plans/ (allowed). */
function isMkdirPlans(cmd: string, args: string[]): boolean {
	if (cmd !== "mkdir") return false;
	return args.some((a) => !a.startsWith("-") && /^\.plans(\/|$)/.test(a));
}

export const planOnlyRules: Rule[] = [
	{
		id: "plan-mode-whitelist",
		appliesIn: "plan",
		match(_ctx) {
			// Only fires when plan-mode is active (set by plan-mode extension)
			return process.env.PI_PLAN_PHASE === "planning";
		},
		analyze(ctx) {
			const { cmd, args } = ctx;

			// Allow mkdir for .plans/ directories
			if (isMkdirPlans(cmd, args)) return null;

			// Allow all read-only commands
			if (READ_ONLY_COMMANDS.has(cmd)) {
				// Narrow git to safe subcommands only
				if (cmd === "git" && !isSafeGit(args)) {
					return {
						severity: "high",
						reasons: [`plan mode: git ${args[0] ?? "(no subcommand)"} is not allowed in planning phase — read-only git commands only`],
					};
				}
				return null;
			}

			// Block everything else
			return {
				severity: "high",
				reasons: [`plan mode: "${cmd}" is not allowed in planning phase — use read-only commands or exit plan mode first`],
			};
		},
	},
];
