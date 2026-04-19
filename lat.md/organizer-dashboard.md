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

Fetches events, divisions, movements, and sponsors in parallel. Uses `OrganizerEventManager` for creating, editing, reordering, and deleting events. Events can have per-division workout descriptions, attached resources, and judging sheets. Supports parent/sub-event hierarchy for multi-workout events. Publishing or unpublishing a parent event cascades to all its child sub-events via [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/-components/quick-actions-events.tsx]].

### Event-Division Mappings

Controls which events are visible to which divisions within a competition via `event_division_mappings` ([[apps/wodsmith-start/src/db/schemas/event-division-mappings.ts#eventDivisionMappingsTable]]).

If NO mappings exist for a competition, all events apply to all divisions (backwards compatible). If mappings exist for an event, only the mapped divisions see and score that event. An event with no explicit mappings remains visible to all divisions even when other events in the competition have mappings (partial mapping). An event can map to multiple divisions; a division can have multiple events. Cascade cleanup is handled at the application level since PlanetScale does not enforce foreign keys. Division IDs in mappings come from `competition_divisions.divisionId` (the same IDs registrations use), not directly from `scaling_levels` — this ensures the leaderboard's division filtering matches.

The save endpoint ([[apps/wodsmith-start/src/server-fns/event-division-mapping-fns.ts#saveEventDivisionMappingsFn]]) validates all submitted trackWorkoutId/divisionId pairs belong to the competition before inserting, since PlanetScale has no FK enforcement. The read endpoint filters returned mappings against current events and divisions, discarding stale rows from changed programming tracks or scaling groups. DB error handling only catches `ER_NO_SUCH_TABLE` (for fresh deployments); all other errors propagate.

Sub-events inherit their parent container event's division mappings — only top-level events are mapped in the matrix. The workouts list ([[apps/wodsmith-start/src/routes/compete/$slug/workouts/index.tsx]]) also filters child events by division mappings, preventing sub-events from leaking across divisions. The workout count badge reflects the filtered count. The leaderboard ([[apps/wodsmith-start/src/server/competition-leaderboard.ts]]) and event detail page ([[apps/wodsmith-start/src/routes/compete/$slug/workouts/$eventId.tsx]]) both check the parent's mappings when evaluating a sub-event's visibility. The event detail page falls back to showing all divisions when the specific event has no mappings. The leaderboard UI ([[apps/wodsmith-start/src/components/leaderboard-page-content.tsx]]) validates `selectedEventId` against the division-filtered events list via `effectiveEventId`, so stale URL params (e.g. shared links across divisions) fall back to the overall view.

The event edit form ([[apps/wodsmith-start/src/components/events/event-details-form.tsx]]) also respects mappings — the "Division Variations" section only shows divisions mapped to the current event. If no mappings exist for the competition, all divisions are shown (backwards compatible). The athlete score submission panel ([[apps/wodsmith-start/src/components/compete/athlete-score-submission-panel.tsx#AthleteScoreSubmissionPanel]]) on the competition overview page also filters workouts by division mappings, so athletes only see events mapped to their selected division.

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
- Free-text search over athlete name, email, and team name (URL-backed via `?q=`)
- Affiliate filter with an explicit "None" option for athletes without an affiliate
- Client-side pagination (default page size 100, configurable 25/50/100/200/500) — all filter, search, sort, and pagination state are URL-backed search params so views are shareable
- Manual registration dialog (organizer adds athletes directly — see [[registration#Registration Flow#Organizer Manual Registration]])
- Remove registration (soft-delete with cascading cleanup — see [[registration#Registration Removal]])
- Transfer registration to a different division (see [[registration#Division Transfer]])
- Transfer registration to a different person (purchase transfer)
- CSV export of athlete data (exports the full filtered+sorted list, not just the current page)
- Registration questions editor (custom questions athletes answer during signup)
- Pending teammate invitations tab for team divisions

## Scoring Configuration

Configures the algorithm used to rank athletes on the leaderboard.

Fetches events for head-to-head tiebreaker selection. Uses `ScoringSettingsForm` component. Settings include scoring algorithm, point distribution, and tiebreak rules.

## Results Entry

Organizers enter scores for each athlete per event, or review video submissions for online competitions.

For **in-person competitions**: `ResultsEntryForm` provides a per-event, per-division score entry grid. Organizers select an event and division, then enter scores for each athlete. Supports publishing/unpublishing division results. Multi-round scores flow through [[apps/wodsmith-start/src/server-fns/competition-score-fns.ts#saveCompetitionScoreFn]], which for `time-with-cap` workouts derives per-round cap status server-side from each round's encoded value against `workout.timeCap * 1000`, persists that status on `scoreRoundsTable`, preserves the summed total on `scoresTable.scoreValue` (instead of clamping to the cap), and threads `cappedRoundCount` into `computeSortKey` so the leaderboard tiebreaker honors "fewer capped rounds wins".

For **online competitions**: Shows a submissions overview with links to individual video verification pages at `/events/{eventId}/submissions/`. Each child sub-event is listed as its own row with submission counts and verification status; the parent event name is shown as contextual metadata alongside each child row. Events without `competition_events` rows (no submission window configured) are handled gracefully.

### Division Results Publish Gate

Controls whether scores for a given (event, division) pair are visible on the public leaderboard. Organizers toggle publish state per event-division from the results entry UI.

Publish state lives in `competitionsTable.settings.divisionResults[trackWorkoutId][divisionId].publishedAt` — an ISO timestamp when published, absent/null when in draft. [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] reads this shape and gates two flows with it:

1. Per-event leaderboard entries: inside the per-event loop, `if (!divisionPublishState?.publishedAt) continue` drops any (event, division) that isn't published.
2. Video visibility: the `isEventDivisionPublished` helper returns `false` for unpublished pairs so their videos don't leak.

Defaults: when `divisionResults` is absent entirely, online competitions treat everything as hidden (opt-in publishing) while in-person competitions show everything (backwards compat for gyms that never opted into the gate). Organizers can bulk-publish all divisions for an event from `QuickActionsDivisionResults`.

## Leaderboard Preview

Organizer-only leaderboard that shows aggregated standings including unpublished division results and draft events, letting admins review the full picture before they hit publish.

Lives in the "Run Competition" sidebar group at `/compete/organizer/{competitionId}/leaderboard-preview`. The route ([[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/leaderboard-preview.tsx]]) reuses the public [[apps/wodsmith-start/src/components/leaderboard-page-content.tsx]] component with a `preview` prop. When `preview` is set, [[apps/wodsmith-start/src/server-fns/leaderboard-fns.ts#getCompetitionLeaderboardFn]] runs a server-side `requireTeamPermission(MANAGE_COMPETITIONS)` check against the organizing team and then calls [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] with `bypassPublicationFilter: true`. That flag skips both gates the public leaderboard enforces: (1) the `eventStatus = 'published'` filter on track workouts, so scores entered on draft events still appear; and (2) the per-division `divisionResults` publish check, so every scored division is included regardless of publish state. Athletes never hit this route; the public leaderboard at `/compete/{slug}/leaderboard` always passes `preview = false` and goes through the standard publish gating.

## Submission Windows

Manages time windows during which athletes can submit video evidence for online competitions.

Only available when `competitionType === "online"`. Fetches workouts and competition events. Each event can have a submission window with open/close dates. Uses `SubmissionWindowsManager` component. Only parent (top-level) events appear in the unassigned pool and are draggable; sub-events are automatically assigned to the same window as their parent and displayed as children on the window card.

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

Requires `PRODUCT_COUPONS` entitlement. `CouponsPage` handles creating and deactivating coupons with code, discount amount, usage limits, and expiration. Uses `createCouponFn`, `listCouponsFn`, `deactivateCouponFn`. All three server functions authorize both platform admins (`session.user.role === "admin"`) and team admin/owner members.

## Sponsors

Manages sponsor logos and groupings displayed on the competition's public page.

Uses `SponsorManager` component with `getCompetitionSponsorsFn`. Sponsors are organized into named groups (e.g., "Gold Sponsors", "Silver Sponsors") plus ungrouped sponsors.

## Settings

Aggregates multiple configuration forms on a single page: capacity defaults, scoring algorithm, and rotation defaults.

Uses `CapacitySettingsForm`, `ScoringSettingsForm`, and `RotationSettingsForm` components.

## Broadcasts

One-way broadcast messaging from organizers to registered athletes.

The broadcasts tab at [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/broadcasts.tsx]] lets organizers compose messages with audience filtering (all athletes, by division, all volunteers, volunteers by role, pending teammate invites, or public/everyone), preview recipient count, and send. Organizers can optionally narrow the audience by registration question answers — select questions show checkboxes, text/number questions offer an autocomplete tag input populated via [[apps/wodsmith-start/src/server-fns/broadcast-fns.ts#getDistinctAnswersFn]]. Multiple question filters are AND'd; values within each filter are OR'd. The answer lookup uses `Map<string, Set<string>>` to support multiple answers per registration/question (e.g. team registrations where different teammates answered differently). `partitionQuestionFilters` validates that all filter questionIds resolve to existing questions — stale or deleted filters throw an error rather than silently widening the recipient set. [[apps/wodsmith-start/src/server-fns/broadcast-fns.ts#sendBroadcastFn]] pre-renders the email template once and enqueues batches of up to 100 recipients into a Cloudflare Queue. The queue consumer at [[apps/wodsmith-start/src/server/broadcast-queue-consumer.ts#handleBroadcastEmailQueue]] sends emails via Resend with per-recipient idempotency keys, updating delivery status in [[apps/wodsmith-start/src/db/schemas/broadcasts.ts#competitionBroadcastRecipientsTable]]. The queue requires both a producer binding (`BROADCAST_EMAIL_QUEUE` in bindings) and a consumer registration (`eventSources` in [[apps/wodsmith-start/alchemy.run.ts]]) — without `eventSources`, messages are enqueued but never delivered. Athletes see broadcasts at [[apps/wodsmith-start/src/routes/compete/$slug/broadcasts.tsx]].

### Audience expansion

The default athlete audience matches the organizer athletes page — solo registrants, team captains, accepted non-captain teammates, and pending teammate invites that haven't been claimed.

Captains and solo registrants come from [[apps/wodsmith-start/src/db/schemas/competitions.ts#competitionRegistrationsTable]]. Accepted non-captain teammates come from [[apps/wodsmith-start/src/db/schemas/teams.ts#teamMembershipTable]] on the athlete team with `SYSTEM_ROLES_ENUM.MEMBER`. Pending invites come from [[apps/wodsmith-start/src/db/schemas/teams.ts#teamInvitationTable]] with `acceptedAt IS NULL` and non-cancelled status.

[[apps/wodsmith-start/src/server-fns/broadcast-fns.ts#fetchAthleteAudienceRows]] fetches the raw rows and [[apps/wodsmith-start/src/server-fns/broadcast-fns.ts#buildBroadcastRecipients]] deduplicates them: user rows by userId, invite rows by invitationId; an invite whose email matches an included user is dropped in favor of the user. Pending invitations are excluded when cancelled, already accepted, or past their `expiresAt` (invitations have no EXPIRED status so the timestamp is the only stale-signal).

When a `public` broadcast merges volunteers and athletes, a pending-invite row whose email matches a volunteer's user email is dropped in favor of the volunteer row — prevents the same person getting two copies. This dedup runs *after* question filtering so that a volunteer filtered out by question answers doesn't silently drop the pending-invite athlete sharing their email.

Pending-invite recipients have `userId=null` and a populated `invitationId` + captured `email` on [[apps/wodsmith-start/src/db/schemas/broadcasts.ts#competitionBroadcastRecipientsTable]], keyed by a second unique index on `(broadcastId, invitationId)` that tolerates multiple NULLs in MySQL.

### Question-filter inheritance

Teammates and pending invites inherit their captain's match against registration-question filters so that "Division = RX" keeps the whole team, not just the captain.

[[apps/wodsmith-start/src/server-fns/broadcast-fns.ts#applyAthleteQuestionFilters]] computes the set of `athleteTeamId`s whose captain's registration matched every filter, then keeps all teammates and pending invites on those teams. Captains/solos are still matched individually by `registrationId`. Without inheritance, filters silently dropped the three non-captain rows per team.

Each `Recipient` carries its `athleteTeamId` (captain/teammate/invite) or `null` (solo) so the inheritance step has the team context without re-fetching.

### Pending teammate invites filter

The `pending_teammates` audience type targets only unclaimed invitations — useful for nudging invitees to accept or submit their waiver/questions.

Optional `divisionId` narrows by inheriting `athleteTeamId`s from registrations in that division. Question filters are rejected at the schema layer ([[apps/wodsmith-start/src/server-fns/broadcast-fns.ts#audienceFilterSchema]]) for this audience type since invitees have no registration answers to match against.

The filter is exposed in the audience type picker in [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/broadcasts.tsx]] and produces invite-only recipient rows that appear in email delivery but not in the athlete in-app broadcasts list, since [[apps/wodsmith-start/src/server-fns/broadcast-fns.ts#listAthleteBroadcastsFn]] filters by `userId`.

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
