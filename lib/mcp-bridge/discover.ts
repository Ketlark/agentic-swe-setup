// Resolve an MCP entry point by checking an env var override, then a list of
// known candidate paths. Returns the first existing path or null.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface EntryResolverConfig {
	envVar?: string;
	candidates: readonly string[];
}

export function resolveEntry({ envVar, candidates }: EntryResolverConfig): string | null {
	if (envVar) {
		const raw = process.env[envVar];
		if (raw) {
			const p = resolve(raw);
			if (existsSync(p)) return p;
		}
	}
	for (const c of candidates) {
		if (existsSync(c)) return c;
	}
	return null;
}
