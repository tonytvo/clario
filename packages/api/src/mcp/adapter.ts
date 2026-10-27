/**
 * MCP adapter — exposes all tool handlers as MCP tools.
 *
 * Transport = stdio: Claude Desktop connects directly to the local process.
 * Identity: the local user is CLARIO_USER_ID from env (local-first, no accounts).
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
  type ToolHandler,
} from "../tools/handlers.ts";
import { createLedgerStore } from "../adapters/factory.ts";
import { DomainError } from "../domain/errors.ts";

const HANDLERS: Record<string, ToolHandler> = {
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
      (async (args: Record<string, unknown>) => {
        const userId = resolveLocalUser();
        if (!userId) {
          return { content: [{ type: "text", text: NOT_CONFIGURED }], isError: true };
        }

        const input = tool.inputSchema.parse(args);

        try {
          const result = await HANDLERS[tool.name](input, createLedgerStore(), userId);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          if (err instanceof DomainError) {
            return {
              content: [{ type: "text", text: `${err.code}: ${err.message}` }],
              isError: true,
            };
          }
          const message = err instanceof Error ? err.message : "Unknown error";
          return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
        }
      }) as any
    );
  }

  // upload_receipt_from_path — MCP-only (local file system access required)
  server.tool(
    "upload_receipt_from_path",
    "Upload a receipt from a local file path and attach it to an expense. The file stays on your machine and is referenced by its local path. Supports JPEG, PNG, PDF, WebP.",
    UploadReceiptFromPathInput.shape,
    (async (args: Record<string, unknown>) => {
      const userId = resolveLocalUser();
      if (!userId) {
        return { content: [{ type: "text", text: NOT_CONFIGURED }], isError: true };
      }

      const input = UploadReceiptFromPathInput.parse(args);

      try {
        const result = await uploadReceiptFromPath(input, createLedgerStore(), userId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    }) as any
  );

  return server;
}

const NOT_CONFIGURED = "Error: No local user configured. Set CLARIO_USER_ID in your .env.";

/** The local-first identity: the single user this device acts as. */
function resolveLocalUser(): string | undefined {
  return process.env.CLARIO_USER_ID || undefined;
}

export async function startStdioMcpServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Clario MCP server running on stdio");
}
