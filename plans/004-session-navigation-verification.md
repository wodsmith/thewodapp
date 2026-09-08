# Session navigation verification receipt

This receipt records the second review of PR #699, the reproduced navigation and addition-identity defects, and the checks for the bounded Plan 004 changes.

## Baseline and scope

The exact baseline is 9d43c56a1303f2f9cb8a2f384495cad3fe9d5c89 in the isolated zac/training-session-ux worktree. Production edits are limited to AthletePersonalSession and LogNewPage; no server implementation or shared access contract changes were needed.

Canonical schema, migration SQL, snapshots and journal remain unchanged. Option C migration integration remains held until the dependencies merge through their own reviews and the actual next migration reservation is rechecked. The disposable migration prototype is separate evidence and is not part of this change.

## Review dispositions

Each of the eight new comments was checked against source and relevant behavior. Suggested patches were evaluated separately from the underlying findings.

| Comment | Disposition and proof |
| --- | --- |
| 3953564083 | Fixed. My session new-score and existing-score links preserve the browsed track, workspace, performed date and session surface. Before component cases failed for new and edit; after component and native browser new/edit journeys pass from non-default Recovery. |
| 3953564087 | Fixed with separate return context. Import carries returnTrackId and returnSurface, while the imported item and subsequent navigation do not inherit the old source track/date as provenance. Before import case failed; the route test now asserts saved-item provenance, navigation, retained recognized-import notes and the correct Back to training label. Existing-result redirect has a separate assertion. |
| 3953564088 | Fixed. Preview private block results and explicit default preference persist alongside sessions and library attempts. Unit tests reset modules; browser tests perform native reload without trackId and retain Recovery plus the borrowed cooldown completion. README documents all four storage reset keys and the real log forms. |
| 3953564090 | Fixed. Production Add-all cache identity includes destination workspace/date and actual source track/date/workout. Before emitted-ID regression found one ID instead of four distinct contexts; after preserves IDs on same-intent retry and return. Preview rejects same-ID/different-payload and deduplicates ordinary occurrences. Explicit-repeat retry remains idempotent: blindly bypassing duplicate checks for allowDuplicate would break that contract. Real DB tests prove the existing server rejection, retries, separate dates and repeat behavior without changing the writer. |
| 3953564095 | Rejected as written. The training.test.ts beforeAll track insert omits isPublic, and canonical programming.ts sets its default to 0. Restoring the owner while leaving isPublic at 0 preserves that baseline. The suggested isPublic:1 would change it. No fixture permission change was made. |
| 3953564098 | Fixed. Preview session reads, saves and duplicate no-op responses return clones; persisted values are also cloned when stored. A before test mutated backing state through a response; the after test proves both duplicate responses and ordinary reads cannot mutate it. |
| 3953564100 | Fixed. The planned-score browser journey now switches from the provider to Everyday, asserts Everyday content, then returns to the provider before checking the recorded result. |
| 3953564103 | Fixed. Touched new provider regressions and appended component/route/browser cases are formatted; unrelated existing test sections were not reformatted. |

## Before and focused after evidence

Checks used Node 24 and only the disposable local database. Failed initial test selectors are distinguished from substantive before-fix reproductions.

- Before UI: /private/tmp/session-004-before-ui.log records four failures, three substantive (new/edit return track and import return) and one incomplete Add-all fixture. Before preview state: /private/tmp/session-004-before-state.log records three substantive fixture failures plus the same incomplete Add-all fixture.
- Corrected two-workout Add-all before proof: /private/tmp/session-004-before-identity.log records one failed assertion, expecting four distinct context IDs and receiving one. Earlier missing-button failures were fixture setup errors and are not product evidence.
- Focused after: `pnpm --filter wodsmith-start exec vitest run test/components/training/session-preview-state.test.ts test/components/training/athlete-training.test.tsx test/routes/workout-import-handoffs.test.tsx --minWorkers=1 --maxWorkers=2` passed 40/40 (/private/tmp/session-004-after-ui.log).
- Real provider DB: `pnpm --filter wodsmith-start exec vitest run src/server/training-provider.test.ts --no-file-parallelism` passed 7/7 with no skips (/private/tmp/session-004-db.log), using TRAINING_TEST_DATABASE_URL only for localhost:33327/training_test.
- New native browser cases: dedicated Playwright session config with grep `browsed non-default|private borrowed` passed 4/4 across desktop/mobile (/private/tmp/session-004-browser.log). Initial assertions used incorrect existing UI labels; corrected assertions use the actual Default track label and pressed Undo completion control.
- Parent independently passed the full app suite: 3,578 tests, with 146 environment-dependent skips. Targeted personal/provider real MySQL suites passed 32/32 with no skips. Complete desktop/mobile session browser coverage passed 20/20. Lint passed with 148 warnings and no errors.
- Parent type review found two untyped new mock arguments. The correction uses guarded typed data extraction without suppressions. App type-check now passes independently and locally (/private/tmp/session-004-types-final.log); the narrow component rerun passes 27/27 (/private/tmp/session-004-typed-component.log). Parent production build passed (client 23.12 seconds, SSR 38.35 seconds), runtime passed 39/39 and final lat check passed.

## Impact, documentation and limits

GitNexus upstream analysis preceded symbol changes; MCP transport was unavailable, so the working CLI was used. No HIGH or CRITICAL warning was returned.

AthletePersonalSession reported LOW, one direct caller, no indexed processes, one module. LogNewPage is absent from the graph and therefore UNKNOWN; its route and import callers were traced manually. Disambiguated preview reads/writes and fixture helpers reported LOW with zero direct callers/processes. These graph counts do not replace behavioral verification. A required stale-index refresh completed in 45.8 seconds with 34,854 nodes, 77,604 edges and 289 flows (/private/tmp/session-004-index.log).

Semantic lat search succeeded on the authorized network retry (/private/tmp/session-004-lat-search.log), and the relevant training/import intent was read. Behavior documentation, ten adjacent-comment test specifications, and the lat index were updated. lat check passed (/private/tmp/session-004-lat.log); git diff --check passed; the packages/wodsmith-db diff against the baseline is empty. Final lat check passed again (/private/tmp/session-004-lat-final.log). Light GitNexus detection reported LOW risk, 22 symbols and no affected indexed processes across the 13 then-tracked changed files (/private/tmp/session-004-detect.txt). Final staged detection passed with 17 files, 29 symbols, no affected indexed processes and LOW risk (/private/tmp/session-004-detect-staged.txt), including the newly added tests and documentation. The parent approved the full source/test/receipt diff and all eight dispositions after its independent gates passed.

Preview persistence remains browser sessionStorage and does not claim to verify production authorization. The real disposable DB tests cover production append semantics. No production data, dependency branch, migration artifact or public base was changed in this pass.
