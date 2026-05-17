# SPDD Command: add-feature

## CONTEXT

Clario is a Next.js 14 monorepo (apps/web) with:
- Supabase backend (Postgres + Auth + Realtime)
- Google Drive for receipt storage (users own their files)
- shadcn/ui + Tailwind for UI
- Biome for linting/formatting, Knip for dead code detection
- All database access goes through Row Level Security policies
- TypeScript strict mode throughout

Key files:
- `apps/web/src/lib/supabase/client.ts` — Supabase browser client
- `packages/db/supabase/migrations/` — SQL migrations
- `apps/web/src/hooks/` — React hooks
- `apps/web/src/components/` — UI components

## TASK

Add the following feature to Clario:

**[DESCRIBE FEATURE HERE]**

## CONSTRAINTS

- Do NOT disable Row Level Security on any table
- Do NOT store file bytes in Supabase Storage — receipt files go to Google Drive only
- Do NOT hardcode any secrets or keys
- Keep components under 150 lines — split if larger
- Every new DB table must have RLS enabled and policies defined
- Follow existing naming conventions (camelCase hooks, PascalCase components)
- Run `npm run quality` before finishing — fix all errors

## OUTPUT

Produce in this order:
1. SQL migration file (if schema changes needed)
2. TypeScript types (update packages/shared/src if needed)
3. Hook(s) in apps/web/src/hooks/
4. Component(s) in apps/web/src/components/[feature]/
5. Page/route if needed
6. Update README if the feature is user-facing

## VERIFY

After changes:
```bash
npm run quality          # lint + typecheck + dead code
npm run db:types         # regenerate types from schema
npm run dev              # smoke test in browser
```

Expected: no lint errors, no type errors, no unused exports flagged by Knip.
