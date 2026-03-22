# Authentication

WODsmith uses password-based login with session cookies for authentication.

## Login

Email + password authentication with email verification and password reset flows.

Password hashing uses bcrypt. New users sign up with email/password, then verify via an emailed token. Password reset sends a time-limited reset link.

## Sessions

Session tokens stored as HTTP-only cookies. The `/api/get-session` endpoint validates the current session.

Session management functions live in `src/server-fns/session-fns.ts`. Auth middleware in `src/server-fns/middleware/` wraps server functions to require authentication.

## Authorization

Route-level auth is enforced by the `_protected` layout route. Server function auth uses middleware that validates the session and injects the current user.

Team-level permissions use `hasTeamPermission` / `requireTeamPermission` helpers that check the user's role against `TEAM_PERMISSIONS` constants. See [[domain#Teams#Team Roles and Permissions]].

## Cohost Authorization

Cohosts have a separate auth path from organizers, using `requireCohostPermission` from [[apps/wodsmith-start/src/utils/cohost-auth.ts#requireCohostPermission]].

Cohost server functions live in `src/server-fns/cohost/` and mirror their organizer counterparts but authenticate via the competition team ID rather than the organizing team ID. Each cohost membership stores granular permissions (`canViewRevenue`, `canEditCapacity`, `canEditScoring`, `canEditRotation`, `canManagePricing`) in `CohostMembershipMetadata`. `requireCohostPermission` accepts an optional `permissionKey` to gate specific write operations. The cohost module includes `cohost-registration-fns.ts` (athlete list, manual registration, removal, division transfer), `cohost-waiver-fns.ts` (CRUD + reorder), `cohost-schedule-fns.ts` (heat CRUD, assignments, bulk ops), `cohost-location-fns.ts` (venue CRUD), `cohost-volunteer-fns.ts` (roster, invites, shifts, roles, score access), `cohost-results-fns.ts` (division results publish/unpublish), `cohost-submission-fns.ts` (video submission review, score verification), `cohost-sponsor-fns.ts` (sponsor and sponsor group CRUD), `cohost-settings-fns.ts` (capacity — canEditCapacity gated, scoring — canEditScoring gated, rotation — canEditRotation gated), `cohost-pricing-fns.ts` (fee config, division fee overrides — canManagePricing gated), `cohost-revenue-fns.ts` (revenue stats — canViewRevenue gated), `cohost-coupon-fns.ts` (coupon CRUD — canManagePricing gated), and `cohost-scoring-fns.ts` (score entry, update, delete for events).

## Placeholder Users

Organizers can manually register athletes who don't yet have accounts, creating placeholder user records.

Placeholder users receive a claim URL with a token. When they visit the link, they create an account and claim the existing registration. The manual registration workflow lives in `src/workflows/manual-registration-workflow.ts`.
