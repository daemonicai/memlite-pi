## MODIFIED Requirements

### Requirement: Guardrails are bypassable for testing
The extension SHALL support a `--memlite-unsafe` CLI flag and `MEMLITE_UNSAFE` environment variable that disable all confirmation dialogs. The CLI flag takes precedence when both are set. When enabled, `memory_clear` and `memory_delete` execute without user confirmation. Truthy env values include `1`, `true`, `yes`, `on` (case-insensitive).

#### Scenario: Unsafe mode via CLI flag
- **WHEN** Pi is started with `--memlite-unsafe`
- **THEN** `memory_clear` deletes all memories without prompting

#### Scenario: Unsafe mode via env var
- **WHEN** `MEMLITE_UNSAFE=1` is set and no `--memlite-unsafe` flag is given
- **THEN** `memory_clear` and `memory_delete` execute without prompting

#### Scenario: Env var overridden by explicit false flag
- **WHEN** `MEMLITE_UNSAFE=1` is set and Pi is started with `--memlite-unsafe=false`
- **THEN** guardrails are active (explicit flag wins)
