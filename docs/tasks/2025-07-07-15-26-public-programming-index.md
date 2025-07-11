# Task: Public Programming Tracks Index Page

## Commit 1: feat: add getPublicProgrammingTracks server helper
**Description:**
- Add `getPublicProgrammingTracks` to `src/server/programming-tracks.ts`.
- Query `programmingTracksTable` where `isPublic = 1`.
- Return minimal safe fields: `id`, `name`, `description`, `type`, `ownerTeamId`.
- Include structured `console.log` statements at start/end with count returned.

**Verification:**
1. Automated Test(s):
   * Command: `pnpm vitest run test/server/getPublicProgrammingTracks.test.ts`
   * Expected Outcome: Asserts returned array length matches number of inserted public tracks and excludes private tracks.
2. Logging Check:
   * Action: Run test; inspect console for `INFO: [getPublicProgrammingTracks] fetched X public tracks`.
   * Toggle Mechanism: `LOG_LEVEL=info` env var (existing logger uses this).

---

## Commit 2: feat: expose server action for public tracks
**Description:**
- Create `src/app/(main)/programming/_actions/get-public-programming-tracks.action.ts` using zsa pattern.
- Import `getPublicProgrammingTracks` and return data.
- Add `import "server-only"` guard and ZSA error handling.

**Verification:**
1. Automated Test(s):
   * Command: `pnpm vitest run test/actions/getPublicProgrammingTracks.action.test.ts`
   * Expected Outcome: Action returns same data as helper.
2. Logging Check:
   * Action: Call action in test; check for `ACTION: getPublicProgrammingTracks` log message.
   * Toggle Mechanism: `LOG_LEVEL=debug`.

---

## Commit 3: feat: implement Programming index page UI
**Description:**
- Edit `src/app/(main)/programming/page.tsx` (currently empty).
- Make it a Server Component.
- `await getPublicProgrammingTracks()` inside component.
- Render tracks list: Card per track with name, description.
- Use Shadcn `Card` component; tailwind grid responsive.
- Add placeholder `Subscribe` button (disabled) for future.

**Verification:**
1. Automated Test(s):
   * Command: `pnpm vitest run test/pages/programmingIndex.test.tsx`
   * Expected Outcome: Renders list length equal to mock data, contains track names.
2. Logging Check:
   * Action: Visit `/programming` in dev; console shows `PAGE: /programming rendered X tracks`.
   * Toggle Mechanism: `LOG_LEVEL=info`.

---

## Commit 4: test: unit tests for helper & page
**Description:**
- Add `test/server/getPublicProgrammingTracks.test.ts` with in-memory D1 mock.
- Add `test/pages/programmingIndex.test.tsx` using React Testing Library.

**Verification:**
- Commands above pass with green status; `pnpm test --filter getPublicProgrammingTracks` etc.

---

## Commit 5: docs: update project plan and README
**Description:**
- Append new feature to `docs/project-plan.md` under "Upcoming Features".

**Verification:**
- Manual: Ensure docs build and link.

---