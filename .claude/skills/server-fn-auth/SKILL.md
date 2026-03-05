---
name: server-fn-auth
description: |
  Authentication and authorization patterns for TanStack Start server functions.
  Use when: adding auth to a new server function, fixing missing authorization,
  checking user permissions, protecting endpoints, or implementing organizer/volunteer
  access control for competitions.
---

# Server Function Authentication

## Quick Reference

### Pattern 1: Permission-Based (Most Common)

For operations requiring a specific team permission:

```typescript
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { requireTeamPermission } from "@/utils/team-auth"

export const myServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      teamId: z.string().startsWith("team_"),
      // ... other fields
    }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireTeamPermission(data.teamId, TEAM_PERMISSIONS.MANAGE_COMPETITIONS)
    // ... rest of handler
  })
```

### Pattern 2: Competition Access (Organizer OR Volunteer)

For read operations accessible to competition organizers and volunteers:

```typescript
import { and, eq } from "drizzle-orm"
import { SYSTEM_ROLES_ENUM } from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import { getSessionFromCookie } from "@/utils/auth"
import { teamMembershipTable } from "@/db/schema"

export const myServerFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({
      competitionId: z.string().startsWith("comp_"),
      organizingTeamId: z.string().startsWith("team_"),
      competitionTeamId: z.string().startsWith("team_").nullable(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()

    if (!session?.userId) {
      throw new Error("Unauthorized: Must be logged in")
    }

    // Site admins bypass all checks
    if (session.user?.role === ROLES_ENUM.ADMIN) {
      // proceed with handler
    } else {
      let canAccess = false

      // Check if organizer (admin/owner of organizing team)
      const orgMembership = await db
        .select({ roleId: teamMembershipTable.roleId })
        .from(teamMembershipTable)
        .where(
          and(
            eq(teamMembershipTable.teamId, data.organizingTeamId),
            eq(teamMembershipTable.userId, session.userId),
            eq(teamMembershipTable.isActive, 1),
          ),
        )
        .limit(1)

      if (
        orgMembership[0]?.roleId === SYSTEM_ROLES_ENUM.ADMIN ||
        orgMembership[0]?.roleId === SYSTEM_ROLES_ENUM.OWNER
      ) {
        canAccess = true
      }

      // Check if volunteer
      if (!canAccess && data.competitionTeamId) {
        const volMembership = await db
          .select({ id: teamMembershipTable.id })
          .from(teamMembershipTable)
          .where(
            and(
              eq(teamMembershipTable.teamId, data.competitionTeamId),
              eq(teamMembershipTable.userId, session.userId),
              eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
              eq(teamMembershipTable.isSystemRole, 1),
              eq(teamMembershipTable.isActive, 1),
            ),
          )
          .limit(1)

        if (volMembership[0]) {
          canAccess = true
        }
      }

      if (!canAccess) {
        throw new Error("Unauthorized: Must be an organizer or volunteer")
      }
    }

    // ... rest of handler
  })
```

## Available Utilities

### From `@/utils/team-auth`

| Function | Use Case |
|----------|----------|
| `requireTeamPermission(teamId, permission)` | Throws if user lacks permission |
| `hasTeamPermission(teamId, permission)` | Returns boolean, doesn't throw |
| `requireTeamMembership(teamId)` | Throws if not a team member |
| `isTeamMember(teamId)` | Returns boolean |

### From `@/utils/auth`

| Function | Use Case |
|----------|----------|
| `getSessionFromCookie()` | Get current user session |

## Constants

### TEAM_PERMISSIONS (from `@/db/schemas/teams`)

- `MANAGE_COMPETITIONS` - Create/edit competitions
- `MANAGE_PROGRAMMING` - Manage programming tracks
- `MANAGE_SCALING_GROUPS` - Manage scaling options
- `INVITE_MEMBERS`, `REMOVE_MEMBERS` - Member management
- `EDIT_TEAM_SETTINGS`, `DELETE_TEAM` - Team settings
- `ACCESS_DASHBOARD`, `ACCESS_BILLING` - Resource access

### SYSTEM_ROLES_ENUM (from `@/db/schemas/teams`)

- `OWNER` - Team owner (full access)
- `ADMIN` - Team admin (full access)
- `CAPTAIN` - Competition team captain
- `MEMBER` - Regular member
- `VOLUNTEER` - Competition volunteer
- `GUEST` - Limited access

### ROLES_ENUM (from `@/db/schemas/users`)

- `ADMIN` - Site admin (bypasses all team checks)
- `USER` - Regular user

## Key Principles

1. **Always add auth to server functions** - Route-level guards are not enough; server functions can be called directly
2. **Site admins bypass checks** - Check `session.user?.role === ROLES_ENUM.ADMIN` first
3. **Include required IDs in input schema** - Add `teamId`, `organizingTeamId`, etc. to enable auth checks
4. **Update callers when adding auth params** - Routes/components must pass the new required fields
