# Crew printed schedule verification

This receipt records the multi-day print assertion correction and its browser evidence, without changing application rendering, seeds or release artifacts.

## Baseline and scope

Work began at 3f6228425210ffec5409d31825ee3e55a99a3b62 in the isolated zac/training-session-ux worktree. Parent-owned untracked Plan 009 release artifacts remain untouched and outside this correction. The index change records only Plan 010.

Only crew-mobile.spec.ts, its lat documentation and approved Plan 010 documentation change. Production ScheduleTab already renders one PacketSection and PacketTable per day. No application, setup, seed, workflow, database schema, migration, dependency or ownership code change is needed.

## Before and correction

CI run 34186856793 / job 101936833201 passed 11 database cases and prepared global setup, then failed the Chromium and WebKit print tests because globally selected People headers matched two elements. The global Time assertion had the same assumption.

The disposable crew_ci_preparation_e2e database at 127.0.0.1:33329 initially had all demo shifts on one UTC date. A guarded local update moved only e2e_crew_shift_media from 2026-09-08 05:40:12–07:10:12 to 2026-09-09 at the same times. Its event-local printed dates became September 7 and 8. The original dates were retained for exact restoration; no committed fixture was changed.

The unchanged Chromium assertion failed with People resolving to two headers. The first simultaneous WebKit run instead hit an earlier Something went wrong page and timed out waiting for Judges; this is not counted as assertion reproduction. A standalone unchanged WebKit run then reproduced the same two-header strict-mode failure.

Two intermediate selector attempts failed locally: the printed DOM exposes no visible tabpanel role, and generic section/table selection also includes the outer print wrapper table. The final assertion uses the plan's paired-list alternative: wait for print visibility, require a positive People-header count, require the same Time-header count, then assert every header is visible. includeHidden ensures hidden later headings remain in the checked set. The initial first() is only a readiness wait; all final visibility assertions cover the complete lists.

Both browsers passed against the same two-day fixture: 2/2 in 11.9 seconds, with retries disabled. A controlled browser-only negative experiment then hid the second People heading: both browsers failed at People.nth(1), Received: hidden (/private/tmp/session010-negative-hidden.log). The temporary injection was removed immediately afterward. The guarded restoration changed exactly one row back to its original dates, verified by SELECT, before resetting E2E seeds.

## Reproducible checks

Use Node 24.15.0 and the existing isolated local test database. Diagnostic logs under /private/tmp are disposable machine-local observations, not committed or portable proof.

The focused command is `pnpm --filter crew exec playwright test e2e/crew-mobile.spec.ts --grep 'phone exports' --workers=1 --retries=0 --reporter=list`, with CI=true, CREW_E2E_DB_PREPARED=1, DATABASE_URL pointing only to the disposable local database, DISABLE_TANSTACK_DEVTOOLS=1 and SENTRY_AUTH_TOKEN empty. Before logs are /private/tmp/session010-before.log and session010-before-webkit.log; successful two-day evidence is session010-after-multiday-paired.log.

The complete selected suite uses the same environment and `pnpm --filter crew exec playwright test e2e/crew-organizer-flow.spec.ts e2e/crew-volunteer-flow.spec.ts e2e/crew-mobile.spec.ts --workers=2 --reporter=list`. After `pnpm --filter crew db:seed:e2e` reset Pending volunteer state, all 18 cases passed in 37.7 seconds without retries (/private/tmp/session010-full-browser.log). Prepared global setup verified the database and skipped provisioning. No schema push ran.

`pnpm --filter crew type-check` passed (/private/tmp/session010-types.log). `pnpm --filter crew lint` passed with 62 warnings and no errors (/private/tmp/session010-lint.log). The first lat check identified an incomplete nested section reference; after correcting that reference, `lat check` and `git diff --check` passed (/private/tmp/session010-lat-final.log). These are test/documentation changes, so no application build or database implementation suite was added.

Independent parent verification reset the disposable fixtures and passed all 18 browser cases in 40.2 seconds, plus Crew types, lint (62 warnings, no errors), lat and diff checks. The original worktree also passed lat check. Logs are /private/tmp/session010-parent-{seed,browser,types,lint,lat}.log and session010-original-lat.log. The complete source and documentation diff was reviewed; approval is limited to this correction and its Plan 010 documentation/index. Staged scope detection reported four files, eight symbols, zero affected execution flows and LOW risk before the final parent-owned plan/index status update; final staged detection includes that index.

## Impact and limitations

lat expand and semantic search informed the existing Mobile Layout and Navigation and Crew Launch Verification intent. The new adjacent print-test reference has a distinct Printed schedule day coverage spec.

The first GitNexus refresh failed with EPERM writing registry.json.tmp under the restricted environment. One permitted retry with the 64 MiB WAL checkpoint threshold succeeded in 33.4 seconds (34,997 nodes, 77,769 edges and 289 flows). The anonymous print callback remained unindexed; required upstream impact returned UNKNOWN/not found, rather than an inferred LOW result. Manual source inspection confirms the callback is registered only as this Playwright test. No production symbol changed.

This browser correction does not resolve the separate dependency, ownership or production release gates. No remote database, deployment, push or merge is performed by the executor.
