import type { Rule } from "../types.js";

export const elevatedRules: Rule[] = [
	{
		id: "elevated.privilege",
		match: (ctx) => ctx.cmd === "sudo" || ctx.cmd === "doas" || ctx.cmd === "su",
		analyze: (ctx) => ({
			severity: "high",
			reasons: [ctx.cmd === "su" ? "su (switch user)" : `${ctx.cmd} (elevated privileges)`],
		}),
	},
	{
		id: "elevated.chmod",
		match: (ctx) => ctx.cmd === "chmod",
		analyze: (ctx) => {
			const reasons: string[] = [];
			let severity: "high" | "medium" = "medium";
			if (ctx.hasFlag("-R") || ctx.hasFlag("--recursive"))
				reasons.push("chmod -R (recursive permissions)");
			const mode = ctx.args.find((a) => /^(777|666|u\+sx|a\+sx|o\+w)$/.test(a));
			if (mode) {
				severity = "high";
				reasons.push(`chmod ${mode} (overly permissive)`);
			}
			return reasons.length > 0 ? { severity, reasons } : null;
		},
	},
	{
		id: "elevated.chown",
		match: (ctx) => ctx.cmd === "chown" && (ctx.hasFlag("-R") || ctx.hasFlag("--recursive")),
		analyze: () => ({
			severity: "medium",
			reasons: ["chown -R (recursive ownership)"],
		}),
	},
	{
		id: "elevated.process-kill",
		match: (ctx) => ["kill", "pkill", "killall"].includes(ctx.cmd),
		analyze: (ctx) => {
			const reasons = [`${ctx.cmd} (process termination)`];
			const severity = ctx.args.includes("-9") ? ("high" as const) : ("medium" as const);
			if (ctx.args.includes("-9")) reasons.push("SIGKILL (-9)");
			return { severity, reasons };
		},
	},
	{
		id: "elevated.system-power",
		match: (ctx) => ["shutdown", "reboot", "halt", "poweroff"].includes(ctx.cmd),
		analyze: (ctx) => ({
			severity: "high",
			reasons: [`${ctx.cmd} (system power)`],
		}),
	},
	{
		id: "elevated.systemctl",
		match: (ctx) =>
			ctx.cmd === "systemctl" && ["stop", "disable", "mask"].some((s) => ctx.args.includes(s)),
		analyze: () => ({
			severity: "medium",
			reasons: ["systemctl stop/disable/mask"],
		}),
	},
	{
		id: "elevated.launchctl",
		match: (ctx) =>
			ctx.cmd === "launchctl" && ["unload", "remove"].some((s) => ctx.args.includes(s)),
		analyze: () => ({
			severity: "medium",
			reasons: ["launchctl unload/remove"],
		}),
	},
	{
		id: "elevated.firewall",
		match: (ctx) => ["iptables", "ip6tables", "nft"].includes(ctx.cmd),
		analyze: (ctx) => ({
			severity: "high",
			reasons: [`${ctx.cmd} (firewall modification)`],
		}),
	},
	{
		id: "elevated.route",
		match: (ctx) => ctx.cmd === "route" || (ctx.cmd === "ip" && ctx.args[0] === "route"),
		analyze: () => ({
			severity: "medium",
			reasons: ["route modification"],
		}),
	},
	{
		id: "elevated.pip-uninstall",
		match: (ctx) => ctx.cmd === "pip" && ctx.args.includes("uninstall"),
		analyze: () => ({ severity: "medium", reasons: ["pip uninstall"] }),
	},
	{
		id: "elevated.conda-remove",
		match: (ctx) =>
			ctx.cmd === "conda" && (ctx.args.includes("remove") || ctx.args.includes("uninstall")),
		analyze: () => ({
			severity: "medium",
			reasons: ["conda remove/uninstall"],
		}),
	},
];
