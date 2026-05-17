// HTTP fetch handler for arbitrary URLs. SSRF-guarded, with HTML stripping
// and length capping. Pure text transforms live in ../text/processing.ts.

import { decodeHtmlEntities, stripHtml } from "../parsers/html.js";
import { isPrivateUrl } from "../security/ssrf.js";
import { truncate } from "../text/processing.js";

const FETCH_TIMEOUT_MS = 15_000;

export async function fetchUrl(url: string, maxChars = 8000): Promise<string> {
	const blocked = isPrivateUrl(url);
	if (blocked) return blocked;

	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			headers: { "User-Agent": "docs-proxy/1.0" },
		});
		if (!res.ok) return `HTTP ${res.status} fetching ${url}`;

		const contentType = res.headers.get("content-type") ?? "";
		let text = await res.text();
		if (contentType.includes("text/html")) {
			text = decodeHtmlEntities(stripHtml(text));
		}

		const bounded = truncate(text, maxChars);
		return bounded || `Fetched ${url} but got empty response.`;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return `Failed to fetch ${url}: ${message}`;
	}
}
