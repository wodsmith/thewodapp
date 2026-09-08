# Verify every printed schedule day

Correct the Crew browser assertion so legitimate multi-day print exports are checked completely without requiring globally unique column headings.

## Baseline and evidence

Status: DONE — independently verified; successor CI tracked separately. Planned at 3f6228425210ffec5409d31825ee3e55a99a3b62 in /private/tmp/wodsmith-session-ux, branch zac/training-session-ux, PR #699. The user authorized feedback fixes and production release. This is independent of the blocked #695 ownership work; do not touch that code or its branch.

CI job 101936833201 in run 34186856793 passed all 11 Crew database tests and prepared global setup. Browser results were 16 passed and two failed: the print-export assertion on Chromium and WebKit found two People column headers. The same global Time assertion would also be ambiguous. The failure is at apps/crew/e2e/crew-mobile.spec.ts:229–234 after print media is selected.

The production ScheduleTab in apps/crew/src/routes/events/$eventId/exports.tsx maps daySections to PacketSection, each containing a PacketTable with Time, Block, Location, Role, Coverage and People headers. Multiple tables are intended. The current test calls page.getByRole(columnheader, People/Time).toBeVisible(), which incorrectly assumes one day globally. Production rendering requires no change.

## Scope and correction

Only edit apps/crew/e2e/crew-mobile.spec.ts, lat.md/crew.md and create plans/010-crew-print-verification.md. Parent owns plan status/index. Do not edit application code, database setup/seeds, workflow, schema/migrations, dependencies, package/lockfiles, or Plan 009 production artifacts. No production or remote data mutations.

Preserve navigation, phone overflow checks, master CSV filename and print-media verification. Require at least one printed schedule table and verify every actual day's table contains visible Time and People headings. Do not merely add first() to the final assertions, weaken to existence, ignore duplicate matches, skip a browser, or increase retries/timeouts. Scope to each PacketSection/table using observed DOM structure, or pair nonempty header lists with complete visible checks and equal counts. Wait for print visibility before enumerating dynamic locators.

## Verification workflow

Read lat Crew Mobile Layout/Launch Verification, run lat expand/search and GitNexus impact before editing indexed symbols. The print callback may be anonymous/unindexed: report that limitation and inspect its test-only reach. No expensive repeated rebuild for missing anonymous symbols; if an index refresh fails, use one bounded retry with the already successful 64 MiB WAL checkpoint setting.

Reproduce the old assertion against a real multi-day disposable fixture before correction. The existing local task-owned MySQL at127.0.0.1:33329/crew_ci_preparation_e2e and ignored Crew local worker config on port3002 are available. Inspect seedCrewDemoEvent to understand its dated rows; if necessary, adjust only explicit task-owned local fixture rows with a temporary script and restore them after the proof. Do not commit seed changes or change production to make the test pass. Record exact before evidence; also prove the new assertion checks every day, including a negative visibility check for a later day's heading in a controlled browser-only experiment if practical.

Run the focused print test in Chromium and WebKit against two-day data. Then reset existing E2E fixtures once and run all selected Crew organizer, volunteer and mobile suites with the prepared path (18 cases expected): CI=true CREW_E2E_DB_PREPARED=1 DATABASE_URL=mysql://root@127.0.0.1:33329/crew_ci_preparation_e2e DISABLE_TANSTACK_DEVTOOLS=1 SENTRY_AUTH_TOKEN= pnpm --filter crew exec playwright test e2e/crew-organizer-flow.spec.ts e2e/crew-volunteer-flow.spec.ts e2e/crew-mobile.spec.ts --workers=2 --reporter=list. Node24 PATH is /Users/zacjones/.nvm/versions/node/v24.15.0/bin. Existing db:seed:e2e restores Pending volunteer state; do not rerun schema push.

Run pnpm --filter crew type-check, pnpm --filter crew lint, lat check and git diff --check. Expect zero errors; report existing warnings. Update the adjacent test's lat reference/spec if needed. Receipt must distinguish CI failure, local reproduction and successful verification. Parent repeats browser/static gates after fixtures are available, reviews all diffs and approves before commit. Do not stage Plan 009/README changes independently. After approval run scoped staged GitNexus detection and final lat/diff, then commit only this correction and its approved docs. Do not push or merge.

## Completion

Done requires meaningful old-assertion multi-day failure, both-browser print verification, the complete 18-case browser suite passing, static/lat/diff checks and scope compliance. Preserve the production deployment and ownership approval gates recorded in Plan 009.
