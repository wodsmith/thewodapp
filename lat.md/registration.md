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

## Team Registration

Team divisions (teamSize > 1) require a team name and teammate emails during registration.

The captain (registering user) creates the team. A `competition_team` is created in the `teamTable` with `competitionMetadata` JSON storing `competitionId` and `divisionId`. Teammates are invited via `inviteUserToTeamInternal`: existing users are added directly to the team; new users receive an email invitation with a 30-day token. Teammates are also added to the `competition_event` team. Captains can refresh expired invites via [[apps/wodsmith-start/src/server-fns/registration-fns.ts#refreshCompetitionTeamInviteFn]], which generates a new token, extends the expiry by 30 days, and resends the email.

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
