# Plan 003: Resolve session UX review regressions

This review pass closes validated data-preservation, occurrence identity, input validation and navigation defects in PR #699 without changing its held migration lineage.

## Status and baseline

DONE. The coordinator explicitly requested addressing validated review findings under the user's implementation and PR authorization. Work started at d999dde352de1dd55e0ba9d6fc9e673fb9d8c2d3 on zac/training-session-ux in /private/tmp/wodsmith-session-ux. The advisor reviewed the complete runtime/test diff and independently passed the final gates recorded in 003-session-review-verification.md. Migration integration remains held.

Plan 002's implementation and original verification are complete. Its migration integration is held: runtime dependency #691 and migration dependency #698/#695 must merge through their own reviews before rebasing onto actual combined main. Do not edit any migration, snapshot, journal or canonical schema in this runtime review pass. The separate disposable prototype is evidence only.

## Scope and intent

Scope is the existing session/training components, workout library/detail and log routes, personal training normalization/validation/history and thin wrappers, focused training helpers/types, their tests/preview fixtures, lat documentation and plans. Keep runtime fixes separate from migration artifacts. Reuse shared access guards without changing the ownership/security contract; clarify historical snapshot policy with its owner before any access behavior change.

Preserve the user's primary in-place track performance and logging flow. My session remains optional, but an existing composition must survive ordinary Customize/Add/Undo/logging. Keep exact source occurrence identity, including legacy provider snapshots and deliberate repeats. Do not regress rich scoring, stored units, historical editing, or direct logging without composition.

## Execution and proof

1. Reproduce substantive findings with failing focused endpoint/component/browser regressions before source fixes. Fetch or read saved PR comments from /private/tmp/session-ux-review-comments.json, validate each against source, and maintain a per-comment disposition. Do not treat every bot comment as a bug.

2. Fix composition preservation and Undo receipts. Existing personal composition is the editing baseline unless the user explicitly chooses replacement/start empty. Repeated Add/all and lost-response retries may not claim pre-existing IDs as new or Undo unrelated work. Capture pre-operation identity and maintain retry intent. Verify combinations across tracks/dates survive reopening Customize and save, repeat-add Undo retains prior work, and a real new insertion remains undoable.

3. Unify occurrence recognition in source actions and server append where needed. Recognize legacy provider provenance when occurrence metadata is absent, while preserving intentionally unscoped direct/library contexts. When the exact source occurrence is already planned, logging must use its personal session/item/revision and editing must find its actual result. Distinct dates/tracks and deliberate repeat attempts remain independent. Prove legacy recognition, exact planned-item scoring and no duplicate result/planned item with real DB plus component/browser tests.

4. Validate complete time input for primary scores and tiebreaks locally in personal normalization without changing global scoring behavior. Retain supported colon, decimal/period and raw seconds formats, capped zero reps, unit and round precision. Prove malformed prefixes reject before persistence and valid existing formats remain accepted. Report GitNexus upstream blast radius before touching normalization. Put sourceDate-requires-track validation in input schemas if compatible with existing composition helpers, preserving friendly failures.

5. Fix valid destination/navigation/form-state cases. Clear or invalidate old session data on every destination change, including uncontrolled actions and changes after Retry. Preserve same-context data on a failed refresh. Rapid separate library additions must serialize or safely refresh/retry stale revisions without losing intent or overwriting composition. Browser Back restores absent/default track/date/team context. New workout/occurrence resets unit/tiebreak/attempt state; editing units preserves physical values or makes reinterpretation explicit. Preserve source occurrence in history with agreed historical access semantics. Repair fixture fidelity and portable preview outputs; reject false findings with evidence.

6. Run focused and integrated regressions, then one full app suite/runtime gate, non-skipped disposable MySQL tests and real component browser journeys for newly fixed cases, type checks, lint/build as appropriate, schema ownership and lat check. Avoid concurrent broad test/index jobs. Parent independently reruns criteria, reviews the complete diff and test assertions, then approves source/test commits and pushes to existing PR. Run GitNexus detect_changes before every commit. Executor skips plans/README.md edits; parent maintains it. No merge, deploy, migration or other owners' branch changes.

## Review disposition and limits

The initial review reports 20 Cubic and two Codex comments. Priority findings include composition replacement, Undo identity, malformed time tiebreak, included-item logging and legacy provenance. An actual normalizePersonalLibraryScore probe accepted 1:00abc as 60000, confirming that case.

A load workout may have an independent time tiebreak; the fixture complaint requiring matching schemes is false. Other low-priority comments require evidence, not automatic implementation. Keep an exact per-comment disposition and proof in the verification receipt. Stop and reconcile if a fix requires changing the shared ownership contract or canonical schema.
