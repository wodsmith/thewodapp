# Crew CI preparation ownership

Avoid a duplicate schema push on a seeded CI database while verifying that its required constraint exists and preserving ordinary local setup.

## Baseline and authorization

Written against b8ff5b1a43b0a4a85d47e47057ee1901e95bce84 in /private/tmp/wodsmith-session-ux, branch zac/training-session-ux, PR #699. Status: DONE — independently verified; published CI is tracked separately. The coordinating task explicitly authorized bounded diagnosis and the smallest deterministic noninteractive CI setup correction.

No production application, canonical schema, migration, public base or dependency branch changes. Never answer the destructive Drizzle prompt, use --force, truncate an existing database or rerun the failed job unchanged. Keep Option C migration hold. The executor makes scoped changes and waits for parent approval before commit; only the parent publishes approved work.

## Diagnosis already established

The Crew CI workflow provisions and seeds its database, then Playwright global setup invokes setup-e2e-db.ts, which provisions and seeds it again.

In public job 101920558308 (run 34181219780), the first push succeeded; the second began at 02:49:07 UTC and prompted to add competition_invites_active_invite_idx to 11 rows, asking whether to truncate. It never received an answer and exceeded 30 minutes before browser tests. Prior passing job 101917500079 at 20c6066 used the identical second push, reported Changes applied, and passed 18 browser tests.

Refreshed main is 0d36543dd0a5c7ad2958f8fcf2b1328998e31c15. The workflow, Crew global-setup/setup script, competition-invites schema and lockfile have no differences against main or the prior passing head relevant to this failure. The session feature exposed an existing duplicate-provisioning path; do not claim its exact intermittent Drizzle cause without reproducing it.

Parent read the required index in the existing disposable canonical-schema database: NON_UNIQUE=0, ordered columns championship_competition_id, email, championship_division_id, active_marker. This is preliminary evidence, not proof about the failed runner. Installed Drizzle's MySQL statistics query has no ORDER BY and appends rows in returned order; this is a possible explanation to investigate, not a reason to patch the dependency.

## Reproduction before correction

Use only a newly named disposable local database, preserving the previous migration and training evidence databases. MySQL root/no password is available at localhost:33329 and socket /private/tmp/session-migration-mysql.sock. The shared drizzle.config.ts ignores URL port, so use a temporary config that explicitly targets port33329 and the canonical schema; never accidentally connect to localhost:3306 or edit the shared config.

Create a fresh database named crew_ci_preparation_e2e, first checking whether it already exists and selecting a fresh suffix rather than dropping existing data. Push canonical schema once, verify the exact unique index via information_schema.STATISTICS ordered by SEQ_IN_INDEX, then run Crew base and E2E seeds with DATABASE_URL pointing only to that database. Confirm the index still exists and record seeded row counts. Run a bounded second push, capturing output and terminating if it prompts; never answer it. Compare exact behavior with prior logs. A deterministic test harness that would hang or request a second push should reproduce the orchestration bug even if local introspection happens to succeed. Clearly separate observed reproduction from inference.

Stop and report before source edits if the required unique constraint is actually absent after the first canonical push, if duplicate data violates it, if schema changes are needed, or if another active owner has the same setup correction underway.

## Smallest intended correction

CI's existing first preparation becomes the explicit owner of provisioning. Only the Crew Playwright step declares that preparation complete after all preceding setup steps succeeded.

Use a narrowly named flag such as CREW_E2E_DB_PREPARED=1 on that step. Global setup accepts the flag only in CI, with a valid isolated local test database, and verifies the required unique constraint read-only before skipping duplicate provisioning. Missing or incorrect uniqueness, column order or prefix shape must fail promptly with a useful message; do not silently fall back to schema push. Do not accept the flag in an ordinary local run. Without the flag, preserve the current local setup script behavior.

Use a small test-only helper for prepared-database verification if it keeps the global setup readable. Reuse mysql2/promise already installed. Parameterize database selection safely; never print credentials. Close the connection in finally. The read-only verification must not execute DDL, modify seed rows, invoke a shell schema command or accept a missing constraint as success. The actual CI database URL is mysql://root:testpassword@127.0.0.1:3306/wodsmith_crew_e2e; reject remote or non-test names for the prepared shortcut.

## Verifier guarantee

The prepared check is a targeted early guard for competition_invites_active_invite_idx, not a whole-schema or seed-completeness audit. The successful first workflow push and both ordered seed commands own preparation; integration and browser tests exercise the prepared state. A second push printing Changes applied is not proof that the first push left schema incomplete. No superficial row-count check or duplicate push is part of the guard.

## Scope and tests

Allowed implementation files are .github/workflows/e2e.yaml, apps/crew/e2e/global-setup.ts and a focused helper apps/crew/e2e/fixtures/prepared-database.ts if needed. Keep apps/crew/scripts/setup-e2e-db.ts unchanged unless a smaller well-supported design requires it and is reported to the parent first. No package, lockfile, schema or migration edits.

Tests may be added under apps/crew/test for global setup dispatch and prepared-database verification, using the existing Vitest conventions. A local integration test may use a dedicated CREW_TEST_DATABASE_URL and skip without that explicit disposable DB configuration. Cover: explicit prepared CI path does not execute setup or seed commands; default local path retains setup; flag outside CI and unsafe URL reject; missing/wrong/nonunique/prefixed constraint rejects; valid constraint accepts and closes connection; seeded rows remain identical. Include a real MySQL positive and missing-constraint negative using only a separate disposable fixture table/database, restoring any test-owned index after the negative case. Never alter the prior evidence databases.

Run required GitNexus upstream impacts before every edited symbol, including globalSetup; disambiguate by Crew file path. Report HIGH/CRITICAL before edits. MCP is currently callable; index wodsmith-session-ux may need refreshing. Parent ran lat expand/search and read Crew Launch Verification; update lat.md/crew.md and adjacent-comment test specifications. Parent owns plans/README status; receipt belongs in plans/007-crew-ci-preparation-verification.md.

## Verification and completion

Use Node24.15.0 at /Users/zacjones/.nvm/versions/node/v24.15.0/bin. Run focused new Crew Vitest files, `pnpm --filter crew type-check`, `pnpm --filter crew lint`, `lat check`, `git diff --check`, and the actual prepared global setup against the disposable seeded database. Run the existing nine Crew purchase integration tests against that same disposable database. Then run the selected Crew Playwright organizer/volunteer/mobile suite if the existing local environment supports it; report exact setup needs rather than deploying anything. Parent independently repeats meaningful gates before approval; published CI is a separate check.

Return exact baseline comparison, before/after evidence, unique-index verification before/after seeding, data preservation proof, all changed files and impact scope. Local logs are disposable diagnostics; committed tests/commands provide reproducibility. If blocked by broader CI infrastructure or schema behavior, provide exact proposed patch/evidence for coordination before expanding scope. Run staged GitNexus detection before an approved commit. Preserve the migration hold in every readiness report.
