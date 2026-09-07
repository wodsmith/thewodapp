# Workout Import

AI workout import turns source text or an image into a reviewed prescription with explicit scoring semantics and a server-owned save history.

## Shared contract

Browser, model, and persistence contracts distinguish nullable proposals from complete saves. Ownership is resolved on the server and visibility is chosen during review.

Authorized access responses include labels for the destination team and permitted team/system scaling groups.

[[apps/wodsmith-start/src/lib/workout-import/schemas.ts]] preserves movement IDs, aggregation, tiebreak, scaling references, separately recorded scores, and workout time caps in seconds. Prescription rounds remain in the description; score-library milliseconds use an explicit conversion.

## Authorization

Import access requires current workout tracking and AI import grants on the exact destination team plus active membership and write permission. Admin status does not bypass this policy.

[[apps/wodsmith-start/src/server/workout-import/access.ts#requireWorkoutImportAccess]] reads catalog, manual overrides, team snapshots, and plan grants directly. Explicit expired or revoked snapshots deny access without plan fallback. Transactional callers avoid cached authorization reads.

## Atomic reviewed save

The server locks the owned session, validates its current revision and question resolutions, rechecks authorization, and writes workout, movement links, optional track link, and receipt in one transaction.

[[apps/wodsmith-start/src/server/workout-import/persistence.ts#saveWorkoutImport]] uses one receipt per import and a normalized content hash. Identical retries return the same IDs after current authorization; changed content and stale revisions fail. Successful saves clear stored proposal text.

## Grant and revocation tests

Real MySQL tests use the existing admin grant/revoke helpers to verify denial by default, wrong-team isolation, expiry, regrant, and immediate revocation without an admin bypass.

## Atomic persistence tests

Real MySQL tests verify complete scoring roundtrips, simultaneous retries, rollback on track insertion failure, stale revisions, unresolved questions, cancellation, and zero writes after access loss.

## Provisioning and retention

The idempotent MySQL migration adds the Workout import catalog entry and import session/receipt tables without adding plan or team grants. Existing admin entitlement controls provide targeted grants and revocations.

Sessions expire after 24 hours. Successful saves immediately clear DB proposal/source text. Ownership-only cleanup clears abandoned or cancelled drafts and expires unsaved sessions. Saved receipts keep their original expiry so late cancellation cannot invalidate retry. The backend schedules cleanup and removes private source objects; receipts retain minimal IDs and hashes for audit, without source content.

The Drizzle migration journal and snapshot include only the two import tables. Other preexisting schema drift is deliberately outside this migration. Admin regrant clears an expired AI import snapshot; it does not alter expiry behavior for other features.

## Ordinary create compatibility

Manual creation validates references, persists scoring fields, and checks destination-team write access. Adding a workout to a track requires programming permission and visibility of that workout.

Manual creation stays independent of AI entitlements. Import saves always use the dedicated server-owned session service, even when the reviewed proposal has been edited locally.

Admin revocation writes an inactive import snapshot even when access came only from a plan or manual override. This prevents a missing snapshot from preserving access after a successful revoke action.

## Saved workout edit roundtrip

Saved imports use ordinary workout edit permissions. Reads include movements and scaling references; updates validate and atomically persist all reviewed scoring fields and movement replacements, independently of AI access.

Omitted new metadata or movements preserves existing values for older callers. Explicit null clears optional scoring metadata and an empty movement list clears junction rows. Real MySQL tests verify reload, replacement, clearing, invalid-reference rollback, and denied writes after permission loss.

The import migration is `packages/wodsmith-db/mysql-migrations/0005_workout_import_domain.sql`, after main’s unchanged `0004_crossfit_daily_import.sql`. Its snapshot extends main’s 0004 schema, retaining both CrossFit tables and adding only the two AI import tables.

## Ordinary edit scaling choices

The ordinary workout editor loads team and system scaling choices using current edit permission on the workout’s owner team. It needs no AI entitlement and excludes foreign-team and unowned non-system groups.

A real MySQL and rendered-route regression revokes the AI grant, opens the actual edit form, changes team and system selections, and verifies saved values. Stale session permissions cannot bypass membership expiry, membership revocation, or loss of the edit role.

## Saved receipt cancellation tests

Real MySQL tests verify that late cancellation preserves a saved receipt and its original expiry, allowing lost-response retries to return the same IDs while still enforcing current import access.

## Ordinary aggregation defaults tests

Ordinary multi-score creation and edits normalize a missing aggregation to the scoring library’s scheme default. Import review still requires an explicit choice before saving multiple scores.

## Programming order validation tests

Importer saves to ordinary programming tracks use the manual API’s positive integer ordering contract. Zero, negative, fractional, and out-of-range orders fail validation; competition decimal ordering is unchanged.

## CrossFit destination isolation tests

AI import excludes the CrossFit.com source track even with current team grants and owner permissions. Real MySQL tests deny access, session creation, and saves from stale sessions without writing workouts or receipts.

CrossFit publication retains its separate administrator authorization and automatic append ordering through [[crossfit-import#CrossFit Daily Import#Publication]].
