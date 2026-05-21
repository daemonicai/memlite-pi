## ADDED Requirements

### Requirement: All v1 tools are registered with static TypeBox schemas
The extension SHALL register exactly 15 tools via `pi.registerTool()`, with names matching the memlite v1 surface. Each tool SHALL define `parameters` as a TypeBox `Type.Object()` matching the memlite openspec. Return types are not schema-validated by Pi; the extension SHALL parse and return the JSON blob from memlite.

#### Scenario: Tool list matches v1 surface
- **WHEN** the extension loads successfully
- **THEN** `pi.getAllTools()` includes `memory_add`, `memory_load`, `memory_update`, `memory_get`, `memory_delete`, `memory_clear`, `memory_tag`, `memory_untag`, `memory_search`, `memory_bump`, `memory_list`, `memory_status`, `list_tags`, `list_tag_values`, `list_tag_siblings`, `memory_history`

### Requirement: memory_add parameters match v1 contract
The `memory_add` tool SHALL accept `content` (string, required), `format` (enum `"text" | "markdown"`, default `"text"`), `slug` (string, optional), `tags` (object, optional).

#### Scenario: Required field missing
- **WHEN** `memory_add` is called without `content`
- **THEN** TypeBox validation fails before reaching memlite, and Pi reports the schema error to the LLM

### Requirement: memory_load enforces absolute path
The `memory_load` tool SHALL accept `path` (string, required, absolute path), `slug` (string, optional), `tags` (object, optional). The format SHALL NOT be exposed as a parameter (it is always `"markdown"`).

#### Scenario: Relative path rejected
- **WHEN** `memory_load` is called with a relative path like `"./notes.md"`
- **THEN** TypeBox validation rejects it (pattern constraint or tool logic) before reaching memlite

### Requirement: memory_update accepts target polymorphism
The `memory_update` tool SHALL accept `target` (required, number or string), `content` (string, optional), `slug` (string or null, optional), `format` (enum `"text" | "markdown"`, optional), `tags` (object or null, optional).

#### Scenario: Update by slug
- **WHEN** `memory_update` is called with `target: "user-preferences"`
- **THEN** memlite resolves by slug and updates the memory

### Requirement: memory_delete and memory_clear gated by guardrails
The `memory_delete` and `memory_clear` tools SHALL still be registered normally, but their `execute()` path SHALL include a guardrail check that defers to the `tool_call` interception layer (defined in `guardrails` spec). The tool registration itself SHALL NOT block.

#### Scenario: Tool registration succeeds even in degraded mode
- **WHEN** memlite binary is missing
- **THEN** `memory_delete` and `memory_clear` still appear in the tool list, but their `execute()` throws a helpful error

### Requirement: memory_search parameters match v1 contract
The `memory_search` tool SHALL accept `query` (string, required), `where` (object, optional), `limit` (number, default 10), `oversample` (number, default 3), `format` (enum `"text" | "markdown"`, optional).

#### Scenario: Search with defaults
- **WHEN** `memory_search` is called with only `query: "OAuth"`
- **THEN** the MCP request includes `limit: 10` and `oversample: 3`

### Requirement: memory_list supports pagination and ordering
The `memory_list` tool SHALL accept `where` (object, optional), `since` (number, optional), `limit` (number, optional), `offset` (number, optional), `order_by` (enum `"created" | "updated" | "last_accessed"`, default `"updated"`).

#### Scenario: Default listing
- **WHEN** `memory_list` is called with no arguments
- **THEN** results are ordered by `updated` descending, limited to 50, offset 0

### Requirement: memory_bump accepts polymorphic target
The `memory_bump` tool SHALL accept `target` (required, number or string) and return `{ id, last_accessed }`.

#### Scenario: Bump by id
- **WHEN** `memory_bump` is called with `target: 42`
- **THEN** the memory with id 42 gets its `last_accessed` updated

### Requirement: Tag discovery tools return typed arrays
The `list_tags`, `list_tag_values`, and `list_tag_siblings` tools SHALL return arrays wrapped in their respective named fields (`tags`, `values`, `siblings`) as defined by the memlite v1 contract.

#### Scenario: list_tags returns properly shaped result
- **WHEN** `list_tags` is called
- **THEN** the result is `{ tags: [{ key, memory_count }, ...] }`
