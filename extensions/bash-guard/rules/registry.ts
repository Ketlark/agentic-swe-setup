import {
	type Mode,
	type Rule,
	type RuleContext,
	type RuleFinding,
	SENSITIVE_FILE_PATTERNS,
	type Severity,
	type Token,
	isOpToken,
} from "../types.js";
import { destructiveRules } from "./destructive.js";
import { elevatedRules } from "./elevated.js";
import { planOnlyRules } from "./plan-only.js";
import { sensitiveRules } from "./sensitive.js";
import { subagentOnlyRules } from "./subagent-only.js";

const ALL_RULES: readonly Rule[] = [
	...destructiveRules,
	...elevatedRules,
	...sensitiveRules,
	...subagentOnlyRules,
	...planOnlyRules,
];

function ruleAppliesIn(rule: Rule, mode: Mode): boolean {
	const scope = rule.appliesIn ?? "both";
	if (scope === "both") return true;
	return scope === mode;
}

function isFlag(a: string): boolean {
	return a.startsWith("-") && /^-[a-zA-Z?]+$/.test(a);
}

function buildContext(segment: Token[], allTokens: Token[]): RuleContext | null {
	const args = segment.filter((t): t is string => typeof t === "string");
	if (args.length === 0) return null;

	const [cmd, ...rest] = args;

	return {
		cmd,
		args: rest,
		allTokens,
		segment,
		hasFlag: (flag: string): boolean => {
			if (rest.includes(flag)) return true;
			if (flag.startsWith("--")) return rest.some((a) => a === flag || a.startsWith(`${flag}=`));
			if (flag.length === 2 && flag.startsWith("-")) {
				const ch = flag[1];
				return rest.some((a) => isFlag(a) && a.includes(ch));
			}
			return false;
		},
		anyStartsWith: (prefix: string): boolean => rest.some((a) => a.startsWith(prefix)),
		touchesSensitive: (): string[] => {
			const out: string[] = [];
			for (const a of rest) {
				for (const p of SENSITIVE_FILE_PATTERNS) {
					if (p.test(a)) {
						out.push(`sensitive file: ${a}`);
						break;
					}
				}
			}
			return out;
		},
	};
}

export function analyzeSegment(
	segment: Token[],
	allTokens: Token[],
	mode: Mode = "main"
): RuleFinding | null {
	const ctx = buildContext(segment, allTokens);
	if (!ctx) return null;

	const reasons: string[] = [];
	let severity: Severity = "medium";

	for (const rule of ALL_RULES) {
		if (!ruleAppliesIn(rule, mode)) continue;
		try {
			if (!rule.match(ctx)) continue;
			const finding = rule.analyze(ctx);
			if (!finding) continue;
			if (finding.severity === "high") severity = "high";
			reasons.push(...finding.reasons);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[bash-guard] rule "${rule.id}" threw: ${msg}`);
			severity = "high";
			reasons.push(`rule analysis failed (${rule.id}), blocked by precaution`);
		}
	}

	return reasons.length > 0 ? { severity, reasons: [...new Set(reasons)] } : null;
}

export function splitOnOps(tokens: Token[], ops: string[]): Token[][] {
	const out: Token[][] = [];
	let cur: Token[] = [];
	for (const t of tokens) {
		if (isOpToken(t) && ops.includes(t.op)) {
			if (cur.length) out.push(cur);
			cur = [];
			continue;
		}
		cur.push(t);
	}
	if (cur.length) out.push(cur);
	return out;
}
