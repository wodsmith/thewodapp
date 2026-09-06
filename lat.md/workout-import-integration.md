# Workout Import Integration

Workout import acceptance covers entitled creation in the personal library, writable programming tracks, and the logging flow. The implementation plans define proposed behavior; integration evidence must distinguish local checks from live validation.

## Review and commit boundary

An AI proposal is reviewed before an explicit entitled save. Server-owned session provenance and current destination access remain required after edits, reconnects, revocation and duplicate retries.

The integration acceptance matrix lives in `docs/plans/2026-09-05-workout-import-integration.md`, alongside the infrastructure and UX plans. [[architecture#Architecture#AI Agents]] describes the existing runtime; [[domain#Domain Model#Workouts]] defines workout scoring concepts.

## Evaluation sources

Thirty authored prescriptions cover precise scoring, ambiguous inputs, units, multiple parts and hostile instructions. A test-only renderer creates matching printed screenshots; labels require human review before launch evaluation.

The corpus is `apps/wodsmith-start/test/fixtures/workout-import/evaluation.json`. Generated images and manifests stay outside the repository. Printed-source checks do not establish handwriting robustness or live model quality, cost or latency.

## Post-save cleanup tests

Committed saves schedule private source cleanup without changing their successful receipt when cleanup fails. Denied saves retain the draft and never schedule successful-save cleanup.

[[apps/wodsmith-start/src/server-fns/workout-import-fns.ts#saveWorkoutImportFn]] extends the Worker request lifetime for cleanup after the database commit. The existing expiry schedule remains the fallback if cleanup is temporarily unavailable.

## Browser verification boundary

The integration browser runner uses a loopback Worker and a fixed disposable MySQL database. It seeds model proposals explicitly, then exercises real session authorization, review controls and persistence without claiming extraction quality.

The runner is `apps/wodsmith-start/scripts/verify-workout-import-browser.mjs`; it requires the existing synthetic E2E users and catalog seed. Screenshots stay under `/tmp/workout-import-browser-evidence`. Live extraction observations remain separate in [[workout-import-runtime#Workout Import Runtime]].

## Review regression browser

The review runner verifies expired-session recovery and ordinary scaling changes through the local Worker and database.

Test entitlement snapshots are restored after success or failure; fixture workouts remain in the disposable database for inspection.

Run `apps/wodsmith-start/scripts/verify-workout-import-review.mjs` after the base integration browser fixtures. It confirms owned expiry returns 410 and starts fresh, revoked expiry remains 403, and team/system scaling changes save without AI access while foreign choices stay absent.

## Review dispositions

The September 6 review follow-up records reproduced findings, regression fixes, and intentional behavior retained after triage. It does not turn live model-quality or deployed privacy gaps into completed release checks.

See `docs/plans/2026-09-06-workout-import-review.md` for the bounded review decisions and `scripts/verify-workout-import-review.mjs` in the main app for real browser regressions.
