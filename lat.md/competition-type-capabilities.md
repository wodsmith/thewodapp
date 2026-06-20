---
lat:
  require-code-mention: true
---
# Competition Type Capabilities

Competition type capabilities define which product behaviors each stored competition type enables while keeping existing in-person and online behavior unchanged.

## Registry Source of Truth

The registry maps each competition type to named capabilities, its leaderboard variant, and create-picker selectability without adding a database field.

[[apps/wodsmith-start/src/lib/competitions/capabilities.ts#COMPETITION_TYPE_REGISTRY]] keeps `competitionType` as the stored discriminator and exposes [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#competitionCan]], [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#leaderboardVariant]], and [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#isSelectableType]] for later call-site refactors. In-person competitions retain heat scheduling, day-of check-in, physical venue, volunteer scheduling, and organizer-entered results. Online competitions retain video submissions, submission windows, opt-in result publishing, and the online leaderboard variant. Benchmark competitions retain video submissions and the online leaderboard visual variant, add the `perpetual` capability, and intentionally skip submission windows and opt-in result publishing.

Server submission gates now consume the registry for the API, server-function, and leaderboard paths: score-window checks use `submissionWindows`, while benchmark status checks use `perpetual` to stay open without seeded window rows. Video submission checks use `videoSubmissions`. The dedicated leaderboard refactor also routes the online table decision through `leaderboardVariant` and the hidden-until-published default through `optInResultPublishing`; [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] stayed minimal because GitNexus reports HIGH blast radius.

The `scoringAlgorithm === "online"` axis remains separate from `competitionType === "online"`. Capability checks must not replace scoring-algorithm branches.

## Capability Truth Table Test

The truth-table test pins every capability and leaderboard variant for registered competition types while unknown values fail closed.

[[apps/wodsmith-start/test/lib/competitions/capabilities.test.ts]] verifies each capability for every registered type, confirms registry metadata matches type identity, and covers the unknown-type fallback. Benchmark is registered but remains out of generic create-picker options.

Focused PR-2 server-function tests pin that in-person score saves pass the submission-window gate, online score saves still honor closed windows, and in-person video submissions still reject before writes. PR-3 adds [[apps/wodsmith-start/test/components/leaderboard-page-content.test.tsx]] coverage for standard versus online leaderboard table selection plus [[apps/wodsmith-start/test/server/competition-leaderboard-capability-gates.test.ts]] coverage for opt-in result publishing defaults and the leaderboard video-submission fetch gate. PR-4 adds [[apps/wodsmith-start/test/lib/competitions/scheduling-check-in-gates.test.ts]] coverage for the heat scheduling and day-of check-in gates used by the public schedule, judge rotations, check-in routes, and check-in server functions. PR-5 adds [[apps/wodsmith-start/test/lib/competitions/venue-volunteer-gates.test.ts]] and [[apps/wodsmith-start/test/components/competition-location-card.test.tsx]] coverage for physical venue display and volunteer schedule-tab gates.

### Current Type Matrix

This test verifies every registered competition type keeps its expected capability, leaderboard variant, and create-selectability behavior.

### Registry Metadata Alignment

This test verifies registry keys, ids, labels, and capability sets stay aligned with the supported stored competition-type identities.

### Unknown Type Fallback

This test verifies unregistered competition types fail closed for capabilities, use the standard leaderboard variant, and stay unselectable.

## Create Picker Selectability Test

The create-picker test pins that selectable competition type options are derived from registry selectability while benchmark remains hidden.

[[apps/wodsmith-start/test/lib/competitions/capabilities.test.ts]] verifies [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#selectableCompetitionTypes]] returns only in-person and online type definitions, with each entry passing [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#isSelectableType]] and [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#isSelectableCompetitionTypeValue]]. [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#selectableCompetitionTypeOptions]] provides the registry-backed label and description text that the generic organizer create and edit form pickers render, while the form and server schemas use the same selectable-value guard that rejects benchmark for this picker.

## Perpetual Window Status Test

The window-status test pins benchmark as open without submission-window rows while online competitions still require configured rows.

[[apps/wodsmith-start/test/routes/api/compete/scores/window-status.test.ts]] verifies the score window-status API returns open/null-window metadata for benchmark because it has `perpetual`, while online stays closed when no submission-window row exists.

## Scheduling and Check-In Gates Test

These tests pin capability helpers that route public schedules, heat scheduling, and day-of check-in without direct type checks.

### Public Schedule Mode

This test verifies in-person public schedules use heats while online schedules use submission-window data.

### Heat Scheduling Gate

This test verifies heat scheduling remains available only for in-person competitions.

### Day-Of Check-In Gate

This test verifies day-of check-in remains available only for in-person competitions.

### Check-In Permission Gate

This test verifies check-in surfacing also requires organizer or volunteer access.

### Unknown Type Scheduling Fallback

This test verifies unregistered competition types expose no schedule or check-in capabilities.

## Venue and Volunteer Gates Test

These tests pin the capability helpers that control physical venue display and volunteer scheduling tabs.

### Physical Venue Display

This test verifies physical venue display remains available only for in-person competitions.

### Volunteer Scheduling Availability

This test verifies volunteer scheduling remains available only for in-person competitions.

### Volunteer Schedule Tab Fallback

This test verifies unavailable schedule tabs fall back to roster while non-schedule volunteer tabs remain reachable.

### Unknown Type Venue Volunteer Fallback

This test verifies unregistered competition types expose no venue or volunteer scheduling capabilities.

## Results Entry and Sidebar Gates Test

PR-6 tests pin that result-entry labels and sidebar tabs come from capabilities rather than direct competition-type checks.

[[apps/wodsmith-start/test/lib/competitions/capabilities.test.ts]] covers the result-entry mode and Results/Submissions label helper. [[apps/wodsmith-start/test/components/competition-sidebar-capability-gates.test.ts]] covers organizer and cohost sidebar labels plus capability-gated schedule, check-in, venue, and submission-window tabs while preserving online Volunteers links for non-scheduling volunteer workflows. [[apps/wodsmith-start/test/routes/compete/results-route-capability-branching.test.ts]] covers the organizer and cohost results route branch selectors for organizer-entered versus athlete-submitted modes.

### Registry Results Mode Labels

This test verifies result-entry mode and Results/Submissions labels are derived from the organizer-entered-results capability.

### Organizer Results Route Mode

This test verifies organizer results routes select organizer-entered or athlete-submitted modes through capability helpers.

### Cohost Results Route Mode

This test verifies cohost results routes select organizer-entered or athlete-submitted modes through capability helpers.
