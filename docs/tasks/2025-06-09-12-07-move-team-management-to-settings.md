# Task: Move Team Management from Dashboard to Settings

## Commit 1: feat: Relocate team management pages to settings

**Description:**
Move the core pages for team management from `src/app/(dashboard)/dashboard/teams` to `src/app/(settings)/settings/teams`. This includes the page for creating a new team and the page for managing an existing team. All associated components will be moved as well. The primary link in the settings area will also be updated.

- Move directory `src/app/(dashboard)/dashboard/teams/[teamSlug]` to `src/app/(settings)/settings/teams/[teamSlug]`.
- Move directory `src/app/(dashboard)/dashboard/teams/create` to `src/app/(settings)/settings/teams/create`.
- In `src/app/(settings)/settings/teams/_components/teams.tsx`, update the `Link` component's `href` prop to point to `/settings/teams/${team.slug}` instead of `/dashboard/teams/${team.slug}`.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm test:e2e`
    - **Expected Outcome:** Existing E2E tests for team navigation should be updated and pass with the new `/settings/teams` routes.
2.  **Logging Check:**
    - **Action:** Navigate to `/settings/teams`, click a team, and navigate to the create page.
    - **Expected Log:** Server-side logs should confirm the rendering of `.../settings/teams/[teamSlug]/page.tsx` and `.../settings/teams/create/page.tsx`.
    - **Toggle Mechanism:** Standard `console.log` during development.

---

## Commit 2: feat: Display team members and pending invitations in settings

**Description:**
On the team management page (`/settings/teams/[teamSlug]`), display the list of current team members and a list of pending invitations. This involves creating new components that fetch data using existing server actions.

- Create `src/app/(settings)/settings/teams/[teamSlug]/_components/team-members.tsx` to list members, using `getTeamMembersAction`.
- Create `src/app/(settings)/settings/teams/[teamSlug]/_components/team-invitations.tsx` to list pending invites, using `getTeamInvitationsAction`.
- Integrate these new components into the `src/app/(settings)/settings/teams/[teamSlug]/page.tsx`.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm vitest run src/app/(settings)/settings/teams/[teamSlug]/_components/team-members.test.tsx`
    - **Expected Outcome:** A new unit test will verify that the `team-members` component correctly renders a list of members returned from a mocked `getTeamMembersAction`.
2.  **Logging Check:**
    - **Action:** Load a team's settings page.
    - **Expected Log:** The server action logs in `src/actions/team-membership-actions.ts` should show "Failed to get team members" on error, or you can add a success log to trace execution.
    - **Toggle Mechanism:** Relies on existing `console.error` in action handlers.

---

## Commit 3: feat: Add member invitation form to team settings

**Description:**
Implement the user interface for inviting new members to a team. This will be a form available to team owners on the team management page.

- Create `src/app/(settings)/settings/teams/[teamSlug]/_components/invite-member.tsx`.
- This component will include a form for an email address and role selection. It will call `inviteUserAction` on submit.
- Add logic to ensure the form is only rendered for users with the appropriate permissions (e.g., 'owner' role).

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm vitest run src/app/(settings)/settings/teams/[teamSlug]/_components/invite-member.test.tsx`
    - **Expected Outcome:** A new unit test will mock the `useServerAction` hook for `inviteUserAction`, simulate form submission, and assert that the action is called with the correct email and role.
2.  **Logging Check:**
    - **Action:** Submit the invitation form with a test email.
    - **Expected Log:** The server action log in `src/actions/team-membership-actions.ts` should show "Failed to invite user:" on error, or you can add a success log.
    - **Toggle Mechanism:** Relies on existing `console.error` in action handlers.

---

## Commit 4: chore: Remove obsolete dashboard team pages

**Description:**
Once the new team management section in settings is fully functional and verified, remove the old, now-unused directory from the dashboard area to clean up the codebase.

- Delete the entire `src/app/(dashboard)/dashboard/teams` directory.

**Verification:**

1.  **Automated Test(s):**
    - **Command:** `pnpm build`
    - **Expected Outcome:** The Next.js build should complete successfully, indicating there are no broken imports pointing to the deleted files.
2.  **Manual Check:**
    - **Action:** Manually try to navigate to `/dashboard/teams` or `/dashboard/teams/create`.
    - **Expected Outcome:** Both routes should now result in a 404 "Not Found" page.
