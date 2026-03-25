---
sidebar_position: 6
---

# Broadcasts

Technical reference for the broadcast messaging system.

## Audience Filters

Each broadcast targets a specific audience using a filter:

| Filter Type | Description | Additional Parameter |
|-------------|-------------|---------------------|
| `public` | All athletes and volunteers | None |
| `all` | All registered athletes | None |
| `division` | Athletes in a specific division | Division ID |
| `volunteers` | All registered volunteers | None |
| `volunteer_role` | Volunteers with a specific role | Role name |

### Volunteer Roles

The following volunteer roles can be targeted:

- Judge
- Head Judge
- Scorekeeper
- Check-In
- Medical
- Emcee
- Floor Manager
- Equipment
- Equipment Team
- Media
- Athlete Control
- Staff
- General

## Delivery

Broadcasts are delivered through two channels:

- **In-app** — appears on the competition's Announcements tab for athletes
- **Email** — sent asynchronously via a background queue (optional, enabled by default)

### Email Delivery Statuses

Each recipient's email delivery is tracked individually:

| Status | Meaning |
|--------|---------|
| `queued` | Waiting to be sent |
| `sent` | Successfully delivered |
| `failed` | Delivery failed |
| `skipped` | Email disabled or no API key configured |

Emails use per-recipient idempotency keys to prevent duplicate delivery on retries. Messages are batched in groups of up to 100 recipients per queue message.

## Permissions

Only competition organizers (team members with organizer permissions) can create and send broadcasts. Athletes and volunteers can only view broadcasts targeted to them.
