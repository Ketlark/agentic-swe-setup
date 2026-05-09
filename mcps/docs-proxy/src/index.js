#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Known-repos map (extracted to JSON for maintainability)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWN_REPOS = JSON.parse(
  readFileSync(join(__dirname, "known-repos.json"), "utf-8")
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect if a query looks like a GitHub owner/repo or full GitHub URL.
 * Supports trailing words (e.g. "vercel/next.js middleware").
 */
function isGitHubRef(query) {
  return (
    /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/i.test(query) ||
    /^[\w.-]+\/[\w.-]+(\s|$)/.test(query)
  );
}

/**
 * Extract owner/repo from various GitHub reference formats.
 * Returns { ownerRepo, topic } where topic is the remaining text after the ref.
 */
function parseGitHubRef(query) {
  // https://github.com/vercel/next.js/… → vercel/next.js
  const urlMatch = query.match(/github\.com\/([\w.-]+\/[\w.-]+)/i);
  if (urlMatch) {
    const ownerRepo = urlMatch[1];
    const rest = query.slice(query.indexOf(urlMatch[0]) + urlMatch[0].length).trim();
    const topic = rest.replace(/^\/+/, "").trim() || null;
    return { ownerRepo, topic };
  }
  // vercel/next.js middleware → { ownerRepo: "vercel/next.js", topic: "middleware" }
  const bareMatch = query.match(/^([\w.-]+\/[\w.-]+)(?:\s+(.*))?$/);
  if (bareMatch) {
    return { ownerRepo: bareMatch[1], topic: bareMatch[2] || null };
  }
  return null;
}

/**
 * Check if a URL targets a private / internal address (SSRF protection).
 * Returns an error string if blocked, or null if allowed.
 */
function isPrivateUrl(url) {
  try {
    const parsed = new URL(url);
    // Only allow http/https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return `Blocked: protocol "${parsed.protocol}" is not allowed (only http/https).`;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block common local hostnames
    if (
      hostname === "localhost" ||
      hostname === "localhost.localdomain" ||
      hostname.endsWith(".local") ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".internal")
    ) {
      return `Blocked: hostname "${hostname}" resolves to a private address.`;
    }

    // Regex-based IP classification (no DNS lookup needed)
    // IPv4
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
    if (ipv4) {
      const [, a, b] = ipv4.map(Number);
      if (a === 127) return `Blocked: 127.0.0.0/8 is a loopback address.`;
      if (a === 10) return `Blocked: 10.0.0.0/8 is a private network.`;
      if (a === 172 && b >= 16 && b <= 31) return `Blocked: 172.16.0.0/12 is a private network.`;
      if (a === 192 && b === 168) return `Blocked: 192.168.0.0/16 is a private network.`;
      if (a === 169 && b === 254) return `Blocked: 169.254.0.0/16 is a link-local address.`;
      if (a === 0) return `Blocked: 0.0.0.0/8 is a reserved address.`;
    }

    // IPv6 (simplified)
    if (
      hostname === "::1" ||
      hostname === "[::1]" ||
      /^fe80:/i.test(hostname) ||
      /^fc/i.test(hostname) ||
      /^fd/i.test(hostname)
    ) {
      return `Blocked: IPv6 address "${hostname}" is a private/link-local address.`;
    }

    return null;
  } catch {
    return "Blocked: could not parse URL.";
  }
}

/**
 * Basic HTML entity decoder.
 */
const HTML_ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
};
const HTML_ENTITY_RE = /&(?:amp|lt|gt|quot|apos|nbsp|mdash|ndash|#39);/g;

function decodeHtmlEntities(text) {
  return text.replace(HTML_ENTITY_RE, (match) => HTML_ENTITIES[match] || match);
}

/**
 * Fetch any URL and convert to readable text.
 * Returns a string — never throws.
 */
async function fetchUrl(url, maxChars = 8000) {
  // SSRF check
  const blocked = isPrivateUrl(url);
  if (blocked) return blocked;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "docs-proxy/1.0" },
    });
    if (!res.ok) return `HTTP ${res.status} fetching ${url}`;

    const contentType = res.headers.get("content-type") || "";
    let text = await res.text();

    if (contentType.includes("text/html")) {
      // Strip HTML tags crudely
      text = text
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      // Decode common HTML entities
      text = decodeHtmlEntities(text);
    }
    // text/plain, text/markdown, etc. → return as-is

    if (text.length > maxChars) {
      text = text.slice(0, maxChars) + "\n\n... (truncated)";
    }
    return text || `Fetched ${url} but got empty response.`;
  } catch (err) {
    return `Failed to fetch ${url}: ${err.message}`;
  }
}

/**
 * Process fetched text: extract relevant sections if topic given, then truncate.
 */
function processFetchedText(text, topic, maxRaw = 12_000, maxOut = 8000) {
  const workingText = text.length > maxRaw ? text.slice(0, maxRaw) : text;
  if (topic) {
    const sections = extractRelevantSections(workingText, topic);
    if (sections) return truncate(sections, maxOut);
  }
  return truncate(text, maxOut);
}

/**
 * Fetch docs from a public GitHub repo via raw.githubusercontent.com.
 * Tries llms-full.txt → llms.txt → README.md (main branch), then README.md (master).
 */
async function fetchFromGitHub(ownerRepo, topic) {
  const branches = ["main", "master"];

  // Detect default branch via GitHub API (cheap, unauthenticated)
  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${ownerRepo}`,
      { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "docs-proxy/1.0" } }
    );
    if (apiRes.ok) {
      const info = await apiRes.json();
      if (info.default_branch && !branches.includes(info.default_branch)) {
        branches.unshift(info.default_branch);
      }
    }
  } catch {
    // ignore — proceed with default branch list
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
      } catch {
        continue;
      }
    }
  }

  // Final fallback: GitHub API readme endpoint (handles monorepos, case, redirects)
  try {
    const apiRes = await fetch(
      `https://api.github.com/repos/${ownerRepo}/readme`,
      { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "docs-proxy/1.0", "Accept": "application/vnd.github.v3.raw" } }
    );
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

function truncate(text, maxChars = 8000) {
  return text.length > maxChars
    ? text.slice(0, maxChars) + "\n\n... (truncated)"
    : text;
}

/**
 * Rough section extraction: find headings/paragraphs mentioning the topic.
 */
function extractRelevantSections(text, topic) {
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

function guessGitHubRepo(name) {
  const lower = name.toLowerCase().trim();
  const parts = lower.split(/\s+/);
  const libName = parts[0];

  if (KNOWN_REPOS[libName]) return KNOWN_REPOS[libName];

  // Try slugifying common patterns: "react router" → "react-router"
  const slug = libName.replace(/\s+/g, "-");
  if (KNOWN_REPOS[slug]) return KNOWN_REPOS[slug];

  return null;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

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
      .describe(
        "Library name, GitHub owner/repo, URL, or topic to look up documentation for."
      ),
  },
  async ({ query }) => {
    try {
      const trimmed = query.trim();

      if (!trimmed) {
        return {
          content: [{ type: "text", text: "Empty query. Provide a library name, GitHub repo, or URL." }],
          isError: true,
        };
      }

      // 1. Direct URL (non-GitHub)
      if (/^https?:\/\//.test(trimmed) && !isGitHubRef(trimmed)) {
        const content = await fetchUrl(trimmed);
        return {
          content: [{ type: "text", text: content }],
        };
      }

      // 2. GitHub reference (URL or owner/repo)
      if (isGitHubRef(trimmed)) {
        const parsed = parseGitHubRef(trimmed);
        if (!parsed) {
          return {
            content: [{ type: "text", text: `Could not parse GitHub reference: ${trimmed}` }],
            isError: true,
          };
        }
        const { ownerRepo, topic } = parsed;

        try {
          const content = await fetchFromGitHub(ownerRepo, topic);
          return {
            content: [{ type: "text", text: content }],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `GitHub fetch failed: ${err.message}` }],
            isError: true,
          };
        }
      }

      // 3. Library name → known-repo map → GitHub fetch
      const githubGuess = guessGitHubRepo(trimmed);
      if (githubGuess) {
        const parts = trimmed.split(/\s+/);
        const topic = parts.length > 1 ? parts.slice(1).join(" ") : null;

        try {
          const content = await fetchFromGitHub(githubGuess, topic);
          return {
            content: [
              {
                type: "text",
                text: `[GitHub: ${githubGuess}]\n\n${content}`,
              },
            ],
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `GitHub fetch failed for ${githubGuess}: ${err.message}` }],
            isError: true,
          };
        }
      }

      // 4. Unknown library name
      return {
        content: [
          {
            type: "text",
            text: `No documentation found for "${trimmed}".\n\nTry:\n- A GitHub repo: "owner/repo" or "https://github.com/owner/repo"\n- A direct URL: "https://docs.example.com"`,
          },
        ],
      };
    } catch (err) {
      // Blanket catch — server must never crash
      return {
        content: [{ type: "text", text: `Internal error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("docs-proxy failed to start:", err);
  process.exit(1);
});
