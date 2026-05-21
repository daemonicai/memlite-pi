## Context

The existing ambient-context feature (`--memlite-context`) injects `auto_context: "true"` tagged memories into the system prompt on every `before_agent_start`. This is project-level context — the user manually tags memories they want injected, and optionally the auto-save feature adds `auto_save: "true"` to session summaries.

Core memories are a complementary concept: foundational personal facts and preferences that apply everywhere. The user tags them `core_memory: "true"`, they're loaded at `session_start` and cached, then injected alongside auto_context at `before_agent_start`.

## Goals / Non-Goals

**Goals:**
- Load core memories at `session_start` once per session
- Inject into system prompt on every `before_agent_start`
- Character cap (5000) with truncation warning
- Always-on by default, opt-out flag
- Ordering: core memories before auto_context

**Non-Goals:**
- Scoped core memories (repo-specific, dir-specific)
- Interaction with auto-save (different tag)
- Modifying auto_context behavior

## Decisions

### D1 — Cache at session_start, inject at before_agent_start

The Pi API has `before_agent_start` as the only hook for modifying the system prompt. `session_start` fires before the agent is ready. So:

1. `session_start`: query memlite, cache results in module-level `cachedCoreMemories: Array<{ slug?: string; content: string }>` variable
2. `before_agent_start`: if not opted out, build the `## Core Memories` section and inject into system prompt

This avoids redundant queries on every turn while using the correct injection hook.

### D2 — Char-based cap with warning

Unlike auto_context (which caps at 5 memories + 2000 chars), core memories are capped only by character count (5000). This fits the use case better — 5000 chars of short facts. If truncated, a `ctx.ui.notify("warning", ...)` is shown so the user knows their curated list exceeds the cap.

### D3 — Truncation is per-session

Truncation detection and warning happens once at session_start after caching. The user needs to know immediately if their core memories are too long, not silently truncate each turn.

### D4 — No `connect` vs `disconnect` handling

If memlite is not available at `session_start` (no `client`, `client.isClosed`), core memories are skipped silently — no error, no retry. On session reload, they'll be re-queried. This matches auto_context's silent failure pattern.

### D5 — Separate section, core first

Core memories get their own heading `## Core Memories` in the system prompt. When both features are active, core appears first, followed by `## Context from your memory` (auto_context).

## Risks / Trade-offs

- **Memlite unhealthy at session_start:** core memories silently skipped until next reload. Same pattern as existing features.
- **Truncation warning appears every reload:** the warning only fires once per session_start, not every turn. This is acceptable — reload is an explicit user action.
- **Long lists of core memories:** 5000 chars allows ~50 short facts. If a user has more, truncation warning helps them prune.

## Decision D6 — Dedicated `memory_add_core` tool

Rather than relying on prompt guidelines alone to teach the agent how and when to create core memories, we provide a dedicated Pi tool `memory_add_core(text: string)`. This:

- **Can't be misused:** the agent can't forget the `core_memory: "true"` tag or accidentally apply wrong format
- **Single purpose:** clear semantic — "store a core fact about the user"
- **Auto-slug:** slug is auto-generated from the Unix timestamp (e.g., `"core-1716326400"`) — no decision for the agent
- **Forced format:** always `"text"` — core memories are short facts, not markdown documents
- **Prompt guidelines:** the tool includes `promptGuidelines` telling the agent when to call it (learns a fact about the user's identity, preferences, or habits)

Omitted from scope:
- No deduplication logic — if the agent stores "user name is Alice" twice, both appear. The truncation warning makes duplicates visible.
- No delete/update tool — existing `memory_delete`, `memory_update`, `memory_untag` handle maintenance.