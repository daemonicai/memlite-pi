## Why

memlite has per-project ambient context (`auto_context`) that injects memories into the system prompt every turn, but there's no way to inject persistent, session-level memories that follow the user everywhere. A user wants to store facts like "my name is X," "I prefer dark mode," or "always use TypeScript" and have the agent know them automatically, regardless of which project or directory they're working in.

The `core_memory: "true"` tag gives users a way to mark certain memories as foundational. These are always loaded at session start and injected into every system prompt — always-on, with an opt-out flag. 

## What Changes

- New tag: `core_memory: "true"` — a boolean tag indicating a memory is a core/foundational memory
- Query at `session_start`: fetch all `core_memory: "true"` memories, cache in module state
- Inject at `before_agent_start`: append a `## Core Memories` section to the system prompt
- Char-based cap: 5000 characters total across all core memories (not count-limited)
- Truncation warning: `ctx.ui.notify("warning")` when core memories exceed the cap
- Always-on by default, opt-out via `--no-core-memory` flag / `MEMLITE_NO_CORE_MEMORY` env var
- Ordering: Core Memories section appears before auto_context section
- New tool: `memory_add_core(text)` — a dedicated Pi tool that wraps `memory_add` with `core_memory: "true"`, auto-generated timestamp slug, and `format: "text"`. Prompt guidelines instruct the agent when to use it.

## Capabilities

### New Capabilities

- `core-memories`: Persistent session-level memory injection via `core_memory: "true"` tag, always-on, character-capped with truncation warning. Includes a dedicated `memory_add_core(text)` Pi tool with auto-slug, forced `format: "text"`, and prompt guidelines teaching the agent when to create core memories.

### Modified Capabilities

None. This is additive — auto_context, auto_save, guardrails, and lifecycle-management are unchanged.

## Impact

- **Code:** `src/index.ts` — new `session_start` handler (query + cache), extended `before_agent_start` handler (inject core memories block + ordering)
- **Tools:** `src/tools.ts` — new `memory_add_core` tool with auto-slug, forced format, and prompt guidelines
- **Flags:** new `--no-core-memory` flag (boolean, default false) with `MEMLITE_NO_CORE_MEMORY` env var
- **No schema changes, no new memlite tools, no DB migration**
- **Back-compat:** zero — existing behavior is unchanged unless user tags a memory `core_memory: "true"`
