---
sidebar_position: 7
---

# How to Send Broadcasts

Send one-way announcements to athletes and volunteers via in-app notifications and email.

## Prerequisites

- Competition organizer permissions
- Competition with registrations (athletes or volunteers)

## Accessing Broadcasts

1. Open your competition from **ORGANIZE**
2. Click **Broadcasts** in the sidebar

If you haven't sent any broadcasts yet, you'll see an empty state with a prompt to create your first one.

## Composing a Broadcast

1. Click **New Broadcast**
2. Fill in the broadcast details:
   - **Title** — a short subject line (e.g., "Schedule Change for Saturday")
   - **Message** — the full announcement text

### Choosing an Audience

Use the **Audience** dropdown to target your message:

| Audience | Who receives it |
|----------|----------------|
| **Everyone (Public)** | All athletes and volunteers |
| **All Athletes** | Every registered athlete |
| **Athletes by Division** | Athletes in a specific division (a second dropdown appears) |
| **All Volunteers** | Every registered volunteer |
| **Volunteers by Role** | Volunteers with a specific role (e.g., Judge, Scorekeeper) |

After selecting an audience, the recipient count updates automatically so you can verify who will receive the message.

### Email Notifications

The **Send email notification to recipients** checkbox is enabled by default. Uncheck it if you only want the broadcast to appear in-app without sending emails.

## Sending the Broadcast

1. Review your title, message, and audience
2. Click **Send Broadcast**
3. A confirmation toast shows how many recipients received the message

Broadcasts are sent immediately and cannot be edited after sending.

## Viewing Past Broadcasts

All sent broadcasts appear on the Broadcasts page in reverse chronological order. Each broadcast card shows:

- **Title** and **message body**
- **Date sent**
- **Recipient count** — total recipients
- **Delivery status** — number delivered or failed

## Delivery and Retries

Emails are delivered asynchronously. If delivery fails for some recipients, a red badge shows the failure count. The system uses per-recipient idempotency to prevent duplicate emails on retry.

---

*See also: [How to Manage Registrations](/how-to/organizers/manage-registrations) | [How Athletes View Broadcasts](/how-to/athletes/view-broadcasts)*
