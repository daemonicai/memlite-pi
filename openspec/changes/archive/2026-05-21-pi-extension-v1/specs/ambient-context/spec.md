## ADDED Requirements

### Requirement: Ambient context injection on before_agent_start
The extension SHALL optionally search memlite for memories tagged `{ auto_context: "true" }` on each `before_agent_start` event. It SHALL be controlled by a `--memlite-context` CLI flag (default `false`). If enabled, the extension SHALL call `memory_search` or `memory_list` with a tag filter for `auto_context = true`, sort by `last_accessed` descending, and inject the top N results into the system prompt.

#### Scenario: Context injection enabled
- **WHEN** `before_agent_start` fires and `--memlite-context` is set
- **THEN** relevant `auto_context` memories are fetched and appended to the system prompt

#### Scenario: Context injection disabled (default)
- **WHEN** `before_agent_start` fires and `--memlite-context` is not set
- **THEN** the system prompt is unchanged

### Requirement: Only user-curated auto_context memories are injected
The injection SHALL only include memories explicitly tagged `auto_context: "true"` by the user or the extension's auto-save feature. The extension SHALL NOT perform query-based search against the raw user prompt for relevance — that is too slow and noisy.

#### Scenario: auto_context memory found
- **WHEN** a memory exists with tags `{ auto_context: "true", project: "daemonicai/memlite" }`
- **THEN** it is eligible for injection

#### Scenario: Regular memory ignored
- **WHEN** a memory exists without the `auto_context` tag
- **THEN** it is never injected automatically

### Requirement: Injected context is appended to system prompt
The extension SHALL append a section to the system prompt with the heading `## Context from your memory`. Each injected memory SHALL be formatted as a bullet with the memory slug (if any) and a content preview (first ~200 characters).

#### Scenario: Two auto_context memories exist
- **WHEN** two memories are tagged `auto_context: "true"`
- **THEN** the system prompt appends:
  ```
  ## Context from your memory
  - user-preferences: "I prefer dark mode and 2-space indentation…"
  - api-conventions: "All endpoints use OAuth 2.0 with PKCE…"
  ```

### Requirement: Injection is rate-limited and capped
The extension SHALL inject at most 5 memories per turn to avoid bloating the context window. It SHALL also skip injection entirely if the combined content would exceed ~2000 characters (approximately 500 tokens).

#### Scenario: Many auto_context memories
- **WHEN** 20 memories are tagged `auto_context: "true"`
- **THEN** only the 5 most recently accessed are injected

### Requirement: Injection failures are silent
If the memory lookup fails (memlite unavailable, timeout), the extension SHALL silently skip injection. It SHALL NOT throw or modify the system prompt.

#### Scenario: Memlite unavailable during context fetch
- **WHEN** `before_agent_start` tries to fetch context but memlite is offline
- **THEN** the system prompt is returned unchanged and no error propagates
