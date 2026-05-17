# SPDD Commands for Clario

This directory contains structured prompts for AI-assisted development.
Each `.md` file is a reusable command template that Claude Code (or any AI)
can execute to perform a well-defined task on this codebase.

## How to use

With Claude Code:
```bash
claude "$(cat docs/spdd/commands/add-expense-category.md)"
```

Or paste the contents into any AI chat.

## Available commands

| Command | Purpose |
|---|---|
| `add-feature.md` | Scaffold a new feature end-to-end |
| `refactor-component.md` | Refactor a React component using Knip + Biome |
| `add-migration.md` | Add a new Supabase migration with RLS |
| `quality-check.md` | Run full quality pipeline and fix issues |
| `write-test.md` | Write tests for a given module |

## Conventions

Every command follows the SPDD format from [open-spdd](https://github.com/gszhangwei/open-spdd):

```
CONTEXT: what the codebase looks like
TASK: what to do
CONSTRAINTS: what not to break
OUTPUT: what to produce
VERIFY: how to check it worked
```
