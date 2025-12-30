---
sidebar_position: 5
---

# Competition Settings Reference

All configurable options for WodSmith competitions.

## General Settings

| Setting | Type | Description |
|---------|------|-------------|
| **Name** | String | Competition display name |
| **Slug** | String | URL identifier (auto-generated) |
| **Date** | DateTime | Competition date and time |
| **End Date** | DateTime | Optional multi-day end |
| **Location** | String | Venue name and address |
| **Description** | Text | Markdown-supported description |
| **Published** | Boolean | Publicly visible |

## Registration Settings

| Setting | Type | Description |
|---------|------|-------------|
| **Opens At** | DateTime | Registration open date |
| **Closes At** | DateTime | Registration close date |
| **Require Approval** | Boolean | Manual registration approval |
| **Waitlist Enabled** | Boolean | Allow waitlist signups |
| **Max Athletes** | Integer | Total capacity (0 = unlimited) |

## Waiver Settings

| Setting | Type | Description |
|---------|------|-------------|
| **Require Waiver** | Boolean | Waiver required to register |
| **Waiver Text** | Text | Legal waiver content |
| **Signature Type** | Enum | Electronic, typed name, or checkbox |

## Payment Settings

| Setting | Type | Description |
|---------|------|-------------|
| **Entry Fee** | Decimal | Default registration fee |
| **Currency** | Enum | USD, EUR, GBP, etc. |
| **Payment Provider** | Enum | Connected payment account |
| **Tax Rate** | Decimal | Optional tax percentage |

### Refund Policy Options

| Setting | Description |
|---------|-------------|
| **Full Refund** | 100% refund allowed |
| **Partial Refund** | Percentage refund |
| **No Refunds** | Non-refundable |
| **Deadline** | Refund cutoff date |

## Event Settings

| Setting | Type | Description |
|---------|------|-------------|
| **Name** | String | Event/workout name |
| **Order** | Integer | Display order |
| **Time Cap** | Integer | Maximum time in seconds |
| **Scoring Type** | Enum | Time, reps, weight, points |
| **Tiebreaker** | Enum | Tiebreaker method |

## Schedule Settings

| Setting | Type | Description |
|---------|------|-------------|
| **Heat Size** | Integer | Athletes per heat |
| **Heat Duration** | Integer | Minutes per heat |
| **Transition Time** | Integer | Minutes between heats |
| **Start Time** | DateTime | First heat start |

## Display Settings

| Setting | Type | Description |
|---------|------|-------------|
| **Show Leaderboard** | Boolean | Public leaderboard |
| **Show Schedule** | Boolean | Public schedule |
| **Show Workouts** | Boolean | Public workout details |
| **Workout Reveal Date** | DateTime | When workouts become visible |

## Access Control

| Setting | Type | Description |
|---------|------|-------------|
| **Organizers** | User[] | Users with organizer access |
| **Judges** | User[] | Users with scoring access |
| **Volunteers** | User[] | Users with check-in access |

## API Settings

| Setting | Type | Description |
|---------|------|-------------|
| **Webhook URL** | URL | Registration notifications |
| **API Access** | Boolean | Enable API access |

---

*See also: [Divisions Reference](/reference/divisions)*
