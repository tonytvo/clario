/**
 * MCP adapter — exposes all tool handlers as MCP tools.
 *
 * When transport = stdio:  Claude Desktop connects directly (local)
 * When transport = http:   Claude connects via HTTP (remote MCP server)
 *
 * The adapter:
 *   1. Reads user identity from the MCP session (set during OAuth or API key exchange)
 *   2. Creates a Supabase client scoped to that user
 *   3. Calls the shared handler
 *   4. Returns the result as MCP tool content
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { TOOL_REGISTRY } from "../tools/schemas.ts";
import {
  getExpenses,
  addExpense,
  getBalances,
  settleUp,
  getGroups,
  attachReceipt,
} from "../tools/handlers.ts";
import { createUserClient, getUserIdFromJwt } from "../lib/supabase.ts";

// Map tool name → handler function
const HANDLERS: Record<string, Function> = {
  get_expenses: getExpenses,
  add_expense: addExpense,
  get_balances: getBalances,
  settle_up: settleUp,
  get_groups: getGroups,
  attach_receipt: attachReceipt,
};

export function createMcpServer() {
  const server = new McpServer({
    name: "clario",
    version: "0.1.0",
  });

  // Register every tool from the shared registry
  for (const tool of TOOL_REGISTRY) {
    server.tool(
      tool.name,
      tool.description,
      // MCP SDK accepts JSON Schema for tool inputs
      zodToJsonSchema(tool.inputSchema, { $refStrategy: "none" }) as any,
      async (args: Record<string, unknown>, extra: { meta?: { jwt?: string } }) => {
        // Validate input with Zod
        const input = tool.inputSchema.parse(args);

        // Get user identity from session metadata
        // In MCP-over-HTTP, the JWT is passed in the session
        const jwt = extra?.meta?.jwt;
        if (!jwt) {
          return {
            content: [{ type: "text", text: "Error: Not authenticated. Please sign in first." }],
            isError: true,
          };
        }

        const userId = getUserIdFromJwt(jwt);
        const supabase = createUserClient(jwt);

        try {
          const handler = HANDLERS[tool.name];
          const result = await handler(input, supabase, userId);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}

// Start the MCP server over stdio (for Claude Desktop local connection)
export async function startStdioMcpServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Clario MCP server running on stdio"); // stderr so it doesn't pollute MCP protocol
}
