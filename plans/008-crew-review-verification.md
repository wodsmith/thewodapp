# Crew review coverage verification receipt

This receipt records the prepared-verifier contract clarification, checksum representation hardening and CI coverage addition without changing preparation behavior or migration lineage.

## Baseline and scope

The exact baseline is 8c477afb1d108a3acf28b28383e59297e1538ec6 in the isolated zac/training-session-ux worktree. Source was clean at entry; only parent-owned Plan 008 and index documentation were pending.

The helper change is JSDoc only. Global setup, setup-e2e-db.ts, application/server code, canonical schema, migrations/snapshots/journal, package/lockfiles and public base remain unchanged. Dependencies #691 and #695/#698 and the Option C integration hold remain separate prerequisites; no push or merge is performed by the executor.

## Review dispositions

Both comments prompted bounded improvements while their unsupported premises remain explicitly qualified.

- Cubic 3954179612: clarified. verifyPreparedCrewDatabase checks the isolated CI context and the exact competition_invites_active_invite_idx constraint, not complete schema or seed readiness. Successful ordered workflow schema push and both seeds own preparation; integration/browser tests exercise that state. A second push reporting Changes applied does not prove the first push was incomplete. The helper retains its narrow behavior; no superficial row-count probe or duplicate push was added.
- Cubic 3954179615: hardened. Plan 007's numeric-checksum assertion actually passed real MySQL tests independently, so an unconditional failure claim is unsupported. The inline digest now accepts safe nonnegative integer numbers and decimal digit strings, normalizes each to a decimal string, and rejects missing, null, malformed, negative or unsafe numeric values. Returned table count and table identity remain part of the preservation check. No production utility or implementation-mirroring unit suite was introduced.

The existing Crew workflow database step now runs both purchase and prepared-database integration files with --no-file-parallelism. Its name describes both gates; it retains the same prepared disposable database and precedes browser mutations. This adds the existing two real-database cases to CI without another setup step.

## Commands and observed results

Committed tests and commands are the reproducible verification contract. /private/tmp paths below are disposable machine-local diagnostics, not portable or committed proof.

- `pnpm --filter crew exec vitest run test/e2e/global-setup.test.ts test/e2e/prepared-database.test.ts`: 22/22 passed (/private/tmp/session-008-unit.log).
- With CREW_TEST_DATABASE_URL pointing only to the existing task-owned crew_ci_preparation_e2e database at 127.0.0.1:33329: `pnpm --filter crew exec vitest run test/integration/crew-purchase.test.ts test/integration/crew-prepared-database.test.ts --no-file-parallelism`: 11/11 passed, no skips (/private/tmp/session-008-db.log). The negative case modified only its generated fixture database and restored its test-owned index. No other database was changed.
- `pnpm --filter crew type-check`: passed (/private/tmp/session-008-types.log).
- `pnpm --filter crew lint`: passed, 62 warnings and no errors (/private/tmp/session-008-lint.log).
- `lat check` and `git diff --check`: passed (/private/tmp/session-008-lat.log for lat).

The parent caught one workflow-wrapper error before approval: `pnpm --filter crew test ... --no-file-parallelism` let pnpm parse the option and exited before tests with Unknown option file-parallelism. The workflow now uses the exact verified `pnpm --filter crew exec vitest run ... --no-file-parallelism` command.

The parent independently reran the exact corrected workflow command: 11/11 real-database cases passed with no skips. The 22 mocked cases, Crew type check, lint (62 warnings, no errors), lat and diff checks also passed independently. The parent reviewed the full scoped diff and approved this follow-up.

There is no invented old-code RED for the checksum claim: the prior real-MySQL pass is preserved in Plan 007's historical receipt. The current real-database test verifies unchanged prepared data under normalized hashing; the additional string acceptance is a portability correction, not proof that this local driver returned strings. A browser rerun is not required for this test/comment-only change; the baseline's actual Crew CI passed 18 browser cases and the successor CI will run them again.

## Impact and documentation

lat expansion/search and Crew Launch Verification intent informed this change. The existing adjacent integration-test lat reference now documents normalized checksum representation and serial CI ownership.

The stale GitNexus refresh initially failed on LadybugDB WAL checkpoint rotation. The single bounded retry with its recommended 64 MiB checkpoint threshold succeeded in 46.6 seconds, indexing 34,977 nodes, 77,747 edges and 289 flows (/private/tmp/session-008-index-retry.log). Fresh digest upstream impact was LOW with zero indexed callers/processes. verifyPreparedCrewDatabase remained absent from the graph, so its result is UNKNOWN; its direct globalSetup/test usage was read manually and only its comment changed. No HIGH or CRITICAL result occurred.

The helper JSDoc, lat documentation and durable Plan 007 prose now state the narrow guarantee and retain the qualified intermittent Drizzle diagnosis. Final staged GitNexus detection passed with nine files, 17 symbols, zero affected indexed processes and LOW risk (/private/tmp/session-008-detect-staged.txt). Final lat and staged diff checks passed. Parent independent review and gates completed before commit approval; publication remains separate.
