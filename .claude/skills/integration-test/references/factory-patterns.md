# Factory Patterns for Test Data

Factory functions create test data with sensible defaults and override support. They eliminate magic values, reduce duplication, and make tests self-documenting.

## Core Pattern

```typescript
import { createId } from "@paralleldrive/cuid2"

export interface UserFactory {
  id: string
  email: string
  emailVerified: boolean
  name: string
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Create a test user with sensible defaults.
 * All properties can be overridden.
 */
export function createUser(overrides?: Partial<UserFactory>): UserFactory {
  const id = overrides?.id ?? createId()
  const now = new Date()
  
  return {
    id,
    email: `user-${id.slice(0, 8)}@example.com`,
    emailVerified: true,
    name: `Test User ${id.slice(0, 4)}`,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    ...overrides, // Override last so custom values win
  }
}
```

**Usage:**

```typescript
// Default user
const user = createUser()

// Custom email, rest defaults
const admin = createUser({ email: "admin@example.com" })

// Full control
const specific = createUser({
  id: "user-123",
  name: "Alice",
  emailVerified: false,
})
```

## Builder Pattern for Complex Objects

For objects with nested relationships or complex setup, use the builder pattern:

```typescript
export class SessionBuilder {
  private session: Partial<SessionWithMeta> = {}
  
  withUser(userOverrides?: Partial<KVSessionUser>) {
    this.session.user = {
      id: createId(),
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      role: "user",
      emailVerified: new Date(),
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentCredits: 100,
      lastCreditRefreshAt: null,
      ...userOverrides,
    }
    return this
  }
  
  withTeam(teamOverrides?: Partial<KVSessionTeam>) {
    const teamId = teamOverrides?.id ?? createId()
    this.session.teams = [
      {
        id: teamId,
        name: `Test Team ${teamId.slice(0, 4)}`,
        slug: `test-team-${teamId.slice(0, 8)}`,
        type: "gym",
        isPersonalTeam: false,
        role: { id: "member", name: "Member", isSystemRole: true },
        permissions: ["access_dashboard"],
        ...teamOverrides,
      },
    ]
    return this
  }
  
  withPermissions(permissions: string[]) {
    if (this.session.teams?.[0]) {
      this.session.teams[0].permissions = permissions
    }
    return this
  }
  
  build(): SessionWithMeta {
    return {
      id: createId(),
      userId: this.session.user?.id ?? createId(),
      expiresAt: Date.now() + 86400000,
      createdAt: Date.now(),
      isCurrentSession: true,
      version: 5,
      ...this.session,
    } as SessionWithMeta
  }
}

// Usage
const session = new SessionBuilder()
  .withUser({ firstName: "Alice" })
  .withTeam({ role: { id: "owner", name: "Owner", isSystemRole: true } })
  .withPermissions(["edit_workouts", "delete_workouts"])
  .build()
```

**When to use builder vs simple factory:**

- **Simple factory** - Flat objects, 1-2 levels of nesting
- **Builder** - Complex objects, many optional configurations, fluent API desired

## Relational Factory Pattern

For objects with foreign key relationships:

```typescript
export function createTeam(overrides?: Partial<TeamFactory>): TeamFactory {
  const id = overrides?.id ?? createId()
  const ownerId = overrides?.ownerId ?? createId() // Auto-generate if not provided
  
  return {
    id,
    name: `Test Team ${id.slice(0, 4)}`,
    slug: `test-team-${id.slice(0, 8)}`,
    ownerId,
    createdAt: new Date(),
    ...overrides,
  }
}

export function createWorkout(overrides?: Partial<WorkoutFactory>): WorkoutFactory {
  const id = overrides?.id ?? createId()
  const teamId = overrides?.teamId ?? createId() // Auto-generate if not provided
  
  return {
    id,
    teamId,
    name: `Test Workout ${id.slice(0, 4)}`,
    type: "amrap",
    description: null,
    createdAt: new Date(),
    ...overrides,
  }
}

// Usage - explicit relationships
const team = createTeam({ id: "team-123" })
const workout = createWorkout({ teamId: team.id })

// Usage - auto-generated relationships (for when you don't care)
const workout2 = createWorkout() // Gets random teamId
```

## Sequence Factories

Generate sequences of related data:

```typescript
export function createUsers(count: number, baseOverrides?: Partial<UserFactory>): UserFactory[] {
  return Array.from({ length: count }, (_, i) => 
    createUser({
      name: `User ${i + 1}`,
      ...baseOverrides,
    })
  )
}

// Usage
const users = createUsers(5) // 5 users with sequential names
const admins = createUsers(3, { role: "admin" }) // 3 admin users
```

## Trait Factories

Predefined configurations for common test scenarios:

```typescript
export const userTraits = {
  unverified: () => createUser({ emailVerified: false }),
  admin: () => createUser({ role: "admin" }),
  withAvatar: () => createUser({ avatarUrl: "https://avatar.example.com/1.jpg" }),
  expired: () => createUser({ 
    createdAt: new Date("2020-01-01"),
    emailVerified: false,
  }),
}

// Usage
const unverifiedUser = userTraits.unverified()
const adminUser = userTraits.admin()
```

## Fake Data Stores

In-memory stores for testing database interactions:

```typescript
export class FakeSessionStore {
  private sessions = new Map<string, SessionWithMeta>()
  
  async get(sessionId: string): Promise<SessionWithMeta | null> {
    return this.sessions.get(sessionId) ?? null
  }
  
  async set(session: SessionWithMeta): Promise<void> {
    this.sessions.set(session.id, session)
  }
  
  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
  }
  
  reset(): void {
    this.sessions.clear()
  }
}

// Usage
const store = new FakeSessionStore()
const session = createTestSession()

await store.set(session)
const retrieved = await store.get(session.id)
expect(retrieved).toEqual(session)

store.reset() // Clear between tests
```

## WODsmith Factory Examples

The project has factories in `packages/test-utils/src/factories/`:

### User Factory

```typescript
import { createUser } from "@repo/test-utils/factories"

// Default user
const user = createUser()
// { id: "cuid...", email: "user-abc123@example.com", emailVerified: true, ... }

// Custom properties
const admin = createUser({ name: "Admin User", email: "admin@gym.com" })
```

### Team Factory

```typescript
import { createTeam } from "@repo/test-utils/factories"

const team = createTeam()
// { id: "cuid...", name: "Test Team xyz", slug: "test-team-abc12345", ... }

const gym = createTeam({ 
  name: "CrossFit Downtown",
  slug: "crossfit-downtown",
})
```

### Workout Factory

```typescript
import { createWorkout } from "@repo/test-utils/factories"

const workout = createWorkout()
// { id: "cuid...", teamId: "cuid...", name: "Test Workout abc", type: "amrap", ... }

const fran = createWorkout({
  teamId: team.id,
  name: "Fran",
  type: "fortime",
})
```

### Session Factory

```typescript
import { createTestSession } from "@repo/test-utils/factories"

// Default session with member permissions
const session = createTestSession()

// Custom user role
const adminSession = createTestSession({ role: "admin" })

// Custom team role and permissions
const ownerSession = createTestSession({
  teamRole: "owner",
  permissions: ["edit_workouts", "delete_workouts", "manage_team"],
})

// Expired session
const expired = createTestSession({ expiresInMs: -1000 })

// Custom team
const withTeam = createTestSession({
  teamId: "team-123",
  teamSlug: "my-gym",
})
```

## Best Practices

### 1. Keep Factories Simple

```typescript
// ✅ GOOD - simple, focused
export function createUser(overrides?: Partial<UserFactory>): UserFactory {
  const id = overrides?.id ?? createId()
  return {
    id,
    email: `user-${id.slice(0, 8)}@example.com`,
    name: `Test User ${id.slice(0, 4)}`,
    ...overrides,
  }
}

// ❌ BAD - too much logic, hard to understand
export function createUser(opts?: {
  verified?: boolean
  admin?: boolean
  withTeam?: boolean
  teamSize?: number
}): UserFactory {
  const user = { /* ... */ }
  if (opts?.verified) { /* ... */ }
  if (opts?.admin) { /* ... */ }
  if (opts?.withTeam) {
    const team = createTeam()
    if (opts?.teamSize) {
      for (let i = 0; i < opts.teamSize; i++) {
        // ...
      }
    }
  }
  return user
}
```

### 2. Use Type-Safe Overrides

```typescript
// ✅ GOOD - type-safe, catches typos
const user = createUser({ emailVerified: false })

// ❌ BAD - typo not caught
const user = createUser({ emailVerifed: false }) // Property doesn't exist
```

### 3. Colocate Factories with Types

```
test-utils/
├── src/
│   ├── factories/
│   │   ├── user.ts
│   │   ├── team.ts
│   │   ├── session.ts
│   │   └── index.ts  # Re-export all
│   └── fakes/
│       ├── fake-db.ts
│       └── fake-kv.ts
```

### 4. Document Edge Cases

```typescript
/**
 * Create a test session matching the KVSession structure.
 * 
 * @example
 * ```ts
 * const session = createTestSession()
 * const adminSession = createTestSession({ role: "admin" })
 * const expiredSession = createTestSession({ expiresInMs: -1000 })
 * ```
 */
export function createTestSession(/* ... */) {
  // ...
}
```

### 5. Reset Stores Between Tests

```typescript
describe("SessionStore", () => {
  let store: FakeSessionStore
  
  beforeEach(() => {
    store = new FakeSessionStore() // Fresh store per test
  })
  
  // Tests...
})
```

## Common Patterns

### Testing Multi-Tenant Data

```typescript
const team1 = createTeam({ id: "team-1" })
const team2 = createTeam({ id: "team-2" })

const workout1 = createWorkout({ teamId: team1.id })
const workout2 = createWorkout({ teamId: team2.id })

const session = createTestSession({ teamId: team1.id })

// Test should only see team1's workout
const result = await getWorkouts(session)
expect(result).toEqual([workout1])
expect(result).not.toContain(workout2)
```

### Testing Permissions

```typescript
const memberSession = createTestSession({ 
  permissions: ["access_dashboard", "view_workouts"] 
})

const ownerSession = createTestSession({
  teamRole: "owner",
  permissions: ["access_dashboard", "view_workouts", "edit_workouts", "delete_workouts"],
})

// Test member can't delete
await expect(deleteWorkout(memberSession, workoutId)).rejects.toThrow()

// Test owner can delete
await expect(deleteWorkout(ownerSession, workoutId)).resolves.toBeDefined()
```

### Testing Time-Dependent Logic

```typescript
// Session expires in 1 hour
const activeSession = createTestSession({ expiresInMs: 3600000 })

// Session expired 1 hour ago
const expiredSession = createTestSession({ expiresInMs: -3600000 })

expect(isSessionValid(activeSession)).toBe(true)
expect(isSessionValid(expiredSession)).toBe(false)
```

## References

- WODsmith factories: `packages/test-utils/src/factories/`
- FakeDatabase: `packages/test-utils/src/fakes/fake-db.ts`
- FakeSessionStore: `packages/test-utils/src/factories/session.ts`
