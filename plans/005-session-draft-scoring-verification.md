# Session draft scoring verification receipt

This receipt records Plan 005's explicit draft-save boundary, preview retry comparison and diagnostic portability clarification for PR #699.

## Baseline and scope

The exact baseline is 621a8e091197df00430e672eb6bf8cdde7c9641a in the isolated zac/training-session-ux worktree. Production edits affect only AthletePersonalSession's library-item render branch.

The existing production writer and input schemas were inspected read-only. No server implementation, shared security policy, canonical schema, migration, snapshot, journal, dependency branch or PR base changed. Option C integration remains held. No production data was read or written.

## Review dispositions

All three findings were validated. The fixes preserve explicit Save as the composition persistence boundary and keep personal item identity separate from source occurrence identity.

| Comment | Disposition and evidence |
| --- | --- |
| 3953745496 | Fixed. Every library item in an open draft displays the same save-first message as other block kinds. New-score and existing-score anchors are absent for new compositions, edits to existing compositions, and additional draft repeats. Cancel writes nothing. Explicit Save restores persisted personal session/item identity, new/edit score links and the selected return track. Three component cases reproduced the active anchor before the guard; native desktop/mobile cases also failed before the guard and now open the real score form only after Save. |
| 3953745499 | Fixed in the preview only. Personal payload comparison passes both values through the existing personalTrainingItemSchema before serialization, so reordered outer, block and remixedFrom fields compare consistently. Same-ID changed prescription still conflicts; different personal IDs stay separate. Existing library/source occurrence deduplication and explicit-repeat retry semantics remain intact. The production inputValidator already parses personalTrainingSaveSchema before the writer's sameInput comparison; no server correction was needed. The regression uses a stored block ID matching its personal item ID, as the production writer does. |
| 3953745502 | Fixed. The Plan 004 receipt labels /private/tmp files disposable machine-local diagnostics, preserves historical observed counts/failures, and identifies committed test paths plus runnable commands as the portable verification contract. Raw logs were not committed. |

## Reproducible verification

Committed tests and commands are the reproducible contract. All local log paths below are disposable machine-local diagnostics, not portable or committed proof.

- Focused command: `pnpm --filter wodsmith-start exec vitest run test/components/training/athlete-training.test.tsx test/components/training/session-preview-state.test.ts --minWorkers=1 --maxWorkers=2`. Before: 4 failed and 30 passed; three cases exposed draft links and one equivalent personal retry threw CONFLICT (/private/tmp/session-005-before.log). After: 34/34 passed (/private/tmp/session-005-after.log).
- Browser command: `pnpm --filter wodsmith-start exec playwright test --config test/preview/training/playwright.session.config.ts`. The new case in my-session.spec.ts failed before in both desktop/mobile at the unsaved score-anchor assertion (/private/tmp/session-005-before-browser.log, run with grep `requires explicit Save`). The complete after suite passed 22/22 (/private/tmp/session-005-browser.log).
- App types: `pnpm --filter wodsmith-start type-check`. The new component test initially used unsupported React Testing Library exact role options; those were removed without type suppressions. The corrected local check passed (/private/tmp/session-005-types.log).
- Lint: `pnpm --filter wodsmith-start lint` passed with 148 warnings and no errors (/private/tmp/session-005-lint.log). `lat check` passed (/private/tmp/session-005-lat.log), and `git diff --check` passed.
- `git diff 621a8e091197df00430e672eb6bf8cdde7c9641a -- packages/wodsmith-db apps/wodsmith-start/src/server` is empty. Database, migration, full-app and build gates were not repeated because this pass changes only a render guard, preview comparison and tests/docs; complete native browser and app static gates cover the affected surface.

The first after component run exposed missing harness waits on a second asynchronous Customize; the next exposed the isolated test's missing parent surface update after Save. Awaiting loaded draft controls and asserting/simulating the onSurfaceChange callback corrected these test harness assumptions. These intermediate failures are not claimed as additional product defects. The native browser exercises the actual parent transition.

## Independent review gates

The parent independently read the complete source, new assertions and documentation diff, then reran the affected gates on the stable changes.

Focused tests passed 34/34 (/private/tmp/session005-parent-focused.log); complete cold browser coverage passed 22/22 in 20.2 seconds (/private/tmp/session005-parent-browser.log). App types, lint with 148 warnings and no errors, lat check and diff check passed. These paths are disposable local diagnostics; the commands above are the reproducible checks. No wider database/build run was required for this render guard and preview-only comparison; published CI remains a separate latest-head verification after publication.

## Impact and documentation

Upstream GitNexus analysis ran before production and fixture edits. AthletePersonalSession is LOW risk with AthleteTrainingGym as its direct caller, one affected module and zero indexed processes; fixtureAdditionExists is LOW with zero indexed callers/processes.

The stale index was refreshed to the exact baseline. The first sandboxed refresh could not write the global registry; the authorized retry succeeded in 36.9 seconds with 34,881 nodes, 77,636 edges and 289 flows (/private/tmp/session-005-index.log). Final status was up-to-date. CLI impact output is preserved in session-005-impact-ui.txt and session-005-impact-fixture.txt under /private/tmp. No HIGH or CRITICAL warning occurred.

lat expand and semantic search ran, and the relevant session retry, planned provider scoring and asynchronous draft intent was read. training-personal.md documents the save boundary; three leaf specifications in session-navigation-tests.md have adjacent code references. Final staged GitNexus detection passed with 11 files, 17 symbols, zero affected indexed processes and LOW risk (/private/tmp/session-005-detect-staged.txt). Final lat and staged diff checks passed. The parent approved the complete diff, all three dispositions and independent gates before authorizing the commit.
