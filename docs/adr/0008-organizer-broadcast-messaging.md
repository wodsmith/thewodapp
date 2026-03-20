---
status: proposed
date: 2026-03-20
decision-makers: [Ian Jones, Zac]
consulted: []
informed: []
---

# ADR-0008: Organizer Broadcast Messaging

## Context and Problem Statement

Competition organizers need to communicate with their registered athletes — sending reminders, schedule changes, waiver nudges, and general announcements. Today there is no in-app communication channel, so organizers must export registration emails and use external tools (Mailchimp, manual Gmail, etc.) to reach athletes. This is tedious, error-prone, and disconnects the communication from the platform where athletes manage their competition experience.

Allowing free-form two-way messaging (chat) between organizers and athletes introduces moderation burden, support expectations, and product complexity that isn't justified at this stage. Athletes contacting organizers directly also raises concerns about unmanageable inbound volume for organizers.

How should we enable organizer-to-athlete communication within WODsmith?

## Decision Drivers

* Must let organizers reach specific groups of athletes (not just "all registrants")
* Must eliminate the need to export emails for routine communication
* Must be simple to build and understand — MVP over full messaging system
* Must support email delivery so athletes who aren't actively in-app still receive the message
* Should avoid creating moderation or support burden (no inbound athlete messages)
* Should integrate with existing registration data for filtering/targeting
* Should be extensible toward scheduled broadcasts and cross-competition promotion in the future

## Considered Options

* **Option A: Two-way chat/messaging** — Full inbox-style messaging between organizers and athletes with threads, read receipts, etc.
* **Option B: One-way broadcast channel** — Organizers publish broadcasts to targeted groups of athletes. Athletes receive in-app and via email. No reply mechanism.
* **Option C: Email-only blasts** — Organizers compose emails through WODsmith that are sent via Resend, but no in-app record or broadcast history.

## Decision Outcome

Chosen option: **"Option B: One-way broadcast channel"**, because it solves the core communication need with minimal complexity and no moderation burden.

Option A was rejected because two-way messaging creates support expectations, moderation needs, and significant UI complexity (inbox, threads, notifications, read state) that are disproportionate to the problem being solved. Option C was rejected because email-only blasts leave no in-app record, provide no way for athletes to review past announcements, and don't integrate with push notifications.

### Consequences

* Good, because organizers can communicate without leaving the platform or exporting data
* Good, because one-way eliminates moderation and inbound message management
* Good, because in-app broadcast history gives athletes a persistent place to review announcements
* Good, because email delivery ensures athletes who aren't in-app still receive messages
* Good, because filtering on registration data enables targeted communication (e.g., "athletes who haven't signed waiver")
* Bad, because athletes cannot reply — if they need to respond, they must use external channels
* Bad, because organizers must learn a new feature surface area

## Design Sketch

### Core Concepts

A **broadcast** is a message published by an organizer, scoped to a competition (or series). Each broadcast has:

- **Title** and **body** (rich text / markdown)
- **Audience filter** — determines which athletes receive it. Filters can target:
  - All registrants
  - Specific divisions
  - Registration question responses (e.g., t-shirt size, dietary restrictions)
  - Registration status (e.g., waiver not signed, unpaid)
- **Delivery channels** — in-app (broadcasts tab visible to athletes) + email (broadcast content sent via Resend)
- **Timestamps** — created, scheduled (if deferred), sent

### Organizer UX

- New **"Broadcasts"** tab in the competition organizer dashboard
- Compose view: title, body, audience filter builder (based on registration shape)
- Preview: see matching athlete count before sending
- Broadcast history: list of sent broadcasts with audience size and delivery stats

### Athlete UX

- **"Broadcasts"** tab on the competition detail page (or integrated into existing athlete view)
- List of broadcasts relevant to the athlete, ordered by recency
- Email notification with broadcast content delivered at send time

### Future Extensions (not in MVP)

- **Scheduled broadcasts** — compose now, send later
- **Cross-competition broadcasts** — premium feature letting organizers message past competition athletes to promote future events
- **Push notifications** — when mobile app exists, broadcasts trigger push notifications
- **Read tracking** — track which athletes have viewed a broadcast in-app

### Data Model (Conceptual)

```
competitionBroadcastsTable
  id, competitionId, teamId, title, body, audienceFilter (JSON),
  recipientCount, status (draft|sent|scheduled), scheduledAt, sentAt,
  createdById, createdAt, updatedAt

competitionBroadcastRecipientsTable
  id, broadcastId, registrationId, userId, emailDeliveryStatus,
  createdAt
```

The `audienceFilter` column stores a JSON object describing the filter criteria. At send time, the filter is evaluated against current registrations to determine recipients, and a row is inserted into the recipients table for each matched athlete for delivery tracking.
