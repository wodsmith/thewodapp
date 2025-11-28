# Permissions Reference

Complete reference for WODsmith's team-based permissions system.

## All Available Permissions

Defined in `src/db/schemas/teams.ts` as `TEAM_PERMISSIONS` constant.

### Resource Access

**ACCESS_DASHBOARD**
- View team dashboard and basic team information
- Required for any team interaction
- Default: All roles

**ACCESS_BILLING**
- View and manage team billing information
- Access to credits, subscriptions, payment methods
- Default: Owner, Admin

### User Management

**INVITE_MEMBERS**
- Send invitations to new team members
- Generate invitation links
- Default: Owner, Admin

**REMOVE_MEMBERS**
- Remove members from the team
- Revoke team access
- Default: Owner, Admin

**CHANGE_MEMBER_ROLES**
- Modify roles assigned to team members
- Update member permissions
- Default: Owner, Admin

### Team Management

**EDIT_TEAM_SETTINGS**
- Modify team profile (name, slug, description)
- Update team configuration
- Set default scaling groups
- Manage team-wide preferences
- Default: Owner, Admin

**DELETE_TEAM**
- Permanently delete the team
- Irreversible action
- Default: Owner only

### Role Management

**CREATE_ROLES**
- Create new custom roles
- Define role permissions
- Default: Owner, Admin

**EDIT_ROLES**
- Modify existing custom roles
- Update role permissions
- Cannot edit system roles
- Default: Owner, Admin

**DELETE_ROLES**
- Delete custom roles
- Cannot delete system roles
- Default: Owner, Admin

**ASSIGN_ROLES**
- Assign custom roles to members
- Manage role assignments
- Default: Owner, Admin

### Content Management

**CREATE_COMPONENTS**
- Create workout components:
  - Exercises and movements
  - Scaling groups
  - Workout templates
  - Programming elements
- Default: Owner, Admin, Member

**EDIT_COMPONENTS**
- Modify workout components:
  - Update exercises
  - Edit scaling groups and levels
  - Modify workout details
  - Update programming tracks
- Default: Owner, Admin, Member

**DELETE_COMPONENTS**
- Delete workout components:
  - Remove exercises
  - Delete scaling groups
  - Remove workouts
  - Delete programming elements
- Default: Owner, Admin

### Programming Management

**MANAGE_PROGRAMMING**
- Create and manage programming tracks
- Schedule workouts
- Configure track settings
- Default: Owner, Admin

**MANAGE_SCALING_GROUPS**
- Create and manage scaling groups
- Configure default scaling
- Manage scaling levels
- Default: Owner, Admin

## System Roles

Defined in `src/db/schemas/teams.ts` as `SYSTEM_ROLES_ENUM`.

### Owner

**Role ID:** `"owner"`

**Description:** Full control over team and all resources. Cannot be deleted or modified.

**Default Permissions:**
- All permissions

**Restrictions:**
- Cannot be removed from team
- Only one owner per team
- Owner role cannot be deleted

### Admin

**Role ID:** `"admin"`

**Description:** Administrative access with most management capabilities.

**Default Permissions:**
- ACCESS_DASHBOARD
- ACCESS_BILLING
- INVITE_MEMBERS
- REMOVE_MEMBERS
- CHANGE_MEMBER_ROLES
- EDIT_TEAM_SETTINGS
- CREATE_ROLES
- EDIT_ROLES
- DELETE_ROLES
- ASSIGN_ROLES
- CREATE_COMPONENTS
- EDIT_COMPONENTS
- DELETE_COMPONENTS
- MANAGE_PROGRAMMING
- MANAGE_SCALING_GROUPS

**Cannot:**
- DELETE_TEAM (owner only)

### Captain

**Role ID:** `"captain"`

**Description:** Team leader for competition teams. Limited management access.

**Default Permissions:**
- ACCESS_DASHBOARD
- CREATE_COMPONENTS
- EDIT_COMPONENTS

**Use Case:** Competition team captains managing their team's roster and details.

### Member

**Role ID:** `"member"`

**Description:** Standard team member with content creation and editing access.

**Default Permissions:**
- ACCESS_DASHBOARD
- CREATE_COMPONENTS
- EDIT_COMPONENTS

**Cannot:**
- Delete components
- Manage team settings
- Manage users
- Manage roles

### Guest

**Role ID:** `"guest"`

**Description:** Read-only access to team dashboard.

**Default Permissions:**
- ACCESS_DASHBOARD

**Cannot:**
- Create or modify any content
- Access billing
- Manage team settings

## Permission Patterns by Feature

### Scaling Groups & Levels

**Creating Scaling Group:**
- Action: `CREATE_COMPONENTS`
- Server: `EDIT_TEAM_SETTINGS` (when setting as default)

**Editing Scaling Group:**
- Action: `EDIT_COMPONENTS`
- Server: `EDIT_COMPONENTS`

**Deleting Scaling Group:**
- Action: `DELETE_COMPONENTS`
- Server: `DELETE_COMPONENTS`

**Creating Scaling Level:**
- Action: `EDIT_COMPONENTS`
- Server: `EDIT_COMPONENTS`

**Updating Scaling Level:**
- Action: `EDIT_COMPONENTS`
- Server: `EDIT_COMPONENTS`

**Deleting Scaling Level:**
- Action: `EDIT_COMPONENTS`
- Server: `EDIT_COMPONENTS`

**Reordering Levels:**
- Action: `EDIT_COMPONENTS`
- Server: `EDIT_COMPONENTS`

### Workout Management

**Creating Workout:**
- Action: `CREATE_COMPONENTS`
- Server: `CREATE_COMPONENTS`

**Editing Workout:**
- Action: `EDIT_COMPONENTS`
- Server: `EDIT_COMPONENTS`

**Deleting Workout:**
- Action: `DELETE_COMPONENTS`
- Server: `DELETE_COMPONENTS`

### Programming Tracks

**Creating Track:**
- Action: `MANAGE_PROGRAMMING`
- Server: `MANAGE_PROGRAMMING`

**Editing Track:**
- Action: `MANAGE_PROGRAMMING`
- Server: `MANAGE_PROGRAMMING`

**Deleting Track:**
- Action: `MANAGE_PROGRAMMING`
- Server: `MANAGE_PROGRAMMING`

## Custom Roles

Teams can create custom roles with any combination of permissions.

**Creating Custom Roles:**
1. Requires `CREATE_ROLES` permission
2. Define role name and description
3. Select permissions from `TEAM_PERMISSIONS`
4. Store in `team_role` table

**Permission Storage:**
- Stored as JSON array in `team_role.permissions` column
- Example: `["access_dashboard", "create_components", "edit_components"]`

**Assigning Custom Roles:**
- Set `team_membership.roleId` to custom role ID
- Set `team_membership.isSystemRole = 0`
- Requires `ASSIGN_ROLES` permission

## Authorization Flow

### In Actions (Client-Side)

```
1. User triggers action (e.g., delete scaling level)
2. Action receives teamId in input
3. Action calls hasTeamPermission(teamId, permission)
4. Session store checks if user has permission for team
5. If no permission: throw ZSAError("FORBIDDEN")
6. If has permission: call server function
```

### In Server Functions (Server-Side)

```
1. Server function receives teamId parameter
2. Function queries resource by ID
3. Verifies resource belongs to team
4. Calls requireTeamPermission(teamId, permission)
5. Permission check against session
6. If no permission: throw Error("Forbidden")
7. If has permission: execute operation
```

### Permission Resolution

```
1. User session contains teams array
2. Each team includes:
   - team.id
   - team.role (roleId, isSystemRole)
   - team.permissions (array of permission strings)
3. hasTeamPermission checks if permission in team.permissions
4. Permissions resolved from:
   - System role defaults (if isSystemRole = 1)
   - Custom role permissions (if isSystemRole = 0)
```

## Common Permission Errors

### "FORBIDDEN" Error

**Cause:** User lacks required permission for operation.

**Solutions:**
1. Verify user has correct role
2. Check if custom role includes permission
3. Ensure permission constant matches between action and server

### Permission Mismatch

**Cause:** Action checks different permission than server function.

**Example:**
```typescript
// Action
hasTeamPermission(teamId, TEAM_PERMISSIONS.EDIT_COMPONENTS)

// Server (wrong)
requireTeamPermission(teamId, TEAM_PERMISSIONS.EDIT_TEAM_SETTINGS)
```

**Solution:** Align permissions to match.

### Missing Team Context

**Cause:** Operation attempted without teamId.

**Solution:** Always pass teamId through call chain.

## Best Practices

1. **Use most specific permission** - Prefer granular permissions over broad ones
2. **Match action and server** - Always use same permission in both layers
3. **Check related operations** - Keep CRUD operations consistent
4. **Validate team ownership** - Always verify resource belongs to team
5. **Document new permissions** - Add to this reference when creating new permissions
6. **Test both authorized and unauthorized** - Verify permission checks work correctly
7. **Consider permission hierarchy** - Some operations may require multiple checks
