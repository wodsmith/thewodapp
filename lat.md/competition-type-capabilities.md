---
lat:
  require-code-mention: true
---
# Competition Type Capabilities

Competition type capabilities define which product behaviors each stored competition type enables while keeping existing in-person and online behavior unchanged.

## Registry Source of Truth

The registry maps each competition type to named capabilities, its leaderboard variant, and create-picker selectability without adding a database field.

[[apps/wodsmith-start/src/lib/competitions/capabilities.ts#COMPETITION_TYPE_REGISTRY]] keeps `competitionType` as the stored discriminator and exposes [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#competitionCan]], [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#leaderboardVariant]], and [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#isSelectableType]] for later call-site refactors. In-person competitions retain heat scheduling, day-of check-in, physical venue, volunteer scheduling, and organizer-entered results. Online competitions retain video submissions, submission windows, opt-in result publishing, and the online leaderboard variant.

Server submission gates now consume the registry for the API, server-function, and leaderboard paths: score-window checks use `submissionWindows`, while video submission checks use `videoSubmissions`. The dedicated leaderboard refactor also routes the online table decision through `leaderboardVariant` and the hidden-until-published default through `optInResultPublishing`; [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] stayed minimal because GitNexus reports HIGH blast radius.

The `scoringAlgorithm === "online"` axis remains separate from `competitionType === "online"`. Capability checks must not replace scoring-algorithm branches.

## Capability Truth Table Test

The truth-table test pins every capability and leaderboard variant for in-person and online competitions before call sites are refactored.

[[apps/wodsmith-start/test/lib/competitions/capabilities.test.ts]] verifies each capability for both current types, confirms registry metadata matches type identity, and covers the unknown-type fallback. This is the PR-1 safety net for the M0 competition-type capability registry.

Focused PR-2 server-function tests pin that in-person score saves pass the submission-window gate, online score saves still honor closed windows, and in-person video submissions still reject before writes. PR-3 adds [[apps/wodsmith-start/test/components/leaderboard-page-content.test.tsx]] coverage for standard versus online leaderboard table selection plus [[apps/wodsmith-start/test/server/competition-leaderboard-capability-gates.test.ts]] coverage for opt-in result publishing defaults and the leaderboard video-submission fetch gate.
