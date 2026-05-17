// Pure type definitions — no values, no behavior, no constants.

export type PlanPhase = "idle" | "planning" | "executing";

export type ModelRef = {
	readonly provider: string;
	readonly id: string;
};

export type ModelPreset = ModelRef & {
	readonly thinking: string;
};

export type TodoItem = {
	readonly step: number;
	readonly text: string;
	completed: boolean;
};

export type PersistedState = {
	readonly phase: PlanPhase;
	readonly planDir: string | undefined;
	readonly todos: TodoItem[];
};
