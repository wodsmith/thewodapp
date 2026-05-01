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

The captain (registering user) creates the team. A `competition_team` is created in the `teamTable` with `competitionMetadata` JSON storing `competitionId` and `divisionId`. Teammates are invited via [[apps/wodsmith-start/src/server/registration.ts#inviteUserToTeamInternal]]: existing users are added directly to the team; new users receive an email invitation with a 30-day token. Teammates are also added to the `competition_event` team. Captains can refresh expired invites via [[apps/wodsmith-start/src/server-fns/registration-fns.ts#refreshCompetitionTeamInviteFn]], which generates a new token, extends the expiry by 30 days, and resends the email.

Organizers manage roster composition from the [[organizer-dashboard#Registrations (Athletes)#Athlete Detail Page]] without captaincy: [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#addTeammateToRegistrationFn]] creates a pending invite directly (bypasses the captain-only `INVITE_MEMBERS` check by inlining the invite insert + email send), [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#removeTeammateFromRegistrationFn]] deactivates a single athlete-team membership (and the matching event-team membership) without touching the captain, [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#cancelPendingTeamInviteFn]] sets a pending invite to `CANCELLED`, and [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#resendTeamInviteAsOrganizerFn]] resends any pending invite regardless of expiry (vs. the captain-only fn which only permits *expired* refreshes).

## Capacity Management

Both division-level and competition-wide capacity are enforced at registration time and again at payment completion.

Division capacity uses `calculateDivisionCapacity` with `divisionMaxSpots` (per-division override) falling back to `competitionDefaultMax`. Competition-wide capacity checks `maxTotalRegistrations`. Pending purchases (within a time window) count toward occupied spots to prevent overselling during concurrent checkouts.

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

## Division Transfer

Organizers can move a registration between divisions via `transferRegistrationDivisionFn`.

Validates same team size between source and target divisions (individual-to-team blocked). Updates the registration's `divisionId`, removes heat assignments (division-specific), and updates the commerce purchase record. Does not enforce capacity (organizer decision).

## Day-of Check-In

In-person competitions can mark teams as physically arrived via the volunteer-facing kiosk at `/compete/{slug}/check-in`.

Check-in is **per-registration** (the whole team checks in together), tracked by `checkedInAt` and `checkedInBy` on `competitionRegistrationsTable`. Per-athlete waiver status is read separately from `waiverSignaturesTable`. Access is granted to organizers (`MANAGE_COMPETITIONS`) and to anyone with the `volunteer` role on the competition team — see [[apps/wodsmith-start/src/server-fns/check-in-fns.ts#requireCheckInAccess]]. The auth helper rejects online competitions and the registration mutations require `status = ACTIVE`, so the endpoints can't be used to manipulate cancelled registrations or online events even by direct call.

The kiosk page ([[apps/wodsmith-start/src/routes/compete/$slug/check-in.tsx]]) gates on `competitionType === "in-person"`, redirecting online competitions to the public detail page. It loads the competition's waivers and renders [[apps/wodsmith-start/src/routes/compete/$slug/check-in/-components/check-in-kiosk.tsx#CheckInKiosk]] which is the entire kiosk UI — a single-column athlete-first search interface (no separate detail panel).

### Searching Registrations

[[apps/wodsmith-start/src/server-fns/check-in-fns.ts#searchCompetitionRegistrationsFn]] returns up to 50 active registrations, optionally filtered by a substring query.

The query matches team name, member first/last name, member email, or pending-teammate email — see [[apps/wodsmith-start/src/server-fns/check-in-fns.ts#matchesQuery]]. This means a volunteer can find a partner-format team by typing any partner's name. Results are sorted with not-yet-checked-in registrations first. Each result includes every member with a per-waiver `signedWaivers` map so the UI can show which athletes still need waivers.

### Kiosk Layout

The kiosk is **athlete-first and search-only**: there is no default list of registrations. The volunteer types an athlete (or team) name, the kiosk shows matching athletes with their per-athlete waiver status and a one-tap check-in button.

A scoreboard banner sits at the top with `checked-in / total` registrations in large tabular numerals, a percent-complete progress bar, and (when the competition has required waivers) a `teams missing waivers` summary. When a search query is active, the scoreboard relabels to `Matching · Checked In` and reflects the filtered slice — that's intentional, the volunteer is reading "X of these matches are already in."

Below the scoreboard, a single large search input is the entry point. With no query, the kiosk shows an empty prompt (`Search for an athlete to check them in`) plus the pending and waivers-missing counts — never a list of athletes.

When a query is present, results are a flat list of **per-athlete rows** (one row per matching member, deduplicated across registrations). Each row shows the athlete's avatar and name, their team name (for team-format registrations) and division, and their email. A 4px colored left edge encodes registration status: emerald = checked in, amber = required waivers missing, neutral = pending. The primary action button is `Check in team` (or `Check in` for solo registrations) — a single tap checks in the entire registration, even when the row represents one teammate.

Below the athlete header, the row shows that **specific athlete's** waivers — required waivers and optional waivers, each with a `Signed` indicator or a `Sign on iPad` button that opens [[apps/wodsmith-start/src/routes/compete/$slug/check-in/-components/check-in-waiver-dialog.tsx#CheckInWaiverDialog]]. A compact `signed/required` chip summarizes the athlete's required waiver progress.

For multi-member registrations, each row has a collapsible `N teammates` strip that lists teammate first names inline. Expanding the strip reveals each teammate with their own waiver progress chip — the volunteer can spot a partner who also needs to sign without re-searching. Pending (unaccepted) invites appear in a dashed-border row.

Once a registration is checked in, the row swaps the action button for an emerald `Checked in` badge and shows a timestamp strip with an inline `Undo` button at the bottom of the card — undoing calls [[apps/wodsmith-start/src/server-fns/check-in-fns.ts#checkInRegistrationFn]] with `checkedIn: false`. If the competition has zero registrations, the empty prompt becomes "No registrations for this competition yet" instead of the search guidance.

Sort order: not-checked-in athletes first, then athletes still missing required waivers, then alphabetical by name.

### Toggling Check-In

[[apps/wodsmith-start/src/server-fns/check-in-fns.ts#checkInRegistrationFn]] sets or clears `checkedInAt` and `checkedInBy` on a registration.

The handler refuses to operate on online competitions and validates the registration belongs to the given competition. Volunteers and organizers can both check teams in and undo a check-in.

### Signing Waivers at Check-In

When a teammate hasn't signed a required waiver, the volunteer hands the iPad to the athlete and opens the waiver dialog for that specific athlete + waiver pair.

The dialog ([[apps/wodsmith-start/src/routes/compete/$slug/check-in/-components/check-in-waiver-dialog.tsx#CheckInWaiverDialog]]) displays the waiver in the standard `WaiverViewer` with an agreement checkbox and Accept button. [[apps/wodsmith-start/src/server-fns/check-in-fns.ts#signWaiverAtCheckInFn]] records the signature with `userId = athleteUserId` (so the legal record reflects who agreed), validates the athlete is part of the registration, and is idempotent under concurrency: the `(waiverId, userId)` pair has a DB-level unique index and the handler uses `INSERT … ON DUPLICATE KEY UPDATE` so two parallel taps cannot create duplicate signatures.
