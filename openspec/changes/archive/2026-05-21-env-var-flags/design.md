## Context

memlite-pi registers 4 CLI flags via `pi.registerFlag()`. Pi's flag system resolves flags from command-line arguments only. There is no built-in env var fallback, but extensions can read `process.env` directly and use that as a default before falling through to `pi.getFlag()`.

The core memlite binary already uses env vars (`MEMLITE_DB`, `MEMLITE_VERBOSE_LLAMA`) with a consistent precedent: the CLI flag takes precedence over the env var. The extension should mirror this pattern for UX consistency.

## Goals / Non-Goals

**Goals:**
- Each of the 4 flags has an equivalent `MEMLITE_*` env var
- Env var acts as a configurable default; CLI flag overrides when both are set
- Truthy/boolean coercion matches shell conventions: `1`, `true`, `yes` → true; absent/empty/`0`/`false` → false
- `MEMLITE_PATH` is a string, not boolean
- Implemented in `src/index.ts` only (no config.ts changes needed)

**Non-Goals:**
- Changing the flag names or descriptions
- Adding env var support to any future flags (they'll be handled the same way when they arise)
- Pi-level env var support (that's an upstream concern)
- Windows-specific env var casing (`MEMLITE_` prefix is fine)

## Decisions

### D1 — Env var resolution in `src/index.ts`, not `pi.getFlag()`

Pi's `pi.registerFlag()` doesn't support env var fallback natively. Two options:

(a) **Wrap each `pi.getFlag()` call** with a helper that checks `process.env` first. This is ~10 lines of code, lives entirely in `src/index.ts`, and doesn't touch any other files.

(b) **Monkey-patch or shim `pi.getFlag()`** — rejected: fragile, breaks on Pi updates, and over-engineered for 4 flags.

Chose (a). Introduce a local `envFlag(pi, flagName, envName)` helper.

### D2 — Precedence: CLI flag > env var (CLI wins)

Matches the core memlite binary's precedence: `MEMLITE_VERBOSE_LLAMA=1 memlite serve --verbose-llama=false` suppresses output (the explicit flag wins). The `envFlag` helper checks `pi.getFlag()` first; only if the flag is at its default value does it fall through to `process.env`.

For boolean flags, this means the env var only matters when the flag is NOT explicitly set on the CLI. For the string flag (`--memlite-path`), the env var only matters when `--memlite-path` is absent.

### D3 — Truthy coercion for boolean env vars

The 3 boolean env vars (`MEMLITE_UNSAFE`, `MEMLITE_AUTO_SAVE`, `MEMLITE_CONTEXT`) accept shell-friendly truthy values: `1`, `true`, `yes`, `on`. Absent, empty string, `0`, `false`, `no`, `off` are falsy. Case-insensitive.

This is implemented in a small `isTruthy(value: string | undefined): boolean` helper.

### D4 — No config.ts changes

Flag names and env var names are declared inline in `src/index.ts` where they're used. No circular dependency or config-file churn.

## Risks / Trade-offs

- **Docs out of sync**: The README and help text only mention CLI flags, not env vars. → Mitigation: low-priority docs task; env vars are discoverable via `MEMLITE_` prefix convention.
- **Pi upgrades**: If Pi's `registerFlag()` gains env var support natively, our wrapper code becomes redundant but not harmful. → Remove it when upstream ships.

## Open Questions

- Should there be a single `MEMLITE_` prefix (current) or `MEMLITE_PI_` to avoid collision with the core binary's env vars? → Decision: `MEMLITE_` is fine; no naming collision exists.
