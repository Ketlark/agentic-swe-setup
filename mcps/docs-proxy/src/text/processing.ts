// Pure text processing utilities — no I/O. Used by url + github handlers
// to bound output size and pull topic-relevant Markdown sections.

/** Truncate text to maxChars, appending a marker. Idempotent below the limit. */
export function truncate(text: string, maxChars = 8000): string {
	return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n... (truncated)` : text;
}

/** Extract Markdown sections (h1–h4) whose heading or body mentions `topic`.
 *  Returns null when nothing matches, so callers can fall back to truncate(). */
export function extractRelevantSections(text: string, topic: string): string | null {
	const lines = text.split("\n");
	const topicLower = topic.toLowerCase();
	const relevant: string[] = [];
	let inSection = false;
	let sectionLines: string[] = [];
	let score = 0;

	for (const line of lines) {
		const lineLower = line.toLowerCase();
		const isHeading = /^#{1,4}\s/.test(line);

		if (isHeading && inSection) {
			if (score > 0) relevant.push(sectionLines.join("\n"));
			sectionLines = [line];
			score = lineLower.includes(topicLower) ? 2 : 0;
		} else if (isHeading) {
			sectionLines = [line];
			score = lineLower.includes(topicLower) ? 2 : 0;
		} else {
			sectionLines.push(line);
			if (lineLower.includes(topicLower)) score += 1;
		}
		inSection = true;
	}
	if (score > 0) relevant.push(sectionLines.join("\n"));

	if (relevant.length === 0) return null;
	return relevant.join("\n\n---\n\n");
}

/** Pre-truncate raw input, optionally pull topic-relevant sections, then bound
 *  output size. Two budgets (`maxRaw`, `maxOut`) keep section extraction from
 *  scanning multi-MB blobs while still allowing rich extracted output. */
export function processFetchedText(
	text: string,
	topic: string | null,
	maxRaw = 12_000,
	maxOut = 8000
): string {
	const workingText = text.length > maxRaw ? text.slice(0, maxRaw) : text;
	if (topic) {
		const sections = extractRelevantSections(workingText, topic);
		if (sections) return truncate(sections, maxOut);
	}
	return truncate(text, maxOut);
}
