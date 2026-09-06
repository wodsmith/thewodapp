# Native Game Day

Game Day is a native SwiftUI iOS companion to WODsmith competitions, centered on an athlete’s next assigned heat and personal schedule. Spectators can browse without an account.

## Application architecture

The iOS app replaces the Capacitor shell in `apps/wodsmith-gameday`. WODsmith remains the authoritative server; a versioned Game Day JSON API adapts its existing competition and session data.

SwiftUI navigation separates competition discovery, the athlete’s day, and their profile. Public browsing works without authentication. Registered competitions appear before the full directory. Competition dates stay date-only; heat times are absolute instants displayed in the competition timezone.

## Athlete access

Bearer sessions use WODsmith’s credential exchange and the iOS Keychain. Athlete registrations include direct registrations and accepted, active athlete-team memberships; removed registrations never grant access.

The server derives identity from the validated session. Public discovery excludes draft and unlisted competitions; a published unlisted competition remains accessible by its identifier. Private announcements are visible only to their recorded recipients. Responses omit credentials and unrelated user data.

Sign-out immediately clears device credentials and private downloads, then attempts to revoke only that bearer session in WODsmith. Offline sign-out still removes device access; server revocation needs a working connection.

## Schedules and reminders

Only published heats and workouts reach Game Day. An athlete’s heat belongs to their registration through an explicit lane assignment, never merely through a matching division.

Workout detail includes the base instructions and native division standards, defaulting to an active registered division when available. Standards are scoped to the competition’s scaling group and event mappings, including inherited parent-event mappings, and are cached with the workout.

Athletes opt into local notifications and choose their lead time. Reconciliation replaces notifications when a refreshed schedule changes and removes reminders when signing out. Local notifications use the last downloaded schedule and cannot learn organizer changes while the app is closed.

Live Activities show a user-started countdown to a downloaded heat on the Lock Screen and Dynamic Island. Foreground refresh updates the activity. Server-driven APNs changes require separate push infrastructure and verified delivery before they can be promised.

## Offline and privacy

Downloaded competition data is available during temporary connection loss with an explicit last-updated label. Athlete caches are scoped to the signed-in user and removed on sign-out.

Directory, competition, and leaderboard resources keep independent download timestamps, errors, and loading state. Each retry targets its own resource; an unrelated successful request cannot clear a stale-schedule warning or advance its timestamp.

The app uses no advertising or tracking SDKs. App Store privacy and support pages must describe the actual data flow, and release validation must include real server authentication, published competition data, signing, screenshots, and Apple submission requirements.

## Tests

Native tests verify the athlete’s schedule and reminder invariants and exercise the primary navigation with fictional competition data. These fixtures never replace live API failures.

### Assigned heats only

An athlete sees only heats linked to an active registration through an explicit assignment. Other registrations in the same division do not confer ownership or reveal their lanes.

### Next heat transitions

The next-heat card includes a currently running heat, advances at its end, and becomes a completion state after the final heat.

### Reminder lead times

Reminder times subtract the chosen lead from each assigned heat’s absolute start time, include lane information, and exclude triggers already in the past.

### Server dates

The native decoder accepts ISO 8601 timestamps with and without fractional seconds, rejects malformed dates, and preserves date-only competition dates through cache round trips.

### Native division standards

Workout details prefer an athlete’s active registered division and preserve its standards through a download/cache round trip. Spectators default to the first applicable division; missing standards remain explicit.

### Workout standards navigation

An athlete opens a published workout through the competition and reads the default registered division’s standards natively. The instructions stay reachable in portrait and landscape.

### Division publication boundary

The API exposes standards only for published workouts and competition divisions applicable to each event. Internal workout identifiers and competition settings stay out of the public response.

### Athlete navigation

An athlete can move from My day to their competition, see the next-heat countdown, open leaderboard results, and reach configurable reminder settings.

### Accessible heat controls

At the largest accessibility text size, an athlete can scroll to the next heat’s Lock Screen action and subsequent workout details without clipped or unreachable controls.

### API identity boundary

Expired bearer credentials and anonymous profile changes fail before database access. Personalized API responses cannot be stored by shared caches.

### Session revocation boundary

Sign-out revokes only the validated bearer session. Body-supplied user or session identifiers cannot revoke another device, and anonymous requests are rejected.

### Public discovery boundary

Spectator discovery selects only published public competitions and contains no profile or registration data.

### Team registration ownership

Registration queries derive the athlete from the session, require active registrations, and include teammates only through active athlete-team membership.

### Draft competition boundary

Unknown or draft competitions return 404 before schedules, announcements, or leaderboard calculations run.

### Published schedule and announcement boundary

Spectator competition details select only published heats and workouts and sent public announcements. Personal lane assignments are absent without registration ownership.

### Resource freshness isolation

A failed competition request preserves that schedule’s last successful download time and error, even after a successful directory refresh. Settled failures stop showing a loading state.

### Contextual retry

Retrying a failed public competition requests that competition directly, replaces its cached data, and clears only its own failure after success.

## Native design

The iOS interface uses native competition rows, a compact next-heat surface, adaptive text, and explicit dates. Independent Impeccable assessments guide the removal of marketing filler and duplicated schedule content.

The registered-first home order follows the user’s brief. Subsequent heats do not repeat the current heat; previous heats remain accessible. Native forms, grouped lists, system navigation, and SF Symbols preserve iPhone conventions. Design evidence lives in `apps/wodsmith-gameday/AppStore/design-review.md`.

The confirmation pass covers light/dark athlete schedules and largest-text scrolling to actions and later workouts. Durable simulator evidence is stored in `apps/wodsmith-gameday/AppStore/design-evidence/`. VoiceOver, landscape, RTL, and live-data release checks remain explicit gaps.

## Release preparation

The iOS 1.0 App Store record is WODsmith Game Day (`6809070191`). A signed device archive and App Store distribution IPA have been exported, but neither backend deployment nor build upload nor review submission is complete.

The release checklist tracks live API checks, review-account data, screenshots, Apple metadata, and the outstanding Developer Program agreement. Local fixture tests and exported binaries are preparation evidence, not proof of publication.
