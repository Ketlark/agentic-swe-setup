// ─── Allowlist management ───────────────────────────────────────────────────
//
// Three scopes: once (no storage), session (in-memory), always (persisted to disk).
// Regex patterns are pre-compiled on mutation for fast matching.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const ALLOWLIST_DIR = join(homedir(), ".pi");
const ALLOWLIST_FILE = join(ALLOWLIST_DIR, "bash-guard-allowlist.json");

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadPersisted(): string[] {
	try {
		if (!existsSync(ALLOWLIST_FILE)) return [];
		const data = JSON.parse(readFileSync(ALLOWLIST_FILE, "utf8"));
		return Array.isArray(data.always) ? data.always : [];
	} catch {
		return [];
	}
}

function savePersisted(always: string[]): void {
	try {
		mkdirSync(ALLOWLIST_DIR, { recursive: true });
		writeFileSync(ALLOWLIST_FILE, JSON.stringify({ always }, null, 2) + "\n", "utf8");
	} catch { /* best-effort */ }
}

function compileOne(pattern: string): RegExp | null {
	try { return new RegExp(pattern); } catch { return null; }
}

function compileAll(patterns: string[]): RegExp[] {
	const out: RegExp[] = [];
	for (const p of patterns) {
		const re = compileOne(p);
		if (re) out.push(re);
	}
	return out;
}

function matchesAny(command: string, patterns: RegExp[]): boolean {
	for (const re of patterns) {
		if (re.test(command)) return true;
	}
	return false;
}

/** Extract a broad pattern from a command: cmd + subcommand(s) + flags (skip paths/values). */
function commandToPattern(command: string): string {
	const firstLine = command.trim().split(/\n|;/)[0].trim();
	const parts = firstLine.split(/\s+/);

	// Keep: binary + up to 2 subcommand tokens (non-flag) + all flags
	const keep: string[] = [parts[0]];
	let wordCount = 0;
	for (let i = 1; i < parts.length; i++) {
		if (parts[i].startsWith("-")) {
			keep.push(parts[i]);
		} else if (wordCount < 2) {
			keep.push(parts[i]);
			wordCount++;
		}
	}

	return `^${escapeRegex(keep.join(" "))}`;
}

export class Allowlist {
	private alwaysPatterns: string[] = [];
	private alwaysRegex: RegExp[] = [];
	private sessionPatterns: string[] = [];
	private sessionRegex: RegExp[] = [];

	constructor() {
		this.alwaysPatterns = loadPersisted();
		this.alwaysRegex = compileAll(this.alwaysPatterns);
	}

	/** Check if command matches any allowlist rule. */
	allows(command: string): boolean {
		return matchesAny(command, this.alwaysRegex) || matchesAny(command, this.sessionRegex);
	}

	/** Add a pattern for the current session only. */
	addSession(pattern: string): void {
		this.sessionPatterns.push(pattern);
		const re = compileOne(pattern);
		if (re) this.sessionRegex.push(re);
	}

	/** Auto-generate and add a session rule from a command. */
	allowSessionCommand(command: string): void {
		this.addSession(commandToPattern(command));
	}

	/** Remove a session pattern. Returns true if found and removed. */
	removeSession(pattern: string): boolean {
		const idx = this.sessionPatterns.indexOf(pattern);
		if (idx === -1) return false;
		this.sessionPatterns.splice(idx, 1);
		this.sessionRegex = compileAll(this.sessionPatterns);
		return true;
	}

	/** Clear all session patterns. */
	clearSession(): void {
		this.sessionPatterns = [];
		this.sessionRegex = [];
	}

	/** Persist a pattern to disk. */
	addAlways(pattern: string): void {
		this.alwaysPatterns.push(pattern);
		const re = compileOne(pattern);
		if (re) this.alwaysRegex.push(re);
		savePersisted(this.alwaysPatterns);
	}

	/** Auto-generate and persist an always rule from a command. */
	allowAlwaysCommand(command: string): void {
		this.addAlways(commandToPattern(command));
	}

	/** Remove a persisted pattern. Returns true if found and removed. */
	removeAlways(pattern: string): boolean {
		const idx = this.alwaysPatterns.indexOf(pattern);
		if (idx === -1) return false;
		this.alwaysPatterns.splice(idx, 1);
		this.alwaysRegex = compileAll(this.alwaysPatterns);
		savePersisted(this.alwaysPatterns);
		return true;
	}

	/** Clear all persisted patterns. */
	clearAlways(): void {
		this.alwaysPatterns = [];
		this.alwaysRegex = [];
		savePersisted([]);
	}

	get sessionCount(): number { return this.sessionPatterns.length; }
	get alwaysCount(): number { return this.alwaysPatterns.length; }
	get sessionRules(): readonly string[] { return this.sessionPatterns; }
	get alwaysRules(): readonly string[] { return this.alwaysPatterns; }
}
