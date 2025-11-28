---
name: permissions
description: Guide for working with team-based permissions and authorization in the WODsmith codebase. Use when touching TEAM_PERMISSIONS constants, hasTeamPermission/requireTeamPermission functions, adding permission checks to actions or server functions, creating features requiring authorization, or ensuring client-server permission consistency.
---

# Permissions

## Overview

WODsmith uses a team-based permissions system with role-based access control. All authorization checks must be consistent between client-side actions and server-side functions.

## Core Principles

**Permission Alignment**: Client-side actions and server-side functions MUST check the same permission. Mismatches cause authorization failures.

**Granular Permissions**: Use the most specific permission available. Prefer `EDIT_COMPONENTS` over `EDIT_TEAM_SETTINGS` when working with workout components.

**Team Context Required**: All permission checks require a `teamId`. The codebase is multi-tenant.

## Permission Categories

Available in `src/db/schemas/teams.ts` as `TEAM_PERMISSIONS`:

**Resource Access**
- `ACCESS_DASHBOARD` - View team dashboard
- `ACCESS_BILLING` - View/manage billing

**User Management**
- `INVITE_MEMBERS` - Invite new members
- `REMOVE_MEMBERS` - Remove team members
- `CHANGE_MEMBER_ROLES` - Modify member roles

**Team Management**
- `EDIT_TEAM_SETTINGS` - Modify team settings
- `DELETE_TEAM` - Delete team

**Role Management**
- `CREATE_ROLES` - Create custom roles
- `EDIT_ROLES` - Modify roles
- `DELETE_ROLES` - Delete roles
- `ASSIGN_ROLES` - Assign roles to members

**Content Management**
- `CREATE_COMPONENTS` - Create workout components (exercises, scaling groups, etc.)
- `EDIT_COMPONENTS` - Modify workout components
- `DELETE_COMPONENTS` - Delete workout components

**Programming**
- `MANAGE_PROGRAMMING` - Manage programming tracks
- `MANAGE_SCALING_GROUPS` - Manage scaling groups

## Permission Checking Patterns

### In Server Actions (src/actions/)

```typescript
export const myAction = createServerAction()
  .input(z.object({ teamId: z.string(), ... }))
  .handler(async ({ input }) => {
    const session = await getSessionFromCookie()
    if (!session) {
      throw new ZSAError("NOT_AUTHORIZED", "Not authenticated")
    }

    // Check permission
    const canEdit = await hasTeamPermission(
      input.teamId,
      TEAM_PERMISSIONS.EDIT_COMPONENTS,
    )

    if (!canEdit) {
      throw new ZSAError("FORBIDDEN", "Cannot edit components")
    }

    // Perform action...
  })
```

### In Server Functions (src/server/)

```typescript
export async function myServerFunction({ teamId, ... }) {
  const db = getDb()

  // Verify team ownership/access
  const [resource] = await db
    .select()
    .from(resourceTable)
    .where(eq(resourceTable.id, resourceId))

  if (!resource) throw new Error("Not found")

  if (resource.teamId) {
    if (!teamId) throw new Error("Forbidden")
    // Must match permission in calling action
    await requireTeamPermission(teamId, TEAM_PERMISSIONS.EDIT_COMPONENTS)
    if (resource.teamId !== teamId) throw new Error("Forbidden")
  }

  // Perform operation...
}
```

## Common Patterns

### Workflow Components (Scaling, Exercises, etc.)

Use the COMPONENTS family:
- Actions calling create functions: `CREATE_COMPONENTS`
- Actions calling update functions: `EDIT_COMPONENTS`
- Actions calling delete functions: `DELETE_COMPONENTS`

### Team Settings

Use `EDIT_TEAM_SETTINGS` for:
- Default scaling group assignment
- Team profile updates
- Team configuration

### Checking Multiple Call Sites

When fixing permission mismatches:

1. **Identify the mismatch**: Action uses Permission A, server function uses Permission B
2. **Check related operations**: Look at sibling actions (create/update/delete) for consistency
3. **Determine correct permission**: Match the granularity of the operation
4. **Update the wrong side**: Usually update server functions to match actions
5. **Verify call sites**: Search for all calls to ensure compatibility

### Example Fix

```typescript
// BEFORE: Mismatch
// Action (scaling-actions.ts)
const canEdit = await hasTeamPermission(
  input.teamId,
  TEAM_PERMISSIONS.EDIT_COMPONENTS, // ❌ Different
)

// Server function (scaling-levels.ts)
await requireTeamPermission(
  teamId,
  TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS, // ❌ Different
)

// AFTER: Aligned
// Action
const canEdit = await hasTeamPermission(
  input.teamId,
  TEAM_PERMISSIONS.EDIT_COMPONENTS, // ✅ Match
)

// Server function
await requireTeamPermission(
  teamId,
  TEAM_PERMISSIONS.EDIT_COMPONENTS, // ✅ Match
)
```

## Permission Utilities

Located in `src/utils/team-auth.ts`:

**Check Functions** (return boolean)
- `hasTeamPermission(teamId, permission)` - Check if user has permission
- `hasTeamRole(teamId, roleId, isSystemRole)` - Check if user has role
- `isTeamMember(teamId)` - Check if user is member

**Require Functions** (throw ZSAError if unauthorized)
- `requireTeamPermission(teamId, permission)` - Require permission or throw
- `requireTeamRole(teamId, roleId, isSystemRole)` - Require role or throw
- `requireTeamMembership(teamId)` - Require membership or throw

**Use check functions in actions** for manual error handling.
**Use require functions in server functions** for automatic error throwing.

## Validation Checklist

When working with permissions:

- [ ] Action and server function use the same permission constant
- [ ] Permission is appropriate for the operation's granularity
- [ ] `teamId` is validated and passed through call chain
- [ ] Both client and server handle unauthorized cases
- [ ] Related operations (CRUD siblings) use consistent permission family
- [ ] Type checking passes after changes
- [ ] Consider if new feature needs a new permission constant

## Adding New Permissions

1. Add to `TEAM_PERMISSIONS` in `src/db/schemas/teams.ts`
2. Update default role permissions if needed
3. Use consistently across actions and server functions
4. Document purpose in this skill's references

## References

See `references/permissions-reference.md` for:
- Complete list of all permissions with descriptions
- System roles and their default permissions
- Permission hierarchy and inheritance
