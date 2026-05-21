## ADDED Requirements

### Requirement: MCP client spawns memlite as subprocess
The extension SHALL spawn `memlite serve` as a child process using `node:child_process` `spawn()`. The child SHALL inherit the extension's environment (including `MEMLITE_DB`, `MEMLITE_VERBOSE_LLAMA`). Stderr SHALL be redirected to `process.stderr`. Stdout SHALL be parsed line-by-line as JSON-RPC.

#### Scenario: Successful spawn
- **WHEN** `session_start` fires and `memlite` is found on PATH
- **THEN** the extension spawns `memlite serve` and the process remains running

#### Scenario: Binary not found
- **WHEN** `session_start` fires and `memlite` is not found on PATH
- **THEN** the extension records a "missing" state, skips handshake, and still registers Pi tools

### Requirement: MCP handshake completes before tool registration
The extension SHALL send an MCP `initialize` request immediately after spawn and await the response before registering Pi tools. The handshake request SHALL use protocol version `2024-11-05`. The response SHALL include `instructions` text per the memlite spec.

#### Scenario: Successful handshake
- **WHEN** the initialize request is sent and the server responds
- **THEN** tools are registered with Pi and the `instructions` field is consumed

#### Scenario: Handshake timeout
- **WHEN** the initialize response is not received within 10 seconds
- **THEN** the child is killed, status shows "timeout", and tools register in degraded mode

### Requirement: JSON-RPC request/response correlation uses incrementing IDs
The extension SHALL assign incrementing integer IDs to outgoing JSON-RPC requests. It SHALL maintain a map from ID to pending Promise resolvers. Incoming JSON-RPC responses SHALL be correlated by matching `id`. Unknown IDs or unsolicited messages SHALL be logged and ignored.

#### Scenario: Correlated response
- **WHEN** request ID 1 is sent for `memory_search`
- **THEN** the matching response with `id: 1` resolves the corresponding Promise

#### Scenario: Malformed response
- **WHEN** a line from stdout is not valid JSON-RPC or has no matching id
- **THEN** the line is logged to stderr and no Promise is resolved

### Requirement: Tool calls serialize over MCP tools/call method
The extension SHALL map each Pi `registerTool` `execute()` to an MCP `tools/call` JSON-RPC request. The request body SHALL contain `{ method: "tools/call", params: { name: <tool_name>, arguments: <args> } }`. The response `content[0].text` SHALL be parsed as JSON and returned to Pi.

#### Scenario: Successful tool call
- **WHEN** the LLM calls `memory_add` with `{ content: "test" }`
- **THEN** the extension sends `tools/call` with those arguments and returns the parsed JSON result to Pi

#### Scenario: MCP error response
- **WHEN** memlite returns a JSON-RPC error (e.g. `-32602` invalid params)
- **THEN** the extension throws an Error with the JSON-RPC error message, causing `isError: true`

### Requirement: Graceful shutdown and process cleanup
The extension SHALL terminate the memlite child process on `session_shutdown`. It SHALL send `SIGTERM` and wait up to 3 seconds for clean exit. If still running, it SHALL send `SIGKILL`. The pending request map SHALL be rejected with an error if a call is in-flight during shutdown.

#### Scenario: Clean session exit
- **WHEN** `session_shutdown` fires
- **THEN** `SIGTERM` is sent, memlite exits, and no zombie process remains

#### Scenario: Force kill after timeout
- **WHEN** memlite does not respond to `SIGTERM` within 3 seconds
- **THEN** `SIGKILL` is sent and the process is cleaned up
