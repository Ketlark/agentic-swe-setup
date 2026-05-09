// ─── Command risk analysis ──────────────────────────────────────────────────
//
// Tokenizes shell commands via shell-quote, splits on operators (&&, ||, ;),
// and runs each segment through rule detection. Falls back to raw regex on parse failure.

import { parse as shellParse } from "shell-quote";
import type { Token, OpToken, Risk, Severity } from "./types.js";
import { GIT_READONLY, SENSITIVE_FILE_PATTERNS } from "./types.js";

// ─── Token helpers ───────────────────────────────────────────────────────────

function isOpToken(t: Token): t is OpToken {
	return typeof t === "object" && t !== null && "op" in t;
}

function toStrings(tokens: Token[]): string[] {
	return tokens.filter((t): t is string => typeof t === "string");
}

function splitOnOps(tokens: Token[], ops: string[]): Token[][] {
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

/** A proper flag is `-` followed by letters only (no dots, slashes, etc.). */
function isFlag(a: string): boolean {
	return a.startsWith("-") && /^-[a-zA-Z?]+$/.test(a);
}

function hasFlag(args: string[], flag: string): boolean {
	if (args.includes(flag)) return true;
	if (flag.startsWith("--")) return args.some((a) => a === flag || a.startsWith(flag + "="));
	if (flag.length === 2 && flag.startsWith("-")) {
		const ch = flag[1];
		return args.some((a) => isFlag(a) && a.includes(ch));
	}
	return false;
}

function anyStartsWith(args: string[], prefix: string): boolean {
	return args.some((a) => a.startsWith(prefix));
}

function touchesSensitive(args: string[]): string[] {
	const out: string[] = [];
	for (const a of args) {
		for (const p of SENSITIVE_FILE_PATTERNS) {
			if (p.test(a)) { out.push(`sensitive file: ${a}`); break; }
		}
	}
	return out;
}

// ─── Segment-level risk detection ───────────────────────────────────────────

const SHELLS = new Set(["sh", "bash", "zsh", "fish", "dash", "ksh", "csh", "tcsh"]);
const DANGEROUS_PIPE_TARGETS = new Set(["eval", "xargs", "source", "exec"]);

function analyzeSegment(seg: Token[]): Risk | null {
	const reasons: string[] = [];
	let severity: Severity = "medium";

	const ops = seg.filter(isOpToken).map((o) => o.op);
	const args = toStrings(seg);
	if (args.length === 0) return null;

	const [cmd, ...rest] = args;

	// ── Pipe to shell (check RHS of pipe only) ──
	const pipeIdx = seg.findIndex((t) => isOpToken(t) && t.op === "|");
	if (pipeIdx !== -1) {
		const rhs = toStrings(seg.slice(pipeIdx + 1));
		if (rhs.length > 0 && (SHELLS.has(rhs[0]) || DANGEROUS_PIPE_TARGETS.has(rhs[0]))) {
			reasons.push("pipe to shell/exec/eval (possible RCE)");
			severity = "high";
		}
	}

	// ── Privilege escalation ──
	if (cmd === "sudo" || cmd === "doas") { severity = "high"; reasons.push(`${cmd} (elevated privileges)`); }
	if (cmd === "su") { severity = "high"; reasons.push("su (switch user)"); }

	// ── File deletion ──
	if (cmd === "rm" || cmd === "rmdir" || cmd === "unlink") {
		severity = "high";
		reasons.push(`${cmd} (file deletion)`);
		if (hasFlag(rest, "-r") || hasFlag(rest, "-R") || hasFlag(rest, "--recursive")) reasons.push("recursive (-r/-R)");
		if (hasFlag(rest, "-f") || hasFlag(rest, "--force")) reasons.push("forced (-f)");
		if (ops.includes("glob")) reasons.push("glob expansion");
		reasons.push(...touchesSensitive(rest));
	}

	if (cmd === "find" && rest.includes("-delete")) { severity = "high"; reasons.push("find -delete (bulk deletion)"); }
	if (cmd === "truncate") reasons.push("truncate (can erase contents)");

	// ── In-place modification ──
	if (cmd === "install" && rest.some((a) => a.startsWith("-m") || a.startsWith("-o"))) reasons.push("install (overwrite with permissions)");
	if (cmd === "sed" && (hasFlag(rest, "-i") || rest.includes("--in-place"))) reasons.push("sed -i (in-place modification)");
	if (cmd === "perl" && (rest.includes("-pi") || (rest.includes("-p") && rest.includes("-i")))) reasons.push("perl -i (in-place modification)");

	// ── Git ──
	if (cmd === "git") {
		const sub = rest[0];
		const subArgs = rest.slice(1);
		if (!sub || GIT_READONLY.has(sub)) return null;

		if (sub === "rm") { severity = "high"; reasons.push("git rm (staged deletion)"); }
		else if (sub === "clean" && (subArgs.some((a) => a.includes("-f")) || subArgs.includes("-d") || subArgs.includes("-x"))) { severity = "high"; reasons.push("git clean (untracked file deletion)"); }
		else if (sub === "reset" && subArgs.includes("--hard")) { severity = "high"; reasons.push("git reset --hard (discard changes)"); }
		else if ((sub === "checkout" || sub === "restore") && (subArgs.includes(".") || subArgs.includes("--") || subArgs.includes("--source"))) { reasons.push("git checkout/restore (overwrite working tree)"); }
		else if (sub === "push" && (subArgs.includes("--force") || subArgs.includes("--force-with-lease") || subArgs.includes("-f"))) { severity = "high"; reasons.push("git push --force (rewrite history)"); }
		else if (sub === "reflog" && subArgs.includes("expire")) { severity = "high"; reasons.push("git reflog expire (remove recovery history)"); }
		else if (sub === "gc" && subArgs.some((a) => a.startsWith("--prune"))) { severity = "high"; reasons.push("git gc --prune (delete objects)"); }
		else if (sub === "branch" && (subArgs.includes("-D") || subArgs.includes("--delete") || subArgs.includes("-d"))) { reasons.push("git branch delete"); }
		else if (sub === "stash" && (subArgs.includes("drop") || subArgs.includes("clear"))) { reasons.push("git stash drop/clear"); }
		else if (sub === "filter-branch" || sub === "filter-repo") { severity = "high"; reasons.push(`git ${sub} (history rewriting)`); }
		else { reasons.push(`git ${sub}`); }
	}

	// ── dd / disk ──
	if (cmd === "dd" && (anyStartsWith(rest, "of=") || rest.includes("of"))) { severity = "high"; reasons.push("dd (can overwrite data)"); }
	if (cmd.startsWith("mkfs")) { severity = "high"; reasons.push("mkfs (filesystem formatting)"); }
	if (cmd.startsWith("newfs_")) { severity = "high"; reasons.push("newfs_* (filesystem formatting)"); }
	if (cmd === "wipefs") { severity = "high"; reasons.push("wipefs (disk signature wipe)"); }
	if (cmd === "diskutil") { severity = "high"; reasons.push("diskutil (disk management)"); if (["eraseDisk", "eraseVolume", "zeroDisk", "secureErase"].some((s) => rest.includes(s))) reasons.push("diskutil erase (destructive)"); }
	if (cmd === "hdiutil") { severity = "high"; reasons.push("hdiutil (disk image management)"); }
	if (cmd === "gpt") { severity = "high"; reasons.push("gpt (partition manipulation)"); }
	if (cmd === "asr") { severity = "high"; reasons.push("asr (volume overwrite)"); }
	if (["parted", "fdisk", "gdisk", "sgdisk"].includes(cmd)) { severity = "high"; reasons.push(`${cmd} (partition management)`); }
	if (cmd === "cryptsetup") { severity = "high"; reasons.push("cryptsetup (disk encryption)"); }
	if (["pvcreate", "vgcreate", "lvcreate"].includes(cmd)) { severity = "high"; reasons.push(`${cmd} (LVM)`); }
	if (cmd === "zpool") { severity = "high"; reasons.push("zpool (ZFS pool)"); }

	// ── Permissions ──
	if (cmd === "chmod") {
		if (rest.includes("-R") || rest.includes("--recursive")) reasons.push("chmod -R (recursive permissions)");
		const mode = rest.find((a) => /^(777|666|u\+sx|a\+sx|o\+w)$/.test(a));
		if (mode) { severity = "high"; reasons.push(`chmod ${mode} (overly permissive)`); }
	}
	if (cmd === "chown" && (rest.includes("-R") || rest.includes("--recursive"))) reasons.push("chown -R (recursive ownership)");

	// ── File overwrite ──
	if (cmd === "mv" && (rest.includes("-f") || rest.includes("--force"))) reasons.push("mv -f (overwrite)");
	if (cmd === "cp" && (rest.includes("-f") || rest.includes("--force"))) reasons.push("cp -f (overwrite)");

	// ── Process / system ──
	if (["kill", "pkill", "killall"].includes(cmd)) { reasons.push(`${cmd} (process termination)`); if (rest.includes("-9")) { severity = "high"; reasons.push("SIGKILL (-9)"); } }
	if (["shutdown", "reboot", "halt", "poweroff"].includes(cmd)) { severity = "high"; reasons.push(`${cmd} (system power)`); }
	if (cmd === "systemctl" && ["stop", "disable", "mask"].some((s) => rest.includes(s))) reasons.push("systemctl stop/disable/mask");
	if (cmd === "launchctl" && ["unload", "remove"].some((s) => rest.includes(s))) reasons.push("launchctl unload/remove");

	// ── Network / remote execution ──
	// (curl|wget piped to shell is handled by the pipe-to-shell check above)
	if (["iptables", "ip6tables", "nft"].includes(cmd)) { severity = "high"; reasons.push(`${cmd} (firewall modification)`); }
	if (cmd === "route" || (cmd === "ip" && rest[0] === "route")) reasons.push("route modification");

	// ── Package management ──
	if (cmd === "npm" && rest[0] === "publish") { severity = "high"; reasons.push("npm publish"); }
	if (cmd === "npm" && (rest.includes("unlink") || ["rm", "unpublish"].includes(rest[0]))) { severity = "high"; reasons.push("npm unpublish/rm/unlink"); }
	if (cmd === "pip" && rest.includes("uninstall")) reasons.push("pip uninstall");
	if (cmd === "conda" && (rest.includes("remove") || rest.includes("uninstall"))) reasons.push("conda remove/uninstall");
	if (cmd === "cargo" && rest[0] === "publish") { severity = "high"; reasons.push("cargo publish"); }
	if (cmd === "yarn" && rest[0] === "publish") { severity = "high"; reasons.push("yarn publish"); }

	// ── Containers / infra ──
	if (cmd === "docker" && rest[0] === "rm") reasons.push("docker rm");
	if (cmd === "docker" && rest[0] === "rmi") reasons.push("docker rmi");
	if (cmd === "docker" && rest.includes("--rm") && ["run", "build"].includes(rest[0])) reasons.push("docker --rm");
	if (cmd === "docker" && rest[0] === "system" && (rest.includes("prune") || rest.includes("reset"))) { severity = "high"; reasons.push("docker system prune/reset"); }
	if (cmd === "docker" && rest[0] === "volume" && rest[1] === "rm") reasons.push("docker volume rm");
	if (cmd === "kubectl" && rest[0] === "delete") { severity = "high"; reasons.push("kubectl delete"); }
	if (cmd === "helm" && rest[0] === "uninstall") { severity = "high"; reasons.push("helm uninstall"); }
	if (cmd === "terraform" && rest[0] === "destroy") { severity = "high"; reasons.push("terraform destroy"); }
	if (cmd === "aws" && rest[0] === "s3" && rest[1] === "rm" && rest.includes("--recursive")) { severity = "high"; reasons.push("aws s3 rm --recursive"); }
	if (cmd === "gcloud" && rest.includes("delete")) { severity = "high"; reasons.push("gcloud delete"); }
	if (cmd === "az" && rest.includes("delete")) { severity = "high"; reasons.push("az delete"); }

	// ── Sensitive file access ──
	if (["cat", "head", "tail", "less", "more", "tee", "echo", "printf"].includes(cmd)) {
		reasons.push(...touchesSensitive(rest));
	}

	return reasons.length > 0 ? { severity, reasons } : null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function analyzeBashCommand(command: string): Risk | null {
	let tokens: Token[];
	try {
		tokens = shellParse(command) as Token[];
	} catch {
		return analyzeRaw(command);
	}

	const reasons: string[] = [];
	let severity: Severity = "medium";

	const ops = tokens.filter(isOpToken).map((t) => t.op);
	if (ops.some((o) => o === ">" || o === ">>")) reasons.push("output redirection (can overwrite)");
	if (ops.some((o) => o === "2>" || o === "2>>")) reasons.push("stderr redirection (can overwrite)");
	if (ops.includes("<")) reasons.push("input redirection");
	if (ops.includes("|")) reasons.push("pipe (chained commands)");

	for (const seg of splitOnOps(tokens, ["&&", "||", ";"])) {
		const risk = analyzeSegment(seg);
		if (!risk) continue;
		if (risk.severity === "high") severity = "high";
		reasons.push(...risk.reasons);
	}

	const uniq = [...new Set(reasons)];
	return uniq.length > 0 ? { severity, reasons: uniq } : null;
}

function analyzeRaw(command: string): Risk {
	const reasons: string[] = [];
	let severity: Severity = "medium";

	const checks: Array<{ pattern: RegExp; reason: string; sev: Severity }> = [
		{ pattern: /\bsudo\b/, reason: "sudo", sev: "high" },
		{ pattern: /\brm\s+(-\w*[rf]\w*|--recursive)/, reason: "rm recursive/force", sev: "high" },
		{ pattern: /\b(curl|wget)\b[^#\n]*\|\s*(ba?sh|zsh|fish|dash|sh)\b/, reason: "curl/wget piped to shell", sev: "high" },
		{ pattern: /\bgit\s+push\b.*--force/, reason: "git push --force", sev: "high" },
		{ pattern: /\bgit\s+reset\b.*--hard/, reason: "git reset --hard", sev: "high" },
		{ pattern: /\b(shutdown|reboot)\b/, reason: "system power", sev: "high" },
		{ pattern: /\bmkfs\b/, reason: "mkfs", sev: "high" },
		{ pattern: /\bdd\b/, reason: "dd", sev: "medium" },
		{ pattern: /\bkill\s+-9\b/, reason: "kill -9", sev: "high" },
	];

	for (const { pattern, reason, sev } of checks) {
		if (pattern.test(command)) {
			reasons.push(reason);
			if (sev === "high") severity = "high";
		}
	}

	if (reasons.length === 0) reasons.push("unparsed shell command");
	return { severity, reasons };
}

// ─── Subagent catastrophic check ────────────────────────────────────────────
//
// Single source of truth: subagent guard delegates here instead of maintaining
// its own hardcoded regex list (DRY). Returns a reason string or null.

const SUBAGENT_ONLY: Array<{ pattern: RegExp; reason: string }> = [
	{ pattern: /\bgit\s+(commit|pull|push)\b/, reason: "git commit/pull/push (main-session only)" },
];

export function isCatastrophic(command: string): string | null {
	for (const { pattern, reason } of SUBAGENT_ONLY) {
		if (pattern.test(command)) return reason;
	}
	const risk = analyzeBashCommand(command);
	if (!risk || risk.severity !== "high") return null;
	return risk.reasons[0];
}
