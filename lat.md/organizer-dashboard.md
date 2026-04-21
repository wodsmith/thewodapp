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
- Manual registration dialog (organizer adds athletes directly — see [[registration#Registration Flow#Organizer Manual Registration]])
- Remove registration (soft-delete with cascading cleanup — see [[registration#Registration Removal]])
- Transfer registration to a different division (see [[registration#Division Transfer]])
- Transfer registration to a different person (purchase transfer)
- CSV export of athlete data
- Registration questions editor (custom questions athletes answer during signup)
- Pending teammate invitations tab for team divisions
- Per-athlete deep link to the [[organizer-dashboard#Registrations (Athletes)#Athlete Detail Page]] via the "View Details" item in the row's captain-scoped actions dropdown (the athlete name itself is plain text — not a link — to keep the row visually calm)

### Athlete Detail Page

At `/compete/organizer/{competitionId}/athletes/{registrationId}` — organizer-only editing surface covering every field on a single registration plus per-event scores or video submissions.

The route lives at [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/athletes/$registrationId.tsx]] and composes section components under the `-components/` sibling folder. It hydrates from [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#getOrganizerAthleteDetailFn]], a single fetch that returns the registration, captain user, athlete team memberships, pending invites, registration questions + answers, waivers + signatures, competition events, and all linked video submissions / scores.

The events list is filtered by event-division mappings using the registration's `divisionId`, mirroring the leaderboard rule (see [[organizer-dashboard#Event Management#Event-Division Mappings]]): when no mappings exist, every event is returned; when mappings exist, an event is included if neither it nor its parent has a mapping (unmapped → visible to every division) OR if it (or its parent, for sub-events) has a mapping for the registration's division. Scores and video submissions are scoped to the filtered event list, so the Scores / Video Submissions sections only show events the athlete is competing in.

Sections and the mutations they call:
- **Registration info** — inline edit of `teamName` via [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#updateRegistrationTeamNameFn]]; division change opens the shared `TransferDivisionDialog` which calls [[apps/wodsmith-start/src/server-fns/registration-fns.ts#transferRegistrationDivisionFn]]; registration removal calls [[apps/wodsmith-start/src/server-fns/registration-fns.ts#removeRegistrationFn]] and redirects back to the list. The hero action row also exposes **Transfer Registration**, which reuses the same [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/-components/transfer-registration-dialog.tsx#TransferRegistrationDialog]] the athletes list uses (calls [[apps/wodsmith-start/src/server-fns/purchase-transfer-fns.ts#initiatePurchaseTransferFn]]) — the loader pre-fetches active transfers via [[apps/wodsmith-start/src/server-fns/purchase-transfer-fns.ts#getPendingTransfersForCompetitionFn]] (filtered client-side by `commercePurchaseId`), so when one is INITIATED the button swaps to **Cancel Transfer** ([[apps/wodsmith-start/src/server-fns/purchase-transfer-fns.ts#cancelPurchaseTransferFn]]) and a yellow "Transfer Pending → recipient@email" badge with a `Link2` copy-link affordance appears in the badges row, mirroring the index page treatment. The button is disabled when the registration has no `commercePurchaseId` (e.g. organizer-comped) or the registration is `removed`.
- **Athlete profile (per member)** — per-member affiliate via [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#updateRegistrationAffiliateAsOrganizerFn]] (organizer-scoped variant of the athlete-facing `updateRegistrationAffiliateFn`, which rejects callers updating someone else's userId); affiliate is stored in `registration.metadata.affiliates[userId]` and is competition-scoped. Name and email are only editable through [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#updateAthleteUserProfileFn]] while the target user is still an unclaimed placeholder (no `passwordHash` and no `emailVerified`) — once the athlete claims their account they own those fields, and the server function rejects the write. The loader returns an `isPlaceholder` flag per member so the UI hides the name/email inputs (showing them read-only, with a "Name and email are locked" note) for claimed users; only affiliate stays editable. This keeps the organizer strictly scoped to the registration record for claimed athletes and prevents accidental edits to a user's global profile from a competition surface.
- **Roster / Team members** (team divisions only) — the roster renders `teamSize` slots in a 2-column grid: active members as profile cards, pending invites as dashed-border invite cards (with resend [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#resendTeamInviteAsOrganizerFn]] / cancel [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#cancelPendingTeamInviteFn]]), and remaining unfilled slots as clickable "Open slot" cards. The captain appears once (no duplicate row). Non-captain profile cards expose a Remove button that calls [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#removeTeammateFromRegistrationFn]]. Both the section-header "Add Teammate" button and the empty-slot cards open the same dialog, which calls [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#addTeammateToRegistrationFn]] (inline invite + email send, bypasses the captain-only `INVITE_MEMBERS` check). Invite slots use status labels "Awaiting response" (no acceptance yet) and "Awaiting sign-up" (form data submitted, account creation pending).
- **Pending invite affiliate** — organizers can pre-fill an affiliate for a teammate who hasn't created an account yet via [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#updatePendingInviteAffiliateAsOrganizerFn]] (writes to `invitation.metadata.affiliateName`). The acceptance flow in [[apps/wodsmith-start/src/server-fns/invite-fns.ts#acceptTeamInvitationFn]] transfers that value into `registration.metadata.affiliates[newUserId]` and clears it from invite metadata, mirroring how `pendingAnswers` / `pendingSignatures` are migrated.
- **Registration answers** — per-question per-participant inline edit. Active members write through [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#updateRegistrationAnswerFn]] (empty answer deletes the row). Pending invites appear as dashed-avatar rows and edit through [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#updatePendingInviteAnswerAsOrganizerFn]], which mutates the `pendingAnswers` array on `teamInvitationTable.metadata`; these prefill the sign-up form and are transferred into the answers table on invite acceptance (pending wins over captain-entered defaults). Each question shows an `N/M answered` completion chip that counts members + invites. Captain-only questions (`forTeammates=false`) never include pending invites.
- **Waivers (read-only)** — [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/athletes/-components/waivers-section.tsx]] renders one row per participant including pending invites, so a pre-signed waiver (stored in `invitation.metadata.pendingSignatures`) surfaces with a "Pre-signed" badge and the signature name. Signatures are legal records and never editable; the section header shows an `N/M signed` completion chip.
- **Video submissions** (online competitions) — rendered by [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/athletes/-components/video-submissions-section.tsx#VideoSubmissionsSection]], which respects the sub-event hierarchy: top-level events with children render as a wrapper card whose body nests one submission card per child (the parent itself has no score/video UI — scoring is per sub-event, matching [[domain#Domain Model#Video Submissions#Sub-Event Submissions]]). Standalone events render a single card. Events are grouped by `parentTrackWorkoutId` (returned from [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#getOrganizerAthleteDetailFn]] as the parent's `trackWorkoutId`, sourced from `trackWorkoutsTable.parentEventId`). Per leaf event, the captain's score renders through [[apps/wodsmith-start/src/lib/scoring/format/score.ts#formatScore]] so capped results display as `CAP (15:30)` for multi-round (summed total) or `CAP (142 reps)` for single-round (via `secondaryScore`), and `DQ` / `WD` terminal statuses render without a raw value — matching the leaderboard. `dnf` / `dns` fall back to `DNF` / `DNS` labels since `formatScore`'s status vocabulary doesn't cover them. Tiebreak is decoded with its *own* scheme (`time` → `M:SS.mmm`, `reps` → the raw integer) — NOT the main workout scheme, otherwise a reps tiebreak like `100` would render as `0:00.100` when the workout is `time-with-cap`. The edit form seeds from a decoded display value via [[apps/wodsmith-start/src/lib/scoring/decode/index.ts#decodeScore]] (e.g. `4:32`, `5+12`, `225 lbs`) — never the raw encoded `scoreValue` integer, which is a sort key. The server re-parses the decoded string on save, so the editing model matches the submission verification page. Multi-round breakdowns and tiebreaks are decoded the same way. Videos are NOT rendered inline; URLs are surfaced via [[apps/wodsmith-start/src/components/compete/organizer-video-links-editor.tsx#OrganizerVideoLinksEditor]], which renders one editable text input per teammate slot, creates new submissions for blank slots through [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#updateSubmissionVideoUrlFn]], and accepts a `renderSlotActions` render-prop so each filled slot owns an inline Delete button (no separate delete-only rows). The submission verification page reuses the same component and passes no render-prop, so its rendering is unchanged. Score entry — including the case where no video submission exists yet — uses the shared [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/athletes/-components/organizer-score-editor.tsx#OrganizerScoreEditor]], which calls [[apps/wodsmith-start/src/server-fns/competition-score-fns.ts#saveCompetitionScoreFn]] directly; "Review & adjust" still links to the submission verification page when a captain submission exists. Delete still routes through [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#deleteOrganizerVideoSubmissionFn]], which cascade-deletes the linked score row when the deleted submission was the score owner.
- **Scores** (in-person competitions) — the captain's score renders through [[apps/wodsmith-start/src/lib/scoring/format/score.ts#formatScore]] (same canonical format as the video submissions card and the leaderboard). Edit and create both use the shared [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/athletes/-components/organizer-score-editor.tsx#OrganizerScoreEditor]] (same component the video card uses) which writes via [[apps/wodsmith-start/src/server-fns/competition-score-fns.ts#saveCompetitionScoreFn]]; delete calls [[apps/wodsmith-start/src/server-fns/competition-score-fns.ts#deleteCompetitionScoreFn]].

The `OrganizerScoreEditor` mirrors the athlete-facing [[apps/wodsmith-start/src/components/compete/video-submission-form.tsx]] score section — it shares the same scheme-aware `getSchemeLabel` / `getScorePlaceholder` / `getScoreHelpText` from [[apps/wodsmith-start/src/components/compete/score-entry-helpers.ts]], parses every input via [[apps/wodsmith-start/src/lib/scoring/parse/index.ts#parseScore]] with live green "Parsed as: X" / red error feedback, renders one input per round when `workout.roundsToScore > 1` (seeded from the per-round `scoreRounds` values), auto-derives `cap` status when a single-round `time-with-cap` parses to ≥ the cap, and reveals a "Reps Completed at Cap" secondary input when that happens. Tiebreak input is validated with `parseScore(tiebreakScheme)` before submit so invalid values surface an inline error instead of being silently dropped by the server's try/catch-around-encode. The organizer-only difference vs the athlete form is the Status select, which retains `dnf` / `dns` / `dq` / `withdrawn` overrides — when a terminal status is picked, round inputs collapse and `roundScores` / `score` are omitted from the `saveCompetitionScoreFn` payload so the server records the status without a numeric value.

Why a dedicated org-side `resendTeamInviteAsOrganizerFn` exists: the captain-facing [[apps/wodsmith-start/src/server-fns/registration-fns.ts#refreshCompetitionTeamInviteFn]] rejects non-captain callers and only allows refreshing *expired* invites. The organizer variant authorizes via `MANAGE_COMPETITIONS` on the organizing team and lets organizers resend any pending invite regardless of expiry. The email is sent *before* the token is rotated in the DB — a failed send leaves the old (still-valid) link intact rather than orphaning the invite with an undelivered new token.

## Scoring Configuration

Configures the algorithm used to rank athletes on the leaderboard.

Fetches events for head-to-head tiebreaker selection. Uses `ScoringSettingsForm` component. Settings include scoring algorithm, point distribution, and tiebreak rules.

## Results Entry

Organizers enter scores for each athlete per event, or review video submissions for online competitions.

For **in-person competitions**: `ResultsEntryForm` provides a per-event, per-division score entry grid. Organizers select an event and division, then enter scores for each athlete. Supports publishing/unpublishing division results. Multi-round scores flow through [[apps/wodsmith-start/src/server-fns/competition-score-fns.ts#saveCompetitionScoreFn]], which for `time-with-cap` workouts derives per-round cap status server-side from each round's encoded value against `workout.timeCap * 1000`, persists that status on `scoreRoundsTable`, preserves the summed total on `scoresTable.scoreValue` (instead of clamping to the cap), and threads `cappedRoundCount` into `computeSortKey` so the leaderboard tiebreaker honors "fewer capped rounds wins".

For **online competitions**: Shows a submissions overview with links to individual video verification pages at `/events/{eventId}/submissions/`. Layout mirrors the volunteer review index (`/compete/$slug/review`) — parent events render as cards with their child sub-events listed inline, each row showing per-event total / reviewed / pending counts and a progress bar. Counts come from [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getSubmissionCountsByEventFn]], which gates on `requireSubmissionReviewAccess(competitionId)`, filters the requested trackWorkoutIds to those belonging to the competition's programming track (so callers can't enumerate counts across tenants), then issues grouped `COUNT() ... GROUP BY trackWorkoutId` queries for total and reviewed counts — autochunked as needed to respect MySQL parameter limits. It inner-joins `competition_registrations` to exclude submissions from removed registrations, matching the leaderboard and in-person results entry filter. This replaces the prior per-event `getEventSubmissionsFn` fan-out, which materialized full submission rows (with autochunked user/division/registration lookups) just to compute three numbers per event. The per-event review list ([[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getOrganizerSubmissionsFn]]) applies the same removed-registration filter on its registration join.

### Division Results Publish Gate

Controls whether scores for a given (event, division) pair are visible on the public leaderboard. Organizers toggle publish state per event-division from the results entry UI.

Publish state lives in `competitionsTable.settings.divisionResults[trackWorkoutId][divisionId].publishedAt` — an ISO timestamp when published, absent/null when in draft. [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] reads this shape and gates two flows with it:

1. Per-event leaderboard entries: inside the per-event loop, `if (!divisionPublishState?.publishedAt) continue` drops any (event, division) that isn't published.
2. Video visibility: the `isEventDivisionPublished` helper returns `false` for unpublished pairs so their videos don't leak.

Defaults: when `divisionResults` is absent entirely, online competitions treat everything as hidden (opt-in publishing) while in-person competitions show everything (backwards compat for gyms that never opted into the gate). Organizers can bulk-publish all divisions for an event from `QuickActionsDivisionResults`.

## Leaderboard Preview

Organizer-only leaderboard that shows aggregated standings including unpublished division results and draft events, letting admins review the full picture before they hit publish.

Lives in the "Run Competition" sidebar group at `/compete/organizer/{competitionId}/leaderboard-preview`. The route ([[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/leaderboard-preview.tsx]]) reuses the public [[apps/wodsmith-start/src/components/leaderboard-page-content.tsx]] component with a `preview` prop. When `preview` is set, [[apps/wodsmith-start/src/server-fns/leaderboard-fns.ts#getCompetitionLeaderboardFn]] runs a server-side `requireTeamPermission(MANAGE_COMPETITIONS)` check against the organizing team and then calls [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] with `bypassPublicationFilter: true`. That flag skips both gates the public leaderboard enforces: (1) the `eventStatus = 'published'` filter on track workouts, so scores entered on draft events still appear; and (2) the per-division `divisionResults` publish check, so every scored division is included regardless of publish state. Athletes never hit this route; the public leaderboard at `/compete/{slug}/leaderboard` always passes `preview = false` and goes through the standard publish gating.

### Review Status Indicators

Each scored cell on the preview deep-links to the submission review page and carries a compact badge showing review state, so organizers can see what's left to review without opening every cell.

Cells link to `/compete/organizer/{competitionId}/events/{eventId}/submissions/{submissionId}`. [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] fetches every video submission for a registration+event and folds them into a `reviewSummary` on each `eventResults` entry. The summary includes `totalSubmitted`, `expectedVideos` (= division `teamSize`), `reviewedCount` (anything other than `pending`/`under_review`), the distinct `statuses` present, and a `worstStatus` that picks the highest-priority status via `REVIEW_STATUS_PRIORITY` (pending > under_review > invalid > penalized > adjusted > verified). Summaries are gated by the same `divisionResults` publication check used for `videoUrl`, so unpublished event-divisions return `null` to non-organizer callers.

The `ReviewStatusIndicator` in [[apps/wodsmith-start/src/components/online-competition-leaderboard-table.tsx]] renders the badge using the icon and color config from [[apps/wodsmith-start/src/components/compete/submission-status-badge.tsx#getStatusConfig]] for visual consistency with the submission-detail page. Individual divisions show a single status icon. Partner/team divisions (`expectedVideos > 1`) get an "X/Y" reviewed counter alongside the icon so an organizer sees a partner pair at "verified 1/2" rather than only the captain's status. The indicator is gated behind `linkToSubmission` so it only appears on the organizer preview, never the public leaderboard.

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
