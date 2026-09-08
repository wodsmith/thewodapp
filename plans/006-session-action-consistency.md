# Session action consistency

Finish the delayed CodeRabbit review with provider preparation feedback, exact-version membership labels, one clear workout Add action, stronger assertions and accurate migration guidance.

## Baseline and constraints

Written against 20c60663ea3e52869de0466c8fe5151c98ff5ac1 for PR #699, branch zac/training-session-ux in /private/tmp/wodsmith-session-ux. Status: DONE and independently approved. The user authorized implementation, UI refinement and PR publication.

The executor implemented the scoped changes, and the advisor independently reviewed the full diff and verification gates before approving commit. No server, schema, migration, base or dependency change occurred. The Option C migration hold remains binding. The steps below preserve the completed implementation specification; observed outcomes are in the verification receipt.

## Verified findings and decisions

Seven delayed CodeRabbit comments and two subsequent Cubic comments were checked against the current source. Seven need bounded corrections, one records the existing migration hold, and one proposed validation change is rejected.

1. 3953822508: AthletePersonalSession.beginBuilder awaits provider workout definitions without a pending guard or visible feedback. Guard repeated preparation, visibly show preparation and disable its trigger while pending. Preserve explicit Save as the first composition write. Keep source/workspace/date cancellation: old success, error or finally must not affect a newer context or clear a newer preparation. Clear preparation on relevant context changes and allow retry after failure. Use the existing request-context pattern; no generalized async framework.
2. 3953822512: source Add disabled predicate compares session/block/publishedVersion, but its label omits publishedVersion. Derive one exact-occurrence membership value in the item render scope for both. An earlier saved version must show enabled Add to My session; the current saved version must show disabled In My session. Keep append identity and other behavior unchanged.
3. 3953822529: WorkoutDetailPage has two legacy Add to my session navigation links below Scheduled dates and Earlier workout results, duplicating header SessionWorkoutActions' actual append action. Remove both legacy controls; the header remains the single direct Add/Log entry. Preserve schedules and previous results. Do not replace them with another pending-add route or modify shared permissions.
4. 3953822533: session-workout-actions.test.tsx compares call records pointing to the same request object mutated on retry. Capture a deep copy of the first payload inside its one-time rejecting mock, then assert original revision zero, retry revision one and unchanged items against that snapshot. Keep the existing successful retry/UI assertions. No production SessionWorkoutActions mutation change is required.
5. 3953822535: workout-import-handoffs.test.tsx aliases direct/personal save functions to mock.submitLog. Give each a distinct mock; preserve no-write import assertions for both and exercise actual form submission for direct and personal identifiers, verifying the selected function/payload and that the other is never called. Keep LogNewPage implementation read-only unless a real new defect is reproduced and reported.
6. 3953822538: lat.md/training-personal.md Independent Direct Scores still says to apply 0007_material_champions.sql. Correct it to pending/held because it collides with #695. Document reconciliation after authorized dependency merges and rechecking the actual next reservation, with 0009 only provisional. Preserve surrounding scoring behavior.
7. 3953822541: migration journal finding is acknowledged and deferred under Option C. Do not change SQL, snapshots, journal, canonical schemas, dependencies or base. The published PR remains not merge-ready until lineage integration is separately authorized and complete.
8. 3953840114: reject the proposal to treat invalid personal payloads as non-duplicates. Production validates the save schema before the writer; accepting an invalid payload as a new entry would make the fixture less faithful. Builder drafts remain local and save with replace mode; append/retry is a persistence path, and AthletePersonalSession.save catches errors for display. Do not change the preview helper to accept invalid data. Document the reasoning and add one focused assertion that an invalid same-ID personal payload is rejected, if needed to make the disposition executable.
9. 3953840117: clarify Plan 005's completed process record. Change its original future-tense approval/IN PROGRESS instructions to historical completed wording, preserving the current DONE status and still-active migration hold. The parent may edit this plan documentation directly.

## Scope and implementation steps

Production scope is only apps/wodsmith-start/src/components/training/athlete-personal-session.tsx and apps/wodsmith-start/src/routes/_protected/workouts/$workoutId/index.tsx. Read current beginBuilder, importContext/currentImportContext, item render and WorkoutDetailPage before editing. The former uses async source-context checks; extend them minimally to pending/error cleanup. The latter already renders SessionWorkoutActions in its header.

Tests: existing test/components/training/athlete-training.test.tsx, session-workout-actions.test.tsx, session-preview-state.test.ts for the rejected invalid-payload suggestion, test/routes/workout-import-handoffs.test.tsx, and a focused workout-detail route test if the existing workout-library-session.test.tsx cannot naturally cover it. A new focused file test/routes/workout-detail-session.test.tsx is permitted. Native browser additions belong in test/preview/training/my-session.spec.ts only if materially needed beyond existing flows. Relevant lat behavior/spec docs, Plan 005 status wording and plans/006 plan/receipt are in scope; parent owns plans/README status. Format new/touched sections only.

Before source changes run required upstream GitNexus impact for every edited symbol; report HIGH/CRITICAL before proceeding. Use repo index wodsmith-session-ux, refresh if stale, CLI if MCP unavailable. Parent ran lat expand, locate and semantic search and read Track and Personal Surfaces plus relevant code. Read the corresponding lat sections for implementation intent.

Write substantive RED component cases for one request batch/visible disabled preparation/no writes; failure enables retry; late success/error cannot cross context and old cleanup cannot clear a newer pending preparation. Add exact-version Add label/disabled regressions. Verify workout detail with schedules and previous results contains only the header direct add action and no legacy pending-add navigation. For test-only improvements, validate assertions against snapshots/distinct mocks; don't mislabel harness changes as product defects. Preserve all Plan005 draft Save/Cancel tests and builder behavior.

## Verification gates

Use Node 24.15.0 from /Users/zacjones/.nvm/versions/node/v24.15.0/bin. Focused command: `pnpm --filter wodsmith-start exec vitest run test/components/training/athlete-training.test.tsx test/components/training/session-workout-actions.test.tsx test/routes/workout-import-handoffs.test.tsx test/routes/workout-library-session.test.tsx test/routes/workout-detail-session.test.tsx --minWorkers=1 --maxWorkers=2` (omit new detail file only if coverage is implemented in the existing file).

Run full native session browser suite: `pnpm --filter wodsmith-start exec playwright test --config test/preview/training/playwright.session.config.ts`. Run `pnpm --filter wodsmith-start type-check`, `pnpm --filter wodsmith-start lint`, `lat check`, and `git diff --check`. The parent independently repeats these affected gates. No DB or migration experiments required for UI/tests/docs; no unrelated broad changes. Confirm server implementation and packages/wodsmith-db diffs against baseline are empty. Run staged GitNexus detect_changes before any approved commit.

## Completion and maintenance

The executor returned the complete diff, substantive RED/GREEN records, impact scope, nine dispositions and limitations. The parent approved the work after independently passing 70 focused tests, 22 browser cases and static/documentation gates. Local logs are disposable diagnostics; committed tests and commands remain reproducible. Publication and latest-head review are separate from this completed implementation plan.
