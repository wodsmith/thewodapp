---
name: testing
description: "Guide for writing tests following Kent C. Dodds' Testing Trophy approach. Use when writing new tests, reviewing test code, deciding what type of test to write, or improving test quality. Triggers on: write tests, add tests, test coverage, should this be unit or integration, testing strategy, mock vs real."
---

# Testing (Testing Trophy)

Write tests. Not too many. Mostly integration.

## Decision Tree: Which Test Type?

```
Does it have side effects (DB, API, cache)?
├─ Yes → INTEGRATION TEST
│        Use real DB (in-memory SQLite), mock only auth boundary
└─ No → Is it a pure function with complex logic?
        ├─ Yes → UNIT TEST
        │        Test directly, no mocks needed
        └─ No → Is it a critical user journey?
                ├─ Yes → E2E TEST (Playwright)
                │        Real browser, real app
                └─ No → Component test or skip
```

## What to Mock vs Test Real

| Mock | Test Real |
|------|-----------|
| `requireVerifiedEmail`, `getSessionFromCookie` | All Drizzle queries |
| `revalidatePath`, `revalidateTag` | Server functions (`src/server/*`) |
| External services (Stripe, email) | Server actions (`src/actions/*`) |
| `getCloudflareContext` (replaced by test DB) | Permission checks |
| KV session functions (`updateAllSessionsOfUser`) | DB-backed session data |

## Anti-Patterns

- **Over-mocking**: If you mock the DB, you're testing implementation, not behavior
- **Testing implementation**: Test what the function does, not how
- **Mocking everything**: Only mock boundaries you don't own
- **Unit testing DB functions**: Use integration tests instead

## Critical: better-sqlite3 Gotchas

### Boolean Values
better-sqlite3 **cannot bind boolean values**. Always use `0`/`1` for integer columns:

```typescript
// ❌ WRONG - causes "SQLite3 can only bind numbers, strings, bigints, buffers, and null"
isPersonalTeam: false,
isDefault: true,

// ✅ CORRECT
isPersonalTeam: 0,
isDefault: 1,
```

### Date Objects
Date objects work correctly with `integer({ mode: "timestamp" })` columns. Drizzle converts them automatically.

## Quick Patterns

### Integration Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as schema from '@/db/schema'
import { createTestDb, cleanupTestDb } from '../../lib/test-db'
import { createTestSession } from '../../lib/test-session'

// IMPORTANT: Unmock @/db since global setup.ts mocks it
vi.unmock('@/db')

// Mock only auth boundary
vi.mock('@/utils/auth', () => ({
  requireVerifiedEmail: vi.fn(),
  getSessionFromCookie: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

// Mock KV session functions (require Cloudflare KV)
vi.mock('@/utils/kv-session', async () => {
  const actual = await vi.importActual<typeof import('@/utils/kv-session')>('@/utils/kv-session')
  return {
    ...actual,
    updateAllSessionsOfUser: vi.fn(),
    getAllSessionIdsOfUser: vi.fn().mockResolvedValue([]),
  }
})

// Import after vi.unmock
import { setTestDb } from '@/db'

// Import mocked functions for type safety
import { getSessionFromCookie } from '@/utils/auth'

describe('Feature Name', () => {
  let db: ReturnType<typeof createTestDb>['db']
  let sqlite: ReturnType<typeof createTestDb>['sqlite']
  let testUser: typeof schema.userTable.$inferSelect
  let testTeam: typeof schema.teamTable.$inferSelect

  beforeEach(async () => {
    const testDb = createTestDb()
    db = testDb.db
    sqlite = testDb.sqlite
    setTestDb(db)

    // Seed data - use 0/1 for integer columns, not true/false
    const now = new Date()
    ;[testUser] = await db.insert(schema.userTable).values({
      id: `usr_${createId()}`,
      email: `test@example.com`,
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      emailVerified: now,
      createdAt: now,
      updatedAt: now,
    }).returning()

    ;[testTeam] = await db.insert(schema.teamTable).values({
      id: `team_${createId()}`,
      name: 'Test Team',
      slug: `test-${createId().slice(0, 8)}`,
      type: 'gym',
      isPersonalTeam: 0,  // ← Use 0, not false!
      createdAt: now,
      updatedAt: now,
    }).returning()

    // Configure session mock
    vi.mocked(getSessionFromCookie).mockResolvedValue(
      createTestSession({
        userId: testUser.id,
        teams: [{ id: testTeam.id, permissions: ['access_dashboard'] }],
      })
    )
  })

  afterEach(() => {
    setTestDb(null)
    cleanupTestDb(sqlite)
    vi.clearAllMocks()
  })

  it('does the thing', async () => {
    const { yourServerFunction } = await import('@/server/your-module')
    const result = await yourServerFunction({ ... })
    expect(result).toBeDefined()
  })
})
```

### Session Factory

```typescript
export function createTestSession(overrides = {}) {
  return {
    id: 'test-session-id',
    userId: 'test-user-id',
    teams: [{
      id: 'test-team-id',
      name: 'Test Team',
      permissions: ['access_dashboard', 'create_components'],
      role: { id: 'admin', name: 'Admin', isSystemRole: true },
    }],
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    },
    ...overrides,
  }
}
```

### Entity Factories

```typescript
import { createId } from '@paralleldrive/cuid2'

export const factories = {
  user: (o = {}) => {
    const now = new Date()
    return {
      id: `usr_${createId()}`,
      email: `${createId().slice(0, 8)}@test.com`,
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      emailVerified: now,
      createdAt: now,
      updatedAt: now,
      ...o,
    }
  },

  team: (o = {}) => {
    const now = new Date()
    return {
      id: `team_${createId()}`,
      name: 'Test Team',
      slug: `test-${createId().slice(0, 8)}`,
      type: 'gym',
      isPersonalTeam: 0,  // ← Use 0, not false!
      createdAt: now,
      updatedAt: now,
      ...o,
    }
  },

  workout: (teamId: string, o = {}) => {
    const now = new Date()
    return {
      id: `workout_${createId()}`,
      name: 'Test Workout',
      description: 'Test description',
      scheme: 'time',
      scope: 'private',
      teamId,
      createdAt: now,
      updatedAt: now,
      ...o,
    }
  },

  competition: (teamId: string, compTeamId: string, o = {}) => {
    const now = new Date()
    return {
      id: `comp_${createId()}`,
      organizingTeamId: teamId,
      competitionTeamId: compTeamId,
      name: 'Test Competition',
      slug: `comp-${createId().slice(0, 8)}`,
      startDate: new Date(Date.now() + 86400000 * 30),
      endDate: new Date(Date.now() + 86400000 * 31),
      registrationOpensAt: new Date(Date.now() - 86400000),
      registrationClosesAt: new Date(Date.now() + 86400000 * 29),
      createdAt: now,
      updatedAt: now,
      ...o,
    }
  },
}
```

### Unit Test (Pure Functions Only)

```typescript
import { describe, it, expect } from 'vitest'
import { formatScore } from '@/utils/score-formatting'

describe('formatScore', () => {
  it('formats time in MM:SS', () => {
    expect(formatScore(90, 'time')).toBe('1:30')
  })

  it('handles edge cases', () => {
    expect(formatScore(0, 'time')).toBe('0:00')
    expect(formatScore(null, 'time')).toBe('-')
  })
})
```

## References

- **Integration patterns**: See [references/integration-patterns.md](references/integration-patterns.md) for test DB setup, migration handling, multi-tenant tests
- **E2E patterns**: See [references/e2e-patterns.md](references/e2e-patterns.md) for Playwright setup, Page Objects, auth handling
