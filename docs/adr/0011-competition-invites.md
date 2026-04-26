---
status: proposed
date: 2026-04-18
decision-makers: [Zac Jones, Ian Jones]
consulted: []
informed: []
---

# ADR-0011: Competition Invites with Email-Locked Claim Flow and Round-Based Sending

## Context and Problem Statement

WODsmith competitions today have one path to a registered athlete: the athlete finds the competition, clicks Register, and pays. Organizers running invite-only flagship events (regional finals, championships, qualifier-fed throwdowns) have no first-class way to:

1. **Define qualification sources** — declare that "the top 3 of each Mountain West Throwdown plus the next 6 from the series global leaderboard plus the top 5 from the Online Qualifier feed Finals."
2. **Build a roster from those sources** — see the source competition leaderboards (per-division and series-global) inside the championship's organizer dashboard, with already-invited athletes marked.
3. **Invite athletes in waves** — send Round 1 to guaranteed qualifiers, watch acceptances roll in, then send Round 2 to fill spots that didn't claim. Each round needs its own subject/deadline because "you earned this" reads differently from "a spot opened up" and "first-come-first-served wildcard."
4. **Lock the invite to a specific email** — when athlete `A@gmail.com` gets an invite, only a session signed in as `A@gmail.com` can claim it. Registration is gated, the email field is pre-filled and immutable, and the invite link is a one-shot identity check.
5. **Track invite state in a single data table** — sent / pending / accepted / paid / declined / expired, filterable, sortable, with the source competition + round annotated per row, the way an organizer would track this in a spreadsheet today.
6. **Compose nice-looking emails with reusable competition-branded components** — using React Email v6.0 rather than hand-rolled HTML, so the "ticket card / claim button / event hero" components organizers want are real React components, not screenshots from Mailchimp.
7. **Bespoke / off-source invites** — invite anyone the organizer chooses, even when they aren't on a configured qualification source: a sponsored athlete, a friend-of-the-event, a returning champion who skipped the qualifier. Same email-locked claim flow, same round attribution, no source row required. Organizers should be able to add these one-at-a-time by typed email *or* in bulk via paste/CSV.

The closest existing infrastructure is the [organizer broadcast system](./0008-organizer-broadcast-messaging.md), which sends queued, Resend-delivered emails to filtered audiences of *already-registered* athletes. Invites are the inverse — they target athletes who are **not yet registered**, may not yet have a WODsmith account, and need a transactional, per-recipient claim link that cannot be forwarded.

The closest existing UX pattern is [organizer manual registration](./../../lat.md/registration.md), which already creates placeholder users with claim tokens (`/sign-up?claim=<token>`). That pattern is the right primitive for the email-locked claim, but it's currently invoked one-row-at-a-time from the dashboard, with no concept of source, round, or wave.

How should we build a competition invite system that ties qualification sources to a roster, sends invites in rounds with email-locked claim links, and gives organizers a React-Email–based composer for branded invitation emails?

## Decision Drivers

- Must let an organizer define **qualification sources** for a competition: another single competition, a series of competitions, or a series global leaderboard, with per-source allocation rules (top N per division, top N global).
- Must let an organizer issue **bespoke invites** to any email — no source required — with the same lifecycle, claim flow, and round attribution as source-derived invites.
- Must produce a **unified roster** that joins source-leaderboard data *and* bespoke invite rows with invite state, ordered by qualification priority, filterable by status.
- Must support **rounds (waves)** — distinct sends with their own subject, body, deadline, and recipient list, so organizers can re-invite non-responders with a different message.
- Must **lock the claim link to the invited email**: the invite token resolves to one and only one email; the sign-in/registration flow rejects mismatched sessions and pre-fills the email field as immutable.
- Must reuse existing **Stripe Checkout + Cloudflare Workflow** registration infrastructure — invited athletes go through the same paid flow, but with a server-attested email and pre-attached division.
- Must reuse existing **Resend + Cloudflare Queue** delivery pattern from broadcasts (idempotency keys, batched sends, dead-letter queue).
- Must let organizers compose emails using **React Email 6.0 components** (`@react-email/components`, already on `0.0.32`, with `@react-email/render` 1.0.4 in tree) and a small library of WODsmith-branded components (event hero, ticket card, claim button, deadline footer). The "editor" is a structured form that assembles those components — not a freeform WYSIWYG HTML editor — so the visual quality stays high and the rendered email stays accessible.
- Must integrate with the **series global leaderboard** ([`getSeriesLeaderboard`](./../../apps/wodsmith-start/src/server-fns/series-leaderboard-fns.ts)) so the organizer can flip between per-comp leaderboards and the series-wide standings to pick wildcards, and so direct-qualified athletes are visibly skipped when picking from global standings.
- Must respect existing **multi-tenancy**: invites and sources scope to `organizingTeamId`; `MANAGE_COMPETITIONS` permission gates organizer actions.
- Should be **incrementally shippable** — phases 1–2 deliver value (roster + single send) before the round builder and email composer arrive.

## Considered Options

### A. Reuse `competitionRegistrationsTable` with a "preregistered" status

Mark invited athletes as registrations with a new `status = "invited"` and a payment status of `INVITED_PENDING`. Send an email with a pre-checkout link. Athlete clicks → completes Stripe Checkout → status flips to `active`.

**Pros:** Minimal schema. Roster is just a registration query.
**Cons:** Conflates "athlete has registered for this competition" with "athlete *might* register if they accept an invite." Capacity math breaks (do invited-but-unpaid count toward division max?). Multi-round attribution requires bolt-on columns on `competition_registrations`. Declined invites would have to soft-delete registrations, which loses history. Email-locked claim requires storing a token on the registration row, awkwardly. **Rejected** — the registrations table is the wrong unit; an invite is its own thing with its own lifecycle.

### B. New invites system, layered on top of registration

Add `competition_invite_sources` (declarative qualification sources), `competition_invites` (per-athlete invite rows with email-locked tokens), `competition_invite_rounds` (the waves). On accept, the existing `registerForCompetition` flow runs — invites are a thin pre-registration layer that produces a real registration once the athlete claims.

**Pros:** Clean separation between "qualified to be invited" and "registered." Rounds become first-class. Capacity logic is unaffected until claim. Status reporting is clean. Email-locked tokens are a property of the invite, not the registration. Stripe Checkout flow is reused as-is. Aligns with how broadcasts model recipients independently of registrations.
**Cons:** New schema surface area. Roster query joins source-leaderboard data with invite state — non-trivial but bounded.

### C. Generic "campaign" system that handles both broadcasts and invites

Refactor broadcasts and invites into a single `campaigns` table with a discriminator, sharing recipient and send-tracking infrastructure.

**Pros:** Code reuse for sending/queueing.
**Cons:** Broadcasts and invites have different semantics — broadcasts target existing registrants and don't need claim flows; invites target prospects and *do*. Forcing one model creates abstractions that have to ignore half their fields half the time. The Resend/queue plumbing is already a small reusable utility regardless. **Rejected** — premature abstraction.

## Decision Outcome

Chosen option: **B. New invites system, layered on top of registration**, because it cleanly separates the invite lifecycle from the registration lifecycle, lets us reuse the proven Stripe Checkout flow as-is, and lets each subsystem (sources, rounds, claim) ship independently.

Rounds are first-class so organizer-facing reporting can attribute every invite to a wave. Sources are first-class so the roster is computed from a declarative spec rather than reverse-engineered from invite history. Claim tokens are bound to a single email at issue time so the email-lock property is enforced at the data layer, not just at the UI.

### Consequences

- **Good**, because invite state and registration state stay independent — declined invites don't leave orphaned registrations; capacity math doesn't have to invent ghost statuses.
- **Good**, because rounds become a primary entity — organizers can re-invite non-responders with a different message in one click, and every invite carries its round number for analytics.
- **Good**, because the email-locked claim flow extends the existing placeholder-user / claim-token pattern and reuses the Stripe Checkout workflow without forking it.
- **Good**, because the email composer being a structured assembler over React Email components means the rendered output stays accessible, brand-consistent, and dark-mode-safe, and we avoid the support burden of a freeform HTML editor.
- **Good**, because the same Resend + Cloudflare Queue pattern proven in broadcasts handles delivery, idempotency, and retry without new infra.
- **Bad**, because two source kinds (single competition vs series with global leaderboard) require two slightly different selection UIs and two different leaderboard queries.
- **Bad**, because the schema grows by 5 tables (sources, rounds, invites, recipient sends, email templates) — comparable to the broadcasts addition.
- **Neutral**, because invite-to-registration attribution is recorded on the registration's metadata rather than via a foreign key, since registration outlives invite cleanup.

### Non-Goals

- **Pay-on-claim on the invite link itself.** The invite link drops the athlete into the *existing* Stripe Checkout flow with email + division pre-attached. We don't build a one-click pay-on-the-invite-link UI in this ADR.
- **Per-event invitation (sub-event granularity).** Invites are scoped to a competition + division, not to specific events within a competition.
- **Invite-only competitions as a competition-type flag.** A competition with invites is still publicly viewable per its existing `visibility` setting; invites are an additional channel, not a replacement for the public registration page. (A future "invite-only mode" can layer on top.)
- **Athlete-initiated invite requests** ("apply to be invited"). Out of scope.
- **Bidirectional sync with the source competition.** If athletes get added to or removed from the source competition's leaderboard after sources are configured, the roster reflects current source data on read; we don't snapshot.
- **Automatic waitlist promotion** (auto-send Round N+1 when Round N expires). The round builder *suggests* re-inviting non-responders, but every send is an explicit organizer action.
- **Invite forwarding / transferable invites.** An invite is bound to one email at issue time and cannot be reassigned.
- **A WYSIWYG HTML editor.** The email composer assembles React Email components via a structured form; freeform HTML editing is explicitly excluded.

## Detailed Design

### Reference Mockups

The organizer-facing UX is prototyped in `docs/mockups/competition-invites/project/`. Treat the mockup as a directional reference for layout, status taxonomy, and information density — **not** a contract; the bespoke-invites surface and the removal of the email-tone toggle (see "Email Composer") are deviations not yet in the prototype. The prototype's two visual variants ("by-the-book" / "bold flagship") are decided separately before Phase 3.

| Mockup file | What it shows | Sections in this ADR that consume it |
|---|---|---|
| `project/Invites.html` | Wrapper + design tokens (HSL CSS variables for `--accept`, `--pending`, `--declined`, `--ticket`). | All UI sections — copy the token names into the real Tailwind theme. |
| `project/invites/app.jsx` | Top-level composition: tabs for Roster, Sources, Round History, Email Templates, Series Global. | Phase 1–5 route shape under `routes/compete/organizer/$competitionId/invites/`. |
| `project/invites/chrome.jsx` | Sidebar nav placement ("Invites" under Athletes group with pending badge), page header, big-stat cards (tickets sold / accepted / pending), tabs strip. | Roster page header. |
| `project/invites/data.jsx` | Status enum (`accepted_paid`, `accepted`, `pending`, `declined`, `expired`, `not_invited`), source kinds (series with directSpotsPerComp + globalSpots vs single competition), round shape (subject, deadline, recipients, paid/accepted/pending/declined/expired counts). | `competition_invites.status`, `competition_invite_sources` schema, `competition_invite_rounds` schema. |
| `project/invites/leaderboard.jsx` | Roster table with status pills, source tags, filter chips, cutoff line, smart-select checkboxes, RankCell + EventResultCell. | "Roster Computation" — the rendering target. |
| `project/invites/sources.jsx` | Sources tab card layout for series (direct + global) and single-competition sources, with allocated-spots summary. | Phase 1 sources UI. |
| `project/invites/round-builder.jsx` | Right-rail Round Builder: selected count, smart-select buttons (re-invite non-responders, next 5/10), round meta (label/deadline/subject), recipients chips, send button with over-allocation warning. | Phase 3 round builder. |
| `project/invites/rounds-timeline.jsx` | Round history timeline cards with progress bars and per-round StatTicks. | Phase 3 round history view. |
| `project/invites/email-preview.jsx` | Email preview modal with mock email-client framing, hero block, event card, CTA, variables panel. **The tone-toggle and tone-comparison side panel in this prototype are not part of the plan** — see "Email Composer." | Phase 4 email composer + preview. |
| `project/invites/app.jsx#SeriesGlobalView` | Series global leaderboard with "Direct-qualified" pill and per-row `GLB N/M` chip for global slots. | Phase 5 Series Global Integration. |

### Core Concepts

- **Championship** — the competition that's *receiving* invites. Has 0+ qualification sources and 0+ bespoke invitees.
- **Qualification Source** — a declarative pointer to either a single competition or a competition group (series), with allocation rules (top N per division, top N global) describing how many invites it contributes.
- **Bespoke Invitee** — an athlete the organizer typed in directly (or imported via CSV). Not derived from any leaderboard. Carries the same email + division + optional name as a sourced invite, but `sourceId IS NULL` and the roster groups it under a synthetic "Bespoke / direct invites" section.
- **Roster Row** — a derived view per athlete that joins `(athlete identity, origin [source placement OR bespoke], current invite state, round attribution)`. Computed at read time, not stored.
- **Round** — a named wave of invites for a championship. Has subject, body (assembled React Email content), RSVP deadline, sent timestamp, sender. Holds the recipient list. A round can mix sourced and bespoke invitees freely.
- **Invite** — a per-athlete row attached to a round. Carries the email-locked claim token, current status, and origin (source attribution OR bespoke marker).
- **Email Template** — an organizer-saved, named composition of React Email components used to seed a round's body. Optional; rounds can also carry ad-hoc bodies.

### Database Schema

All tables are MySQL via `mysql-core`, with `commonColumns`, ULID-based ids generated by `$defaultFn`, and PlanetScale-style indexing (no foreign keys). Field types follow patterns established in [`broadcasts.ts`](./../../apps/wodsmith-start/src/db/schemas/broadcasts.ts).

#### `competition_invite_sources`

A qualification source attached to a championship competition.

| Column | Type | Description |
|---|---|---|
| `id` | varchar(255) PK | ULID |
| `championshipCompetitionId` | varchar(255) | The competition receiving invites. |
| `kind` | varchar(20) | `"competition"` \| `"series"` |
| `sourceCompetitionId` | varchar(255) NULL | When `kind = competition`. |
| `sourceGroupId` | varchar(255) NULL | When `kind = series`. Logical reference to `competitionGroupsTable.id` (the existing "series" entity in `apps/wodsmith-start/src/db/schemas/competitions.ts`). No FK per PlanetScale conventions. |
| `directSpotsPerComp` | int NULL | For series: how many top-N from each comp in the series get a slot. |
| `globalSpots` | int NULL | For series: how many additional from the series global leaderboard. For single comp, the total top-N. |
| `divisionMappings` | text (JSON) | `[{ sourceDivisionId, championshipDivisionId, spots? }]` so a source's "RX Men" maps to the championship's "RX Men" and contributes its own quota. |
| `sortOrder` | int | Display order in the sources list. |
| `notes` | text NULL | Organizer-visible note. |

Indexes: `(championshipCompetitionId, sortOrder)`, `(sourceCompetitionId)`, `(sourceGroupId)`.

Constraint at write time: exactly one of `sourceCompetitionId` / `sourceGroupId` is non-null per row. Both `directSpotsPerComp` and `globalSpots` may be null for a single-competition source — only `globalSpots` (used as "top N overall") is required there.

#### `competition_invite_rounds`

A wave of invites.

| Column | Type | Description |
|---|---|---|
| `id` | varchar(255) PK | ULID |
| `championshipCompetitionId` | varchar(255) | |
| `roundNumber` | int | 1-based, dense per competition. Display value, not a uniqueness key. |
| `label` | varchar(255) | "Round 1 — Guaranteed", organizer-edited. |
| `emailTemplateId` | varchar(255) NULL | Optional FK (logical) to `competition_invite_email_templates.id` used as the body source. |
| `subject` | varchar(255) | Email subject. |
| `bodyJson` | text | Serialized React Email composition (see "Email Composer" below). |
| `replyTo` | varchar(255) NULL | Defaults to the championship's contact email. |
| `rsvpDeadlineAt` | datetime | Hard expiry for invites in this round. |
| `status` | varchar(20) | `"draft"` \| `"sending"` \| `"sent"` \| `"failed"` |
| `sentAt` | datetime NULL | |
| `sentByUserId` | varchar(255) NULL | |
| `recipientCount` | int default 0 | Snapshot at send time. |

Indexes: `(championshipCompetitionId, roundNumber)`, `(championshipCompetitionId, status)`.

#### `competition_invites`

The per-athlete invite row.

| Column | Type | Description |
|---|---|---|
| `id` | varchar(255) PK | ULID |
| `championshipCompetitionId` | varchar(255) | |
| `roundId` | varchar(255) | The round this invite was sent in. |
| `origin` | varchar(20) | `"source"` \| `"bespoke"` — discriminator for how the invite came to exist. |
| `sourceId` | varchar(255) NULL | `competition_invite_sources.id` — which source qualified them. NULL when `origin = bespoke`. |
| `sourceCompetitionId` | varchar(255) NULL | Resolved source (populated for source invites; equals source's competition for kind=competition, or the specific comp within a series). NULL when `origin = bespoke`. |
| `sourcePlacement` | int NULL | 1-based rank in the source for display ("1st — SLC Throwdown"). NULL for series-global rows and for bespoke invites. |
| `sourcePlacementLabel` | varchar(255) NULL | Denormalized human label, e.g. "Series GLB · 1st unqualified". For bespoke invites this carries the organizer's optional reason note ("Sponsored athlete", "Past champion") so the roster row has something to display in the source column. |
| `bespokeReason` | varchar(255) NULL | Free-text categorization the organizer can set when adding a bespoke invitee ("Sponsored athlete", "Past champion", "Wildcard"). Distinct from the salutation. Surfaces as a small chip in the roster. |
| `championshipDivisionId` | varchar(255) | The target division on the championship. |
| `email` | varchar(255) | **Lowercased, trimmed at write.** This is the invite-locked email. |
| `userId` | varchar(255) NULL | The WODsmith user account, if one exists at issue time or gets resolved later. |
| `inviteeFirstName` | varchar(255) NULL | Denormalized for the email salutation; falls back to `email`. |
| `inviteeLastName` | varchar(255) NULL | |
| `claimTokenHash` | varchar(64) | SHA-256 of the URL-safe token. The plaintext token only appears in the outgoing email. Rotated on each re-send. |
| `claimTokenLast4` | varchar(8) | For organizer support so they can confirm an athlete clicked the right link. Rotated alongside `claimTokenHash`. |
| `expiresAt` | datetime | Mirrors `round.rsvpDeadlineAt` at send time, but stored per-invite so per-invite extensions work. Bumped on re-send. |
| `sendAttempt` | int NOT NULL default 0 | Incremented each time the invite is re-sent. Used in the Resend `Idempotency-Key` so a reused `invite.id` does not get silently deduplicated when the organizer extends / re-issues. |
| `status` | varchar(20) | `"pending"` \| `"accepted_paid"` \| `"declined"` \| `"expired"` \| `"revoked"`. "Accepted" as a distinct state is intentionally absent: an invite is either outstanding (`pending`), successfully converted into a paid registration (`accepted_paid`), or terminal (`declined`/`expired`/`revoked`). The Stripe-in-flight window is represented by `pending` with a `commercePurchase` in progress — no schema state change until the webhook confirms payment. |
| `paidAt` | datetime NULL | Set when `status` transitions to `accepted_paid`. |
| `declinedAt` | datetime NULL | |
| `claimedRegistrationId` | varchar(255) NULL | The `competition_registrations.id` that resulted from payment. |
| `emailDeliveryStatus` | varchar(20) | `"queued"` \| `"sent"` \| `"failed"` \| `"skipped"` (mirrors broadcast pattern). |
| `emailLastError` | text NULL | |
| `activeMarker` | varchar(8) NULL | Literal `"active"` while `status IN (pending, accepted_paid)`; set to NULL the moment the invite transitions to `declined`, `expired`, or `revoked`. Powers the unique-active-invite index below. |

Indexes:
- Unique `(championshipCompetitionId, email, championshipDivisionId, activeMarker)` — enforces "at most one *active* invite per (championship, division, email)" while still allowing historical rows to accumulate. MySQL treats multiple NULLs as distinct in unique indexes, so revoked/declined/expired rows (where `activeMarker IS NULL`) don't collide with a fresh re-invite. This resolves the conflict with OQ#1: we **keep** terminal invite rows for audit, and the re-invite path (Phase 3, "revoke R1 before issuing R2") works by transitioning R1 to `revoked` (which nulls `activeMarker` and zeros `claimTokenHash`) *in the same transaction* that inserts the R2 row.
- Unique `claimTokenHash` — MySQL allows multiple NULLs, so setting `claimTokenHash = NULL` on terminal transitions lets any number of historical rows coexist. Plaintext tokens are never stored; see "Token model" below.
- `(roundId)`, `(sourceId)`, `(origin)`, `(status)`, `(email)` for the organizer table queries.

Write-time constraints (enforced in `competition_invites` write helpers, not by the DB):
- If `origin = "source"`: `sourceId`, `sourceCompetitionId` must be non-null.
- If `origin = "bespoke"`: `sourceId`, `sourceCompetitionId`, `sourcePlacement` must be NULL.

#### `competition_invite_email_templates`

Organizer-saved reusable bodies, scoped per organizing team.

| Column | Type | Description |
|---|---|---|
| `id` | varchar(255) PK | |
| `organizingTeamId` | varchar(255) | |
| `name` | varchar(255) | Organizer-chosen name, e.g. "Default invitation". |
| `subject` | varchar(255) | |
| `bodyJson` | text | Same shape as `round.bodyJson`. |
| `isSystemDefault` | boolean default false | True for the seeded fallback template that ships with WODsmith. |

Indexes: `(organizingTeamId)`, `(isSystemDefault)`.

A single system-default template is seeded once per environment and shared (read-only). Organizers can clone-and-edit it to create their own, but cannot mutate the seeded row.

### Email-Locked Claim Flow

The token is the integrity boundary. The flow:

1. **Issue.** When a round sends, for each invite the server generates a 32-byte URL-safe random token, stores `sha256(token)` and `last4(token)` on the invite row, and embeds `${getSiteUrl()}/compete/${slug}/claim/${token}` in the email body via the React Email `ClaimButton` component.
2. **Click.** The route `routes/compete/$slug/claim/$token.tsx` loads. The loader hashes the token, looks up the invite by `claimTokenHash`, and asserts (a) it exists, (b) `status === "pending"`, (c) `expiresAt` is in the future, (d) competition is still accepting invites.
3. **Identity match.**
   - If signed in and `session.email.toLowerCase() === invite.email`: proceed straight to the pre-attached registration form.
   - If signed in but emails differ: render a "this invite belongs to someone else" page with a sign-out + sign-in-as link. Explicitly does **not** allow proceeding.
   - If not signed in and a user with `invite.email` exists: redirect to `/sign-in?email=<invite.email>&claim=<token>` — email field is pre-filled and read-only on the sign-in page when `claim` is present, so the user cannot accidentally sign into a different account.
   - If not signed in and no user exists for `invite.email`: redirect to `/sign-up?email=<invite.email>&claim=<token>` — email field pre-filled and read-only; on sign-up the new user is bound to the invite by re-running the claim with the new session cookie.
4. **Pre-attached registration.** The claim page presents the championship + division (no division picker — the invite specifies one), waivers if any, and the existing checkout button. We extend `initiateRegistrationPaymentFn` with an optional `inviteToken` param. When present, it (a) re-validates the invite + email match, (b) skips the registration-window check (organizers can have invites land before public registration opens), (c) applies the invite-aware capacity rule (see "Capacity Math" below), (d) tags the resulting `commercePurchase` with `inviteId` in metadata. The invite row is **not** transitioned here — status stays `pending` until the webhook confirms payment.
5. **Stripe webhook.** The existing [Stripe Checkout Workflow](./../../lat.md/registration.md) finalizes the registration. It reads `inviteId` off the purchase metadata and, on success, sets `competition_invites.status = "accepted_paid"`, `paidAt = now`, `claimedRegistrationId = <new registration id>`. Free competitions are **not** eligible for invites in the MVP (`issueInvitesFn` rejects at issue time when the target division's resolved fee is $0), so there is no synchronous-register path to reconcile.
6. **Decline.** The email body contains a `Decline the invitation` link to `routes/compete/$slug/claim/$token/decline.tsx`. Same identity-match rules. Decline sets `status = "declined"`, `declinedAt = now`, and revokes the token by zeroing `claimTokenHash` (or deleting the row, see "Token model" below).
7. **Expiry.** A scheduled task (Cloudflare Cron Trigger, hourly) sweeps invites with `status = "pending"` and `expiresAt < now`, transitioning them to `"expired"` and zeroing the token hash. The organizer roster surfaces these as "Expired — no response" with a one-click "extend" action that **reuses the same `invite.id`**, increments `sendAttempt`, generates a fresh `claimTokenHash`/`last4`, bumps `expiresAt`, flips `status` back to `"pending"`, and re-enqueues the email with idempotency key `invite-${inviteId}-${sendAttempt}` so Resend treats it as a distinct send.
8. **Forwarding defense.** Because the token is bound to `invite.email` at click time, forwarding the email to a friend who's signed in as a different user just shows the "wrong account" page. This is the design.

#### Capacity Math

Division and competition capacity counts are kept independent of the invite lifecycle with one narrow exception:

- **Pending invites do NOT consume capacity.** An invite in `pending` or `declined`/`expired`/`revoked` is not a registration and doesn't reduce "spots remaining." This means organizers can (and do) over-send: 20 invites for 10 spots is expected and intended.
- **`accepted_paid` consumes capacity** via the real `competitionRegistrations` row it produces — same as any other registration. No new capacity column is introduced.
- **No `accepted` intermediate state.** The invite stays `pending` through the entire Stripe-in-flight window. If 12 athletes click claim simultaneously for 10 spots, the first 10 to finish Stripe Checkout transition to `accepted_paid` via the webhook; the 11th/12th hit "division just filled" during the registration-creation step, their purchase is refunded via the existing commerce refund path, and their invite row stays `pending` with a non-null `claimTokenHash`. The organizer roster shows them as "Pending" — indistinguishable from a fresh send — and the athlete can retry if the organizer extends the invite (which rotates the token and bumps `expiresAt`; see flow step 7).
- **Round builder over-allocation warning** (`project/invites/round-builder.jsx`) fires when `(selectedRecipients + currentAcceptedPaid + currentPending) > divisionMaxAthletes`, and is advisory only — it does not block sending. The copy reads "You're inviting 14 to a division with 10 spots and 3 already paid — expect wave 2 to fill any drops."
- **Free competitions are not eligible for invites in the MVP.** `issueInvitesFn` rejects at issue time when the target division's resolved registration fee is $0. Organizers see the "Send invites" CTA disabled on free divisions with a tooltip explaining the restriction. This is a scope-trim, not a technical limitation — re-introducing invites for free comps would need a synchronous status-flip in `registerForCompetition` and careful thought about the idempotency story.

The key rule: **invites don't reserve spots; payment does.** This keeps the invite system layered on top of registration without forking capacity logic.

#### Revoke and Refund

- **Organizer-initiated revoke** on a `pending` invite: clicks "Revoke" on the roster row (Phase 3 UI) → transitions the invite to `revoked`, nulls `activeMarker` + `claimTokenHash`, records `revokedAt` + `revokedByUserId`. The email link dies immediately. Multiple subsequent revokes / re-invites of the same athlete are unblocked by the `activeMarker`-based unique index.
- **Organizer-initiated revoke** on an `accepted_paid` invite: disallowed. Revoking a paid invite requires cancelling the registration via the existing registration-cancel flow (out of scope for this ADR); the invite status tracks the registration's cancel state via the `claimedRegistrationId` link and reflects "cancelled — refunded" or similar on the roster.
- **Refunds**: this ADR does not introduce a new refund path. Invite-driven registrations refund exactly like public-registration-driven ones.

#### Idempotent Round Send

`sendInviteRoundFn` is guarded against double-clicks and partial-send retries:

1. Hard precondition: `round.status` must be `"draft"`. The transaction opens by `SELECT ... FOR UPDATE` on the round row and rejects if status already advanced to `"sending"` / `"sent"` / `"failed"`. This stops double-click submission.
2. Invite rows are inserted with `INSERT ... ON DUPLICATE KEY UPDATE` keyed on `(championshipCompetitionId, email, championshipDivisionId, activeMarker)`. If an active row already exists for a recipient (e.g. a re-submitted send that partially succeeded), it's treated as "already issued" rather than double-inserting — the row's `roundId` is left on whichever round issued it first.
3. Queue enqueue uses `Idempotency-Key: invite-${inviteId}-${sendAttempt}` on the Resend side. Reusing `inviteId` across extends/re-sends is safe because the `sendAttempt` suffix rotates on each re-issue, so Resend treats the new message as distinct while in-flight retries of the *same* attempt are still deduplicated.
4. If the transaction fails mid-insert (network, constraint), no partial state leaks: the round stays in `draft`, no `activeMarker`-rows are committed. Organizer clicks Send again → a clean retry.

#### Token Model — Why Hash and Not Just Random

We hash because the token is a credential — anyone with it can sign-in-as / sign-up-as the invite's email if they also have access to that mailbox. Storing only the hash means a database read does not yield reusable tokens. We keep `claimTokenLast4` plaintext so an organizer asking "did this athlete click?" support question can be answered against the email's actual link.

On status changes (`declined`, `expired`, `revoked`, `accepted_paid`) we set `claimTokenHash = NULL` (not empty string) so re-replays of an old token after acceptance can't trigger a second registration attempt. The unique index on `claimTokenHash` allows multiple NULLs (MySQL semantics) so this works. `activeMarker` is nulled in the same statement for all terminal transitions *except* `accepted_paid` — paid invites keep `activeMarker = "active"` so a second "claim" attempt by the same email sees an existing active invite and short-circuits to "you're already registered."

On re-send (organizer clicks "Extend" on a `pending`-near-expiry or already-`expired` invite) the *same* invite row is mutated in place: `sendAttempt += 1`, a fresh `claimTokenHash`/`claimTokenLast4` is generated, `expiresAt` is bumped, `status` is set back to `"pending"` if it had already flipped to `"expired"`, and `activeMarker` is restored to `"active"`. Old links stop working the moment the hash is rotated. The invite's historical `id` is preserved so Stripe metadata, webhooks, and audit queries all remain correlated across attempts.

### Roster Computation

The roster is *not* materialized. The visual target is the table in `docs/mockups/competition-invites/project/invites/leaderboard.jsx` — RankCell + AthleteAvatar + SourceTag + StatusPill columns, with FilterChips above and a dashed cutoff row inserted at division capacity. A server function `getChampionshipRoster({ championshipId, divisionId, filters })` returns a list of `RosterRow` by:

1. Loading all `competition_invite_sources` for the championship.
2. For each source, calling either `getCompetitionLeaderboard` (single comp) or `getSeriesLeaderboard` + per-comp `getCompetitionLeaderboard` (series), constrained by the source's division mapping for the requested championship division.
3. Computing, per source, the "qualifying set" — top N per the source's spot allocation, applying skip-already-qualified for series global.
4. Loading all `competition_invites` for the championship + division where `origin = "bespoke"` — these athletes don't appear on any source leaderboard, so they enter the roster directly from this query rather than from a leaderboard join.
5. Joining each sourced qualifying row to `competition_invites` by `(championshipId, email, championshipDivisionId)` to attach current invite state, round, and status.
6. Sorting: source rows first, ordered by `(source.sortOrder, sourcePlacement)`; then a "Bespoke / direct invites" section listing bespoke rows ordered by `(roundNumber DESC, createdAt DESC)`. The default view groups by section; an organizer-toggleable flat sort by status/round/response time mixes them.
7. Below the source cutoff line: synthetic-waitlist rows representing the next 10 unqualified athletes per source ("Quick add: next 5 on leaderboard"). Bespoke invites do not generate a waitlist.
8. **Deduplication.** If a bespoke invite's email also appears on a source leaderboard for this championship + division, the bespoke row "wins" — the source row is suppressed and the bespoke row's status pill is shown. This prevents double-counting an athlete who was both qualified and individually invited.

The roster query is the most complex piece of read code — it's bounded but it does N+1 leaderboard fetches in the worst case. Acceptable performance because:
- Leaderboards are small (hundreds of rows max).
- A championship rarely has more than ~3–5 sources.
- Source leaderboards are already cached for public rendering.
- The bespoke-invites query is a single bounded SELECT on `competition_invites`.

If performance becomes an issue we can introduce a small Cloudflare KV cache keyed by `(sourceId, divisionId, source-data-version)` with TTL on the order of minutes. Not built in MVP.

### Bespoke Invites (Direct Add by Email)

Bespoke invites are first-class invites with no source attribution. They follow the exact same lifecycle as source-derived invites — same token, same email lock, same claim flow, same Stripe Checkout, same round attribution, same status reporting — but they enter the system through a different organizer surface. **Not in the existing mockup** — the prototype only shows source-derived athletes; the bespoke section is a new addition the implementer is responsible for designing within the same visual language as `leaderboard.jsx` (status pills, source tag swapped for a `Bespoke` chip, `bespokeReason` shown below the chip in the same slot the prototype uses for `sourceDetail`).

#### Two entry points

1. **Single-add form.** A "Add invitee" button on the roster page opens a small dialog with: email (required), first name + last name (optional), championship division (required, defaulted to current view), bespoke reason (optional free text — chip-displayed in the roster). The form creates a *draft* invite row with `status = "pending"` and `roundId = NULL`, surfaced in the roster's bespoke section as "Not yet invited." It becomes a real invite when included in a round send. (The form does not send an email by itself — it stages a row that the organizer then picks into a round, same as a sourced row.)
2. **Bulk paste/CSV import.** A "Bulk add invitees" button opens a paste box accepting either CSV (`email,firstName,lastName,division,reason`), one-email-per-line plain text, or a comma separated string that the organizer can paste in. The server `createBespokeInvitesFn` validates each row, normalizes email (lowercase + trim), enforces the `(championshipId, email, divisionId)` uniqueness — duplicates against existing invites are reported back as "already invited" without creating a row. Successful rows land as draft bespoke invites in the roster.

#### Why no instant-send

A bespoke invite isn't sent the moment it's added — it's staged, then included in a round draft just like a sourced row. This keeps the round model coherent: every invite belongs to exactly one round, every round has metadata (subject, deadline, body), and there's no "ad-hoc invite send" code path that bypasses the round builder. If the organizer wants to send a bespoke invite immediately, they create a single-recipient round draft (the round builder happily supports recipient counts of 1), set the subject, and send. The cost is one extra click; the benefit is one invite-send code path.

#### Bespoke-only roster section

In the roster table, bespoke invites render in a distinct section labeled "Bespoke / direct invites" beneath the sources. Section header shows the count of bespoke invites and a "Add invitee" / "Bulk add" button pair. Each bespoke row's "Qualified via" column shows a `Bespoke` chip (different color from source chips) plus the `bespokeReason` text if set.

#### Quick-add helpers in the round builder

The round builder's quick-add palette (see `SmartSelectButton` rows in `project/invites/round-builder.jsx`) gains:
- "All draft bespoke invitees" — adds every staged-but-never-sent bespoke row to the recipient list.
- Existing source quick-adds (`Re-invite non-responders`, `Next 5 on leaderboard`, `Next 10 on leaderboard`) remain unchanged.

#### Permissions

Same `MANAGE_COMPETITIONS` requirement on the championship's organizing team. No source-side permission check is involved — bespoke invites don't reference another organization's data.

### Email Composer

The composer is a **structured form** that emits a JSON document; rendering produces real React Email markup at send time. The visual reference for the preview modal (mock email-client framing, hero block, event card, CTA, variables panel) is `docs/mockups/competition-invites/project/invites/email-preview.jsx` — implement the same modal frame and right-rail "Variables" panel; **omit the prototype's tone-comparison side panel and tone toggles**, which are not part of the plan.

#### Body JSON Shape

```ts
type InviteBodyJson = {
  hero: {
    badgeText?: string;         // optional kicker label, e.g. "INVITATION" or "WILDCARD"
    headline: string;           // "You're invited to MWFC Finals 2026."
    lede: string;               // markdown-lite, supports {variables}
  };
  eventCard: {
    showHeroImage: boolean;     // pulls competition.bannerImageUrl
    fields: Array<{ label: string; value: string }>; // "When", "Where", "Division"
  };
  cta: {
    label: string;              // "Claim your spot"
    // url is server-injected; never authored
  };
  footerNote: string;           // "Spot held until {deadline}."
  contactEmail?: string;        // overrides championship default
};
```

#### Variable Interpolation

Strings can contain `{athlete_name}`, `{source}`, `{deadline}`, `{championship_name}`, `{division}`, `{spots_remaining}`. Resolved at render time per recipient. Unknown variables render literally (with a console warning at template-save time).

#### Rendering

A `renderInviteEmail({ invite, round, championship, body })` server function:

1. Resolves variables.
2. Renders the React Email tree via `@react-email/render` to HTML.
3. Returns `{ html, text }` (text is auto-derived).

Render runs **once per round at enqueue time** when athletes share the same body, **once per recipient** when variable values differ. The queue message includes the pre-rendered HTML/text so the consumer is just a Resend send (matches the broadcast pattern).

#### Branded Components Library

Lives in `apps/wodsmith-start/src/react-email/competition-invites/`:

- `<InviteHero />` — the banner block with badge, headline, lede.
- `<EventCard />` — the championship summary card with optional banner image.
- `<ClaimButton />` — the brand-colored CTA. Server-injects the URL.
- `<DeadlineFooter />` — small copy under the CTA.
- `<InviteFooter />` — sender/contact info and the standard "Decline" link, with sign-via-WODsmith branding.

The composer UI presents these as configurable cards; organizers cannot insert arbitrary HTML or new components. This is deliberate and aligned with the no-WYSIWYG decision driver.

#### React Email Editor (the dev preview)

The existing `email:dev` script (`pnpm dlx react-email@latest dev -d src/react-email`) runs against this directory. Engineers use it to develop the components; organizers do **not** see the React Email dev server — they see the in-app composer.

### Delivery Pipeline

Reuses the broadcast Cloudflare Queue + Resend pattern verbatim:

1. Organizer clicks Send → `sendInviteRoundFn` in a transaction:
   - Inserts `competition_invites` rows for each recipient (status `pending`, generates token, sets `expiresAt = round.rsvpDeadlineAt`).
   - Updates round `status = "sending"`, `recipientCount = N`, `sentAt = now`, `sentByUserId = session.user.id`.
   - For each recipient, renders the email (variables differ per recipient, so per-recipient render).
   - Enqueues batches of up to 100 messages onto the existing email queue with a discriminator `{ kind: "competition-invite", inviteId, html, text, subject, replyTo }`.
2. Queue consumer (extended from broadcast consumer) reads a message, calls Resend with `Idempotency-Key: invite-${inviteId}`, updates the invite's `emailDeliveryStatus`.
3. On consumer terminal failure, message lands in the existing DLQ; round `status` is set to `"failed"` if any recipient remains unsent after retries are exhausted (organizer surface shows partial success with a "retry failed" action).
4. Resend webhooks (already wired for broadcast deliverability tracking) update `emailDeliveryStatus` on `delivered` / `bounced` / `complained`.

### Series Global Leaderboard Integration

Reads from existing `getSeriesLeaderboard`. Visual reference: the `SeriesGlobalView` component in `docs/mockups/competition-invites/project/invites/app.jsx`. Two views the organizer needs:

1. **Per-comp roster sub-tab** — for a series source, the organizer flips through each comp in the series and sees the comp's leaderboard with invite state attached. Direct qualifiers (top `directSpotsPerComp`) are highlighted.
2. **Series global view** — aggregated standings with three additional columns: (a) "Direct-qualified" badge for athletes already on the direct-qualifier list, (b) "GLB N/M" position-within-globals chip for the next `globalSpots` who are eligible for global slots, (c) per-row invite status pill if an invite already exists.

The series global view explicitly *does not* re-issue invites for direct-qualified athletes — selecting them in Quick Add is disabled with a tooltip explaining they're already covered by their throwdown placement.

### Permissions

All organizer-side actions require `MANAGE_COMPETITIONS` on the championship's `organizingTeamId` (existing permission). Invite source CRUD also requires `MANAGE_COMPETITIONS` on the *source* competition's organizing team — to declare another competition as a source, the organizer must own (or be granted access to) that source. This prevents cross-organization invite fishing.

### Athlete-Facing Surfaces

- `/compete/$slug/claim/$token` — the claim landing page (described above).
- `/compete/$slug/claim/$token/decline` — explicit decline.
- `/compete/$slug/invite-pending` — informational page if an athlete signed in via "wrong account" — points them at the right address.
- The athlete's "My Competitions" view gains a "Pending invitations" section listing accepted-but-unpaid invites with a one-click resume link.

## Phased Implementation Plan

This is a hefty feature. We ship in phases; each phase ends in something deployable and useful on its own.

### Phase 1 — Sources + Roster (read-only, no email)

**Goal:** organizer can declare qualification sources for a championship and see the unified roster, with no ability to send invites yet.

**Mockup references:** `project/invites/sources.jsx` for the source-card layout (series with direct-spots + global-spots, single competition with allocated spots), `project/invites/leaderboard.jsx` for the roster table, `project/invites/chrome.jsx` for sidebar / page-header / big-stat / tab placement.

**Affected paths:**
- `apps/wodsmith-start/src/db/schemas/competition-invites.ts` (new) — `competition_invite_sources` table only.
- `apps/wodsmith-start/src/server/competition-invites/sources.ts` (new) — CRUD helpers.
- `apps/wodsmith-start/src/server/competition-invites/roster.ts` (new) — `getChampionshipRoster` (without invite state — just qualified athletes).
- `apps/wodsmith-start/src/server-fns/competition-invite-fns.ts` (new) — `listInviteSourcesFn`, `createInviteSourceFn`, `updateInviteSourceFn`, `deleteInviteSourceFn`, `getChampionshipRosterFn`.
- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/invites/index.tsx` (new) — sources tab + roster tab.
- `apps/wodsmith-start/src/components/compete/organizer/invite-sources-list.tsx`, `invite-source-form.tsx`, `championship-roster-table.tsx`.

**Tests:**
- `test/server/competition-invites/sources.test.ts` — CRUD, exactly-one-source-key constraint, cross-org permission denial.
- `test/server/competition-invites/roster.test.ts` — roster aggregation across single-comp and series sources, division mapping, cutoff line.

**Verification:**
- [ ] Organizer can add a single-competition source pointing at one of their other competitions.
- [ ] Organizer can add a series source pointing at one of their series.
- [ ] Organizer with `MANAGE_COMPETITIONS` on the championship but not on the source cannot reference that source.
- [ ] Roster table renders with athletes ordered by source priority, with cutoff at the championship division capacity.
- [ ] Series source renders both per-comp tabs and series-global tab.

### Phase 2 — Email-Locked Single-Send Invites

**Goal:** organizer can pick athletes from the roster and send a single invite email each. No round concept yet — every send is a one-off "Round 1." This validates the claim flow end-to-end.

**Mockup references:** `project/invites/leaderboard.jsx` for selection checkboxes + status pills + row tinting; the bespoke "Add invitee" / "Bulk add" dialogs are **not in the mockup** and need fresh design work consistent with WODsmith's existing dialog primitives.

**Affected paths:**
- `apps/wodsmith-start/src/db/schemas/competition-invites.ts` — add `competition_invites` table (with `origin` discriminator).
- `apps/wodsmith-start/src/server/competition-invites/issue.ts` — token issue + render + enqueue.
- `apps/wodsmith-start/src/server/competition-invites/bespoke.ts` — single-add and bulk-paste/CSV staging helpers.
- `apps/wodsmith-start/src/server/competition-invites/claim.ts` — claim resolution, identity-match logic, status transitions.
- `apps/wodsmith-start/src/server-fns/competition-invite-fns.ts` — `issueInvitesFn`, `getInviteByTokenFn`, `declineInviteFn`, `createBespokeInviteFn`, `createBespokeInvitesBulkFn`.
- `apps/wodsmith-start/src/server-fns/registration-fns.ts` — extend `initiateRegistrationPaymentFn` with optional `inviteToken`.
- `apps/wodsmith-start/src/workflows/stripe-checkout-workflow.ts` — propagate `inviteId` from purchase metadata into invite status update.
- `apps/wodsmith-start/src/react-email/competition-invites/` — initial component library + one default template.
- `apps/wodsmith-start/src/components/compete/organizer/add-bespoke-invitee-dialog.tsx`, `bulk-add-invitees-dialog.tsx`.
- `apps/wodsmith-start/src/routes/compete/$slug/claim/$token.tsx`, `claim/$token/decline.tsx`.
- `apps/wodsmith-start/src/routes/_auth/sign-in.tsx`, `sign-up.tsx` — accept `?email=...&claim=...` and lock the email field.
- `apps/wodsmith-start/src/workers/email-queue-consumer.ts` — extend the broadcast consumer to handle `kind: "competition-invite"` messages.
- `apps/wodsmith-start/src/workflows/invite-expiry-workflow.ts` (new) or a Cron Trigger handler to sweep expired invites.

**Tests:**
- `test/server/competition-invites/claim.test.ts` — wrong account rejection, email lock, expired token, double-claim defense.
- `test/server/competition-invites/issue.test.ts` — token hashing, idempotency, division pre-attach, source vs bespoke origin tagging.
- `test/server/competition-invites/bespoke.test.ts` — single-add validation, bulk CSV parse, dedup against existing invites, dedup against source qualifiers (bespoke wins).
- `test/integration/invite-claim-flow.test.ts` — full claim → checkout → registration creation, both signed-in and signed-out paths, both source and bespoke origins.

**Verification:**
- [ ] Organizer selects sourced rows in the roster, clicks Send → emails land via Resend.
- [ ] Organizer adds a bespoke invitee via the "Add invitee" dialog → row appears in the roster's Bespoke section as draft → including it in a single-recipient send delivers a working claim email.
- [ ] Organizer pastes a CSV of bespoke invitees → valid rows stage as drafts; duplicate emails report back with a row-level "already invited" message and don't create rows.
- [ ] A bespoke invitee whose email also appears on a source leaderboard for the same division renders only in the Bespoke section (no double row).
- [ ] Clicking a claim link signed-in-as-the-right-email goes straight to a pre-attached registration page (works identically for sourced and bespoke origins).
- [ ] Clicking signed-in-as-wrong-email shows the rejection page.
- [ ] Signed-out users with no account land on `/sign-up` with email pre-filled and read-only.
- [ ] Completing Stripe Checkout flips the invite to `accepted_paid` with the new registration linked.
- [ ] An organizer cannot impersonate-claim an invite by reading the database — only the original token works.
- [ ] Expired-invite cron sets status to `expired` and the link returns "expired" page.

### Phase 3 — Rounds + Round Builder

**Goal:** sends become wave-based with subject/body/deadline metadata; the round builder UI from the mockup goes live.

**Mockup references:** `project/invites/round-builder.jsx` (right-rail builder), `project/invites/rounds-timeline.jsx` (history timeline). The athlete-side `STATUS_META` in `project/invites/leaderboard.jsx` defines the row-tint + status-pill rules the round detail view should reuse.

**Affected paths:**
- `apps/wodsmith-start/src/db/schemas/competition-invites.ts` — add `competition_invite_rounds`; `competition_invites` gains `roundId` (backfill: every Phase-2 invite assigned to a synthetic Round 1).
- `apps/wodsmith-start/src/server/competition-invites/rounds.ts` — round CRUD, draft → sending → sent transitions.
- `apps/wodsmith-start/src/server-fns/competition-invite-fns.ts` — `createRoundDraftFn`, `updateRoundDraftFn`, `sendRoundFn`, `listRoundsFn`, `getRoundDetailFn`.
- `apps/wodsmith-start/src/components/compete/organizer/round-builder/` — selected-list, smart-select buttons, round-meta form, recipients chips, send button. Mirror the right-rail layout in `docs/mockups/competition-invites/project/invites/round-builder.jsx` (selected-count display number, "Quick add" SmartSelectButton list, Round details form, Recipients chip list, sticky footer with Preview email + Send buttons, over-allocation warning).
- `apps/wodsmith-start/src/components/compete/organizer/rounds-timeline.tsx` — historical rounds with progress bar + per-round stat ticks. Mirror `docs/mockups/competition-invites/project/invites/rounds-timeline.jsx` (vertical timeline with numbered dots, stacked progress segments for ticket/accepted/pending/declined/expired, 5-up StatTick row, draft-next-round placeholder card at the bottom).
- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/invites/rounds.tsx`, `rounds/$roundId.tsx`.

**Tests:**
- `test/server/competition-invites/rounds.test.ts` — draft/send transitions, recipientCount snapshot, partial-failure round status.
- `test/integration/round-builder-flow.test.ts` — multi-round sequence: send R1, observe responses, build R2 with smart-select-non-responders.

**Verification:**
- [ ] Round 1 sends populate round metadata; R1 history view shows progress bar with ticket / accepted / pending / declined / expired.
- [ ] R2 draft can pre-select all R1 non-responders via "Re-invite non-responders" quick action.
- [ ] R2 draft can pre-select next-N-on-leaderboard via the corresponding quick action.
- [ ] R2 draft can pre-select all draft bespoke invitees via the "All draft bespoke invitees" quick action.
- [ ] A round's recipient list can mix sourced and bespoke invitees freely; the round detail view groups them visually.
- [ ] Sending an R2 to athletes who already have a `pending` R1 invite revokes the R1 token before issuing R2 (each athlete has at most one active invite per division, regardless of origin). Revoke + insert happens in one transaction; partial failure leaves R1 intact.
- [ ] Organizer can edit a round's subject/body/deadline only while `status = draft`.
- [ ] Organizer can manually revoke a `pending` invite from the roster via a "Revoke" row action; the link is dead on next click; the row shows `revoked` status and the athlete is eligible for a fresh re-invite in any subsequent round.
- [ ] `sendInviteRoundFn` is idempotent: double-clicking Send does not duplicate invites or emails; a crashed partial send can be retried cleanly from the same draft.

### Phase 4 — Email Composer + Template Library

**Goal:** structured composer over React Email components; organizer-saved templates per organizing team.

**Mockup references:** `project/invites/email-preview.jsx` for the modal frame (mock email-client header with From/To/Subject, hero block, event card with diagonal-stripe image placeholder, CTA, contact footer) and the right-rail Variables panel. **Skip the prototype's tone toggles and "Tone comparison" panel** — tone is not part of the plan.

**Affected paths:**
- `apps/wodsmith-start/src/db/schemas/competition-invites.ts` — add `competition_invite_email_templates`.
- `apps/wodsmith-start/src/react-email/competition-invites/` — finalized component set + the seeded system-default template.
- `apps/wodsmith-start/src/lib/competition-invites/render.ts` — `renderInviteEmail`, variable resolution, text fallback derivation.
- `apps/wodsmith-start/src/components/compete/organizer/email-composer/` — the structured form (hero, event card, CTA, footer).
- `apps/wodsmith-start/src/components/compete/organizer/email-preview-modal.tsx` — live in-modal preview matching `project/invites/email-preview.jsx` (sans tone panel) with a Variables panel listing `{athlete_name}`, `{source}`, `{deadline}`, `{claim_url}` resolved against a sample athlete.
- `apps/wodsmith-start/src/server-fns/competition-invite-fns.ts` — template CRUD; `previewInviteEmailFn` for the modal.
- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/invites/email-templates.tsx`.

**Tests:**
- `test/lib/competition-invites/render.test.ts` — variable resolution, unknown-variable behavior, HTML safety.
- `test/components/email-composer.test.tsx` — composer state shape, validation.
- Manual: render every system-default template against Litmus or equivalent for client compatibility — *out of automated scope*, list as a release-time check.

**Verification:**
- [ ] Organizer can save a custom template per team, scoped to their org.
- [ ] The seeded system default template renders unchanged across rounds when used.
- [ ] Email preview modal accurately reflects what athletes will receive (variables resolved against a sample athlete in the round).
- [ ] Round draft with no template selected falls back to the seeded system default.

### Phase 5 — Series Global Integration

**Goal:** the series global tab from the mockup, with direct-qualified annotation and global-slot positioning.

**Mockup references:** `SeriesGlobalView` in `project/invites/app.jsx` — table with `#`, Athlete, Best finish (SourceTag + sourceDetail), Points, Status (either "Direct-qualified" pill or `GLB N/M` chip + StatusPill).

**Affected paths:**
- `apps/wodsmith-start/src/server/competition-invites/series-roster.ts` — `getSeriesGlobalRosterForChampionship`.
- `apps/wodsmith-start/src/server-fns/competition-invite-fns.ts` — `getSeriesGlobalRosterFn`.
- `apps/wodsmith-start/src/components/compete/organizer/series-global-leaderboard.tsx`.
- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/invites/series.tsx`.

**Tests:**
- `test/server/competition-invites/series-roster.test.ts` — direct-qualified athletes are skipped from global slot count; per-source spot allocation respects mapping.

**Verification:**
- [ ] Direct-qualified athletes show "Direct-qualified" pill and are not selectable for new invites.
- [ ] Next `globalSpots` athletes get `GLB N/M` chips and appear in the global slot recommendation.
- [ ] Toggling between a series source's per-comp tabs and global tab shows consistent invite-state pills.

### Phase 6 (Post-MVP) — Enhancements

Not in scope for the initial ship; documented here for future ADR follow-ups:

- Auto-promote: when a round expires with paid count < spots, surface a "next wave" suggestion or auto-draft.
- Per-invite extension UI (already supported in schema; UI in this phase).
- Resend deliverability dashboard tied to invite status (bounce / complaint surfacing).
- Bulk CSV import of qualifiers when an organizer ran a competition outside of WODsmith.
- Multi-division per-invite (one athlete invited to multiple championship divisions in one click).

## Implementation Plan (cross-cutting)

### Affected paths summary

- **New schema:** `apps/wodsmith-start/src/db/schemas/competition-invites.ts`. Wire into `apps/wodsmith-start/src/db/schema.ts`. Use `pnpm db:push` during development, generate migration before merge with `pnpm db:generate --name=competition-invites`.
- **New server module:** `apps/wodsmith-start/src/server/competition-invites/` — sources, rounds, issue, claim, roster, series-roster.
- **New server functions:** `apps/wodsmith-start/src/server-fns/competition-invite-fns.ts`. Follow the file-per-domain convention seen in `broadcast-fns.ts`. All use `createServerFn` with explicit Zod input schemas and `getSessionFromCookie()` + `requireTeamPermission(MANAGE_COMPETITIONS)` checks.
- **New email templates:** `apps/wodsmith-start/src/react-email/competition-invites/` — components and seeded system defaults.
- **Extended workflow:** `apps/wodsmith-start/src/workflows/stripe-checkout-workflow.ts` reads `inviteId` from purchase metadata and updates invite status on successful registration creation.
- **Extended queue consumer:** `apps/wodsmith-start/src/workers/email-queue-consumer.ts` adds a `competition-invite` discriminator handler reusing the same Resend send + status update pattern as broadcasts.
- **New routes:**
  - Organizer: `routes/compete/organizer/$competitionId/invites/{index,sources,rounds,rounds/$roundId,email-templates,series}.tsx`.
  - Athlete: `routes/compete/$slug/claim/$token.tsx`, `claim/$token/decline.tsx`, `invite-pending.tsx`.
  - Auth route extensions: `_auth/sign-in.tsx` and `_auth/sign-up.tsx` accept `?email=...&claim=...` and lock the email field.
- **Cron sweep:** add an `invite-expiry` Cron Trigger in `alchemy.run.ts` running hourly, calling a queue producer that paginates expired pending invites.

### Patterns to follow

- **Auth/permissions:** every server function calls `requireTeamPermission` with `MANAGE_COMPETITIONS` on the championship's organizing team. Cross-team source references additionally check the source's organizing team. See `server-fn-auth` skill.
- **Logging:** wrap every server function in `withRequestContext` and emit `logEntityCreated` / `logEntityUpdated` for invite, round, source mutations. See `logging` skill.
- **Date/time:** all deadlines stored as `datetime`; round RSVP deadline UI runs through the date-timezone helpers. See `date-timezone` skill.
- **Tests:** unit tests for token hashing, claim identity match, roster aggregation; integration tests for the full claim → checkout → registration sequence; one E2E test (Playwright) for the happy-path organizer-builds-Round-1-and-athlete-claims flow. See `test`, `unit-test`, `integration-test`, `e2e-test` skills.
- **Drizzle:** PlanetScale, no FKs; `inArray` allowed; ULID ids; `mysql-core` types. See `local-db` skill.

### Patterns to avoid

- **Do not** re-implement broadcast queue infrastructure — extend the existing consumer with a discriminator.
- **Do not** store plaintext claim tokens in the database.
- **Do not** add a `status = "invited"` to `competition_registrations` — the invite is its own table.
- **Do not** allow organizer-supplied raw HTML in email bodies; the composer is the only authoring surface.
- **Do not** forget to lowercase + trim emails on every write and every lookup; the email is the lock. Normalization rule: `email.trim().toLowerCase()` — no unicode case-folding, no IDN normalization (WODsmith users are ASCII-email today; revisit if that changes). Apply at: invite creation, bespoke CSV parse, token-resolution lookup, session identity match.
- **Do not** compare `session.email` to `invite.email` for identity match after the first successful claim. Once `userId` is set on the invite, all subsequent lookups (status display, "my pending invitations" list) go through `userId`. This protects users who legitimately change their account email after accepting an invite.

### Verification (end-to-end, when all phases ship)

- [ ] Two competitions exist in the same organizing team. Competition A is configured with Competition B as a single-comp source (top 5 RX Men) and Series S as a series source (top 1 per comp + 6 global). Roster renders all qualified athletes with correct source attribution.
- [ ] Organizer adds 3 bespoke invitees to Competition A — one via the single-add dialog, two via CSV paste — with `bespokeReason` set on the single-add. They appear in the Bespoke section of the roster as drafts.
- [ ] Organizer composes Round 1, picks all guaranteed qualifiers + the 3 bespoke invitees, sends. Resend receives the messages with `Idempotency-Key: invite-<id>`. The round detail view shows both source-derived and bespoke recipients.
- [ ] Athlete with a WODsmith account, signed in as the invited email, clicks the link → lands on the pre-attached checkout → completes Stripe → registration appears in Competition A → invite shows `accepted_paid` in the organizer roster. Verified separately for a sourced invite and a bespoke invite — both flows are identical from the athlete's perspective.
- [ ] Athlete without a WODsmith account, signed out, clicks the link → lands on `/sign-up?email=...&claim=...` with email field locked → completes sign-up → claim re-runs with new session → checkout → registration → invite `accepted_paid`.
- [ ] An athlete forwarding the invite to a friend already signed in as a different account sees the "wrong account" page; the friend cannot claim.
- [ ] Round 1 deadline passes; cron flips remaining `pending` invites to `expired`. Organizer composes Round 2 via "Re-invite non-responders" — generates new tokens, old tokens are dead. Bespoke non-responders are included alongside source non-responders.
- [ ] Series global tab shows direct-qualified athletes with the disabled "Direct-qualified" pill; selecting them is blocked.
- [ ] Adding a bespoke invitee whose email already exists on a source leaderboard for the same division shows that athlete only in the Bespoke section, not duplicated in the source section.
- [ ] Email preview modal renders identical HTML to what arrives in the test inbox (modulo email-client style quirks).
- [ ] Removing a source mid-flight does not delete already-issued invites (sourced or bespoke); the sources list shows "0 currently in use" with a confirm dialog before delete.

## More Information

- Mockups: `docs/mockups/competition-invites/project/Invites.html` is the entry point; the per-screen JSX components live under `docs/mockups/competition-invites/project/invites/`. See the **Reference Mockups** table at the top of "Detailed Design" for which file backs each section of this plan. The prototype is directional, not a contract — known deviations:
  - **Bespoke invites** (single-add dialog, bulk paste/CSV, "Bespoke / direct invites" roster section) are not in the prototype; the implementer designs them in the same visual language.
  - **Email tone** (the prototype's `guaranteed` / `opened` / `limited` toggles in `email-preview.jsx` and `data.jsx#EMAIL_TEMPLATES`) is removed from the plan — see "Email Composer."
  - The two visual variants ("by-the-book" / "bold flagship") in the prototype are decided separately before Phase 3.
- Related ADRs:
  - [ADR-0008 Organizer Broadcast Messaging](./0008-organizer-broadcast-messaging.md) — recipient/queue/Resend pattern reused here.
  - [ADR-0007 Series Template Events](./0007-series-template-events.md) — series-as-first-class precedent and selective-sync pattern.
  - [ADR-0009 Registration Question Filtering](./0009-registration-question-filtering.md) — example of organizer-facing filter UI to mirror.
- Related code:
  - `apps/wodsmith-start/src/server/registration.ts` — the `registerForCompetition` core that invites flow into.
  - `apps/wodsmith-start/src/server-fns/series-leaderboard-fns.ts` — the series leaderboard data source.
  - `apps/wodsmith-start/src/db/schemas/broadcasts.ts` — the recipient/queue table pattern this ADR mirrors.
  - `apps/wodsmith-start/src/utils/email.tsx` — the `sendEmail` boundary; the queue consumer ultimately calls into Resend the same way.
- React Email versions in tree: `@react-email/components 0.0.32`, `@react-email/render 1.0.4`. The `email:dev` script (`pnpm email:dev`) runs the React Email dev server against `src/react-email/` for engineer-side preview during component development. The user requested "React Email 6.0 + email editor" — for this codebase that maps to the current `react-email` CLI dev preview plus the structured in-app composer described above; we are not adopting a separately-versioned "React Email 6.0" runtime.

## Open Questions (resolve before Phase 2 start)

1. When an athlete already has a paid registration for the championship (organizer-manual or public path) and an invite is being issued, do we (a) skip with a warning, (b) issue anyway as a no-op (status auto-`accepted_paid` on issue), or (c) hard-block? Suggest **(a) skip with warning** — organizer sees "12 of 14 will be sent; 2 already registered." This rule applies identically to source-derived and bespoke origins.
2. Multi-division: can one athlete be invited to RX Men *and* Masters 35-39 in the same round, generating two distinct invites? Suggest **yes** — different `championshipDivisionId` rows are allowed by the unique-active index.
3. Per-team-org email-templates vs per-championship: keep templates at the org level (current design) or scope them to a championship? Suggest **org level** — organizers running multiple championships will want consistent templates.
4. Bespoke / source dedup tie-breaking: when an athlete is both on a source leaderboard *and* added as a bespoke invitee for the same championship + division, the roster shows the bespoke row (per the design). Should the bespoke row also inherit/display the source placement as secondary info ("Bespoke · also #4 SLC Throwdown") or stay clean ("Bespoke · Sponsored athlete")? Suggest **stay clean** — the bespoke reason is what the organizer wanted shown.
5. Bespoke import file format: CSV only, or also accept a `.tsv` / Excel-paste (tab-separated)? Suggest **accept both CSV and tab-separated** since pasting a column from Google Sheets defaults to TSV.
6. **Cross-org sources**: the current "declaring a source requires `MANAGE_COMPETITIONS` on the source comp" rule effectively means sources are *same-org only*, because WODsmith does not today support cross-org permission grants. Confirm this is acceptable for MVP, or specify a grant mechanism. Suggest **same-org only** for MVP; cross-org sharing becomes a separate feature.
7. **RSVP deadline timezone**: `rsvpDeadlineAt` is stored as naive `datetime`. Interpret as the **championship's `competitionTimezone`** at write time (consistent with registration-window handling) and render in both championship TZ and recipient's local TZ in email footers via the `date-timezone` skill helpers. Confirm before Phase 3.
8. **Bulk bespoke cap**: cap CSV/paste imports at 500 rows per submission to bound one-shot validation cost. Confirm.
