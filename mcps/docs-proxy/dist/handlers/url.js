import { decodeHtmlEntities, stripHtml } from "../parsers/html.js";
import { isPrivateUrl } from "../security/ssrf.js";
export async function fetchUrl(url, maxChars = 8000) {
    const blocked = isPrivateUrl(url);
    if (blocked)
        return blocked;
    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(15_000),
            headers: { "User-Agent": "docs-proxy/1.0" },
        });
        if (!res.ok)
            return `HTTP ${res.status} fetching ${url}`;
        const contentType = res.headers.get("content-type") ?? "";
        let text = await res.text();
        if (contentType.includes("text/html")) {
            text = decodeHtmlEntities(stripHtml(text));
        }
        if (text.length > maxChars) {
            text = `${text.slice(0, maxChars)}\n\n... (truncated)`;
        }
        return text || `Fetched ${url} but got empty response.`;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `Failed to fetch ${url}: ${message}`;
    }
}
export function truncate(text, maxChars = 8000) {
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n... (truncated)` : text;
}
export function extractRelevantSections(text, topic) {
    const lines = text.split("\n");
    const topicLower = topic.toLowerCase();
    const relevant = [];
    let inSection = false;
    let sectionLines = [];
    let score = 0;
    for (const line of lines) {
        const lineLower = line.toLowerCase();
        const isHeading = /^#{1,4}\s/.test(line);
        if (isHeading && inSection) {
            if (score > 0)
                relevant.push(sectionLines.join("\n"));
            sectionLines = [line];
            score = lineLower.includes(topicLower) ? 2 : 0;
        }
        else if (isHeading) {
            sectionLines = [line];
            score = lineLower.includes(topicLower) ? 2 : 0;
        }
        else {
            sectionLines.push(line);
            if (lineLower.includes(topicLower))
                score += 1;
        }
        inSection = true;
    }
    if (score > 0)
        relevant.push(sectionLines.join("\n"));
    if (relevant.length === 0)
        return null;
    return relevant.join("\n\n---\n\n");
}
export function processFetchedText(text, topic, maxRaw = 12_000, maxOut = 8000) {
    const workingText = text.length > maxRaw ? text.slice(0, maxRaw) : text;
    if (topic) {
        const sections = extractRelevantSections(workingText, topic);
        if (sections)
            return truncate(sections, maxOut);
    }
    return truncate(text, maxOut);
}
