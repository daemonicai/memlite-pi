## ADDED Requirements

### Requirement: Extension spawns memlite on session_start
The extension SHALL attempt to spawn `memlite serve` on every `session_start` event. It SHALL first verify `memlite` is on PATH by attempting a `spawn('memlite', ['--help'])` or equivalent check. If found, it SHALL start the MCP handshake and register tools. If not found, it SHALL register tools in degraded mode.

#### Scenario: Fresh Pi session with memlite installed
- **WHEN** Pi starts a new session and memlite is on PATH
- **THEN** memlite is spawned, handshake completes, tools register, and status shows "memlite: connected"

#### Scenario: Fresh Pi session without memlite
- **WHEN** Pi starts a new session and memlite is not on PATH
- **THEN** tools register, the first tool call returns a helpful install error, and status shows "memlite: not found"

### Requirement: Binary path is configurable via flag
The extension SHALL support a `--memlite-path` CLI flag that overrides the default `memlite` command. The flag value SHALL be passed directly to `spawn()` as the executable path.

#### Scenario: Custom memlite path
- **WHEN** Pi is started with `--memlite-path /opt/bin/memlite`
- **THEN** that path is used for spawn and binary discovery

### Requirement: Tools register even when memlite is absent
The extension SHALL register all 15 memlite tools regardless of whether the memlite binary is found. In degraded mode, each tool's `execute()` SHALL throw an Error with a clear message directing the user to install memlite.

#### Scenario: User calls memory_add without memlite installed
- **WHEN** `memory_add` is called and memlite binary was not found
- **THEN** the tool returns an error: "memlite binary not found. Install from github.com/daemonicai/memlite"

### Requirement: Session shutdown terminates the memlite process
The extension SHALL kill the memlite child process on `session_shutdown`. It SHALL send `SIGTERM`, wait up to 3 seconds, then `SIGKILL` if needed.

#### Scenario: User exits Pi
- **WHEN** Pi receives Ctrl+C or `/quit`
- **THEN** `session_shutdown` fires, memlite receives SIGTERM, and exits cleanly

### Requirement: Status bar reflects connection state
The extension SHALL set a footer status entry under key `"memlite"` via `ctx.ui.setStatus()`. States SHALL be:
- `"memlite: connected"` (green/accent) — handshake succeeded
- `"memlite: not found"` (warning) — binary absent
- `"memlite: error"` (error) — handshake or spawn failed

#### Scenario: Status visible on startup
- **WHEN** Pi starts and memlite is installed
- **THEN** the footer shows `memlite: connected`

### Requirement: Environment variables pass through
The extension SHALL spawn memlite with the full process environment. It SHALL NOT override `MEMLITE_DB` or any other env var unless explicitly configured to do so.

#### Scenario: Custom database path via env
- **WHEN** `MEMLITE_DB=/tmp/test.db` is set before Pi starts
- **THEN** memlite uses that path; the extension does not interfere
