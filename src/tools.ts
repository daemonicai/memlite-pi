// Static TypeBox schemas and Pi tool definitions for all 16 memlite v1 tools.
// Schemas match the memlite openspec v1 contract (verified against memlite/src/tools.zig).

import { Type, type TObject, type TProperties } from "typebox";
import { isAbsolute } from "node:path";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { MemliteMcpClient } from "./mcp-client.js";
import { DEGRADED_TOOL_ERROR } from "./config.js";

// ---- Shared type helpers ----

/** Target: an id (number) or slug (string). */
const Target = Type.Union([Type.Number(), Type.String()]);

/** Tags: a flat object of string keys to string or string[] values. */
const Tags = Type.Record(Type.String(), Type.Union([Type.String(), Type.Array(Type.String())]));

/** Format enum */
const Format = Type.Union([Type.Literal("text"), Type.Literal("markdown")]);

/** Tag filter for search/list where clauses (plain object, matches memlite MCP parseTagFilters) */
const TagFilter = Type.Record(Type.String(), Type.Union([Type.String(), Type.Array(Type.String())]));

/** Order by enum */
const OrderBy = Type.Union([
  Type.Literal("created"),
  Type.Literal("updated"),
  Type.Literal("last_accessed"),
]);

// ---- Tool parameter schemas ----

const memoryAddCoreParams = Type.Object({
  text: Type.String(),
});

const memoryAddParams = Type.Object({
  content: Type.String(),
  format: Type.Optional(Type.Union([Type.Literal("text"), Type.Literal("markdown")])),
  slug: Type.Optional(Type.String()),
  tags: Type.Optional(Tags),
});

const memoryLoadParams = Type.Object({
  path: Type.String(),
  slug: Type.Optional(Type.String()),
  tags: Type.Optional(Tags),
});

const memoryGetParams = Type.Object({
  target: Target,
});

const memoryDeleteParams = Type.Object({
  target: Target,
});

const memoryClearParams = Type.Object({
  retain_history: Type.Optional(Type.Boolean()),
});

const memoryUpdateParams = Type.Object({
  target: Target,
  content: Type.Optional(Type.String()),
  format: Type.Optional(Format),
  slug: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  tags: Type.Optional(Type.Union([Tags, Type.Null()])),
});

const memorySearchParams = Type.Object({
  query: Type.String(),
  where: Type.Optional(TagFilter),
  limit: Type.Optional(Type.Number()),
  oversample: Type.Optional(Type.Number()),
});

const memoryListParams = Type.Object({
  where: Type.Optional(TagFilter),
  since: Type.Optional(Type.Number()),
  limit: Type.Optional(Type.Number()),
  offset: Type.Optional(Type.Number()),
  order_by: Type.Optional(OrderBy),
});

const memoryTagParams = Type.Object({
  target: Target,
  key: Type.String(),
  value: Type.String(),
});

const memoryUntagParams = Type.Object({
  target: Target,
  key: Type.String(),
  value: Type.Optional(Type.String()),
});

const memoryBumpParams = Type.Object({
  target: Target,
});

const memoryStatusParams = Type.Object({});

const memoryHistoryParams = Type.Object({
  target: Target,
});

const listTagsParams = Type.Object({});

const listTagValuesParams = Type.Object({
  key: Type.String(),
});

const listTagSiblingsParams = Type.Object({
  key: Type.String(),
  value: Type.String(),
});

// ---- Tool descriptions ----

const DESCRIPTIONS: Record<string, string> = {
  memory_add_core:
    "Store a short, standalone core memory fact about the user. Automatically tagged core_memory: true, format forced to text, slug auto-generated. Rejects empty text.",
  memory_add:
    "Add a new memory with optional slug, format (text or markdown), and tags. Returns the created memory's id, slug, format, chunk count, and tag count.",
  memory_load:
    "Read a markdown file from an absolute path and add it as a memory. File size capped at 1 MiB. Always stored as markdown format.",
  memory_get:
    "Fetch a memory by id (number) or slug (string). Bumps last_accessed timestamp.",
  memory_update:
    "Partial update: change content, format, slug, or tags. Content/format changes trigger re-chunking and re-embedding. Tags replacement: pass an object to fully replace, pass null/omit to leave unchanged. Slug: pass a string to set, null to clear.",
  memory_delete:
    "Soft-delete a memory by id or slug. A snapshot is saved to the history table via database trigger.",
  memory_clear:
    "Delete all memories. Set retain_history=false to also wipe the history table. Default retains history for recovery.",
  memory_tag:
    "Add a tag (key+value pair) to a memory. Idempotent — no error if the tag already exists.",
  memory_untag:
    "Remove a tag from a memory. If value is provided, removes only that key+value pair. If value is omitted, removes all tags with that key.",
  memory_search:
    "Hybrid semantic + full-text search with reciprocal rank fusion. Returns ranked memories with matching chunk details. Tag filter via where parameter.",
  memory_bump:
    "Update the last_accessed timestamp of a memory. Use this as an explicit engagement signal after reading a memory.",
  memory_list:
    "Administrative listing with optional tag filter, since timestamp, pagination (limit/offset), and ordering (created/updated/last_accessed). Does not bump last_accessed.",
  memory_status:
    "Aggregate statistics: total memories, chunks, tags, history entries, embedding model info, database size, and format counts.",
  memory_history:
    "Retrieve snapshots (history entries) for a memory by id or slug, most recent first. Shows content at time of deletion.",
  list_tags:
    "List all distinct tag keys with memory counts, ordered by count descending.",
  list_tag_values:
    "List all distinct values for a given tag key with memory counts, ordered by count descending.",
  list_tag_siblings:
    "For a given key+value pair, find all other key+value pairs that co-occur on the same memories, ranked by co-occurrence count.",
};

// ---- Tool factory ----

export function createMemliteTools(
  client: MemliteMcpClient | null
): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  const makeTool = (
    name: string,
    params: TObject<TProperties>,
    description: string,
    promptSnippet?: string,
    promptGuidelines?: string[]
  ): ToolDefinition => ({
    name,
    label: name,
    description,
    promptSnippet,
    promptGuidelines,
    parameters: params,
    async execute(_toolCallId, args, _signal, _onUpdate, _ctx) {
      if (!client) {
        throw new Error(DEGRADED_TOOL_ERROR);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(await client.callTool(name, args as Record<string, unknown>), null, 2),
          },
        ],
        details: {},
      };
    },
  });

  // High-utility tools get prompt snippets and guidelines
  tools.push(
    makeTool(
      "memory_add",
      memoryAddParams,
      DESCRIPTIONS.memory_add!,
      "Add a new fact, preference, note, or memory with optional slug and tags",
      [
        "Use memory_add when the user shares a fact, preference, or asks you to remember something. Always include a descriptive slug for future retrieval. Tag with project, category, or other organizational keys.",
      ]
    )
  );

  tools.push(
    makeTool(
      "memory_search",
      memorySearchParams,
      DESCRIPTIONS.memory_search!,
      "Search memories with hybrid semantic + full-text retrieval",
      [
        "Use memory_search to find relevant memories before answering user questions. Search with specific keywords or natural language queries. Use the where parameter to filter by tags (e.g., project name).",
      ]
    )
  );

  tools.push(
    makeTool(
      "memory_get",
      memoryGetParams,
      DESCRIPTIONS.memory_get!,
      "Fetch a specific memory by its slug or numeric id",
      [
        "Use memory_get to retrieve a specific memory by its slug or id. Prefer slug lookup when you know the memory's identifier. This bumps last_accessed, making the memory appear more recent.",
      ]
    )
  );

  // memory_load has custom validation: reject relative paths before MCP call
  tools.push({
    name: "memory_load",
    label: "memory_load",
    description: DESCRIPTIONS.memory_load!,
    parameters: memoryLoadParams,
    async execute(_toolCallId, args, _signal, _onUpdate, _ctx) {
      if (!client) throw new Error(DEGRADED_TOOL_ERROR);
      const path = (args as { path: string }).path;
      if (!isAbsolute(path)) {
        throw new Error(`memory_load requires an absolute path, got: ${path}`);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              await client.callTool("memory_load", args as Record<string, unknown>),
              null,
              2
            ),
          },
        ],
        details: {},
      };
    },
  });

  // memory_add_core — dedicated tool for core memory creation
  tools.push({
    name: "memory_add_core",
    label: "memory_add_core",
    description: DESCRIPTIONS.memory_add_core!,
    promptSnippet: "Store a core memory fact about the user",
    promptGuidelines: [
      "Use memory_add_core when you learn a fact about the user (name, identity, preferences, habits, or personal information). Each memory should be one short, standalone fact.",
    ],
    parameters: memoryAddCoreParams,
    async execute(_toolCallId, args, _signal, _onUpdate, _ctx) {
      if (!client) throw new Error(DEGRADED_TOOL_ERROR);
      const text = ((args as { text: string }).text ?? "").trim();
      if (!text) {
        throw new Error("memory_add_core: text must be non-empty");
      }
      const slug = `core-${Date.now()}`;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              await client.callTool("memory_add", {
                content: text,
                format: "text",
                slug,
                tags: { core_memory: "true" },
              }),
              null,
              2,
            ),
          },
        ],
        details: {},
      };
    },
  });

  // Remaining tools
  tools.push(makeTool("memory_update", memoryUpdateParams, DESCRIPTIONS.memory_update!));
  tools.push(makeTool("memory_delete", memoryDeleteParams, DESCRIPTIONS.memory_delete!));
  tools.push(makeTool("memory_clear", memoryClearParams, DESCRIPTIONS.memory_clear!));
  tools.push(makeTool("memory_tag", memoryTagParams, DESCRIPTIONS.memory_tag!));
  tools.push(makeTool("memory_untag", memoryUntagParams, DESCRIPTIONS.memory_untag!));
  tools.push(makeTool("memory_bump", memoryBumpParams, DESCRIPTIONS.memory_bump!));
  tools.push(makeTool("memory_list", memoryListParams, DESCRIPTIONS.memory_list!));
  tools.push(makeTool("memory_status", memoryStatusParams, DESCRIPTIONS.memory_status!));
  tools.push(makeTool("memory_history", memoryHistoryParams, DESCRIPTIONS.memory_history!));
  tools.push(makeTool("list_tags", listTagsParams, DESCRIPTIONS.list_tags!));
  tools.push(makeTool("list_tag_values", listTagValuesParams, DESCRIPTIONS.list_tag_values!));
  tools.push(makeTool("list_tag_siblings", listTagSiblingsParams, DESCRIPTIONS.list_tag_siblings!));

  return tools;
}
