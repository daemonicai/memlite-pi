## ADDED Requirements

### Requirement: Core memories are loaded at session start

The extension SHALL query memlite for all memories tagged `core_memory: "true"` on `session_start`. The query SHALL use `memory_list` with `where: { core_memory: "true" }]` and sort by `last_accessed` descending. Results SHALL be cached in module-level state for the duration of the session.

#### Scenario: Core memories loaded successfully

- **WHEN** Pi starts and memlite is connected, with 3 memories tagged `core_memory: "true"`
- **THEN** all 3 memories are cached in module state

#### Scenario: No core memories exist

- **WHEN** Pi starts and memlite is connected, but no memories are tagged `core_memory: "true"`
- **THEN** the cache is empty and no error is raised

#### Scenario: Memlite unavailable

- **WHEN** Pi starts and memlite is not found
- **THEN** core memory loading is silently skipped and the cache remains empty

### Requirement: Core memories are injected into the system prompt

On `before_agent_start`, the extension SHALL inject cached core memories into the system prompt as a `## Core Memories` section. Each memory SHALL be formatted as a bullet with the memory slug (if any) and a content preview (first 200 characters, newlines replaced with spaces). The section SHALL appear before the auto_context section when both are present.

#### Scenario: Core memories injected

- **WHEN** the cached core memories include `{ slug: "user-name", content: "The user's name is Emmz" }`
- **THEN** the system prompt includes:
  ```
  ## Core Memories
  - user-name: "The user's name is Emmz"
  ```

#### Scenario: Empty core memory cache

- **WHEN** no core memories are cached
- **THEN** no `## Core Memories` section is injected

### Requirement: Core memories are character-capped with truncation warning

The extension SHALL cap core memories at 5000 characters total across all cached entries. If truncation occurs, the extension SHALL notify the user via `ctx.ui.notify("warning", ...)` that core memories were truncated, including the number of memories included and excluded.

#### Scenario: Core memories fit within cap

- **WHEN** 5 core memories total 1200 characters
- **THEN** all are injected without warning

#### Scenario: Core memories exceed cap

- **WHEN** 10 core memories total 6200 characters
- **THEN** only the first entries fitting within 5000 characters are injected, and a warning notification is shown: "Core memories truncated: N included, M excluded (exceeds 5000 character limit)"

### Requirement: Core memories are always-on with opt-out

The extension SHALL inject core memories by default. It SHALL support a `--no-core-memory` CLI flag (default `false`) and `MEMLITE_NO_CORE_MEMORY` environment variable that disables core memory injection. The CLI flag takes precedence over the env var.

#### Scenario: Default behavior (core memories on)

- **WHEN** Pi starts without `--no-core-memory` and without `MEMLITE_NO_CORE_MEMORY`
- **THEN** core memories are loaded and injected

#### Scenario: Opt-out via flag

- **WHEN** Pi starts with `--no-core-memory`
- **THEN** core memories are not loaded at session_start and not injected

#### Scenario: Opt-out via env var

- **WHEN** `MEMLITE_NO_CORE_MEMORY=1` is set and no `--no-core-memory` flag is given
- **THEN** core memories are not loaded

#### Scenario: Flag wins over env var for opt-out

- **WHEN** `MEMLITE_NO_CORE_MEMORY=1` is set and Pi is started with `--no-core-memory=false`
- **THEN** core memories are loaded (explicit flag wins)

### Requirement: Core memory injection failures are silent

If the core memory query fails at `session_start` (memlite timeout, error), the extension SHALL silently skip core memory loading. No error SHALL propagate to the agent or user.

#### Scenario: Query fails during session_start

- **WHEN** the `memory_list` call for core memories times out
- **THEN** the cache remains empty and session_start continues normally

### Requirement: Dedicated memory_add_core tool

The extension SHALL register a `memory_add_core` Pi tool that wraps `memory_add` with preset values. The tool SHALL accept a single `text: string` parameter, auto-generate a slug from the current Unix timestamp (`"core-<epoch>"`), force `format: "text"`, and automatically apply `tags: { core_memory: "true" }`. The tool SHALL include prompt guidelines instructing the agent to use it when it learns a fact about the user.

#### Scenario: Agent stores a core memory

- **WHEN** the agent calls `memory_add_core(text: "User's name is Emmz")`
- **THEN** a memory is created with slug `"core-1716326400"` (or similar timestamp), `format: "text"`, `content: "User's name is Emmz"`, and tags `{ core_memory: "true" }`

#### Scenario: Empty text

- **WHEN** the agent calls `memory_add_core(text: "")` or `memory_add_core(text: "   ")`
- **THEN** the tool returns an error — core memory text must be non-empty

#### Scenario: Prompt guidelines instruct the agent

- **WHEN** Pi generates the system prompt
- **THEN** the prompt guidelines for `memory_add_core` include: "Use memory_add_core when you learn a fact about the user (name, identity, preferences, habits, or personal information). Each memory should be one short, standalone fact."
