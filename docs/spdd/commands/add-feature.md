# SPDD Command: add-feature

## CONTEXT

Clario is a Next.js 14 monorepo (apps/web) with:
- Local-first data: everything lives on-device and works offline (CRDT sync engine TBD)
- Persistence behind technology-neutral ports (`packages/api/src/ports/`) — no database client in domain code
- Receipts stay user-owned (storage mechanism TBD)
- shadcn/ui + Tailwind for UI
- Biome for linting/formatting, Knip for dead code detection
- Authorization is enforced in the domain layer (`packages/api/src/domain/`)
- TypeScript strict mode throughout

Key files:
- `packages/api/src/ports/ledgerStore.ts` — persistence port
- `packages/api/src/adapters/` — local-first adapters behind the port
- `packages/api/src/domain/` — business rules and authorization
- `apps/web/src/hooks/` — React hooks
- `apps/web/src/components/` — UI components

## TASK

Add the following feature to Clario:

**[DESCRIBE FEATURE HERE]**

## CONSTRAINTS

- Do NOT add a cloud backend or a database client to domain code — extend the port and the local adapter
- Do NOT store receipt file bytes on our side — receipts stay user-owned
- Do NOT hardcode any secrets or keys
- Keep components under 150 lines — split if larger
- Every new write path must check group membership in the domain layer, with tests
- Follow existing naming conventions (camelCase hooks, PascalCase components)
- Run `npm run quality` before finishing — fix all errors

## OUTPUT

Produce in this order:
1. Port/adapter changes (if persistence changes needed)
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
