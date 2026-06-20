/**
 * MCP adapter — exposes all tool handlers as MCP tools.
 *
 * When transport = stdio:  Claude Desktop connects directly (local).
 *   Auth: reads CLARIO_USER_ID from env + uses service role key.
 * When transport = http:   Claude connects via HTTP (remote MCP server).
 *   Auth: expects a Supabase JWT in the MCP session metadata.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOL_REGISTRY, UploadReceiptFromPathInput } from "../tools/schemas.ts";
import {
  getExpenses,
  addExpense,
  getBalances,
  settleUp,
  getGroups,
  attachReceipt,
  uploadReceiptFromPath,
} from "../tools/handlers.ts";
import { createUserClient, createServiceClient, getUserIdFromJwt } from "../lib/supabase.ts";

const HANDLERS: Record<string, Function> = {
  get_expenses: getExpenses,
  add_expense: addExpense,
  get_balances: getBalances,
  settle_up: settleUp,
  get_groups: getGroups,
  attach_receipt: attachReceipt,
};

function createMcpServer() {
  const server = new McpServer({
    name: "clario",
    version: "0.1.0",
  });

  // Register every shared tool from the registry
  for (const tool of TOOL_REGISTRY) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.shape,
      (async (args: Record<string, unknown>, extra: any) => {
        const { userId, supabase, error } = resolveAuth(extra?.meta?.jwt);
        if (error) {
          return { content: [{ type: "text", text: error }], isError: true };
        }

        const input = tool.inputSchema.parse(args);

        try {
          // supabase is guaranteed non-null here since error check above returned early
          const result = await HANDLERS[tool.name](input, supabase!, userId!);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
        }
      }) as any
    );
  }

  // upload_receipt_from_path — MCP-only (local file system access required)
  server.tool(
    "upload_receipt_from_path",
    "Upload a receipt from a local file path and attach it to an expense. Reads the file from your machine, uploads it to Supabase Storage, and stores the URL. Supports JPEG, PNG, PDF, WebP.",
    UploadReceiptFromPathInput.shape,
    (async (args: Record<string, unknown>, extra: any) => {
      const { userId, supabase, error } = resolveAuth(extra?.meta?.jwt);
      if (error) {
        return { content: [{ type: "text", text: error }], isError: true };
      }

      const input = UploadReceiptFromPathInput.parse(args);

      try {
        const result = await uploadReceiptFromPath(input, supabase!, userId!);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }) as any
  );

  return server;
}

/**
 * Resolve authentication for a tool call.
 *
 * Priority:
 *   1. JWT in session metadata  (MCP-over-HTTP, remote connections)
 *   2. CLARIO_USER_ID env var   (stdio / Claude Desktop, local use)
 */
function resolveAuth(jwt: string | undefined) {
  if (jwt) {
    return {
      userId: getUserIdFromJwt(jwt),
      supabase: createUserClient(jwt),
      error: null,
    };
  }

  const envUserId = process.env.CLARIO_USER_ID;
  if (envUserId) {
    return {
      userId: envUserId,
      supabase: createServiceClient(),
      error: null,
    };
  }

  return {
    userId: null,
    supabase: null,
    error: "Error: Not authenticated. Set CLARIO_USER_ID in your .env or sign in first.",
  };
}

export async function startStdioMcpServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Clario MCP server running on stdio");
}
