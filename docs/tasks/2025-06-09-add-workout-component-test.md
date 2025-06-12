# Task: Add Vitest Component Testing for Workouts

## Commit 1: feat: install and configure vitest for component testing [docs/tasks/2025-06-09-15-39-add-workout-component-tests.md]

**Description:**
Install Vitest, Testing Library, and jsdom to enable component testing.
Create the Vitest configuration file `vitest.config.ts` to set up the test environment for React components.
Update `tsconfig.json` to include vitest-dom types.
Add a `test` script to `package.json`.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test`
    - **Expected Outcome:** Vitest should run and show a "no tests found" message without errors.
2.  **Logging Check:**
    - **Action:** N/A
    - **Expected Log:** N/A
    - **Toggle Mechanism:** N/A

---

## Commit 2: test: create tests for SetDetails component [docs/tasks/2025-06-09-15-39-add-workout-component-tests.md]

**Description:**
Create a test file `src/app/(main)/workouts/[id]/_components/set-details.test.tsx`.
Write unit tests for the `SetDetails` component to verify it correctly renders set information based on the props provided.

- Test with a full set of data.
- Test with partial data (e.g., only reps and weight).
- Test with no sets or an empty array.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test --filter set-details.test.tsx`
    - **Expected Outcome:** All tests for `SetDetails` should pass.
2.  **Logging Check:**
    - **Action:** N/A
    - **Expected Log:** N/A
    - **Toggle Mechanism:** N/A

---

## Commit 3: test: create tests for WorkoutControls component [docs/tasks/2025-06-09-15-39-add-workout-component-tests.md]

**Description:**
Create a test file `src/app/(main)/workouts/_components/WorkoutControls.test.tsx`.
Write tests for the `WorkoutControls` component to ensure that:

- It renders the search input and select dropdowns correctly.
- Interacting with the controls updates the URL search parameters as expected.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test --filter WorkoutControls.test.tsx`
    - **Expected Outcome:** All tests for `WorkoutControls` should pass.
2.  **Logging Check:**
    - **Action:** N/A
    - **Expected Log:** N/A
    - **Toggle Mechanism:** N/A

---

## Commit 4: test: create tests for CreateWorkoutClient component [docs/tasks/2025-06-09-15-39-add-workout-component-tests.md]

**Description:**
Create a test file `src/app/(main)/workouts/new/_components/create-workout-client.test.tsx`.
Write integration tests for the `CreateWorkoutClient` component to verify:

- The form renders with all expected fields.
- User input is correctly handled and state is updated.
- Form submission calls the `createWorkoutAction` with the correct payload.
- Tag and movement selection works as expected.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test --filter create-workout-client.test.tsx`
    - **Expected Outcome:** All tests for `CreateWorkoutClient` should pass.
2.  **Logging Check:**
    - **Action:** N/A
    - **Expected Log:** N/A
    - **Toggle Mechanism:** N/A

---

## Commit 5: test: create tests for EditWorkoutClient component [docs/tasks/2025-06-09-15-39-add-workout-component-tests.md]

**Description:**
Create a test file `src/app/(main)/workouts/[id]/edit/_components/edit-workout-client.test.tsx`.
Write integration tests for the `EditWorkoutClient` component to ensure:

- The form is pre-populated with existing workout data.
- User can modify the form fields and the state is updated.
- Form submission calls the `updateWorkoutAction` with the updated data.
- Tag and movement selection and deselection works correctly.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test --filter edit-workout-client.test.tsx`
    - **Expected Outcome:** All tests for `EditWorkoutClient` should pass.
2.  **Logging Check:**
    - **Action:** N/A
    - **Expected Log:** N/A
    - **Toggle Mechanism:** N/A

---

## Commit 6: test: create tests for WorkoutDetailClient component [docs/tasks/2025-06-09-15-39-add-workout-component-tests.md]

**Description:**
Create a test file `src/app/(main)/workouts/[id]/_components/workout-detail-client.test.tsx`.
Write tests for the `WorkoutDetailClient` component to verify:

- It correctly renders all workout details, including description, scheme, movements, and tags.
- The "Edit Workout" button is only visible to the workout's owner.
- It displays workout results and their corresponding sets correctly.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test --filter workout-detail-client.test.tsx`
    - **Expected Outcome:** All tests for `WorkoutDetailClient` should pass.
2.  **Logging Check:**
    - **Action:** N/A
    - **Expected Log:** N/A
    - **Toggle Mechanism:** N/A
