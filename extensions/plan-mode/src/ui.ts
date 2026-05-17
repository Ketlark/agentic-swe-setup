// Status bar and todo widget rendering. Reads state, writes to ctx.ui.
// No state mutation — pure presentation layer.

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { WIDGET_ID } from "./constants.js";
import type { State } from "./state.js";

export function updateUI(ctx: ExtensionContext, state: State): void {
	updateStatusBar(ctx, state);
	updateTodoWidget(ctx, state);
}

export function notifyTransition(ctx: ExtensionContext, state: State, message: string): void {
	ctx.ui.notify(message, "info");
	updateUI(ctx, state);
}

function updateStatusBar(ctx: ExtensionContext, state: State): void {
	const { theme } = ctx.ui;

	switch (state.phase) {
		case "executing": {
			if (state.todos.length === 0) break;
			const done = state.todos.filter((t) => t.completed).length;
			ctx.ui.setStatus(WIDGET_ID.STATUS_BAR, theme.fg("accent", `📋 exec ${done}/${state.todos.length}`));
			return;
		}
		case "planning":
			ctx.ui.setStatus(WIDGET_ID.STATUS_BAR, theme.fg("warning", "📝 plan"));
			return;
		case "idle":
			break;
	}

	ctx.ui.setStatus(WIDGET_ID.STATUS_BAR, undefined);
}

function updateTodoWidget(ctx: ExtensionContext, state: State): void {
	if (state.phase !== "executing" || state.todos.length === 0) {
		ctx.ui.setWidget(WIDGET_ID.TODO_LIST, undefined);
		return;
	}

	const { theme } = ctx.ui;
	const lines = state.todos.map((item) =>
		item.completed
			? theme.fg("success", "☑ ") + theme.fg("muted", theme.strikethrough(item.text))
			: `${theme.fg("muted", "☐ ")}${item.text}`,
	);
	ctx.ui.setWidget(WIDGET_ID.TODO_LIST, lines);
}
