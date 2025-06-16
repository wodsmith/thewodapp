# Task: Implement FullCalendar Scheduling for Teams with Brutalist Styling

<!-- NOTE: Project documentation consists of high-level planning docs (`docs/project-plan.md`, `docs/multi-tenancy-report.md`). No dedicated logging or test strategy docs exist. The codebase relies on Drizzle ORM's built-in SQL logger (`logger: true` in `src/db/index.ts`) and tagged `console.log` statements. Current task references `scheduledWorkoutInstancesTable` from `src/db/schema.ts` and `src/server/scheduling-service.ts`. -->

## Commit 1: feat: install and configure fullcalendar react dependencies [docs/tasks/2025-06-16-11-49-fullcalendar-scheduling.md]

**Description:**
This commit installs the FullCalendar React component library and its necessary dependencies. FullCalendar provides a comprehensive calendar solution for scheduling workouts for teams. Dependencies include `@fullcalendar/react`, `@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, and `@fullcalendar/interaction` for drag-and-drop functionality.

**Verification:**
1. **Automated Test(s):**
   - **Command:** `pnpm install && pnpm build`
   - **Expected Outcome:** Build completes successfully without dependency conflicts. Package.json includes FullCalendar dependencies with proper versions.
2. **Logging Check:**
   - **Action:** `Execute: pnpm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction`
   - **Expected Log:** `pnpm: Installing @fullcalendar/react@VERSION... Added X packages`
   - **Toggle Mechanism:** Terminal verbosity via pnpm install logs.

---

## Commit 2: feat: create basic team scheduling page structure [docs/tasks/2025-06-16-11-49-fullcalendar-scheduling.md]

**Description:**
This commit creates the basic page structure for `src/app/(admin)/admin/teams/[teamSlug]/page.tsx`. The page will include authentication checks, team permission validation using `requireTeamPermission`, and layout components. The page will fetch team data and serve as the container for the FullCalendar component.

**Verification:**
1. **Automated Test(s):**
   - **Command:** `pnpm test tests/pages/admin-team-scheduling.test.tsx`
   - **Expected Outcome:** Page renders correctly with proper team authorization. Returns 403 for unauthorized users and displays calendar for authorized team admins.
2. **Logging Check:**
   - **Action:** `Navigate to /admin/teams/[teamSlug] as authorized user`
   - **Expected Log:** `INFO: [TeamAuth] User authorized for team scheduling on teamId 'team_...'`
   - **Toggle Mechanism:** `LOG_LEVEL=info` environment variable or console.log statements.

---

## Commit 3: feat: integrate fullcalendar with scheduled workout instances [docs/tasks/2025-06-16-11-49-fullcalendar-scheduling.md]

**Description:**
This commit integrates FullCalendar with the existing `scheduledWorkoutInstancesTable` and `src/server/scheduling-service.ts`. Creates a calendar component that displays existing scheduled workouts as events and allows creating new scheduled workout instances. Uses `getScheduledWorkoutsForTeam` for fetching events and `scheduleWorkoutForTeam` for creating new schedules. Implements drag-and-drop functionality for rescheduling workouts.

**Verification:**
1. **Automated Test(s):**
   - **Command:** `pnpm test tests/components/team-scheduling-calendar.test.tsx`
   - **Expected Outcome:** Calendar displays existing scheduled workouts as events. Allows creating new workout schedules via date clicking. Drag-and-drop functionality works for rescheduling.
2. **Logging Check:**
   - **Action:** `Create new scheduled workout via calendar interface`
   - **Expected Log:** `INFO: [SchedulingService] Scheduled trackWorkoutId 'trwk_...' for teamId 'team_...' on 'YYYY-MM-DD'. InstanceId: 'swi_...'`
   - **Toggle Mechanism:** `LOG_LEVEL=info` environment variable or structured console.log statements.

---

## Commit 4: feat: apply brutalist design styling to fullcalendar [docs/tasks/2025-06-16-11-49-fullcalendar-scheduling.md]

**Description:**
This commit applies brutalist design styling to match the app's current design direction. References existing styling patterns from `src/app/globals.css` (thick `border-2` and `border-4`, high contrast colors, minimal rounded corners). Creates custom CSS overrides for FullCalendar's default styling including thick borders, bold typography, high contrast colors (using `--orange`, `--primary`, `--background` CSS variables), and sharp corners. Ensures calendar matches components like buttons in `src/components/ui/button.tsx` and forms throughout the app.

**Verification:**
1. **Automated Test(s):**
   - **Command:** `pnpm test tests/components/calendar-styling.test.tsx`
   - **Expected Outcome:** Visual regression tests pass for calendar styling. Calendar matches brutalist theme with thick borders, bold typography, and high contrast colors.
2. **Logging Check:**
   - **Action:** `Load calendar page and inspect CSS classes via browser dev tools`
   - **Expected Log:** `DEBUG: [Calendar] Applied brutalist CSS overrides for FullCalendar components`
   - **Toggle Mechanism:** `LOG_LEVEL=debug` for development CSS debugging or browser console inspection.

---

## Commit 5: feat: implement workout selection and scheduling workflow [docs/tasks/2025-06-16-11-49-fullcalendar-scheduling.md]

**Description:**
This commit implements the complete workflow for selecting workouts from team tracks and scheduling them via the calendar. Creates modal dialogs for workout selection (using existing patterns from `src/components/ui/dialog.tsx`), integrates with `src/server/programming-tracks.ts` for fetching team tracks and workouts, and connects to `src/server/scheduling-service.ts` for persistence. Implements form validation using patterns from existing forms in the app, handles time selection for `classTimes`, and includes team-specific notes and scaling guidance fields.

**Verification:**
1. **Automated Test(s):**
   - **Command:** `pnpm test tests/integration/workout-scheduling.test.tsx`
   - **Expected Outcome:** Complete workflow test: click date → select workout from team tracks → set time and notes → save successfully. Verifies data persistence and calendar refresh.
2. **Logging Check:**
   - **Action:** `Complete full workout scheduling workflow from calendar UI`
   - **Expected Log:** `INFO: [WorkoutScheduling] Workflow completed: selected workout 'workout_...' from track 'ptrk_...' scheduled for 'YYYY-MM-DD' with 1 class time`
   - **Toggle Mechanism:** `LOG_LEVEL=info` environment variable for workflow tracking.
