import type { Rule } from "../types.js";
import { GIT_READONLY } from "../types.js";

const DISK_CMDS = new Set([
	"dd",
	"wipefs",
	"diskutil",
	"hdiutil",
	"gpt",
	"asr",
	"parted",
	"fdisk",
	"gdisk",
	"sgdisk",
	"cryptsetup",
	"pvcreate",
	"vgcreate",
	"lvcreate",
	"zpool",
]);

const SHELLS = new Set(["sh", "bash", "zsh", "fish", "dash", "ksh", "csh", "tcsh"]);
const DANGEROUS_PIPE_TARGETS = new Set(["eval", "xargs", "source", "exec"]);

export const destructiveRules: Rule[] = [
	{
		id: "destructive.pipe-to-shell",
		match: (ctx) => ctx.segment.some((t) => typeof t === "object" && "op" in t && t.op === "|"),
		analyze: (ctx) => {
			const pipeIdx = ctx.segment.findIndex(
				(t) => typeof t === "object" && "op" in t && t.op === "|"
			);
			const rhs = ctx.segment.slice(pipeIdx + 1).filter((t): t is string => typeof t === "string");
			if (rhs.length > 0 && (SHELLS.has(rhs[0]) || DANGEROUS_PIPE_TARGETS.has(rhs[0]))) {
				return { severity: "high", reasons: ["pipe to shell/exec/eval (possible RCE)"] };
			}
			return null;
		},
	},
	{
		id: "destructive.file-deletion",
		match: (ctx) => ctx.cmd === "rm" || ctx.cmd === "rmdir" || ctx.cmd === "unlink",
		analyze: (ctx) => {
			const reasons: string[] = [`${ctx.cmd} (file deletion)`];
			if (ctx.hasFlag("-r") || ctx.hasFlag("-R") || ctx.hasFlag("--recursive")) {
				reasons.push("recursive (-r/-R)");
			}
			if (ctx.hasFlag("-f") || ctx.hasFlag("--force")) reasons.push("forced (-f)");
			reasons.push(...ctx.touchesSensitive());
			return { severity: "high", reasons };
		},
	},
	{
		id: "destructive.find-delete",
		match: (ctx) => ctx.cmd === "find" && ctx.args.includes("-delete"),
		analyze: () => ({ severity: "high", reasons: ["find -delete (bulk deletion)"] }),
	},
	{
		id: "destructive.truncate",
		match: (ctx) => ctx.cmd === "truncate",
		analyze: () => ({ severity: "medium", reasons: ["truncate (can erase contents)"] }),
	},
	{
		id: "destructive.in-place-mod",
		match: (ctx) =>
			(ctx.cmd === "sed" && (ctx.hasFlag("-i") || ctx.args.includes("--in-place"))) ||
			(ctx.cmd === "perl" &&
				(ctx.args.includes("-pi") || (ctx.args.includes("-p") && ctx.args.includes("-i")))),
		analyze: (ctx) => ({
			severity: "medium",
			reasons: [`${ctx.cmd} -i (in-place modification)`],
		}),
	},
	{
		id: "destructive.install-overwrite",
		match: (ctx) =>
			ctx.cmd === "install" && ctx.args.some((a) => a.startsWith("-m") || a.startsWith("-o")),
		analyze: () => ({
			severity: "medium",
			reasons: ["install (overwrite with permissions)"],
		}),
	},
	{
		id: "destructive.file-overwrite",
		match: (ctx) =>
			(ctx.cmd === "mv" || ctx.cmd === "cp") && (ctx.hasFlag("-f") || ctx.hasFlag("--force")),
		analyze: (ctx) => ({ severity: "medium", reasons: [`${ctx.cmd} -f (overwrite)`] }),
	},
	{
		id: "destructive.git",
		match: (ctx) => ctx.cmd === "git",
		analyze: (ctx) => {
			const sub = ctx.args[0];
			if (!sub || GIT_READONLY.has(sub)) return null;
			const subArgs = ctx.args.slice(1);
			const reasons: string[] = [];
			let severity: "high" | "medium" = "medium";

			if (sub === "rm") {
				severity = "high";
				reasons.push("git rm (staged deletion)");
			} else if (
				sub === "clean" &&
				(subArgs.some((a) => a.includes("-f")) || subArgs.includes("-d") || subArgs.includes("-x"))
			) {
				severity = "high";
				reasons.push("git clean (untracked file deletion)");
			} else if (sub === "reset" && subArgs.includes("--hard")) {
				severity = "high";
				reasons.push("git reset --hard (discard changes)");
			} else if (
				(sub === "checkout" || sub === "restore") &&
				(subArgs.includes(".") || subArgs.includes("--") || subArgs.includes("--source"))
			) {
				reasons.push("git checkout/restore (overwrite working tree)");
			} else if (
				sub === "push" &&
				(subArgs.includes("--force") ||
					subArgs.includes("--force-with-lease") ||
					subArgs.includes("-f"))
			) {
				severity = "high";
				reasons.push("git push --force (rewrite history)");
			} else if (sub === "reflog" && subArgs.includes("expire")) {
				severity = "high";
				reasons.push("git reflog expire (remove recovery history)");
			} else if (sub === "gc" && subArgs.some((a) => a.startsWith("--prune"))) {
				severity = "high";
				reasons.push("git gc --prune (delete objects)");
			} else if (
				sub === "branch" &&
				(subArgs.includes("-D") || subArgs.includes("--delete") || subArgs.includes("-d"))
			) {
				reasons.push("git branch delete");
			} else if (sub === "stash" && (subArgs.includes("drop") || subArgs.includes("clear"))) {
				reasons.push("git stash drop/clear");
			} else if (sub === "filter-branch" || sub === "filter-repo") {
				severity = "high";
				reasons.push(`git ${sub} (history rewriting)`);
			} else {
				reasons.push(`git ${sub}`);
			}

			return reasons.length > 0 ? { severity, reasons } : null;
		},
	},
	{
		id: "destructive.disk",
		match: (ctx) =>
			DISK_CMDS.has(ctx.cmd) || ctx.cmd.startsWith("mkfs") || ctx.cmd.startsWith("newfs_"),
		analyze: (ctx) => {
			const reasons: string[] = [`${ctx.cmd} (disk/partition operation)`];
			if (ctx.cmd === "dd" && !ctx.anyStartsWith("of=") && !ctx.args.includes("of")) {
				return null;
			}
			if (
				ctx.cmd === "diskutil" &&
				["eraseDisk", "eraseVolume", "zeroDisk", "secureErase"].some((s) => ctx.args.includes(s))
			) {
				reasons.push("diskutil erase (destructive)");
			}
			return { severity: "high", reasons };
		},
	},
	{
		id: "destructive.container-infra",
		match: (ctx) =>
			["docker", "kubectl", "helm", "terraform", "aws", "gcloud", "az"].includes(ctx.cmd),
		analyze: (ctx) => {
			const reasons: string[] = [];
			let severity: "high" | "medium" = "medium";
			const sub = ctx.args[0];

			if (ctx.cmd === "docker") {
				if (sub === "rm") reasons.push("docker rm");
				else if (sub === "rmi") reasons.push("docker rmi");
				else if (sub === "system" && (ctx.args.includes("prune") || ctx.args.includes("reset"))) {
					severity = "high";
					reasons.push("docker system prune/reset");
				} else if (sub === "volume" && ctx.args[1] === "rm") reasons.push("docker volume rm");
				else if (ctx.args.includes("--rm") && (sub === "run" || sub === "build"))
					reasons.push("docker --rm");
			} else if (ctx.cmd === "kubectl" && sub === "delete") {
				severity = "high";
				reasons.push("kubectl delete");
			} else if (ctx.cmd === "helm" && sub === "uninstall") {
				severity = "high";
				reasons.push("helm uninstall");
			} else if (ctx.cmd === "terraform" && sub === "destroy") {
				severity = "high";
				reasons.push("terraform destroy");
			} else if (
				ctx.cmd === "aws" &&
				sub === "s3" &&
				ctx.args[1] === "rm" &&
				ctx.args.includes("--recursive")
			) {
				severity = "high";
				reasons.push("aws s3 rm --recursive");
			} else if (ctx.cmd === "gcloud" && ctx.args.includes("delete")) {
				severity = "high";
				reasons.push("gcloud delete");
			} else if (ctx.cmd === "az" && ctx.args.includes("delete")) {
				severity = "high";
				reasons.push("az delete");
			}

			return reasons.length > 0 ? { severity, reasons } : null;
		},
	},
	{
		id: "destructive.package-publish",
		match: (ctx) =>
			["npm", "yarn", "cargo"].includes(ctx.cmd) &&
			(ctx.args[0] === "publish" || ctx.args[0] === "unpublish"),
		analyze: (ctx) => ({
			severity: "high",
			reasons: [`${ctx.cmd} ${ctx.args[0]}`],
		}),
	},
	{
		id: "destructive.npm-destructive",
		match: (ctx) => ctx.cmd === "npm" && (ctx.args.includes("unlink") || ctx.args[0] === "rm"),
		analyze: () => ({
			severity: "high",
			reasons: ["npm rm/unlink"],
		}),
	},
];
