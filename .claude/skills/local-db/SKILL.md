---
name: local-db
description: Handle database schema changes with Drizzle and PlanetScale (MySQL). Use when making schema changes to src/db/schema.ts, adding/modifying database tables or columns, or when asked about database migrations. Covers the push-based development workflow and when to generate migrations.
---

# Local Database Workflow

This project uses a **push-based workflow** for local development to avoid migration file conflicts.

## Local Development: Use `db:push`

When making schema changes during development:

```bash
# 1. Edit src/db/schema.ts
# 2. Push changes to PlanetScale dev branch
pnpm db:push
```

This applies schema changes directly without generating migration files. No `_journal.json` conflicts.

## When to Generate Migrations

Generate migrations **only when ready to merge to main**:

```bash
# 1. Sync with main first
git fetch origin main
git rebase origin/main

# 2. Reset local DB to match main's migrations (if needed)
pnpm db:setup-local

# 3. Generate a single migration for all schema changes
pnpm db:generate --name=your-feature-name

# 4. Apply locally to verify
pnpm db:migrate:local

# 5. Commit migration files and merge
```

## Key Commands

| Command | When to Use |
|---------|-------------|
| `pnpm db:push` | Local development - apply schema changes |
| `pnpm db:generate --name=X` | Before merging - create migration file |
| `pnpm db:migrate:local` | Apply migrations locally |
| `pnpm db:studio` | Browse local database |

## Important Notes

- **Never commit migrations during active development** - only at merge time
- **Always rebase/merge main before generating** - prevents `_journal.json` conflicts
- **One migration per feature** - consolidates changes into a single file
- **Test migrations locally** - run `db:migrate:local` before pushing
- **CI/CD handles production** - never run migrations manually against prod
