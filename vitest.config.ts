import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: false,
		environment: "node",
		include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/dist/**", "mcps/hugin-mcp/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 75,
				statements: 80,
			},
			// Coverage is currently scoped to `lib/`. Extensions and MCP servers are
			// validated end-to-end (Pi launches the bridges, smoke-tests run them) rather
			// than unit-tested — see ARCHITECTURE.md and HANDOFF.md for the smoke-test flow.
			include: ["lib/**/*.ts"],
			exclude: [
				"**/__tests__/**",
				"**/*.test.ts",
				"**/index.ts",
				"**/types.ts",
				"**/node_modules/**",
			],
		},
	},
});
