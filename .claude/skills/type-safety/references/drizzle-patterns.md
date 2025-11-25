# Drizzle ORM Type Patterns

## Query with Relations

### Single Relation

```typescript
import { type User, type Team } from "@/db/schema"

type UserWithTeam = User & { team: Team }

const users = (await db.query.userTable.findMany({
  with: { team: true }
})) as UserWithTeam[]
```

### Multiple Relations

```typescript
import { type User, type Team, type Profile } from "@/db/schema"

type UserWithRelations = User & {
  team: Team
  profile: Profile
}

const users = (await db.query.userTable.findMany({
  with: {
    team: true,
    profile: true
  }
})) as UserWithRelations[]
```

### Nested Relations

```typescript
import { type TeamMembership, type Team, type User } from "@/db/schema"

type TeamMembershipWithRelations = TeamMembership & {
  team: Team
  user: User
}

const memberships = (await db.query.teamMembershipTable.findMany({
  with: {
    team: true,
    user: true
  }
})) as TeamMembershipWithRelations[]
```

## Optional Relations

When a relation might be null:

```typescript
type UserWithOptionalTeam = User & { team: Team | null }
```

## Array Relations

When the relation is an array (one-to-many):

```typescript
type TeamWithMembers = Team & { memberships: TeamMembership[] }
```

## Why Cast at All?

Drizzle's query builder with `.with()` doesn't automatically narrow the return type to include relations. The cast is necessary to tell TypeScript the shape of the returned data. However:

- Use base schema types, not manual definitions
- Create type aliases for reusability
- Keep casts simple and based on real types
