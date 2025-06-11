# Task: Create Centralized Admin Dashboard for Team Management

## Commit 1: feat: implement centralized admin dashboard layout with calendar-first design [docs/tasks/2025-06-11-12-41-centralized-admin-dashboard.md] - COMPLETED: 07cc556

**Description:**
This commit creates a new centralized admin dashboard page at `src/app/dashboard/teams/[teamId]/admin/page.tsx` that serves as the primary control center for team owners. The layout features a full-width calendar component as the focal point, displaying scheduled workouts prominently, with sidebar panels for quick actions. Key components include the main admin layout, an enhanced calendar view that spans the full page width, and sidebar components for track management and workout scheduling actions. The page integrates existing scheduling functionality from `src/components/schedule/TeamScheduleCalendar.tsx` and `src/components/schedule/ScheduleWorkoutModal.tsx` while introducing new admin-specific components. Navigation updates in `src/components/app-sidebar.tsx` will include a new "Admin Dashboard" link for team owners. Logging will be added to track admin dashboard access and key user interactions using the project's established console.log pattern with `[AdminDashboard]` tags.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test tests/components/admin/AdminDashboard.test.tsx`
    - **Expected Outcome:** Renders admin dashboard layout correctly, shows calendar component, displays sidebar panels, and handles team ownership permissions properly
2.  **Logging Check:**
    - **Action:** Navigate to `/dashboard/teams/[teamId]/admin` as a team owner
    - **Expected Log:** `console.log('[AdminDashboard] Loading admin dashboard for teamId: team_xxx, userId: user_xxx')`
    - **Toggle Mechanism:** Development environment logs (process.env.NODE_ENV === 'development')

---

## Commit 2: feat: implement enhanced calendar component with admin controls [docs/tasks/2025-06-11-12-41-centralized-admin-dashboard.md] - COMPLETED: e2fb8b8

**Description:**
This commit enhances the calendar functionality specifically for the admin dashboard by creating `src/components/admin/AdminScheduleCalendar.tsx` - a full-width calendar component that extends `TeamScheduleCalendar` with additional admin features. The enhanced calendar includes drag-and-drop scheduling, bulk operations for managing multiple workouts, quick edit modals for workout instances, and visual indicators for track assignments and workout status. The component integrates with existing scheduling services from `src/server/scheduling-service.ts` and leverages the established `schedulingActions.ts` server actions. Admin-specific permissions are enforced using `src/utils/team-auth.ts` with the `TEAM_PERMISSIONS.SCHEDULE_WORKOUTS` permission. The calendar supports month, week, and day views with smooth transitions and responsive design optimized for desktop admin usage. Comprehensive logging tracks all scheduling operations, permission checks, and user interactions.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test tests/components/admin/AdminScheduleCalendar.test.tsx`
    - **Expected Outcome:** Calendar renders correctly, supports drag-and-drop scheduling, handles bulk operations, and enforces admin permissions
2.  **Logging Check:**
    - **Action:** Schedule a workout via drag-and-drop in the admin calendar
    - **Expected Log:** `console.log('[AdminScheduleCalendar] Drag-and-drop scheduling workoutId: trwk_xxx to date: YYYY-MM-DD for teamId: team_xxx')`
    - **Toggle Mechanism:** `LOG_LEVEL=debug` environment variable for detailed calendar interactions

---

## Commit 3: feat: implement admin sidebar panels for track and workout management [docs/tasks/2025-06-11-12-41-centralized-admin-dashboard.md]

**Description:**
This commit creates two sidebar components that flank the central calendar: `src/components/admin/TrackManagementSidebar.tsx` (left sidebar) and `src/components/admin/QuickActionsSidebar.tsx` (right sidebar). The left sidebar displays active programming tracks for the team, shows track progress and statistics, provides quick access to track settings, and includes buttons for creating new tracks or managing existing ones. It integrates with `src/server/programming-tracks.ts` functions like `getTeamTracks` and displays data from `src/components/tracks/TrackWorkoutManager.tsx`. The right sidebar contains quick action buttons for common admin tasks: schedule workout, create new workout, manage team members, and view analytics. Both sidebars are collapsible to maximize calendar space when needed and include comprehensive error handling and loading states. Sidebar components communicate with the main calendar through React context or props to trigger updates when actions are performed. All sidebar actions are logged with structured data including user ID, team ID, and specific action taken.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test tests/components/admin/TrackManagementSidebar.test.tsx && pnpm test tests/components/admin/QuickActionsSidebar.test.tsx`
    - **Expected Outcome:** Sidebars render correctly, display team tracks and quick actions, handle user interactions, and communicate with calendar component
2.  **Logging Check:**
    - **Action:** Click "Create New Track" in the left sidebar
    - **Expected Log:** `console.log('[TrackManagementSidebar] Creating new track for teamId: team_xxx, userId: user_xxx')`
    - **Toggle Mechanism:** Development environment logs with `[AdminSidebar]` prefix for all sidebar interactions

---

## Commit 4: feat: implement admin dashboard data aggregation and performance optimization [docs/tasks/2025-06-11-12-41-centralized-admin-dashboard.md]

**Description:**
This commit optimizes the admin dashboard for performance and creates a centralized data management layer at `src/server/admin-dashboard.ts` that aggregates data from multiple sources. The service combines scheduled workouts from `src/server/scheduling-service.ts`, programming tracks from `src/server/programming-tracks.ts`, team information from `src/server/teams.ts`, and workout statistics. New functions include `getAdminDashboardData(teamId: string)` which returns a comprehensive dashboard data object, `getTeamSchedulingStats(teamId: string)` for analytics, and `getUpcomingScheduleOverview(teamId: string, days: number)` for calendar optimization. The implementation uses parallel data fetching with Promise.all to minimize load times and includes intelligent caching strategies for frequently accessed data. Error boundaries are implemented to gracefully handle partial data failures. Server-side caching is configured to reduce database queries for dashboard data that doesn't change frequently. Comprehensive logging tracks data fetch performance, cache hits/misses, and any errors during data aggregation using structured JSON logging when possible.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test tests/server/admin-dashboard.test.ts`
    - **Expected Outcome:** Dashboard data aggregation functions return correct data structure, handle errors gracefully, and optimize performance through parallel fetching
2.  **Logging Check:**
    - **Action:** Load admin dashboard and trigger data aggregation
    - **Expected Log:** `console.log('[AdminDashboard] Data aggregation completed for teamId: team_xxx in ${duration}ms. Cached: ${cacheStatus}')`
    - **Toggle Mechanism:** `LOG_LEVEL=info` for performance logging, `LOG_LEVEL=debug` for detailed data fetching operations
