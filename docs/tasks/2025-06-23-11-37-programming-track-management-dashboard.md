# Task: Programming Track Management Dashboard for Admin Teams

## Commit 1: feat: create programming track management page
**Description:**
Create the main programming track management page at `src/app/(admin)/admin/teams/[teamSlug]/programming/page.tsx` following the existing admin team page pattern from `src/app/(admin)/admin/teams/[teamSlug]/page.tsx`. Implement server-side data fetching using existing `getTeamTracks` function from `src/server/programming-tracks.ts`. Add proper team authentication using `requireTeamPermission` with `TEAM_PERMISSIONS.MANAGE_PROGRAMMING` permission. Create metadata generation function similar to existing team pages. Add page header component using `@/components/page-header` and implement loading state with Suspense.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm vitest run test/pages/admin/programming-tracks.test.ts`
    *   **Expected Outcome:** Tests verify page renders correctly, requires proper team permissions, fetches team tracks data, and handles edge cases like team not found scenarios
2.  **Logging Check:**
    *   **Action:** Navigate to `/admin/teams/{teamSlug}/programming` route in browser
    *   **Expected Log:** `DEBUG: [Programming] Loading programming tracks for team: {teamSlug}`
    *   **Toggle Mechanism:** `NODE_ENV=development` or `LOG_LEVEL=debug`

---

## Commit 2: feat: implement programming track actions and server functions
**Description:**
Create comprehensive server actions at `src/app/(admin)/admin/teams/[teamSlug]/_actions/programming-track-actions.ts` following the pattern of existing actions in `src/actions/`. Implement actions for creating tracks (`createProgrammingTrackAction`), deleting tracks (`deleteProgrammingTrackAction`), and getting team tracks (`getTeamTracksAction`). Each action must include proper authentication, input validation using Zod schemas in `src/schemas/`, error handling with try-catch blocks, and revalidation of paths. Extend the existing `src/server/programming-tracks.ts` with `deleteProgrammingTrack` function if not present. All functions must include comprehensive logging using `console.log` statements for debugging and audit trails.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm vitest run test/actions/programming-track-actions.test.ts`
    *   **Expected Outcome:** Tests verify all CRUD operations work correctly, proper authentication is enforced, input validation catches invalid data, and error cases are handled gracefully
2.  **Logging Check:**
    *   **Action:** Execute programming track creation through form submission
    *   **Expected Log:** `INFO: [ProgrammingTrack] Created track: {trackName} for team: {teamId} by user: {userId}`
    *   **Toggle Mechanism:** `LOG_LEVEL=info`

---

## Commit 3: feat: build programming track management UI components
**Description:**
Create the main dashboard component `src/app/(admin)/admin/teams/[teamSlug]/programming/_components/programming-track-dashboard.tsx` with comprehensive CRUD functionality. Implement track listing using `@/components/data-table` component for consistent styling. Create `programming-track-create-dialog.tsx` using shadcn dialog components for track creation with form validation. Implement `programming-track-card.tsx` for individual track display with edit/delete actions. Add `programming-track-delete-dialog.tsx` for safe deletion with confirmation. Use existing UI components from `@/components/ui/` and follow the established component patterns from `src/app/(admin)/admin/teams/[teamSlug]/_components/`. Include proper loading states, error handling, and optimistic updates using React's useOptimistic hook.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm vitest run test/components/programming-track-dashboard.test.ts`
    *   **Expected Outcome:** Component tests verify all UI interactions work correctly, forms validate input properly, delete confirmation prevents accidental deletions, and loading states display appropriately
2.  **Logging Check:**
    *   **Action:** Create a new programming track through the UI
    *   **Expected Log:** `DEBUG: [UI] Programming track creation form submitted with data: {trackData}`
    *   **Toggle Mechanism:** `NODE_ENV=development`

---

## Commit 4: feat: implement track workout management functionality
**Description:**
Create the detailed track view at `src/app/(admin)/admin/teams/[teamSlug]/programming/[trackId]/page.tsx` for managing workouts within a specific track. Implement `add-workout-to-track-dialog.tsx` component using workout selection modal similar to existing workout components. Create `track-workout-list.tsx` component for displaying and managing workouts in the track with drag-and-drop reordering capability. Add workout removal functionality with confirmation dialogs. Integrate with existing `addWorkoutToTrack` and `getWorkoutsForTrack` functions from `src/server/programming-tracks.ts`. Include day/week number assignment functionality and workout notes editing. Use existing workout-related components from the codebase for consistency.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm vitest run test/pages/admin/track-workout-management.test.ts`
    *   **Expected Outcome:** Tests verify workout addition to tracks works correctly, workout ordering is maintained, removal functionality works with proper confirmation, and track workout data is properly persisted
2.  **Logging Check:**
    *   **Action:** Add a workout to a programming track
    *   **Expected Log:** `INFO: [TrackWorkout] Added workout: {workoutId} to track: {trackId} at day: {dayNumber}`
    *   **Toggle Mechanism:** `LOG_LEVEL=info`

---

## Commit 5: feat: apply brutalist design styling to programming track dashboard
**Description:**
Apply brutalist design styling to all programming track management components following the established design system from `src/app/globals.css`. Use thick borders (`border-2`, `border-4`), high contrast colors (utilizing CSS variables `--orange`, `--primary`, `--background`), bold typography, and minimal rounded corners. Create `programming-track-dashboard.css` with custom styles if needed, similar to `src/app/(admin)/admin/teams/[teamSlug]/_components/team-scheduling-calendar.css`. Ensure all buttons use the brutalist button styles from `src/components/ui/button.tsx`. Apply consistent spacing, sharp corners, and bold visual hierarchy. Update card components to use thick borders and high contrast backgrounds. Ensure responsive design maintains brutalist aesthetic across all screen sizes.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm test:visual --spec programming-track-dashboard.visual.spec.ts`
    *   **Expected Outcome:** Visual regression tests pass for all programming track components. UI matches brutalist theme with thick borders, bold typography, high contrast colors, and proper spacing hierarchy
2.  **Logging Check:**
    *   **Action:** Load programming track dashboard page
    *   **Expected Log:** `DEBUG: [UI] Applied brutalist CSS styling to programming track dashboard components`
    *   **Toggle Mechanism:** `NODE_ENV=development`
