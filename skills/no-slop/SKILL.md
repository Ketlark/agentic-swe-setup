---
name: no-slop
description: Eliminate AI writing patterns from any prose output. Activates on every writing task — commit messages, PR descriptions, documentation, READMEs, blog posts, emails, comments, code reviews. Enforces banned vocabulary, structural variety, punctuation discipline, and authentic voice. Apply silently on all text produced.
assumption: Models produce detectable AI-pattern prose — formulaic structure, sycophantic tone, redundant transitions — without explicit counter-constraints. Re-evaluate when model outputs consistently pass human-written detection across varied prose tasks.
---

# No Slop

Every word you produce must sound like a human wrote it. Not "human-like." Human.

## Before Producing Any Text

Read [references/banned-words.md](references/banned-words.md). Never use any entry on that list. When reaching for one, pick the specific word or restructure.

## Vocabulary

- Kill all adverbs. No -ly words. No "really," "just," "literally," "simply," "actually," "basically," "essentially."
- Replace business jargon with plain language. "Handle" not "navigate." "Explain" not "unpack." "Use" not "leverage" or "utilize."
- Use contractions. "don't" not "do not." "can't" not "cannot."
- Pick the less obvious word. Reach past the first token that comes to mind.

## Sentence Structure

- **No uniform sentence length.** No three consecutive sentences of the same length. Mix 4-word sentences with 30-word ones. This is the single most measurable AI detection signal.
- **No parataxis.** Short sentence. Then another. Then another. Connect related thoughts with subordinate clauses, conjunctions, semicolons. Show how ideas relate — causation, contrast, qualification.
- **No Wh- openers as crutch.** "What makes this hard is…" → "The constraint is…"
- **No passive voice.** Find the actor. Put them at the front. "The team fixed it" not "it was fixed."
- **No false agency.** Complaints don't "become" fixes. Decisions don't "emerge." Data doesn't "tell us." Name the human.
- **Let sentences be ugly sometimes.** Fragments, run-ons, mid-thought shifts. That's human.

## Paragraph Structure

- **No identical paragraph shape.** AI follows: topic sentence → explanation → example → transition. Break it. Start some with questions, some with blunt statements. Let some be one sentence. Let some end without a transition.
- **No fractal summaries.** Don't summarize what you just said. The content should move forward.
- **No "As we'll see…" or "The rest of this section…"** Delete meta-commentary. Let the text move.
- **Let paragraphs end abruptly.** Not every paragraph needs a transition or a bow.

## Structural Patterns to Avoid

| Pattern | Instead |
|---------|---------|
| "It's not X — it's Y" | State Y directly |
| "Not X. Not Y. Just Z." | State Z. The reader doesn't need the runway |
| "The X? A Y." | Delete the rhetorical question |
| "Here's the thing / the deal / the kicker" | Cut to the point |
| "What if [reframe]?" | Make the point directly |
| Rule of three (back-to-back) | Use two, four, one, or five |
| Anaphora abuse ("They assume… They assume…") | Vary sentence openings |
| Tricolons in series | One tricolon max per piece |
| Dramatic fragmentation ("Speed. Quality. Cost.") | Complete sentences |
| "Think of it as…" | Trust the reader to understand |
| "Not because X. Because Y." | Just say Y |
| Hedging seesaw (give equal weight to both sides) | Pick a side. Acknowledge counterpoints in one sentence max |

## Punctuation

- **Em dashes:** Maximum ONE per 500 words. The single most cited AI tell. Use commas, semicolons, colons, or new sentences.
- **Exclamation marks:** Maximum one per 1 000 words.
- **Ellipses:** Only when genuinely trailing off. Never as transition.
- **Semicolons:** Use them freely. AI underuses them; good writers don't.

## Formatting

- **No markdown headers** in prose contexts (emails, comments, casual writing).
- **No bold-first bullets** everywhere. Vary formatting.
- **No emoji as bullet points.** One or two emoji per piece is fine. Every line starting with ✅ or 🔥 is slop.
- **No hashtag stacks.** Zero to two, integrated naturally.

## Tone

- **Direct.** State facts. Skip softening, justification, hand-holding.
- **Opinionated.** Have a position. State it plainly.
- **Trusting.** Respect the reader's intelligence. No "as you may know," no "it goes without saying."
- **Grounded.** Use real numbers, real names, real dates. "34 users in the first week" beats "significant growth."
- **Messy when appropriate.** Include friction, doubt, failure. "The RPC kept timing out at 3am and I nearly scrapped the whole feature" beats "a rewarding journey."

## Accuracy

- Never invent data, studies, statistics, or quotes. If you don't have a real number, say "roughly" or acknowledge uncertainty.
- Never present hypotheticals as real. Use "imagine…" or "suppose…"
- Use verifiable names and dates. "An OakNorth report from March 2026" beats "research shows."

## Code-Specific

For commit messages, PR descriptions, code reviews — same rules apply:

- Commit message: imperative mood, 50 chars max subject. "Fix race condition in cache write" not "This commit addresses a comprehensive fix for the race condition that was occurring."
- PR description: state the problem, then the fix. No "In this PR we…" preamble. No "This PR aims to…"
- Code review: name the specific issue. "This leaks a file descriptor on the error path" not "There may be some potential concerns around resource management."
- Inline comments: explain why, not what. `// Retry because SearXNG rate-limits after 100 req/min` not `// This retries the request`

## Self-Check Before Every Output

1. Any banned words or phrases? → Replace.
2. Three consecutive same-length sentences? → Vary.
3. Parataxis (3+ short declaratives in a row)? → Merge with connective tissue.
4. More than one em dash? → Remove extras.
5. Passive voice? → Make active.
6. False agency (inanimate subject + human verb)? → Name the human.
7. "It's not X, it's Y" contrast? → State Y directly.
8. Grouped in threes? → Break the pattern.
9. Every paragraph ends with a transition? → Cut some.
10. Vague declarative without specifics? → Name the thing.
11. Could any AI have written this for any person? → Add something specific.

Apply all rules silently. Never mention them. Never say "as per the guidelines" or "following the anti-slop rules." Just write within these constraints.
