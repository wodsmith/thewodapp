---
sidebar_position: 3
---

# Team Roles Reference

Permissions and capabilities for each team role in WodSmith.

## Role Hierarchy

```
Admin → Coach → Member
```

Higher roles inherit all permissions from lower roles.

## Permission Matrix

### Content Permissions

| Permission | Admin | Coach | Member |
|------------|:-----:|:-----:|:------:|
| View published workouts | ✓ | ✓ | ✓ |
| View draft workouts | ✓ | ✓ | ✗ |
| Log personal scores | ✓ | ✓ | ✓ |
| View all member scores | ✓ | ✓ | ✗ |
| Create workouts | ✓ | ✓ | ✗ |
| Edit any workout | ✓ | ✓ | ✗ |
| Delete workouts | ✓ | ✓ | ✗ |

### Programming Permissions

| Permission | Admin | Coach | Member |
|------------|:-----:|:-----:|:------:|
| View calendar | ✓ | ✓ | ✓ |
| Schedule workouts | ✓ | ✓ | ✗ |
| Manage tracks | ✓ | ✓ | ✗ |
| Create templates | ✓ | ✓ | ✗ |
| Publish programming | ✓ | ✓ | ✗ |

### Team Management Permissions

| Permission | Admin | Coach | Member |
|------------|:-----:|:-----:|:------:|
| View member list | ✓ | ✓ | ✗ |
| Invite members | ✓ | ✗ | ✗ |
| Remove members | ✓ | ✗ | ✗ |
| Change member roles | ✓ | ✗ | ✗ |
| View team analytics | ✓ | ✓ | ✗ |

### Administrative Permissions

| Permission | Admin | Coach | Member |
|------------|:-----:|:-----:|:------:|
| Edit team settings | ✓ | ✗ | ✗ |
| Manage billing | ✓ | ✗ | ✗ |
| Configure integrations | ✓ | ✗ | ✗ |
| Delete team | ✓ | ✗ | ✗ |
| Transfer ownership | ✓ | ✗ | ✗ |

## Role Descriptions

### Admin

Full access to all team features including billing, settings, and member management. At least one admin required per team.

### Coach

Programming and workout management access. Can create content and view all member activity. Cannot manage team settings or billing.

### Member

Standard athlete access. Can view published content and log personal scores. Limited to personal data only.

## Role Assignment Rules

- New team creators automatically become Admin
- Invited members receive role specified in invitation
- Admins can change any member's role
- Admins cannot demote themselves if they're the only Admin
- Minimum one Admin required per team

## Competition Organizer Role

Competition-specific role (separate from team roles):

| Permission | Organizer |
|------------|:---------:|
| Edit competition settings | ✓ |
| Manage registrations | ✓ |
| Enter scores | ✓ |
| Publish results | ✓ |
| View revenue | ✓ |

---

*See also: [How to Manage Team Members](/how-to/coaches/manage-members)*
