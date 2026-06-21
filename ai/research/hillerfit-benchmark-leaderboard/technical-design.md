# Benchmark Leaderboard Technical Design

This design defines the components and contracts engineers should build for v1.

## Components

- Capability registry: existing `lib/competitions/capabilities.ts` owns competition-type feature flags and `leaderboardVariant`; benchmark work widens this current registry with a `benchmark` entry and `perpetual` capability.
- Benchmark schema: `db/schemas/benchmarks.ts` owns battery, test, and threshold definition tables.
- Existing competition shell: `competitions`, `programmingTracks`, `trackWorkouts`, `workouts`, `scalingGroups`, `scalingLevels`, `scores`, and `video_submissions` are reused.
- Absolute-tier scoring: `lib/scoring/algorithms/absolute-tier.ts` computes a tier from encoded score, status, score type, and variant threshold table.
- Category aggregation: `lib/scoring/category-aggregation.ts` derives category scores and Overall/100 from per-event tiers.
- Submission wrapper: benchmark-specific write logic around `submitVideoFn` snapshots variant, writes Open division, applies keep-best-on-write, and resets stale verification.
- Leaderboard integration: `server/competition-leaderboard.ts` loads benchmark context once, supplies `EventScoreInput.variant`, skips publish gating, preserves half tiers, ranks by Overall/100, and exposes benchmark fields.
- Stats route: `/compete/$slug/stats` reuses leaderboard data to render a per-athlete stat line.
- Seed module: a training-PDF-derived benchmark seed creates the benchmark battery, tests, thresholds, Open division, workouts, and benchmark competition. The source artifact is `/Users/zacjones/Downloads/HillerFit_Training_Guide.pdf`; it feeds data, not branded pages or routes.

## Data Model

### New Tables

- `benchmark_batteries`: battery metadata, owner, slug, categories JSON payload, rating bands JSON payload, `maxTier`, `scoreMax`, `videoPolicy`, `isOpenJoin`, `variantScalingGroupId`, `competitionId`, status, and non-null `ownerKey` for global slug uniqueness. The current MySQL schema stores these JSON payloads in text columns; every write/read/publish path must parse and validate them fail-closed.
- `benchmark_tests`: one test per battery test, with category key, name, position, workout scheme, score type, input unit, `includedInScoring`, optional time cap, and nullable v2 hybrid metadata.
- `benchmark_tier_thresholds`: one pre-encoded threshold per `(test, variant, tier)`, with raw display value preserved.

### Shared Table Changes

- `trackWorkouts.benchmarkTestId`: links the competition event to a benchmark test.
- `trackWorkouts.benchmarkCategory`: copies category for hot leaderboard aggregation.
- `scores.benchmarkVariant`: snapshots the scoring variant at submit time, normally `male` or `female`.

### Deferred Table

- `score_attempts` is v2 only. Do not add it to v1 migrations or v1 code paths.

## Core Dependencies

- M0a registry extension must land before benchmark submission and leaderboard chokepoints. The base registry already exists for current competition types.
- M1a schema primitives must land before M1b can seed benchmark rows.
- M1b PDF-derived seed and extraction receipt must land before M2 integration tests can use real benchmark rows.
- M2 absolute-tier algorithm must land before M3 can implement keep-best-on-write correctly.
- M3 submission must land before M4 can verify real leaderboard and stats flows.
- M1b seed data depends on extracting tests/thresholds from the local training PDF and recording extraction assumptions.
- The first seeded battery uses `videoPolicy: "never"` and `isOpenJoin: true` as seed defaults; the later M3 write path is responsible for published/visible, profile, waiver, idempotency, and rate-limit guards before open-join submissions.

## Read Flow

1. `getCompetitionLeaderboard` loads competition settings and detects `algorithm === "absolute_tier"`.
2. It loads battery, categories, included-test counts, and all threshold tables once for the requested track workouts.
3. It fetches registrations and scores as today, including `scores.benchmarkVariant`.
4. For each event group, it creates `EventScoreInput` with `variant` from `scores.benchmarkVariant`.
5. `calculateEventPoints` dispatches to `absolute_tier` with preloaded `ctx`.
6. Event results carry `tier` and `benchmarkCategory`.
7. Category aggregation computes category scores and Overall/100 before final ranking.
8. Ranking feeds Overall/100 into tiebreakers and uses a benchmark tier-histogram tiebreaker.

## Write Flow

1. Submission requires a published/visible board, a valid registration or guarded open-join path, and profile gender.
2. The wrapper encodes the submitted score using the benchmark test scheme and score type.
3. The wrapper computes the candidate tier using the same absolute-tier helper as the read path.
4. It loads the existing live score for `(event, user, Open division)`.
5. It writes only if the candidate beats the stored tier and raw score according to the test direction; equal or worse retests leave the live row unchanged.
6. If the written value differs from a previously verified value, score verification and video review state reset to pending/null.
7. The score row stores `scalingLevelId = Open division` and `benchmarkVariant = user.gender`.

## Failure Behavior

- Missing or invalid profile gender blocks submission before scoring.
- Missing `absoluteTier.batteryId` fails schema validation.
- Missing categories JSON, stale test counts, missing thresholds, or missing variant tables fail closed with a typed configuration error.
- Configuration-unavailable cells are rendered separately from athlete tier 0 attempts.
- DB `dq` maps to engine `dnf` and scores tier 0.
- Benchmark publish gating is disabled by capability omission; invalid scores remain excluded by existing verification filtering.
- Missing or ambiguous PDF source data blocks the seed value for that row/test until the owner decides; it does not justify adding branded pages, product navigation, marketing copy, visual theme, or changing the generic product scope.

## Branding Boundary

Benchmark routes, tabs, product navigation, headings, empty states, and stats components use WODsmith's generic benchmark language. The PDF may influence seed data names, test labels, thresholds, categories, rating bands, and extraction receipts, but it must not introduce any HillerFit-branded page, route, tab, stats page, navigation entry, logo, marketing section, call to action, or visual theme.
