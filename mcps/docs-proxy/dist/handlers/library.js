import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWN_REPOS = JSON.parse(readFileSync(join(__dirname, "../../data/known-repos.json"), "utf-8"));
export function guessGitHubRepo(name) {
    const lower = name.toLowerCase().trim();
    const parts = lower.split(/\s+/);
    const libName = parts[0];
    if (!libName)
        return null;
    const direct = KNOWN_REPOS[libName];
    if (direct)
        return direct;
    const slug = libName.replace(/\s+/g, "-");
    const slugMatch = KNOWN_REPOS[slug];
    if (slugMatch)
        return slugMatch;
    return null;
}
