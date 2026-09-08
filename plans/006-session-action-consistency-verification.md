# Session action consistency verification receipt

This receipt records the bounded delayed-review corrections for PR #699, their regressions, and the unchanged migration integration hold.

## Baseline and scope

The exact baseline is 20c60663ea3e52869de0466c8fe5151c98ff5ac1 in the isolated zac/training-session-ux worktree. Production changes are limited to AthletePersonalSession and WorkoutDetailPage.

No server implementation, input schema, security ownership policy, database schema, migration SQL, snapshot, journal, dependency branch or PR base changed. Option C remains binding: PR #699 is not merge-ready until its dependencies merge through authorized review and lineage reconciliation is separately completed. No production data was read or written.

## Review dispositions

Seven findings were addressed, one suggested behavior was rejected with a regression, and one migration finding remains explicitly held. Test improvements are distinguished from production defects.

| Comment | Disposition and evidence |
| --- | --- |
| 3953822508 | Fixed. Provider Customize starts one definition-request batch, displays Preparing session… on the disabled trigger and marks the section busy. Failure clears preparation and permits retry. Success, error and finally are conditional on the live workspace/date/track context; an old request cannot replace a newer draft or clear a newer preparation. Tests cover all three context changes with both late success and rejection. Preparing still makes no composition write. |
| 3953822512 | Fixed. One exact source session/block/published-version predicate drives both Add's label and disabled state. A prior saved publication leaves the new occurrence enabled and labeled Add to My session; current-version membership is disabled In My session. Append logic is unchanged. |
| 3953822529 | Fixed. Both legacy Add links below schedules and earlier results were removed. A real detail component test retains scheduled dates and recorded results, verifies the sole shared header Add button and direct Log link, and verifies no legacy pending-add navigation link or unauthorized source-edit control. |
| 3953822533 | Improved test only. The rejecting mock captures structuredClone(data) before the production retry mutates its request. Assertions prove original revision zero, retry revision one and unchanged item contents against the independent snapshot, while retaining successful Undo UI verification. No production action writer changed. |
| 3953822535 | Improved tests only. Direct and personal score functions have distinct mocks; import no-write assertions check both. Real new-log form submissions exercise both branches and assert the selected writer, its exact identity/context fields, and that the other writer and composition save never run. LogNewPage was read-only. |
| 3953822538 | Corrected documentation. Independent Direct Scores now marks the colliding 0007 artifact held, requires authorized dependency merges and rechecking the actual next reservation, and identifies 0009 as a provisional disposable prototype rather than an apply instruction. Existing scoring behavior remains documented. |
| 3953822541 | Acknowledged and deferred under Option C. The migration journal collision cannot be resolved in this runtime review pass. No lineage artifact or public base was changed; the PR remains not merge-ready. |
| 3953840114 | Rejected as written. Replacing schema.parse with invalid-as-nonduplicate safeParse behavior would allow invalid persistence attempts to be treated as additions. Production validates inputs before the writer; the preview should reject them too. A focused same-ID personal retry with an empty prescription now asserts rejection. The existing preview helper and schema remain unchanged. |
| 3953840117 | Clarified. The parent updated Plan 005's authorization and completion paragraphs to past tense so its DONE status is unambiguous. Its historical results and prior dispositions remain intact. |

## Reproducible gates and observed results

Committed test files and these commands are the portable verification contract. All /private/tmp log paths are disposable machine-local diagnostics, not committed or portable proof.

- Substantive before command: `pnpm --filter wodsmith-start exec vitest run test/components/training/athlete-training.test.tsx test/routes/workout-detail-session.test.tsx --minWorkers=1 --maxWorkers=2`. Result: 10 failed, 31 passed (/private/tmp/session-006-before.log). Failures exposed absent pending feedback, stale errors on retry and after context changes, wrong prior-version Add labeling, and two legacy detail links. The current-version label case and existing tests passed.
- Focused final command: `pnpm --filter wodsmith-start exec vitest run test/components/training/athlete-training.test.tsx test/components/training/session-workout-actions.test.tsx test/components/training/session-preview-state.test.ts test/routes/workout-import-handoffs.test.tsx test/routes/workout-library-session.test.tsx test/routes/workout-detail-session.test.tsx --minWorkers=1 --maxWorkers=2`. Result: 70/70 passed across six files (/private/tmp/session-006-after.log). The added preview suite covers the late invalid-input review finding.
- Native browser command: `pnpm --filter wodsmith-start exec playwright test --config test/preview/training/playwright.session.config.ts`. Complete cold desktop/mobile suite: 22/22 passed in 19.3 seconds (/private/tmp/session-006-browser.log). No extra browser fixture was needed for controllable deferred-response permutations, which use actual production components in the focused suite.
- `pnpm --filter wodsmith-start type-check` passed (/private/tmp/session-006-types.log). `pnpm --filter wodsmith-start lint` passed with 148 warnings and no errors (/private/tmp/session-006-lint.log). `lat check` and `git diff --check` passed (/private/tmp/session-006-lat.log for lat).
- `git diff 20c60663ea3e52869de0466c8fe5151c98ff5ac1 -- packages/wodsmith-db apps/wodsmith-start/src/server` is empty. No database or migration experiments were needed for UI/test/documentation-only changes.

One intermediate detail assertion used a UTC-midnight fixture that rendered the previous local date. Giving the fixture an explicit local noon corrected the test assumption; production date rendering was not changed. Initial static checks also found the new preparedWorkout fixture widened scheme to string; an explicit existing API return type corrected it without suppressions. Test-only retry/mocked-writer improvements are not claimed as reproduced production bugs.

## Independent review

The parent read the full production, test and lat diff and independently reran every affected gate on the stable source.

All six focused files passed 70/70; complete cold browser coverage passed 22/22 in 20.2 seconds. App types, lint with 148 warnings and no errors, lat and diff checks passed. Diagnostics use /private/tmp/session006-parent-{focused,browser,types,lint,lat}; these remain disposable local execution records. The reproducible commands above are unchanged. Final documentation approval and staged change detection precede commit.

## Impact and documentation

Required upstream impacts ran against a freshly indexed baseline before production edits. All resolved impacts were LOW; no HIGH or CRITICAL warning occurred.

AthletePersonalSession has one direct AthleteTrainingGym caller; beginBuilder has one direct AthletePersonalSession caller. Each reports one affected module and zero indexed processes. WorkoutDetailPage and the disambiguated route-test mock report zero indexed callers/processes. The mock name initially had multiple graph candidates; its exact function UID was used. CLI evidence is in /private/tmp/session-006-impact-{ui,builder,detail,test}.txt.

The stale index refresh completed in 46.3 seconds with 34,900 nodes, 77,658 edges and 289 flows (/private/tmp/session-006-index.log). Parent and executor lat expansion/search and the relevant Track and Personal Surfaces, Provider Source Snapshots and Independent Direct Scores intent informed the implementation. Seven new adjacent-comment specifications were added to session-navigation-tests.md; the existing concurrent-addition specification now explains immutable request evidence.

Final staged GitNexus detection passed with 14 files, 34 symbols, zero affected indexed processes and LOW risk (/private/tmp/session-006-detect-staged.txt). Final lat and staged diff checks passed. The parent approved the complete source, tests, documentation, nine dispositions and independent gates before authorizing commit. The executor performs no publication, merge or deployment. Latest-head CI and actual review coverage remain the parent's publication step: a reused successful review status does not establish review coverage of that commit.
