// Extension-wide constants and naming conventions.
// Single source of truth for all magic strings and directory conventions.

export const PLAN_TOOLS = [
	"read", "bash", "grep", "find", "ls", "write", "search_skills",
] as const;

export const EXEC_TOOLS = [
	"read", "bash", "edit", "write", "search_skills",
] as const;

export const WIDGET_ID = {
	STATUS_BAR: "plan-mode",
	TODO_LIST: "plan-todos",
} as const;

export const MESSAGE_TYPE = {
	PERSISTENCE_KEY: "plan-mode",
	PLAN_CONTEXT: "plan-mode-context",
	EXEC_CONTEXT: "plan-execution-context",
	EXECUTE: "plan-mode-execute",
	REFINE: "plan-mode-refine",
	COMPLETE: "plan-complete",
} as const;

export const PLAN_MARKER = "[PLAN MODE ACTIVE]";

export const DEFAULT_PLAN_TITLE = "Untitled plan";

export const PLANS_DIR = ".plans";

export function toPlanDir(planName: string): string {
	return `${PLANS_DIR}/${planName}`;
}

export function toPlanName(planDir: string): string {
	return planDir.replace(`${PLANS_DIR}/`, "");
}
