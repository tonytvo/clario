# Clario API

> Dual-spec API server: **MCP** (Claude) + **OpenAPI** (ChatGPT Actions) from one codebase.
> One set of tool handlers, two adapters, one Supabase backend.

---

## Architecture

```
src/
  tools/
    schemas.ts      ← Zod schemas — SINGLE SOURCE OF TRUTH for all tools
    handlers.ts     ← Business logic — called by BOTH adapters
  mcp/
    adapter.ts      ← MCP adapter (wraps handlers as MCP tools)
  openapi/
    routes.ts       ← Hono routes (wraps handlers as REST endpoints)
  lib/
    supabase.ts     ← Supabase client factory
  index.ts          ← Entry point — stdio MCP or HTTP server
```

Adding a new tool = add a schema + handler. Both adapters pick it up automatically.

---

## Quick start (dev)

```bash
cp .env.example .env   # fill in Supabase keys
npm install
npm run dev            # HTTP server on :3000
```

Test endpoints:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/openapi.json   # OpenAPI spec
```

---

## Connecting to Claude

### Option A: Claude Desktop (local stdio, free)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "clario": {
      "command": "node",
      "args": ["/absolute/path/to/clario-api/dist/index.js"],
      "env": {
        "TRANSPORT": "stdio",
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-key"
      }
    }
  }
}
```

Then restart Claude Desktop. Clario tools appear automatically.

### Option B: Remote MCP server (Claude.ai web)

Deploy to Railway (free tier), then in Claude.ai:
Settings → Integrations → Add MCP server → paste your Railway URL.

---

## Connecting to ChatGPT

1. Deploy to Railway (see below) — get your public URL
2. Go to [chat.openai.com](https://chat.openai.com) → Explore GPTs → Create
3. In **Configure**:
   - Name: `Clario`
   - Instructions: *(paste the system prompt from docs/gpt-system-prompt.md)*
4. Click **Add actions** → paste: `https://your-app.railway.app/api/openapi.json`
5. ChatGPT reads the spec automatically and configures all tool endpoints
6. Under **Authentication**: API Key → paste your `API_SECRET_KEY`
7. Save and share the GPT link with your group

---

## Deploy for free (Railway)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login + deploy
railway login
railway init
railway up

# Set environment variables
railway variables set SUPABASE_URL=https://...
railway variables set SUPABASE_SERVICE_ROLE_KEY=...
railway variables set API_SECRET_KEY=$(openssl rand -hex 32)
railway variables set TRANSPORT=http
```

Railway free tier: 500 hours/month — enough for a small group's expense tracker.

---

## Adding a new tool

1. Add Zod schemas to `src/tools/schemas.ts`:
```ts
export const MyNewInput = z.object({ ... });
export const MyNewOutput = z.object({ ... });
```

2. Add to `TOOL_REGISTRY` in the same file:
```ts
{
  name: "my_new_tool",
  description: "...",
  inputSchema: MyNewInput,
  outputSchema: MyNewOutput,
}
```

3. Add the handler to `src/tools/handlers.ts`:
```ts
export async function myNewTool(input, supabase, userId) { ... }
```

4. Register in `HANDLERS` map in both `src/mcp/adapter.ts` and `src/openapi/routes.ts`.

Both Claude and ChatGPT pick up the new tool automatically on next deploy.

---

## Running tests

```bash
npm test
```

Tests mock Supabase — no real DB needed for CI.

---

## Quality checks

```bash
npm run quality   # lint + typecheck
npm test          # unit tests
```
