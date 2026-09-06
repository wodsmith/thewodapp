# Workout Import Integration

Workout import acceptance covers entitled creation in the personal library, writable programming tracks, and the logging flow. The implementation plans define proposed behavior; integration evidence must distinguish local checks from live validation.

## Review and commit boundary

An AI proposal is reviewed before an explicit entitled save. Server-owned session provenance and current destination access remain required after edits, reconnects, revocation and duplicate retries.

The integration acceptance matrix lives in `docs/plans/2026-09-05-workout-import-integration.md`, alongside the infrastructure and UX plans. [[architecture#Architecture#AI Agents]] describes the existing runtime; [[domain#Domain Model#Workouts]] defines workout scoring concepts.

## Evaluation sources

Thirty authored prescriptions cover precise scoring, ambiguous inputs, units, multiple parts and hostile instructions. A test-only renderer creates matching printed screenshots; labels require human review before launch evaluation.

The corpus is `apps/wodsmith-start/test/fixtures/workout-import/evaluation.json`. Generated images and manifests stay outside the repository. Printed-source checks do not establish handwriting robustness or live model quality, cost or latency.
