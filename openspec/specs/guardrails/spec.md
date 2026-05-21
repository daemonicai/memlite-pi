## ADDED Requirements

### Requirement: memory_clear requires user confirmation
The extension SHALL intercept `tool_call` events where `toolName === "memory_clear"`. Before the call executes, it SHALL display a Pi `ctx.ui.confirm()` dialog with title "Clear all memories?" and body "This will delete all memories from memlite. This action is recoverable if `retain_history` is true (default)." If the user selects "No" or dismisses the dialog, the call SHALL be blocked with `{ block: true, reason: "User cancelled" }`.

#### Scenario: User confirms clear
- **WHEN** the LLM calls `memory_clear` and the user clicks "Yes"
- **THEN** the tool executes normally and all memories are deleted

#### Scenario: User denies clear
- **WHEN** the LLM calls `memory_clear` and the user clicks "No"
- **THEN** the tool is blocked and Pi reports the reason to the LLM

#### Scenario: Non-interactive mode
- **WHEN** Pi is in RPC or JSON mode (`ctx.hasUI === false`)
- **THEN** the guardrail is skipped and the tool executes without confirmation (no safe way to prompt)

### Requirement: memory_delete requires user confirmation
The extension SHALL intercept `tool_call` events where `toolName === "memory_delete"`. Before execution, it SHALL display a `ctx.ui.confirm()` dialog with title "Delete memory?" and body including the target slug or id. If denied, the call SHALL be blocked.

#### Scenario: Delete by slug confirmed
- **WHEN** the LLM calls `memory_delete(target: "user-prefs")` and the user confirms
- **THEN** the memory is soft-deleted

#### Scenario: Delete blocked
- **WHEN** the LLM calls `memory_delete` and the user cancels
- **THEN** the tool is blocked with reason "User cancelled"

### Requirement: Guardrails are bypassable for testing
The extension SHALL support a `--memlite-unsafe` CLI flag that disables all confirmation dialogs. When set, `memory_clear` and `memory_delete` execute without user confirmation.

#### Scenario: Unsafe mode
- **WHEN** Pi is started with `--memlite-unsafe`
- **THEN** `memory_clear` deletes all memories without prompting

### Requirement: Guardrails only apply to LLM-initiated tool calls
The extension SHALL NOT block tool calls that originate from the extension itself (e.g. auto-save feature calling `memory_add`). The `tool_call` event does not distinguish caller, but the guardrails only check the tool name (`memory_clear` / `memory_delete`). Auto-save uses `memory_add` which is unaffected.

#### Scenario: Auto-save is not blocked
- **WHEN** the extension's auto-save feature calls `memory_add` internally
- **THEN** the call proceeds without confirmation because it is not `memory_clear` or `memory_delete`
