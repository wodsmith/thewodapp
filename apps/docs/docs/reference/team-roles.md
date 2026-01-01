---
sidebar_position: 3
---

# Team Roles Reference

Permissions and capabilities for each team role in WodSmith.

## System Roles

WodSmith defines six system roles in order of privilege:

```
Owner → Admin → Captain → Member → Volunteer → Guest
```

## Role Hierarchy

| Role | Description |
|------|-------------|
| **Owner** | Full control over team. Cannot be removed. One per team. |
| **Admin** | Administrative access with most management capabilities |
| **Captain** | Team leader for competition teams with limited management |
| **Member** | Standard member with content creation and editing access |
| **Volunteer** | Competition volunteer with dashboard access |
| **Guest** | Read-only access to team dashboard |

## Permission Matrix

### Resource Access

| Permission | Owner | Admin | Captain | Member | Volunteer | Guest |
|------------|:-----:|:-----:|:-------:|:------:|:---------:|:-----:|
| Access dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Access billing | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### User Management

| Permission | Owner | Admin | Captain | Member | Volunteer | Guest |
|------------|:-----:|:-----:|:-------:|:------:|:---------:|:-----:|
| Invite members | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Remove members | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Change member roles | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### Team Management

| Permission | Owner | Admin | Captain | Member | Volunteer | Guest |
|------------|:-----:|:-----:|:-------:|:------:|:---------:|:-----:|
| Edit team settings | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Delete team | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

### Role Management

| Permission | Owner | Admin | Captain | Member | Volunteer | Guest |
|------------|:-----:|:-----:|:-------:|:------:|:---------:|:-----:|
| Create custom roles | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Edit custom roles | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Delete custom roles | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Assign roles | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### Content Management

| Permission | Owner | Admin | Captain | Member | Volunteer | Guest |
|------------|:-----:|:-----:|:-------:|:------:|:---------:|:-----:|
| Create components | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit components | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Delete components | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

### Programming & Features

| Permission | Owner | Admin | Captain | Member | Volunteer | Guest |
|------------|:-----:|:-----:|:-------:|:------:|:---------:|:-----:|
| Manage programming | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Manage scaling groups | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Manage competitions | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |

## Role Descriptions

### Owner

Full control over team and all resources. The Owner role has all permissions and cannot be removed from the team. Only one Owner exists per team.

**Exclusive permissions:**
- Delete team
- Cannot be demoted or removed

### Admin

Administrative access with most management capabilities. Admins can manage users, roles, settings, billing, and all content operations.

**Cannot:**
- Delete the team (Owner only)
- Remove or demote the Owner

### Captain

Team leader role designed for competition teams. Captains can manage their team's content but cannot access administrative features.

**Default permissions:**
- Access dashboard
- Create and edit components

**Use case:** Competition team captains managing their squad's roster and details.

### Member

Standard team member with content creation and editing access. Members can create workouts, exercises, and other components but cannot delete them or access management features.

**Default permissions:**
- Access dashboard
- Create and edit components

**Cannot:**
- Delete components
- Manage team settings
- Manage users or roles
- Access billing

### Volunteer

Competition volunteer with basic dashboard access. Designed for event-day helpers who need visibility but not editing capabilities.

**Default permissions:**
- Access dashboard

### Guest

Read-only access to team dashboard. Guests can view content but cannot create, edit, or manage anything.

**Default permissions:**
- Access dashboard

## Role Assignment Rules

- **Team creation**: The user who creates a team automatically becomes the Owner
- **Invitations**: Invited members receive the role specified in their invitation
- **Role changes**: Only Owner and Admin can change member roles
- **Owner protection**: The Owner cannot be demoted or removed
- **Owner transfer**: Ownership transfer requires contacting support
- **Minimum requirement**: Every team must have exactly one Owner

## Custom Roles

Teams can create custom roles with any combination of permissions:

1. Requires `CREATE_ROLES` permission (Owner or Admin)
2. Select from available permissions
3. Assign to members via `ASSIGN_ROLES` permission

Custom roles allow fine-grained access control beyond the six system roles.

## Competition Management

Competitions are managed through team features, not a separate role. Users with the `MANAGE_COMPETITIONS` permission (Owner, Admin) can:

- Create and configure competitions
- Manage registrations and divisions
- Schedule heats and enter scores
- Publish results and manage volunteers

Competition-specific access (judges, volunteers) is handled through team membership with appropriate roles.

---

*See also: [How to Manage Team Members](/how-to/coaches/manage-members)*
