# D1 to PlanetScale Migration Plan

## Executive Summary

This document outlines the migration strategy from Cloudflare D1 (SQLite) to PlanetScale (MySQL). The migration will use a dual-write pattern to ensure zero downtime and data consistency, followed by a backfill of existing data.

---

## 1. Current State Assessment

### 1.1 Database Overview

| Aspect | Current State |
|--------|---------------|
| **Database** | Cloudflare D1 (SQLite) |
| **ORM** | Drizzle ORM with `drizzle-orm/d1` |
| **Schema Modules** | 22 modules in `src/db/schemas/` |
| **Migrations** | 82 auto-generated SQL migrations |
| **Access Pattern** | Fresh connection per request via `getDb()` |
| **Multi-tenancy** | `teamId` filtering on all queries |

### 1.2 Key Files

```
src/db/
├── index.ts              # getDb() connection factory
├── schema.ts             # Central schema exports
├── schemas/              # 22 schema modules
│   ├── affiliates.ts
│   ├── billing.ts
│   ├── commerce.ts
│   ├── common.ts         # ID generators, common columns
│   ├── competitions.ts
│   ├── entitlements.ts
│   ├── event-resources.ts
│   ├── judging-sheets.ts
│   ├── notifications.ts
│   ├── organizer-requests.ts
│   ├── programming.ts
│   ├── scaling.ts
│   ├── scheduling.ts
│   ├── scores.ts
│   ├── sponsors.ts
│   ├── teams.ts
│   ├── users.ts
│   ├── video-submissions.ts
│   ├── volunteers.ts
│   ├── waivers.ts
│   └── workouts.ts
└── migrations/           # 82 SQL migration files
```

### 1.3 D1-Specific Constraints Being Removed

| Constraint | D1 | PlanetScale |
|------------|-----|-------------|
| Parameter limit | 100 per query | No practical limit |
| Transactions | Not supported | Supported |
| Connection model | Per-request | Connection pooling |
| Query batching | Required for large arrays | Not required |

---

## 2. Schema Conversion (SQLite → MySQL)

### 2.1 Type Mappings

| SQLite (current) | MySQL (PlanetScale) | Notes |
|------------------|---------------------|-------|
| `text()` | `varchar(255)` or `text` | Varchar for indexed cols, text for JSON |
| `integer()` | `int` | Standard conversion |
| `integer({ mode: "timestamp" })` | `datetime(3)` | Use MySQL datetime with ms precision |
| `integer().default(0/1)` (booleans) | `boolean` | Convert to native MySQL boolean |
| `text({ mode: "json" })` | `json` | Native MySQL JSON type |
| `text().primaryKey()` | `varchar(255).primaryKey()` | CUID2 IDs (~25 chars) |

### 2.2 Schema Changes Required

#### 2.2.1 Create Parallel MySQL Schema

Create `src/db/schemas-mysql/` directory with MySQL versions of all schema files.

**Example: Converting `common.ts`**

```typescript
// src/db/schemas-mysql/common.ts
import { createId } from "@paralleldrive/cuid2"
import { sql } from "drizzle-orm"
import { datetime, int, mysqlTable } from "drizzle-orm/mysql-core"

export const commonColumns = {
  createdAt: datetime({ mode: "date", fsp: 3 })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: datetime({ mode: "date", fsp: 3 })
    .$onUpdateFn(() => new Date())
    .notNull(),
  updateCounter: int()
    .default(0)
    .$onUpdate(() => sql`update_counter + 1`),
}

// ID generators remain unchanged
export const createUserId = () => `usr_${createId()}`
// ... rest of ID generators
```

**Example: Converting `users.ts`**

```typescript
// src/db/schemas-mysql/users.ts
import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { boolean, datetime, index, int, json, mysqlTable, varchar, text } from "drizzle-orm/mysql-core"
import { commonColumns, createPasskeyId, createUserId } from "./common"

export const userTable = mysqlTable(
  "user",
  {
    ...commonColumns,
    id: varchar({ length: 50 })
      .primaryKey()
      .$defaultFn(() => createUserId())
      .notNull(),
    firstName: varchar({ length: 255 }),
    lastName: varchar({ length: 255 }),
    email: varchar({ length: 255 }).unique(),
    passwordHash: text(),
    role: varchar({ length: 20 }).default("user").notNull(),
    emailVerified: datetime({ mode: "date", fsp: 3 }),
    // ... rest of fields with MySQL types
    currentCredits: int().default(0).notNull(),
    gender: varchar({ length: 20 }),
    dateOfBirth: datetime({ mode: "date", fsp: 3 }),
    athleteProfile: json(),  // Native JSON instead of text
  },
  (table) => [
    index("email_idx").on(table.email),
    index("role_idx").on(table.role),
    // ... rest of indexes
  ],
)
```

### 2.3 Key Conversion Patterns

#### Boolean Fields (integer 0/1 → boolean)

```typescript
// D1 (current)
isPersonalTeam: integer().default(0).notNull(),
isActive: integer().default(1).notNull(),

// PlanetScale
isPersonalTeam: boolean().default(false).notNull(),
isActive: boolean().default(true).notNull(),
```

#### JSON Fields (text → json)

```typescript
// D1 (current)
settings: text({ length: 10000 }),
permissions: text({ mode: "json" }).notNull().$type<string[]>(),

// PlanetScale
settings: json().$type<TeamSettings>(),
permissions: json().notNull().$type<string[]>(),
```

#### Timestamps (integer → datetime)

```typescript
// D1 (current)
createdAt: integer({ mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),

// PlanetScale
createdAt: datetime({ mode: "date", fsp: 3 }).$defaultFn(() => new Date()).notNull(),
```

---

## 3. Double-Write Architecture

### 3.1 Overview

```
┌─────────────────┐     ┌──────────────────┐
│  Application    │────►│  Write Handler   │
└─────────────────┘     └──────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                      ▼
            ┌──────────────┐      ┌──────────────┐
            │  D1 (SQLite) │      │  PlanetScale │
            │   PRIMARY    │      │   SECONDARY  │
            └──────────────┘      └──────────────┘
                    │
                    ▼
            ┌──────────────┐
            │    READS     │
            │  (D1 only)   │
            └──────────────┘
```

### 3.2 Implementation

#### 3.2.1 Dual Database Connection

Create a new database index file that supports both databases:

```typescript
// src/db/index.ts (updated)
import { env } from "cloudflare:workers"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { drizzle as drizzleD1 } from "drizzle-orm/d1"
import { drizzle as drizzlePlanetScale } from "drizzle-orm/planetscale-serverless"
import { connect } from "@planetscale/database"
import * as schemaD1 from "./schema"
import * as schemaMySQL from "./schema-mysql"

// Feature flag for double writes
const ENABLE_DOUBLE_WRITE = env.ENABLE_DOUBLE_WRITE === "true"
const ENABLE_PS_READS = env.ENABLE_PS_READS === "true"

// D1 connection (current)
export const getDb = (): DrizzleD1Database<typeof schemaD1> => {
  if (!env.DB) {
    throw new Error('D1 database binding "DB" not found.')
  }
  return drizzleD1(env.DB, { schema: schemaD1, logger: true })
}

// PlanetScale connection
export const getPsDb = () => {
  if (!env.DATABASE_URL) {
    throw new Error('PlanetScale DATABASE_URL not found.')
  }
  const connection = connect({
    url: env.DATABASE_URL,
  })
  return drizzlePlanetScale(connection, { schema: schemaMySQL, logger: true })
}

// Dual-write wrapper for mutations
export const getDualWriteDb = () => {
  const d1 = getDb()
  const ps = ENABLE_DOUBLE_WRITE ? getPsDb() : null

  return {
    d1,
    ps,
    isDualWriteEnabled: ENABLE_DOUBLE_WRITE,
  }
}
```

#### 3.2.2 Dual-Write Helper Functions

```typescript
// src/utils/dual-write.ts
import { getDb, getPsDb } from "@/db"
import { env } from "cloudflare:workers"

type WriteOperation<T> = (db: any) => Promise<T>

interface DualWriteOptions {
  // If true, throw on PlanetScale write failure
  // If false, log error but don't fail the request
  failOnSecondaryError?: boolean
}

export async function dualWrite<T>(
  d1Operation: WriteOperation<T>,
  psOperation: WriteOperation<T>,
  options: DualWriteOptions = {}
): Promise<T> {
  const { failOnSecondaryError = false } = options
  const d1 = getDb()

  // Always write to D1 first (primary)
  const result = await d1Operation(d1)

  // If double-write is enabled, write to PlanetScale
  if (env.ENABLE_DOUBLE_WRITE === "true") {
    try {
      const ps = getPsDb()
      await psOperation(ps)
    } catch (error) {
      console.error("[DualWrite] PlanetScale write failed:", error)

      if (failOnSecondaryError) {
        throw error
      }

      // Log to error tracking (e.g., Sentry)
      // await logDualWriteFailure(error, operation details)
    }
  }

  return result
}

// Convenience wrapper for simple insert operations
export async function dualInsert<T>(
  table: any,
  values: T,
): Promise<T[]> {
  return dualWrite(
    async (d1) => d1.insert(table.d1).values(values).returning(),
    async (ps) => ps.insert(table.ps).values(convertToPsValues(values)).returning(),
  )
}
```

#### 3.2.3 Usage Example (Server Function)

```typescript
// src/server-fns/auth-fns.ts (updated)
import { dualWrite } from "@/utils/dual-write"
import { userTable as userTableD1 } from "@/db/schema"
import { userTable as userTablePS } from "@/db/schema-mysql"

export const createUser = createServerFn({ method: "POST" })
  .validator(createUserSchema)
  .handler(async ({ data }) => {
    const userData = {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash: await hashPassword(data.password),
    }

    const [user] = await dualWrite(
      // D1 operation
      async (d1) => d1.insert(userTableD1).values(userData).returning(),
      // PlanetScale operation (with type conversion)
      async (ps) => ps.insert(userTablePS).values({
        ...userData,
        // Convert D1 boolean integers to actual booleans if needed
      }).returning(),
    )

    return user
  })
```

### 3.3 Data Type Conversion Layer

```typescript
// src/utils/data-conversion.ts

// D1 stores booleans as 0/1 integers
// PlanetScale uses native booleans
export function convertD1ToPlanetScale<T extends Record<string, any>>(row: T): T {
  const converted = { ...row }

  // Boolean fields to convert
  const booleanFields = [
    'isPersonalTeam',
    'isActive',
    'isSystemRole',
    'isEditable',
    // Add all boolean fields here
  ]

  for (const field of booleanFields) {
    if (field in converted) {
      converted[field] = converted[field] === 1
    }
  }

  return converted
}

export function convertPlanetScaleToD1<T extends Record<string, any>>(row: T): T {
  const converted = { ...row }

  const booleanFields = [
    'isPersonalTeam',
    'isActive',
    'isSystemRole',
    'isEditable',
  ]

  for (const field of booleanFields) {
    if (field in converted && typeof converted[field] === 'boolean') {
      converted[field] = converted[field] ? 1 : 0
    }
  }

  return converted
}
```

---

## 4. Backfill Strategy

### 4.1 Approach: Incremental Batched Migration

Rather than a single large migration, use incremental batches to:
- Minimize production impact
- Allow verification between batches
- Enable easy rollback if issues arise

### 4.2 Migration Order (Respecting Foreign Keys)

```
1. Independent tables (no foreign keys)
   ├── user
   └── tag

2. First-level dependencies
   ├── team (depends on user for personalTeamOwnerId)
   ├── passkey_credential (depends on user)
   └── affiliate

3. Second-level dependencies
   ├── team_membership (depends on team, user)
   ├── team_role (depends on team)
   ├── team_invitation (depends on team, user)
   ├── competition_group (depends on team)
   └── programming_track (depends on team)

4. Third-level dependencies
   ├── competition (depends on competition_group, team)
   ├── track_workout (depends on programming_track)
   └── scaling_group (depends on team)

5. Continue for remaining tables...
```

### 4.3 Backfill Script

```typescript
// scripts/backfill-planetscale.ts
import { getDb, getPsDb } from "@/db"
import { convertD1ToPlanetScale } from "@/utils/data-conversion"
import * as schemaD1 from "@/db/schema"
import * as schemaPS from "@/db/schema-mysql"

const BATCH_SIZE = 500  // PlanetScale doesn't have the 100 param limit

interface MigrationTable {
  name: string
  d1Table: any
  psTable: any
  dependencies: string[]
}

const MIGRATION_ORDER: MigrationTable[] = [
  // Level 0: No dependencies
  { name: "user", d1Table: schemaD1.userTable, psTable: schemaPS.userTable, dependencies: [] },
  { name: "tag", d1Table: schemaD1.tagTable, psTable: schemaPS.tagTable, dependencies: [] },

  // Level 1: Depends on Level 0
  { name: "team", d1Table: schemaD1.teamTable, psTable: schemaPS.teamTable, dependencies: ["user"] },
  { name: "passkey_credential", d1Table: schemaD1.passKeyCredentialTable, psTable: schemaPS.passKeyCredentialTable, dependencies: ["user"] },

  // ... continue for all tables
]

async function backfillTable(config: MigrationTable) {
  const d1 = getDb()
  const ps = getPsDb()

  console.log(`[Backfill] Starting ${config.name}...`)

  let offset = 0
  let totalMigrated = 0

  while (true) {
    // Fetch batch from D1
    const rows = await d1
      .select()
      .from(config.d1Table)
      .orderBy(config.d1Table.createdAt)
      .limit(BATCH_SIZE)
      .offset(offset)

    if (rows.length === 0) break

    // Convert and insert to PlanetScale
    const convertedRows = rows.map(convertD1ToPlanetScale)

    await ps
      .insert(config.psTable)
      .values(convertedRows)
      .onDuplicateKeyUpdate({
        // Update on conflict (for reruns)
        set: { updatedAt: new Date() }
      })

    totalMigrated += rows.length
    offset += BATCH_SIZE

    console.log(`[Backfill] ${config.name}: ${totalMigrated} rows migrated`)
  }

  console.log(`[Backfill] Completed ${config.name}: ${totalMigrated} total rows`)
}

async function runBackfill() {
  for (const table of MIGRATION_ORDER) {
    await backfillTable(table)

    // Verification step
    const d1Count = await getDb().select({ count: count() }).from(table.d1Table)
    const psCount = await getPsDb().select({ count: count() }).from(table.psTable)

    if (d1Count[0].count !== psCount[0].count) {
      throw new Error(`Count mismatch for ${table.name}: D1=${d1Count[0].count}, PS=${psCount[0].count}`)
    }
  }
}
```

### 4.4 Incremental Sync (for Ongoing Changes During Migration)

```typescript
// scripts/incremental-sync.ts
// Sync records modified since last sync

async function incrementalSync(tableName: string, since: Date) {
  const d1 = getDb()
  const ps = getPsDb()
  const config = MIGRATION_ORDER.find(t => t.name === tableName)!

  const modifiedRows = await d1
    .select()
    .from(config.d1Table)
    .where(gt(config.d1Table.updatedAt, since))
    .orderBy(config.d1Table.updatedAt)

  for (const row of modifiedRows) {
    const converted = convertD1ToPlanetScale(row)

    await ps
      .insert(config.psTable)
      .values(converted)
      .onDuplicateKeyUpdate({
        set: converted
      })
  }

  return modifiedRows.length
}
```

---

## 5. Migration Phases

### Phase 1: Setup (Week 1)

**Tasks:**
- [ ] Create PlanetScale database and configure connection
- [ ] Add `@planetscale/database` and update Drizzle config
- [ ] Create MySQL schema files in `src/db/schemas-mysql/`
- [ ] Generate and apply PlanetScale migrations
- [ ] Add environment variables (`DATABASE_URL`, `ENABLE_DOUBLE_WRITE`)
- [ ] Deploy to staging environment

**Deliverables:**
- PlanetScale database provisioned
- MySQL schema deployed
- Staging environment with dual-write disabled

### Phase 2: Dual-Write Implementation (Week 2)

**Tasks:**
- [ ] Implement `dual-write.ts` utility
- [ ] Create data conversion functions
- [ ] Update all write operations (insert/update/delete) to use dual-write
- [ ] Add monitoring/alerting for dual-write failures
- [ ] Test in staging with `ENABLE_DOUBLE_WRITE=false`

**Files to Update:**
```
src/server-fns/
├── auth-fns.ts
├── team-fns.ts
├── admin-gym-setup-fns.ts
├── competition-detail-fns.ts
├── competition-server-logic.ts
├── scaling-fns.ts
├── workout-fns.ts
├── athlete-score-fns.ts
├── stripe-connect-fns.ts
└── ... (all files with DB writes)
```

**Deliverables:**
- All write operations support dual-write
- Monitoring dashboard for write success rates

### Phase 3: Backfill (Week 3)

**Tasks:**
- [ ] Run backfill script for all tables
- [ ] Verify row counts match between D1 and PlanetScale
- [ ] Run data integrity checks (spot-check specific records)
- [ ] Enable `ENABLE_DOUBLE_WRITE=true` in staging
- [ ] Monitor for dual-write failures

**Verification Queries:**
```sql
-- Compare counts
SELECT 'user' as table_name, COUNT(*) as d1_count FROM user
UNION ALL
SELECT 'team', COUNT(*) FROM team
-- ... etc

-- Spot check specific records
SELECT * FROM user WHERE id = 'usr_xxxxx' -- Compare D1 vs PS
```

**Deliverables:**
- All historical data migrated
- Dual-write enabled in staging
- Data verification report

### Phase 4: Production Dual-Write (Week 4)

**Tasks:**
- [ ] Deploy dual-write code to production
- [ ] Run production backfill
- [ ] Enable `ENABLE_DOUBLE_WRITE=true` in production
- [ ] Monitor dual-write success rate (target: 99.9%+)
- [ ] Run for 1-2 weeks to build confidence

**Deliverables:**
- Production dual-write active
- PlanetScale has full production data
- Monitoring shows stable operation

### Phase 5: Read Migration & Cutover (Week 5-6)

**Tasks:**
- [ ] Implement read switching (`ENABLE_PS_READS=true`)
- [ ] Test reads from PlanetScale in staging
- [ ] Gradual rollout: 10% → 50% → 100% of reads
- [ ] Monitor latency and error rates
- [ ] Full cutover: PlanetScale becomes primary

**Deliverables:**
- All reads from PlanetScale
- D1 in standby mode
- Performance benchmarks documented

### Phase 6: Cleanup (Week 7)

**Tasks:**
- [ ] Remove dual-write code
- [ ] Remove D1 schema and configuration
- [ ] Update `getDb()` to return PlanetScale only
- [ ] Remove `autochunk` utility (no longer needed)
- [ ] Update documentation

**Deliverables:**
- Codebase using PlanetScale only
- D1 data archived
- Migration complete

---

## 6. Rollback Plan

### 6.1 During Dual-Write Phase

If PlanetScale shows issues:

1. Set `ENABLE_DOUBLE_WRITE=false`
2. All writes go to D1 only
3. Investigate PlanetScale issues
4. Re-run backfill when issues resolved
5. Re-enable dual-write

### 6.2 After Cutover

If issues after PlanetScale becomes primary:

1. Set `ENABLE_PS_READS=false` (reads go back to D1)
2. D1 still has data (writes were dual-write)
3. Investigate and fix PlanetScale issues
4. Re-enable PS reads after resolution

### 6.3 Point of No Return

After Phase 6 (cleanup), rollback requires:
- Restore D1 from backup
- Deploy code with D1 schema
- This is why Phase 4-5 should run for 2+ weeks

---

## 7. Technical Considerations

### 7.1 PlanetScale-Specific Notes

**Connection Pooling:**
```typescript
// PlanetScale uses HTTP-based connections
// No need for connection pooling config in Workers
const connection = connect({
  url: env.DATABASE_URL,
  // Optional: fetch override for Cloudflare Workers
  fetch: (url, init) => fetch(url, init),
})
```

**No Foreign Key Constraints:**
PlanetScale (with Vitess) doesn't enforce foreign keys at the database level. This matches our current D1 behavior where we handle referential integrity in application code.

**Transactions:**
Unlike D1, PlanetScale supports transactions:
```typescript
await db.transaction(async (tx) => {
  await tx.insert(table1).values({...})
  await tx.insert(table2).values({...})
})
```

### 7.2 Removing D1 Workarounds

After migration, remove these D1-specific patterns:

```typescript
// REMOVE: autochunk utility (no 100 param limit)
// Before:
const results = await autochunk(
  { items: ids, otherParametersCount: 1 },
  async (chunk) => db.select()...where(inArray(table.id, chunk))
)

// After:
const results = await db.select()...where(inArray(table.id, ids))
```

### 7.3 Environment Variables

Add to `.dev.vars` and Alchemy secrets:

```bash
# PlanetScale connection
DATABASE_URL=mysql://user:pass@host/database?ssl={"rejectUnauthorized":true}

# Feature flags
ENABLE_DOUBLE_WRITE=false  # true after backfill
ENABLE_PS_READS=false      # true for cutover
```

---

## 8. Monitoring & Alerting

### 8.1 Metrics to Track

| Metric | Alert Threshold |
|--------|-----------------|
| Dual-write success rate | < 99.9% |
| PlanetScale write latency | > 500ms p99 |
| Row count delta (D1 vs PS) | > 0 |
| Query error rate | > 0.1% |

### 8.2 Dashboard Queries

```typescript
// Track dual-write failures
console.log("[DualWrite]", {
  table: tableName,
  operation: "insert" | "update" | "delete",
  success: boolean,
  latencyMs: number,
  error?: string,
})
```

---

## 9. Cost Comparison

| Aspect | D1 | PlanetScale |
|--------|-----|-------------|
| Storage | $0.75/GB | $0.25/GB (Hobby) |
| Reads | 5M free, then $0.001/M | Included |
| Writes | 1M free, then $0.001/M | $1.50/M |
| Row reads | Included | $1/B |

Note: Actual costs depend on usage patterns. Run cost analysis with production metrics before finalizing.

---

## 10. Appendix: Full Table Migration Order

```
Level 0 (no dependencies):
- user
- tag
- entitlement_type
- feature
- limit
- plan

Level 1:
- team
- passkey_credential
- plan_feature
- plan_limit
- affiliate

Level 2:
- team_membership
- team_role
- team_invitation
- team_subscription
- team_addon
- team_entitlement_override
- team_usage
- team_feature_entitlement
- team_limit_entitlement
- competition_group
- programming_track
- scaling_group
- location
- skill
- class_catalog
- waiver
- notification
- sponsor_group

Level 3:
- competition
- track_workout
- scaling_level
- scheduled_class_template
- sponsor
- organizer_request

Level 4:
- competition_division
- competition_venue
- competition_event
- event_resource
- commerce_product
- scheduled_workout_instance
- workout_scaling_description

Level 5:
- competition_registration
- competition_heat
- competition_registration_question
- event_judging_sheet
- division_fee
- commerce_purchase
- credit_transaction
- purchased_item

Level 6:
- competition_registration_teammate
- competition_heat_assignment
- competition_registration_answer
- heat_volunteer
- judge_rotation
- judge_assignment_version
- video_submission
- score
- score_audit_log
```

---

## 11. Next Steps

1. **Review this plan** with the team
2. **Create Linear issues** for each phase
3. **Provision PlanetScale** database in staging
4. **Begin Phase 1** implementation

Questions to resolve:
- PlanetScale plan selection (Hobby vs Scaler)
- Timeline alignment with feature development
- Testing strategy for critical paths (registration, payments)
