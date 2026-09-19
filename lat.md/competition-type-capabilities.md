---
lat:
  require-code-mention: true
---
# Competition Type Capabilities

Competition type capabilities define product behavior for in-person, online, and benchmark competitions while unknown stored values fail closed.

## Registry Source of Truth

The registry maps every supported stored type to capabilities, leaderboard behavior, create selectability, and organizer-facing labels.

[[apps/wodsmith-start/src/lib/competitions/capabilities.ts#COMPETITION_TYPE_REGISTRY]] keeps `competitionType` as the stored discriminator and exposes [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#competitionCan]], [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#leaderboardVariant]], and [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#isSelectableType]] for later call-site refactors. In-person competitions retain heat scheduling, day-of check-in, physical venue, volunteer scheduling, and organizer-entered results. Online competitions retain video submissions, submission windows, opt-in result publishing, and the online leaderboard variant. Benchmark competitions retain video submissions and the online leaderboard visual variant, add `perpetual` and `benchmarkScoringTiers`, and intentionally skip submission windows and opt-in result publishing.

Both in-person and online also grant `cohosts`, `volunteerShifts`, and `publicVolunteerSignup`; benchmark boards exclude all three, so they have no co-host management, no volunteer shift scheduling, and no public "sign up to volunteer" flow — the volunteer roster stays available because organizers still invite volunteers directly. The organizer sidebar hides the Co-Hosts and Volunteer shifts links via [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#competitionCan]], and the co-hosts, volunteer-shifts, and public `/compete/$slug/volunteer` route loaders redirect to the competition overview when the capability is missing, matching the submission-windows and stats route-gate pattern. The registration sidebar gates its signup card and existing-role volunteer tools with the relevant capabilities. Both public signup mutations resolve the competition from `competitionTeamId` and reject unsupported types before signing waivers or creating or upgrading an account, so a direct call cannot bypass the route gate.

Server submission gates now consume the registry for API, server-function, route, and leaderboard paths: score-window checks use `submissionWindows`, while benchmark status checks use `perpetual` to stay open without seeded window rows. Video submission checks use `videoSubmissions`. The dedicated leaderboard refactor also routes the online table decision through `leaderboardVariant` and the hidden-until-published default through `optInResultPublishing`; [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] stayed minimal because GitNexus reports HIGH blast radius. Perpetual boards default to auto-published results (`settings.resultsAutoPublish`, default true) — organizers can flip the setting off to restore the manual per-division publish gate; see [[organizer-dashboard#Results Entry#Division Results Publish Gate]].

The registry also owns the public competition-page tab set: each type declares `publicTabs` and [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#publicCompetitionTabs]] resolves them (unknown types fall back to the default in-person/online set). In-person and online show Event Details, Workouts, Schedule, Leaderboard, and Announcements; benchmark drops Schedule and is the only type that adds Stats. [[apps/wodsmith-start/src/components/competition-tabs.tsx#CompetitionTabs]] renders from the registry via a `competitionType` prop instead of sniffing scoring settings. The `/schedule` and `/stats` route loaders enforce the same tab set: direct visits to a tab the type does not declare redirect to the competition overview, so benchmark boards never serve `/schedule` and non-benchmark competitions never serve `/stats`.

The `scoringAlgorithm === "online"` axis remains separate from `competitionType === "online"`. Capability checks must not replace scoring-algorithm branches. The one deliberate coupling: benchmark boards hard-code the ranking algorithm to `online`. The organizer scoring page passes `lockAlgorithmOnline` (keyed on `benchmarkScoringTiers`) so [[apps/wodsmith-start/src/components/compete/scoring-config-form.tsx#ScoringConfigForm]] normalizes stale input to the effective online config, hides the algorithm picker, renders the online preview, and emits only online config changes while keeping tiebreaker and DNF/DNS settings editable. Both save paths — [[apps/wodsmith-start/src/server-fns/competition-detail-fns.ts#updateCompetitionScoringConfigFn]] and the cohost [[apps/wodsmith-start/src/server-fns/cohost/cohost-competition-fns.ts#cohostUpdateScoringConfigFn]] — also force `online` (clearing `customTable`) server-side. The lock is enforced at read time too: [[apps/wodsmith-start/src/server/competition-leaderboard.ts#resolveLeaderboardScoringConfig]] forces the effective config to `online` for any competition granting `benchmarkScoringTiers`, so stale or legacy stored configs can never change how a benchmark board ranks.

## Public Discovery Split

Public discovery splits by type: the home index (`/`) lists only non-perpetual competitions, while `/benchmarks` is a dedicated index of perpetual benchmark boards.

The home route (`apps/wodsmith-start/src/routes/index.tsx`) filters its loader data with [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#competitionCan]] on the `perpetual` capability, so benchmark boards never appear among competitions. The `/benchmarks` route (`apps/wodsmith-start/src/routes/benchmarks.tsx`) keeps the same layout but drops status tabs and advanced filters: it shows every benchmark whose start date has passed (available boards), badging each as Live unless [[apps/wodsmith-start/src/lib/competitions/perpetual-dates.ts#perpetualSubmissionsClosed]] marks it Completed. [[apps/wodsmith-start/src/components/compete-nav.tsx#CompeteNav]] and the mobile nav link both indexes.

## Capability Truth Table Test

The truth-table test pins every capability and leaderboard variant for registered competition types while unknown values fail closed.

[[apps/wodsmith-start/test/lib/competitions/capabilities.test.ts]] verifies each capability for every registered type, confirms registry metadata matches type identity, and covers the unknown-type fallback. All three registered types — in-person, online, and benchmark — are registry-selectable, while [[competition-type-capabilities#Benchmark Rollout Gates]] applies the organizer rollout control. A benchmark created without tier setup renders its leaderboard without tier context until the organizer configures tiers.

Focused PR-2 server-function tests pin that in-person score saves pass the submission-window gate, online score saves still honor closed windows, and in-person video submissions still reject before writes. PR-3 adds [[apps/wodsmith-start/test/components/leaderboard-page-content.test.tsx]] coverage for standard versus online leaderboard table selection plus [[apps/wodsmith-start/test/server/competition-leaderboard-capability-gates.test.ts]] coverage for opt-in result publishing defaults, the leaderboard video-submission fetch gate, and the read-time online-algorithm force for benchmark boards. M4 adds [[apps/wodsmith-start/test/server/benchmark-leaderboard.test.ts]], [[apps/wodsmith-start/test/components/benchmark-stat-line.test.tsx]], [[apps/wodsmith-start/test/components/online-competition-leaderboard-table.test.tsx]], [[apps/wodsmith-start/test/components/competition-tabs.test.tsx]], [[apps/wodsmith-start/test/routes/compete/benchmark-stats-route.test.tsx]], and [[apps/wodsmith-start/test/components/benchmark-branding-boundary.test.ts]] coverage for benchmark context validation, generic stats rendering, leaderboard Overall/rating/category/tier/status rendering, stats-tab gating, direct stats-route fallback states, and the rule that HillerFit stays source-data provenance rather than customer-facing route/component copy. PR-4 adds [[apps/wodsmith-start/test/lib/competitions/scheduling-check-in-gates.test.ts]] coverage for the heat scheduling and day-of check-in gates used by the public schedule, judge rotations, check-in routes, and check-in server functions. PR-5 adds [[apps/wodsmith-start/test/lib/competitions/venue-volunteer-gates.test.ts]] and [[apps/wodsmith-start/test/components/competition-location-card.test.tsx]] coverage for physical venue display and volunteer schedule-tab gates.

### Current Type Matrix

This test verifies every registered competition type keeps its expected capability, leaderboard variant, and create-selectability behavior — including `cohosts`, `volunteerShifts`, and `publicVolunteerSignup`, which benchmark alone excludes.

### Registry Metadata Alignment

This test verifies registry keys, ids, labels, and capability sets stay aligned with the supported stored competition-type identities.

### Unknown Type Fallback

This test verifies unregistered competition types fail closed for capabilities, use the standard leaderboard variant, and stay unselectable.

## Public Volunteer Signup Mutation Gate

Public volunteer applications fail closed at the write boundary when the competition type lacks `publicVolunteerSignup`.

Both authenticated and account-creating signup mutations resolve the competition team before any application, waiver, or account write. This prevents direct server-function calls and stale clients from bypassing the public route capability gate.

## Create Picker Selectability Test

The create-picker test pins that selectable competition type options are derived from registry selectability before organizer entitlements narrow the available options.

[[apps/wodsmith-start/test/lib/competitions/capabilities.test.ts]] verifies [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#selectableCompetitionTypes]] returns the in-person, online, and benchmark type definitions, with each entry passing [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#isSelectableType]] and [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#isSelectableCompetitionTypeValue]]. [[apps/wodsmith-start/src/lib/competitions/capabilities.ts#selectableCompetitionTypeOptions]] provides the registry-backed label and description text that the generic organizer create form renders, while the form and server schemas use the same selectable-value guard.

### Create Form Benchmark Option

This test verifies the organizer create form keeps standard competition types available when Benchmark access is not granted.

## Benchmark Rollout Gates

Benchmark organizer rollout uses a team entitlement, while public benchmark discovery is available to everyone.

[[apps/wodsmith-start/src/server/benchmark-creation-access.ts#assertBenchmarkCreationAccess]] requires the organizing team to have the `create_benchmarks` feature before [[apps/wodsmith-start/src/server-fns/competition-fns.ts#createCompetitionFn]] creates a benchmark competition. Create and update mutations first require an authenticated site admin or a member with `MANAGE_COMPETITIONS`; changing an existing competition to benchmark repeats the entitlement check, and denied creation returns the typed `FORBIDDEN` application error. [[apps/wodsmith-start/src/server-fns/team-fns.ts#getOrganizerTeamsFn]] exposes that entitlement to the create form so Benchmark is offered only for eligible teams. The feature catalog remains manageable through the generic admin entitlement page.

The public Benchmarks link is independent of organizer entitlement. [[apps/wodsmith-start/src/components/compete-nav.tsx#CompeteNav]] and [[apps/wodsmith-start/src/components/compete-mobile-nav.tsx#CompeteMobileNav]] always link to `/benchmarks` for authenticated and anonymous visitors.

### Server Creation Entitlement

This test verifies benchmark creation fails without `create_benchmarks`, succeeds with it, and leaves other competition types unaffected.

### Entitled Create Picker

This test verifies the organizer create picker exposes Benchmark when the selected team has the creation entitlement.

### Seeded Demo Organizer Entitlement

This test verifies the seed catalogs `create_benchmarks` and grants it to the CrossFit Box One organizer team owned by `admin@example.com`.

### Always-visible Navigation

This test verifies desktop and mobile Benchmarks navigation is always visible without a client-side feature flag.

### Hydration-Stable Navigation Flag

This test verifies a persisted browser flag cannot change Benchmarks navigation markup until after React hydrates the server-rendered tree.

[[apps/wodsmith-start/test/lib/posthog/hooks-hydration.test.tsx]] renders the disabled SSR shape, enables the mocked persisted flag before `hydrateRoot`, and expects no recoverable hydration error while still showing the enabled link after effects run.

## Additive Tier Context

Benchmark tier data enriches the leaderboard and stats as display context; ranking always uses the online algorithm (forced at save and read time), not a mutually exclusive tier-scoring mode.

[[apps/wodsmith-start/src/server/benchmark-leaderboard.ts#loadBenchmarkLeaderboardContext]] loads the battery/threshold context for any competition granting `benchmarkScoringTiers`, returning no context for malformed global battery/category data while retaining valid per-test context when another test is unmapped or its event is still draft. [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] computes per-event display tiers straight from the threshold tables via [[apps/wodsmith-start/src/lib/scoring/algorithms/absolute-tier.ts#calculateAbsoluteTier]], aggregates category scores, the overall score on the battery's configured `scoreMax` scale, and rating for entries that have tiered scores, and leaves `totalPoints` to the ranking algorithm. It carries `benchmarkScoreMax` with each entry so compact and table views render the configured denominator and normalize progress against the same scale. [[apps/wodsmith-start/src/components/online-competition-leaderboard-table.tsx#OnlineCompetitionLeaderboardTable]] shows benchmark columns whenever entries carry tier data rather than keying on the algorithm, and [[apps/wodsmith-start/src/routes/compete/$slug/stats.tsx#BenchmarkStatsPage]] gates on the `benchmarkScoringTiers` capability. The organizer tiers page has no "activate tier scoring" action; the legacy `absolute_tier` ranking algorithm and its one-way online migration were removed once no competition used them.

## Benchmark Category Grouping

Benchmark leaderboards group event columns under their battery category (like parent/sub-event grouping) and add category and gender filters — all gated on benchmark data so regular boards are unchanged.

[[apps/wodsmith-start/src/components/online-competition-leaderboard-table.tsx#OnlineCompetitionLeaderboardTable]] generalizes the parent-event header-group row: [[apps/wodsmith-start/src/components/online-competition-leaderboard-table.tsx#getEventGroupId]] groups by parent event first, then by `benchmarkCategoryKey`, so benchmark tests cluster under category headers on desktop and mobile. The group label is sticky within the table's horizontal scrollport, so the current category stays visible while scrolling through a wide group, and adjacent groups get alternating column tints so the group boundary is visible in the body rows. [[apps/wodsmith-start/src/components/leaderboard-page-content.tsx#LeaderboardPageContent]] derives the category list from event results, exposes a URL-backed `category` filter (shown only when categories exist) that narrows the event columns and the View selector, and a `gender` filter driven by `benchmarkGender` — a profile-gender snapshot [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] populates only when a benchmark context loads, so gender never leaks onto non-benchmark boards. All three leaderboard routes (public, organizer preview, cohost preview) accept the `category` and `gender` search params.

### Category Group Headers

This test verifies benchmark event columns render under category header groups on the online leaderboard table.

### Category and Gender Filters

This test verifies the category and gender filter selects appear only when leaderboard entries carry benchmark category and gender data.

## Perpetual End Dates

Benchmark competitions require only a start date; the end date is optional so the leaderboard can live on forever. The NOT NULL `endDate` column stores `endDate === startDate` as the "no end date set" sentinel.

[[apps/wodsmith-start/src/lib/competitions/perpetual-dates.ts#isOpenEnded]] detects the sentinel and [[apps/wodsmith-start/src/lib/competitions/perpetual-dates.ts#perpetualSubmissionsClosed]] reports when an explicit end date has passed in the competition's configured timezone. The organizer create and edit forms hide the multi-day toggle for perpetual types and offer an optional end-date field (blank ⇒ sentinel). Dedicated benchmark submission gates close submissions once a set end date passes, while generic direct score/video APIs reject benchmark writes before applying their event-window rules and the leaderboard stays visible forever. Date displays (competition card, hero, registration sections, SportsEvent JSON-LD) show "Since {start}" only for open-ended boards and a normal date range when an end date is set.

## Perpetual End Date Tests

Tests pinning the open-ended sentinel, submission closing after a set end date, and the window-status API behavior for ended benchmarks.

### Open-Ended Sentinel Test

Verifies `isOpenEnded` returns true only for perpetual types whose end date equals the start date; single-day in-person competitions are not open-ended.

### Ended Benchmark Closes Submissions Test

Verifies `perpetualSubmissionsClosed` is false for open-ended boards and future end dates, true once a set end date passes, and always false for non-perpetual types.

### Window Status Ended Benchmark Test

Verifies the score window-status API reports closed with a reason for a benchmark whose explicit end date has passed.

## Perpetual Window Status Test

The window-status test pins benchmark as open without submission-window rows while online competitions still require configured rows.

[[apps/wodsmith-start/test/routes/api/compete/scores/window-status.test.ts]] verifies the score window-status API returns open/null-window metadata for benchmark because it has `perpetual`, while online stays closed when no submission-window row exists.

## Perpetual Submission Gate Test

The submission-gate tests pin benchmark submissions as perpetual while preventing unsafe direct API bypasses.

[[apps/wodsmith-start/test/server-fns/benchmark-submission-m3.test.ts]] verifies the benchmark `submitVideoFn` path accepts writes without seeded submission-window rows while applying profile-variant, Open-division, evidence-policy, best-retention rules, and the requirement that athletes register before scoring. [[apps/wodsmith-start/test/routes/api/compete/submission-gates.test.ts]] verifies the legacy direct score and video API submit routes reject benchmark-backed competitions so they cannot bypass the shared benchmark write helper. [[apps/wodsmith-start/test/components/video-submission-form.test.tsx]] verifies the generic event-detail submission form keeps the registration-required state for unregistered athletes.

Open benchmark joins use a shared KV-backed rate-limit bucket in production, with the process-local map retained only as a test/local fallback. Rejoining restores a previously removed registration to active status instead of leaving the athlete unable to submit.

### Rejects Generic Athlete Benchmark Scores

The generic athlete score mutation rejects benchmark competitions so writes cannot bypass tier, evidence, and best-retention rules in the dedicated benchmark flow.

## Benchmark Editor and Stat Presentation Tests

These component tests pin the organizer settings workflow and athlete-facing score presentation to the benchmark configuration contract.

### Uses Customer-Facing Benchmark Copy

The settings editor labels the feature as a benchmark and never exposes the internal battery term.

### Requires a Settings Change

The save action stays disabled until the organizer changes a settings field.

### Warns Before Tier Reduction

Reducing the tier count warns that thresholds above the new maximum will be removed.

### Submits Normalized Settings

Saving parses numeric fields and trims optional descriptive text before invoking the mutation.

### Surfaces Save Failures

Rejected settings saves surface their error message through the page toast.

### Renders the Configurable Score Scale

The compact benchmark stat line renders the entry's configured score denominator instead of assuming 100.

### Keeps Deferred Tests Read-Only

Deferred tests remain visible but cannot open the athlete submission editor.

## Video Submission Route Gates Test

The route-gate test pins public athlete and review submission routes to the `videoSubmissions` capability instead of literal online checks.

[[apps/wodsmith-start/test/routes/compete/video-submission-route-gates.test.ts]] verifies the public overview, workout detail, organizer, cohost, and volunteer review submission routes do not reintroduce literal `competitionType === "online"` gates.

## Scheduling and Check-In Gates Test

These tests pin capability helpers that route public schedules, heat scheduling, and day-of check-in without direct type checks.

### Public Schedule Mode

This test verifies in-person public schedules use heats while online schedules use submission-window data.

### Heat Scheduling Gate

This test verifies heat scheduling remains available only for in-person competitions.

### Day-Of Check-In Gate

This test verifies day-of check-in remains available only for in-person competitions.

### Check-In Permission Gate

This test verifies check-in surfacing also requires organizer or volunteer access.

### Unknown Type Scheduling Fallback

This test verifies unregistered competition types expose no schedule or check-in capabilities.

## Venue and Volunteer Gates Test

These tests pin the capability helpers that control physical venue display and volunteer scheduling tabs.

### Physical Venue Display

This test verifies physical venue display remains available only for in-person competitions.

### Edit Form Physical Venue Gate

This test verifies stored benchmark competitions show their current type while avoiding generic type or venue updates.

### Volunteer Scheduling Availability

This test verifies volunteer scheduling remains available only for in-person competitions.

### Volunteer Schedule Tab Fallback

This test verifies unavailable schedule tabs fall back to roster while non-schedule volunteer tabs remain reachable.

### Unknown Type Venue Volunteer Fallback

This test verifies unregistered competition types expose no venue or volunteer scheduling capabilities.

## Results Entry and Sidebar Gates Test

PR-6 tests pin that result-entry labels and sidebar tabs come from capabilities rather than direct competition-type checks.

[[apps/wodsmith-start/test/lib/competitions/capabilities.test.ts]] covers the result-entry mode and Results/Submissions label helper. [[apps/wodsmith-start/test/components/competition-sidebar-capability-gates.test.ts]] covers organizer and cohost sidebar labels plus capability-gated schedule, check-in, venue, and submission-window tabs while preserving online Volunteers links for non-scheduling volunteer workflows; it also pins that benchmark hides the Co-Hosts and Volunteer shifts links while keeping the Volunteer roster and Registration questions. [[apps/wodsmith-start/test/routes/compete/results-route-capability-branching.test.ts]] covers the organizer and cohost results route branch selectors for organizer-entered versus athlete-submitted modes. [[apps/wodsmith-start/test/components/registration-sidebar.test.tsx]] pins the public volunteer-signup card to the `publicVolunteerSignup` capability, and [[apps/wodsmith-start/test/components/scoring-config-form.test.tsx]] pins the locked-online scoring form for benchmark boards (hidden algorithm picker, editable tiebreakers, online points preview).

The legacy Crew surface treats benchmark as a fail-closed type: it omits venue, heat, judge, check-in, and results navigation, and its score-write gate rejects benchmark competitions. Benchmark results remain available through the capability-aware wodsmith-start organizer and cohost routes.

### Registry Results Mode Labels

This test verifies result-entry mode and Results/Submissions labels are derived from the organizer-entered-results capability.

### Organizer Results Route Mode

This test verifies organizer results routes select organizer-entered or athlete-submitted modes through capability helpers.

### Cohost Results Route Mode

This test verifies cohost results routes select organizer-entered or athlete-submitted modes through capability helpers.

### Crew Benchmark Score Gate

This test verifies the legacy Crew score-write path rejects benchmark competitions.
