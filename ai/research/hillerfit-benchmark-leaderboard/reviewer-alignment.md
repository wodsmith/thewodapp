# Reviewer Alignment

This file records independent reviewer summaries and the final convergence check for the current implementation packet.

## Reviewer A Summary

Reviewer A reviewed the server and data-model slice. They identified and then re-checked one blocking ambiguity: benchmark category denominators assume the seeded test/event mirror is complete, so the read path must fail closed when a benchmark test is missing a scorable event or when a test is mapped by duplicate events. The implementation now validates that one-to-one mapping in `server/benchmark-leaderboard.ts`, covers missing and duplicate mappings in `test/server/benchmark-leaderboard.test.ts`, and records the invariant in `technical-design.md`, `test-strategy.md`, `tasks.md`, and `lat.md/domain.md`.

Reviewer A now describes the server contract as coherent: generic benchmark battery data, one Open division, `scores.benchmarkVariant` snapshots, preloaded absolute-tier context, fail-closed mapping/category/threshold/variant validation, Overall/100 aggregation, benchmark tier-histogram ties, generic stats output, and no HillerFit-branded customer-facing surface.

## Reviewer B Summary

Reviewer B reviewed the UI, route, test, and branding slice. They identified and then re-checked the blocking gaps: the route tree had dropped the TanStack Start registration, the stats route collapsed load/configuration errors into the empty no-score state, tests did not yet pin all required stat states or the actual benchmark table rendering, and the docs needed a sharper no-branded-pages boundary. The implementation now preserves the route registration, renders an explicit stats load-error state, covers all required stats states, covers the actual `OnlineCompetitionLeaderboardTable` benchmark display, and explicitly states that the training PDF is source data only.

Reviewer B now describes the UI contract as coherent: `CompetitionTabs` exposes a generic Stats tab only for `absolute_tier`, `/compete/$slug/stats` renders generic benchmark stats or explicit fallback states, the leaderboard table shows Overall/100, rating, category, tier, and verification fields, and the branding boundary keeps HillerFit references out of customer-facing routes/components.

## Orchestrator Contract

Components:

- Competition-type capability registry with M0a already landed.
- Benchmark schema and training-PDF-derived seed.
- Absolute-tier scoring, category aggregation, and benchmark tier-histogram tiebreaks.
- Benchmark submission wrapper on the existing video-submission path.
- Existing leaderboard pipeline extended with a preloaded benchmark context.
- Generic benchmark leaderboard display, Stats tab, and per-athlete stat-line route.

Data model:

- `benchmark_batteries`, `benchmark_tests`, and `benchmark_tier_thresholds`.
- `trackWorkouts.benchmarkTestId` and `trackWorkouts.benchmarkCategory`, with exactly one scorable event per benchmark test.
- `scores.benchmarkVariant` as the score-time sex/variant snapshot.
- One Open division per benchmark competition.
- `score_attempts` deferred to v2.

Dependencies:

- M0a capability registry is present and benchmark is registered with `videoSubmissions` and `perpetual`.
- M1 schema/seed must provide complete category caches, test rows, one-to-one event mappings, and threshold rows.
- M2 absolute-tier scoring supplies the `0 / 0.5 / 1..10` tier semantics.
- M3 submission supplies profile-variant snapshots and best-to-date writes.
- The first seed derives source data from `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf`.
- No HillerFit-branded customer-facing pages, routes, stats pages, navigation, marketing copy, logos, calls to action, or theme treatments.

Definition of done:

- Seeded generic benchmark board, valid score submission, keep-best retest behavior, public Overall/100 leaderboard, generic stat line, invalid-score exclusion, branding boundary, focused automated tests, LAT updates, and manual smoke are satisfied.
- Current focused M4 tests, package type-check, and PR CI pass.
- `lat check` has no benchmark errors; current failures are existing Crew references outside this slice.

## Convergence Result

The two independent reviewers materially agree on components, data model, dependencies, branding boundary, and definition of done for M4. The remaining caveat is not a product fork: `lat check` is blocked by existing Crew references outside the benchmark artifacts.
