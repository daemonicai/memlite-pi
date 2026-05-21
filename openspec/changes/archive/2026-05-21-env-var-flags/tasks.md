## 1. Helper functions

- [x] 1.1 Add `isTruthy(value: string | undefined): boolean` helper in `src/index.ts` — returns `true` for `1`, `true`, `yes`, `on` (case-insensitive); `false` for absent, empty, `0`, `false`, `no`, `off`
- [x] 1.2 Add `envFlag(pi, flagName): string | boolean | undefined` helper — checks `process.argv` for flag presence, falls back to `process.env[envNameFromFlag(flagName)]`, applies `isTruthy` coercion for boolean env vars. `envNameFromFlag` derives the env var name by uppercasing the flag name and replacing `-` with `_`
- [x] 1.3 Add `envNameFromFlag(flagName): string` helper — derives env var name (e.g., `"memlite-path"` → `"MEMLITE_PATH"`)

## 2. Wire up env var fallbacks

- [x] 2.1 Replace `pi.getFlag("memlite-path")` with `envFlag(pi, "memlite-path")` in session_start handler
- [x] 2.2 Replace `pi.getFlag("memlite-unsafe")` with `envFlag(pi, "memlite-unsafe")` in tool_call guardrail handler
- [x] 2.3 Replace `pi.getFlag("memlite-auto-save")` with `envFlag(pi, "memlite-auto-save")` in turn_end and session_before_compact handlers
- [x] 2.4 Replace `pi.getFlag("memlite-context")` with `envFlag(pi, "memlite-context")` in before_agent_start handler

## 3. Verify

- [x] 3.1 Manual test: `MEMLITE_UNSAFE=1 pi` → no confirmation dialogs for destructive tools
- [x] 3.2 Manual test: `MEMLITE_AUTO_SAVE=1 pi` → auto-save fires on compaction
- [x] 3.3 Manual test: `MEMLITE_CONTEXT=1 pi` → auto_context memories injected into system prompt
- [x] 3.4 Manual test: `MEMLITE_PATH=/not/real pi` → degraded mode, "memlite: not found"
- [x] 3.5 Manual test: `MEMLITE_UNSAFE=1 pi --memlite-unsafe=false` → guardrails active (flag wins over env)
