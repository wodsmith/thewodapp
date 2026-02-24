# Fix E2E Tests After PlanetScale Migration - Implementation Plan

## Task Breakdown

### Stream A: Seed Infrastructure (db.ts, helpers.ts, cleanup.ts, index.ts, all seeders)
Switch from `@planetscale/database` Client to `mysql2/promise` Connection.
- `scripts/seed/db.ts` — rewrite to use `mysql2/promise`, export `createClient()` + `closeClient()`
- `scripts/seed/helpers.ts` — change `Client` type to `mysql2.Connection`, fix `now()` to return datetime string
- `scripts/seed/cleanup.ts` — change `Client` type to `mysql2.Connection`
- `scripts/seed/index.ts` — change `Client` type, add `closeClient()` call
- All 13 seeders in `scripts/seed/seeders/` — change `Client` type import

### Stream B: E2E Seed Script (new file)
Create `scripts/seed-e2e.ts` — TypeScript E2E seeder using `mysql2` and `batchInsert`.
Convert from `scripts/seed-e2e.sql` (SQLite syntax) to MySQL-compatible TypeScript.

### Stream C: GitHub Actions Workflow
Rewrite `.github/workflows/e2e.yaml`:
- Add MySQL 8.0 service container
- Remove D1 migration check and `has_migrations` conditionals
- Remove synthetic wrangler D1 config
- Add `DATABASE_URL` to `.dev.vars`
- Run `drizzle-kit push` + seed commands

### Stream D: Setup Scripts & Cleanup
- Rewrite `scripts/setup-e2e-db.ts` — use `drizzle-kit push` + TS seeders
- Update `e2e/global-setup.ts` — pass `DATABASE_URL`
- Update `package.json` — change `db:seed:e2e` script
- Delete stale files: `src/db/migrations/`, `scripts/seed.sql`, `scripts/seed-e2e.sql`, `scripts/seed-all.sh`
