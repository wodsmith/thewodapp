---
sidebar_position: 3
---

# Teams

Manage your gym with WodSmith's multi-tenant team system.

## Team Structure

Each team represents a gym or fitness community:

```
Team (Your Gym)
├── Admins (full access)
├── Coaches (programming access)
└── Members (athletes)
```

## Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access including billing, settings, and member management |
| **Coach** | Create/edit workouts, manage programming, view all scores |
| **Member** | View workouts, log scores, track personal progress |

## Managing Members

### Inviting Members

1. Go to **Settings** → **Members**
2. Click **Invite Member**
3. Enter email and select role
4. Member receives invitation email

### Member Management

- View member profiles and activity
- Change member roles
- Remove members from team
- Export member data

## Team Settings

Configure your team:

- **Profile** - Name, logo, description
- **Timezone** - Default timezone for scheduling
- **Billing** - Subscription and payment settings
- **Integrations** - Connect external services

## Multiple Teams

Users can belong to multiple teams:

- Athletes training at multiple gyms
- Coaches working with different affiliates
- Competition organizers

Switch between teams using the team switcher in the sidebar.

## Privacy

- Team data is isolated between organizations
- Members only see their team's content
- Workouts can be private or shared publicly
