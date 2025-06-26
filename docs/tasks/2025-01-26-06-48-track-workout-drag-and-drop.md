# Task: Implement Drag and Drop for Track Workout Management

## Commit 1: feat: install pragmatic-drag-and-drop dependencies
**Description:**
Install Atlassian's Pragmatic Drag and Drop library for implementing drag-and-drop functionality in track workout management. Install core packages including `@atlaskit/pragmatic-drag-and-drop` for the main drag-and-drop functionality and `@atlaskit/pragmatic-drag-and-drop-react-drop-indicator` for visual drop indicators. These packages provide framework-agnostic drag-and-drop capabilities that work seamlessly with React applications. Update `package.json` with the new dependencies and run installation via `pnpm install`.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm test test/server/programmingService.test.ts`
    *   **Expected Outcome:** All existing tests pass, confirming no regressions from dependency installation
2.  **Logging Check:**
    *   **Action:** Install packages and verify installation success
    *   **Expected Log:** `INFO: Successfully installed @atlaskit/pragmatic-drag-and-drop packages`
    *   **Toggle Mechanism:** Console output during package installation

---

## Commit 2: feat: add drag-and-drop functionality to TrackWorkoutRow component
**Description:**
Transform the existing `TrackWorkoutRow` component in `src/app/(admin)/admin/teams/[teamId]/programming/[trackId]/_components/track-workout-row.tsx` into a draggable element using Pragmatic Drag and Drop. Add `draggable` functionality from `@atlaskit/pragmatic-drag-and-drop/element/adapter` with proper React hooks (`useRef`, `useEffect`). Include drag state management with `useState` to show visual feedback when dragging starts/ends (opacity changes). Attach workout data (`trackWorkoutId`, `dayNumber`, `workoutId`) to the draggable element using `getInitialData` for use in drop operations. Add proper TypeScript types and error handling for drag operations.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm test test/components/programming-track-dashboard.test.ts`
    *   **Expected Outcome:** Component renders correctly with draggable functionality, drag state updates properly
2.  **Logging Check:**
    *   **Action:** Drag a track workout row in the UI
    *   **Expected Log:** `DEBUG: [TrackWorkoutRow] Starting drag operation for trackWorkout: ${trackWorkoutId} at day: ${dayNumber}`
    *   **Toggle Mechanism:** `LOG_LEVEL=debug` environment variable

---

## Commit 3: feat: implement drop zones and reordering logic in TrackWorkoutManagement
**Description:**
Add drop target functionality to the `TrackWorkoutManagement` component in `src/app/(admin)/admin/teams/[teamId]/programming/[trackId]/_components/track-workout-management.tsx`. Implement `dropTargetForElements` and `monitorForElements` from Pragmatic Drag and Drop to handle workout reordering. Create drop zones between workout rows that highlight when a draggable workout is dragged over them. Add visual drop indicators using Pragmatic Drag and Drop's drop indicator system. Implement the core reordering logic that calculates new day numbers for all affected workouts when a workout is moved to a new position. Use optimistic updates with `useOptimistic` to provide immediate visual feedback before server confirmation.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm test test/actions/programming-track-actions.test.ts`
    *   **Expected Outcome:** Drop target functionality works correctly, reordering logic calculates proper day numbers
2.  **Logging Check:**
    *   **Action:** Drag and drop a workout to reorder it in the list
    *   **Expected Log:** `INFO: [TrackWorkoutManagement] Reordering workout from day ${oldDay} to day ${newDay}, updating ${affectedCount} workouts`
    *   **Toggle Mechanism:** `LOG_LEVEL=info` environment variable

---

## Commit 4: feat: add bulk day number update server action and database transaction
**Description:**
Create a new server function `reorderTrackWorkouts` in `src/server/programming-tracks.ts` that handles bulk updates of day numbers when workouts are reordered via drag-and-drop. Implement database transaction logic using Drizzle ORM to ensure atomic updates of multiple `trackWorkoutsTable` records. Add corresponding server action `reorderTrackWorkoutsAction` in `src/app/(admin)/admin/teams/[teamId]/_actions/programming-track-actions.ts` with proper input validation using Zod schema (`reorderTrackWorkoutsSchema`). Include team permission checks using `requireTeamPermission` with "manage_workouts" permission. Add comprehensive error handling and logging for database operations. Update the schema file `src/schemas/programming-track.schema.ts` with the new validation schema.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm test test/server/programmingService.test.ts`
    *   **Expected Outcome:** Database transaction completes successfully, all affected workout day numbers are updated correctly
2.  **Logging Check:**
    *   **Action:** Execute the reorder operation with multiple workout updates
    *   **Expected Log:** `INFO: [ProgrammingTracks] Successfully reordered ${updateCount} track workouts in transaction for track: ${trackId}`
    *   **Toggle Mechanism:** `LOG_LEVEL=info` environment variable

