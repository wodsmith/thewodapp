# Registration

The registration process connects athletes to competitions, handling payment, capacity checks, team formation, and notifications.

## Registration Flow

Two entry points converge on the same core logic: athlete self-registration and organizer manual registration.

### Athlete Self-Registration

Athletes register themselves via `initiateRegistrationPaymentFn`, which handles both free and paid competitions.

The flow validates in order:
1. Registration window is open (checked against competition timezone)
2. Not already registered for the selected division(s)
3. Division capacity not exceeded
4. Competition-wide capacity not exceeded
5. Required registration questions answered
6. Fee calculated per division (division-specific fee overrides competition default)
7. Coupon applied if provided

For **free** competitions (or fully discounted by coupon): calls `registerForCompetition` directly and returns immediately.

For **paid** competitions: creates `commercePurchaseTable` records (one per division), builds Stripe Checkout line items with fee breakdown, creates a Stripe Checkout Session, and redirects the athlete. Registration is finalized asynchronously by the [[registration#Stripe Checkout Workflow]].

### Organizer Manual Registration

Organizers register athletes from the dashboard via `createManualRegistrationFn`, bypassing the registration window.

If the athlete email doesn't exist, a placeholder user is created with a personal team. The organizer sets payment status to `COMP` (complimentary) or `PAID_OFFLINE`. A claim token is generated for new users so they can create an account and claim their registration. Confirmation email is sent via the [[registration#Manual Registration Workflow]].

## Core Registration Logic

The `registerForCompetition` function in `src/server/registration.ts` is the shared core for both entry points.

It handles:
- Competition and division validation (division must belong to competition's scaling group)
- Duplicate registration prevention (per division, not per competition — multi-division is allowed)
- Team division logic: creates a `competition_team`, adds captain, stores pending teammates as JSON
- Team name uniqueness check (case-insensitive within competition)
- Teammate conflict checks: not already registered, not on another team, not already invited in same division
- Adds athlete to the `competition_event` team as a member
- Upserts affiliate name to the affiliates table
- Updates user sessions to include new team memberships

**Important**: This function does NOT send notifications. Callers are responsible for sending confirmation emails with the appropriate payment context.

## Multi-Division Registration

Athletes can register for multiple divisions in a single checkout session.

Each division becomes a separate line item in Stripe Checkout and a separate `commercePurchaseTable` record. Free divisions within a mixed checkout are registered immediately while paid ones go through Stripe. The `items` array in the input schema supports this, with duplicate division validation.

Downstream, scores stay scoped per division — see [[lat.md/domain#Domain Model#Scoring#One score per athlete per event per division]] for the unique key and write/read contracts that prevent a partner-division score from leaking onto the individual leaderboard when the same track workout is shared across both divisions.

## Team Registration

Team divisions (teamSize > 1) require a team name and teammate emails during registration.

The captain (registering user) creates the team. A `competition_team` is created in the `teamTable` with `competitionMetadata` JSON storing `competitionId` and `divisionId`. Teammates are invited via [[apps/wodsmith-start/src/server/registration.ts#inviteUserToTeamInternal]]: existing users are added directly to the team and emailed via [[apps/wodsmith-start/src/utils/email.tsx#sendCompetitionTeamMemberAddedEmail]] (link goes to the team roster page so they can answer registration questions and sign waivers); new users receive an email invitation with a 30-day token via [[apps/wodsmith-start/src/utils/email.tsx#sendCompetitionTeamInviteEmail]]. Teammates already on the athlete team are not re-emailed. Teammates are also added to the `competition_event` team. Captains can refresh expired invites via [[apps/wodsmith-start/src/server-fns/registration-fns.ts#refreshCompetitionTeamInviteFn]], which generates a new token, extends the expiry by 30 days, and resends the email.

The public competition page surfaces unclaimed teammate invites for the signed-in user's email. [[apps/wodsmith-start/src/server-fns/competition-detail-fns.ts#getPendingTeamInvitesFn]] scopes active invitations to the competition's athlete teams, and [[apps/wodsmith-start/src/components/registration-sidebar.tsx#RegistrationSidebar]] renders an "Accept Team Invite" CTA that links to `/compete/invite/$token`.

Organizers manage roster composition from the [[organizer-dashboard#Registrations (Athletes)#Athlete Detail Page]] without captaincy: [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#addTeammateToRegistrationFn]] creates a pending invite directly (bypasses the captain-only `INVITE_MEMBERS` check by inlining the invite insert + email send), [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#removeTeammateFromRegistrationFn]] deactivates a single athlete-team membership (and the matching event-team membership) without touching the captain, [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#cancelPendingTeamInviteFn]] sets a pending invite to `CANCELLED`, and [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#resendTeamInviteAsOrganizerFn]] resends any pending invite regardless of expiry (vs. the captain-only fn which only permits *expired* refreshes).

## Capacity Management

Both division-level and competition-wide capacity are enforced at registration time and again at payment completion.

Division capacity uses `calculateDivisionCapacity` with `divisionMaxSpots` (per-division override) falling back to `competitionDefaultMax`. Competition-wide capacity checks `maxTotalRegistrations`. Pending purchases (within a time window) count toward occupied spots to prevent overselling during concurrent checkouts.

Invite-locked registration bypasses the public `isFull` derived from this calc when resolving the invited division's eligibility — see [[competition-invites#Registration hand-off from claim]]. The bypass is necessary because the public count includes the invitee's *own* pending Stripe hold, which would otherwise self-fill the division on retry. Caps are still enforced by the per-(source, division) allocation guardrail and the payment-time re-check.

ADR-0013: the [[competition-invites#Sent invites tab]] reads the same `divisionMaxSpots ?? competitionDefaultMax` value for its per-division headline denominator, so the organizer-facing invite progress and the registration enforcement gate cannot drift. The divisions page is the single edit point for both.

## Stripe Checkout Workflow

A Cloudflare Workflow that processes `checkout.session.completed` events from Stripe webhooks.

Three durable steps with independent retries:
1. **create-registration**: Idempotency checks (by purchaseId and by user+division), re-checks capacity (refunds automatically if full), creates registration, stores answers, records payment in financial events
2. **send-confirmation-email**: Sends registration confirmation email (non-blocking — failure doesn't block step 3)
3. **send-slack-notification**: Sends Slack notification for team visibility

If division or competition fills during payment, the workflow automatically issues a Stripe refund and marks the purchase as `FAILED`. In local dev, `processCheckoutInline` runs the same logic synchronously.

## Manual Registration Workflow

A Cloudflare Workflow that sends confirmation emails for organizer-created registrations.

Counts pending waivers for the athlete, then sends a confirmation email. For placeholder users, the email includes a claim URL. Single step with 3 retries and exponential backoff. In local dev, `processManualRegistrationInline` runs synchronously.

## Registration Removal

Organizers can soft-delete registrations via `removeRegistrationFn`, setting status to `REMOVED`.

Cascading cleanup: deactivates team memberships (captain in event team + all members in athlete team), cancels pending invitations, deletes heat assignments, and deletes scores for the registered user(s) across all competition events. Requires `MANAGE_COMPETITIONS` permission.

## Registration Refund

Organizers can refund a paid registration via [[apps/wodsmith-start/src/server-fns/registration-fns.ts#refundRegistrationFn]]. This is a separate action from removal — refunds and removals can be done independently or together.

Express-only: surface this action only when the organizing team's connected account is `express` and `VERIFIED`. Standard accounts manage refunds in their own Stripe dashboard, so we do not initiate them through the platform.

Charges use destination charges (`transfer_data.destination` + `application_fee_amount`), so we refund on the platform `payment_intent` with two explicit flags that decide who pays for the refund:

- `reverse_transfer: true` — funds are pulled from the organizer's connected account, not the platform balance.
- `refund_application_fee: false` — the platform fee we collected stays as platform revenue and is NOT returned to the organizer or the customer.

Both flags are set explicitly (not via Stripe defaults) since this controls who bears the refund cost. A `REFUND_INITIATED` financial event is recorded immediately; the existing `charge.refunded` webhook records `REFUND_COMPLETED` once Stripe confirms.

### Partial refunds and concurrency

Refunds accept an optional `amountCents` and reject any request that would exceed the remaining balance, computed from prior `REFUND_INITIATED` events.

When `amountCents` is omitted, the request defaults to a full refund of the remaining balance. The handler computes `remainingCents = purchase.totalCents − Σ|prior REFUND_INITIATED amountCents|` and requires `requestedAmountCents ≤ remainingCents`. Once `remainingCents` reaches zero the action is rejected as already-fully-refunded.

The balance check, the Stripe call, and the financial-event write all run inside a single `db.transaction()` that opens with `SELECT ... FOR UPDATE` on the `commerce_purchases` row. The `tx` is threaded into [[apps/wodsmith-start/src/server/commerce/financial-events.ts#recordRefundInitiated]] via its `db` parameter so the `REFUND_INITIATED` INSERT participates in the same transaction (without it, the helper's internal `getDb()` would commit on a separate connection and survive a rollback). PlanetScale (Vitess) supports `FOR UPDATE` in single-shard transactions and queues hot-row contenders, so concurrent organizer refund requests for the same purchase serialize: the second attempt waits for the first commit (or rollback), then sees the freshly-recorded `REFUND_INITIATED` row and recomputes its remaining balance accordingly. Trade-off: the lock is held across the Stripe network call. Refunds are organizer-driven and low-frequency, so the lock duration is acceptable; releasing the lock before the Stripe call would reopen the TOCTOU race.

### Stripe idempotency key

The Stripe idempotency key MUST stay stable across client retries; otherwise Stripe processes a duplicate refund.

Callers can pass an `idempotencyToken` (UUID generated on click, replayed on timeout retry) — the key becomes `refund:${token}`. When omitted, the key is `refund:${purchaseId}:${requestedAmountCents}`, which is retry-safe for the full-refund path because the remaining-balance check rejects the retry before reaching Stripe but cannot distinguish two intentional partial refunds of the same amount. Partial-refund callers should always supply a token.

The athletes loader [[apps/wodsmith-start/src/server-fns/competition-detail-fns.ts#getOrganizerRegistrationsFn]] returns `canRefund` (team capability) and `refundsByPurchaseId` — a `Record<purchaseId, {refundedCents, totalCents}>` keyed off REFUND_INITIATED events. The loader uses INITIATED rather than INITIATED + COMPLETED so the totals don't double-count once Stripe's webhook lands. Per-purchase refund summaries let the athletes UI render a [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/-components/refund-status-badge.tsx#RefundStatusBadge]] ("Refunded" when `refundedCents ≥ totalCents`, "Partially refunded ($X)" otherwise) and gate the dropdown's "Refund Registration" item on whether any refund is recorded.

## Division Transfer

Organizers can move a registration between divisions via `transferRegistrationDivisionFn`.

Validates same team size between source and target divisions (individual-to-team blocked). Updates the registration's `divisionId`, removes heat assignments (division-specific), and updates the commerce purchase record. Does not enforce capacity (organizer decision).
