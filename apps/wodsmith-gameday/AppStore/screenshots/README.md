# App Store screenshots

These five native simulator captures are saved in the English (U.S.) iPhone 6.5-inch screenshot set for WODsmith Game Day 1.0, Apple ID `6809070191`. Their original count and order were verified after reloading App Store Connect. The local My day, competitions, and reminders images have since been refreshed for the final contrast/text changes and need replacement in the draft after its missing review-contact fields are completed.

## Capture details

The images are unretouched 1284 × 2778 PNGs from an iPhone 14 Plus running iOS 26.2. They show the implemented SwiftUI views with fictional Debug competition records, not private athlete data or proof of live-server integration. The Release app does not expose Debug demo mode.

1. `6.5-inch/01-my-day.png`: next assigned heat, lane, countdown, and later heats.
2. `6.5-inch/02-competitions.png`: registered competitions before public discovery.
3. `6.5-inch/03-workout.png`: workout instructions and registered division standards.
4. `6.5-inch/04-leaderboard.png`: division standings and the athlete's own entry.
5. `6.5-inch/05-reminders.png`: enabled reminders with a configurable lead time.

The dedicated simulator is `9A2C5891-A1A4-4643-A7C2-F80A76F91713`. The refreshed captures use build products in `/tmp/GameDayReminderTests` and are preserved in `/tmp/GameDayStoreRefresh.xcresult`. A temporary XCTest capture harness was removed after extraction; it is not part of the app or test suite. Notification permission was granted only on this simulator for the enabled-reminders capture. App Store screenshot upload does not mean that the binary has been uploaded or submitted for review.
