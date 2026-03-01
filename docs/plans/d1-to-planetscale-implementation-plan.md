# D1 to PlanetScale Migration - Wholesale Replacement

## Overview

Direct cutover migration from Cloudflare D1 (SQLite) to PlanetScale (MySQL/Vitess). No dual-write phase - simple maintenance window migration.

**Strategy:** Schema conversion → ETL scripts → Maintenance mode → Migrate → Deploy → Done

---

## Phase 1: Schema Conversion (Parallelizable)

Convert all 21 Drizzle schema files from sqlite-core to mysql-core.

### 1.1 Foundation (Must Complete First)

**File: `src/db/schemas/common.ts`** ✅ DONE
- Import `ulid` instead of CUID2
- Import from `drizzle-orm/mysql-core`
- Convert `commonColumns` to MySQL datetime
- All ID generators use ULID

### 1.2 Schema Files (Parallel After 1.1)

Convert each file: `sqliteTable` → `mysqlTable`, `text()` → `varchar()`, etc.

| File | Priority | Dependencies |
|------|----------|--------------|
| `users.ts` | High | common.ts |
| `teams.ts` | High | common.ts |
| `competitions.ts` | High | common.ts |
| `workouts.ts` | High | common.ts |
| `scores.ts` | High | common.ts |
| `billing.ts` | Medium | common.ts |
| `commerce.ts` | Medium | common.ts |
| `programming.ts` | Medium | common.ts |
| `scaling.ts` | Medium | common.ts |
| `scheduling.ts` | Medium | common.ts |
| `entitlements.ts` | Medium | common.ts |
| `affiliates.ts` | Low | common.ts |
| `sponsors.ts` | Low | common.ts |
| `waivers.ts` | Low | common.ts |
| `volunteers.ts` | Low | common.ts |
| `video-submissions.ts` | Low | common.ts |
| `notifications.ts` | Low | common.ts |
| `event-resources.ts` | Low | common.ts |
| `judging-sheets.ts` | Low | common.ts |
| `organizer-requests.ts` | Low | common.ts |
| `registration-questions.ts` | Low | common.ts |

### 1.3 Type Mapping Reference

| SQLite | MySQL |
|--------|-------|
| `sqliteTable` | `mysqlTable` |
| `text()` | `varchar({ length: 255 })` |
| `text({ length: N })` | `varchar({ length: N })` (if N <= 65535) |
| `text({ mode: 'json' })` | `json()` |
| `integer()` | `int()` |
| `integer({ mode: 'boolean' })` | `boolean()` |
| `integer({ mode: 'timestamp' })` | `datetime()` |

---

## Phase 2: Infrastructure (Parallel with Phase 1)

### 2.1 Dependencies

```bash
cd apps/wodsmith-start && pnpm add mysql2 ulid
```

### 2.2 Hyperdrive Configuration

**File: `wrangler.jsonc`**
```jsonc
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "<your-hyperdrive-config-id>"
    }
  ]
}
```

### 2.3 Alchemy Resources

**File: `alchemy.run.ts`**
```typescript
import { Hyperdrive } from "alchemy/cloudflare"

const hyperdrive = await Hyperdrive("wodsmith-hyperdrive", {
  origin: {
    host: process.env.PLANETSCALE_HOST!,
    port: 3306,
    database: "wodsmith-db",
    user: process.env.PLANETSCALE_USER!,
    password: alchemy.secret(process.env.PLANETSCALE_PASSWORD!),
  },
  adopt: true,
})

// Add to bindings
bindings: {
  HYPERDRIVE: hyperdrive,
}
```

### 2.4 Database Connection

**File: `src/db/index.ts`**
```typescript
import { env } from "cloudflare:workers"
import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import * as schema from "./schema"

let connectionPool: mysql.Pool | null = null

export const getDb = () => {
  if (!env.HYPERDRIVE) {
    throw new Error('Hyperdrive binding "HYPERDRIVE" not found.')
  }

  if (!connectionPool) {
    connectionPool = mysql.createPool({
      uri: env.HYPERDRIVE.connectionString,
      connectionLimit: 1,
      ssl: { rejectUnauthorized: false },
    })
  }

  return drizzle(connectionPool, { schema, mode: "default" })
}
```

### 2.5 Drizzle Config

**File: `drizzle.config.ts`**
```typescript
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  out: "./src/db/mysql-migrations",
  schema: "./src/db/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

---

## Phase 3: Raw SQL Updates (After Schema Conversion)

Files using raw SQL that need MySQL syntax:

| File | Changes Needed |
|------|----------------|
| `src/server/notifications/submission-window.ts` | Date functions |
| `src/server-fns/competition-detail-fns.ts` | String concatenation |
| `src/server-fns/admin-team-fns.ts` | Query syntax |
| `src/server/registration.ts` | Date functions |
| `src/server-fns/competition-divisions-fns.ts` | Query syntax |
| `src/server-fns/workout-fns.ts` | Pagination, dates |
| `src/server/workouts.ts` | Pagination, dates |
| `src/server/commerce/fee-calculator.ts` | Query syntax |

**SQL Syntax Changes:**
- `strftime('%Y-%m-%d', col)` → `DATE_FORMAT(col, '%Y-%m-%d')`
- `col1 || col2` → `CONCAT(col1, col2)`
- `datetime('now')` → `NOW()`
- `OFFSET` pagination → Cursor-based pagination

---

## Phase 4: ETL Scripts

### 4.1 Extract Script

**File: `scripts/migration/extract-d1.ts`**
- Read all tables from local D1 database
- Export to JSON files with table order for dependencies
- Output to `scripts/migration/extracted-data/`

### 4.2 Transform Script

**File: `scripts/migration/transform-data.ts`**
- Convert epoch timestamps → UTC ISO 8601 datetime strings
- Convert integer booleans → actual booleans
- Validate JSON fields parse correctly

### 4.3 Load Script

**File: `scripts/migration/load-planetscale.ts`**
- Disable FK checks during import
- Insert data in dependency order
- Batch inserts (1000 rows per batch)

### 4.4 Verify Script

**File: `scripts/migration/verify-migration.ts`**
- Compare row counts D1 vs PlanetScale
- Spot-check data integrity
- Report any discrepancies

---

## Phase 5: Cutover

### Pre-Cutover Checklist
- [ ] All schema files converted and tested
- [ ] ETL scripts tested on staging
- [ ] Application builds and runs against PlanetScale locally
- [ ] Rollback plan documented

### Cutover Runbook

```bash
# T-0:00 - Enable maintenance mode
wrangler kv:key put --namespace-id=<KV_ID> maintenance_mode "true"

# T-0:05 - Export production D1
pnpm tsx scripts/migration/extract-d1.ts

# T-0:10 - Transform data
pnpm tsx scripts/migration/transform-data.ts

# T-0:15 - Load to PlanetScale
DATABASE_URL=$PS_PROD_URL pnpm tsx scripts/migration/load-planetscale.ts

# T-0:25 - Verify migration
DATABASE_URL=$PS_PROD_URL pnpm tsx scripts/migration/verify-migration.ts

# T-0:30 - Deploy application
STAGE=prod bun alchemy.run.ts

# T-0:35 - Smoke test
# - Login works
# - Team access works
# - Competition viewing works

# T-0:40 - Disable maintenance mode
wrangler kv:key put --namespace-id=<KV_ID> maintenance_mode "false"
```

### Rollback (if needed within 24h)

```bash
# 1. Enable maintenance
wrangler kv:key put --namespace-id=<KV_ID> maintenance_mode "true"

# 2. Deploy D1 version
git checkout pre-planetscale && STAGE=prod bun alchemy.run.ts

# 3. Disable maintenance
wrangler kv:key put --namespace-id=<KV_ID> maintenance_mode "false"
```

---

## Utility Files

### Cursor Pagination ✅ DONE

**File: `src/utils/cursor-pagination.ts`**
- `encodeCursor()` / `decodeCursor()`
- `buildCursorWhere()` for tuple comparison
- `createCursorResponse()` for paginated results

### MySQL Date Utils

**File: `src/utils/mysql-date-utils.ts`**
```typescript
import { sql } from "drizzle-orm"

export const formatDate = (column: any, format: string) =>
  sql`DATE_FORMAT(${column}, ${format})`

export const now = () => sql`NOW()`

export const dateDiffDays = (date1: any, date2: any) =>
  sql`DATEDIFF(${date1}, ${date2})`
```

### Batch Query Update ✅ DONE

**File: `src/utils/batch-query.ts`**
- Update `SQL_BATCH_SIZE` to 1000 (was 100)
- Update `MAX_PARAMETERS` to 10000 (was 100)

---

## File Checklist

### Modified Files
- [x] `package.json` - mysql2, ulid deps
- [x] `src/db/schemas/common.ts` - MySQL columns, ULID
- [x] `src/utils/cursor-pagination.ts` - Created
- [x] `src/utils/batch-query.ts` - Updated limits
- [ ] `wrangler.jsonc` - Hyperdrive binding
- [ ] `alchemy.run.ts` - Hyperdrive resource
- [ ] `drizzle.config.ts` - MySQL dialect
- [ ] `src/db/index.ts` - MySQL connection
- [ ] `src/db/schema.ts` - Re-exports
- [ ] All 21 schema files in `src/db/schemas/`
- [ ] 8 raw SQL files (Phase 3)

### New Files
- [x] `src/utils/cursor-pagination.ts`
- [ ] `src/utils/mysql-date-utils.ts`
- [ ] `src/routes/maintenance.tsx`
- [ ] `scripts/migration/extract-d1.ts`
- [ ] `scripts/migration/transform-data.ts`
- [ ] `scripts/migration/load-planetscale.ts`
- [ ] `scripts/migration/verify-migration.ts`
