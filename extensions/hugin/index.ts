// Assumption: models can't fetch or search the web natively. External
// tool access is required for current information.
// Re-evaluate when the host model gains built-in web access that
// matches SearXNG coverage (70+ engines, local, no API key).
import { dirname, resolve } from "node:path";
import { createMcpExtension, resolveEntry } from "@swe/mcp-bridge";

const HUGIN_REPO = "https://github.com/Ketlark/hugin-mcp.git";

const base = dirname(import.meta.dirname ?? __dirname);
const home = process.env.HOME ?? "/root";

const entryPoint = resolveEntry({
	envVar: "HUGIN_MCP_PATH",
	candidates: [
		resolve(base, "../../mcps/hugin-mcp/src/index.js"),
		resolve(base, "../hugin-mcp/src/index.js"),
		resolve(base, "../mcp-local-websearch/src/index.js"),
		resolve(home, "dev/hugin-mcp/src/index.js"),
		resolve(home, "projects/hugin-mcp/src/index.js"),
	],
});

export default createMcpExtension({
	label: "hugin",
	entryPoint,
	notFoundMessage: [
		"[hugin] hugin-mcp not found.",
		"",
		"To install:",
		`  git clone ${HUGIN_REPO} ../hugin-mcp`,
		"  cd ../hugin-mcp && npm install",
		"",
		"Or set HUGIN_MCP_PATH to the entry point.",
	],
	promptHint: (tool) => ({
		snippet: `Use ${tool.name} via hugin-mcp (local, no API key).`,
		guidelines: [
			tool.description ?? "",
			"All processing happens locally on your machine — no data leaves.",
		].filter(Boolean),
	}),
});
