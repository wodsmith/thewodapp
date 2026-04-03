# Organizer Dashboard

The competition organizer dashboard at `/compete/organizer/{competitionId}` is the central hub for managing all aspects of a competition.

## Layout and Access Control

The layout route fetches competition data and verifies the user has organizer-level access before rendering the sidebar and child routes.

Access requires authentication plus one of: platform admin role, or owner/admin membership on the competition's `organizingTeamId`. The layout provides competition data to all child routes via `parentMatchPromise`, avoiding redundant fetches. Each child route uses `getRouteApi("/compete/organizer/$competitionId")` to access parent loader data.

## Overview Page

The index page shows at-a-glance competition stats and quick action cards for common organizer tasks.

Parallel-fetches registrations, revenue stats, events, heats, division results status, and submission windows (online-only). Displays quick-action components for events, heats, submission windows, and division results that guide organizers through setup steps.

## Competition Editing

The edit page allows organizers to modify competition name, dates, description, registration window, timezone, and series group.

Fetches competition groups for the organizing team. Uses `OrganizerCompetitionEditForm` component.

## Division Management

Organizers configure which divisions athletes can register into, sourced from the team's scaling groups.

Fetches divisions with registration counts, scaling groups, and series mapping status in parallel. Uses `OrganizerDivisionManager` for CRUD on divisions. Also includes `CapacitySettingsForm` for per-division and default max spots configuration. For series competitions, shows mapping status indicating whether divisions are synced from the series template.

## Event Management

Events link workouts to the competition. Each event represents a workout athletes will perform and be scored on.

Fetches events, divisions, movements, and sponsors in parallel. Uses `OrganizerEventManager` for creating, editing, reordering, and deleting events. Events can have per-division workout descriptions, attached resources, and judging sheets. Supports parent/sub-event hierarchy for multi-workout events.

## Heat Scheduling

The schedule page manages heats — time blocks where groups of athletes perform a workout together at a venue.

Fetches venues, events, heats, divisions, and registrations in parallel. Uses `SchedulePageClient` which contains `VenueManager` and `HeatScheduleManager` components. Heats have start times, lane counts, division/venue assignments, and athlete assignments. Only available for in-person competitions.

## Locations (Venues)

CRUD management of physical venues where competition events take place.

Each venue has a name, address, and capacity. Venues are referenced by heats for scheduling.

## Registrations (Athletes)

Lists all registered athletes with division, payment status, team info, and management actions.

Uses `getOrganizerRegistrationsFn` for the full registration list with detailed athlete info. Features include:
- Sortable table with division and status filters
- Manual registration dialog (organizer adds athletes directly — see [[registration#Registration Flow#Organizer Manual Registration]])
- Remove registration (soft-delete with cascading cleanup — see [[registration#Registration Removal]])
- Transfer registration to a different division (see [[registration#Division Transfer]])
- Transfer registration to a different person (purchase transfer)
- CSV export of athlete data
- Registration questions editor (custom questions athletes answer during signup)
- Pending teammate invitations tab for team divisions

## Scoring Configuration

Configures the algorithm used to rank athletes on the leaderboard.

Fetches events for head-to-head tiebreaker selection. Uses `ScoringSettingsForm` component. Settings include scoring algorithm, point distribution, and tiebreak rules.

## Results Entry

Organizers enter scores for each athlete per event, or review video submissions for online competitions.

For **in-person competitions**: `ResultsEntryForm` provides a per-event, per-division score entry grid. Organizers select an event and division, then enter scores for each athlete. Supports publishing/unpublishing division results.

For **online competitions**: Shows a submissions overview with links to individual video verification pages at `/events/{eventId}/submissions/`. Displays submission counts and verification status per event.

## Submission Windows

Manages time windows during which athletes can submit video evidence for online competitions.

Only available when `competitionType === "online"`. Fetches workouts and competition events. Each event can have a submission window with open/close dates. Uses `SubmissionWindowsManager` component.

## Volunteers

Manages competition staff across four tabs: roster, shifts, judge scheduling, and registration rules.

### Volunteer Roster

Lists confirmed volunteers with their roles and capabilities (e.g., can input scores).

Uses `getCompetitionVolunteersFn` and `getDirectVolunteerInvitesFn`. Features invite dialog, role management, and activation/deactivation. Also shows `InvitedVolunteersList` for pending invitations.

### Volunteer Shifts

Time-based work assignments for volunteers independent of heats.

Uses `getCompetitionShiftsFn`. `ShiftList` and `ShiftFormDialog` components handle CRUD. Shifts have start/end times, role requirements, and volunteer assignments via `ShiftAssignmentPanel`.

### Judge Scheduling

Assigns judges to heats with rotation patterns so judges move between lanes across events.

Fetches heats, events, judge volunteers, rotations, heat assignments, and version history. Uses the `JudgeSchedulingContainer` component tree (rotation editor, timeline, overview, publish button). Supports rotation patterns: stay, shift right, random. Judge assignment versions allow publishing/reverting schedules.

### Volunteer Registration Rules

Custom registration questions targeted at volunteers (separate from athlete registration questions).

Uses `RegistrationQuestionsEditor` with `questionTarget: "volunteer"`.

## Waivers

Manages legal waiver documents that athletes must sign before competing.

Uses `getCompetitionWaiversFn`. `WaiverList` and `WaiverFormDialog` handle CRUD with reordering. Each waiver has a title, content (rich text), and required/optional flag.

## Pricing

Configures registration fees, requiring a verified Stripe Connect account.

If Stripe is not connected, shows `StripeConnectionRequired` with a link to team payout settings. Otherwise shows `PricingSettingsForm` with default fee, per-division fee overrides, and fee breakdown preview (platform fee, Stripe fee, organizer net).

## Revenue

Displays financial statistics for the competition including total revenue, platform fees, and organizer payouts.

Fetches revenue stats and Stripe connection status in parallel. Uses `RevenueStatsDisplay` component.

## Coupons

Discount codes that reduce registration fees for athletes.

Requires `PRODUCT_COUPONS` entitlement. `CouponsPage` handles creating and deactivating coupons with code, discount amount, usage limits, and expiration. Uses `createCouponFn`, `listCouponsFn`, `deactivateCouponFn`.

## Sponsors

Manages sponsor logos and groupings displayed on the competition's public page.

Uses `SponsorManager` component with `getCompetitionSponsorsFn`. Sponsors are organized into named groups (e.g., "Gold Sponsors", "Silver Sponsors") plus ungrouped sponsors.

## Settings

Aggregates multiple configuration forms on a single page: capacity defaults, scoring algorithm, and rotation defaults.

Uses `CapacitySettingsForm`, `ScoringSettingsForm`, and `RotationSettingsForm` components.

## Broadcasts

One-way broadcast messaging from organizers to registered athletes.

The broadcasts tab at [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/broadcasts.tsx]] lets organizers compose messages with audience filtering (all athletes, by division, all volunteers, volunteers by role, or public/everyone), preview recipient count, and send. The page displays remaining broadcast count and disables composing when the per-competition limit is reached, showing an upgrade prompt. [[apps/wodsmith-start/src/server-fns/broadcast-fns.ts#sendBroadcastFn]] checks the `broadcasts_per_competition` entitlement limit before creating a broadcast, pre-renders the email template once, and enqueues batches of up to 100 recipients into a Cloudflare Queue. The queue consumer at [[apps/wodsmith-start/src/server/broadcast-queue-consumer.ts#handleBroadcastEmailQueue]] sends emails via Resend with per-recipient idempotency keys, updating delivery status in [[apps/wodsmith-start/src/db/schemas/broadcasts.ts#competitionBroadcastRecipientsTable]]. The queue requires both a producer binding (`BROADCAST_EMAIL_QUEUE` in bindings) and a consumer registration (`eventSources` in [[apps/wodsmith-start/alchemy.run.ts]]) — without `eventSources`, messages are enqueued but never delivered. Athletes see broadcasts at [[apps/wodsmith-start/src/routes/compete/$slug/broadcasts.tsx]].

## Danger Zone

Destructive actions including competition deletion.

Shows `DeleteCompetitionForm` with registration count warning. Deletion requires confirmation and is prevented if registrations exist.

## Organizer Onboarding

The application flow for teams to become competition organizers.

At `/compete/organizer/onboard/`, teams submit an organizer request. Includes inline auth for unauthenticated users. After submission, the pending page shows request status. Admin approval is required before teams can create competitions.

## Competition Creation

New competition form at `/compete/organizer/_dashboard/new`.

Fetches organizer-eligible teams, competition groups, and series template divisions. Uses `OrganizerCompetitionForm` component. Optionally pre-selects a series group via `?groupId=` search param, inheriting the series' division template.

## Series Management

Series (competition groups) aggregate scores across multiple competitions.

The series listing and creation pages live under `_dashboard/series/` (with the standard dashboard nav/container). Individual series detail pages at `/compete/organizer/series/{groupId}` use a dedicated sidebar layout (outside the dashboard wrapper), matching the competition organizer sidebar pattern — including team authorization in the layout loader. The sidebar provides navigation to overview, edit, divisions, registration questions, event template, and leaderboard pages.
