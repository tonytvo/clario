# Contributing to Clario

Clario is built using **Structured Prompt Driven Development (SPDD)** — meaning AI does most of the scaffolding, and humans review. You don't need to write code from scratch to contribute.

## Ways to contribute

- Report a bug → open an issue using the bug template
- Request a feature → open an issue using the feature template
- Fix a bug or add a feature → follow the AI workflow below
- Improve documentation → edit any `.md` file and open a PR

---

## AI-assisted contribution workflow

### 1. Pick an issue

Find an open issue tagged `good first issue` or `help wanted`.

### 2. Use the SPDD command

Open Claude Code (or any AI) in the repo root and run:

```bash
claude /feature "implement [issue description from GitHub]"
```

Or manually paste `docs/spdd/commands/add-feature.md` into Claude/ChatGPT/Cursor and describe what you want.

### 3. Review the output

AI produces the code. You review it:
- Does it follow the existing patterns?
- Does it respect user privacy (no files stored on our server)?
- Does RLS protect the new data?

### 4. Run quality checks

```bash
npm run quality
```

Fix anything flagged. AI can help with this too — paste the error output.

### 5. Open a pull request

Push your branch and open a PR. The template will guide you through what to describe.

---

## Code conventions

- **Hooks**: `use[Verb][Noun].ts` in `apps/web/src/hooks/`
- **Components**: `PascalCase.tsx` in `apps/web/src/components/[feature]/`
- **SQL**: snake_case, RLS on every table, migrations numbered `NNN_description.sql`
- **Secrets**: never in code — always in `.env` (which is gitignored)
- **Receipts**: files always go to user's Google Drive — never to our server

## Quality tools

| Tool | Purpose | Command |
|---|---|---|
| Biome | Lint + format | `npm run lint` / `npm run format` |
| Knip | Dead code / unused exports | `npm run refactor:check` |
| TypeScript | Type safety | `npm run typecheck` |
| All together | `npm run quality` | Run before every PR |

---

## Project philosophy

This project exists to be free forever. Every decision should ask:
- Does this add a cost someone has to pay?
- Does this store data we don't need to store?
- Does this make it harder for a non-technical person to use?

If the answer to any of these is yes, look for another approach.
