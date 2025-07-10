Task: Add Team Scheduled Workouts Page
Commit 1: feat: create teams page structure and routing [docs/tasks/2025-07-10-16-30-team-scheduled-workouts.md]
Description: Create the basic page structure for /teams route under the (main) layout group. This commit establishes the foundational routing and page structure at src/app/(main)/teams/page.tsx. The page will serve as the main entry point for viewing team scheduled workouts. Include proper TypeScript types, Next.js App Router conventions, and basic layout structure following the existing patterns in src/app/(main)/workouts/page.tsx and other main app pages.

Verification:

Automated Test(s):
Command: pnpm test src/app/(main)/teams/page.test.tsx
Expected Outcome: Test verifies page renders correctly with proper team selection and basic layout structure
Logging Check:
Action: Navigate to /teams route in browser and check browser console
Expected Log: INFO: [TeamsPage] Page loaded successfully for user: {userId}
Toggle Mechanism: LOG_LEVEL=info
Commit 2: feat: implement team selection and scheduled workouts data fetching [docs/tasks/2025-07-10-16-30-team-scheduled-workouts.md]
Description: Implement server-side data fetching functions in src/server/team-programming-tracks.ts to retrieve teams that the current user has access to and their associated scheduled workouts. Create getTeamsWithScheduledWorkouts function that joins teamProgrammingTracksTable, scheduledWorkoutInstancesTable, trackWorkoutsTable, and workouts tables to fetch comprehensive workout data. Add proper authentication checks using existing team authorization utilities from src/utils/team-auth.ts. Follow the established patterns from src/server/scheduling-service.ts for data fetching and type safety.

Verification:

Automated Test(s):
Command: pnpm test src/server/team-programming-tracks.test.ts
Expected Outcome: Tests verify correct data fetching for user teams, proper joins between tables, and authentication enforcement
Logging Check:
Action: Load teams page and check server logs for data fetching operations
Expected Log: INFO: [getTeamsWithScheduledWorkouts] Fetched {count} teams with scheduled workouts for user: {userId}
Toggle Mechanism: LOG_LEVEL=info
Commit 3: feat: create team scheduled workouts display component [docs/tasks/2025-07-10-16-30-team-scheduled-workouts.md]
Description: Create src/app/(main)/teams/_components/team-scheduled-workouts.tsx component that displays scheduled workouts for selected teams. The component should show workout details including name, scheduled date, track information, day/week numbers, and any team-specific notes. Implement team filtering/selection UI using existing patterns from src/components/team-switcher.tsx. Include proper loading states, error handling, and responsive design following Tailwind CSS patterns used throughout the application. Use Shadcn UI components (Card, Button, Select) for consistent styling.

Verification:

Automated Test(s):
Command: pnpm test src/app/(main)/teams/_components/team-scheduled-workouts.test.tsx
Expected Outcome: Tests verify component renders scheduled workouts correctly, handles team selection, and displays proper workout information
Logging Check:
Action: Select different teams in the UI and observe component behavior
Expected Log: INFO: [TeamScheduledWorkouts] Displaying {count} scheduled workouts for team: {teamName}
Toggle Mechanism: LOG_LEVEL=info
Commit 4: feat: add server actions for team scheduled workouts [docs/tasks/2025-07-10-16-30-team-scheduled-workouts.md]
Description: Create src/actions/team-scheduled-workouts.action.ts with server actions following the established ZSA (Zod Server Actions) pattern used in src/actions/team-actions.ts. Implement getTeamsWithScheduledWorkoutsAction that wraps the server function with proper authentication, error handling, and type safety. Include input validation using Zod schemas and follow the consistent error handling patterns established in other action files. Ensure proper team access validation using existing team authorization utilities.

Verification:

Automated Test(s):
Command: pnpm test src/actions/team-scheduled-workouts.action.test.ts
Expected Outcome: Tests verify server action handles authentication, validates inputs, and returns properly typed data
Logging Check:
Action: Trigger server action from client component and monitor server logs
Expected Log: INFO: [getTeamsWithScheduledWorkoutsAction] Action executed successfully for user: {userId}, returned {count} teams
Toggle Mechanism: LOG_LEVEL=info
Commit 5: feat: integrate components and add navigation link [docs/tasks/2025-07-10-16-30-team-scheduled-workouts.md]
Description: Complete the integration by connecting the server actions to the client components in src/app/(main)/teams/page.tsx. Add proper error boundaries, loading states, and data flow between server and client components. Update the main navigation in src/components/nav-main.tsx to include a "Teams" link that navigates to /teams. Ensure the navigation follows existing patterns and includes proper icons from Lucide React. Add proper TypeScript types and ensure the page follows the established layout patterns from other main app pages.

Verification:

Automated Test(s):
Command: pnpm test src/app/(main)/teams/integration.test.tsx
Expected Outcome: Integration tests verify complete data flow from server actions to UI components, proper error handling, and navigation functionality
Logging Check:
Action: Navigate to teams page via main navigation and interact with team selection
Expected Log: INFO: [TeamsPage] Navigation successful, displaying teams interface for user: {userId}
Toggle Mechanism: LOG_LEVEL=info