# Domain Model

WODsmith's domain centers on organizing and running functional fitness competitions, from registration through scoring and leaderboards.

## Teams

Teams are the primary organizational unit. Every user belongs to at least one team (their auto-created personal team).

Team types (`TEAM_TYPE_ENUM`):
- **gym** — An organizing entity (CrossFit box, fitness studio). Can create competitions and programming tracks.
- **competition_event** — Auto-created when a competition is made. Holds registered athletes as members. Has a `parentOrganizationId` linking to the organizing gym.
- **competition_team** — Athlete squads for team-division competitions (e.g., a team of 3 competing together).
- **personal** — Auto-created per user for personal workout logging.

### Team Roles and Permissions

Role-based access control via `teamMembershipTable` and `teamRolesTable`.

System roles: owner, admin, captain, member, guest, volunteer. Each role maps to a set of permissions defined in `TEAM_PERMISSIONS` (e.g., `MANAGE_COMPETITIONS`, `ACCESS_DASHBOARD`, `INVITE_MEMBERS`). Custom roles can be created per team.

## Competitions

A competition is a fitness event organized by a gym team, with divisions, workouts, heats, and scoring.

Key fields on `competitionsTable`:
- `organizingTeamId` — The gym that owns it
- `competitionTeamId` — The auto-created event team for athlete membership
- `slug` — Globally unique, used in public URLs (`/compete/{slug}`)
- `groupId` — Optional link to a `competitionGroupsTable` entry (series)
- Date/time fields stored as `YYYY-MM-DD` strings with an IANA `timezone`

### Competition Groups (Series)

Groups organize multiple competitions into a series (e.g., "2026 Throwdowns Series") with aggregate scoring.

Defined in `competitionGroupsTable`. Slugs are unique per organizing team, not globally.

### Competition Events

A competition contains one or more events, each linking a workout to the competition for scheduling and scoring.

Defined in `competitionEventsTable`. Each event references a `workoutId` and belongs to a `competitionId`. Events can have their own resources and judging sheets.

### Divisions

Divisions segment athletes within a competition (e.g., "RX Male", "Scaled Female", "Masters 40+").

Stored in competition `settings` JSON. Athletes register into a specific division. Division-specific registration fees can override the competition default.

### Heats

Heats are scheduled time blocks where groups of athletes perform a workout event together.

Defined in `competitionHeatsTable`. Each heat belongs to a `competitionEventId` and has a `heatNumber`, `startTime`, `lanes` count, and optional `division`/`venue` filters.

### Registrations

An athlete registers for a competition via `competitionRegistrationsTable`.

**Important**: This table uses `eventId` (not `competitionId`) to reference the competition — a historical naming that can be confusing. Registrations link a `userId` to a competition with a chosen `division`, payment status, and waiver acceptance.

### Venues

Physical locations for competition events, defined in `competitionVenuesTable`.

Each venue has a name, address, and capacity. Heats can be assigned to specific venues.

## Broadcasts

One-way messages from organizers to competition athletes, delivered in-app and via email.

Defined in [[apps/wodsmith-start/src/db/schemas/broadcasts.ts#competitionBroadcastsTable]] and [[apps/wodsmith-start/src/db/schemas/broadcasts.ts#competitionBroadcastRecipientsTable]]. Each broadcast targets a filtered audience via a JSON `audienceFilter`: all athletes, athletes by division, all volunteers, volunteers by role, or public (everyone). The audience can be further narrowed by registration question answers via an optional `questionFilters` array — multiple question filters are AND'd, with OR logic within each filter's values. Email delivery is handled asynchronously via Cloudflare Queue with Resend, using per-recipient idempotency keys to prevent duplicates on retry. Recipient delivery status tracks `queued`, `sent`, `failed`, or `skipped` (used when email is disabled or no API key is configured).

## Workouts

Workouts are the core content — descriptions of physical exercises with scoring rules.

### Workout Schemes

The `scheme` field determines how a workout is scored. Values from `WORKOUT_SCHEME_VALUES`:

- **time** / **time-with-cap** — Timed workouts (lower is better, with optional time cap)
- **rounds-reps** — AMRAP-style (higher is better)
- **reps** / **load** / **calories** / **meters** / **feet** / **points** — Single-metric scoring
- **pass-fail** — Binary completion
- **emom** — Every Minute On the Minute format

### Score Types

The `scoreType` field (`SCORE_TYPE_VALUES`) determines aggregation: min, max, sum, average, first, last.

### Movements

Exercises that make up workouts. Categorized as `weightlifting`, `gymnastic`, or `monostructural`.

Stored in the `movements` table with tags for filtering and search.

## Scoring

The unified scoring system stores competition results in `scoresTable`, replacing a legacy results + sets approach.

Key design:
- Scores encode values as integers for efficient DB-level sorting
- `competitionEventId` links to the competition event (NULL for personal logs)
- `scheme` and `scoreType` determine how the raw value is interpreted
- Tiebreak values stored separately for time-capped workouts
- Score rounds (`scoreRoundsTable`) store per-round breakdowns for multi-round workouts

### Time input parsing matches save semantics

Bare numeric input on a time score (no colon — e.g. `2000`) is treated as **raw seconds** in both the live preview and the save path, so the two can never disagree.

[[apps/wodsmith-start/src/lib/scoring/parse/time.ts#parseTime]] defers to [[apps/wodsmith-start/src/lib/scoring/encode/time.ts#encodeTime]] for any non-colon input. An earlier version smart-padded bare digits as MM:SS (`2000` → `20:00` in preview) while the save persisted `33:20`, which confused athletes typing on a phone. Colon-delimited input (`12:34`, `1:02:34.567`) is unchanged. Use `precision: "ms"` only when explicitly persisting raw milliseconds.

### Missing scores tie at worst place

Athletes registered in a division who never submitted a score for an event are awarded the same points as if they finished one place behind every recorded score in their division.

If a division has 5 recorded scores for an event, every athlete in that division without a score ties at place 6 and receives the algorithm-appropriate points for place 6 (e.g. 6 points under online scoring, `firstPlacePoints − 5×step` under traditional). [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] computes `missingPlace = activeCount + 1` per (event, division) pair and looks up the points via [[apps/wodsmith-start/src/lib/scoring/algorithms/index.ts#calculatePointsForPlace]], then pushes an `eventResult` with `formattedScore: "N/A"` and adds the points to `totalPoints`. Without this, missing-score totals would default to 0 and outrank scored athletes under "lowest total wins" algorithms like `online`. Divisions where no athlete has scored an event still fall through to the empty-results fallback (rank 0, 0 points, not added to totals).

Before bucketing scores by division, `getCompetitionLeaderboard` dedupes them to exactly one row per `(registrationId, competitionEventId)` pair. A single `userId` can own multiple rows for the same event — re-submissions sometimes land under a different `scalingLevelId` than the registration's `divisionId`, leaving stale duplicates. Without dedup, both rows would get ranked: `activeCount` inflates (say from 9 to 14), `missingPlace = activeCount + 1` inflates with it, and the per-submission rank sums double-count the submitting team's points. The net effect is that a team who never submitted ends up with a smaller `totalPoints` than teams who did submit — exactly the pathology the missing-score fallback is supposed to prevent. The dedup step prefers the row whose `scalingLevelId` matches the registration's `divisionId` and falls back to the first row seen.

### Multi-round time caps

For multi-round `time-with-cap` workouts, the cap is enforced **per round**, not against the summed total, and the summed total is preserved on the parent score rather than clamped to the cap.

On video submissions, [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#submitVideoFn]] compares each round's encoded time to `workout.timeCap * 1000`. Any round whose value meets or exceeds the cap is persisted with `scoreRoundsTable.status = "cap"`, and the parent `scoresTable.status` is set to `"cap"` whenever at least one round is capped. The parent `scoreValue` is the aggregation of rounds per the workout's `scoreType` (`sum` for "R1 + R2 = total" partner workouts; `min` for best-of). Under the "missed reps add seconds" convention a capped round's encoded value already includes its penalty, so the sum is meaningful. Single-round `time-with-cap` still clamps to the cap and records reps-at-cap in `secondaryValue`.

Scores saved before this fix have `scoreValue` clamped to the cap even though rounds were persisted correctly. [[apps/wodsmith-start/src/server-fns/competition-score-fns.ts#backfillMultiRoundCapScoresFn]] rescans a competition, re-aggregates parent `scoreValue` from rounds using the workout's `scoreType`, and recomputes per-round status, parent status, and `sortKey`. Supports a `dryRun` flag to preview changes before writing.

On leaderboards and anywhere else scores flow through [[apps/wodsmith-start/src/lib/scoring/format/score.ts#formatScore]], a multi-round capped score renders as `CAP (MM:SS)` using the summed total from `score.value`. Single-round capped scores still render as `CAP (N reps)` because they carry `timeCap.secondaryValue`. Sort order is unaffected — capped scores always sort below fully scored entries via `STATUS_ORDER`, regardless of how large the summed total is, so a 50:00 fully-scored run still outranks a 41:00 capped run.

The public leaderboard also surfaces *how many* individual rounds were capped so viewers can distinguish "capped one round of two" from "capped every round". [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] fetches `scoreRoundsTable` for every score on the page via `fetchRoundCapSummaries` and attaches `{cappedRoundCount, totalRoundCount}` to each event result. The `CappedRoundsIndicator` component in [[apps/wodsmith-start/src/components/competition-leaderboard-table.tsx]] and [[apps/wodsmith-start/src/components/online-competition-leaderboard-table.tsx]] renders an amber `N/M CAP` badge next to `formattedScore` whenever `cappedRoundCount > 0 && totalRoundCount > 1`. Single-round scores and fully-clean multi-round scores render with no badge.

Within the "cap" status bucket, sorting prioritizes *how many rounds were capped* before total time. A score with 1 capped round of 2 always ranks ahead of a score with 2 capped rounds of 2, even if the 2/2-capped score has a faster summed total. [[apps/wodsmith-start/src/lib/scoring/sort/sort-key.ts#computeSortKey]] bit-packs `cappedRoundCount` into the top 8 bits of the 40-bit primary segment (with the low 32 bits holding the ms total, which covers ~49 days) so the database sort order naturally honors this; [[apps/wodsmith-start/src/lib/scoring/sort/compare.ts#compareScores]] mirrors the same rule for in-memory sorts via `sortScores`. To avoid relying on a stale persisted `sortKey` (stored keys are only refreshed when a score flows through `computeSortKey`, so direct DB edits or pre-fix writes leave it wrong), `getCompetitionLeaderboard` recomputes the sort key in-memory for every score it displays using the freshly-fetched round summary — no backfill required for the UI to reflect the correct order.

All write paths that touch multi-round `time-with-cap` scores now thread `cappedRoundCount` through `computeSortKey` so persisted keys match the in-flight ordering. The athlete-facing [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#submitVideoFn]], the organizer-facing [[apps/wodsmith-start/src/server-fns/competition-score-fns.ts#saveCompetitionScoreFn]], the judge API at [[apps/wodsmith-start/src/routes/api/compete/scores/judge.ts]], and the repair path in [[apps/wodsmith-start/src/server-fns/competition-score-fns.ts#backfillMultiRoundCapScoresFn]] each derive per-round cap status from `encodedRounds` and `workout.timeCap * 1000`, persist the per-round `status` on `scoreRoundsTable`, and pass `cappedRoundCount` to `computeSortKey`. The backfill additionally treats a stale `sortKey` as a standalone reason to rewrite a row so legacy scores written before this tiebreaker existed get repaired on the next backfill run. Single-field submission paths (`/api/compete/scores/submit`, `/api/compete/video/submit`, `athlete-score-fns`, demo data generation) only ever write a single aggregate value and intentionally omit the per-round logic.

The organizer review page at [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId.tsx]] can apply a penalty to a selected subset of rounds on a multi-round submission. The penalty form renders a checkbox + before/after line per round (all rounds checked by default) and, on submit, scales each selected round's encoded value through `calculatePenaltyScore` with a forced `"scored"` status (per-round time values always grow under a penalty, even if the round hit the cap — the parent `"cap"` status is irrelevant at the round level). The resulting round values are decoded to display strings and sent as `adjustedRoundScores[]` alongside `penaltyType`/`penaltyPercentage` via `verifySubmissionScoreFn`, so the server re-derives per-round status, parent aggregate, `cappedRoundCount`, and `sortKey` just like a round-level adjust. The single-value "reps-at-cap" preview and the direct-override textbox are only shown for single-round submissions, where `secondaryValue` actually carries the penalizable reps count.

## Volunteers

Volunteers are competition staff assigned roles like judge, scorekeeper, medical, and emcee.

Defined by `VOLUNTEER_ROLE_TYPES`. Volunteers register for shifts and get assigned to heats. Judge rotations (`competitionJudgeRotationsTable`) control how judges move between lanes across heats, with lane shift patterns (stay, shift right, random).

## Programming

Programming tracks organize workouts into scheduled sequences for gym members.

Tracks (`programmingTracksTable`) can be self-programmed, team-owned, or official third-party. Track workouts (`trackWorkoutsTable`) schedule specific workouts on specific dates within a track. Tracks can optionally be linked to a competition.

## Scaling

Scaling groups define difficulty levels for workouts (e.g., RX, Scaled, Foundations).

Each scaling group contains ordered scaling levels. Workouts and scores can reference a scaling level to indicate the difficulty at which they were performed.

## Waivers

Legal documents that athletes must sign before competing.

Organizers create waiver templates per competition. Athletes sign waivers during registration. Signature and acceptance timestamps are recorded.

## Video Submissions

Athletes can submit video evidence of their workout performance for remote judging.

Submissions link to a score and include a video URL (e.g., Vimeo). A valid score is **required** — both [[apps/wodsmith-start/src/components/compete/video-submission-form.tsx#VideoSubmissionForm]] and [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#submitVideoFn]] reject submissions without a score to prevent athletes from entering scores in the notes field instead. The server-side check is gated on `videoIndex === 0` so that a team captain submitting multiple teammate videos in one form action — where the score is intentionally only sent with the first slot — is not rejected on subsequent slots. Judges can verify or reject submissions. Community voting is supported via `videoVotesTable`. Event ownership validation in [[apps/wodsmith-start/src/server-fns/submission-verification-fns.ts]] uses `verifyEventBelongsToCompetition` which checks `competition_events` first, then falls back to `track_workouts` → `programming_tracks` for sub-events without submission windows.

### Supported Video Platforms

YouTube, Vimeo, WodProof, and WeTime URLs are validated and parsed by [[apps/wodsmith-start/src/schemas/video-url.ts#parseVideoUrl]].

YouTube and Vimeo use iframe embeds with their JS player APIs, which drive the review UI's seek-to-note and timestamp-capture features. WodProof cloud URLs (`wodproofapp.com/cloud/?v=ID`) are resolved to direct S3 MP4 URLs via [[apps/wodsmith-start/src/schemas/video-url.ts#getWodProofVideoUrl]] and rendered with a native `<video>` element in both the athlete-facing [[apps/wodsmith-start/src/components/video-embed.tsx#VideoEmbed]] and the interactive [[apps/wodsmith-start/src/components/compete/video-player-embed.tsx#VideoPlayerEmbed]] components. WeTime share links (`wetime.io/preview/ID`) don't expose a direct media URL from the share token, so [[apps/wodsmith-start/src/server-fns/wetime-resolve-fns.ts#resolveWeTimeVideoUrlFn]] fetches the preview HTML on the server, extracts the `<source>` CloudFront MP4, and both embed components play it in a native `<video>` (the iframe-the-whole-page approach was rejected because WeTime's preview page wraps the video in heavy chrome, breaking the 16:9 layout). Because the result is a native video element, WeTime inherits full interactive-playback support (seek, `getCurrentTime`) for reviewer timestamp capture.

### Multi-Division Submission

Athletes registered in multiple divisions see a division picker on the submission form. Single-division athletes see a static badge.

Switching divisions fetches that division's submission data via [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getVideoSubmissionFn]] with the `divisionId` parameter. Scores and video submissions are scoped per-division so each registration gets its own submission state. The picker lives in [[apps/wodsmith-start/src/components/compete/video-submission-form.tsx#VideoSubmissionForm]]. When event-division mappings are configured, the division picker is filtered to only show divisions mapped to the current event — the route computes `filteredRegisteredDivisions` using the same mapping logic as the division tabs. The route loader uses `loaderDeps` to pass the URL `?division=` search param into the loader, so the initial submission data is fetched for the URL-selected division rather than always defaulting to the first registered division. The loader also constrains the initial division to the event-mapped set (not just athlete-registered divisions), preventing fetches for unmapped divisions that would produce mismatched form state. This ensures team divisions (teamSize > 1) initialize the form with the correct number of video slots. The form accepts an `initialDivisionId` prop and syncs its internal state directly from the loader-provided `initialData` when the URL division changes — no redundant fetch is needed because the loader already re-runs via `loaderDeps`.

### Sub-Event Submissions

Events with sub-events (parent/child hierarchy) show a separate submission form per child event on the parent workout page.

The loader in [[apps/wodsmith-start/src/routes/compete/$slug/workouts/$eventId.tsx#Route]] fetches video submissions for each child event in parallel via [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getVideoSubmissionFn]]. Each child renders its own [[apps/wodsmith-start/src/components/compete/video-submission-form.tsx#VideoSubmissionForm]] with the child's `trackWorkoutId`. Team divisions get the same multi-video slot behavior per sub-event. The parent event itself has no submission form when children exist — all scoring is per sub-event.

The [[apps/wodsmith-start/src/components/compete/athlete-score-submission-panel.tsx#AthleteScoreSubmissionPanel]] also respects this hierarchy. For parents with children, it renders a compact parent header with individual child rows beneath it. Submission data is fetched for child IDs (not the parent), and child rows link to the parent event page where per-sub-event forms live. The panel filters events by event-division mappings: if a parent is mapped to specific divisions and the selected division isn't included, the entire group (parent + children) is excluded. Children without explicit mappings inherit their parent's mapping visibility. On mobile the panel renders above the registration sidebar; on desktop it appears in the main content column.

The organizer-side [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/athletes/-components/video-submissions-section.tsx#VideoSubmissionsSection]] follows the same rule. Events are grouped by `parentTrackWorkoutId` (returned from [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#getOrganizerAthleteDetailFn]], sourced from `trackWorkoutsTable.parentEventId`): standalone events render a single card, while parents with children render a wrapper card whose header shows only the parent workout name and a "Scored per sub-event below" note — no score or video editor on the parent itself — with one nested card per child.

### Captain-Only Submission

For team divisions (teamSize > 1), only the team captain can submit videos and scores. Non-captain team members see a read-only view of the team's submissions.

Individual athletes (teamSize = 1) are always treated as their own captain. Both [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getAthleteDivisionSubmissionsFn]] and [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#submitVideoFn]] enforce this — the panel sets `canSubmit = false` for non-captains so they never see submit/edit actions.

Reviewers bypass the captain restriction through [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#updateSubmissionVideoUrlFn]] (see [[lat.md/domain#Domain Model#Video Submissions#Reviewer Video Link Editor]]): organizers and score-input volunteers can edit existing links and create new rows for unfilled slots, and the server still attributes those inserts to `registration.captainUserId` (falling back to `registration.userId` for solo) so the team's submissions stay grouped under a single athlete id for downstream queries like `getOrganizerSubmissionsFn`.

Organizers on the [[organizer-dashboard#Registrations (Athletes)#Athlete Detail Page]] also reuse [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#updateSubmissionVideoUrlFn]] (the same shared reviewer endpoint) to add or replace per-slot video URLs, and [[apps/wodsmith-start/src/server-fns/organizer-athlete-fns.ts#deleteOrganizerVideoSubmissionFn]] to remove a submission — cascade-deleting the linked score row when the deleted submission was the score owner (`videoIndex === 0`).

### Multiple Videos per Team

Team divisions allow up to `teamSize` video submissions per event, tracked via a `videoIndex` column on `videoSubmissionsTable`.

The unique constraint is `(registrationId, trackWorkoutId, videoIndex)`. Videos are optional — teams can submit fewer than `teamSize`. The score is submitted once per team (tied to the captain's userId): the form sends the score (and `roundScores`) only with the first slot's `submitVideoFn` call (`videoIndex === 0`); subsequent teammate slots arrive with no score by design, and the server's score-required check matches that contract by gating on `videoIndex === 0`.

Incomplete team submissions are surfaced to organizers in two places. The list at [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/events/$eventId/submissions/index.tsx]] compares the group's `videoCount` to `division.teamSize` and renders an amber `videoCount/teamSize videos` warning badge on the row. The review detail's [[apps/wodsmith-start/src/components/compete/organizer-video-links-editor.tsx#OrganizerVideoLinksEditor]] then renders blank input fields for the unsubmitted slots so a reviewer can fill them in via [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#updateSubmissionVideoUrlFn]] — which respects the `(registrationId, trackWorkoutId, videoIndex)` unique constraint by re-checking for an existing row before inserting.

### Round Breakdown Display

Multi-round scores are displayed with a total followed by each round's time, so athletes and organizers can see how the aggregate was built.

[[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getVideoSubmissionFn]] and [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getOrganizerSubmissionDetailFn]] both join `scoreRoundsTable` when `workout.roundsToScore > 1` and return `roundScores: Array<{roundNumber, value, displayScore, status}>` on the returned score. [[apps/wodsmith-start/src/components/compete/video-submission-preview.tsx#VideoSubmissionPreview]] (athlete-facing) and the Claimed Score card in [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId.tsx]] (organizer-facing) render the rounds under the total when `roundScores.length > 1`, each row tagged with a "Cap" badge if `status === "cap"`. Single-round workouts render unchanged.

The organizer submission **list** at [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/events/$eventId/submissions/index.tsx]] also surfaces the breakdown via [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getOrganizerSubmissionsFn]]: it pulls workout `roundsToScore`/`timeCap`, fetches `scoreRoundsTable` once for every score on a multi-round event, and renders a per-row inline summary (`R1 4:30 · R2 CAP (12:00)` plus an amber `N/M cap` indicator). The Claimed Score column also reuses [[apps/wodsmith-start/src/lib/scoring/format/score.ts#formatScore]] with `secondaryValue` so single-round capped reps render as `CAP (N reps)` instead of just the cap time.

The list surfaces missing partner uploads alongside the athlete name: `getOrganizerSubmissionsFn` selects `scalingLevelsTable.teamSize` into `division.teamSize`, the list groups rows by `registrationId` and computes `videoCount` per group, and when `teamSize > 1 && videoCount < teamSize` the row renders an amber `AlertTriangle` badge (`1/2 videos`) instead of the neutral "N videos" badge. This lets organizers spot incomplete team submissions at a glance before opening the review detail, where [[apps/wodsmith-start/src/components/compete/organizer-video-links-editor.tsx#OrganizerVideoLinksEditor]] can fill in the unsubmitted slot.

After a successful submit, [[apps/wodsmith-start/src/components/compete/video-submission-form.tsx#VideoSubmissionForm]] computes the optimistic preview aggregate locally using `encodeRounds` + `decodeScore` with the workout's `scoreType`, so the athlete sees the correct total (e.g. `41:00.000` for a partner sum workout) immediately rather than a "R1 + R2" concatenation. Per-round cap state is inferred client-side from `encodedRound >= timeCap * 1000` to mirror the server derivation — once the loader refetches, the server-computed values take over.

### Grouped Review UX

Organizers review multi-video team submissions in a tabbed UI with aggregated no-rep tallies.

The submission list groups videos by registration into a single row with a badge. The server computes `registrationAllReviewed` from the full unfiltered submission set so grouped rows show correct review status even when a status filter is active. The review detail page uses [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getSiblingSubmissionsFn]] to fetch sibling videos and [[apps/wodsmith-start/src/server-fns/review-note-fns.ts#getReviewNotesForRegistrationFn]] to aggregate review notes across all videos. Both functions scope queries to the competition by joining through `competitionRegistrationsTable.eventId` to prevent cross-competition data access. Per-video notes feed into a shared movement tally. When a video submission has no associated score yet, the sidebar renders [[apps/wodsmith-start/src/components/compete/enter-score-form.tsx#EnterScoreForm]] in place of the verification controls so the reviewer can create the missing score directly. Video URLs rendered in the organizer list are guarded with `isSafeUrl` to prevent `javascript:` scheme injection. Tab labels use generic role names ("Captain", "Teammate 1", etc.) derived from `videoIndex` rather than athlete names, since the captain submits all team videos and the `userId` on each row is always the captain's.

### Reviewer Video Link Editor

Both review surfaces let an organizer or volunteer correct a broken athlete-submitted link — or fill in a partner slot the captain never uploaded for — without impersonating the athlete.

Rendered directly under the Verification Controls / Adjust Score card on [[apps/wodsmith-start/src/routes/compete/$slug/review/$eventId/$submissionId.tsx]] and [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId.tsx]], [[apps/wodsmith-start/src/components/compete/organizer-video-links-editor.tsx#OrganizerVideoLinksEditor]] mirrors the partner-video layout from [[apps/wodsmith-start/src/components/compete/video-submission-form.tsx#VideoSubmissionForm]]: it renders `teamSize` slots keyed by `videoIndex` (labeled "Captain" / "Teammate N" for teams, "Video URL" for solo), with existing submissions populated by `videoIndex` and unfilled indexes rendered as blank [[apps/wodsmith-start/src/components/ui/video-url-input.tsx]] fields tagged with a "Not submitted" badge. Save is disabled until the URL is both dirty and validates; on success the component calls `router.invalidate()` so the embedded video player, notes panel, and sibling list refetch. [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getSiblingSubmissionsFn]] also returns `teamSize`, `registrationId`, `trackWorkoutId`, and `captainUserId` so the editor has the context it needs to create new rows.

Writes go through [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#updateSubmissionVideoUrlFn]], which accepts either `submissionId` (update existing row) or `registrationId + trackWorkoutId + videoIndex` (insert a new row, attributed to the captain's `userId` to group with the captain's other submissions). It guards with `requireSubmissionReviewAccess`, scopes every write through `competitionRegistrationsTable.eventId` to prevent cross-competition access, and re-checks for an existing slot row before inserting to tolerate a race where another reviewer just created the same slot.

### Score Adjustments

Reviewers can adjust a submitted score with or without assigning a penalty. Penalty classification is optional on adjust; the score change is the primary action.

The Verification Controls card surfaces three top-level actions: Verify, Adjust Score, and Mark Invalid. The Adjust Score form exposes a `Penalty (optional)` radio with None / Minor / Major, defaulting to None. When None is selected the client omits `penaltyType` from [[apps/wodsmith-start/src/server-fns/submission-verification-fns.ts#verifySubmissionScoreFn]], which stores the adjustment with `verificationStatus = "adjusted"`, null penalty fields on `scoresTable`, and sets the video `reviewStatus` to `"adjusted"` rather than `"penalized"`. Minor/Major selections keep the original penalty flow with the denormalized `penaltyType`/`penaltyPercentage` columns populated. Both the organizer surface [[apps/wodsmith-start/src/routes/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId.tsx]] and the volunteer surface [[apps/wodsmith-start/src/routes/compete/$slug/review/$eventId/$submissionId.tsx]] share this form.

The adjust inputs mirror the athlete submission form: `parseScore` validates entries and shows a "Parsed as" preview, cap status is derived automatically from parsed time vs `event.workout.timeCap` (no manual Status picker), the reps-at-cap secondary input appears only when the cap is auto-hit, and a tiebreak input renders when `event.workout.tiebreakScheme` is set (POSTed as `tieBreakScore`). Shared input-hint helpers live in [[apps/wodsmith-start/src/components/compete/score-entry-helpers.ts]] so `enter-score-form.tsx` and both review surfaces stay consistent. The "Athlete claimed" readout also appends the decoded tiebreak (`· TB: <value>`) whenever the workout defines a `tiebreakScheme`; when the athlete didn't enter one, the value renders as `—` so reviewers can tell at a glance that the tiebreak was skipped rather than assume none was required.

The Adjust Score form's penalty-tiebreak state is seeded from `submission.score.tiebreakValue` (the decoded display string) rather than the empty string, so editing other fields without touching the tiebreak input preserves the existing value. Without that seed, the server would receive `tieBreakScore: undefined`, fail the `if (data.tieBreakScore && score.tiebreakScheme)` truthiness check, and persist `tiebreakValue: null`, silently erasing a previously-entered tiebreak.

Mark Invalid zeros `scoreValue`, keeps `status = "scored"`, and sets `verificationStatus = "invalid"` on `scoresTable`. The public leaderboard excludes invalid rows entirely via `fetchScores`, but the organizer preview (`bypassPublicationFilter`) includes them so the cell can render the review state. Without special handling the preview would feed the zeroed row into the scoring algorithm and — for ascending schemes like `time` — rank it first. [[apps/wodsmith-start/src/server/competition-leaderboard.ts#getCompetitionLeaderboard]] short-circuits invalid rows when building `eventScoreInputs`, forcing `status: "dnf"` with a null `sortKey` so every algorithm routes them through the inactive-score branch and honors `statusHandling.dnf` (default `"last_place"`). The leaderboard cell also formats invalid entries as `"Invalid"` rather than decoding the zeroed value into `"0:00"`.

### Manual Score Entry

When an athlete uploads a video without filling in the score field, the sidebar renders [[apps/wodsmith-start/src/components/compete/enter-score-form.tsx#EnterScoreForm]] instead of the placeholder, letting the reviewer create the missing score in one step.

The form mirrors the athlete-facing `video-submission-form.tsx` score section — schema-aware `parseScore` validation, single vs multi-round inputs, auto-derived cap status from parsed time vs `timeCap` (no separate status picker), secondary "reps at cap" when the cap is hit, and a tiebreak input when `workout.tiebreakScheme` is set — plus reviewer-specific `reviewerNotes` and optional `noRepCount`. Tiebreak input is validated with `parseScore(tiebreakScheme)` before submit so invalid values surface an inline error instead of being silently dropped by the server's try/catch-around-encode. POSTs to [[apps/wodsmith-start/src/server-fns/submission-verification-fns.ts#enterSubmissionScoreFn]]. The server fn is INSERT-only — it loads the video submission + registration + workout, refuses to overwrite an existing `scoresTable` row for the same `(userId, competitionEventId)`, encodes the score and computes `sortKey`/`statusOrder` using the same helpers as `submitVideoFn`, then in one transaction writes the new `scores` row, the per-round `score_rounds` rows when applicable, an audit-log entry (action `"adjusted"` with null `originalScoreValue` so the trail distinguishes a first-time entry from a real edit), and flips the video submission to `reviewStatus = "adjusted"`. Score ownership follows the same captain-only convention as `submitVideoFn`: `scoresTable.userId` is the registration's `captainUserId ?? userId`, and `teamId` is the workout's track owner.

For multi-round workouts, `enterSubmissionScoreFn` validates `roundScores` against `trackWorkout.roundsToScore`: the payload must contain exactly that many rounds, numbered contiguously `1..N` with no gaps or duplicates, and the function rejects `roundScores` on single-round workouts outright. This prevents a malformed client from persisting `score_rounds` rows that don't match the event definition and corrupting downstream aggregation. Race protection on the first-time insert is belt-and-suspenders: the pre-transaction existence SELECT is re-run inside the transaction to narrow the TOCTOU window, and the `idx_scores_competition_user_unique` unique index catches any remaining concurrent insert — the transaction's `.catch` maps that duplicate-key error back to the same friendly "score already exists" message the SELECT paths throw.

The route loaders gate this on event details — when no `scoreId` exists they call [[apps/wodsmith-start/src/server-fns/submission-verification-fns.ts#getEventDetailsForVerificationFn]] so the form has access to `scheme`, `roundsToScore`, `timeCap`, etc. (the `EventDetails` workout shape was extended with `scoreType`/`roundsToScore`/`tiebreakScheme`/`repsPerRound` to support this).
