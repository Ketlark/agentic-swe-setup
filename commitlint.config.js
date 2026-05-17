/** @type {import("@commitlint/types").UserConfig} */
export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [
			2,
			"always",
			["feature", "fix", "refactor", "chore", "test", "docs", "perf", "style", "build", "ci"],
		],
		"subject-case": [0],
		"header-max-length": [2, "always", 100],
	},
};
