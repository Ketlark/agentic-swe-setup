// Pi message type guards and text extraction.
// Generic utilities — not coupled to plan parsing or any domain logic.

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, TextContent } from "@earendil-works/pi-ai";

export function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
	return m.role === "assistant" && Array.isArray(m.content);
}

export function getTextContent(message: AssistantMessage): string {
	return message.content
		.filter((b): b is TextContent => b.type === "text")
		.map((b) => b.text)
		.join("\n");
}
