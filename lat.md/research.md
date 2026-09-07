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

## CrossFit Daily Import Proposal

The approved daily importer uses CrossFit's public workout JSON and a Cloudflare Workflow to publish dated programming into the existing production CrossFit.com track. The implementation is documented in [[crossfit-import]].

The proposal is `docs/plans/crossfit-daily-import.md`. Read-only inspection confirmed `ptrk_crossfit_dotcom`, 114 existing workouts, three active subscriptions, and deployed Workflows, Hyperdrive, and AI bindings. CrossFit's `/workout/YYYY/MM/DD` endpoint returns original Markdown and publication metadata; the short daily page alone contains only the initial page shell and metadata.

The design adds a unique provider/track/date import ledger with ordered scoreable items, explicit rest days, validated scoring conversion, and atomic publication. Literal 05:00 PST maps to 13:00 UTC; the proposal separately describes a daylight-saving-aware Pacific schedule. AI only assists ambiguous scoring conversion and cannot publish directly.

Existing [[domain#Domain Model#Programming]] track rows have sequence order rather than source dates. Rest days and multiple scoreable components need a dated track read model. Track publication does not automatically create gym sessions under [[training#Training#Session Model]], whose publication and ownership rules remain distinct.

## Track Reader and Daily Training Proposal

The approved track experience separates athlete following, gym-library access, and site administration, then projects published provider days into Training without creating gym sessions on read.

The handoff is `plans/001-track-experience.md`. It specifies a workout-first reader, an explicitly labeled Admin destination, eligible gym selection, calendar-safe dates, and provider provenance in personal library snapshots. The user approved personal following and separate gym-library actions on September 6, 2026.

Implementation is on `codex/track-experience`, pending release. The [[crossfit-import]] ledger supplies published source dates; [[training#Training#Session Model]] and [[training-personal]] preserve coach ownership, explicit personal composition, and rich scoring.

## Benchmark Competition Workout Directory

Benchmark competitions use a dense domain directory while every other competition type retains the existing workout-card presentation.

[[apps/wodsmith-start/src/components/benchmark-workout-directory.tsx#BenchmarkWorkoutDirectory]] groups top-level workouts by their persisted benchmark category, preserves benchmark category order and input order, filters by workout metadata, and links every row to its detail route. Desktop rail collapse persists locally; mobile uses a horizontal category strip.

[[apps/wodsmith-start/src/server-fns/athlete-score-fns.ts#getBenchmarkViewerScores]] reads the authenticated viewer's division-scoped scores in one batch. Missing sessions, ambiguous registrations, and missing scores return an empty map, so rows never expose another athlete's data.

[[apps/wodsmith-start/src/server-fns/competition-workouts-page-fns.ts#getPublicWorkoutsPageDataFn]] includes viewer scores only when either public benchmark route opts in and queries only rendered top-level workouts. Focused tests cover classification, ordering, filtering, batching, authentication, and division isolation.

Dense online score-submission panels reuse the same domain grouping through [[apps/wodsmith-start/src/components/compete/athlete-score-submission-panel.tsx#AthleteScoreSubmissionPanel]]. Lists with at least eight visible top-level workouts across multiple domains start category-collapsed, keep canonical domain and workout order, and show submitted/total progress per category. Parent events count their score-bearing children rather than the parent container.

## Benchmark Workout Directory Test

These tests lock the benchmark directory's category mapping, ordering, filtering, and result-label behavior.

### Category Mapping

This test verifies persisted benchmark category keys map to the same category labels used by benchmark scoring.

### Category Fallback

This test verifies workouts missing benchmark category data use the stable Uncategorized fallback.

### Category Ordering

This test verifies canonical benchmark category order and stable workout order within each category.

### Directory Filtering

This test verifies search covers workout names, domains, result formats, tags, and movements while preserving empty-query order.

### Result Labels

This test verifies result schemes use explicit directory labels.

## Benchmark Score Submission Group Test

These tests lock when score-panel grouping activates and how category progress treats score-bearing child events.

### Dense List Activation

This test verifies short or single-category score lists stay flat while dense multi-category benchmark lists use grouped progressive disclosure, counting child score rows toward density.

### Default Collapsed Interaction

This test verifies dense benchmark categories start collapsed, expose accessible progress in their controls, and reveal workout rows on demand, even when many score rows belong to a few parent events.

### Category Submission Progress

This test verifies category progress counts submitted score leaves, including child events, without counting their parent container.

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
