# Task: Implement Workout Instances and Scheduling

<!-- NOTE: Project documentation currently consists of high-level planning docs (`docs/project-plan.md`, `docs/multi-tenancy-report.md`). No dedicated logging or test strategy docs exist. The codebase relies on Drizzle ORM's built-in SQL logger (`logger: true` in `src/db/index.ts`) and tagged `console.log` statements (see `src/server/logs.ts`). This plan follows those established conventions. -->

## Commit 1: feat: define schemas and migrations for programming tracks and track workouts [docs/tasks/2024-03-15-10-00-implement-workout-instances.md]

**Description:**
This commit introduces the foundational database structures for managing programming tracks and the workouts within them.
Modifications will be made to `src/db/schema.ts`:

1.  **Define `programmingTracksTable`:**
    - Columns based on ERD: `id (TEXT PK, ptrk_xxx)`, `name (TEXT)`, `description (TEXT NULLABLE)`, `type (TEXT ENUM: self_programmed, team_owned, official_3rd_party)`, `owner_team_id (TEXT FK to team.id, NULLABLE)`, `is_public (BOOLEAN)`, `createdAt`, `updatedAt`, `updateCounter` (from `commonColumns`).
2.  **Define `teamProgrammingTracksTable` (Join Table):**
    - Columns based on ERD: `team_id (TEXT PK, FK to team.id)`, `track_id (TEXT PK, FK to programmingTracksTable.id)`, `is_active (BOOLEAN)`, `added_at (INTEGER)`, `createdAt`, `updatedAt`, `updateCounter`.
3.  **Define `trackWorkoutsTable`:**
    - Columns based on ERD: `id (TEXT PK, trwk_xxx)`, `track_id (TEXT FK to programmingTracksTable.id)`, `workout_id (TEXT FK to workouts.id)`, `day_number (INTEGER)`, `week_number (INTEGER NULLABLE)`, `notes (TEXT NULLABLE)`, `createdAt`, `updatedAt`, `updateCounter`.
    - A unique constraint `UQ_track_workouts` on `(track_id, workout_id, day_number)` will be added.
4.  **Update `teamTable` (`src/db/schema.ts`):**
    - Add `defaultTrackId: text('default_track_id').references(() => programmingTracksTable.id).nullable()`.
5.  **Update `workoutsTable` (`src/db/schema.ts`):**
    - Add `sourceTrackId: text('source_track_id').references(() => programmingTracksTable.id).nullable()`.
6.  **Update `resultsTable` (`src/db/schema.ts`):**
    - Add `programmingTrackId: text('programming_track_id').references(() => programmingTracksTable.id).nullable()`.

follow @migrate-database.md to create a new migration file (e.g., `src/db/migrations/XXXX_add_programming_and_track_workout_tables.sql`) will be generated using `pnpm drizzle-kit generate:sqlite` (assuming SQLite based on migration meta snapshots) and applied.
Logging configuration: Follow practices from `src/server/logs.ts` (currently `console.log`) or ideally integrate with a structured logger like `pino` if specified in `docs/logging.md`.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm db:migrate && pnpm test tests/db/schema.integrity.test.ts` (This test file would need to be created or adapted. It could perform basic queries to ensure tables and relations exist as expected, or simply rely on Drizzle ORM's type safety and successful migration application.)
    - **Expected Outcome:** `Migration XXXX_add_programming_and_track_workout_tables.sql applies successfully. Database schema inspected via Drizzle Studio or a DB browser confirms the new tables (programming_tracks, team_programming_tracks, track_workouts) and updated foreign keys in 'team', 'workouts', and 'results' tables with correct column types and constraints.`
2.  **Logging Check:**
    - **Action:** `Execute the database migration script: pnpm db:migrate.`
    - **Expected Log:** `Drizzle Kit: Migration XXXX_add_programming_and_track_workout_tables.sql applied successfully.` (Or similar output from the migration tool). If Drizzle ORM's logger is active (`logger: true` in `src/db/index.ts`), it might output table creation details.
    - **Toggle Mechanism:** `Drizzle ORM logger configured in src/db/index.ts. Migration tool verbosity via CLI flags. LOG_LEVEL=debug for application-level logging if a structured logger is used.`
    - Uses Drizzle ORM SQL logging (`logger: true` in `src/db/index.ts`) and descriptive `console.log` statements; no external logging library configured.

---

## Commit 2: feat: define schema and migration for scheduled workout instances [docs/tasks/2024-03-15-10-00-implement-workout-instances.md]

**Description:**
This commit introduces the `scheduled_workout_instances` table, which is central to scheduling workouts for teams.
Modifications will be made to `src/db/schema.ts`:

1.  **Define `scheduledWorkoutInstancesTable`:**
    - Columns based on ERD: `id (TEXT PK, swi_xxx)`, `team_id (TEXT FK to team.id)`, `track_workout_id (TEXT FK to trackWorkoutsTable.id)`, `scheduled_date (DATE/INTEGER)`, `team_specific_notes (TEXT NULLABLE)`, `scaling_guidance_for_day (TEXT NULLABLE)`, `class_times (TEXT NULLABLE)`, `createdAt`, `updatedAt`, `updateCounter`.
2.  **Update `resultsTable` (`src/db/schema.ts`):**
    - Add `scheduledWorkoutInstanceId: text('scheduled_workout_instance_id').references(() => scheduledWorkoutInstancesTable.id).nullable()`.

follow @migrate-database.md to create a  new migration file (e.g., `src/db/migrations/YYYY_add_scheduled_workout_instances_table.sql`) will be generated using `pnpm drizzle-kit generate:sqlite` and applied.
Logging configuration: As per project standard (e.g., `src/utils/logger.ts` or `console.log` based on `src/server/logs.ts`).

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm db:migrate && pnpm test tests/db/schema.integrity.test.ts` (Extend or re-run schema integrity tests).
    - **Expected Outcome:** `Migration YYYY_add_scheduled_workout_instances_table.sql applies successfully. Database schema inspected via Drizzle Studio or a DB browser confirms the new 'scheduled_workout_instances' table and the updated foreign key in the 'results' table.`
2.  **Logging Check:**
    - **Action:** `Execute the database migration script: pnpm db:migrate.`
    - **Expected Log:** `Drizzle Kit: Migration YYYY_add_scheduled_workout_instances_table.sql applied successfully.` (Or similar output).
    - **Toggle Mechanism:** `Drizzle ORM logger, migration tool verbosity, application LOG_LEVEL.`
    - Uses Drizzle ORM SQL logging (`logger: true` in `src/db/index.ts`) and descriptive `console.log` statements; no external logging library configured.

---

## Commit 3: feat: implement services for managing programming tracks and track workouts [docs/tasks/2024-03-15-10-00-implement-workout-instances.md]

**Description:**
This commit implements the backend service layer functions for creating, retrieving, and managing programming tracks, and associating workouts with these tracks. A new file, `src/server/programmingService.ts` (or similar, like `src/server/tracksService.ts`), will be created.
Functions to implement:

- `createProgrammingTrack(data: CreateTrackInput): Promise<ProgrammingTrack>`: Creates a new programming track.
- `getProgrammingTrackById(trackId: string): Promise<ProgrammingTrack | null>`: Retrieves a track.
- `addWorkoutToTrack(data: AddWorkoutToTrackInput): Promise<TrackWorkout>`: Adds a workout from the `workouts` table to a `programming_tracks` at a specific day/week.
- `getWorkoutsForTrack(trackId: string): Promise<TrackWorkout[]>`: Retrieves all workouts for a given track.
- `assignTrackToTeam(teamId: string, trackId: string, isActive: boolean): Promise<TeamProgrammingTrack>`: Links a track to a team via `team_programming_tracks`.
- `getTeamTracks(teamId: string, activeOnly: boolean = true): Promise<ProgrammingTrack[]>`: Retrieves tracks associated with a team.
- `updateTeamDefaultTrack(teamId: string, trackId: string | null): Promise<Team>`: Updates the `default_track_id` on the `team` table.

These functions will use Drizzle ORM for database interactions, similar to patterns in `src/server/workouts.ts` or `src/server/teams.ts`.
A new test file `tests/server/programmingService.test.ts` will be created.
Logging will be added to trace function calls, inputs, and important outcomes.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test tests/server/programmingService.test.ts`
    - **Expected Outcome:**
      - `createProgrammingTrack` successfully inserts a track and returns it.
      - `addWorkoutToTrack` correctly links a workout to a track.
      - `assignTrackToTeam` correctly creates an entry in `team_programming_tracks`.
      - Retrieval functions return expected data or empty arrays/null for non-existent IDs.
      - `updateTeamDefaultTrack` correctly updates the team record.
      - Assertions for correct data shaping, foreign key integrity (implicitly via successful inserts/reads).
2.  **Logging Check:**
    - **Action:** `Call programmingService.createProgrammingTrack with valid data.`
    - **Expected Log:** `INFO: [ProgrammingService] Created programming track ID 'ptrk_...' with name 'Example Track'.` (Or similar structured log).
    - **Action:** `Call programmingService.addWorkoutToTrack with valid data.`
    - **Expected Log:** `INFO: [ProgrammingService] Added workout ID 'wk_...' to track ID 'ptrk_...' as day_number 1.`
    - **Toggle Mechanism:** `LOG_LEVEL=info` (or `debug` for more verbose output) environment variable.
    - Uses Drizzle ORM SQL logging (`logger: true` in `src/db/index.ts`) and descriptive `console.log` statements; structured JSON logging is not yet adopted.

---

## Commit 4: feat: implement service for scheduling and retrieving workout instances [docs/tasks/2024-03-15-10-00-implement-workout-instances.md]

**Description:**
This commit implements the service layer functions for scheduling workouts for teams and retrieving these scheduled instances. These functions will likely reside in `src/server/programmingService.ts` or a new `src/server/schedulingService.ts`.
Functions to implement:

- `scheduleWorkoutForTeam(data: ScheduleWorkoutInput): Promise<ScheduledWorkoutInstance>`: Creates an entry in `scheduled_workout_instances`. Input includes `teamId`, `trackWorkoutId`, `scheduledDate`, and optional notes.
- `getScheduledWorkoutsForTeam(teamId: string, dateRange: { start: Date, end: Date }): Promise<ScheduledWorkoutInstanceWithDetails[]>`: Retrieves scheduled workouts for a team within a date range, potentially joining with `track_workouts` and `workouts` for more details.
- `getScheduledWorkoutInstanceById(instanceId: string): Promise<ScheduledWorkoutInstanceWithDetails | null>`: Retrieves a specific scheduled instance.
- `updateScheduledWorkoutInstance(instanceId: string, data: UpdateScheduleInput): Promise<ScheduledWorkoutInstance>`: Updates notes or other mutable fields.
- `deleteScheduledWorkoutInstance(instanceId: string): Promise<void>`: Removes a scheduled workout.

A new test file `tests/server/schedulingService.test.ts` (or extend `programmingService.test.ts`) will be created.
Logging for all create, update, delete, and significant read operations.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test tests/server/schedulingService.test.ts`
    - **Expected Outcome:**
      - `scheduleWorkoutForTeam` successfully creates a `scheduled_workout_instances` record and returns it.
      - `getScheduledWorkoutsForTeam` returns correctly filtered and populated scheduled instances.
      - `updateScheduledWorkoutInstance` correctly modifies an existing instance.
      - `deleteScheduledWorkoutInstance` removes the instance.
      - Permissions checks (e.g., only authorized users can schedule for a team) should be tested if applicable.
      - Permissions checks: leverage `requireTeamPermission(teamId, TEAM_PERMISSIONS.SCHEDULE_WORKOUTS)` (see `src/utils/team-auth.ts`) after adding `SCHEDULE_WORKOUTS` to `TEAM_PERMISSIONS` in `src/db/schema.ts`.
2.  **Logging Check:**
    - **Action:** `Call schedulingService.scheduleWorkoutForTeam with valid data.`
    - **Expected Log:** `INFO: [SchedulingService] Scheduled trackWorkoutId 'trwk_...' for teamId 'team_...' on 'YYYY-MM-DD'. InstanceId: 'swi_...'.`
    - **Action:** `Call schedulingService.getScheduledWorkoutsForTeam for a team and date range.`
    - **Expected Log:** `DEBUG: [SchedulingService] Retrieving scheduled workouts for teamId 'team_...' between 'YYYY-MM-DD' and 'YYYY-MM-DD'. Found X instances.`
    - **Toggle Mechanism:** `LOG_LEVEL=info` (or `debug`) environment variable.
    - Uses Drizzle ORM SQL logging (`logger: true` in `src/db/index.ts`) and descriptive `console.log` statements; structured JSON logging is not yet adopted.
    - Correlation IDs are not currently implemented; include key identifiers in each log entry for traceability.
