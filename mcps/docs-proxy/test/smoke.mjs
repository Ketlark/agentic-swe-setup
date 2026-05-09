#!/usr/bin/env node
/**
 * Smoke test for docs-proxy MCP server.
 * Sends JSON-RPC messages and validates responses.
 */

import { spawn } from "child_process";
import { pathToFileURL } from "url";

// ---------------------------------------------------------------------------
// Spawn the server with a path that is always correct regardless of cwd
// ---------------------------------------------------------------------------
const serverEntry = new URL("../src/index.js", import.meta.url).pathname;
const proc = spawn("node", [serverEntry], {
  stdio: ["pipe", "pipe", "pipe"],
});

// ---------------------------------------------------------------------------
// Message plumbing — collect JSON-RPC responses by id
// ---------------------------------------------------------------------------
const pending = new Map();

let buffer = "";
proc.stdout.on("data", (c) => {
  buffer += c.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop(); // keep incomplete last line in buffer
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      console.log("←", JSON.stringify(msg, null, 2));
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      console.log("← (raw)", line);
    }
  }
});

proc.stderr.on("data", (c) => process.stderr.write(c));

function send(msg) {
  const json = JSON.stringify(msg);
  console.log("→", json);
  proc.stdin.write(json + "\n");
}

function waitForResponse(id, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout waiting for response to id ${id}`));
    }, timeoutMs);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    console.error(`FAIL: ${message}`);
  } else {
    passed++;
  }
}

async function run() {
  // Phase 1: initialize
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "1.0" },
    },
  });

  const initRes = await waitForResponse(1);
  assert(initRes.result != null, "initialize should have a result");
  assert(
    initRes.result?.serverInfo?.name === "docs-proxy",
    `server name should be 'docs-proxy', got '${initRes.result?.serverInfo?.name}'`
  );

  // Phase 2: tools/list
  send({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });

  const toolsRes = await waitForResponse(2);
  assert(Array.isArray(toolsRes.result?.tools), "tools/list should return tools array");
  const toolNames = toolsRes.result.tools.map((t) => t.name);
  assert(toolNames.includes("get_docs"), "tools should include 'get_docs'");

  // Phase 3: tools/call — get_docs with a GitHub repo
  send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "get_docs",
      arguments: { query: "vercel/next.js" },
    },
  });

  const docsRes = await waitForResponse(3);
  assert(
    Array.isArray(docsRes.result?.content) && docsRes.result.content.length > 0,
    "get_docs should return content array"
  );
  const text = docsRes.result.content[0]?.text ?? "";
  assert(text.length > 0, "get_docs response text should be non-empty");
  assert(
    text.toLowerCase().includes("next"),
    "get_docs response should mention 'next'"
  );

  // Summary
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  proc.kill();

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

run().catch((err) => {
  console.error("Smoke test runner error:", err);
  proc.kill();
  process.exit(1);
});
