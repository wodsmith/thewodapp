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

Submissions link to a score and include a video URL (e.g., Vimeo). Judges can verify or reject submissions. Community voting is supported via `videoVotesTable`.

### Multi-Division Submission

Athletes registered in multiple divisions see a division picker on the submission form. Single-division athletes see a static badge.

Switching divisions fetches that division's submission data via [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getVideoSubmissionFn]] with the `divisionId` parameter. Scores and video submissions are scoped per-division so each registration gets its own submission state. The picker lives in [[apps/wodsmith-start/src/components/compete/video-submission-form.tsx#VideoSubmissionForm]].

### Sub-Event Submissions

Events with sub-events (parent/child hierarchy) show a separate submission form per child event on the parent workout page.

The loader in [[apps/wodsmith-start/src/routes/compete/$slug/workouts/$eventId.tsx]] fetches video submissions for each child event in parallel via `getVideoSubmissionFn`. Each child renders its own [[apps/wodsmith-start/src/components/compete/video-submission-form.tsx#VideoSubmissionForm]] with the child's `trackWorkoutId`. Team divisions get the same multi-video slot behavior per sub-event. The parent event itself has no submission form when children exist — all scoring is per sub-event.

### Captain-Only Submission

For team divisions (teamSize > 1), only the team captain can submit videos and scores. Non-captain team members see a read-only view of the team's submissions. Individual athletes (teamSize = 1) are always treated as their own captain.

### Multiple Videos per Team

Team divisions allow up to `teamSize` video submissions per event, tracked via a `videoIndex` column on `videoSubmissionsTable`.

The unique constraint is `(registrationId, trackWorkoutId, videoIndex)`. Videos are optional — teams can submit fewer than `teamSize`. The score is submitted once per team (tied to the captain's userId).

### Grouped Review UX

Organizers review multi-video team submissions in a tabbed UI with aggregated no-rep tallies.

The submission list groups videos by registration into a single row with a badge. The server computes `registrationAllReviewed` from the full unfiltered submission set so grouped rows show correct review status even when a status filter is active. The review detail page uses [[apps/wodsmith-start/src/server-fns/video-submission-fns.ts#getSiblingSubmissionsFn]] to fetch sibling videos and [[apps/wodsmith-start/src/server-fns/review-note-fns.ts#getReviewNotesForRegistrationFn]] to aggregate review notes across all videos. Both functions scope queries to the competition by joining through `competitionRegistrationsTable.eventId` to prevent cross-competition data access. Per-video notes feed into a shared movement tally. The Verification Controls card always renders in the sidebar; when no score exists yet it shows a placeholder message instead of the full controls. Video URLs rendered in the organizer list are guarded with `isSafeUrl` to prevent `javascript:` scheme injection. Tab labels use generic role names ("Captain", "Teammate 1", etc.) derived from `videoIndex` rather than athlete names, since the captain submits all team videos and the `userId` on each row is always the captain's.
