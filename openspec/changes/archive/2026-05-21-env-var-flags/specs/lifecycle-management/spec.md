## MODIFIED Requirements

### Requirement: Binary path is configurable via flag
The extension SHALL support a `--memlite-path` CLI flag and `MEMLITE_PATH` environment variable that override the default `memlite` command. The CLI flag takes precedence when both are set. The flag or env value SHALL be passed directly to `spawn()` as the executable path.

#### Scenario: Custom memlite path via CLI flag
- **WHEN** Pi is started with `--memlite-path /opt/bin/memlite`
- **THEN** that path is used for spawn and binary discovery

#### Scenario: Custom memlite path via env var
- **WHEN** `MEMLITE_PATH=/opt/bin/memlite` is set and no `--memlite-path` flag is given
- **THEN** that path is used for spawn and binary discovery

#### Scenario: CLI flag overrides env var
- **WHEN** `MEMLITE_PATH=/opt/bin/memlite` is set and Pi is started with `--memlite-path /usr/local/bin/memlite`
- **THEN** `/usr/local/bin/memlite` is used (flag wins)
