// Configuration constants and helpers for memlite-pi.

export const MEMLITE_BINARY = "memlite";
export const MCP_VERSION = "2024-11-05";
export const MCP_TIMEOUT_MS = 10_000;
export const TOOL_CALL_TIMEOUT_MS = 30_000;
export const SHUTDOWN_GRACE_MS = 3_000;

export const MEMLITE_INSTALL_HELP =
  "memlite binary not found. Install from github.com/daemonicai/memlite";

export const DEGRADED_TOOL_ERROR =
  "memlite is not available. Install it from github.com/daemonicai/memlite and restart pi.";

export const DESTRUCTIVE_TOOLS = ["memory_clear", "memory_delete"] as const;
