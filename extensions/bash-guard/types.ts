// ─── Shared types ────────────────────────────────────────────────────────────

export type Severity = "high" | "medium";

export type Decision = "run" | "run-session" | "run-always" | "abort";

export type Risk = {
	severity: Severity;
	reasons: string[];
};

export type OpToken = { op: string; [k: string]: unknown };
export type Token = string | OpToken;

/** Read-only git subcommands — safe, no risk. */
export const GIT_READONLY = new Set([
	"status", "log", "diff", "show", "branch", "tag",
	"remote", "stash", "describe", "name-rev", "rev-parse",
	"ls-files", "ls-tree", "ls-remote", "shortlog", "reflog",
	"blame", "annotate", "count-objects", "fsck",
	"config", "for-each-ref", "whatchanged",
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
