---
lat:
  require-code-mention: true
---
# Competition Type Capabilities

Competition type capabilities define product behavior for in-person, online, and benchmark competitions while unknown stored values fail closed.

## Registry Source of Truth

The registry maps every supported stored type to capabilities, leaderboard behavior, create selectability, and organizer-facing labels.

[[apps/wodsmith-start/src/lib/competitions/capabilities.ts#COMPETITION_TYPE_REGISTRY]] keeps `competitionType` as the stored discriminator. In-person retains venue workflows and organizer-entered results. Online retains video submissions, submission windows, opt-in publishing, and its leaderboard variant. Benchmark supports perpetual athlete tracking, the standard leaderboard, and organizer-entered results while exposing no venue or video capabilities; it remains unavailable during generic creation and stays editable through its registered label.

Server submission gates now consume the registry for the API, server-function, and leaderboard paths: score-window checks use `submissionWindows`, while video submission checks use `videoSubmissions`. The dedicated leaderboard refactor also routes the online table decision through `leaderboardVariant` and the hidden-until-published default through `optInResultPublishing`; [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] stayed minimal because GitNexus reports HIGH blast radius.

The `scoringAlgorithm === "online"` axis remains separate from `competitionType === "online"`. Capability checks must not replace scoring-algorithm branches.

## Capability Truth Table Test

The truth-table test pins capabilities, leaderboard variants, and create selectability for every registered competition type.

[[apps/wodsmith-start/test/lib/competitions/capabilities.test.ts#EXPECTED]] verifies in-person, online, and benchmark behavior, registry metadata alignment, and the unknown-type fallback.

Focused PR-2 server-function tests pin that in-person score saves pass the submission-window gate, online score saves still honor closed windows, and in-person video submissions still reject before writes. PR-3 adds [[apps/wodsmith-start/test/components/leaderboard-page-content.test.tsx]] coverage for standard versus online leaderboard table selection plus [[apps/wodsmith-start/test/server/competition-leaderboard-capability-gates.test.ts]] coverage for opt-in result publishing defaults and the leaderboard video-submission fetch gate. PR-4 adds [[apps/wodsmith-start/test/lib/competitions/scheduling-check-in-gates.test.ts]] coverage for the heat scheduling and day-of check-in gates used by the public schedule, judge rotations, check-in routes, and check-in server functions. PR-5 adds [[apps/wodsmith-start/test/lib/competitions/venue-volunteer-gates.test.ts]] and [[apps/wodsmith-start/test/components/competition-location-card.test.tsx]] coverage for physical venue display and volunteer schedule-tab gates.

### Current Type Matrix

This test verifies every current competition type keeps its existing capability, leaderboard variant, and create-selectability behavior.

### Registry Metadata Alignment

This test verifies registry keys, ids, labels, and capability sets stay aligned with the supported stored competition-type identities.

### Unknown Type Fallback

This test verifies unknown competition types fail closed for capabilities, use the standard leaderboard variant, and stay unselectable.

## Create Picker Selectability Test

The picker test separates types available during generic creation from registered types that existing competitions may retain and edit.

[[apps/wodsmith-start/src/lib/competitions/capabilities.ts#selectableCompetitionTypes]] and [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#selectableCompetitionTypeOptions]] expose only in-person and online for creation. [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#competitionTypeOptions]] includes benchmark for edit forms, while [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#isCompetitionTypeValue]] lets update validation preserve any registered type without making benchmark create-selectable.

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

The legacy Crew surface treats benchmark as a fail-closed type: it omits venue, heat, judge, check-in, and results navigation, and its score-write gate rejects benchmark competitions. Benchmark results remain available through the capability-aware wodsmith-start organizer and cohost routes.

### Registry Results Mode Labels

This test verifies result-entry mode and Results/Submissions labels are derived from the organizer-entered-results capability.

### Organizer Results Route Mode

This test verifies organizer results routes select organizer-entered or athlete-submitted modes through capability helpers.

### Cohost Results Route Mode

This test verifies cohost results routes select organizer-entered or athlete-submitted modes through capability helpers.

### Crew Benchmark Score Gate

This test verifies the legacy Crew score-write path rejects benchmark competitions.
