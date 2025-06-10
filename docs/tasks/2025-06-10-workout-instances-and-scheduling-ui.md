# Task: Implement UI for Workout Programming and Scheduling

<!-- NOTE: This UI plan is based on the backend capabilities outlined in 'docs/tasks/2024-03-15-10-00-implement-workout-instances.md'. Project documentation currently consists of high-level planning docs (`docs/project-plan.md`, `docs/multi-tenancy-report.md`). No dedicated UI/frontend tech stack, component library, or specific client-side logging/testing strategy docs exist. This plan assumes a Next.js/React frontend, TailwindCSS for styling (common choice), Vitest/React Testing Library for component tests, and Playwright for E2E tests. Client-side logging will use `console.log` and `console.error` for development, aligning with the backend's established logging simplicity. Server actions triggered by the UI will rely on backend logging as defined in the previous plan. -->
<!-- Stack Confirmed: The project uses Next.js App Router with React 18, TypeScript, Tailwind CSS, Shadcn UI (built on Radix), and Drizzle ORM. Component tests run with Vitest + React Testing Library, and E2E tests with Playwright. Logging follows the conventions in `src/server/logs.ts` (tagged `console.log` calls) and Drizzle-ORM SQL logging (`logger: true`). No additional frontend logging library is required. -->

## Commit 1: feat(ui): implement programming track management UI [docs/tasks/2024-03-15-11-00-implement-workout-scheduling-ui.md]

**Description:**
This commit introduces the UI components and pages for creating, viewing, and managing programming tracks, and adding workouts to them. This typically targets an admin or coach role.
New files and components:

- **Pages:**
  - `src/app/dashboard/admin/tracks/page.tsx`: Lists all programming tracks, links to create new, and links to individual track detail pages.
  - `src/app/dashboard/admin/tracks/new/page.tsx`: Page with a form to create a new programming track.
  - `src/app/dashboard/admin/tracks/[trackId]/page.tsx`: Displays details of a specific track, allows editing (future), and managing its workouts.
- **Components:**
  - `src/components/tracks/CreateTrackForm.tsx`: Form for creating a new programming track. Inputs: name, description, type, owner team (if applicable), public status. Calls a server action that uses `programmingService.createProgrammingTrack`.
  - `src/components/tracks/TrackList.tsx`: Displays a list of programming tracks with key details. Fetches data via a server action calling `programmingService.getAllProgrammingTracks` (assuming this service function will be added or `getTeamTracks` adapted for an admin view).
  - `src/components/tracks/TrackDetailsView.tsx`: Displays comprehensive details of a single track.
  - `src/components/tracks/TrackWorkoutManager.tsx`: Component within `[trackId]/page.tsx` to list workouts in a track (day/week), and a button/modal to add new workouts.
  - `src/components/tracks/AddWorkoutToTrackModal.tsx`: Modal form to select an existing workout (from `workouts` table) and specify day number, week number, and notes. Calls a server action using `programmingService.addWorkoutToTrack`.
- **Server Actions:**
  - `src/app/actions/trackActions.ts`:
    - `createTrackAction(formData: FormData)`
    - `addWorkoutToTrackAction(formData: FormData)`
    - (Server components might fetch data directly or use route handlers/server actions for data fetching)
- **Tests:**
  - `tests/components/tracks/CreateTrackForm.test.tsx`: Unit/integration tests for the form component using Vitest/React Testing Library.
  - `tests/components/tracks/TrackWorkoutManager.test.tsx`: Tests for listing and initiating adding workouts.
  - `tests/e2e/admin-track-management.spec.ts`: Playwright E2E test for creating a track and adding a workout to it.

**Verification:**

1.  **Automated Test(s):**
    - **Component Tests Command:** `pnpm test --filter tests/components/tracks/`
    - **Expected Outcome (Component):** `CreateTrackForm` submits correct data, handles validation. `TrackWorkoutManager` displays workouts and opens add modal.
    - **E2E Test Command:** `pnpm playwright test tests/e2e/admin-track-management.spec.ts`
    - **Expected Outcome (E2E):** User can navigate to track creation page, fill form, submit, see new track in list. User can navigate to track details, add a workout, and see it listed.
2.  **Logging Check (Client-side):**
    - **Action:** Fill and submit the `CreateTrackForm.tsx`.
    - **Expected Log (Browser Console):** `console.log('[CreateTrackForm] Submitting track data:', {name: '...', ...})`. On error: `console.error('[CreateTrackForm] Error creating track:', errorObject)`.
    - **Toggle Mechanism:** Logs are generally active in development (`process.env.NODE_ENV === 'development'`).
    - <!-- Backend logging: each exported server action in `src/app/actions/trackActions.ts` MUST call `console.log` at `info` level (see `src/server/logs.ts`) with a tag like `[TrackActions]` including `userId`, `teamId` (if any), and primary parameters. Errors must be caught and logged at `error` level before re-throwing. Use Drizzle's SQL logger for DB operations. -->

---

## Commit 2: feat(ui): implement team-specific track association and default track UI [docs/tasks/2024-03-15-11-00-implement-workout-scheduling-ui.md]

**Description:**
This commit adds UI for teams to manage their associated programming tracks and set a default track. This functionality would typically be in a team's settings area.
New files and components:

- **Pages:**
  - `src/app/dashboard/teams/[teamId]/settings/programming/page.tsx`: Page for a team to manage its programming tracks (assign existing public/owned tracks, view active tracks, set default track).
- **Components:**
  - `src/components/teams/TeamProgrammingSettings.tsx`: Main component for `programming/page.tsx`.
    - Lists currently assigned tracks (`programmingService.getTeamTracks`).
    - Allows assigning new tracks (perhaps a searchable dropdown/modal of available `programming_tracks`). Calls `programmingService.assignTrackToTeam` via a server action.
    - Allows setting one track as the default for the team. Calls `programmingService.updateTeamDefaultTrack` via a server action.
    - Allows activating/deactivating tracks for the team (modifies `is_active` in `team_programming_tracks`).
- **Server Actions:**
  - `src/app/actions/teamProgrammingActions.ts`:
    - `assignTrackToTeamAction(teamId: string, trackId: string, isActive: boolean)`
    - `updateTeamDefaultTrackAction(teamId: string, trackId: string | null)`
    - `setTeamTrackActivityAction(teamId: string, trackId: string, isActive: boolean)`
- **Tests:**
  - `tests/components/teams/TeamProgrammingSettings.test.tsx`: Component tests for listing, assigning, and setting default tracks.
  - `tests/e2e/team-track-settings.spec.ts`: Playwright E2E test for a team owner managing their programming tracks.

**Verification:**

1.  **Automated Test(s):**
    - **Component Tests Command:** `pnpm test tests/components/teams/TeamProgrammingSettings.test.tsx`
    - **Expected Outcome (Component):** `TeamProgrammingSettings` correctly displays tracks, allows selection for default, and triggers assignment actions.
    - **E2E Test Command:** `pnpm playwright test tests/e2e/team-track-settings.spec.ts`
    - **Expected Outcome (E2E):** Team owner can navigate to programming settings, assign an available track to their team, set it as default, and see these changes reflected.
2.  **Logging Check (Client-side):**
    - **Action:** In `TeamProgrammingSettings.tsx`, assign a track to the team.
    - **Expected Log (Browser Console):** `console.log('[TeamProgrammingSettings] Assigning trackId 'ptrk_...' to teamId 'team_...')`.
    - **Action:** Set a default track.
    - **Expected Log (Browser Console):** `console.log('[TeamProgrammingSettings] Setting default track for teamId 'team_...' to trackId 'ptrk_...')`.
    - **Toggle Mechanism:** Development environment logs.
    - <!-- Backend logging: `src/app/actions/teamProgrammingActions.ts` follows the same pattern as above. Include `[TeamProgrammingActions]` tag and key identifiers (`teamId`, `trackId`). Log permission failures explicitly. -->

---

## Commit 3: feat(ui): implement workout scheduling and viewing UI for teams [docs/tasks/2024-03-15-11-00-implement-workout-scheduling-ui.md]

**Description:**
This commit introduces the UI for teams to schedule workouts from their assigned tracks onto a calendar or daily list, and view these scheduled workouts.
New files and components:

- **Pages:**
  - `src/app/dashboard/teams/[teamId]/schedule/page.tsx`: Displays a calendar or daily/weekly view of scheduled workouts for the team. Allows authorized users (e.g., coaches) to schedule new workouts.
- **Components:**
  - `src/components/schedule/TeamScheduleCalendar.tsx`: A calendar view (e.g., using `react-big-calendar` or a custom grid). Displays `scheduled_workout_instances`. Fetches data via a server action calling `schedulingService.getScheduledWorkoutsForTeam`.
    - Clicking an empty day/slot or a "Schedule Workout" button opens `ScheduleWorkoutModal.tsx`.
    - Clicking a scheduled workout shows details, potentially allowing edit/delete.
  - `src/components/schedule/ScheduleWorkoutModal.tsx`: Form to schedule a workout.
    - Inputs: Select a `track_workout_id` (from an active track for the team), select `scheduled_date`, add `team_specific_notes`, `scaling_guidance_for_day`, `class_times`.
    - Calls a server action using `schedulingService.scheduleWorkoutForTeam`.
  - `src/components/schedule/ScheduledWorkoutInstanceView.tsx`: Displays details of a single scheduled workout instance. Allows editing notes or deleting (triggers server actions for `updateScheduledWorkoutInstance` or `deleteScheduledWorkoutInstance`).
- **Server Actions:**
  - `src/app/actions/schedulingActions.ts`:
    - `scheduleWorkoutAction(formData: FormData)`
    - `updateScheduledWorkoutAction(instanceId: string, formData: FormData)`
    - `deleteScheduledWorkoutAction(instanceId: string)`
- **Tests:**
  - `tests/components/schedule/TeamScheduleCalendar.test.tsx`: Tests rendering scheduled events and interaction for scheduling.
  - `tests/components/schedule/ScheduleWorkoutModal.test.tsx`: Tests form submission and validation.
  - `tests/e2e/team-workout-scheduling.spec.ts`: Playwright E2E test for a coach scheduling, viewing, updating, and deleting a workout for their team.

**Verification:**

1.  **Automated Test(s):**
    - **Component Tests Command:** `pnpm test --filter tests/components/schedule/`
    - **Expected Outcome (Component):** `TeamScheduleCalendar` displays events, `ScheduleWorkoutModal` submits data correctly.
    - **E2E Test Command:** `pnpm playwright test tests/e2e/team-workout-scheduling.spec.ts`
    - **Expected Outcome (E2E):** User can view team schedule, click to schedule a workout, fill the modal, submit. The new workout appears on the schedule. User can click it, edit notes, save. User can delete the scheduled workout.
2.  **Logging Check (Client-side):**
    - **Action:** Open `ScheduleWorkoutModal.tsx` and schedule a workout.
    - **Expected Log (Browser Console):** `console.log('[ScheduleWorkoutModal] Scheduling workout for teamId 'team_...', date 'YYYY-MM-DD', trackWorkoutId 'trwk_...')`.
    - **Action:** View the schedule page.
    - **Expected Log (Browser Console):** `console.log('[TeamScheduleCalendar] Fetched X scheduled workouts for teamId 'team_...')`.
    - **Toggle Mechanism:** Development environment logs.
    - <!-- Backend logging: `src/app/actions/schedulingActions.ts` must log `[SchedulingActions]` at key points (schedule, update, delete) with `instanceId`, `teamId`, `trackWorkoutId`, and `scheduledDate`. Add a permission guard: `await requireTeamPermission(teamId, TEAM_PERMISSIONS.SCHEDULE_WORKOUTS)`. The constant `SCHEDULE_WORKOUTS` was added to `TEAM_PERMISSIONS` in `src/db/schema.ts`. -->
