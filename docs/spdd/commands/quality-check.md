# SPDD Command: quality-check

## CONTEXT

Clario uses these quality tools:
- **Biome** — linting + formatting (replaces ESLint + Prettier)
- **Knip** — dead code and unused exports detection (refaktoring assistant)
- **TypeScript** — strict mode type checking

## TASK

Run the full quality pipeline and fix all reported issues.

```bash
npm run quality
```

This runs: `biome lint` → `tsc --build` → `knip`

## PROCESS

For each tool's output:

### Biome errors
- Fix formatting issues with `npm run format`
- Fix lint errors manually (do not use `// biome-ignore` unless truly unavoidable)
- Common fixes: remove unused imports, fix type assertions, add missing return types

### TypeScript errors
- Fix type errors — do NOT use `@ts-ignore` or `any` except as last resort
- If a type is missing, add it to `packages/shared/src/`

### Knip warnings
- Unused exports → remove the export or the file
- Unused dependencies → remove from package.json
- Unlisted dependencies → add to package.json

## CONSTRAINTS

- Do not suppress warnings without fixing the root cause
- Do not widen types to avoid errors
- If a Knip false-positive is unavoidable, add to `knip.config.ts` with a comment

## OUTPUT

A codebase that passes `npm run quality` with zero errors or warnings.

## VERIFY

```bash
npm run quality
# Expected: process exits 0
```
