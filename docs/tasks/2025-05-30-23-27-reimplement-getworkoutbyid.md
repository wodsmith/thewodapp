# Task: Re-implement getWorkoutById and Related Server Actions

## Commit 1: feat: implement getWorkoutById database function [docs/tasks/2025-05-30-23-27-reimplement-getworkoutbyid.md]

**Description:**
Create `getWorkoutById` in `src/db/` following the style of the provided `getResultSetsById` and `getWorkoutResultsByWorkoutAndUser` functions. Add contextual logging for all DB operations and errors. Use structured log output (e.g., key-value pairs). Ensure logging is toggleable via an environment variable (e.g., `LOG_LEVEL`).

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test --filter src/db/getWorkoutById.test.ts`
    - **Expected Outcome:** 'Returns correct workout object for valid ID; returns null or error for invalid ID.'
2.  **Logging Check:**
    - **Action:** 'Call getWorkoutById with valid and invalid IDs.'
    - **Expected Log:** 'INFO: Fetching workout by id: <id>'; 'ERROR: Error fetching workout by id: <id>'
    - **Toggle Mechanism:** 'LOG_LEVEL=info'

---

## Commit 2: feat: add getWorkoutById server action [docs/tasks/2025-05-30-23-27-reimplement-getworkoutbyid.md]

**Description:**
Create a server action in `src/actions/` for `getWorkoutById`. This action should call the DB function, handle errors, and log all requests and responses. Follow the style of `@actions/workout-actions.ts`. Ensure logs are structured and toggleable.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test --filter src/actions/getWorkoutById.test.ts`
    - **Expected Outcome:** 'Returns correct data for valid ID, handles errors gracefully.'
2.  **Logging Check:**
    - **Action:** 'Invoke server action with valid/invalid IDs.'
    - **Expected Log:** 'INFO: getWorkoutById action called with id: <id>'; 'ERROR: getWorkoutById action failed for id: <id>'
    - **Toggle Mechanism:** 'LOG_LEVEL=info'

---

## Commit 3: feat: implement getResultSetsById and getWorkoutResultsByWorkoutAndUser server actions [docs/tasks/2025-05-30-23-27-reimplement-getworkoutbyid.md]

**Description:**
Create server actions in `src/actions/` for `getResultSetsById` and `getWorkoutResultsByWorkoutAndUser` using the provided reference code. Add structured, toggleable logging for all operations and errors. Ensure error handling is robust and matches the new framework style.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test --filter src/actions/getResultSetsById.test.ts && pnpm test --filter src/actions/getWorkoutResultsByWorkoutAndUser.test.ts`
    - **Expected Outcome:** 'Returns correct sets/results for valid IDs; handles errors and empty results.'
2.  **Logging Check:**
    - **Action:** 'Call actions with valid/invalid IDs.'
    - **Expected Log:** 'INFO: Fetching sets/results for id: <id>'; 'ERROR: Error fetching sets/results for id: <id>'
    - **Toggle Mechanism:** 'LOG_LEVEL=info'

---

## Commit 4: test: add integration tests for workout detail page [docs/tasks/2025-05-30-23-27-reimplement-getworkoutbyid.md]

**Description:**
Add integration tests for `/src/app/(main)/workouts/[id]/page.tsx` to verify correct data loading and error handling using the new server actions. Ensure tests cover both success and failure cases. Add log assertions if possible.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test --filter src/app/(main)/workouts/[id]/page.test.tsx`
    - **Expected Outcome:** 'Page renders correct workout details for valid ID, shows error for invalid ID.'
2.  **Logging Check:**
    - **Action:** 'Run integration tests with logging enabled.'
    - **Expected Log:** 'INFO: Page loaded workout id: <id>'; 'ERROR: Failed to load workout id: <id>'
    - **Toggle Mechanism:** 'LOG_LEVEL=info'
