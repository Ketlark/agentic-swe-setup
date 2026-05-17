import { processFetchedText } from "../text/processing.js";

export function isGitHubRef(query: string): boolean {
	return (
		/^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/i.test(query) ||
		/^[\w.-]+\/[\w.-]+(\s|$)/.test(query)
	);
}

export function parseGitHubRef(query: string): { ownerRepo: string; topic: string | null } | null {
	const urlMatch = query.match(/github\.com\/([\w.-]+\/[\w.-]+)/i);
	if (urlMatch?.[1] && urlMatch[0]) {
		const ownerRepo = urlMatch[1];
		const rest = query.slice(query.indexOf(urlMatch[0]) + urlMatch[0].length).trim();
		const topic = rest.replace(/^\/+/, "").trim() || null;
		return { ownerRepo, topic };
	}
	const bareMatch = query.match(/^([\w.-]+\/[\w.-]+)(?:\s+(.*))?$/);
	if (bareMatch?.[1]) {
		return { ownerRepo: bareMatch[1], topic: bareMatch[2] ?? null };
	}
	return null;
}

export async function fetchFromGitHub(ownerRepo: string, topic: string | null): Promise<string> {
	const branches = ["main", "master"];

	try {
		const apiRes = await fetch(`https://api.github.com/repos/${ownerRepo}`, {
			signal: AbortSignal.timeout(8_000),
			headers: { "User-Agent": "docs-proxy/1.0" },
		});
		if (apiRes.ok) {
			const info = (await apiRes.json()) as { default_branch?: string };
			if (info.default_branch && !branches.includes(info.default_branch)) {
				branches.unshift(info.default_branch);
			}
		}
	} catch {
		// proceed with default branch list
	}

	for (const branch of branches) {
		const endpoints = [
			`https://raw.githubusercontent.com/${ownerRepo}/${branch}/llms-full.txt`,
			`https://raw.githubusercontent.com/${ownerRepo}/${branch}/llms.txt`,
			`https://raw.githubusercontent.com/${ownerRepo}/${branch}/README.md`,
			`https://raw.githubusercontent.com/${ownerRepo}/${branch}/readme.md`,
		];

		for (const ep of endpoints) {
			try {
				const res = await fetch(ep, { signal: AbortSignal.timeout(10_000) });
				if (res.ok) {
					const text = await res.text();
					if (text.length < 50) continue;
					return processFetchedText(text, topic);
				}
			} catch {}
		}
	}

	try {
		const apiRes = await fetch(`https://api.github.com/repos/${ownerRepo}/readme`, {
			signal: AbortSignal.timeout(8_000),
			headers: {
				"User-Agent": "docs-proxy/1.0",
				Accept: "application/vnd.github.v3.raw",
			},
		});
		if (apiRes.ok) {
			const text = await apiRes.text();
			if (text.length >= 50) {
				return processFetchedText(text, topic);
			}
		}
	} catch {
		// ignore
	}

	throw new Error(`Could not fetch docs for ${ownerRepo}`);
}
