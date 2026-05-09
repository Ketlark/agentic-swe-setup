// ─── Interactive overlay prompt ──────────────────────────────────────────────
//
// Bottom-anchored overlay with truncated command display.
// Always shows action buttons (Allow once / session / always / Abort).

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import type { SelectItem } from "@earendil-works/pi-tui";
import { Container, SelectList, Text } from "@earendil-works/pi-tui";
import type { Decision, Risk } from "./types.js";

const MAX_CMD_LINES = 5;

function truncateCommand(command: string): string {
	const lines = command.split("\n");
	if (lines.length <= MAX_CMD_LINES) return command;
	return lines.slice(0, MAX_CMD_LINES).join("\n") + `\n  ... (${lines.length - MAX_CMD_LINES} more lines)`;
}

export async function promptDecision(ctx: ExtensionContext, command: string, risk: Risk): Promise<Decision> {
	if (!ctx.hasUI) return "abort";

	const cmdDisplay = truncateCommand(command);
	const reasonsText = risk.reasons.map((r) => `  • ${r}`).join("\n");
	const sevLabel = risk.severity === "high" ? "HIGH" : "MEDIUM";

	const items: SelectItem[] = [
		{ value: "run", label: "Allow once", description: "Run this time only" },
		{ value: "run-session", label: "Allow session", description: "Skip similar commands until pi exits" },
		{ value: "run-always", label: "Allow always", description: "Persist rule to disk" },
		{ value: "abort", label: "Abort", description: "Block this command" },
	];

	const choice = await ctx.ui.custom<Decision>((tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((s: string) => theme.fg("warning", s)));
		container.addChild(new Text(theme.fg(risk.severity === "high" ? "error" : "warning", theme.bold(`⚠ ${sevLabel} risk`)), 1, 0));
		container.addChild(new Text(reasonsText, 0, 2));
		container.addChild(new Text(theme.fg("muted", "Command:"), 1, 0));
		container.addChild(new Text(cmdDisplay, 0, 2));

		const list = new SelectList(items, Math.min(items.length, 10), {
			selectedPrefix: (t) => theme.fg("accent", t),
			selectedText: (t) => theme.fg("accent", t),
			description: (t) => theme.fg("muted", t),
			scrollInfo: (t) => theme.fg("dim", t),
			noMatch: (t) => theme.fg("warning", t),
		});

		list.onSelect = (item) => done(item.value as Decision);
		list.onCancel = () => done("abort");
		container.addChild(new Text("", 1, 0));
		container.addChild(list);
		container.addChild(new DynamicBorder((s: string) => theme.fg("warning", s)));

		return {
			render: (w) => container.render(w),
			invalidate: () => container.invalidate(),
			handleInput: (data) => {
				list.handleInput(data);
				tui.requestRender();
			},
		};
	}, {
		overlay: true,
		overlayOptions: { anchor: "bottom-center", maxHeight: "60%", margin: 1 },
	});

	return choice ?? "abort";
}
