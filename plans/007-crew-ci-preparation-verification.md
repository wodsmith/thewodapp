# Crew CI preparation verification receipt

This receipt distinguishes the observed CI provisioning hang from the local reproduction, and records the verified prepared-CI path without changing application schema or migration lineage.

## Baseline and diagnosis

The exact baseline is b8ff5b1a43b0a4a85d47e47057ee1901e95bce84 on zac/training-session-ux. The coordinator authorized this bounded setup correction; Option C migration integration remains held.

The parent inspected CI job 101920558308 in run 34181219780: first provisioning succeeded, but the second schema push prompted about adding competition_invites_active_invite_idx to 11 seeded rows and offered truncation. No answer was supplied and the job timed out before browsers. Prior passing job 101917500079 at 20c6066 used the same duplicate setup and passed 18 browser tests.

Read-only comparisons against both main 0d36543dd0a5c7ad2958f8fcf2b1328998e31c15 and prior passing head 20c60663ea3e52869de0466c8fe5151c98ff5ac1 found no changes to the workflow, Crew setup/global-setup scripts, competition-invites schema or lockfile. Duplicate provisioning was an existing path exposed by this run. The installed Drizzle statistics query's absent ordering is a possible false-diff explanation, not a demonstrated cause; no dependency patch was made.

## Fresh disposable reproduction

All local database work used newly created task-owned databases on 127.0.0.1:33329. Existing training and migration evidence databases were preserved.

The name crew_ci_preparation_e2e was verified absent before creation. A temporary Drizzle config explicitly selected port 33329 and the canonical schema because the shared config omits URL port. The first canonical push passed. Before seed, the required index had NON_UNIQUE=0, sequence 1–4 columns championship_competition_id, email, championship_division_id, active_marker, and SUB_PART=NULL for all four columns; invite row count was zero.

Both existing Crew base and E2E seed commands passed using only that new database URL. The exact unique index remained unchanged; there were 11 invite rows, 71 user rows and zero violating non-null active-key duplicate groups. A bounded second push completed exit zero with Changes applied and no prompt. The intermittent CI prompt was therefore NOT reproduced locally. The bounded observer would terminate on a truncation/confirmation prompt without sending input; no prompt was answered and no --force option was used.

The deterministic orchestration regression did reproduce the duplicate setup: against the unchanged baseline globalSetup, prepared CI still invoked the rejecting execSync mock. Result: one failed, one passed. An earlier mock omitted a default export required by the Vitest module transform and collected no tests; it was corrected and is not counted as product evidence. The baseline source was temporarily restored for the corrected regression, then the scoped implementation restored.

## Correction and safety contract

CI's existing first setup step owns schema push and both seeds. Only the later Crew Playwright step declares CREW_E2E_DB_PREPARED=1 after the preceding setup succeeds.

Global setup accepts that explicit flag only with CI=true and a local mysql URL whose database ends in _test or _e2e. Remote hosts, non-test databases, wrong protocols and URL query/hash parameters are rejected before connecting. The verifier respects the URL port and reads information_schema.STATISTICS with bound schema/table/index parameters and ORDER BY SEQ_IN_INDEX.

The prepared path requires exactly four full columns in the expected order, all unique, with contiguous sequence numbers and no prefix lengths. Missing or incorrect constraints fail without invoking setup as a fallback. The established connection closes in finally, including query and validation failures. The helper performs no DDL or seed writes. Without the flag, normal local setup still invokes the unchanged setup-e2e-db.ts script; an invalid flag or use outside CI rejects.

The real integration suite verifies every seeded table has a numeric checksum and the complete checksum digest remains equal across actual prepared globalSetup. Its missing-index negative uses a separate uniquely named fixture database, restores its test-owned index and proves its row unchanged before removing only that fixture. No index was removed from the seeded application database.

## Reproducible commands and results

Committed tests and commands are the portable verification contract. All /private/tmp paths are disposable machine-local diagnostics, not committed artifacts or portable proof.

- Mocked setup and verifier tests: `pnpm --filter crew exec vitest run test/e2e/global-setup.test.ts test/e2e/prepared-database.test.ts --minWorkers=1 --maxWorkers=2`. Passed 22/22 (/private/tmp/session-007-after-unit.log). Corrected unchanged-baseline RED is /private/tmp/session-007-before.log; the initial harness-only failure is /private/tmp/session-007-before-harness.log.
- Real database and existing purchase tests: set CREW_TEST_DATABASE_URL to the disposable seeded URL, then `pnpm --filter crew exec vitest run test/integration/crew-prepared-database.test.ts test/integration/crew-purchase.test.ts --no-file-parallelism --minWorkers=1 --maxWorkers=1`. Passed 11/11 with no skips: two prepared-state cases and nine purchase cases (/private/tmp/session-007-db.log). The parent independently repeated all 11 successfully after the numeric-checksum assertion was added.
- Actual browser command: with CI=true, CREW_E2E_DB_PREPARED=1, DATABASE_URL pointing to the fresh seeded database, DISABLE_TANSTACK_DEVTOOLS=1 and empty SENTRY_AUTH_TOKEN, run `pnpm --filter crew exec playwright test e2e/crew-organizer-flow.spec.ts e2e/crew-volunteer-flow.spec.ts e2e/crew-mobile.spec.ts --workers=2 --reporter=list`. Passed 18/18 in 37.8 seconds across Chromium and iPhone WebKit (/private/tmp/session-007-browser.log). The log confirms Verified prepared CI database; setup skipped, with no provisioning/seed invocation.
- Local browser prerequisites matched CI's worker configuration in ignored apps/crew/.alchemy/local/wrangler.jsonc and .dev.vars, using the explicit disposable URL, STAGE=test, APP_URL=http://localhost:3002, local KV/R2 and installed Chromium/WebKit. No deployment or remote bindings were provisioned. Two local workers bounded resource use; CI retains its existing worker setting.
- `pnpm --filter crew type-check` passed. `pnpm --filter crew lint` passed with 62 warnings and no errors. The parent independently passed both and 22/22 mocked tests. Final lat and diff checks passed locally and independently.

Each browser run requires the existing Crew E2E seed once beforehand, matching CI. Browser scenarios intentionally confirm seeded volunteer assignments. A parent rerun against the executor's already-used seed finished 17 passed and one failed in 42.8 seconds: the unchanged volunteer scenario expected Pending but its seeded assignment was already confirmed. This is not a prepared-path defect. The parent reran only db:seed:e2e, without schema push, then independently passed all 18 browser tests in 36.3 seconds with no retries and exit zero. Do not run data-preservation checks concurrently with browser mutations.

## Scope, impact and limits

Implementation changes are limited to the Crew workflow flag, global setup and one read-only test helper; tests and lat/plans documentation provide the evidence.

The refreshed GitNexus index matches b8ff5b1 and completed in 47.6 seconds with 34,929 nodes, 77,701 edges and 289 flows. Upstream impact for Crew globalSetup was disambiguated by file and returned LOW, with zero indexed callers or processes. No HIGH or CRITICAL warning occurred. Parent and executor read Crew Launch Verification intent; lat expansion and semantic search were run. New test cases have adjacent lat references.

setup-e2e-db.ts, application/server implementation, canonical schema, SQL migrations, snapshots, journal, package/lockfiles, dependencies and public base remain unchanged. This work verifies CI preparation ownership and its constraint, not the exact cause of Drizzle's intermittent prompt or the held migration lineage. Latest-head published CI remains a separate check. No push, merge or deployment is performed by the executor.

Final staged GitNexus detection passed: 10 files, 12 symbols, zero affected indexed processes, LOW risk (/private/tmp/session-007-detect-staged.txt). Staged and unstaged diff checks passed. The parent approved source and tests; final documentation approval precedes commit.
