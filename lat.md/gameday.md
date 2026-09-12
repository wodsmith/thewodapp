# Native Game Day

Game Day is a native SwiftUI iOS companion to WODsmith competitions, centered on an athlete’s next assigned heat and personal schedule. Spectators can browse without an account.

## Application architecture

The iOS app replaces the Capacitor shell in `apps/wodsmith-gameday`. WODsmith remains the authoritative server; a versioned Game Day JSON API adapts its existing competition and session data.

SwiftUI navigation separates competition discovery, the athlete’s day, and their profile. Public browsing works without authentication. Registered competitions appear before the full directory. Competition dates stay date-only; heat times are absolute instants displayed in the competition timezone.

## Athlete access

Bearer sessions use WODsmith’s credential exchange and the iOS Keychain. Athlete registrations include direct registrations and accepted, active athlete-team memberships; removed registrations never grant access.

The server derives identity from the validated session. Public discovery excludes draft and unlisted competitions; a published unlisted competition remains accessible by its identifier. Private announcements are visible only to their recorded recipients. Responses omit credentials and unrelated user data.

Sign-out immediately clears device credentials and private downloads, then attempts to revoke only that bearer session in WODsmith. Offline sign-out still removes device access; server revocation needs a working connection.

## Athlete competition defaults

Leaderboard browsing opens one division: the athlete’s earliest active registration, including team registrations, then a followed division with published results for spectators, falling back to alphabetic order.

Division IDs keep identically named divisions separate.

Registration time and registration ID provide deterministic ordering across refreshes. Registered divisions remain selectable before results exist. A valid explicit division choice survives refresh; clearing filters restores the athlete default. No leaderboard option combines divisions.

The schedule opens on assigned heats across all active registrations, including teams and multiple divisions. Athletes can switch to the full schedule and filter by division or event. Unassigned athletes see an empty personal schedule; spectators see all published heats.

Competition entry retains discovery as the initial tab and assigned heats at the top of the competition page. Registered competition lists place current/upcoming events first and past events most-recent-first, using each competition’s local day boundary.

## Schedules and reminders

Only published heats and workouts reach Game Day. An athlete’s heat belongs to their registration through an explicit lane assignment, never merely through a matching division.

Workout detail includes the base instructions and native division standards, defaulting to an active registered division when available. Standards are scoped to the competition’s scaling group and event mappings, including inherited parent-event mappings, and are cached with the workout.

Athletes opt into local notifications and choose their lead time. Reconciliation replaces notifications when a refreshed schedule changes and removes reminders when signing out. Local notifications use the last downloaded schedule and cannot learn organizer changes while the app is closed.

Notification mutations run in order across asynchronous iOS calls. Sign-out clears after any earlier add finishes, and a newer assignment refresh replaces earlier scheduling work. A failed add does not block subsequent cleanup.

Live Activity start, refresh, and end operations use their own ordered queue. A start already waiting on ActivityKit cannot create a countdown after a later sign-out cleanup has finished.

Live Activities show a user-started countdown to a downloaded heat on the Lock Screen and Dynamic Island. Foreground refresh updates the activity. Server-driven APNs changes require separate push infrastructure and verified delivery before they can be promised.

## Offline and privacy

Downloaded competition data is available during temporary connection loss with an explicit last-updated label. Athlete caches are scoped to the signed-in user and removed on sign-out.

Directory, competition, and leaderboard resources keep independent download timestamps, errors, and loading state. Each retry targets its own resource; an unrelated successful request cannot clear a stale-schedule warning or advance its timestamp.

The app uses no advertising or tracking SDKs. App Store privacy and support pages must describe the actual data flow, and release validation must include real server authentication, published competition data, signing, screenshots, and Apple submission requirements.

Privacy disclosures include linked name, email, and account identifiers for authentication and personalization, plus linked diagnostic data for server reliability. WODsmith’s existing server monitoring applies to native API requests; the native binary itself contains no analytics SDK.

## Tests

Native tests verify the athlete’s schedule and reminder invariants and exercise the primary navigation with fictional competition data. These fixtures never replace live API failures.

### Athlete competition defaults

Native regressions cover earliest active team/individual registrations, multiple divisions, duplicate labels, missing results, spectator fallback, refresh selection, and personal schedule ownership across registrations.

### Registered competition relevance

Registered current/upcoming competitions precede historical events so discovery and My day prioritize immediately relevant athlete content.

### Competition local day boundary

Discovery keeps an event through its final calendar day in the competition's timezone, even after UTC advances to tomorrow. It becomes past at local midnight.

### Native leaderboard projection

The Game Day leaderboard returns only athlete display names, registration and division references, ranks, points, and formatted event scores. Internal user IDs, teammate identities, submission URLs, and review metadata are excluded.

### Assigned heats only

An athlete sees only heats linked to an active registration through an explicit assignment. Other registrations in the same division do not confer ownership or reveal their lanes.

### Next heat transitions

The next-heat card includes a currently running heat, advances at its end, and becomes a completion state after the final heat.

### Reminder lead times

Reminder times subtract the chosen lead from each assigned heat’s absolute start time, include lane information, and exclude triggers already in the past.

### Server dates

The native decoder accepts ISO 8601 timestamps with and without fractional seconds, rejects malformed dates, and preserves date-only competition dates through cache round trips.

### Sign-out during reminder scheduling

Clearing reminders during a suspended iOS add waits for that operation and then removes pending and delivered notifications. An old add cannot restore athlete reminders after sign-out completes.

### Overlapping reminder refreshes

A newer empty assignment response removes reminders even when an earlier schedule is still adding notifications. Completion order cannot restore stale heats.

### Reminder failure recovery

A notification-center add error reaches its caller without preventing a queued clear from completing. Cleanup must work after partial scheduling failure.

### Native division standards

Workout details prefer an athlete’s active registered division and preserve its standards through a download/cache round trip. Spectators default to the first applicable division; missing standards remain explicit.

### Workout standards navigation

An athlete opens a published workout through the competition and reads the default registered division’s standards natively. The instructions stay reachable in portrait and landscape.

### Division publication boundary

The API exposes standards only for published workouts and competition divisions applicable to each event. Internal workout identifiers and competition settings stay out of the public response.

Published workouts retain database sort order and expose their one-based list position as an integer. The regression fixture uses a decimal-string database position, matching production, so native decoding never receives the internal sort representation.

### Athlete navigation

An athlete can move from My day to their competition, see the next-heat countdown, open leaderboard results, and reach configurable reminder settings.

### Accessible heat controls

At the largest accessibility text size, an athlete can scroll to the next heat’s Lock Screen action and subsequent workout details without clipped or unreachable controls.

### Live Activity controls

Starting a real simulator Live Activity exposes the end action. Ending it completes and restores the start action, exercising the asynchronous ActivityKit update queue through the athlete screen.

### Discovery accessibility audit

Apple's automated accessibility audit checks discovery descriptions, contrast, clipping, Dynamic Type, traits, and hit regions. Reviewed iOS 26.2 exceptions are recorded with native screenshots in the App Store design review.

### Accessible competition discovery

At the largest accessibility text size, competition discovery retains its search and registration information, and its freshness timestamp grows with Dynamic Type and remains reachable by scrolling.

### Personal schedule accessibility audit

Apple's automated accessibility audit checks the athlete's visible next heat and later schedule, with one documented iOS 26.2 link-contrast exception. Largest-text navigation is verified separately; full VoiceOver traversal is not certified.

### Reminder settings accessibility audit

Apple's automated accessibility audit checks the reminder toggle, lead-time picker, and explanatory text. Native settings must remain understandable to assistive technology.

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

Separate public assignments contain only published heat, active registration, and lane references.

### Resource freshness isolation

A failed competition request preserves that schedule’s last successful download time and error, even after a successful directory refresh. Settled failures stop showing a loading state.

### Contextual retry

Retrying a failed public competition requests that competition directly, replaces its cached data, and clears only its own failure after success.

### Saved unlisted competitions

Saved unlisted events load by identifier even when discovery omits them. Cached details keep them visible after relaunch; discovery does not duplicate them, and removing a saved event removes it from spectator lists.

### Spectator persistence

Spectated competition IDs and followed registration IDs survive relaunch and sign-out. Follows are scoped to competitions; unfollowing removes only the selected registration, and stopping spectating retains follows for later.

### Public follow heat mapping

Athlete and team follows match only explicit public assignments, including mixed-division heats. Multiple divisions combine matches; missing, removed, or unfollowed registrations never gain a heat through division similarity.

### Anonymous spectator navigation

A signed-out spectator marks a competition, follows an athlete and team, sees their exact lanes, relaunches with preferences intact, and unfollows back to an explanatory empty state.

### Accessible spectator controls

At the largest accessibility text size, a spectator can reach and toggle follow controls. Native screenshots also inspect the participant list in landscape; full VoiceOver traversal is not certified.

### Public participant projection

The API returns only active registration references, public display names, team flags, division references, and explicit lanes in published heats. Team captain names, contact details, credentials, and private registration metadata stay out.

## Spectator following

Spectators save competitions and follow athlete or team registrations locally without an account. Spectated competitions have a dedicated discovery section; upcoming followed heats use explicit published lane assignments.

Preferences store only competition and registration IDs in UserDefaults, separately from private download caches. Sign-out clears private data but preserves these device choices. Following a participant also marks the competition as spectating; stopping spectating retains its follows.

The participant list supports search, multiple divisions, and All participants/Following controls. Leaderboards retain exactly one division, prefer active athlete registrations, then followed divisions with published results for spectators. Schedule controls offer My heats for athletes, Following, and All heats, with multiple public division filters and earlier heats collapsed.

Public details add optional `participants` and `publicAssignments` projections. Participants include active registration IDs, display names, division IDs/labels, and a team flag. Public assignments select only those registrations and already-published heat IDs; they never populate athlete-owned assignments or reminders.

Older servers and caches may omit these fields. The app can follow leaderboard entries, explains missing public lanes, and never guesses heat membership. Deploy the updated Game Day API before distributing the spectator build to enable the full participant list and followed schedule.

## Native design

The iOS interface uses native competition rows, a compact next-heat surface, adaptive text, and explicit dates. Independent Impeccable assessments guide the removal of marketing filler and duplicated schedule content.

Competition discovery uses flat rows with compact imagery. Competition details use a smaller title, single-line hub links, and a collapsed About section. Heat reminders are available in the Competition and My day toolbars.

Schedule rows and the next-heat surface use tighter spacing and system text styles, retaining accessibility-size stacking. Routine competition freshness appears below content; download failures stay above the schedule with their retry action.

The registered-first home order follows the user’s brief. Subsequent heats do not repeat the current heat; previous heats remain accessible. Native forms, grouped lists, system navigation, and SF Symbols preserve iPhone conventions. Design evidence lives in `apps/wodsmith-gameday/AppStore/design-review.md`.

The confirmation pass covers light/dark athlete schedules and largest-text scrolling to actions and later workouts. Durable simulator evidence is stored in `apps/wodsmith-gameday/AppStore/design-evidence/`. Portrait/landscape standards and live production athlete behavior are verified. Full VoiceOver traversal, RTL, and unusually long organizer content remain bounded validation gaps.

The compact UI and athlete defaults are captured together on an iPhone 16e simulator using fictional demo data in `apps/wodsmith-gameday/AppStore/design-evidence/compact-athlete/`: competition, division leaderboard, and personal schedule.
The finite competition hub uses a regular stack: a lazy stack with the live countdown could enter a layout loop while scrolling in iOS 26.2. The app icon incorporates the parent task’s borderless artwork.

## Release preparation

WODsmith Game Day 1.0, build 1 (`6809070191`) is Waiting for Review. Apple accepted the submission on September 6, 2026 UTC. The backend and public policy pages are deployed; Apple approval remains pending.

The App Store icon is encoded as opaque RGB over its white background. Apple rejected the earlier alpha channel. The corrected signed archive and IPA pass Apple's distribution validation.

The release checklist tracks live API checks, review-account data, screenshots, Apple metadata, and Apple’s accepted submission receipt. Local fixture tests and exported binaries are preparation evidence, not proof of publication.

App Store privacy data types, purposes, linkage, and tracking answers are published with the user-authorized privacy attestation. Age ratings, content rights, the non-medical-device declaration, and free pricing are prepared; Apple calculated 13+ in most regions from the competition/content features.

Five native iPhone 14 Plus screenshots are saved in Apple's 6.5-inch English listing in athlete-first order. They use fictional records and live in `apps/wodsmith-gameday/AppStore/screenshots/`. Public territory availability is configured, subject to Apple's restrictions.

The user supplied the review contact and authorized a test account. Both are saved in App Store Connect. The ordinary test account is verified and native authentication succeeds; the approved small review event is created and athlete behavior is verified. Credentials stay outside source control.

The user authorized GitHub push and merge. PR #672 merged and production deployment 34005256436 succeeded. Live native validation then exposed decimal-string workout positions; PR #674 returns integer list positions and its production deployment passed native integration verification.

The unmodified native client verified all four public competition details and leaderboards, authenticated home, profile update/restoration, and revoked-session rejection on production. The approved review account now has three verified lane-4 assignments.

Apple accepted review submission `44ac7f00-1370-4611-aeb3-780c82ed897f` for build `888f8f4f-e04f-4459-adde-d86ceb6f2676`. The public privacy policy’s equivalent-protection clause was deployed in production run 34009157855 and verified live before publication and submission. Automatic release after approval is selected.

### Production leaderboard schema

The deployed leaderboard required three nullable benchmark columns absent from production. PlanetScale deploy request #40 added those fields and matching indexes on track_workouts and scores through the normal schema migration process.

Existing web and native leaderboard responses recovered for three published competitions. This migration changes schema only; the separately approved fictional review event contains only three fixed heats.

### Native screenshot evidence

The App Store screenshots show fictional data in real native views. All five current images, including three refreshed contrast captures, are saved in the intended order and verified after reloading Apple's listing.

### Approved review event

The ordinary Apple test athlete is registered in one unlisted fictional event with three workouts, three lane-4 heat assignments, sample results, and one announcement. The user explicitly approved this small fixture; no emails were sent.

Production checks verify ownership boundaries, division standards, announcements, offline schedule encoding, and reminder timing. The simulator displayed the live athlete schedule, started its Live Activity, and received its actual 30-minute local notification.

Reviewer notes list the fixed September 5, 6, and 12, 2026 practice heat times in America/Denver. Contact can adjust the schedule if needed; there is no repeating fixture or automatic rescheduling. Credentials remain outside source control.

## Lock Screen listing feature

The saved App Store 1.1 draft leads with a native Lock Screen countdown screenshot and promotional copy about the workout, lane, venue, and remaining time. The public 1.0 screenshot set remains unchanged until a new version is approved and released.

App Store Connect showed 1.0 Ready for Distribution on September 12, 2026. The 1.1 English (U.S.) 6.5-inch screenshot set contains the new Live Activity capture followed by the original five images. This metadata preparation does not submit a binary or release the pending native changes.

## Native app icon

The iPhone app icon uses the anvil on an opaque white square without the former circular outline. iOS applies its own rounded-square mask. The asset remains a 1024 × 1024 RGB PNG; changing the public App Store icon requires a new app build.

## Version 1.1 release integration

Version 1.1 build 5 combines the compact athlete UI, division defaults, account-free spectator follows, explicit public heat assignments, and borderless app icon. App and extension versions are generated consistently from the native project script.

The public participant/assignment API must be deployed before App Store submission. Existing 1.0 clients ignore the optional fields; no database migration is needed.

Saved spectator IDs refresh independently of discovery, including after a cache or session reset. Participant fallback results show their own freshness, error, and retry state; pull to refresh reloads the fallback only when the full participant list is absent.

Slug links cache a canonical ID alongside aliases; reminder reconciliation deduplicates those details. A confirmed 404 evicts cached competition details and aliases. Saved events still refresh after ending to detect publication changes and final results.

My heats shows only the athlete’s own lane; followed lane labels appear in Following or All heats. Registered competitions appear once above the Spectating section. UI tests wait for menu and navigation presentation and restore orientation even on failure.
