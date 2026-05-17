/**
 * Clario API — entry point
 *
 * TRANSPORT=stdio  → MCP server over stdio (Claude Desktop local connection)
 * TRANSPORT=http   → HTTP server (MCP-over-HTTP + OpenAPI for ChatGPT)
 *
 * One codebase, two transports, same tool logic.
 */

import "dotenv/config"; // load .env

const transport = process.env.TRANSPORT ?? "http";

if (transport === "stdio") {
  // ── MCP stdio mode (Claude Desktop) ──────────────────────────────────────
  // Used when running locally: `npm run start:mcp`
  // Claude Desktop config:
  // {
  //   "mcpServers": {
  //     "clario": {
  //       "command": "node",
  //       "args": ["/path/to/clario-api/dist/index.js"],
  //       "env": { "TRANSPORT": "stdio", "SUPABASE_URL": "...", ... }
  //     }
  //   }
  // }
  const { startStdioMcpServer } = await import("./mcp/adapter.ts");
  await startStdioMcpServer();
} else {
  // ── HTTP mode (Railway/Fly free tier deployment) ──────────────────────────
  // Serves both:
  //   POST /api/tools/{name}  — OpenAPI endpoints (ChatGPT Actions)
  //   GET  /api/openapi.json  — OpenAPI spec (paste URL into Custom GPT)
  //   GET  /health            — health check
  //
  // Future: add MCP-over-HTTP transport here for remote Claude connections
  const { serve } = await import("@hono/node-server");
  const { createOpenApiRouter } = await import("./openapi/routes.ts");

  const app = createOpenApiRouter();
  const port = Number(process.env.PORT ?? 3000);

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Clario API running on http://localhost:${info.port}`);
    console.log(`  OpenAPI spec: http://localhost:${info.port}/api/openapi.json`);
    console.log(`  Health:       http://localhost:${info.port}/health`);
    console.log("\nFor ChatGPT Actions, paste the OpenAPI spec URL into your Custom GPT.");
    console.log("For Claude Desktop, set TRANSPORT=stdio and update claude_desktop_config.json.");
  });
}
