## Why

Memlite is shipped and working as an MCP stdio server, but Pi has no native MCP client support. This means Pi users cannot use memlite's persistent memory capabilities at all — the tools are invisible to the LLM. A Pi extension wrapping memlite via its MCP stdio interface unlocks memlite for the Pi ecosystem while adding Pi-native lifecycle integration impossible through plain MCP.

## What Changes

- **New Pi extension** (`src/index.ts`) that spawns `memlite serve`, performs the MCP initialize handshake, and registers all 15 memlite tools as Pi-native custom tools with static TypeBox schemas.
- **MCP client transport** (`src/mcp-client.ts`) — minimal, hand-rolled JSON-RPC over stdio with request/response correlation. No external MCP SDK dependency.
- **Lifecycle management** — spawn memlite on `session_start`, graceful shutdown on `session_shutdown`. Lazy-init pattern: if memlite is not found on `PATH`, tools still register and return a helpful install message.
- **Guardrails** — intercept `memory_clear` and `memory_delete` via `tool_call` event. Present a Pi `confirm()` dialog before passing through. Block silently-automated destructive calls.
- **Status bar integration** — show memlite connection state in the Pi footer (connected / not found / error).
- **(stretch) Auto-save on session events** — on `session_before_compact` or `session_shutdown`, optionally summarize the session as Markdown and `memory_add` it to memlite. The summary uses heading structure so memlite's md4c chunker splits it naturally. Project tag derived from `git remote get-url origin`.
- **(stretch) Ambient context injection** — on `before_agent_start`, optionally search memlite for memories tagged `auto_context:true` and inject relevant hits into the system prompt.

## Capabilities

### New Capabilities

- `mcp-bridge`: Hand-rolled MCP stdio client — spawn, handshake, request correlation, error translation, graceful shutdown.
- `pi-tool-surface`: Static mapping of memlite's 15 v1 tool schemas to Pi `registerTool()` with TypeBox. Parameter shapes and return types validated against the memlite openspec.
- `lifecycle-management`: Process lifecycle (spawn on `session_start`, SIGTERM on `session_shutdown`), binary discovery on `PATH`, fallthrough error when memlite absent.
- `guardrails`: User confirmation gates for `memory_clear` and `memory_delete` via `tool_call` interception.
- `auto-save`: (stretch) Automatic session summarization and save on compaction/shutdown, with project-scoped tagging.
- `ambient-context`: (stretch) Relevant memory injection into `before_agent_start` system prompt.

### Modified Capabilities

- none

## Impact

- New repository `github.com/daemonicai/memlite-pi` with TypeScript source, `package.json` (pi-installable), and README.
- No changes to memlite itself — this is a pure consumer.
- Users install with `pi install git:github.com/daemonicai/memlite-pi`.
- Requires memlite binary on `PATH` (out of scope for this change).
