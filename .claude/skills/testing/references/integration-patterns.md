# Integration Test Patterns

## Table of Contents

1. [Test Database Setup](#test-database-setup)
2. [Schema Export (Recommended)](#schema-export-recommended)
3. [Critical: better-sqlite3 Gotchas](#critical-better-sqlite3-gotchas)
4. [Multi-Tenant Isolation Tests](#multi-tenant-isolation-tests)
5. [Server Action Testing](#server-action-testing)
6. [Permission Testing](#permission-testing)

## Test Database Setup

### test-db.ts

Uses `drizzle-kit export --sql` to generate SQLite-compatible schema (avoids D1-specific migration syntax):

```typescript
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as schema from '@/db/schema'

// Schema SQL generated via: pnpm drizzle-kit export --sql > test/lib/schema.sql
const SCHEMA_SQL_PATH = path.join(__dirname, 'schema.sql')

export function createTestDb() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = OFF')  // Disable during schema creation

  // Apply schema
  const sqlContent = fs.readFileSync(SCHEMA_SQL_PATH, 'utf-8')
  const statements = sqlContent
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const stmt of statements) {
    try { sqlite.exec(stmt + ';') } catch { /* ignore duplicates */ }
  }

  sqlite.pragma('foreign_keys = ON')
  return { db: drizzle(sqlite, { schema }), sqlite }
}

export function cleanupTestDb(sqlite: Database.Database) {
  sqlite.close()
}

export type TestDb = BetterSQLite3Database<typeof schema>
```

### DB Module Modification

Update `src/db/index.ts` to support test injection:

```typescript
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from './schema'

// biome-ignore lint/suspicious/noExplicitAny: Test injection needs flexible typing
let testDbInstance: any = null

export function setTestDb(db: any) {
  testDbInstance = db
}

export const getDb = (): DrizzleD1Database<typeof schema> => {
  if (testDbInstance) {
    return testDbInstance as DrizzleD1Database<typeof schema>
  }
  // ... existing D1 logic via getCloudflareContext()
}
```

## Schema Export (Recommended)

D1 migrations use SQL syntax that may fail with better-sqlite3. Instead, export the schema directly:

```bash
# Generate schema.sql from Drizzle schema
cd apps/wodsmith
pnpm drizzle-kit export --sql > test/lib/schema.sql
```

**IMPORTANT:** Regenerate after any schema changes!

The exported SQL uses standard SQLite syntax that works with better-sqlite3.

## Critical: better-sqlite3 Gotchas

### Boolean Values ⚠️

better-sqlite3 **cannot bind boolean values**. Always use `0`/`1`:

```typescript
// ❌ WRONG - throws "SQLite3 can only bind numbers, strings, bigints, buffers, and null"
await db.insert(schema.teamTable).values({
  isPersonalTeam: false,  // Boolean fails!
  isDefault: true,
})

// ✅ CORRECT
await db.insert(schema.teamTable).values({
  isPersonalTeam: 0,
  isDefault: 1,
})
```

### Date Objects ✓

Date objects work correctly with `integer({ mode: "timestamp" })` columns. Drizzle converts them automatically:

```typescript
// ✅ This works fine
await db.insert(schema.userTable).values({
  createdAt: new Date(),
  updatedAt: new Date(),
  emailVerified: new Date(),
})
```

## Multi-Tenant Isolation Tests

Test that users only see data from their teams:

```typescript
describe('Multi-Tenant Isolation', () => {
  it('user cannot access other team data', async () => {
    // Create two teams
    const [team1] = await db.insert(schema.teamTable).values(factories.team()).returning()
    const [team2] = await db.insert(schema.teamTable).values(factories.team()).returning()

    // Create workout in team2
    const [workout] = await db.insert(schema.workouts).values(
      factories.workout(team2.id)
    ).returning()

    // Session only has access to team1
    vi.mocked(requireVerifiedEmail).mockResolvedValue(createTestSession({
      teams: [{ id: team1.id, permissions: ['access_dashboard'] }],
    }))

    // Try to access team2's workout
    const [result, error] = await getWorkoutByIdAction({ workoutId: workout.id })

    expect(error).toBeDefined()
    expect(error?.code).toBe('NOT_AUTHORIZED')
  })
})
```

## Server Action Testing

### Success Path

```typescript
it('creates competition registration', async () => {
  // Seed required data
  const [user] = await db.insert(schema.userTable).values(factories.user()).returning()
  const [team] = await db.insert(schema.teamTable).values(factories.team()).returning()
  const [competition] = await db.insert(schema.competitions).values(
    factories.competition(team.id)
  ).returning()

  // Configure session
  vi.mocked(requireVerifiedEmail).mockResolvedValue(createTestSession({
    userId: user.id,
    teams: [{ id: team.id }],
  }))

  // Execute action
  const [result, error] = await registerForCompetitionAction({
    competitionId: competition.id,
    divisionId: 'div_1',
  })

  // Assert behavior
  expect(error).toBeNull()
  expect(result?.registrationId).toBeDefined()

  // Verify DB state
  const registration = await db.query.competitionRegistrations.findFirst({
    where: eq(schema.competitionRegistrations.competitionId, competition.id),
  })
  expect(registration?.userId).toBe(user.id)
})
```

### Error Path

```typescript
it('rejects registration after deadline', async () => {
  const [competition] = await db.insert(schema.competitions).values(
    factories.competition(team.id, {
      registrationClosesAt: new Date(Date.now() - 86400000), // Yesterday
    })
  ).returning()

  const [result, error] = await registerForCompetitionAction({
    competitionId: competition.id,
    divisionId: 'div_1',
  })

  expect(result).toBeNull()
  expect(error?.message).toContain('closed')
})
```

## Permission Testing

Test role-based access:

```typescript
describe('Permission checks', () => {
  it('member cannot delete team workouts', async () => {
    vi.mocked(requireVerifiedEmail).mockResolvedValue(createTestSession({
      teams: [{
        id: team.id,
        role: { id: 'member', name: 'Member', isSystemRole: true },
        permissions: ['access_dashboard'], // No 'delete_components'
      }],
    }))

    const [result, error] = await deleteWorkoutAction({ workoutId: workout.id })

    expect(error?.code).toBe('FORBIDDEN')
  })

  it('admin can delete team workouts', async () => {
    vi.mocked(requireVerifiedEmail).mockResolvedValue(createTestSession({
      teams: [{
        id: team.id,
        role: { id: 'admin', name: 'Admin', isSystemRole: true },
        permissions: ['access_dashboard', 'delete_components'],
      }],
    }))

    const [result, error] = await deleteWorkoutAction({ workoutId: workout.id })

    expect(error).toBeNull()
  })
})
```

## Seed Helpers

```typescript
// test/lib/seed-helpers.ts
import { factories } from '../factories'
import * as schema from '@/db/schema'

export async function seedUserWithTeam(db) {
  const [user] = await db.insert(schema.userTable).values(factories.user()).returning()
  const [team] = await db.insert(schema.teamTable).values(factories.team()).returning()

  await db.insert(schema.teamMembershipTable).values({
    id: `membership_${createId()}`,
    teamId: team.id,
    userId: user.id,
    roleId: 'admin',
    isSystemRole: true,
  })

  return { user, team }
}

export async function seedCompetitionWithDivisions(db, teamId: string) {
  const [competition] = await db.insert(schema.competitions).values(
    factories.competition(teamId)
  ).returning()

  const [division] = await db.insert(schema.competitionDivisions).values({
    id: `div_${createId()}`,
    competitionId: competition.id,
    name: 'RX',
    scalingGroupId: null,
  }).returning()

  return { competition, division }
}
```
