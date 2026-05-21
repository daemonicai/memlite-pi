## MODIFIED Requirements

### Requirement: Auto-save triggers on session_before_compact
The extension SHALL optionally save a session summary to memlite on `session_before_compact`. It SHALL be controlled by a `--memlite-auto-save` CLI flag (default `false`) and `MEMLITE_AUTO_SAVE` environment variable. The CLI flag takes precedence when both are set. Truthy env values include `1`, `true`, `yes`, `on` (case-insensitive). If enabled, the extension SHALL generate a Markdown summary of the session branch and call `memory_add` with `format: "markdown"`.

#### Scenario: Auto-save enabled via CLI flag
- **WHEN** `session_before_compact` fires and `--memlite-auto-save` is set
- **THEN** a summary is generated and saved to memlite before compaction proceeds

#### Scenario: Auto-save enabled via env var
- **WHEN** `session_before_compact` fires, `MEMLITE_AUTO_SAVE=1` is set, and no `--memlite-auto-save` flag is given
- **THEN** a summary is generated and saved to memlite before compaction proceeds

#### Scenario: Auto-save disabled (default)
- **WHEN** `session_before_compact` fires and neither `--memlite-auto-save` nor `MEMLITE_AUTO_SAVE` is set
- **THEN** no automatic save occurs
