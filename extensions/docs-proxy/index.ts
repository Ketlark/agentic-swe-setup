// Assumption: models hallucinate API signatures when working from stale
// training data. Live documentation fetch prevents drift.
// Re-evaluate when training data freshness consistently covers the
// libraries this project depends on.
import { dirname, resolve } from "node:path";
import { createMcpExtension, resolveEntry } from "@swe/mcp-bridge";

const base = dirname(import.meta.dirname ?? __dirname);

const entryPoint = resolveEntry({
	envVar: "DOCS_PROXY_PATH",
	candidates: [
		resolve(base, "../../mcps/docs-proxy/dist/index.js"),
		resolve(base, "../docs-proxy/dist/index.js"),
	],
});

export default createMcpExtension({
	label: "docs-proxy",
	entryPoint,
	notFoundMessage:
		"[docs-proxy] docs-proxy MCP not found. Set DOCS_PROXY_PATH or check mcps/docs-proxy/.",
	statusCommand: "docs-status",
	promptHint: (tool) => ({
		snippet: `Use ${tool.name} via docs-proxy (local, no API key).`,
		guidelines: tool.description ? [tool.description] : [],
	}),
});
