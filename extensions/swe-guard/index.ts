import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "child_process";

// ========== TYPES ==========
interface ToolCallEvent {
  toolName: string;
  input: any;
}

// ========== STATE ==========
let toolCallCount = 0;
let blockedCommands = 0;
let sessionStartTime = Date.now();

// ========== HELPERS ==========

function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --git-dir", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasUncommittedChanges(): boolean {
  try {
    const status = execSync("git status --porcelain", { encoding: "utf-8" });
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

function createCheckpoint(): string | null {
  if (!isGitRepo()) return null;
  if (!hasUncommittedChanges()) return null;

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const stashName = `pi-checkpoint-${timestamp}`;
    execSync(`git stash push -u -m "${stashName}"`, { stdio: "ignore" });
    return stashName;
  } catch {
    return null;
  }
}

function listCheckpoints(): string[] {
  try {
    const stashes = execSync("git stash list", { encoding: "utf-8" });
    return stashes
      .split("\n")
      .filter(line => line.includes("pi-checkpoint-"))
      .map(line => line.trim());
  } catch {
    return [];
  }
}

// ========== EXTENSION ==========

export default function sweGuard(pi: ExtensionAPI): void {

  // ========== 1. PERMISSION GATE ==========

  const DANGEROUS_PATTERNS = [
    { pattern: /\brm\s+(-[rfRF]+\s+)*\/(\s|$)/, label: "recursive deletion of root" },
    { pattern: /\bsudo\s+.*\brm\s/, label: "sudo rm" },
    { pattern: /\bchmod\s+(-R\s+)?777\s*\//, label: "chmod 777 on /" },
    { pattern: /\bkill\s+-9\s+1\b/, label: "kill init" },
    { pattern: />\s*\/dev\/[a-z]+/, label: "write to block device" },
    { pattern: /\bdd\s+if=.*of=\/dev\//, label: "dd to device" },
    { pattern: />\s*\/(proc|sys)\//, label: "write to /proc or /sys" },
  ];

  const SENSITIVE_PATTERNS = [
    /\.env([.\w]*)$/,
    /credentials/i,
    /secrets/i,
    /private[-_]?key/i,
    /\.pem$/,
    /\.key$/,
    /id_rsa/,
    /id_ed25519/,
  ];

  const WRITE_OPS = [/>/, /tee\b/, /echo\b.*>/, /cat\b.*>/, /printf\b.*>/];

  pi.on("tool_call", async (event: ToolCallEvent, ctx: any) => {
    try {
      if (event.toolName !== "bash") return;

      const command: string = event.input?.command;
      if (!command || typeof command !== "string") return;

      // Block dangerous commands immediately
      for (const { pattern, label } of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
          blockedCommands++;
          return { block: true, reason: `Blocked: ${label}` };
        }
      }

      // Confirm writes to sensitive files
      const hasWriteOp = WRITE_OPS.some(op => op.test(command));
      if (hasWriteOp) {
        for (const pattern of SENSITIVE_PATTERNS) {
          if (pattern.test(command)) {
            const ok = await ctx.ui.confirm(
              "Sensitive file write detected",
              `Command writes to a sensitive path:\n  ${command}\n\nAllow?`
            );
            if (!ok) {
              blockedCommands++;
              return { block: true, reason: "User declined sensitive file write" };
            }
            break;
          }
        }
      }

      // Confirm force push
      if (/git\s+push\b.*(--force|-f)\b/.test(command)) {
        const ok = await ctx.ui.confirm(
          "Force push detected",
          `This rewrites remote history:\n  ${command}\n\nAllow?`
        );
        if (!ok) {
          blockedCommands++;
          return { block: true, reason: "User declined force push" };
        }
      }
    } catch (error) {
      // Never crash Pi from the permission gate
      console.error("[swe-guard] tool_call error:", error);
    }
  });

  // ========== 2. GIT CHECKPOINT ==========

  pi.on("turn_end", async (_event: any, ctx: any) => {
    try {
      const stash = createCheckpoint();
      if (stash) {
        ctx.ui.notify(`Checkpoint: ${stash}`);
      }
    } catch (error) {
      console.error("[swe-guard] turn_end error:", error);
    }
  });

  pi.on("agent_end", async (event: any, ctx: any) => {
    try {
      // Offer restore on error
      if (event.error) {
        const checkpoints = listCheckpoints();
        if (checkpoints.length > 0) {
          const ok = await ctx.ui.confirm(
            "Agent ended with error",
            `Restore last checkpoint?\n  ${checkpoints[0]}`
          );
          if (ok) {
            try {
              execSync("git stash pop", { stdio: "ignore" });
              ctx.ui.notify("Checkpoint restored");
            } catch {
              ctx.ui.notify("Failed to restore checkpoint");
            }
          }
        }
      }

      // Session stats
      const duration = Math.round((Date.now() - sessionStartTime) / 1000);
      const mins = (duration / 60).toFixed(1);
      ctx.ui.notify(
        `Session: ${toolCallCount} tool calls, ${blockedCommands} blocked, ${mins}m`
      );
    } catch (error) {
      console.error("[swe-guard] agent_end error:", error);
    }
  });

  // Manual commands
  pi.registerCommand("git-checkpoint", {
    description: "Create a git checkpoint (stash uncommitted changes)",
    run: async (ctx: any) => {
      if (!isGitRepo()) {
        ctx.ui.notify("Not in a git repository");
        return;
      }
      const stash = createCheckpoint();
      if (stash) {
        ctx.ui.notify(`Checkpoint created: ${stash}`);
      } else {
        ctx.ui.notify("No changes to checkpoint");
      }
    },
  });

  pi.registerCommand("git-restore", {
    description: "List and restore a git checkpoint",
    run: async (ctx: any) => {
      if (!isGitRepo()) {
        ctx.ui.notify("Not in a git repository");
        return;
      }
      const checkpoints = listCheckpoints();
      if (checkpoints.length === 0) {
        ctx.ui.notify("No checkpoints found");
        return;
      }

      const choices = checkpoints.map(cp => {
        const ref = cp.match(/^(stash@\{\d+\})/)?.[1] || "stash@{0}";
        return { label: cp, value: ref };
      });
      choices.push({ label: "Cancel", value: "__cancel__" });

      const selected = await ctx.ui.select("Restore which checkpoint?", choices);
      if (!selected || selected === "__cancel__") return;

      try {
        execSync(`git stash pop ${selected}`, { stdio: "ignore" });
        ctx.ui.notify(`Restored: ${selected}`);
      } catch {
        ctx.ui.notify("Failed to restore checkpoint");
      }
    },
  });

  // ========== 3. SESSION STATS ==========

  pi.on("session_start", async (_event: any, _ctx: any) => {
    toolCallCount = 0;
    blockedCommands = 0;
    sessionStartTime = Date.now();
  });

  pi.on("tool_result", async (_event: any, _ctx: any) => {
    toolCallCount++;
  });
}
