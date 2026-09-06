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

The idempotent MySQL migration adds the AI Workout Import catalog entry and import session/receipt tables without adding plan or team grants. Existing admin entitlement controls provide targeted grants and revocations.

Sessions expire after 24 hours. Successful saves immediately clear DB proposal/source text. Ownership-only cleanup clears abandoned or cancelled drafts and expires their sessions. The backend schedules cleanup and removes private source objects; receipts retain minimal IDs and hashes for audit, without source content.

The Drizzle migration journal and snapshot include only the two import tables. Other preexisting schema drift is deliberately outside this migration. Admin regrant clears an expired AI import snapshot; it does not alter expiry behavior for other features.

## Ordinary create compatibility

Manual creation validates references, persists scoring fields, and checks destination-team write access. Adding a workout to a track requires programming permission and visibility of that workout.

Manual creation stays independent of AI entitlements. Import saves always use the dedicated server-owned session service, even when the reviewed proposal has been edited locally.

Admin revocation writes an inactive import snapshot even when access came only from a plan or manual override. This prevents a missing snapshot from preserving access after a successful revoke action.

## Saved workout edit roundtrip

Saved imports use ordinary workout edit permissions. Reads include movements and scaling references; updates validate and atomically persist all reviewed scoring fields and movement replacements, independently of AI access.

Omitted new metadata or movements preserves existing values for older callers. Explicit null clears optional scoring metadata and an empty movement list clears junction rows. Real MySQL tests verify reload, replacement, clearing, invalid-reference rollback, and denied writes after permission loss.

The import migration is `packages/wodsmith-db/mysql-migrations/0004_workout_import_domain.sql`, after main’s `0002_training_personal.sql` and `0003_training_library_history.sql`. Its snapshot extends main’s 0003 schema with only the two import tables.
