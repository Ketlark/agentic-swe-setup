# Before/After Examples

## 1. Throat-Clearing + Binary Contrast

**Before:**
> Here's the thing: building products is hard. Not because the technology is complex. Because people are complex. Let that sink in.

**After:**
> Building products is hard. Technology is manageable. People aren't.

## 2. Business Jargon Stack

**Before:**
> In today's fast-paced landscape, we need to leverage cutting-edge tools to navigate uncertainty and drive transformative outcomes. This matters because your competition isn't waiting.

**After:**
> Move faster. Your competition is.

## 3. Dramatic Fragmentation

**Before:**
> Speed. Quality. Cost. You can only pick two. That's it. That's the tradeoff.

**After:**
> Speed, quality, cost — pick two.

## 4. Rhetorical Setup

**Before:**
> What if I told you that the best teams don't optimize for productivity? Here's what I mean: they optimize for learning. Think about it.

**After:**
> The best teams optimize for learning, not productivity.

## 5. Commit Message

**Before:**
> This commit implements a comprehensive fix for the race condition that was occurring during concurrent cache writes, leveraging atomic operations to ensure data integrity.

**After:**
> Fix race condition in concurrent cache writes with atomic ops

## 6. PR Description

**Before:**
> In this PR, we aim to enhance the search functionality by implementing a robust fallback mechanism. At its core, this change ensures seamless degradation when the primary engine is unavailable. The implementation carefully navigates edge cases including timeout handling and result deduplication.

**After:**
> Adds Bing fallback when SearXNG is down. Handles timeouts and deduplicates results across both engines.

## 7. Code Review

**Before:**
> There may be some potential concerns around resource management in this section. It would be worth considering whether the file descriptor is properly closed on the error path, as this could potentially lead to a leak under certain conditions.

**After:**
> This leaks a file descriptor on the error path. The `finally` block should close it.

## 8. README Section

**Before:**
> ## Features
> - **Seamless integration** with existing workflows
> - **Comprehensive** error handling
> - **Robust** caching layer
> - **Powerful** search capabilities

**After:**
> ## Features
> - Drops into any MCP client with one config line
> - Caches results 24h in SQLite
> - Falls back to Bing when SearXNG is down
> - Searches 70+ engines through a local SearXNG instance
