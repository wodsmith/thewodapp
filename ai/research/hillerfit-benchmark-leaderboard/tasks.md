# Benchmark Leaderboard Tasks

Tasks are ordered by dependency. Each task must update LAT documentation when it changes architecture, behavior, or test specs, and must run `lat check`.

## M0a Capability Registry Extension And Chokepoints

Extend the existing registry and refactor only benchmark-critical chokepoints.

Acceptance criteria:

- Existing `competitionCan`, `leaderboardVariant`, create selectability helpers, result-entry helpers, and truth-table tests remain intact for `in-person` and `online`.
- Registry types are widened to include `benchmark` and the `perpetual` capability.
- Benchmark is not selectable in the generic create picker.
- Benchmark declares `videoSubmissions` and `perpetual`, but not `submissionWindows` or `optInResultPublishing`.
- Existing in-person and online behavior is unchanged at submission, window-status, leaderboard-variant, and publish-gate chokepoints.
- Benchmark-capable registry entry can be added without reintroducing literal online/in-person checks at those chokepoints.
- `scoringAlgorithm === "online"` branches remain untouched.

## M1 Schema And PDF-Derived Seed

Add benchmark type, benchmark tables, shared columns, validation schemas, and the training-PDF-derived seed.

Acceptance criteria:

- `competitionType: "benchmark"` is supported in TS and registry without SQL enum migration.
- `benchmark_batteries`, `benchmark_tests`, and `benchmark_tier_thresholds` are defined and exported.
- `trackWorkouts.benchmarkTestId`, `trackWorkouts.benchmarkCategory`, and `scores.benchmarkVariant` are migrated.
- Categories JSON validates on write, publish, and read; `testCount` is treated as a validated cache.
- Seed creates one Open division, individual-only tests, benchmark competition settings, included/deferred tests, and pre-encoded thresholds from `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf`.
- Seed or companion receipt records extraction assumptions and any intentionally deferred tests.
- No task creates HillerFit-branded pages, routes, marketing copy, logos, or theme treatments.

## M2 Absolute-Tier Scoring

Add the standard absolute-tier algorithm and category aggregation.

Acceptance criteria:

- `absolute_tier` scoring config requires `absoluteTier.batteryId`.
- `calculateEventPoints` accepts preloaded absolute-tier context and never queries thresholds inside the dispatch.
- `EventScoreInput.variant` is required by absolute-tier scoring and never defaults to male.
- Standard tests score `0`, `0.5`, and `1..10` by encoded thresholds and `getSortDirection(scheme, scoreType)`.
- Category scores and Overall/100 are weighted means with no second rescale.
- Half tiers survive scoring and formatting.
- Tier-histogram tiebreaker replaces field-relative countback for benchmark ties.

## M3 Submission And Retest

Implement benchmark write behavior around the existing video submission path.

Acceptance criteria:

- Benchmark submissions require profile gender and write `scores.benchmarkVariant`.
- Scores use the Open division `scalingLevelId`, not a sex/variant level.
- Keep-best-on-write prevents equal or worse retests from replacing the live score.
- Changed retests clear stale verification/review state.
- Guarded `isOpenJoin` is transactional, idempotent, published/visible only, waiver/profile gated, and rate-limited.
- Team benchmark submission is rejected or impossible because batteries are individual-only.

## M4 Leaderboard And Stats Demo

Expose the public benchmark board and per-athlete stat line.

Acceptance criteria:

- Leaderboard loads benchmark battery and thresholds once per request, not per event/score.
- Benchmark event results include tier and category.
- Valid benchmark scores are visible without organizer publish actions.
- Invalid scores remain excluded from public reads.
- Public leaderboard ranks one Open division by Overall/100 and displays rating band/category fields.
- Stats route renders Overall/100, category scores, per-test grid, and verification states.
- Benchmark-visible copy does not imply a normal online competition with submission windows.
- Benchmark-visible copy remains generic WODsmith benchmark language, not HillerFit-branded page copy.

## V2 Deferred Tasks

Do not implement these in v1 unless the decision sheet changes:

- `score_attempts`, `promoteBest`, invalidation-restore, and 12/24-month windows.
- Hybrid reps-or-time tests and `EventScoreInput.secondaryValue`.
- Weighted C2B accurate bodyweight handling.
- Generic tier-table authoring UI.
- Broad M0b capability cleanup outside benchmark chokepoints.
