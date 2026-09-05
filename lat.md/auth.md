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

### Password recovery revocation

Password recovery revokes every pre-recovery browser and mobile session, including sessions rewritten by a late refresh.

[[apps/wodsmith-start/src/server-fns/auth-fns.ts#resetPasswordFn]] updates the password, awaits [[apps/wodsmith-start/src/utils/auth.ts#revokeAllUserSessions]], then consumes the reset token. A revocation failure returns an error and leaves the token available for retry, even if the password update already succeeded. Only the recovering user's current request cache and cookies are cleared.

[[apps/wodsmith-start/src/utils/kv-session.ts#revokeUserAuthentication]] writes a persistent per-user KV cutoff, then removes pre-cutoff session records across every page returned by [[apps/wodsmith-start/src/utils/kv-session.ts#getAllSessionIdsOfUser]]. The marker has no TTL so a late refresh cannot outlive it. Sessions issued after the cutoff are retained during cleanup.

[[apps/wodsmith-start/src/utils/kv-session.ts#getKVSession]] rejects authentication timestamps at or before the cutoff, including legacy records without a timestamp once that user has a cutoff. Both browser and bearer validation use this gate. Reading the cutoff adds one KV lookup for a found session and fails closed if KV errors. KV propagation is eventually consistent: an already-running request or a region with stale KV data may temporarily retain access; once the cutoff converges, rewriting an old session cannot restore access.

The existing `createdAt` field is the immutable authentication start time. Password sign-in and mobile token issuance capture it before verifying credentials; bearer token rotation carries it forward, so neither an in-flight old-password login nor rotation can bypass a later cutoff. Entitlement refresh continues to preserve it and remains separate from authentication revocation.

## Recovery tests

Focused recovery tests exercise the actual password hashing, session helpers, and API handlers with local database and KV fixtures.

### Existing sessions and new login

Recovery invalidates browser, raw-cookie, and bearer sessions across paginated KV keys while preserving unrelated users and allowing a subsequent login with the new password.

### Late refresh stays revoked

An old session rewritten after recovery remains rejected, including legacy records without an authentication timestamp.

### Recovery failures remain retryable

Marker, listing, and deletion failures return errors without consuming the reset token so recovery can be retried after the password write.

### In-flight authentication and token rotation

Password authentication begun before recovery and bearer rotation based on stale KV data retain their original timestamp and cannot authenticate after the cutoff converges.

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
