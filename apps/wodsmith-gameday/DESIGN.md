# Game Day native design

Game Day is an operational competition companion. Its design helps an athlete answer when, where, and what follows. Root-level WODsmith design documents describe a separate web benchmark surface and do not govern this iPhone layout.

## Structure

Use SwiftUI TabView for Competitions, My day, and Profile. Each tab uses NavigationStack. The Competitions home keeps the user-requested order: registered competitions first, then discovery. Profile and filters use native grouped lists, forms, and pickers.

Competition discovery uses text-led native navigation rows. Real organizer imagery may identify a competition; missing imagery does not produce a decorative placeholder hero. Internal destinations use chevrons, outbound links are named as such.

## Athlete schedule

The next heat is a compact distinct surface with the workout, heat, venue, local day, start time, lane, and live countdown. Each fact appears once. Subsequent heats use aligned rows; earlier heats are disclosed separately.

The countdown is genuine measurement, so tabular numerals are appropriate. All typography uses system styles. Critical metadata stacks vertically at accessibility text sizes. Large custom marketing headlines, tracked eyebrows, colored row rails, motivational slogans, and repeated card scaffolds are excluded.

## Color and state

System grouped backgrounds and semantic primary/secondary text support light and dark appearances. A darker orange serves light-mode interactive text; a brighter orange serves dark mode. The white-on-ink next-heat surface has a known high-contrast pairing.

Freshness, loading, errors, and retry belong to the exact resource being displayed. A successful directory request must never make a stale heat schedule look current. Missing results, failed requests, and empty filters have distinct explanations.

## Native behavior

Use system sheets for focused sign-in, alerts for actionable failures, native buttons with adequate targets, and system transitions. Confirm active Live Activities with a local end action. Do not add decorative motion or custom glass; system tab-bar materials remain native.
