# Agentic SWE Setup for Pi

A production-ready configuration for Pi coding agent (https://pi.dev) optimized for software engineering workflows. This setup includes safety guards, git checkpoints, and multi-provider model support.

## Features

- **Safety Guards**: Blocks dangerous commands (rm -rf, device writes, etc.) and confirms risky operations
- **Git Checkpoints**: Automatic stashing before changes, with restore on error
- **Multi-Provider Support**: z.ai (Anthropic + GLM models), OpenRouter
- **Session Statistics**: Track tool usage and blocked commands
- **Extensible Architecture**: Easy to add custom extensions and skills

## Prerequisites

- **Node.js 22+**: Required for Pi CLI
- **pi CLI**: The Pi coding agent from [pi.dev](https://pi.dev)
- **API Keys**:
  - `ANTHROPIC_API_KEY` in `~/.hermes/.env` (for z.ai proxy)
  - `GLM_API_KEY` in `~/.hermes/.env` (for z.ai GLM models)
  - `OPENROUTER_API_KEY` (optional, in environment)

## Quick Start

```bash
# Clone or navigate to this directory
cd /Users/dehoux/dev/agentic-swe-setup

# Run the setup script
./setup.sh

# Source your shell to apply environment changes
source ~/.zshrc

# Start Pi
pi
```

## Project Structure

```
agentic-swe-setup/
├── settings.json           # Main Pi configuration
├── models.json            # Model provider definitions
├── extensions/
│   └── swe-guard/         # Safety extension
│       └── index.ts
├── skills/                # Custom skills (empty, add your own)
├── templates/
│   └── AGENTS.md          # Template for project-specific agent config
├── setup.sh               # Installation script
└── README.md              # This file
```

## Configuration

### Default Model

By default, this setup uses **Claude Sonnet 4** via the z.ai proxy:

```json
"defaultProvider": "zai-anthropic",
"defaultModel": "claude-sonnet-4-20250514"
```

### Available Models

#### z.ai Anthropic (zai-anthropic)
- `claude-sonnet-4-20250514` - Claude Sonnet 4 (default)
- `claude-opus-4-20250514` - Claude Opus 4
- `claude-haiku-3-5-20241022` - Claude Haiku 3.5

#### z.ai GLM (zai-glm)
- `glm-4-plus` - GLM-4 Plus
- `glm-4-long` - GLM-4 Long (1M context)
- `glm-4-flashx` - GLM-4 FlashX (fast)

#### OpenRouter (openrouter)
- `anthropic/claude-sonnet-4` - Claude Sonnet 4 via OpenRouter
- `google/gemini-2.5-flash` - Gemini 2.5 Flash
- `deepseek/deepseek-chat-v3-0324` - DeepSeek Chat V3

### Switching Models

To change the default model, edit `settings.json`:

```json
{
  "defaultProvider": "zai-glm",
  "defaultModel": "glm-4-long"
}
```

Or override via environment:

```bash
PI_DEFAULT_MODEL=gpt-4o pi
```

## Extensions

### SWE Guard Extension

The `swe-guard` extension provides three layers of protection:

1. **Permission Gate**
   - Blocks dangerous commands (`rm -rf /`, device writes, etc.)
   - Confirms risky operations (.env files, credentials, force push)

2. **Git Checkpoints**
   - Auto-stashes changes before each turn
   - Offers restore on agent error
   - Manual commands: `/git-checkpoint`, `/git-restore`

3. **Session Statistics**
   - Tracks tool calls and blocked commands
   - Displays summary on session end

### Adding Custom Extensions

Create a new directory under `extensions/`:

```bash
mkdir -p extensions/my-extension
```

Create `index.ts`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function myExtension(pi: ExtensionAPI): void {
  pi.on("session_start", async (event, ctx) => {
    ctx.ui.notify("My extension loaded!");
  });
  
  pi.registerCommand("my-command", {
    description: "My custom command",
    run: async (ctx) => {
      ctx.ui.notify("Command executed!");
    }
  });
}
```

Add to `settings.json`:

```json
{
  "extensions": ["extensions/swe-guard", "extensions/my-extension"]
}
```

## Skills

Skills are reusable prompts and workflows for common tasks. To add a skill:

1. Create a markdown file in `skills/`:

```markdown
---
name: refactor
description: Refactor code for clarity and maintainability
---

Refactor the selected code to improve:
- Readability and naming
- Error handling
- Performance (if applicable)
- Documentation

Maintain existing behavior and add tests if needed.
```

2. Enable in `settings.json`:

```json
{
  "skills": ["skills/refactor.md"]
}
```

## Using AGENTS.md in Projects

Copy the template to your project root and customize:

```bash
cp /Users/dehoux/dev/agentic-swe-setup/templates/AGENTS.md ./AGENTS.md
```

Edit `AGENTS.md` to add:
- Project context and architecture
- Coding conventions
- Testing expectations
- Git workflow
- Team communication style

Agents will automatically read and follow these guidelines.

## RPC Mode for Agentic-Loop Integration

Pi supports RPC mode (JSONL over stdin/stdout) for embedding in any agentic system (Hermes, OpenClaw, custom orchestrators).

### Python Example

```python
import subprocess
import json

class PiRPC:
    """Wrapper around Pi's RPC mode for agentic integration."""

    def __init__(self, model: str = "zai-anthropic/claude-sonnet-4-20250514"):
        self.proc = subprocess.Popen(
            ["pi", "--mode", "rpc", "--no-session", "--model", model],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

    def _send(self, cmd: dict):
        self.proc.stdin.write(json.dumps(cmd) + "\n")
        self.proc.stdin.flush()

    def prompt(self, message: str) -> str:
        """Send a prompt and return the full response text."""
        self._send({"type": "prompt", "message": message})
        chunks = []
        for line in self.proc.stdout:
            event = json.loads(line)
            delta = event.get("assistantMessageEvent", {})
            if delta.get("type") == "text_delta":
                chunks.append(delta["delta"])
            if event.get("type") == "agent_end":
                break
        return "".join(chunks)

    def close(self):
        self._send({"type": "abort"})
        self.proc.terminate()

# Usage
pi = PiRPC()
print(pi.prompt("List all TypeScript files in src/"))
pi.close()
```

### RPC Commands (stdin)

| Command | Description |
|---------|-------------|
| `prompt` | Send user prompt |
| `steer` | Queue steering message during streaming |
| `abort` | Abort current operation |
| `new_session` | Fresh session |
| `get_state` | Model, thinking level, session info |
| `set_model` | Switch model |
| `compact` | Manual compaction |
| `get_session_stats` | Token usage, cost, context % |
| `get_last_assistant_text` | Last response text |

### RPC Events (stdout)

| Event | Description |
|-------|-------------|
| `agent_start/end` | Agent lifecycle |
| `message_update` | Streaming text/thinking/toolcall deltas |
| `tool_execution_start/update/end` | Tool progress |
| `compaction_start/end` | Context compaction |

For full RPC docs, see [pi.dev/docs/rpc-mode](https://pi.dev/docs/rpc-mode).

## Provider Configuration

### z.ai

z.ai is used as the primary provider for both Anthropic and GLM models:

- **Anthropic API**: `https://api.z.ai/api/anthropic`
- **GLM API**: `https://api.z.ai/api/paas/v4`

API keys are read from `~/.hermes/.env` using shell command syntax in `models.json`.

### OpenRouter

OpenRouter provides access to additional models as a fallback:

- **API**: `https://openrouter.ai/api/v1`
- **Key**: Set `OPENROUTER_API_KEY` environment variable

### Adding Custom Providers

Edit `models.json` to add new providers:

```json
{
  "providers": {
    "my-provider": {
      "baseUrl": "https://api.example.com/v1",
      "api": "openai-completions",
      "apiKey": "!echo $MY_API_KEY",
      "models": {
        "my-model": {
          "id": "my-model",
          "displayName": "My Model",
          "provider": "custom",
          "maxTokens": 128000,
          "supportsThinking": false,
          "supportsCaching": false
        }
      }
    }
  }
}
```

## Troubleshooting

### Setup Issues

Run the setup script with `--check` to validate your configuration:

```bash
./setup.sh --check
```

### API Key Issues

If models fail to load:

1. Verify API keys are set:
   ```bash
   cat ~/.hermes/.env | grep ANTHROPIC_API_KEY
   cat ~/.hermes/.env | grep GLM_API_KEY
   echo $OPENROUTER_API_KEY
   ```

2. Check Pi can read the keys:
   ```bash
   cat ~/.hermes/.env | grep '^ANTHROPIC_API_KEY=' | cut -d= -f2-
   ```

### Extension Errors

If an extension fails to load:

1. Check Pi logs for error messages
2. Verify TypeScript syntax in extension files
3. Ensure extension doesn't crash (wrap in try/catch)

### Model Switching

If models don't switch properly:

1. Verify model ID exists in `models.json`
2. Check provider configuration
3. Restart Pi after changing `settings.json`

## Development

### Testing Extensions Locally

1. Make changes to extension code
2. Restart Pi to reload extensions
3. Test extension commands and event handlers

### Contributing

This is a personal configuration directory, but feel free to:
- Copy this structure for your own setup
- Customize extensions and skills
- Share improvements with the community

## License

This configuration is provided as-is for personal and commercial use.

## Resources

- **Pi Documentation**: [pi.dev](https://pi.dev)
- **Pi GitHub**: [github.com/earendil-works/pi-coding-agent](https://github.com/earendil-works/pi-coding-agent)
- **Anthropic Documentation**: [docs.anthropic.com](https://docs.anthropic.com)
- **GLM Documentation**: [open.bigmodel.cn](https://open.bigmodel.cn)

---

**Status**: ✅ Production-ready  
**Last Updated**: 2026-05-09  
**Maintainer**: @dehoux