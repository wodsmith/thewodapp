# Research

Research notes capture external product, market, and workflow analysis that informs WODsmith product decisions and downloadable resources.

## Open Scorecard Downloadables

The Open scorecard downloadable research describes a two-page WODsmith score kit based on recent CrossFit Open scorecard patterns.

The source note is `docs/research/crossfit-open-scorecard-template.md`, and the refresh script is `scripts/research/crossfit-open-scorecards.mjs`. The script preserves decoded PDF URLs as published and skips failed workout pages so one unavailable page does not abort the matrix refresh.

## Organic Organizer Acquisition Plan

The organic organizer acquisition plan defines the one-year content, activation, and measurement path for earning a real non-referred competition organizer.

The source plan is `docs/plans/organic-organizer-acquisition-strategy.md`. It separates Sales Safari research, Ebomb production, and self-serve draft activation across a weekly execution cadence from May 30, 2026 through May 28, 2027.

## Benchmark Dense Display Prototypes

The benchmark display research compares three workout-section concepts for browsing 58 published tests by training domain without changing the public competition shell.

The runnable artifacts live in `docs/mockups/benchmark-density/`: Domain Rail uses grouped progressive disclosure, Benchmark Matrix uses aligned sortable rows, and Domain Board uses a compact seven-zone overview. All share a 58-name research snapshot captured from the live demo and responsive search/filter behavior; production reads database workouts instead.

The Domain Rail is now selected for production benchmark competitions; Benchmark Matrix and Domain Board remain comparison prototypes.

## Benchmark Competition Workout Directory

Benchmark competitions use a dense domain directory while every other competition type retains the existing workout-card presentation.

[[apps/wodsmith-start/src/components/benchmark-workout-directory.tsx#BenchmarkWorkoutDirectory]] groups all top-level workouts into stable domains, preserves input order, filters by workout metadata, and links every row to its workout detail route. Desktop rail collapse persists locally; mobile uses a horizontal domain strip.

[[apps/wodsmith-start/src/server-fns/athlete-score-fns.ts#getBenchmarkViewerScores]] reads the authenticated viewer's division-scoped scores in one batch. Missing sessions, ambiguous registrations, and missing scores return an empty map, so rows never expose another athlete's data.

[[apps/wodsmith-start/src/server-fns/competition-workouts-page-fns.ts#getPublicWorkoutsPageDataFn]] includes viewer scores only when either public benchmark route opts in and queries only rendered top-level workouts. Focused tests cover classification, ordering, filtering, batching, authentication, and division isolation.

## Benchmark Workout Directory Test

These tests lock the benchmark directory's classification, ordering, filtering, and result-label behavior.

### Domain Classification

This test verifies normalized workout metadata maps known benchmark signals to the expected domain.

### Domain Fallback

This test verifies unrecognized workouts use the stable Other benchmarks fallback.

### Domain Ordering

This test verifies canonical domain order and stable workout order within each group.

### Directory Filtering

This test verifies search covers workout names, domains, result formats, tags, and movements while preserving empty-query order.

### Result Labels

This test verifies result schemes use explicit directory labels.

## Benchmark Viewer Score Test

These tests lock authenticated, division-scoped benchmark score lookup and safe display formatting.

### Batched Score Mapping

This test verifies one division-scoped score query maps displayable viewer scores by track workout.

### Terminal Status Formatting

This test verifies terminal score statuses use canonical display labels.

### Unauthenticated Viewer

This test verifies unauthenticated requests return no score data without querying scores.

### Ambiguous Registration

This test verifies missing or ambiguous registrations cannot expose score data.

### Empty Score Map

This test verifies registered viewers without scores receive an empty map.

### Undisplayable Score Omission

This test verifies scored rows without a value are omitted.

## Public Workouts Viewer Score Test

These tests lock route-level viewer-score opt-in, top-level filtering, and the unchanged public default path.

### Opt-In Score Batch

This test verifies benchmark routes opt into a private top-level-workout score batch.

### Default Public Path

This test verifies existing callers avoid session work when viewer scores are not requested.
