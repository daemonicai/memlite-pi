# memlite-pi

A [Pi](https://github.com/earendil-works/pi-coding-agent) extension that bridges [memlite](https://github.com/daemonicai/memlite) — a persistent memory engine for AI agents — into Pi as native custom tools with lifecycle integration, guardrails, and optional ambient context.

## Install

```sh
# 1. Install memlite (follow instructions at https://github.com/daemonicai/memlite#install)

# 2. Initialize memlite (downloads embedding model, creates DB)
memlite init

# 3. Install this extension
pi install git:github.com/daemonicai/memlite-pi
```

Then restart Pi or run `/reload`.

## What you get

- **16 memlite tools** registered as Pi-native tools with static TypeBox schemas
- **Guardrails** — confirmation dialogs for `memory_clear` and `memory_delete`
- **Lifecycle management** — memlite spawned on session start, terminated on shutdown
- **Status bar** — connection state in the Pi footer
- **Graceful degradation** — tools register even if memlite isn't installed (helpful error)

### Optional flags

| Flag | Description |
|------|-------------|
| `--memlite-path <path>` | Override path to memlite binary |
| `--memlite-unsafe` | Skip confirmation dialogs for destructive tools |
| `--memlite-auto-save` | Auto-save session summaries on compaction |
| `--memlite-context` | Inject `auto_context`-tagged memories into the system prompt |

## Usage

Once installed, memlite tools appear in Pi's tool list. The LLM can call them naturally:

```
> Remember that I prefer 2-space indentation and dark themes
> Search my memory for anything about deployment
> What's our API authentication convention?
```

Tag memories for ambient context injection with `--memlite-context`:

```
> memory_tag target="api-conventions" key="auto_context" value="true"
```

## License

Mozilla Public License Version 2.0 — see [LICENSE](LICENSE)
