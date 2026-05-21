## MODIFIED Requirements

### Requirement: Ambient context injection on before_agent_start
The extension SHALL optionally search memlite for memories tagged `{ auto_context: "true" }` on each `before_agent_start` event. It SHALL be controlled by a `--memlite-context` CLI flag (default `false`) and `MEMLITE_CONTEXT` environment variable. The CLI flag takes precedence when both are set. Truthy env values include `1`, `true`, `yes`, `on` (case-insensitive). If enabled, the extension SHALL call `memory_list` with a tag filter for `auto_context = true`, sort by `last_accessed` descending, and inject the top N results into the system prompt.

#### Scenario: Context injection enabled via CLI flag
- **WHEN** `before_agent_start` fires and `--memlite-context` is set
- **THEN** relevant `auto_context` memories are fetched and appended to the system prompt

#### Scenario: Context injection enabled via env var
- **WHEN** `before_agent_start` fires, `MEMLITE_CONTEXT=1` is set, and no `--memlite-context` flag is given
- **THEN** relevant `auto_context` memories are fetched and appended to the system prompt

#### Scenario: Context injection disabled (default)
- **WHEN** `before_agent_start` fires and neither `--memlite-context` nor `MEMLITE_CONTEXT` is set
- **THEN** the system prompt is unchanged
