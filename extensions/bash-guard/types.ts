// ─── Shared types ────────────────────────────────────────────────────────────

export type Severity = "high" | "medium";

export type Decision = "run" | "run-session" | "run-always" | "abort";

export type Risk = {
	severity: Severity;
	reasons: string[];
};

export type OpToken = { op: string; [k: string]: unknown };
export type Token = string | OpToken;

/** Type guard for shell-quote operator tokens (||, &&, ;, |, >, etc.). */
export function isOpToken(t: Token): t is OpToken {
	return typeof t === "object" && t !== null && "op" in t;
}

// ─── Rule engine types ──────────────────────────────────────────────────────

export type RuleContext = {
	cmd: string;
	args: string[];
	allTokens: Token[];
	segment: Token[];
	hasFlag: (flag: string) => boolean;
	anyStartsWith: (prefix: string) => boolean;
	touchesSensitive: () => string[];
};

export type RuleFinding = {
	severity: Severity;
	reasons: string[];
};

/** Where a rule applies. Defaults to "both" — main session prompts the user,
 *  subagent hard-blocks if severity === "high". A "subagent" rule fires only
 *  in non-interactive subagent contexts (e.g. block git commit/push/pull).
 *  A "plan" rule fires only in plan-mode (planning phase). A "main" rule never
 *  participates in subagent or plan decisions. */
export type RuleScope = "main" | "subagent" | "plan" | "both";

export type Mode = "main" | "subagent" | "plan";

export type Rule = {
	id: string;
	match: (ctx: RuleContext) => boolean;
	analyze: (ctx: RuleContext) => RuleFinding | null;
	appliesIn?: RuleScope;
};

// ─── Constants ──────────────────────────────────────────────────────────────

/** Read-only git subcommands — safe, no risk.
 *  Note: `branch`, `stash`, `reflog` are NOT here because they have destructive
 *  variants (`branch -D`, `stash drop`, `reflog expire`) handled by the git rule. */
export const GIT_READONLY = new Set([
	"status",
	"log",
	"diff",
	"show",
	"tag",
	"remote",
	"describe",
	"name-rev",
	"rev-parse",
	"ls-files",
	"ls-tree",
	"ls-remote",
	"shortlog",
	"blame",
	"annotate",
	"count-objects",
	"fsck",
	"config",
	"for-each-ref",
	"whatchanged",
]);

/** File patterns that indicate sensitive data. */
export const SENSITIVE_FILE_PATTERNS: RegExp[] = [
	/\.env\b/,
	/\/\.ssh\//,
	/\/\.gnupg\//,
	/\/\.aws\//,
	/id_rsa/,
	/id_ed25519/,
	/id_ecdsa/,
	/\.pem$/,
	/\.key$/,
	/credentials/i,
	/\.netrc/,
	/\.npmrc/,
	/\.pypirc/,
];
