/**
 * OpenAPI adapter — Hono routes that expose tool handlers as REST endpoints.
 *
 * ChatGPT calls these endpoints when the user invokes a GPT Action.
 * Each route:
 *   1. Validates the API key (set in the Custom GPT's auth settings)
 *   2. Acts as the local user (CLARIO_USER_ID) — Clario is local-first, no accounts
 *   3. Validates the request body with Zod
 *   4. Calls the shared handler
 *   5. Returns JSON
 *
 * URL pattern: POST /api/tools/{tool_name}
 * Auth:        X-API-Key <api_secret_key>
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { TOOL_REGISTRY } from "../tools/schemas.ts";
import {
  getExpenses,
  addExpense,
  getBalances,
  settleUp,
  getGroups,
  attachReceipt,
  type ToolHandler,
} from "../tools/handlers.ts";
import { createLedgerStore } from "../adapters/factory.ts";
import { DomainError } from "../domain/errors.ts";

type Env = {
  Variables: {
    userId: string;
  };
};

const HANDLERS: Record<string, ToolHandler> = {
  get_expenses: getExpenses,
  add_expense: addExpense,
  get_balances: getBalances,
  settle_up: settleUp,
  get_groups: getGroups,
  attach_receipt: attachReceipt,
};

export function createOpenApiRouter() {
  const app = new Hono<Env>();

  // ── CORS (allow ChatGPT to call us) ────────────────────────
  app.use(
    "/api/*",
    cors({
      origin: (process.env.ALLOWED_ORIGINS ?? "https://chat.openai.com,https://chatgpt.com").split(","),
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "X-API-Key"],
    })
  );

  // ── Auth middleware ─────────────────────────────────────────
  app.use("/api/tools/*", async (c, next) => {
    const expectedKey = process.env.API_SECRET_KEY;
    if (!expectedKey || c.req.header("X-API-Key") !== expectedKey) {
      throw new HTTPException(401, { message: "Authentication required. Provide a valid X-API-Key." });
    }

    const userId = process.env.CLARIO_USER_ID;
    if (!userId) {
      throw new HTTPException(500, { message: "No local user configured. Set CLARIO_USER_ID." });
    }
    c.set("userId", userId);
    return next();
  });

  // ── Tool routes ─────────────────────────────────────────────
  for (const tool of TOOL_REGISTRY) {
    app.post(`/api/tools/${tool.name}`, async (c) => {
      const userId = c.get("userId");

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        body = {};
      }

      // Validate with Zod
      let input: unknown;
      try {
        input = tool.inputSchema.parse(body);
      } catch (err) {
        if (err instanceof ZodError) {
          return c.json({ error: "Validation error", details: err.flatten() }, 400);
        }
        throw err;
      }

      try {
        const handler = HANDLERS[tool.name];
        const result = await handler(input, createLedgerStore(), userId);
        return c.json(result);
      } catch (err) {
        if (err instanceof DomainError) {
          const status = err.code === "NOT_A_MEMBER" ? 403 : 400;
          return c.json({ error: err.message, code: err.code }, status);
        }
        const message = err instanceof Error ? err.message : "Internal server error";
        console.error(`[${tool.name}] Error:`, err);
        return c.json({ error: message }, 500);
      }
    });
  }

  // ── OpenAPI spec endpoint (ChatGPT reads this to understand the API) ─────
  app.get("/api/openapi.json", (c) => {
    const spec = generateOpenApiSpec();
    return c.json(spec);
  });

  // ── Health check ────────────────────────────────────────────
  app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0" }));

  return app;
}

// ── OpenAPI spec generator ──────────────────────────────────────────────────
// Auto-generated from the same TOOL_REGISTRY — stays in sync automatically.

function generateOpenApiSpec() {
  const baseUrl = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

  const paths: Record<string, any> = {};

  for (const tool of TOOL_REGISTRY) {
    paths[`/api/tools/${tool.name}`] = {
      post: {
        operationId: tool.name,
        summary: tool.description,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              // ChatGPT uses this schema to understand what to send
              schema: zodSchemaToOpenApi(tool.inputSchema),
            },
          },
        },
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: zodSchemaToOpenApi(tool.outputSchema),
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Authentication required" },
          "500": { description: "Internal server error" },
        },
        security: [{ apiKey: [] }],
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Clario API",
      description: "Expense splitting API. Used by Claude (via MCP) and ChatGPT (via Actions).",
      version: "0.1.0",
    },
    servers: [{ url: baseUrl }],
    paths,
    components: {
      securitySchemes: {
        apiKey: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "API key set in your Custom GPT's authentication settings.",
        },
      },
    },
  };
}

function zodSchemaToOpenApi(schema: any): any {
  return zodToJsonSchema(schema, { $refStrategy: "none" });
}
