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

```sql
competitionBroadcastsTable
  id, competitionId, teamId, title, body, audienceFilter (JSON),
  recipientCount, status (draft|sent|scheduled), scheduledAt, sentAt,
  createdById, createdAt, updatedAt

competitionBroadcastRecipientsTable
  id, broadcastId, registrationId, userId, emailDeliveryStatus,
  createdAt
```

The `audienceFilter` column stores a JSON object describing the filter criteria. At send time, the filter is evaluated against current registrations to determine recipients, and a row is inserted into the recipients table for each matched athlete for delivery tracking.

### Email Delivery via Resend

WODsmith already uses [Resend](https://resend.com) for all transactional emails (verification, password reset, team invites, registration confirmations, etc.) via a unified `sendEmail()` function in `src/utils/email.tsx`. Broadcasts will use the same infrastructure:

- **Sender**: `team@mail.wodsmith.com` (already verified in Resend with SPF/DKIM)
- **Templates**: New React Email template for broadcast content, rendered via `@react-email/render`
- **Tags**: Broadcasts tagged with `{ name: "type", value: "competition-broadcast" }` for filtering in Resend dashboard
- **Reply-to**: Configurable per broadcast (defaults to `support@mail.wodsmith.com`)
- **Resend API**: Direct `fetch()` to `https://api.resend.com/emails` with Bearer token auth (same pattern as existing emails)
- **Rate limits**: Resend allows 100 emails/second on paid plans. A broadcast to 500 athletes completes in ~5 seconds with sequential sends, or faster with Resend's batch endpoint (`/emails/batch`, up to 100 recipients per call)

#### Resend Batch API

For broadcasts, prefer Resend's [batch send endpoint](https://resend.com/docs/api-reference/emails/send-batch-emails) (`POST /emails/batch`) which accepts up to 100 emails per request. This reduces the number of API calls from N to ceil(N/100) and simplifies error handling — the batch response returns per-email success/failure status.

### Reliable Delivery: Cloudflare Queue

The current `sendEmail()` function is fire-and-forget: if the Resend API call fails, the error is caught, logged, and swallowed. This is acceptable for transactional emails triggered by user actions (the user can retry the action), but broadcasts are different — if an organizer sends a broadcast to 300 athletes and 20 emails fail due to a transient Resend outage, there's no easy way to retry just those 20.

**Option 1: Synchronous with manual retry (MVP)**

Send all emails in the request handler. Track per-recipient delivery status in `competitionBroadcastRecipientsTable`. If some fail, the organizer can see which failed and trigger a "retry failed" action. Simple to build but ties up the Worker for the duration of the send, and large broadcasts risk hitting the Worker CPU time limit.

**Option 2: Cloudflare Queue for async delivery**

Enqueue one message per recipient (or per batch of up to 100) into a Cloudflare Queue. A queue consumer Worker processes messages, calls Resend, and updates delivery status in the database. Failed messages are automatically retried by the queue with backoff. Benefits:

- **Automatic retry** — Cloudflare Queues retry failed messages up to 3 times with exponential backoff
- **No Worker timeout risk** — the HTTP request returns immediately after enqueueing; delivery happens asynchronously
- **Back-pressure** — the queue naturally rate-limits sends, preventing Resend API rate limit hits
- **Visibility** — delivery status updates flow into the recipients table as messages are processed
- **Dead letter queue** — persistently failed messages can be routed to a DLQ for manual investigation

Trade-offs:

- Adds infrastructure complexity (new Queue binding in `alchemy.run.ts`, consumer handler)
- Delivery is eventually consistent — organizer won't see "all sent" immediately
- Requires a queue consumer Worker (can be the same Worker with a `queue()` handler)

**Recommendation**: Start with **Option 2 (Cloudflare Queue)**. The queue approach avoids Worker timeout risks from day one, provides automatic retry without building manual retry UI, and lays the groundwork for scheduled broadcasts. The infrastructure cost is modest — a single Queue binding and a `queue()` handler on the existing Worker. The eventually-consistent delivery status is acceptable since organizers don't need instant confirmation that all emails landed.

#### Queue Message Shape

Each queue message represents a batch of up to 100 recipients for a single broadcast:

```typescript
interface BroadcastEmailMessage {
  broadcastId: string
  competitionId: string
  batch: Array<{
    recipientId: string       // competitionBroadcastRecipientsTable.id
    email: string
    athleteName: string
  }>
  subject: string
  bodyHtml: string            // pre-rendered HTML (render once at enqueue time)
  replyTo?: string
}
```

The HTML body is rendered once when the broadcast is sent and included in each queue message, so the consumer only needs to call the Resend API — no template rendering or database reads required.

#### Flow

1. Organizer clicks "Send" → server function evaluates audience filter, inserts recipient rows with `emailDeliveryStatus: 'queued'`, renders the email template once, and enqueues batches of up to 100 recipients
2. Queue consumer receives batch → calls Resend batch API → updates each recipient row to `'sent'` or `'failed'`
3. On consumer failure, Cloudflare retries automatically (up to 3 times with backoff) — consumer must be idempotent: each Resend API call includes an `Idempotency-Key` header using the recipient row ID (e.g., `broadcast-{recipientId}`), so Resend deduplicates on their end even if the consumer crashes between sending and updating status. Additionally, the consumer skips recipients already in `'sent'` state as a defense-in-depth check
4. After max retries exhausted, message goes to dead letter queue for investigation
