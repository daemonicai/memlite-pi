// memlite-pi: Pi extension for memlite persistent memory.
//
// Lifecycle:
//   session_start  → discover memlite binary, spawn + handshake, register tools
//   session_shutdown → SIGTERM + 3s + SIGKILL
//
// Guardrails:
//   tool_call → intercept memory_clear / memory_delete → user confirm
//
// Optional (behind flags):
//   --memlite-auto-save → session_before_compact → memory_add summary
//   --memlite-context   → before_agent_start → inject auto_context memories
//   --memlite-unsafe    → skip guardrail confirmations
//   --memlite-path      → override memlite binary path

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { MemliteMcpClient } from "./mcp-client.js";
import { createMemliteTools } from "./tools.js";
import {
  MEMLITE_BINARY,
  DESTRUCTIVE_TOOLS,
} from "./config.js";

// ---- Env-var flag helpers ----

/** Shell-friendly truthy check for boolean env vars. */
function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Resolve a flag value with env var fallback. CLI flag takes precedence.
 * - If the flag appears in process.argv, return pi.getFlag(flagName) directly.
 * - Otherwise, check process.env[envName] with isTruthy coercion for booleans.
 */
function envFlag(
  pi: ExtensionAPI,
  flagName: string,
): string | boolean | undefined {
  const flagInArgv = process.argv.some(
    (a) =>
      a === `--${flagName}` ||
      a.startsWith(`--${flagName}=`),
  );
  if (flagInArgv) return pi.getFlag(flagName);

  const envVal = process.env[envNameFromFlag(flagName)];
  if (envVal === undefined) return pi.getFlag(flagName);

  // String flag → return env value as-is
  if (flagName === "memlite-path") return envVal;

  // Boolean flag → truthy coercion
  return isTruthy(envVal);
}

/** Derive env var name from flag name (e.g., "memlite-path" → "MEMLITE_PATH"). */
function envNameFromFlag(flagName: string): string {
  return flagName.toUpperCase().replace(/-/g, "_");
}

export default async function (pi: ExtensionAPI) {
  // ---- CLI flags ----
  pi.registerFlag("memlite-path", {
    description: "Path to the memlite binary",
    type: "string",
  });
  pi.registerFlag("memlite-unsafe", {
    description: "Skip confirmation dialogs for destructive memlite tools",
    type: "boolean",
    default: false,
  });
  pi.registerFlag("memlite-auto-save", {
    description: "Auto-save session summaries to memlite on compaction",
    type: "boolean",
    default: false,
  });
  pi.registerFlag("memlite-context", {
    description: "Inject auto_context-tagged memories into the system prompt",
    type: "boolean",
    default: false,
  });

  // ---- Runtime state ----
  let client: MemliteMcpClient | null = null;

  // Turn counter for auto-save rate limiting (restored from session)
  interface AutoSaveState {
    turnsSinceSave: number;
    lastSaveEntryId?: string;
  }
  const autoSaveState: AutoSaveState = { turnsSinceSave: 0 };

  // ---- session_start: spawn memlite, handshake, register tools ----
  pi.on("session_start", async (_event, ctx) => {
    // Restore auto-save turn counter from session
    for (const entry of ctx.sessionManager.getBranch()) {
      if (
        entry.type === "custom" &&
        (entry as { customType?: string }).customType === "memlite-auto-save"
      ) {
        const data = (entry as { data?: AutoSaveState }).data;
        if (data) {
          autoSaveState.turnsSinceSave = data.turnsSinceSave;
          autoSaveState.lastSaveEntryId = data.lastSaveEntryId;
        }
      }
    }

    // Determine binary path
    const memlitePath: string =
      (envFlag(pi, "memlite-path") as string | undefined) ?? MEMLITE_BINARY;

    // Discover binary
    const { code } = await pi.exec("which", [memlitePath]);
    if (code !== 0) {
      // Degraded mode: register tools without a client
      ctx.ui.setStatus("memlite", "memlite: not found");
      const tools = createMemliteTools(null);
      for (const tool of tools) {
        pi.registerTool(tool);
      }
      return;
    }

    // Spawn and handshake
    client = new MemliteMcpClient(memlitePath);
    try {
      client.spawn();
      await client.initialize();
      ctx.ui.setStatus("memlite", "memlite: connected");
    } catch (err) {
      // Handshake failed — kill the process and go degraded
      await client.close().catch(() => {});
      client = null;
      ctx.ui.setStatus(
        "memlite",
        `memlite: error — ${err instanceof Error ? err.message : "unknown"}`
      );
    }

    // Register all tools
    const tools = createMemliteTools(client);
    for (const tool of tools) {
      pi.registerTool(tool);
    }
  });

  // ---- session_shutdown: terminate memlite process ----
  pi.on("session_shutdown", async () => {
    if (client) {
      await client.close();
      client = null;
    }
  });

  // ---- Guardrails: confirm destructive tool calls ----
  pi.on("tool_call", async (event, ctx) => {
    const toolName = event.toolName;
    if (!DESTRUCTIVE_TOOLS.includes(toolName as (typeof DESTRUCTIVE_TOOLS)[number])) {
      return;
    }

    // Skip confirmation in unsafe mode
    if (envFlag(pi, "memlite-unsafe")) return;

    // Skip confirmation in non-interactive mode
    if (!ctx.hasUI) return;

    const isClear = toolName === "memory_clear";
    const title = isClear ? "Clear all memories?" : "Delete memory?";
    const body = isClear
      ? "This will delete all memories from memlite. This action is recoverable if retain_history is true (default)."
      : `Delete memory with target: ${JSON.stringify((event.input as Record<string, unknown>)?.target)}?`;

    const ok = await ctx.ui.confirm(title, body);
    if (!ok) {
      return { block: true, reason: "User cancelled" };
    }
  });

  // ---- Auto-save (stretch, behind --memlite-auto-save flag) ----
  pi.on("turn_end", async () => {
    if (!envFlag(pi, "memlite-auto-save")) return;
    autoSaveState.turnsSinceSave++;
  });

  pi.on("session_before_compact", async (_event, ctx) => {
    if (!envFlag(pi, "memlite-auto-save")) return;
    if (!client || client.isClosed) return;

    // Rate-limit: only save if >= 5 turns since last save
    if (autoSaveState.turnsSinceSave < 5) return;

    try {
      // Generate session summary
      const summary = await generateSessionSummary(ctx);
      if (!summary) return;

      // Get project tag from git origin
      let projectTag: Record<string, string> = { auto_save: "true" };
      try {
        const { stdout } = await pi.exec("git", [
          "-C",
          ctx.cwd,
          "remote",
          "get-url",
          "origin",
        ]);
        const url = stdout.trim();
        const match = url.match(/[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
        if (match?.[1]) {
          projectTag = {
            ...projectTag,
            project: match[1],
          };
        }
      } catch {
        // Not a git repo — omit project tag
      }

      await client.callTool("memory_add", {
        content: summary,
        format: "markdown",
        tags: projectTag,
      });

      // Reset turn counter on successful save
      autoSaveState.turnsSinceSave = 0;
      pi.appendEntry("memlite-auto-save", {
        turnsSinceSave: 0,
        lastSavedAt: Date.now(),
      });
    } catch {
      // Silently skip on failure — don't block compaction
    }
  });

  // ---- Ambient context (stretch, behind --memlite-context flag) ----
  pi.on("before_agent_start", async (event) => {
    if (!envFlag(pi, "memlite-context")) return;
    if (!client || client.isClosed) return;

    try {
      // Find auto_context-tagged memories
      const result = (await client.callTool("memory_list", {
        where: [{ key: "auto_context", values: ["true"] }],
        order_by: "last_accessed",
        limit: 10,
      })) as { memories?: Array<{ slug?: string; content: string }> };

      const memories = result.memories;
      if (!memories || memories.length === 0) return;

      // Cap at 5, total content <= 2000 chars
      const bullets: string[] = [];
      let totalChars = 0;
      const maxMemories = Math.min(memories.length, 5);

      for (let i = 0; i < maxMemories; i++) {
        const m = memories[i]!;
        const preview = m.content.slice(0, 200).replace(/\n/g, " ");
        const bullet = `- ${m.slug ?? "untitled"}: "${preview}${m.content.length > 200 ? "…" : ""}"`;
        if (totalChars + bullet.length > 2000) break;
        bullets.push(bullet);
        totalChars += bullet.length;
      }

      if (bullets.length === 0) return;

      const contextBlock = `\n\n## Context from your memory\n${bullets.join("\n")}`;
      return {
        systemPrompt: event.systemPrompt + contextBlock,
      };
    } catch {
      // Silently skip on failure
    }
  });
}

// ---- Session summary generator ----
// Walks the session branch, extracts user+assistant message pairs, formats as Markdown.
async function generateSessionSummary(
  ctx: { sessionManager: { getBranch(): unknown } }
): Promise<string | null> {
  const entries = ctx.sessionManager.getBranch() as Array<Record<string, unknown>>;
  const pairs: Array<{ user: string; assistant: string }> = [];

  let currentUser: string | null = null;

  for (const entry of entries) {
    if (entry.type !== "message" || !entry.message) continue;

    const msg = entry.message as { role: string; content: Array<{ type: string; text?: string }> | string };

    // Extract text from content
    let text = "";
    if (typeof msg.content === "string") {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      text = msg.content
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text!)
        .join("\n");
    }

    if (!text.trim()) continue;

    if (msg.role === "user") {
      currentUser = text;
    } else if (msg.role === "assistant" && currentUser) {
      pairs.push({ user: currentUser, assistant: text });
      currentUser = null;
    }
  }

  if (pairs.length === 0) return null;

  // Format as Markdown with simple topic detection
  const lines: string[] = [];
  lines.push(`# Session Summary — ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]!;

    // Simple topic extraction: first line of user message as heading
    const userFirstLine = pair.user.split("\n")[0]?.trim() ?? "";
    const topic = userFirstLine.length > 80 ? userFirstLine.slice(0, 77) + "..." : userFirstLine;

    lines.push(`## Topic: ${topic}`);
    lines.push("");
    lines.push(`**User:** ${pair.user.slice(0, 500)}`);
    lines.push("");
    lines.push(`**Assistant:** ${pair.assistant.slice(0, 500)}`);
    lines.push("");
  }

  return lines.join("\n");
}
