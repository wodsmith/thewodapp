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

Fetches heats, events, judge volunteers, rotations, heat assignments, and version history. Uses the `JudgeSchedulingContainer` component tree (rotation editor, timeline, overview, publish button). Supports rotation patterns: stay, shift right, random. Judge assignment versions allow publishing/reverting schedules. The "adjust for occupied lanes" feature (`adjustRotationsForOccupiedLanesFn`) splits rotations to skip unoccupied lanes; cohost routes use `cohostAdjustRotationsForOccupiedLanesFn` via the `onAdjustRotationsForOccupiedLanes` override prop on `RotationTimeline`.

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

## Co-Hosts

Manages co-host invitations, permissions, and removal at `/compete/organizer/{competitionId}/co-hosts`.

Lists active cohosts and pending invitations. Each cohost row is collapsible to show granted permissions grouped by category (Competition Setup, Run Competition, Business). Uses `InviteCohostDialog` and `EditCohostPermissionsDialog` for invite and permission management. Sidebar link lives under the Business group.

## Settings

Aggregates multiple configuration forms on a single page: capacity defaults, scoring algorithm, and rotation defaults.

Uses `CapacitySettingsForm`, `ScoringSettingsForm`, and `RotationSettingsForm` components.

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

Series routes at `_dashboard/series/` support creating, editing, and viewing series. Each series has a leaderboard aggregating results, and a division management page for configuring the shared division template that member competitions inherit. The series detail page also supports managing co-hosts across all competitions in the series via `getSeriesCohostsFn`, `inviteSeriesCohostFn`, and `removeSeriesCohostFn` from `@/server-fns/series-cohost-fns`.

# Cohost Dashboard

The cohost dashboard at `/compete/cohost/{competitionId}` mirrors the organizer dashboard but uses cohost-specific server functions with permission-scoped access.

## Series-Level Cohost Invitations

Inviting a cohost at the series level creates individual per-competition invitations tagged with `seriesGroupId` in the invitation metadata.

The organizer selects which competitions to invite to via a multi-select combobox (defaults to all). `inviteSeriesCohostFn` accepts an optional `competitionIds` array to limit scope. Only one email is sent (for the first competition), mentioning the series name. When the cohost accepts any one invitation, `acceptCohostInviteFn` auto-accepts only the sibling invitations that exist for that email and `seriesGroupId` — it never adds them to competitions they weren't invited to. The acceptance page (`cohost-invite/$token`) shows the full list of competitions via `getCohostInviteFn`, which returns `seriesCompetitions` when `seriesGroupId` is present. The `InviteCohostDialog` component supports both `mode="competition"` (default) and `mode="series"` via a discriminated union on its props; series mode requires a `competitions` prop. Server functions live in `@/server-fns/series-cohost-fns.ts`: `inviteSeriesCohostFn`, `getSeriesCohostsFn`, `removeSeriesCohostFn`, `updateSeriesCohostPermissionsFn`.

## Cohost Access Model

Cohosts are team members with a `cohost` role on the competition team, granted granular permissions per feature area.

The layout route verifies the user is a cohost (or site admin) on the competition team, then fetches permissions via `cohostGetPermissionsFn`. Permission keys include: `divisions`, `events`, `scoring`, `viewRegistrations`, `editRegistrations`, `waivers`, `schedule`, `locations`, `volunteers`, `results`, `pricing`, `revenue`, `coupons`, `sponsors`. The sidebar hides links for features the cohost lacks permission for. Permissions are also masked by team entitlements: the layout checks `PRODUCT_COUPONS` via [[apps/wodsmith-start/src/server-fns/entitlements.ts#checkTeamHasFeatureFn]] and forces `coupons` to `false` when the organizing team lacks the entitlement. Organizers can edit cohost permissions after the initial invite via `EditCohostPermissionsDialog`, which calls `updateCohostPermissionsFn` (competition level) or `updateSeriesCohostPermissionsFn` (series level, updates all memberships for that email across the series). Both dialogs accept a `hiddenPermissions` prop to hide permission checkboxes for features the team doesn't have (e.g. coupons without `PRODUCT_COUPONS` entitlement). Both are available from the dedicated co-hosts page (`/compete/organizer/{competitionId}/co-hosts`) or the series detail page.

## Cohost Server Functions

Cohost routes use server functions from `@/server-fns/cohost/` that call `requireCohostPermission(competitionTeamId, permissionKey)`.

Each cohost server fn checks the user is a cohost on that competition team AND has the specific permission key enabled. This is distinct from organizer server fns which check `requireTeamPermission(organizingTeamId, MANAGE_COMPETITIONS)` -- a permission cohosts never have. Important: cohost membership lives on `competition.competitionTeamId` (the auto-created competition_event team), NOT `competition.organizingTeamId` (the gym team). Upload authorization ([[apps/wodsmith-start/src/server/upload-authorization.ts#checkUploadAuthorization]]) also falls back to cohost permissions via `competitionTeamId` when the standard team permission check fails (e.g. judging-sheet uploads check cohost `events` permission). Cohost route loaders must use cohost-specific read functions (e.g. `cohostGetEventResourcesFn`) rather than organizer fns, since organizer fns fail auth silently under the graceful degradation pattern.

## Graceful Degradation Pattern

All server function calls in cohost route loaders are wrapped with `.catch(() => sensibleDefault)` to degrade gracefully when permissions are missing.

Two failure categories exist: (1) organizer server fns (from `@/server-fns/` directly) that cohosts can never access because they require organizing team membership, and (2) cohost server fns that require a specific permission key the cohost may not have. Both are caught so pages render with empty data instead of crashing. The catch defaults match the return type of each function (e.g., `{ workouts: [] }`, `{ divisions: [] }`, `[]` for array returns).

## Shared Component Callback Pattern

Shared UI components accept optional callback props for mutations so cohost routes can inject cohost-permissioned server functions.

Components in `organizer/-components/` and `components/` are shared between organizer and cohost routes. For mutations (create, update, delete), each component accepts optional callback props (e.g., `onBulkAssignRole`, `onSaveCapacity`, `overrides`). When omitted, the component defaults to calling the organizer server fn — so organizer routes need zero changes. Cohost routes pass callbacks that wrap cohost server fns from `@/server-fns/cohost/`, injecting `competitionTeamId` instead of `organizingTeamId`. Some shared components also accept a `routePrefix` or `eventDetailRoute` prop to ensure navigation links point to cohost routes instead of organizer routes; these default to the organizer path when omitted. Components using this pattern: VolunteersList, VolunteerRow, InviteVolunteerDialog, ShiftList, ShiftFormDialog, ShiftAssignmentPanel, QuickActionsEvents, QuickActionsHeats, QuickActionsDivisionResults, ScoringSettingsForm, PricingSettingsForm, CapacitySettingsForm, ManualRegistrationDialog, TransferDivisionDialog, TransferRegistrationDialog, WaiverList, WaiverFormDialog, SponsorManager, SubmissionWindowsManager, OrganizerDivisionManager, OrganizerTemplateSelector, RegistrationQuestionsEditor, EventResourcesCard, EventJudgingSheets, HeatSchedulePublishingCard, VenueManager, HeatScheduleManager, SchedulePageClient, OrganizerEventManager, CompetitionEventRow, EventDetailsForm, JudgeSchedulingContainer, RotationEditor, MultiRotationEditor, EventDefaultsEditor, PublishRotationsButton, RotationTimeline.

### Mutation Invalidation Contract

Every mutation in a shared component must call `router.invalidate()` after success to ensure route loader data refreshes.

Components that perform mutations (create, update, delete, assign) must call `router.invalidate()` after the server function succeeds. Use `await router.invalidate()` when subsequent code depends on fresh data. Components with optimistic local state (e.g., `useState` initialized from loader props) must also include a `useEffect` to sync local state when props change after invalidation. Without invalidation, cohost routes show stale data because the loader never re-runs — the mutation succeeds server-side but the UI keeps displaying the cached loader response.
