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

## Placeholder Users

Organizers can manually register athletes who don't yet have accounts, creating placeholder user records.

Placeholder users receive a claim URL with a token. When they visit the link, they create an account and claim the existing registration. The manual registration workflow lives in `src/workflows/manual-registration-workflow.ts`.
