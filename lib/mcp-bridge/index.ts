export {
	McpStdioClient,
	type McpTool,
	type McpToolProperty,
	type McpToolResult,
} from "./client.js";
export { resolveEntry, type EntryResolverConfig } from "./discover.js";
export {
	createMcpExtension,
	type McpExtensionConfig,
	type PromptHint,
} from "./extension.js";
