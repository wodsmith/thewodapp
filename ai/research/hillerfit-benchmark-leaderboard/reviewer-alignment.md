# Reviewer Alignment

This file records independent reviewer summaries and the final convergence check. It starts with the orchestrator's current contract and should be updated after independent review.

## Reviewer A Summary

Reviewer A found that the largest remaining gap was current-state drift: the guide framed M0a as a new registry deliverable, but this checkout already has `apps/wodsmith-start/src/lib/competitions/capabilities.ts` and tests for `in-person`/`online`, with `benchmark` intentionally failing closed. The implementation contract now says to extend the existing registry, add `benchmark` and `perpetual`, preserve current tests, and add benchmark characterization tests.

## Reviewer B Summary

Reviewer B independently described the same intended system: capability registry, benchmark schema/seed, `absolute_tier` scoring, category aggregation, keep-best-on-write submission, public Overall/100 leaderboard, and stats page. Their largest gap was that the guide referenced an implementation packet that did not exist in their fork; the packet now exists and is the implementation contract.

## Orchestrator Contract

Components:

- Competition-type capability registry.
- Benchmark schema and seed.
- Absolute-tier scoring and category aggregation.
- Benchmark submission wrapper on the existing video submission path.
- Existing leaderboard pipeline extended for benchmark context.
- Public stats route and benchmark-flavored leaderboard display.

Data model:

- Three v1 benchmark definition tables.
- Shared `trackWorkouts` benchmark binding columns.
- Shared `scores.benchmarkVariant` snapshot column.
- One Open division per benchmark competition.
- `score_attempts` deferred to v2.

Dependencies:

- M0a before benchmark write/read chokepoints.
- M1 seed/schema before algorithm integration tests.
- M2 algorithm before M3 keep-best-on-write.
- M3 submission before M4 public demo verification.
- First seed derived from `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf`.
- No HillerFit-branded pages or routes.

Definition of done:

- Seeded approved board, absolute-tier scoring, best-to-date submission semantics, public Overall/100 leaderboard, public stat line, focused tests, LAT updates, and manual smoke all pass.

## Convergence Result

The reviewers materially agree on components, data model, dependencies, and definition of done. The one substantive divergence risk was M0a current-state drift, now resolved by making the packet current-state-aware. The owner clarified that the build uses the training PDF as benchmark source data and does not include HillerFit-branded pages.
