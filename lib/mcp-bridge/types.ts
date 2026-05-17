// Internal types shared between the bridge factory and its helpers.
// Not re-exported from the package barrel — consumers don't need them.

export interface Stats {
	toolCalls: number;
	errors: number;
	connected: boolean;
}
