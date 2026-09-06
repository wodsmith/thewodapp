# WODsmith Game Day

Native SwiftUI iPhone app backed by WODsmith. Replaces the former Capacitor application. Requires Xcode 26.2 and iOS 18 or later; there are no third-party iOS dependencies.

Open `GameDay.xcodeproj` and run the shared **GameDay** scheme. The project includes the app, a WidgetKit Live Activity extension, unit tests, and UI tests. Signing uses the WODSMITH LLC team already used by the other native apps (`TV6G82BJ4U`).

## Build and test

```sh
xcodebuild -project GameDay.xcodeproj -scheme GameDay \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/GameDayDerivedData CODE_SIGNING_ALLOWED=NO build

xcodebuild -project GameDay.xcodeproj -scheme GameDay \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath /tmp/GameDayDerivedData CODE_SIGNING_ALLOWED=NO test
```

`scripts/generate-project.py` regenerates the checked-in project deterministically when adding source files. It uses Python’s standard library; XcodeGen, CocoaPods, and Swift Package Manager dependencies are unnecessary.

## Server contract

The production origin is `https://wodsmith.com`. Deploy `apps/wodsmith-start` before distributing this app: the native API is new and is not present merely because the iOS build succeeds.

- `POST /api/auth/token`: existing WODsmith email/password session exchange.
- `GET /api/gameday/v1/home`: public competition directory, and authenticated profile/registrations when a bearer session is supplied.
- `GET /api/gameday/v1/competitions/{id-or-slug}`: published competition, workouts with applicable division standards, heats, owned assignments, registrations, and permitted announcements.
- `GET /api/gameday/v1/competitions/{id-or-slug}/leaderboard`: published standings using WODsmith’s ranking service.
- `DELETE /api/gameday/v1/session`: revoke the current bearer session.
- `PATCH /api/gameday/v1/profile`: authenticated first/last name update.

The server accepts the existing `Authorization: Bearer {userId}:{sessionToken}` format. It derives all ownership from that session. Public discovery excludes draft/unlisted competitions; direct access to a published unlisted competition follows WODsmith’s existing semantics.

## Notifications and offline behavior

Heat reminders are **local notifications**, scheduled from downloaded assignments. They can fire offline, but the app must reopen to learn organizer schedule changes. This release does not yet include server-driven APNs schedule updates. Athletes choose a lead time, starting at 15 minutes.

A user-started Live Activity shows the next heat on the Lock Screen and Dynamic Island. It updates when the app refreshes and ends when the assignment is removed or its heat is over. This is not a promise of remote background schedule synchronization.

Session credentials use the iOS Keychain. Downloaded data is cached per user and cleared on sign-out. No credentials are stored in UserDefaults or the data cache. No advertising or analytics SDK is included.

## Test fixtures

Debug builds can launch with `--demo` for fictional athlete data and screenshots. Normal launches use the real API, including honest error states when the API is unavailable. Release builds never honor the demo launch flag. Do not present fictional fixtures as proof of a deployed backend.

## Release

See `AppStore/metadata.md` and `AppStore/release-status.md`. Public support and privacy documents ship with the WODsmith backend at `/gameday/support/` and `/gameday/privacy/`.
