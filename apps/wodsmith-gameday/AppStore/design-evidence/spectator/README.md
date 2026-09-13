# Spectator verification

The native spectator experience was verified with fictional data on the dedicated iPhone 16e simulator `50B0E4D3-B9E6-4251-BEE4-6C103E28868E` (iOS 26.2).

- 15 native unit tests pass, including persistent competition-scoped follows, sign-out, team/athlete assignments, multiple divisions, missing assignments, and no ownership gained from public lanes.
- Athlete UI navigation, single-division defaults, My heats defaults, and Live Activity start/end pass.
- Anonymous UI flow passes: spectate, follow an athlete and team, exact lanes, multiple schedule divisions, followed-only standings, division switching, relaunch persistence, and unfollow empty state.
- Largest accessibility text follow controls pass; landscape is captured after rotation settles.
- Public API regression suite: `pnpm --filter wodsmith-start exec vitest run test/gameday-api.test.ts` — 9 tests pass.
- `lat check` and `git diff --check` pass.
- Full `tsgo --noEmit` reports 193 diagnostics outside the changed Game Day files, chiefly schema exports missing from the shared dependency checkout. No Game Day diagnostics remain. This is not a clean repository-wide typecheck.

The live anonymous High Desert Havoc API was inspected: 21 published heats, 0 personal assignments, and 41 standings entries. Several heats have no division label. These checks establish the current API shape, not deployment of the new projection.

Deploy `apps/wodsmith-start/src/server/gameday.ts` before releasing this iOS build. The additive `participants` and `publicAssignments` fields expose active public registration references and published lanes only. No database migration is required. Until deployed, the app can follow standings entries but explicitly reports that followed heat assignments are unavailable.

No deployment, merge, or Apple submission was performed by this task. The parent release task owns integration and release. Full VoiceOver traversal and live validation of the new projection remain release follow-ups.

The final UI test run also logged an iOS `_UIReparentingView` framework warning while opening native menus; assertions passed and the inspected menus rendered correctly.

GitNexus impact and change detection were invoked, but its registered index predates the native app and this API handler. Swift/API symbol impact is therefore unknown, not a proven zero; manual review and the scoped native/API tests cover the changed flows.
