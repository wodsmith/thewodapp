# Authentication

WODsmith uses password-based login with session cookies for authentication.

## Login

Email + password authentication with email verification and password reset flows.

Password hashing uses bcrypt. New users sign up with email/password, then verify via an emailed token. Password reset sends a time-limited reset link.

## Sessions

Session tokens stored as HTTP-only cookies. The `/api/get-session` endpoint validates the current session.

Session management functions live in `src/server-fns/session-fns.ts`. Auth middleware in `src/server-fns/middleware/` wraps server functions to require authentication.

### Per-request session cache

`getSessionFromCookie()` is memoized per HTTP request via `AsyncLocalStorage`.

Multiple calls within the same request lifecycle (e.g. handler + nested `requireTeamPermission`) share a single KV read. The `withSessionCache` wrapper is applied once at the fetch boundary in [[apps/wodsmith-start/src/server.ts]], and during SSR it deduplicates the session lookup across all loaders/server fns running in one request. See [[apps/wodsmith-start/src/utils/auth.ts#getSessionFromCookie]].

Custom Worker handlers that run before TanStack Start installs its request context must not call `getSessionFromCookie()`. They validate the raw `Cookie` header with [[apps/wodsmith-start/src/utils/auth.ts#getSessionFromRequestCookie]] instead, which uses the same session token validation without depending on Start's `AsyncLocalStorage`.

## Profile Settings

Authenticated users can update their name and avatar while their account email remains an immutable, accessible display value.

[[apps/wodsmith-start/src/routes/_protected/settings/profile/index.tsx#ProfileSettingsPage]] keeps email outside React Hook Form registration and the [[apps/wodsmith-start/src/server-fns/profile-fns.ts#updateUserProfileFn|profile update payload]]. Its disabled input uses the shared `Field` compound for its label and description association. [[apps/wodsmith-start/test/routes/settings/profile.test.tsx]] covers loaded and skeleton rendering, controlled editable fields, email accessibility, and payload exclusion.

## Athlete Settings

Authenticated athletes edit profile details and unit-specific physical stats while the persisted height and weight remain canonical metric values.

The physical-stat proxy inputs in [[apps/wodsmith-start/src/routes/_protected/settings/athlete/index.tsx#AthleteSettingsPage]] use the shared `Field` compound because React Hook Form owns the canonical values rather than those display controls. [[apps/wodsmith-start/test/routes/settings/athlete.test.tsx]] covers both unit systems, field accessibility, and their conversions.

### Accessible imperial physical stats

The default imperial feet, inches, and pounds controls render with programmatic labels and descriptions without requiring a `FormField` context.

### Accessible metric physical stats

The metric centimeters and kilograms controls render with programmatic labels and descriptions after the athlete changes unit preference.

### Canonical physical-stat hydration

Persisted values of 178 centimeters and 75 kilograms hydrate to 5 feet, 10 inches, and 165 pounds for an imperial athlete.

### Canonical physical-stat submission

Imperial display values of 5 feet, 10 inches, and 165 pounds submit as 178 centimeters and 75 kilograms while retaining the imperial preference.

## Authorization

Route-level auth is enforced by the `_protected` layout route. Server function auth uses middleware that validates the session and injects the current user.

Team-level permissions use `hasTeamPermission` / `requireTeamPermission` helpers that check the user's role against `TEAM_PERMISSIONS` constants. See [[domain#Teams#Team Roles and Permissions]].

Composite access helpers combine multiple checks: `requireSubmissionReviewAccess` in [[apps/wodsmith-start/src/utils/team-auth.ts#requireSubmissionReviewAccess]] verifies organizer permission OR volunteer score-input entitlement for video submission review, review notes, and verification flows.

## Cohost Authorization

Cohosts have a separate auth path from organizers, using `requireCohostPermission` from [[apps/wodsmith-start/src/utils/cohost-auth.ts#requireCohostPermission]].

Cohost server functions live in `src/server-fns/cohost/` and mirror their organizer counterparts but authenticate via the competition team ID rather than the organizing team ID. Each cohost membership stores granular permissions in `CohostMembershipMetadata` with a 1:1 mapping from sidebar nav item to boolean permission flag: Competition Setup (`divisions`, `events`, `scoring`, `registrations`, `waivers` — defaults OFF except `registrations`), Run Competition (`schedule`, `locations`, `volunteers`, `results` — defaults ON), Business (`pricing`, `revenue`, `coupons`, `sponsors` — defaults OFF). `requireCohostPermission` accepts an optional `permissionKey` to gate specific operations. The cohost module includes `cohost-division-fns.ts` (divisions gated), `cohost-event-fns.ts` (events gated), `cohost-workout-fns.ts` (events gated), `cohost-scoring-fns.ts` (scoring gated for reads, results gated for writes), `cohost-registration-fns.ts` (registrations gated), `cohost-waiver-fns.ts` (waivers gated), `cohost-schedule-fns.ts` (schedule gated), `cohost-location-fns.ts` (locations gated), `cohost-volunteer-fns.ts` (volunteers gated), `cohost-results-fns.ts` (results gated), `cohost-submission-fns.ts` (results gated), `cohost-sponsor-fns.ts` (sponsors gated), `cohost-settings-fns.ts` (capacity — divisions gated, scoring/rotation reads — base access), `cohost-pricing-fns.ts` (pricing gated), `cohost-revenue-fns.ts` (revenue gated), `cohost-coupon-fns.ts` (coupons gated), and `cohost-competition-fns.ts` (base access for reads, volunteers for rotation writes, scoring for scoring config writes).

### Cohost permission lookups

Cohost access checks query active DB memberships directly so accepted invites work before KV sessions catch up.

[[apps/wodsmith-start/src/server/cohost.ts#getCohostPermissions]] does not trust `session.teams` as the source of truth. Invite acceptance writes `team_memberships` before refreshing sessions, and Cloudflare KV can briefly return the pre-acceptance session; DB-backed checks let the new cohost land on `/compete/cohost/{competitionId}` immediately.

## Placeholder Users

Organizers can manually register athletes who don't yet have accounts, creating placeholder user records.

Placeholder users receive a claim URL with a token. When they visit the link, they create an account and claim the existing registration. The manual registration workflow lives in `src/workflows/manual-registration-workflow.ts`.
