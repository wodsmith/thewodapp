# Multi-Tenancy Support Report

## Overview

This application implements a comprehensive multi-tenancy system built around **Teams** as the primary organizational unit. The system provides robust organization management, role-based access control (RBAC), and permission-based authorization suitable for SaaS applications.

## Architecture Overview

### Core Entities

1. **Teams** (`team` table) - Primary organizational units
2. **Team Memberships** (`team_membership` table) - User-team relationships
3. **Team Roles** (`team_role` table) - Custom roles with permissions
4. **Team Invitations** (`team_invitation` table) - Invitation management

### Key Features

- ✅ Multi-tenant team isolation
- ✅ Hierarchical role system (system + custom roles)
- ✅ Granular permission-based access control
- ✅ Invitation-based team joining
- ✅ Resource sharing controls
- ✅ Per-tenant configurations
- ✅ Team collaboration features

## Database Schema

### Teams Table

```sql
CREATE TABLE team (
  id TEXT PRIMARY KEY,           -- team_[cuid]
  name TEXT(255) NOT NULL,
  slug TEXT(255) UNIQUE NOT NULL,
  description TEXT(1000),
  avatarUrl TEXT(600),
  settings TEXT(10000),          -- JSON configuration
  billingEmail TEXT(255),
  planId TEXT(100),
  planExpiresAt INTEGER,
  creditBalance INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### Team Memberships Table

```sql
CREATE TABLE team_membership (
  id TEXT PRIMARY KEY,           -- tmem_[cuid]
  teamId TEXT NOT NULL,
  userId TEXT NOT NULL,
  roleId TEXT NOT NULL,          -- System role name OR custom role ID
  isSystemRole INTEGER DEFAULT 1, -- 1 for system roles, 0 for custom
  invitedBy TEXT,
  invitedAt INTEGER,
  joinedAt INTEGER,
  expiresAt INTEGER,
  isActive INTEGER DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### Team Roles Table (Custom Roles)

```sql
CREATE TABLE team_role (
  id TEXT PRIMARY KEY,           -- trole_[cuid]
  teamId TEXT NOT NULL,
  name TEXT(255) NOT NULL,
  description TEXT(1000),
  permissions TEXT NOT NULL,     -- JSON array of permission strings
  metadata TEXT(5000),           -- JSON for UI settings (color, icon, etc.)
  isEditable INTEGER DEFAULT 1,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

### Team Invitations Table

```sql
CREATE TABLE team_invitation (
  id TEXT PRIMARY KEY,           -- tinv_[cuid]
  teamId TEXT NOT NULL,
  email TEXT(255) NOT NULL,
  roleId TEXT NOT NULL,
  isSystemRole INTEGER DEFAULT 1,
  token TEXT(255) UNIQUE NOT NULL,
  invitedBy TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  acceptedAt INTEGER,
  acceptedBy TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
```

## Role System

### System Roles

The application defines four built-in system roles:

```typescript
export const SYSTEM_ROLES_ENUM = {
  OWNER: "owner", // Full control, cannot be removed
  ADMIN: "admin", // Administrative privileges
  MEMBER: "member", // Standard member access
  GUEST: "guest", // Limited read-only access
} as const;
```

#### System Role Permissions

- **Owner**: All permissions (cannot be removed from team)
- **Admin**: All permissions except team deletion
- **Member**: Basic access + content creation/editing
- **Guest**: Dashboard access only

### Custom Roles

Teams can create custom roles with specific permission sets:

```typescript
interface CustomRole {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  permissions: string[];
  metadata?: Record<string, unknown>; // UI settings
  isEditable: boolean;
}
```

## Permission System

### Available Permissions

```typescript
export const TEAM_PERMISSIONS = {
  // Resource access
  ACCESS_DASHBOARD: "access_dashboard",
  ACCESS_BILLING: "access_billing",

  // User management
  INVITE_MEMBERS: "invite_members",
  REMOVE_MEMBERS: "remove_members",
  CHANGE_MEMBER_ROLES: "change_member_roles",

  // Team management
  EDIT_TEAM_SETTINGS: "edit_team_settings",
  DELETE_TEAM: "delete_team",

  // Role management
  CREATE_ROLES: "create_roles",
  EDIT_ROLES: "edit_roles",
  DELETE_ROLES: "delete_roles",
  ASSIGN_ROLES: "assign_roles",

  // Content permissions
  CREATE_COMPONENTS: "create_components",
  EDIT_COMPONENTS: "edit_components",
  DELETE_COMPONENTS: "delete_components",
} as const;
```

### Permission Checking

The system provides utility functions for permission checking:

```typescript
// Check if user has specific permission
await hasTeamPermission(teamId, TEAM_PERMISSIONS.INVITE_MEMBERS);

// Require permission (throws if not authorized)
await requireTeamPermission(teamId, TEAM_PERMISSIONS.DELETE_TEAM);
```

## Track Subscription Ownership Logic

### Overview
The track subscription feature implements robust ownership and permission checks to ensure users can only subscribe teams they have appropriate access to. This section details the ownership validation logic for team programming track subscriptions.

### Ownership Check Flow

#### 1. Team Access Validation
```typescript
// Server action validates team access before subscription
export const subscribeTrackAction = createServerAction()
  .input(subscribeTrackSchema)
  .handler(async ({ input }) => {
    const session = await getSessionFromCookie();
    if (!session?.user) throw new Error("Unauthorized");

    const { trackId, teamId } = input;

    // If teamId not provided, use personal team
    const targetTeamId = teamId || await getUserPersonalTeam(session.user.id);

    // Validate user has permission to subscribe this team
    await requireTeamPermission(targetTeamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD);

    // Execute subscription
    return await TeamProgrammingTrackService.subscribeTeamToTrack({
      teamId: targetTeamId,
      trackId
    });
  });
```

#### 2. Team Membership Verification
The system verifies team membership through the `team_membership` table:

```sql
-- Check if user is active member of team
SELECT tm.* FROM team_membership tm
WHERE tm.teamId = ?
  AND tm.userId = ?
  AND tm.isActive = 1
  AND (tm.expiresAt IS NULL OR tm.expiresAt > ?)
```

#### 3. Permission-Based Access Control
Subscription permissions are checked using the existing RBAC system:

```typescript
// Permission levels for subscription actions
const SUBSCRIPTION_PERMISSIONS = {
  SUBSCRIBE_TEAM: "access_dashboard",    // Minimum: dashboard access
  MANAGE_SUBSCRIPTIONS: "admin",         // Advanced: admin role required
  BULK_SUBSCRIBE: "owner"                // Full control: owner only
};
```

### Personal Team Handling

#### Automatic Personal Team Resolution
When no `teamId` is provided in subscription requests, the system automatically resolves to the user's personal team:

```typescript
export async function getUserPersonalTeam(userId: string) {
  const db = getDB();

  const personalTeam = await db.query.teamTable.findFirst({
    where: and(
      eq(teamTable.personalTeamOwnerId, userId),
      eq(teamTable.isPersonalTeam, 1)
    )
  });

  if (!personalTeam) {
    throw new Error("Personal team not found");
  }

  return personalTeam.id;
}
```

#### Personal Team Characteristics
- Created automatically on user registration
- User is always the owner with full permissions
- Cannot be deleted or transferred
- Enables individual user subscriptions

### Multi-Team Subscription Workflow

#### Client-Side Team Selection
```typescript
// UI component handles multi-team scenarios
const SubscribeButton = ({ trackId }: { trackId: string }) => {
  const [userTeams, setUserTeams] = useState([]);

  const handleSubscribe = async (selectedTeamId?: string) => {
    // Load user teams if not already loaded
    if (!userTeams.length) {
      const teams = await getUserAccessibleTeams();
      setUserTeams(teams);
    }

    // Single team: direct subscription
    if (teams.length === 1) {
      return await subscribeTrackAction({ trackId, teamId: teams[0].id });
    }

    // Multiple teams: show selection dropdown
    if (!selectedTeamId) {
      // Show team selection UI
      return;
    }

    // Subscribe with selected team
    return await subscribeTrackAction({ trackId, teamId: selectedTeamId });
  };
};
```

#### Team Access Filtering
Only teams where the user has subscription permissions are shown:

```typescript
async function getUserAccessibleTeams(userId: string) {
  const db = getDB();

  return await db.query.teamTable.findMany({
    where: exists(
      db.select()
        .from(teamMembershipTable)
        .where(and(
          eq(teamMembershipTable.teamId, teamTable.id),
          eq(teamMembershipTable.userId, userId),
          eq(teamMembershipTable.isActive, 1)
        ))
    )
  });
}
```

### Security Considerations

#### Validation Layers
1. **Client-side**: UI only shows accessible teams
2. **Server-side**: Strict permission validation in server actions
3. **Database**: Foreign key constraints ensure data integrity

#### Attack Prevention
- **Team ID tampering**: Server validates all team access
- **Unauthorized subscriptions**: Permission checks prevent access
- **Data isolation**: Team-scoped queries prevent cross-tenant access

#### Error Handling
```typescript
// Standardized error responses
if (!hasTeamAccess) {
  throw new ZSAError("FORBIDDEN", "Insufficient team permissions");
}

if (!teamExists) {
  throw new ZSAError("NOT_FOUND", "Team not found");
}

if (!trackExists) {
  throw new ZSAError("NOT_FOUND", "Programming track not found");
}
```

### Audit Trail

#### Subscription Tracking
All subscription actions are logged with full context:

```typescript
console.log(`INFO: [TeamProgrammingTrackService] teamId="${teamId}" trackId="${trackId}" action="subscribe"`);
console.log(`ACTION: subscribeTrack user="${userId}" teamId="${teamId}" trackId="${trackId}"`);
```

#### Database Audit Fields
- `subscribedAt`: Timestamp of subscription creation
- `createdAt`/`updatedAt`: Standard audit fields
- `updateCounter`: Optimistic locking support

## API Reference

### Team Management APIs

#### Server Actions

```typescript
// Team CRUD operations
createTeamAction(data: CreateTeamInput)
updateTeamAction(data: UpdateTeamInput)
deleteTeamAction(data: { teamId: string })
getUserTeamsAction()
```

#### Server Functions

```typescript
// Team operations
createTeam({ name, description, avatarUrl });
updateTeam({ teamId, data });
deleteTeam(teamId);
getUserTeams(userId);
```

### Member Management APIs

#### Server Actions

```typescript
// Member management
inviteUserToTeamAction(data: InviteUserInput)
updateTeamMemberRoleAction(data: UpdateMemberRoleInput)
removeTeamMemberAction(data: RemoveMemberInput)
getTeamMembersAction(data: { teamId: string })

// Invitation management
acceptTeamInvitationAction(data: { token: string })
cancelTeamInvitationAction(data: { invitationId: string })
getPendingInvitationsAction()
```

#### Server Functions

```typescript
// Member operations
getTeamMembers(teamId);
inviteUserToTeam({ teamId, email, roleId, isSystemRole });
updateTeamMemberRole({ teamId, userId, roleId, isSystemRole });
removeTeamMember({ teamId, userId });

// Invitation operations
acceptTeamInvitation(token);
cancelTeamInvitation(invitationId);
getTeamInvitations(teamId);
```

### Role Management APIs

#### Server Actions

```typescript
// Role management
createTeamRoleAction(data: CreateRoleInput)
updateTeamRoleAction(data: UpdateRoleInput)
deleteTeamRoleAction(data: DeleteRoleInput)
getTeamRolesAction(data: { teamId: string })
```

#### Server Functions

```typescript
// Role operations
createTeamRole({ teamId, name, description, permissions, metadata });
updateTeamRole({ teamId, roleId, data });
deleteTeamRole({ teamId, roleId });
getTeamRoles(teamId);
```

### Authentication & Authorization APIs

#### Utility Functions

```typescript
// Team membership checks
getUserTeams(); // Get user's teams
isTeamMember(teamId); // Check membership
hasTeamMembership(teamId); // Check with session data
requireTeamMembership(teamId); // Require membership (throws)

// Role checks
hasTeamRole(teamId, roleId, isSystemRole);
hasSystemRole(teamId, role);
requireTeamRole(teamId, roleId, isSystemRole);
requireSystemRole(teamId, role);

// Permission checks
hasTeamPermission(teamId, permission);
requireTeamPermission(teamId, permission);
```

## Usage Examples

### Creating a Team

```typescript
import { createTeamAction } from "@/actions/team-actions";

const [result, error] = await createTeamAction({
  name: "My Team",
  description: "A team for collaboration",
  avatarUrl: "https://example.com/avatar.png",
});

if (result?.success) {
  console.log("Team created:", result.data);
}
```

### Inviting Members

```typescript
import { inviteUserToTeamAction } from "@/actions/team-membership-actions";

const [result, error] = await inviteUserToTeamAction({
  teamId: "team_abc123",
  email: "user@example.com",
  roleId: "member",
  isSystemRole: true,
});
```

### Creating Custom Roles

```typescript
import { createTeamRoleAction } from "@/actions/team-role-actions";

const [result, error] = await createTeamRoleAction({
  teamId: "team_abc123",
  name: "Editor",
  description: "Can edit content",
  permissions: ["access_dashboard", "create_components", "edit_components"],
  metadata: {
    color: "#3b82f6",
    icon: "edit",
  },
});
```

### Checking Permissions in Components

```typescript
import { hasTeamPermission } from "@/utils/team-auth";
import { TEAM_PERMISSIONS } from "@/db/schema";

export default async function TeamPage({ teamId }: { teamId: string }) {
  const canInvite = await hasTeamPermission(
    teamId,
    TEAM_PERMISSIONS.INVITE_MEMBERS
  );
  const canManageRoles = await hasTeamPermission(
    teamId,
    TEAM_PERMISSIONS.CREATE_ROLES
  );

  return (
    <div>
      {canInvite && <InviteMemberButton teamId={teamId} />}
      {canManageRoles && <ManageRolesButton teamId={teamId} />}
    </div>
  );
}
```

### Protecting Server Actions

```typescript
import { requireTeamPermission } from "@/utils/team-auth";
import { TEAM_PERMISSIONS } from "@/db/schema";

export async function deleteTeamContent(teamId: string, contentId: string) {
  // Ensure user has permission
  await requireTeamPermission(teamId, TEAM_PERMISSIONS.DELETE_COMPONENTS);

  // Proceed with deletion
  // ...
}
```

## Configuration & Limits

### Team Limits

```typescript
export const MAX_TEAMS_CREATED_PER_USER = 3; // Teams a user can create
export const MAX_TEAMS_JOINED_PER_USER = 10; // Teams a user can join
```

### Invitation Settings

- Invitations expire after 7 days
- Unique tokens for security
- Email-based invitation system

## Security Features

### Tenant Isolation

- All data is scoped by `teamId`
- Database queries include team context
- Permission checks on every operation

### Access Control

- Role-based permissions
- Granular permission system
- Owner protection (cannot be removed)

### Session Management

- Team data cached in user sessions
- Automatic session updates on role changes
- Multi-session support

## UI Components

### Available Components

- `CreateTeamForm` - Team creation
- `InviteMemberModal` - Member invitation
- `RemoveMemberButton` - Member removal
- Team dashboard pages
- Member management tables

### Navigation Structure

```
/dashboard/teams                    # Team list
/dashboard/teams/create            # Create team
/dashboard/teams/[slug]            # Team dashboard
/dashboard/teams/[slug]/settings   # Team settings (if implemented)
```

## Best Practices

### When Building on This System

1. **Always Check Permissions**: Use `requireTeamPermission()` in server actions
2. **Scope Data by Team**: Include `teamId` in all queries
3. **Use Type-Safe Permissions**: Import from `TEAM_PERMISSIONS` constant
4. **Handle Edge Cases**: Check for team ownership before sensitive operations
5. **Update Sessions**: Call `updateAllSessionsOfUser()` after role changes

### Extending the System

1. **Adding New Permissions**: Add to `TEAM_PERMISSIONS` object
2. **Custom Role Logic**: Extend the role creation system
3. **Team Settings**: Use the `settings` JSON field for team-specific config
4. **Billing Integration**: Leverage `planId` and `creditBalance` fields

## Future Enhancements

### Potential Improvements

- Role hierarchies and inheritance
- Time-based role assignments
- Audit logging for team actions
- Advanced permission conditions
- Team templates and presets
- Resource quotas per team
- Advanced billing integration

This multi-tenancy system provides a solid foundation for building collaborative SaaS applications with proper isolation, security, and scalability.
