# Session review verification receipt

This receipt records the validated PR #699 review fixes, their reproductions and their focused verification separately from the held migration lineage.

## Baseline and scope

The implementation baseline is d999dde352de1dd55e0ba9d6fc9e673fb9d8c2d3 in the isolated zac/training-session-ux worktree. No canonical schema, SQL migration, snapshot or journal changes belong to this pass.

The disposable migration candidate and its separate compatibility receipt remain outside the public feature. Public integration waits for the reviewed dependencies to merge and the actual next migration reservation to be confirmed. The pure-SQL scaling_key replay gap is an inherited provisioning-contract limitation, not a requested repair in this feature.

## Review disposition

Each saved review comment was checked against the baseline source. The load/time-tiebreak complaint was rejected because the two schemes are independent by design.

| Comment | Disposition and verification |
| --- | --- |
| 3953349372 | Fixed: Customize uses an existing private composition as its baseline. The before browser test and independent manual walkthrough lost the Recovery cooldown; the new cross-track browser test preserves it. Start empty remains explicit, and the builder caption identifies the existing private composition. |
| 3953349378 | Fixed: Add receipts subtract pre-operation identities. Repeated Add all, including after native reload, does not expose Undo for prior work. |
| 3953349387 | Fixed: personal primary and tiebreak times require complete strings before parsing. Before tests accepted malformed prefixes; after tests preserve colon, raw-second, decimal and period precision while rejecting malformed inputs. |
| 3953349390 | Fixed: the preview append adapter deduplicates existing IDs and exact occurrences. Native reload followed by Add all reproduced the incorrect duplicate before the fixture correction. |
| 3953349393 | Fixed: Back restores missing track/date/workspace to defaults. Component reproduction failed before correction; coverage also switches workspaces after Back without carrying an inaccessible restored track. |
| 3953349394 | Fixed with security-owner clarification: retain owned performed snapshots under current workspace access; omit live source hydration and cheers, sanitize unavailable navigation. Real DB source-revocation regression failed before correction and now passes. The prerequisite is intentionally workspace-wide rather than track access. |
| 3953349396 | Fixed: a first planned preview score resolves its actual persisted session/item snapshot. Native-link browser reproduction failed; desktop/mobile first-save journeys now pass without intercepting navigation. |
| 3953349398 | Fixed: edit inputs decode loads to three decimals and convert through grams. Browser before proof changed stored grams on a notes-only edit; notes-only and unit-only round-trip assertions now preserve all fractional round values and aggregate. |
| 3953349402 | Fixed: library history uses explicit saved occurrence when provider metadata is absent. Real DB covers an accessible positive case and subsequent unavailable-source navigation sanitization. |
| 3953349403 | Fixed: uncontrolled destination changes clear old session data while a new request is pending. Before component reproduction failed; after passes. |
| 3953349405 | Fixed: stale append revisions refresh and retry once with the same item identity. Out-of-order callbacks cannot regress newer controlled day data. Before action regression failed; real library row tests preserve both rapid intents and receipts. |
| 3953349407 | Fixed: library destination invalidation is independent of retry count. Route-component test covers failed load, Retry, then a pending new date. This specific route test was added after the narrow source correction; baseline code inspection established the defect. |
| 3953349409 | Fixed: workout/occurrence/team/date changes reset score, unit, tiebreak and attempt identity. Recognized import handoffs intentionally retain notes under the existing import contract; ordinary changes clear notes. Before same-shape workout component reproduction failed; after passes. |
| 3953349411 | Rejected after type verification: TanStack uses this annotation for navigation input as well as normalized output. Making surface required broke seven valid legacy navigation callsites. Retain optional input ergonomics; runtime normalization still always supplies track/session. |
| 3953349412 | Fixed: preview week generation expanded for readability. No behavior change. |
| 3953349416 | Fixed: browser output uses node:os tmpdir with path joining. Cold preview startup retains an explicit app-root cwd and isolated port. |
| 3953349419 | Fixed: source dates require source tracks at all three personal input boundaries. Before schema tests accepted invalid combinations; after reject them. |
| 3953349422 | Rejected: a load workout may have an independent time tiebreak. Browser coverage intentionally retains the load-plus-time fixture. |
| 3953349425 | Fixed: preview duplicate no-ops return the existing session before revision validation or increment. Reloaded Add-all coverage verifies the visible behavior. |
| 3953349427 | Fixed: design notes record final reviewed dependency head aecbb2790 and identify earlier evidence as historical. The separate integration hold remains explicit. |
| 3953355314 | Fixed: source actions log/edit the exact included personal item and its result. The before component test lacked planned identity; after passes. Reverse Log-then-Add and Customize reuse the saved result identity and frozen prescription; real DB verifies one score, explicit repeats and scored Undo rejection. My session has a focused existing-score edit assertion. |
| 3953355319 | Fixed: absent legacy occurrence falls back to provider provenance; newly unscoped items persist an explicit empty occurrence. Before component reproduction failed; real DB verifies deduplication and that the unscoped item stays separate. |

## Focused evidence

These checks ran against the feature worktree with Node 24. Local MySQL used only the disposable localhost training_test database on port 33327 and serial file execution.

- Before initial component/normalization/schema run: 5 failed, 7 passed (`/private/tmp/session-review-before-unit.log`). After initial correction: 12 passed (`/private/tmp/session-review-after-initial.log`).
- Before composition/Undo browser run: 2 failed (`/private/tmp/session-review-before-browser.log`). Before native planned-score/weight edit: 2 failed (`/private/tmp/session-review-before-forms.log`). The initial sandboxed preview attempt was denied binding localhost; the authorized local retry ran actual browser tests.
- Other before proofs: stale append 1 failed/9 passed; new-form reset 1 failed/7 passed; Back 1 failed/22 filtered; owned history 1 failed/23 filtered; direct-result composition 2 failed/23 filtered. Logs use the session-review-before-* prefix in /private/tmp.
- Final focused components: `pnpm --filter wodsmith-start exec vitest run test/components/training/athlete-training.test.tsx test/components/training/session-workout-actions.test.tsx test/routes/workout-library-session.test.tsx test/routes/workout-import-handoffs.test.tsx src/server/training-personal-review.test.ts --minWorkers=1 --maxWorkers=2`: 47 passed (`/private/tmp/session-review-components-final.log`).
- Personal and source training DB suites: 49 passed, no skips (`/private/tmp/session-review-after-db.log`). Provider DB suite: 6 passed, no skips (`/private/tmp/session-review-provider.log`). Early provider assertion incorrectly inspected an in-memory object before JSON serialization; correction inspects the actual persisted/reloaded empty occurrence. The history positive fixture now explicitly subscribes before revocation, since an older suite case unsubscribes.
- Planned first-score and exact weight browser cases: 4 passed across desktop/mobile (`/private/tmp/session-review-after-forms.log`). Reloaded Add-all: 2 passed across desktop/mobile (`/private/tmp/session-review-after-fixture-retry.log`). Full desktop pass before the session fixture persistence correction had 7 passed/1 failed; it is not reported as a passing final full browser gate.
- Parent independently passed app types, schema ownership, shared DB types and Crew types. Parent final broad suite: 3,570 passed/145 environment skips; runtime: 39 passed; combined real MySQL: 117 passed/no skips. A later type gate rejected the optional-surface cleanup (reverted) and found one missing test prop (corrected). Final app types passed; all 16 desktop/mobile browser cases passed; lint passed with 148 warnings and no errors; final lat passed. The independent production build also passed (client 24.27 seconds; SSR 38.23 seconds). Parent approved the complete runtime/test/documentation diff after these gates; migration integration remains held.

## Impact and documentation

GitNexus was refreshed with an accurate forced local index after the incremental FTS index failed. The shared reader/security contract was not edited.

Upstream impact results: normalizePersonalLibraryScore LOW, one direct caller and no indexed processes; SessionWorkoutActions LOW, three direct callers across two modules; AthletePersonalSession and AthleteTraining LOW, one direct caller each. The writer and own-history entrypoints reported LOW with no indexed callers/processes; this is graph evidence, not a claim that persistence or access changes are intrinsically low risk. Route-local LogNewPage/LogEditPage were absent from the graph and were manually traced; their graph result is UNKNOWN. Schema constants and disambiguated preview functions reported LOW with no indexed processes. Impact output is preserved under /private/tmp/session-review-impact-*.json where recorded.

Behavior and focused test specifications were updated in training.md, training-personal.md, session-review-tests.md and the lat index. The first lat check caught the missing new index entry; the entry was then added. Final lat passed after that correction. Light GitNexus CLI detect-changes completed successfully: 34 files, 51 symbols, no affected indexed processes, LOW risk, and only the expected session/scoring/history/fixture/documentation scope. MCP detection remained unavailable with Transport closed, so the equivalent CLI was used. The output is /private/tmp/session-review-detect.txt. Final staged detection is repeated immediately before the approved commit. No public branch or migration changes were made by the disposable prototype.
