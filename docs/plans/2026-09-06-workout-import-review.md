# Workout import review follow-up

PR #680 review findings are assessed against the implementation and its denied-by-default rollout boundary. Fixes preserve current ownership checks, reviewed saves, ordinary editing and idempotent receipts; live extraction quality remains a release gate.

## Original findings

The expired-session and ordinary scaling editor reports reproduce and are fixed with focused database, HTTP, Agent, interaction and real-browser regressions.

- `3944614259`, duplicated by `3944644095`: typed expiry is raised only after ownership/current access passes. HTTP returns 410 `source_expired`; Agent delivery preserves the expiry reason; restoration clears stale provenance so a new import can start. Revoked and cross-user access remain denied.
- `3944614262`, duplicated by `3944644175`: the edit route loads scaling labels through an ordinary, current-permission endpoint derived from the workout's owner. It includes exact-team and global system groups, excludes foreign groups, and does not require AI access.

## Additional correctness checks

The later automated review is bounded to confirmed introduced behavior and executable regressions. The confirmed fixes have passed focused regression tests and final integration verification.

| Review IDs | Disposition |
| --- | --- |
| `3944644096` | Match the ordinary noncompetition track-add API's positive integer order; preserve decimal storage for other programming uses. |
| `3944644099` | Normalize missing ordinary multi-score aggregation from the existing scheme default; keep importer review strict. |
| `3944644113` | Observe an already-started promise even if cancellation predates the abort race. |
| `3944644126`, `3944644128` | Bound unresolved questions without dropping affected fields and make their IDs unique. |
| `3944644134` | Best-effort delete a source when the post-upload access check fails; retention remains the fallback. |
| `3944644138` | Reject unsupported cancel methods before allocating a session or Agent. |
| `3944644152` | Hide the settings track Add action unless current owner-team programming permission passes; preserve subscriber reads. |
| `3944644145` | Register both exported Agents in the standalone Wrangler configuration. |
| `3944644165` | Preserve a committed receipt's session expiry during later cancellation. |
| `3944644166`, `3944644178` | Include runtime tests in the normal CI test command and cover actor/team budget wiring. |
| `3944644150`, `3944644182`, `3944644186` | Keep smoke input/errors controlled and local configuration reruns explicit without overwriting existing configuration. |
| `3944644101`, `3944644130`, `3944644137`, `3944644158` | Verify source replacement, duplicate clicks, cancellation during setup and transient access-check errors. |
| `3944644121`, `3944644189`, `3944644193` | Check narrow triggers and fix isolated test/fixture setup where needed. |
| `3944644109`, `3944644185` | Browser fixtures restore the original entitlement records after success or failure and assert the feature grant exists. Named fixture rows remain in the fixed disposable database for inspection. |

## Findings that do not justify the proposed change

These reports either describe intentional behavior or extend beyond the importer's introduced access model. They are retained here with their reasoning rather than silently treated as fixed.

- `3944644155`: linked public workout visibility after later privatization predates this PR: main already permits the link and uses the same raw track read. Imported track workouts belong to the destination. Broader track copy/read semantics are deferred.
- `3944644148`: importer access and its UI use `hasCurrentWorkoutFeature`, which explicitly denies inactive/expired snapshots before plan fallback. No importer caller uses generic `hasFeature(AI_WORKOUT_IMPORT)`. A broad legacy entitlement rewrite is unnecessary for this feature's security.
- `3944644163`: quota reservations intentionally charge conservatively when a later check fails, as documented. Compensating across separate Durable Objects would change the quota model; no unauthorized inference is enabled by this behavior.
- `3944644142`: the new private bucket is newly provisioned. No existing resource requiring adoption was identified; automatic adoption is not added speculatively.
- `3944644173`: changing the scoring scheme intentionally clears incompatible cap metadata. Returning to capped time requires a cap; validation prevents saving a missing one.
- `3944644191`: the dated infrastructure plan records the pre-implementation research state. Current implementation and verification are documented in the integration matrix and `lat.md/`; rewriting its historical premise would erase that distinction.

## Verification boundary

The real local browser checks passed for expiry recovery, revoked-expiry denial, and changing team/system scaling after AI revocation. The full main suite passed 3,464 tests (25 skipped), with 30 separate runtime tests, a client/Worker build and current-permission browser regressions. CI results are recorded in the PR; representative model quality and deployed privacy checks remain rollout gates.
