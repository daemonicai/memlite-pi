// MCP stdio client transport for memlite.
// Hand-rolled JSON-RPC 2.0 over child_process stdio — no external MCP SDK dependency.

import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

import {
  MCP_VERSION,
  MCP_TIMEOUT_MS,
  TOOL_CALL_TIMEOUT_MS,
  SHUTDOWN_GRACE_MS,
} from "./config.js";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type Deferred<T> = {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

export class MemliteMcpClient {
  private process: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, Deferred<unknown>>();
  private rl: ReturnType<typeof createInterface> | null = null;
  private buffer = "";
  private closed = false;
  private binaryPath: string;

  constructor(binaryPath: string) {
    this.binaryPath = binaryPath;
  }

  /** Spawn the memlite child process with stdio pipes. */
  spawn(): void {
    if (this.process) return;

    this.process = spawn(this.binaryPath, ["serve"], {
      stdio: ["pipe", "pipe", "inherit"], // stderr → process.stderr
      env: { ...process.env }, // passthrough env
    });

    this.process.on("exit", (code, signal) => {
      this.closed = true;
      this.rejectAll(new Error(`memlite process exited (code=${code}, signal=${signal})`));
    });

    this.process.on("error", (err) => {
      this.closed = true;
      this.rejectAll(new Error(`memlite process error: ${err.message}`));
    });

    // Line-by-line stdout parser
    this.rl = createInterface({ input: this.process.stdout! });
    this.rl.on("line", (line: string) => {
      this.handleLine(line);
    });
  }

  /** Handle a single line of JSON-RPC from stdout. */
  private handleLine(line: string): void {
    if (!line.trim()) return;

    let msg: JsonRpcResponse;
    try {
      msg = JSON.parse(line) as JsonRpcResponse;
    } catch {
      // Non-JSON line — log to stderr but don't break the protocol
      process.stderr.write(`[memlite-pi] non-JSON stdout line: ${line}\n`);
      return;
    }

    if (msg.id === undefined || msg.jsonrpc !== "2.0") {
      // Unsolicited message or notification — ignore
      return;
    }

    const deferred = this.pending.get(msg.id);
    if (!deferred) {
      process.stderr.write(
        `[memlite-pi] response for unknown id: ${msg.id}\n`
      );
      return;
    }
    this.pending.delete(msg.id);

    if (msg.error) {
      deferred.reject(
        new Error(
          `MCP error ${msg.error.code}: ${msg.error.message}${
            msg.error.data ? " — " + JSON.stringify(msg.error.data) : ""
          }`
        )
      );
    } else {
      deferred.resolve(msg.result);
    }
  }

  /** Send a JSON-RPC request and return a promise for the response. */
  private sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.process || this.closed) {
      return Promise.reject(new Error("memlite is not running"));
    }

    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process!.stdin!.write(JSON.stringify(request) + "\n");
    });
  }

  /** MCP initialize handshake. Returns the instructions string. */
  async initialize(): Promise<string> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("MCP initialize timeout")),
        MCP_TIMEOUT_MS
      )
    );

    const result = (await Promise.race([
      this.sendRequest("initialize", {
        protocolVersion: MCP_VERSION,
        capabilities: {},
        clientInfo: { name: "memlite-pi", version: "0.1.0" },
      }),
      timeout,
    ])) as { instructions?: string; protocolVersion?: string };

    return result.instructions ?? "";
  }

  /** Call an MCP tool. Serializes to tools/call JSON-RPC. */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`MCP tool call timeout: ${name}`)),
        TOOL_CALL_TIMEOUT_MS
      )
    );

    const result = (await Promise.race([
      this.sendRequest("tools/call", {
        name,
        arguments: args,
      }),
      timeout,
    ])) as { content?: Array<{ type: string; text?: string }>; structuredContent?: unknown };

    // Parse content[0].text as JSON (memlite v1 always returns JSON in text)
    const content = result.content;
    if (content && content.length > 0 && content[0]?.text) {
      try {
        return JSON.parse(content[0].text);
      } catch {
        // Return raw text if not valid JSON (shouldn't happen with memlite)
        return result;
      }
    }

    // structuredContent is the canonical object form (memlite v1+)
    if (result.structuredContent !== undefined) {
      return result.structuredContent;
    }

    return result;
  }

  /** Graceful shutdown: SIGTERM → wait → SIGKILL. */
  async close(): Promise<void> {
    if (!this.process || this.closed) return;

    this.closed = true;

    // Reject all pending requests
    this.rejectAll(new Error("memlite is shutting down"));

    // Close readline
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    const child = this.process;

    return new Promise<void>((resolve) => {
      const forceKill = setTimeout(() => {
        child.kill("SIGKILL");
      }, SHUTDOWN_GRACE_MS);

      child.on("exit", () => {
        clearTimeout(forceKill);
        resolve();
      });

      child.kill("SIGTERM");
    });
  }

  /** Reject all pending requests with the given error. */
  private rejectAll(error: Error): void {
    for (const [, deferred] of this.pending) {
      deferred.reject(error);
    }
    this.pending.clear();
  }

  /** Whether the client is in a closed/error state. */
  get isClosed(): boolean {
    return this.closed;
  }
}
