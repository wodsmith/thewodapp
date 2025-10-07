# Task: Implement Programming Track Subscription Feature for Teams

## Commit 1: feat: create programming route and list page [docs/tasks/2025-09-03-17-03-programming-subscription.md]
**Description:**
Create a new `/programming` route under the main app layout that displays a list of all public programming tracks. This includes setting up the page structure at `src/app/(main)/programming/page.tsx`, creating a loading state at `src/app/(main)/programming/loading.tsx`, and implementing the server functions at `src/server/programming.ts` to fetch public tracks. The page will show track cards with name, description, type, owner team info, and a "Subscribe" button for each track.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm vitest run src/server/programming.test.ts`
    *   **Expected Outcome:** `Test suite passes with assertions that getPublicProgrammingTracks returns only public tracks with correct fields (id, name, description, type, ownerTeam)`
2.  **Logging Check:**
    *   **Action:** `Navigate to /programming route and check browser console/network tab`
    *   **Expected Log:** `INFO: Fetching public programming tracks for teamId: <current_team_id>`
    *   **Toggle Mechanism:** `LOG_LEVEL=info in .env file`

---

## Commit 2: feat: add server actions for track subscription [docs/tasks/2025-09-03-17-03-programming-subscription.md]
**Description:**
Implement server actions in `src/actions/programming-actions.ts` for managing track subscriptions. Create `subscribeToTrackAction` and `unsubscribeFromTrackAction` using ZSA pattern similar to existing team-actions. These actions will handle the insertion/deletion of records in the `teamProgrammingTracksTable` with proper team authorization checks using `getSessionFromCookie()` and team validation utilities from `src/utils/team-auth.ts`. Include proper error handling and response structure.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm vitest run src/actions/programming-actions.test.ts`
    *   **Expected Outcome:** `Tests verify that subscribeToTrackAction creates a record in teamProgrammingTracksTable with correct teamId, trackId, and isActive=1`
2.  **Logging Check:**
    *   **Action:** `Call subscribeToTrackAction with invalid permissions`
    *   **Expected Log:** `ERROR: Unauthorized subscription attempt - User <userId> lacks MANAGE_PROGRAMMING permission for team <teamId>`
    *   **Toggle Mechanism:** `LOG_LEVEL=debug`

---

## Commit 3: feat: implement subscription UI components [docs/tasks/2025-09-03-17-03-programming-subscription.md]
**Description:**
Create React components for the programming tracks UI. Build `src/components/programming/track-card.tsx` to display individual track information with subscribe/unsubscribe buttons. Create `src/components/programming/track-list.tsx` to render a grid of track cards. Implement `src/components/programming/subscribe-button.tsx` using `useServerAction` hook from @repo/zsa-react to call the subscription actions with loading states, error handling, and optimistic updates. Add success/error toast notifications using the existing toast system.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm vitest run test/components/programming/subscribe-button.test.tsx`
    *   **Expected Outcome:** `Component test verifies button shows "Subscribe" when not subscribed, "Unsubscribe" when subscribed, and handles loading states correctly`
2.  **Logging Check:**
    *   **Action:** `Click Subscribe button on a track card`
    *   **Expected Log:** `INFO: Track subscription UI action initiated for track: <trackId> by team: <teamId>`
    *   **Toggle Mechanism:** `LOG_LEVEL=info`

---

## Commit 4: feat: add team subscriptions management page [docs/tasks/2025-09-03-17-03-programming-subscription.md]
**Description:**
Create a team-specific subscriptions management page at `src/app/(main)/programming/subscriptions/page.tsx` that shows the current team's active track subscriptions. Implement `getTeamProgrammingTracks` server function in `src/server/programming.ts` to fetch subscribed tracks with their details. Add a `getTeamSubscriptionsAction` in `src/actions/programming-actions.ts`. Include options to view track details, set as default track (updating `teamTable.defaultTrackId`), and unsubscribe from tracks. Add proper permission checks using `TEAM_PERMISSIONS.MANAGE_PROGRAMMING`.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm vitest run src/server/programming.test.ts --grep "getTeamProgrammingTracks"`
    *   **Expected Outcome:** `Test confirms function returns only active subscriptions for the specified teamId with joined track details`
2.  **Logging Check:**
    *   **Action:** `Set a track as default for team`
    *   **Expected Log:** `INFO: Default track updated for team <teamId> to track <trackId>`
    *   **Toggle Mechanism:** `LOG_LEVEL=info`

---

## Commit 5: test: add integration tests and update navigation [docs/tasks/2025-09-03-17-03-programming-subscription.md]
**Description:**
Add comprehensive integration tests in `test/integration/programming-subscription.test.ts` covering the full subscription flow: listing tracks, subscribing, viewing subscriptions, and unsubscribing. Update the main navigation component at `src/components/layout/main-nav.tsx` to include a "Programming" link that routes to `/programming`. Ensure the link is visible only to users with appropriate permissions. Run full test suite and fix any type errors with `pnpm type-check` and `pnpm lint`.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm vitest run test/integration/programming-subscription.test.ts`
    *   **Expected Outcome:** `All integration tests pass, covering: public track listing, subscription creation, subscription listing, default track setting, and unsubscription`
2.  **Logging Check:**
    *   **Action:** `Complete full subscription flow from UI`
    *   **Expected Log:** `INFO: Programming subscription flow completed successfully for team <teamId>`
    *   **Toggle Mechanism:** `LOG_LEVEL=info`