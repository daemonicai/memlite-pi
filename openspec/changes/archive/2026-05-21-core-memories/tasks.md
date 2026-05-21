## 1. Flag registration

- [x] 1.1 Register `--no-core-memory` flag (boolean, default `false`) with `MEMLITE_NO_CORE_MEMORY` env var support via the existing `envFlag` helper

## 2. Core memory cache

- [x] 2.1 Add `coreMemoriesCache` module-level variable: `Array<{ slug?: string; content: string }>` (empty initially)
- [x] 2.2 In `session_start` handler, after memlite is connected, query `memory_list` with `where: [{ key: "core_memory", values: ["true"] }]`, `order_by: "last_accessed"`, `limit: 50`
- [x] 2.3 Store results in `coreMemoriesCache`; reset cache to `[]` on query failure

## 3. Character cap with truncation warning

- [x] 3.1 After caching, compute total characters across all core memories
- [x] 3.2 If total > 5000, truncate entries to fit within 5000 characters and fire `ctx.ui.notify("warning", "Core memories truncated: N included, M excluded (exceeds 5000 character limit)")`
- [x] 3.3 Ensure truncation notification only fires once per session_start (not on every turn)

## 4. System prompt injection

- [x] 4.1 In `before_agent_start`, check `--no-core-memory` flag — skip if opted out
- [x] 4.2 If `coreMemoriesCache` is non-empty, build `## Core Memories` section using bullet format: `- slug: "content preview…"` (200-char preview, newlines → spaces)
- [x] 4.3 Inject core memories section into system prompt BEFORE the existing auto_context section
- [x] 4.4 Ensure both sections can coexist: "## Core Memories" followed by "## Context from your memory"

## 5. memory_add_core tool

- [x] 5.1 Define `memoryAddCoreParams` in `src/tools.ts` — `Type.Object({ text: Type.String() })`
- [x] 5.2 Add tool to `createMemliteTools()` with `promptSnippet` and `promptGuidelines`
- [x] 5.3 Tool execute: validate non-empty text, auto-generate slug (`core-${Date.now()}`), call `client.callTool("memory_add", { content: text, format: "text", slug, tags: { core_memory: "true" } })`
- [x] 5.4 Verify tool appears in system prompt with guidelines

## 6. Verify

- [x] 6.1 Tag a memory `core_memory: "true"`, restart Pi — verify `## Core Memories` appears in system prompt
- [x] 6.2 Tag multiple core memories exceeding 5000 chars — verify truncation warning appears
- [x] 6.3 Start Pi with `--no-core-memory` — verify no core memories injected
- [x] 6.4 Enable both core memories and `--memlite-context` — verify ordering (Core first, then Context)
- [x] 6.5 Start Pi with memlite unavailable — verify silent skip, no error
- [x] 6.6 Call `memory_add_core("User's favorite color is blue")` — verify memory stored with correct slug, format, and tags
