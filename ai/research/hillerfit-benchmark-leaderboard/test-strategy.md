# Benchmark Leaderboard Test Strategy

This strategy makes the implementation testable without requiring the full historical/windowed v2 feature set.

## Unit Tests

- Capability registry truth table for in-person, online, benchmark, and a separate unknown type fallback.
- Create-picker tests prove benchmark is registered but not selectable on create.
- Scoring config validation requires `absoluteTier.batteryId` only when `algorithm === "absolute_tier"`.
- Absolute-tier standard scoring covers tier 0, 0.5, 1, 10, DB `dq` mapped to engine `dnf`, and missing variant/table failures.
- Direction cases cover time hold with `scoreType: "max"`, run with `time` + `min`, points/watts with `points` + `max`, load, reps, feet/meters, and rounds-reps.
- Category aggregation proves all tiers 7 produces Overall 70, deferred tests are excluded from denominator, untested included tests count as 0, and weights are honored.
- Tier-histogram tiebreaker proves Tier 9 on a strong event beats Tier 7 on a weak event when Overall ties.
- Formatting preserves `0.5` and does not round benchmark points.

## Integration Tests

- Seed validation asserts every included test has 10 thresholds per variant and every included test has a matching tagged `trackWorkout`.
- Seed validation traces test names, categories, units, included/deferred status, and thresholds back to `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf` or a checked-in extraction receipt.
- Publish/read validation rejects malformed categories JSON, stale `testCount`, missing thresholds, missing variant tables, and team-sized batteries.
- Submission writes Open division `scalingLevelId` and `scores.benchmarkVariant`.
- Keep-best-on-write rejects worse/equal retests and accepts better retests.
- Changed retest clears stale `verificationStatus` and video review status.
- Benchmark leaderboard read loads thresholds in one prepass and does not query per event.
- Benchmark results are visible without `divisionResults` publish entries; invalid rows are excluded.
- Benchmark lacks submission-window capability, so window-status and submission paths do not require seeded window rows.

## Route And Component Tests

- Leaderboard chooses online visual variant for benchmark through `leaderboardVariant` while avoiding publish gating.
- Stats tab appears only for `absolute_tier` competitions.
- Stats page distinguishes untested, attempted tier 0, unavailable config, pending, verified, adjusted, and invalid/excluded states.
- Route/component/navigation assertions confirm benchmark pages use generic WODsmith benchmark language and do not introduce HillerFit-branded pages, routes, tabs, stats pages, product navigation entries, calls to action, logos, marketing sections, or theme treatments.
- Static/source review allows HillerFit references only in research docs, seed/provenance metadata, extraction receipts, and source-data tests; app routes/components/navigation must not use HillerFit as customer-facing copy.
- Benchmark event detail submission UI blocks missing gender and surfaces the profile-completion path.
- Open-join flow rejects unpublished/private boards and duplicate races collapse to one registration.

## Migration And Seed Checks

- Generated migration contains only the benchmark tables and the declared shared columns for v1.
- No `score_attempts` table appears in the v1 migration.
- `ownerKey` enforces global slug uniqueness where `teamId` is null.
- Threshold values are pre-encoded and fit signed int.

## Manual Verification

1. Create or seed the benchmark board.
2. Confirm it has one Open division and individual-only tests.
3. Submit a profile-complete athlete score that lands below tier 1 and verify `0.5` displays.
4. Submit a worse retest and confirm the current best remains unchanged.
5. Submit a better retest and confirm the board updates and review state resets.
6. Mark a score invalid and confirm public leaderboard/stat page excludes it.
7. Confirm the leaderboard shows Overall/100, category scores, rating band, verification state, and no publish-required empty board.
8. Confirm standard online and in-person competition smoke paths still behave as before for the refactored chokepoints.
9. Confirm no HillerFit-branded page, route, tab, stats page, product navigation entry, logo, marketing section, call to action, theme treatment, or customer-facing product area was added.

## Required Checks

- Focused tests for each touched slice.
- Type-check for touched app package.
- `lat check` after LAT updates.
