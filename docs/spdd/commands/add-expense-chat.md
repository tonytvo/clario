# SPDD Command: add-expense-chat

## CONTEXT

Clario monorepo. The API layer is fully implemented:
- `packages/api/src/tools/handlers.ts` — 6 handlers incl. `addExpense`, `getExpenses`
- `packages/api/src/openapi/routes.ts` — REST at `POST /api/tools/{tool_name}`, Bearer JWT auth
- `packages/api/src/tools/schemas.ts` — Zod schemas (canonical type definitions)
- `packages/shared/src/types.ts` — TS types mirroring the Zod schemas (no zod dep in web)

The web app (`apps/web`) has:
- `src/components/chat/ExpenseChat.jsx` — chat UI using **mock data only**
- `src/lib/supabase/client.ts` — Supabase browser client (needs env vars)
- No page files, no API client, no package.json yet (will be created separately)

Domain ubiquitous language:
- **expense** — a payment one person made on behalf of a group
- **split** — each person's share of an expense
- **settled** — a split that has been repaid
- **transcript** — natural language input that describes an expense (e.g. "I paid $60 for dinner")

## TASK

Scaffold the first feature: **Add Expense via Chat** (natural language → form → API).

### User flow

1. User types a "transcript" in the chat:
   `"I paid $60 for dinner last night, split 3 ways"`
   or just `"add expense"`
2. Chat detects the **add-expense intent**
3. Chat replies with an inline `AddExpenseForm` pre-filled from parsed values
4. User reviews/edits: title, amount, date, category, split (N ways)
5. User submits → `POST /api/tools/add_expense`
6. Chat shows success message with the split breakdown
7. If `NEXT_PUBLIC_API_URL` is unset → use mock success (dev mode)

### Intent detection rules (in `parseIntent`)

Match as add-expense if:
- Starts with `add`, `log`, `record`, `create` (followed by expense/purchase/payment)
- Starts with `I paid`, `I spent`, `I bought`, `spent`, `paid`
- Contains `add expense` anywhere

### Prefill parsing (best-effort, no external deps)

From the message extract:
- **amount** — first `$\d+` or `\d+ dollars`
- **title** — text after `for` or `on`, before `with`/`last`/`split`/EOL
- **date** — "yesterday"/"last night" → yesterday's ISO date; "today" → today

## CONSTRAINTS

- Do NOT disable Row Level Security on any table
- Do NOT hardcode user IDs or secrets
- Do NOT store receipt bytes (that's a separate feature)
- Keep every component/hook file under 150 lines — split if larger
- Form inputs must have labels (accessibility)
- New files use `.tsx` extension; `ExpenseChat.jsx` stays `.jsx` (only logic changes)
- Mock data in `ExpenseChat.jsx` stays behind `DEV_MODE` constant (delete in final refakts)
- Follow biome rules: no unused imports, no explicit `any`, double quotes, 2-space indent

## OUTPUT

Produce in this order:

1. `packages/shared/src/types.ts` — shared domain types
2. `packages/shared/src/index.ts` — barrel export
3. `packages/shared/package.json` — minimal package descriptor
4. `apps/web/package.json` — Next.js 14, React 18, @supabase/ssr
5. `apps/web/next.config.ts` — minimal Next.js config
6. `apps/web/tsconfig.json` — standalone TS config with path alias `@/*`
7. `apps/web/src/app/layout.tsx` — root layout (DM Sans font, metadata)
8. `apps/web/src/app/page.tsx` — renders `<ExpenseChat />`
9. `apps/web/src/lib/api.ts` — typed `callTool<T>` fetch wrapper
10. `apps/web/src/hooks/useAddExpense.ts` — mutation hook (real + mock mode)
11. `apps/web/src/components/expense/AddExpenseForm.tsx` — inline form (<150 lines)
12. `apps/web/src/components/chat/ExpenseTable.tsx` — extracted from ExpenseChat
13. Update `apps/web/src/components/chat/ExpenseChat.jsx`:
    - Add `"use client"` directive
    - Import `AddExpenseForm` and `ExpenseTable` from their new locations
    - Add `parseIntent` function (replaces inline intent check)
    - In `send()`: if add-expense intent → push assistant message with `form: "add_expense"`
    - In `Message`: render `<AddExpenseForm>` when `msg.form === "add_expense"`
    - On form success: push success message with split table into chat

## VERIFY

```bash
# Install deps first (if not done)
npm install

# Type check the web app
cd apps/web && npx tsc --noEmit

# Start the dev server
npm run dev   # from repo root → starts Next.js on :3000

# Manual smoke test:
# 1. Open http://localhost:3000
# 2. Type "add expense $50 dinner" → see AddExpenseForm appear in chat
# 3. Submit → see success message with mock split breakdown
# 4. Type "show all expenses" → see expense table (mock data)
```

After API is wired (Supabase set up):
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001 npm run dev
# Submitting form now makes a real POST /api/tools/add_expense
```
