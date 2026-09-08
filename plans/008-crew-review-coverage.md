# Crew review coverage and verifier contract

Clarify the prepared-database check's limited guarantee, normalize checksum representations, and run the existing real-database regression in CI.

## Status and baseline

Status: DONE — independently reviewed and verified. Planned at 8c477afb1d108a3acf28b28383e59297e1538ec6 in /private/tmp/wodsmith-session-ux on zac/training-session-ux. The user explicitly authorized addressing feedback and merging PR #699. Parent reviews and publishes; executor waits for approval before commit.

All 18 checks passed on this baseline, including the previously stalled Crew job. The two new Cubic comments are 3954179612 and 3954179615. CodeRabbit's latest substantive review at this head only repeats the migration lineage requirement; that remains a separate integration prerequisite while #691 and #695/#698 are open. No migration or base changes in this plan.

## Evidence and intended disposition

The current helper verifies local CI context and exactly competition_invites_active_invite_idx. It is not a whole-schema or seed-completeness validator. The workflow's successful first push and both seeds own preparation; the focused guard fails early on the observed constraint issue. A second push printing Changes applied does not prove the first left schema incomplete. Document the boundary explicitly instead of adding superficial row counts or restoring duplicate pushes.

The integration test at apps/crew/test/integration/crew-prepared-database.test.ts currently asserts every CHECKSUM TABLE result is a JavaScript number, then hashes the returned rows. It passed against real MySQL independently in Plan 007, so the claim that it always fails is unsupported. Nevertheless, accepting valid decimal checksum strings as well as safe nonnegative integer numbers avoids a needless driver representation assumption. Null, undefined, malformed, negative and unsafe numeric results must still fail; never normalize null into an accepted checksum.

The real-database test is currently skipped in ordinary unit CI without CREW_TEST_DATABASE_URL. The Crew browser job already provisions a disposable database and runs nine purchase integration tests. Add this two-case regression to that existing step, serialize the files so purchase mutations cannot race checksum preservation, and keep it before browser mutations. This is meaningful coverage of the requested change without another setup pass.

## Scope

Only modify .github/workflows/e2e.yaml, apps/crew/test/integration/crew-prepared-database.test.ts, a clarifying JSDoc comment in apps/crew/e2e/fixtures/prepared-database.ts, lat.md/crew.md, and `plans/007-crew-ci-preparation.md` and `plans/007-crew-ci-preparation-verification.md` to clarify the durable contract. Create plans/008-crew-review-verification.md. Parent owns this plan's status and plans/README.md.

Do not change helper behavior, globalSetup, setup-e2e-db.ts, application/server code, canonical schema, migrations/snapshots/journal, package/lockfiles, public base or other owners' branches. Use existing Vitest assertions and repository formatting. Keep normalization local to digest; do not create a production utility for test-only hashing.

## Steps and verification

1. Verify clean source baseline and read lat Crew Launch Verification. Run required lat expand/search and GitNexus upstream impact before editing digest or the helper's comment; disambiguate paths, refresh stale index, report HIGH/CRITICAL before proceeding. No source edits if out-of-scope changes are required.
2. Clarify the helper JSDoc, lat and Plan 007 prose: only targeted constraint validation, preparation guaranteed by ordered successful workflow steps and exercised by integration/browser tests; no whole-schema claim. Preserve the qualified intermittent Drizzle diagnosis.
3. Normalize each valid checksum to its decimal string before hashing while retaining table identity and row-count checks. Accept number or decimal string; reject absent/invalid data and unsafe numeric values. Record prior successful real-DB evidence rather than inventing a deterministic old-code failure. This test-only hardening does not require a new abstraction or tests that merely mirror the implementation.
4. Rename the existing workflow purchase step to describe both gates and run both test/integration/crew-purchase.test.ts and test/integration/crew-prepared-database.test.ts with --no-file-parallelism. Preserve its existing CREW_TEST_DATABASE_URL and successful preparation ordering. No new provisioning or marker placement changes.
5. Run Node24 from /Users/zacjones/.nvm/versions/node/v24.15.0/bin. Run pnpm --filter crew exec vitest run test/e2e/global-setup.test.ts test/e2e/prepared-database.test.ts (22 pass). With CREW_TEST_DATABASE_URL=mysql://root@127.0.0.1:33329/crew_ci_preparation_e2e run pnpm --filter crew exec vitest run test/integration/crew-purchase.test.ts test/integration/crew-prepared-database.test.ts --no-file-parallelism (11 pass, no skips). This existing task-owned disposable database is available; preserve other databases. The integration negative may create/remove only its own generated fixture as already implemented. If the local MySQL service is absent, report rather than switching to a remote endpoint.
6. Run pnpm --filter crew type-check, pnpm --filter crew lint, lat check and git diff --check. Expect zero errors (existing lint warnings are allowed and reported). No browser rerun is required for test-only/comment changes; the baseline actual CI passed all 18 browser journeys and the successor workflow will execute them again.
7. Write the verification receipt with both comment dispositions, exact commands/results, scope and limits. Parent independently reviews the full diff and repeats gates. Wait for approval, then stage final docs, run GitNexus detect_changes on staged scope, lat/diff checks and commit only the approved changes. Do not push or merge.

## Completion and maintenance

Done requires 22 mocked and 11 real-database tests passing, type/lint/lat/diff checks passing, no out-of-scope modifications and both review comments dispositioned with evidence. Keep the checksum gate in the existing prepared CI database step; future seed or browser mutations must not run concurrently with its preservation comparison.
