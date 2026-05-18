/**
 * OpenAPI adapter — Hono routes that expose tool handlers as REST endpoints.
 *
 * ChatGPT calls these endpoints when the user invokes a GPT Action.
 * Each route:
 *   1. Validates the API key (set in the Custom GPT's auth settings)
 *   2. Extracts the Supabase JWT from the Authorization header
 *   3. Validates the request body with Zod
 *   4. Calls the shared handler
 *   5. Returns JSON
 *
 * URL pattern: POST /api/tools/{tool_name}
 * Auth:        Bearer <supabase_jwt>   OR   X-API-Key <api_secret_key>
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
} from "../tools/handlers.ts";
import { createUserClient, getUserIdFromJwt } from "../lib/supabase.ts";

type Env = {
  Variables: {
    jwt: string;
    userId: string;
  };
};

const HANDLERS: Record<string, Function> = {
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
      allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    })
  );

  // ── Auth middleware ─────────────────────────────────────────
  app.use("/api/tools/*", async (c, next) => {
    const authHeader = c.req.header("Authorization");
    const apiKey = c.req.header("X-API-Key");
    const expectedKey = process.env.API_SECRET_KEY;

    // Option 1: API key auth (for ChatGPT Actions — simple and reliable)
    if (apiKey && expectedKey && apiKey === expectedKey) {
      // When using API key, the Supabase JWT is expected as a separate header
      const jwt = c.req.header("X-Supabase-JWT");
      if (!jwt) {
        throw new HTTPException(401, { message: "X-Supabase-JWT header required with API key auth" });
      }
      c.set("jwt", jwt);
      c.set("userId", getUserIdFromJwt(jwt));
      return next();
    }

    // Option 2: Bearer JWT (Supabase JWT directly)
    if (authHeader?.startsWith("Bearer ")) {
      const jwt = authHeader.slice(7);
      c.set("jwt", jwt);
      c.set("userId", getUserIdFromJwt(jwt));
      return next();
    }

    throw new HTTPException(401, { message: "Authentication required. Provide Bearer JWT or X-API-Key." });
  });

  // ── Tool routes ─────────────────────────────────────────────
  for (const tool of TOOL_REGISTRY) {
    app.post(`/api/tools/${tool.name}`, async (c) => {
      const jwt = c.get("jwt") as string;
      const userId = c.get("userId") as string;
      const supabase = createUserClient(jwt);

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
        const result = await handler(input, supabase, userId);
        return c.json(result);
      } catch (err) {
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-api.railway.app";

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
