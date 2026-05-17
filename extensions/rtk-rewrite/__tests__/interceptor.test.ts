import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type RtkState, rtkRewrite } from "../interceptor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FAKE_RTK = resolve(__dirname, "fixtures/fake-rtk.sh");
const FAKE_DIR = dirname(FAKE_RTK);

function createState(overrides: Partial<RtkState> = {}): RtkState {
	return {
		available: true,
		version: "0.99.0-fake",
		disabled: false,
		stats: { rewrites: 0, errors: 0, bypassed: 0 },
		cache: new Map(),
		...overrides,
	};
}

describe("rtkRewrite", () => {
	let originalPath: string | undefined;

	beforeEach(() => {
		originalPath = process.env.PATH;
		try {
			execFileSync("ln", ["-sf", FAKE_RTK, resolve(FAKE_DIR, "rtk")]);
		} catch {}
		process.env.PATH = `${FAKE_DIR}:${originalPath}`;
	});

	afterEach(() => {
		process.env.PATH = originalPath;
	});

	it("rewrites known commands", async () => {
		const state = createState();
		const result = await rtkRewrite("git status", state);
		expect(result).toBe("rtk git status");
	});

	it("passes through commands rtk returns unchanged", async () => {
		const state = createState();
		const result = await rtkRewrite("echo hello", state);
		expect(result).toBe("echo hello");
	});

	it("rewrites multiple command types", async () => {
		const state = createState();
		expect(await rtkRewrite("ls -la", state)).toBe("rtk ls -la");
		expect(await rtkRewrite("cargo test", state)).toBe("rtk cargo test");
	});

	it("bypasses oversized commands without spawning", async () => {
		const state = createState();
		const bigCmd = `echo ${"x".repeat(70_000)}`;
		const result = await rtkRewrite(bigCmd, state);
		expect(result).toBe(bigCmd);
		expect(state.stats.bypassed).toBe(1);
	});

	it("uses cache on repeated calls", async () => {
		const state = createState();

		await rtkRewrite("git status", state);
		expect(state.cache.size).toBe(1);

		const start = Date.now();
		const result = await rtkRewrite("git status", state);
		const elapsed = Date.now() - start;

		expect(result).toBe("rtk git status");
		expect(elapsed).toBeLessThan(10);
	});

	it("handles rtk exit failure gracefully", async () => {
		const state = createState();
		const result = await rtkRewrite("FAIL_EXIT", state);
		expect(result).toBe("FAIL_EXIT");
		expect(state.stats.errors).toBe(1);
	});
});

describe("detectRtk", () => {
	let originalPath: string | undefined;

	beforeEach(() => {
		originalPath = process.env.PATH;
		try {
			execFileSync("ln", ["-sf", FAKE_RTK, resolve(FAKE_DIR, "rtk")]);
		} catch {}
		process.env.PATH = `${FAKE_DIR}:${originalPath}`;
	});

	afterEach(() => {
		process.env.PATH = originalPath;
	});

	it("detects fake rtk binary", async () => {
		const { detectRtk } = await import("../detect.js");
		const version = await detectRtk();
		expect(version).toBe("rtk 0.99.0-fake");
	});
});
