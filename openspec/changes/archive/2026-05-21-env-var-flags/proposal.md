## Why

All four memlite-pi CLI flags (`--memlite-path`, `--memlite-unsafe`, `--memlite-auto-save`, `--memlite-context`) can only be set via command-line arguments. There is no way to configure them through environment variables, making it awkward to persist settings across sessions or in CI/dotfiles. The core `memlite` binary already uses env vars (`MEMLITE_DB`, `MEMLITE_VERBOSE_LLAMA`) — the Pi extension should follow the same pattern.

## What Changes

- `--memlite-path` / `MEMLITE_PATH` — path to the memlite binary
- `--memlite-unsafe` / `MEMLITE_UNSAFE` — skip confirmation dialogs (any truthy value)
- `--memlite-auto-save` / `MEMLITE_AUTO_SAVE` — enable auto-save on compaction (any truthy value)
- `--memlite-context` / `MEMLITE_CONTEXT` — enable ambient context injection (any truthy value)

Each env var acts as a default; the CLI flag takes precedence when both are set. This matches the precedence model already used by the core memlite binary's `MEMLITE_VERBOSE_LLAMA` / `--verbose-llama` behavior.

## Capabilities

### Modified Capabilities

- `lifecycle-management` — "Binary path is configurable via flag" extended to also accept `MEMLITE_PATH` env var
- `guardrails` — "Guardrails are bypassable for testing" extended to also accept `MEMLITE_UNSAFE` env var
- `auto-save` — "Auto-save triggers on session_before_compact" extended to also accept `MEMLITE_AUTO_SAVE` env var
- `ambient-context` — "Ambient context injection on before_agent_start" extended to also accept `MEMLITE_CONTEXT` env var

## Impact

- **Code:** `src/index.ts` — resolve each flag from `process.env` as a fallback before falling through to `pi.getFlag()`. A helper function `envFlag` encapsulates the env-var lookup with truthy coercion.
- **CLI:** No new flags. Existing flags unchanged; env vars are additive.
- **No breaking changes.** Existing CLI flag usage is unaffected.
