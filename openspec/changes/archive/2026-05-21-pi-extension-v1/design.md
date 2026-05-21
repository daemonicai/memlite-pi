## Context

Memlite (`github.com/daemonicai/memlite`) is a v1 MCP stdio server written in Zig. It exposes 15 tools for persistent memory management (add, search, update, tag, etc.) backed by SQLite with hybrid FTS5 + vector search. It speaks newline-delimited JSON-RPC 2.0 over stdio, is request-serial, and carries static v1 tool schemas.

Pi is a coding agent with an extension API (`@earendil-works/pi-coding-agent`) that allows TypeScript modules to register custom tools, intercept lifecycle events, and render custom UI. Pi has no built-in MCP client.

This design bridges these two systems: a Pi extension that acts as an MCP client to memlite, exposing memlite's tools plus Pi-native lifecycle integration such as guardrails, status reporting, and optional ambient context.

## Goals / Non-Goals

**Goals:**
- Spawn `memlite serve` on `session_start`, terminate on `session_shutdown`
- Hand-rolled MCP stdio client with request/response correlation and error translation
- Register all 15 v1 tools with static TypeBox schemas matching the memlite openspec
- Guardrails: confirm `memory_clear` and `memory_delete` before execution
- Status bar: show memlite connection state in footer
- Graceful degradation: if memlite binary not on PATH, tools register anyway and return helpful errors
- Auto-save (stretch): session summaries saved as Markdown with project tag from git origin
- Ambient context (stretch): `auto_context`-tagged memories injected before agent turns

**Non-Goals:**
- Distributing memlite binaries (user installs separately)
- MCP resources/prompts support (memlite uses only tools)
- Bidirectional MCP communication (memlite v1 is request/response only, no server-initiated sampling)
- Parallel memlite calls (memlite is serial; extension serializes automatically via `await`)
- Porting memlite logic into TypeScript (memlite remains a subprocess)

## Decisions

### Static tool schemas vs dynamic discovery
- **Decision: Static TypeBox schemas** hardcoded from the memlite v1 openspec.
- **Rationale:** The v1 surface is fixed and versioned in openspec. Static schemas give precise TypeScript types, better LLM parameter validation, and no startup round-trip. If memlite v2 changes signatures, the extension gets v2.
- **Alternative considered:** Calling `tools/list` at runtime. Rejected: more code, extra latency, schemas would be `Type.Any()` losing validation fidelity.

### Hand-rolled MCP client vs SDK
- **Decision: Hand-roll ~150 lines of JSON-RPC transport** using `node:child_process`.
- **Rationale:** Memlite only uses tools (no prompts/resources). An MCP SDK adds npm dependency overhead for features we don't need. The protocol is line-delimited JSON-RPC — simple to implement.
- **Implementation:** `MemliteMcpClient` class: spawn child, write requests with incrementing IDs, correlate via `Map<id, Deferred>`, parse stdout line-by-line. Stderr redirected to process stderr (_not_ parsed as protocol).

### Process lifecycle: eager vs lazy init
- **Decision: Eager spawn on `session_start`**.
- **Rationale:** Predictable. Session starts → memlite starts. First tool call is fast. User gets immediate status feedback (connected / not found). Lazy init would defer failure to first tool call, making debugging harder.
- **Binary discovery:** `which memlite` via `pi.exec` or `spawn('memlite', ['--help'])` in `session_start`. If not found, set a flag and still register tools (fail-graceful).

### Error translation
- **Decision:** JSON-RPC errors from memlite are forwarded as thrown errors from Pi tool `execute()` (which Pi treats as `isError: true` and reports to LLM).
- **Rationale:** Simple, idiomatic. The LLM sees the original error message and can retry or adjust.
- **Missing binary case:** Tools return `{ content: [{ text: "memlite not found. Install from github.com/daemonicai/memlite…" }], isError: true }` by throwing.

### Guardrails implementation
- **Decision:** `tool_call` event handler, not `tool_result`.
- **Rationale:** `tool_call` runs before execution and can block. We intercept `memory_clear` and `memory_delete` tool names, show Pi `ctx.ui.confirm()`, and either `{ block: true }` or allow (mutate nothing, just return undefined to proceed).
- **Edge case:** If tool call comes from `sendMessage` (not LLM), it still passes through `tool_call`. That's fine — we block based on tool name, not caller.

### Auto-save architecture (stretch)
- **Decision:** On `session_before_compact`, generate a markdown summary and call `memory_add` before the compact proceeds.
- **Rationale:** Compaction is a natural archive point. `session_shutdown` is too late (user might Ctrl-C). `session_before_compact` gives the extension a chance to save before Pi's default summarizer runs.
- **Project tag:** Use `git -C <cwd> remote get-url origin` → parse to `owner/repo` format. E.g. `daemonicai/memlite`. Tag as `{ project: "daemonicai/memlite", auto_save: "true" }`.
- **Format:** Markdown with `# Topic` headings so memlite's md4c chunker splits naturally across sections.
- **Rate limiting:** Only auto-save if N turns have elapsed since last auto-save (e.g. 5). Track in session state via `pi.appendEntry()`.

### Ambient context architecture (stretch)
- **Decision:** On `before_agent_start`, optionally search for `auto_context:true` tagged memories and inject as system prompt appendix.
- **Rationale:** MCP can't do this — only an in-process extension can read conversation state and pre-fetch context. This is the most Pi-native feature.
- **Filtering:** Only memories tagged `{ auto_context: "true" }` (user-curated). No query-based search (too slow and noisy for idle prompts).
- **Injection strategy:** Append to system prompt after Pi's default prompt:
  ```
  ## Relevant context from your memory
  - <memory content preview>
  ```

## Risks / Trade-offs

- **[Risk] Memlite binary absent / PATH misconfigured** → Mitigation: fail-graceful. Tools register and return helpful error. Status bar shows "memlite: not found"
- **[Risk] Memlite process crashes or hangs during a tool call** → Mitigation: timeout on MCP calls (e.g. 30s). On timeout, kill child and restart (or mark as dead and let next `session_start` respawn).
- **[Risk] Auto-save floods database** → Mitigation: minimum turn threshold (5), tag-based opt-in (`auto_context:true`), skip summary if conversation is trivial (e.g. all user messages < 20 chars).
- **[Risk] Auto-save blocks compaction** → Mitigation: `session_before_compact` handler can return `{ cancel: true }` but we don't. We fire off the `memory_add` call and don't wait for it (or `await` with a short timeout, and if it fails, just log).
- **[Risk] Status bar noise** → Mitigation: Only show status on failures / recoveries. Green "memlite" is silent; red "memlite: not found" on startup.
- **[Trade-off] Pi tool namespace collision** → Memlite tools are named `memory_*` and `list_*`. These are unlikely to collide with other extensions, but if they do, Pi suffixes (`memory_search:1`). We accept this.

## Migration Plan

- `pi install git:github.com/daemonicai/memlite-pi`
- Ensure `memlite` binary on PATH: `brew install memlite` or manual download
- Optional: `memlite init` to set up `~/.memlite/`
- `/reload` in Pi or restart. Extension auto-discovers from `~/.pi/agent/extensions/`.

No migration needed — there is no previous version.

## Open Questions

1. Should auto-save be opt-in (default off) or opt-out (default on)? The proposal says "optionally." Optimally: default off (`--memlite-auto-save` flag), since it mutates external state automatically.
2. Should ambient context injection also be opt-in flag? Same concern — modifying system prompt automatically could confuse LLM behavior.
3. What's the right timeout for MCP calls? memlite `memory_search` with large DB + embedding could take 5-10s on cold embedding model. 30s seems safe.
4. Should the extension respect `MEMLITE_DB` env var and pass it through? Probably yes — the extension should not override user's environment unless configured.
