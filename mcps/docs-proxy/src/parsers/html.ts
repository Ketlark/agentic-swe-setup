const HTML_ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&apos;": "'",
	"&nbsp;": " ",
	"&mdash;": "\u2014",
	"&ndash;": "\u2013",
};
const HTML_ENTITY_RE = /&(?:amp|lt|gt|quot|apos|nbsp|mdash|ndash|#39);/g;

export function decodeHtmlEntities(text: string): string {
	return text.replace(HTML_ENTITY_RE, (match) => HTML_ENTITIES[match] ?? match);
}

export function stripHtml(text: string): string {
	return text
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<[^>]+>/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
