// Tokenizes shell commands via shell-quote, splits on operators, and delegates
// each segment to the rule registry. On parse failure, fails closed: returns
// a high-severity finding so callers (interceptor, subagent) make the safe
// decision (prompt user / hard-block) rather than proceeding blindly.

import { parse as shellParse } from "shell-quote";
import { analyzeSegment, splitOnOps } from "./rules/registry.js";
import { type Mode, type Risk, type Severity, type Token, isOpToken } from "./types.js";

const FAIL_CLOSED: Risk = {
	severity: "high",
	reasons: ["unparseable shell command (blocked by precaution)"],
};

export function analyzeBashCommand(command: string, opts?: { mode?: Mode }): Risk | null {
	const mode = opts?.mode ?? "main";

	let tokens: Token[];
	try {
		tokens = shellParse(command) as Token[];
	} catch {
		return FAIL_CLOSED;
	}

	const reasons: string[] = [];
	let severity: Severity = "medium";

	const ops = tokens.filter(isOpToken).map((t) => t.op);
	if (ops.some((o) => o === ">" || o === ">>")) reasons.push("output redirection (can overwrite)");
	if (ops.some((o) => o === "2>" || o === "2>>"))
		reasons.push("stderr redirection (can overwrite)");
	if (ops.includes("<")) reasons.push("input redirection");
	if (ops.includes("|")) reasons.push("pipe (chained commands)");

	for (const seg of splitOnOps(tokens, ["&&", "||", ";"])) {
		const risk = analyzeSegment(seg, tokens, mode);
		if (!risk) continue;
		if (risk.severity === "high") severity = "high";
		reasons.push(...risk.reasons);
	}

	const uniq = [...new Set(reasons)];
	return uniq.length > 0 ? { severity, reasons: uniq } : null;
}
