## 1. Project scaffolding

- [x] 1.1 Create `package.json` with pi-compatible metadata (`pi.extensions` entry point), `@earendil-works/pi-coding-agent` and `typebox` as peer deps
- [x] 1.2 Create `tsconfig.json` with strict mode
- [x] 1.3 Create `src/` directory structure: `src/index.ts`, `src/mcp-client.ts`, `src/tools.ts`, `src/config.ts`
- [x] 1.4 Create `.gitignore`, `README.md` with install instructions

## 2. MCP client transport

- [x] 2.1 Implement `MemliteMcpClient` class in `src/mcp-client.ts`
  - `spawn()` child process with stdio pipes
  - Line-by-line stdout parser via `readline` or `on('data')` buffer
  - Request/response correlation via `Map<number, Deferred>`
  - Stderr passthrough to `process.stderr`
- [x] 2.2 Implement `initialize()` handshake (MCP version `2024-11-05`)
  - Send `initialize` request, await response
  - Extract `instructions` field
  - 10-second timeout with fallback to degraded mode
- [x] 2.3 Implement `callTool(name, args)` method — serializes to `tools/call` JSON-RPC, awaits response, parses `content[0].text` as JSON
- [x] 2.4 Implement `close()` — SIGTERM + 3s wait + SIGKILL + reject pending requests
- [x] 2.5 Add error translation: JSON-RPC errors → thrown Error with message

## 3. Tool surface

- [x] 3.1 Define all 15 tool parameter schemas in `src/tools.ts` using TypeBox `Type.Object()`
  - `memory_add`, `memory_load`, `memory_update`, `memory_get`, `memory_delete`, `memory_clear`
  - `memory_tag`, `memory_untag`, `memory_search`, `memory_bump`
  - `memory_list`, `memory_status`, `list_tags`, `list_tag_values`, `list_tag_siblings`, `memory_history`
- [x] 3.2 Create `createMemliteTools(client)` factory that returns Pi tool definitions with `execute()` delegating to `client.callTool()`
- [x] 3.3 Handle `memory_load` absolute path validation in tool logic (reject relative paths before MCP call)

## 4. Extension lifecycle

- [x] 4.1 Implement `session_start` handler in `src/index.ts`
  - Check `which memlite` or `--memlite-path` flag
  - If found: spawn client, initialize, register tools, set status `"memlite: connected"`
  - If not found: register tools in degraded mode, set status `"memlite: not found"`
  - If init timeout: kill child, degraded mode, status `"memlite: error"`
- [x] 4.2 Implement `session_shutdown` handler — call `client.close()` if spawned
- [x] 4.3 Register `--memlite-path` CLI flag via `pi.registerFlag()`
- [x] 4.4 Ensure environment passthrough — do not override `MEMLITE_DB` or other env vars

## 5. Guardrails

- [x] 5.1 Implement `tool_call` event handler for `memory_delete` — show `ctx.ui.confirm()`, block or allow
- [x] 5.2 Implement `tool_call` event handler for `memory_clear` — show `ctx.ui.confirm()`, block or allow
- [x] 5.3 Skip confirmation when `ctx.hasUI === false` (RPC/JSON mode)
- [x] 5.4 Register `--memlite-unsafe` CLI flag to bypass all confirmations

## 6. Auto-save (stretch, behind flag)

- [x] 6.1 Register `--memlite-auto-save` CLI flag (default `false`)
- [x] 6.2 Implement session summary generator — walk `ctx.sessionManager.getBranch()`, extract user+assistant message pairs, format as Markdown with `#` headings per topic
- [x] 6.3 Implement `session_before_compact` handler
  - Check `--memlite-auto-save` flag
  - Check turn count >= 5 since last save (track via `pi.appendEntry("memlite-auto-save")`)
  - Call `git -C <cwd> remote get-url origin`, parse to `owner/repo`
  - Call `memory_add` with summary + tags `{ project, auto_save: "true" }`
  - On failure: log and allow compaction to proceed
- [x] 6.4 Reset turn counter on successful save

## 7. Ambient context (stretch, behind flag)

- [x] 7.1 Register `--memlite-context` CLI flag (default `false`)
- [x] 7.2 Implement `before_agent_start` handler
  - Check `--memlite-context` flag
  - Call `memory_list` or `memory_search` with tag filter `{ auto_context: "true" }`
  - Sort by `last_accessed` desc, cap at 5 memories, total content <= 2000 chars
  - Append `## Context from your memory` section to `event.systemPrompt`
  - On failure: silently skip, return unchanged system prompt
- [x] 7.3 Format injected memories as markdown bullets with slug + content preview (~200 chars)

## 8. Testing and polish

- [x] 8.1 Verify `pi -e ./src/index.ts` loads without errors
- [x] 8.2 Verify all 15 tools appear in `pi.getAllTools()`
- [x] 8.3 Test `memory_add` → `memory_search` → `memory_get` round-trip
- [x] 8.4 Test guardrails: `memory_clear` shows confirm dialog
- [x] 8.5 Test degraded mode: rename `memlite` binary, verify tools register but return error
- [x] 8.6 Test `session_shutdown` — verify memlite process is killed, no zombies
- [x] 8.7 Test status bar visibility on startup
- [x] 8.8 Test auto-save flag (if implemented) with compact trigger
- [x] 8.9 Add `promptSnippet` and `promptGuidelines` for high-utility tools (`memory_add`, `memory_search`, `memory_get`)
