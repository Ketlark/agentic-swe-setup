#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetchFromGitHub, isGitHubRef, parseGitHubRef } from "./handlers/github.js";
import { guessGitHubRepo } from "./handlers/library.js";
import { fetchUrl } from "./handlers/url.js";

const server = new McpServer({
	name: "docs-proxy",
	version: "1.0.0",
});

server.tool(
	"get_docs",
	`Fetch up-to-date documentation for any library, framework, or API.

Usage patterns:
  - Library name:         "next.js", "prisma", "tailwindcss"
  - GitHub repo:          "vercel/next.js", "https://github.com/prisma/prisma"
  - Direct URL:           "https://docs.stripe.com/api/payment_intents"
  - Topic-specific:       "next.js middleware", "prisma schema relations"

The tool automatically picks the best source:
  - GitHub repos → fetched directly from raw.githubusercontent.com (llms.txt / README)
  - URLs → fetched and converted to readable text
  - Library names → looked up in a built-in known-repo map, then fetched from GitHub`,

	{
		query: z
			.string()
			.describe("Library name, GitHub owner/repo, URL, or topic to look up documentation for."),
	},
	async ({ query }) => {
		try {
			const trimmed = query.trim();

			if (!trimmed) {
				return {
					content: [
						{
							type: "text" as const,
							text: "Empty query. Provide a library name, GitHub repo, or URL.",
						},
					],
					isError: true,
				};
			}

			if (/^https?:\/\//.test(trimmed) && !isGitHubRef(trimmed)) {
				const content = await fetchUrl(trimmed);
				return { content: [{ type: "text" as const, text: content }] };
			}

			if (isGitHubRef(trimmed)) {
				const parsed = parseGitHubRef(trimmed);
				if (!parsed) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Could not parse GitHub reference: ${trimmed}`,
							},
						],
						isError: true,
					};
				}
				try {
					const content = await fetchFromGitHub(parsed.ownerRepo, parsed.topic);
					return { content: [{ type: "text" as const, text: content }] };
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					return {
						content: [{ type: "text" as const, text: `GitHub fetch failed: ${message}` }],
						isError: true,
					};
				}
			}

			const githubGuess = guessGitHubRepo(trimmed);
			if (githubGuess) {
				const parts = trimmed.split(/\s+/);
				const topic = parts.length > 1 ? parts.slice(1).join(" ") : null;

				try {
					const content = await fetchFromGitHub(githubGuess, topic);
					return {
						content: [{ type: "text" as const, text: `[GitHub: ${githubGuess}]\n\n${content}` }],
					};
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					return {
						content: [
							{
								type: "text" as const,
								text: `GitHub fetch failed for ${githubGuess}: ${message}`,
							},
						],
						isError: true,
					};
				}
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `No documentation found for "${trimmed}".\n\nTry:\n- A GitHub repo: "owner/repo" or "https://github.com/owner/repo"\n- A direct URL: "https://docs.example.com"`,
					},
				],
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return {
				content: [{ type: "text" as const, text: `Internal error: ${message}` }],
				isError: true,
			};
		}
	}
);

async function main(): Promise<void> {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err: unknown) => {
	console.error("docs-proxy failed to start:", err);
	process.exit(1);
});
