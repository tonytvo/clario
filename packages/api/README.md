# Clario API

> Dual-spec API server: **MCP** (Claude) + **OpenAPI** (ChatGPT Actions) from one codebase.
> One set of tool handlers, two adapters, one local-first ledger.

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
  domain/           ← Business rules + authorization (recordExpense, allocateEqual)
  ports/
    ledgerStore.ts  ← Technology-neutral persistence port
  adapters/
    localLedgerStore.ts ← In-memory / JSON-file ledger (CRDT adapter later)
    factory.ts      ← Selects the LedgerStore implementation
  index.ts          ← Entry point — stdio MCP or HTTP server
```

Adding a new tool = add a schema + handler. Both adapters pick it up automatically.

**Status:** `add_expense` runs on the local ledger. `get_expenses`, `get_balances`,
`settle_up`, `get_groups`, `attach_receipt` and `upload_receipt_from_path` are
**stubs** — they return empty or placeholder results and persist nothing until
their slices of the local-first ledger are built.

---

## Quick start (dev)

```bash
cp .env.example .env   # set CLARIO_USER_ID (and optionally LEDGER_FILE)
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
        "CLARIO_USER_ID": "your-local-user-uuid",
        "LEDGER_FILE": "/absolute/path/to/clario-ledger.json"
      }
    }
  }
}
```

Then restart Claude Desktop. Clario tools appear automatically.

---

## Connecting to ChatGPT

ChatGPT Actions need a public HTTPS URL, so expose your local server through a
tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) and set
`PUBLIC_API_URL` to the tunnel URL.

1. Run `npm run dev` and start the tunnel
2. Go to [chat.openai.com](https://chat.openai.com) → Explore GPTs → Create
3. In **Configure**:
   - Name: `Clario`
   - Instructions: *(paste the system prompt from docs/gpt-system-prompt.md)*
4. Click **Add actions** → paste: `https://your-tunnel-url/api/openapi.json`
5. ChatGPT reads the spec automatically and configures all tool endpoints
6. Under **Authentication**: API Key (header `X-API-Key`) → paste your `API_SECRET_KEY`

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
export async function myNewTool(input, store, userId) { ... }
```

4. Register in `HANDLERS` map in both `src/mcp/adapter.ts` and `src/openapi/routes.ts`.

Both Claude and ChatGPT pick up the new tool automatically on next restart.

---

## Running tests

```bash
npm test
```

Tests run against in-memory ledgers — no database needed for CI.

---

## Quality checks

```bash
npm run quality   # lint + typecheck
npm test          # unit tests
```
