# Real Examples from Codebase

## Example 1: Team Memberships with Relations

### Before (src/utils/auth.ts)

```typescript
const userTeamMemberships = (await db.query.teamMembershipTable.findMany({
  where: eq(teamMembershipTable.userId, userId),
  with: {
    team: true,
  },
})) as unknown as Array<{
  id: string
  teamId: string
  userId: string
  roleId: string
  isSystemRole: number
  invitedBy: string | null
  invitedAt: Date | null
  joinedAt: Date | null
  expiresAt: Date | null
  isActive: number
  createdAt: Date
  updatedAt: Date
  team: {
    id: string
    name: string
    slug: string
    description: string | null
    avatarUrl: string | null
    settings: string | null
    billingEmail: string | null
    planId: string | null
    planExpiresAt: Date | null
    creditBalance: number
    currentPlanId: string | null
    defaultTrackId: string | null
    defaultScalingGroupId: string | null
    isPersonalTeam: number
    personalTeamOwnerId: string | null
    type: string
    canHostCompetitions: number
    parentOrganizationId: string | null
    competitionMetadata: string | null
    createdAt: Date
    updatedAt: Date
  }
}>
```

**Problems:**
- 40+ lines of manual type definition
- Duplicate of schema types
- Won't update if schema changes
- Uses `as unknown as` to bypass type checking

### After

```typescript
import {
  teamMembershipTable,
  type Team,
  type TeamMembership,
} from "@/db/schema"

type TeamMembershipWithTeam = TeamMembership & { team: Team }

const userTeamMemberships = (await db.query.teamMembershipTable.findMany({
  where: eq(teamMembershipTable.userId, userId),
  with: {
    team: true,
  },
})) as TeamMembershipWithTeam[]
```

**Improvements:**
- 4 lines instead of 40+
- Uses schema types
- Auto-updates with schema changes
- Reusable type alias
- Clear intent

## Pattern Recognition

Look for these indicators that the pattern should be applied:

1. **Long inline types** - Any type definition over 10 lines inline
2. **Duplicated schema structure** - Manual types that mirror database tables
3. **`as unknown as`** - The double cast that defeats type checking
4. **Database queries with relations** - Queries using `.with()` or similar relation loading

## Migration Strategy

1. Search for `as unknown as` in the codebase
2. Identify which are database queries with relations
3. Find the schema file with the exported types
4. Create type aliases using intersection types
5. Replace the inline cast
6. Test that TypeScript still validates correctly
