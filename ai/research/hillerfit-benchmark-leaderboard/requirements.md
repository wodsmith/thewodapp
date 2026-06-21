# Benchmark Leaderboard Requirements

These requirements define the v1 benchmark leaderboard product and record assumptions that must not be re-decided during implementation.

## Fixed Assumptions

- Benchmark boards use a distinct `competitionType: "benchmark"` behind the competition-type capability registry.
- The current checkout already has a capability registry for `in-person` and `online`; v1 extends it with `benchmark` rather than creating a second registry.
- Benchmark boards declare `videoSubmissions` and `perpetual`, and intentionally do not declare `submissionWindows`, `optInResultPublishing`, physical-venue, heat, check-in, volunteer, or organizer-entered-results capabilities.
- The first seed is derived from `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf`.
- The PDF is source data only. We are not building any HillerFit-branded page, route, tab, product navigation item, marketing surface, logo, call to action, theme treatment, or other customer-facing product area.
- The sex axis is a score variant, not a division. Athletes rank together in one Open division; `scores.benchmarkVariant` snapshots `user.gender` at submit time.
- v1 is best-to-date, not all-time history. The live `scores` row is kept monotonic with a keep-best-on-write guard; `score_attempts`, windows, and invalidation-restore are v2.
- v1 includes 55 scoring tests from the training guide. Weighted C2B, Open 16.2, and Open 18.4 are seeded as unavailable or deferred with `includedInScoring = false`.
- Benchmark results are public on valid submission. Moderation uses existing invalid verification status, not the per-event publish gate.

## Source Data Check

The local PDF is the source of truth for the first seed. Before completing M1:

- Extract the included tests, categories, units, and tier thresholds from `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf`.
- Record any extraction assumptions in the seed file or a companion receipt.
- Ask the owner if a threshold, unit, category, or deferred-test status is missing or ambiguous.

Do not create a HillerFit-branded landing page, route, navigation entry, stats page, marketing surface, or theme as a substitute for missing seed data. Source-data ambiguity must be resolved as data work or owner input.

## Branding Boundary

"HillerFit" is provenance for the local training PDF only. Engineers must not create customer-facing HillerFit pages, routes, tabs, navigation entries, stats pages, marketing surfaces, logos, calls to action, or theme treatments.

The implementation target is WODsmith's generic benchmark board. Any missing or ambiguous PDF value must be handled as source-data extraction work, a generic benchmark label, or an owner decision, not as a product fork.

## V1 User Requirements

- Athletes can join or submit to a published benchmark board when allowed by registration or guarded open-join rules.
- Athletes must have a Male/Female profile gender before submitting to a benchmark board.
- Athletes submit scores through the existing video-submission path; video requirement follows the battery `videoPolicy`.
- Submitted scores are encoded through existing score encoders and scored as absolute tiers: `0`, `0.5`, or `1..10`.
- A worse or equal retest does not overwrite an athlete's current best-to-date score.
- A changed retest resets stale verification state so old verified badges do not attach to new values.
- The public leaderboard ranks the unified Open division by Overall/100 and shows category scores, rating band, per-event tiers, and verification state.
- The public stats page shows Overall/100, category stat line, per-test grid, and visually distinct states for untested, attempted tier 0, unavailable configuration, pending, verified, adjusted, and invalid/excluded.

## V1 Non-Requirements

- No per-attempt history table.
- No 12-month or 24-month windows.
- No current-vs-best comparison.
- No generic tier-table authoring UI.
- No hybrid reps-or-time scoring.
- No team benchmark divisions.
- No Men/Women division split.
- No benchmark publish workflow that requires organizers to publish 55 event/division cells.
- No HillerFit-branded pages, routes, tabs, stats pages, marketing copy, logos, calls to action, visual theme, or product navigation.

## Definition Of Done

v1 is done when a seeded benchmark board can be created from the training PDF data, a qualified athlete can submit scores, worse retests are ignored, valid scores appear immediately on the public board, the unified leaderboard ranks by Overall/100, the stats page renders the category breakdown, no HillerFit-branded customer-facing surface has been introduced, and the focused automated/manual tests in `test-strategy.md` pass.

## Current Repository Baseline

As of M0a, `apps/wodsmith-start/src/lib/competitions/capabilities.ts` defines `competitionCan`, `leaderboardVariant`, selectability helpers, result-entry helpers, and registered entries for `in-person`, `online`, and `benchmark`. Benchmark declares `videoSubmissions` and `perpetual`, remains hidden from the generic create picker, and still requires M1 schema/seed work before real benchmark rows can exist.
