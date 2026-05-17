// Owns all mutable session state and the transition logic between phases.
// Other modules receive State by reference — they read it, but only the
// transition functions here mutate it. Same pattern as bash-guard/session.ts.

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PlanModeConfig } from "./config.js";
import { EXEC_TOOLS, MESSAGE_TYPE, PLAN_TOOLS } from "./constants.js";
import type { ModelRef, PlanPhase, PersistedState, TodoItem } from "./types.js";

export type State = {
	phase: PlanPhase;
	planDir: string | undefined;
	todos: TodoItem[];
	previousModel: ModelRef | undefined;
	previousThinking: string | undefined;
	config: PlanModeConfig;
};

export function createState(config: PlanModeConfig): State {
	return {
		phase: "idle",
		planDir: undefined,
		todos: [],
		previousModel: undefined,
		previousThinking: undefined,
		config,
	};
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export function persist(pi: ExtensionAPI, state: State): void {
	const persisted: PersistedState = {
		phase: state.phase,
		planDir: state.planDir,
		todos: state.todos,
	};
	pi.appendEntry(MESSAGE_TYPE.PERSISTENCE_KEY, persisted);
}

export function restoreFrom(state: State, saved: Partial<PersistedState>): void {
	if (saved.phase) state.phase = saved.phase;
	if (saved.planDir !== undefined) state.planDir = saved.planDir;
	if (saved.todos) state.todos = saved.todos;
}

// ─── Pi runtime configuration ────────────────────────────────────────────────
// Two primitives — forward (apply config model) and backward (restore saved).
// Every transition and resume composes from these two.

const PHASE_TOOLS: Record<PlanPhase, readonly string[]> = {
	planning: PLAN_TOOLS,
	executing: EXEC_TOOLS,
	idle: EXEC_TOOLS,
};

function setPhaseEnv(phase: PlanPhase): void {
	process.env.PI_PLAN_PHASE = phase;
}

async function switchModel(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	preset: ModelRef,
): Promise<boolean> {
	const model = ctx.modelRegistry.find(preset.provider, preset.id);
	if (!model) {
		ctx.ui.notify(`Model ${preset.provider}/${preset.id} not found`, "error");
		return false;
	}
	const ok = await pi.setModel(model);
	if (!ok) {
		ctx.ui.notify(`No API key for ${preset.provider}/${preset.id}`, "error");
		return false;
	}
	return true;
}

export async function applyPhase(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: State,
): Promise<void> {
	pi.setActiveTools([...PHASE_TOOLS[state.phase]]);

	const preset = state.phase === "planning"
		? state.config.planModel
		: state.config.executeModel;

	if (state.phase !== "idle") {
		await switchModel(pi, ctx, preset);
		pi.setThinkingLevel(preset.thinking);
	}

	setPhaseEnv(state.phase);
}

async function restorePreviousConfig(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: State,
): Promise<void> {
	pi.setActiveTools([...EXEC_TOOLS]);
	if (state.previousModel) await switchModel(pi, ctx, state.previousModel);
	if (state.previousThinking) pi.setThinkingLevel(state.previousThinking);
	setPhaseEnv("idle");
}

// ─── Phase transitions ───────────────────────────────────────────────────────
// Each returns a notification message. The caller (handler or command) owns
// the UI update — state doesn't know about widgets.

export async function enterPlanMode(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: State,
): Promise<string> {
	state.previousThinking = pi.getThinkingLevel() as string;
	state.previousModel = ctx.model
		? { provider: ctx.model.provider, id: ctx.model.id }
		: undefined;

	state.phase = "planning";
	state.planDir = undefined;
	state.todos = [];

	await applyPhase(pi, ctx, state);
	persist(pi, state);

	const { provider, id, thinking } = state.config.planModel;
	return `Plan mode ON — ${provider}/${id}:${thinking}`;
}

export async function exitPlanMode(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: State,
): Promise<string> {
	state.phase = "idle";
	state.planDir = undefined;
	state.todos = [];

	await restorePreviousConfig(pi, ctx, state);
	persist(pi, state);

	return "Plan mode OFF — original model restored";
}

export async function startExecution(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: State,
): Promise<string> {
	state.phase = "executing";

	await applyPhase(pi, ctx, state);
	persist(pi, state);

	const { provider, id, thinking } = state.config.executeModel;
	return `Executing plan — ${provider}/${id}:${thinking}`;
}

export async function completeExecution(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: State,
): Promise<void> {
	state.phase = "idle";
	state.todos = [];
	state.planDir = undefined;

	await restorePreviousConfig(pi, ctx, state);
	persist(pi, state);
}
