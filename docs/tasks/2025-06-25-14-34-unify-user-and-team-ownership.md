# Task: Unify User and Team Ownership

This plan outlines the steps to unify user and team ownership by ensuring every user has a personal team, and all user-created resources are associated with that team.

## Commit 1: feat: Create personal team for new users
**Description:**
Check the existing user creation logic out as this functionality might already exist.
Modify the user creation logic to automatically create a personal team for each new user. This will involve:
-   Updating the user sign-up action in `src/actions/user-actions.ts`.
-   Calling a new function, `createPersonalTeam`, within the sign-up action.
-   The `createPersonalTeam` function will create a new team with the `isPersonalTeam` flag set to true and the `personalTeamOwnerId` set to the new user's ID.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm test --filter user-actions.test.ts`
    *   **Expected Outcome:** A new test will be added to `test/actions/user-actions.test.ts` that asserts a new team is created with the correct properties (`isPersonalTeam`, `personalTeamOwnerId`) when the sign-up action is called.
2.  **Logging Check:**
    *   **Action:** Sign up a new user.
    *   **Expected Log:** `INFO: Personal team created for user: {userId}`
    *   **Toggle Mechanism:** `LOG_LEVEL=info`

---

## Commit 2: feat: Associate user resources with personal team
**Description:**
Modify the actions for creating resources that currently have a `userId` to associate them with the user's personal team instead. This will involve:
-   Updating the `workout-actions.ts` to get the user's personal team and associate the new workout with it.
-   Removing the `userId` from the `workouts` table and adding a `teamId` foreign key.
-   A data migration script will be created to backfill the `teamId` for existing workouts.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm test --filter workout-actions.test.ts`
    *   **Expected Outcome:** Tests in `test/actions/workout-actions.test.ts` will be updated to reflect that workouts are now associated with a `teamId` instead of a `userId`.
2.  **Logging Check:**
    *   **Action:** Create a new workout.
    *   **Expected Log:** `INFO: Workout created with teamId: {teamId} for user: {userId}`
    *   **Toggle Mechanism:** `LOG_LEVEL=info`

---

## Commit 3: feat: Update data access logic to use team ownership
**Description:**
Update all data access logic (queries, etc.) to use the new team-based ownership model. This will involve:
-   Refactoring queries in `src/server/queries.ts` that currently filter by `userId` to filter by `teamId`.
-   Ensuring that all authorization checks now use the team-based ownership model.

**Verification:**
1.  **Automated Test(s):**
    *   **Command:** `pnpm test --filter queries.test.ts`
    *   **Expected Outcome:** Tests in `test/server/queries.test.ts` will be updated to ensure that data is correctly filtered by `teamId`.
2.  **Logging Check:**
    *   **Action:** Fetch a list of workouts.
    *   **Expected Log:** `INFO: Fetching workouts for teamId: {teamId}`
    *   **Toggle Mechanism:** `LOG_LEVEL=info`
