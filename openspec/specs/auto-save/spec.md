## ADDED Requirements

### Requirement: Auto-save triggers on session_before_compact
The extension SHALL optionally save a session summary to memlite on `session_before_compact`. It SHALL be controlled by a `--memlite-auto-save` CLI flag (default `false`). If enabled, the extension SHALL generate a Markdown summary of the session branch and call `memory_add` with `format: "markdown"`.

#### Scenario: Auto-save enabled and compaction fires
- **WHEN** `session_before_compact` fires and `--memlite-auto-save` is set
- **THEN** a summary is generated and saved to memlite before compaction proceeds

#### Scenario: Auto-save disabled (default)
- **WHEN** `session_before_compact` fires and `--memlite-auto-save` is not set
- **THEN** no automatic save occurs

### Requirement: Session summary uses Markdown with headings
The summary SHALL be formatted as Markdown with `#` heading sections corresponding to topics discussed in the session. This allows memlite's md4c-based chunker to split the content naturally into semantic chunks for better retrieval.

#### Scenario: Session with multiple topics
- **WHEN** the session covers OAuth refactoring and database schema changes
- **THEN** the summary includes `# OAuth refactoring` and `# Database schema changes` sections

### Requirement: Auto-save tags include project identifier
The summary SHALL be tagged with `{ project: "<owner>/<repo>", auto_save: "true" }`. The project identifier SHALL be derived from `git -C <cwd> remote get-url origin`, parsed to extract `owner/repo`. If no git origin is found, the project tag SHALL be omitted.

#### Scenario: Git repo with GitHub origin
- **WHEN** `git remote get-url origin` returns `git@github.com:daemonicai/memlite.git`
- **THEN** the project tag is `daemonicai/memlite`

#### Scenario: No git repository
- **WHEN** the current directory is not a git repo
- **THEN** the memory is saved with only `{ auto_save: "true" }`

### Requirement: Auto-save rate-limits by minimum turn threshold
The extension SHALL track the turn count since the last auto-save. It SHALL only save if at least 5 turns have elapsed. The count SHALL be persisted across compaction via `pi.appendEntry()` with custom type `"memlite-auto-save"`.

#### Scenario: Short conversation skipped
- **WHEN** a session has only 3 turns before compacting
- **THEN** no auto-save occurs because the minimum threshold is not met

#### Scenario: Long conversation saved
- **WHEN** a session has 12 turns before compacting and 5 have elapsed since last save
- **THEN** auto-save generates a summary and resets the counter

### Requirement: Auto-save falls back silently on failure
If the `memory_add` call fails (memlite unavailable, embedding error, etc.), the extension SHALL log the error and allow compaction to proceed. It SHALL NOT block compaction.

#### Scenario: Memlite dies during auto-save
- **WHEN** auto-save attempts `memory_add` but memlite has crashed
- **THEN** the error is logged, compaction continues, and the user session is unaffected
