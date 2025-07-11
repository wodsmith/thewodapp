# Task: Implement Track Subscription for Teams

## Commit 1: feat: add server-side subscription logic [docs/tasks/2025-07-09-16-08-subscribe-programming-tracks.md]
**Description:**
- Create `src/server/team-programming-tracks.ts` with two pure functions:
  - `subscribeTeamToTrack({ teamId, trackId })` → inserts into `teamProgrammingTracksTable` with `isActive=1` and `startDayOffset=0`.
  - `unsubscribeTeamFromTrack({ teamId, trackId })` → sets `isActive=0`.
- Add validation with Zod in `src/schemas/team-programming-track.schema.ts`.
- Integrate new functions into `src/server/programming-tracks.ts` exports.
- Implement toggleable structured logging via existing `src/lib/try-catch.ts` (`INFO: [TeamProgrammingTrackService] teamId="..." trackId="..." action="subscribe"`).
- Add unit tests in `test/server/teamProgrammingTracks.test.ts` using Vitest covering:
  - Successful subscribe (row exists with correct values).
  - Idempotent subscribe (calling twice doesn’t duplicate).
  - Unsubscribe sets `isActive` to 0.

**Verification:**
1. Automated Tests:
   * Command: `pnpm vitest run test/server/teamProgrammingTracks.test.ts`
   * Expected Outcome: All tests pass, proving correct DB mutations.
2. Logging Check:
   * Action: Run unit test with `LOG_LEVEL=debug`.
   * Expected Log: `INFO: [TeamProgrammingTrackService] teamId="team_123" trackId="track_abc" action="subscribe"`.
   * Toggle Mechanism: `LOG_LEVEL` env variable.

---

## Commit 2: feat: server action for track subscription [docs/tasks/2025-07-09-16-08-subscribe-programming-tracks.md]
**Description:**
- Create `src/actions/subscribe-track.action.ts` via ZSA:
  - Input: `{ trackId: z.string(), teamId: z.string().optional() }`.
  - If `teamId` omitted, resolve personal team via `getUserPersonalTeam(userId)`.
  - Call `subscribeTeamToTrack()`.
- Add error handling (`ZSAError`) and logging (`ACTION: subscribeTrack ...`).
- Write integration test `test/actions/subscribeTrack.action.test.ts` mocking DB & session.

**Verification:**
1. Automated Tests:
   * Command: `pnpm vitest run test/actions/subscribeTrack.action.test.ts`
   * Expected Outcome: Action returns `{ success: true }` and DB row appears.
2. Logging Check:
   * Action: Trigger action in test with `LOG_LEVEL=debug`.
   * Expected Log: `ACTION: subscribeTrack user="user_123" teamId="team_456" trackId="track_abc"`.
   * Toggle Mechanism: `LOG_LEVEL`.

---

## Commit 3: feat: UI components & client workflow [docs/tasks/2025-07-09-16-08-subscribe-programming-tracks.md]
**Description:**
- Add `src/components/programming/subscribe-button.tsx` ("use client"):
  - Shows “Subscribe” or “Subscribed”.
  - On click: fetch user-owned teams via `/api/get-session` or dedicated action.
  - If >1 teams, open Radix `DropdownMenu` listing teams → selecting calls server action with chosen teamId.
  - If only one team, directly invoke action with that teamId.
  - Uses `useServerAction` from `zsa-react` for optimistic UI.
- Integrate button in:
  - `src/app/(main)/programming/_components/track-row.tsx` (list view).
  - `src/app/(main)/programming/[trackId]/page.tsx` (detail view).
- Add client-side toast notification via Shadcn `useToast`.
- Add logging: `console.log("UI: subscribe clicked track", trackId)`.

**Verification:**
1. Automated Tests:
   * Command: `pnpm vitest run test/components/subscribe-button.test.tsx`
   * Expected Outcome: Renders dropdown when multiple teams mocked, directly calls action when one team.
2. Logging Check:
   * Action: Interact in Storybook or test, observe console log “UI: subscribe clicked track track_abc”.
   * Toggle Mechanism: Browser console; logs removed in production build via Biome rule.

---

## Commit 4: test: e2e flow & documentation [docs/tasks/2025-07-09-16-08-subscribe-programming-tracks.md]
**Description:**
- Add integration test `test/pages/subscribeTrackFlow.test.tsx`:
  - Render `ProgrammingTracksPage` with mocked session containing multi-team user.
  - Simulate subscribe flow verifying DB state via Drizzle in-memory.
- Update docs:
  - `docs/diagrams/database-schema-2025-07-09.md` → highlight `team_programming_track` subscription path.
  - Add README section in `docs/multi-tenancy-report.md` detailing ownership check logic.

**Verification:**
1. Automated Tests:
   * Command: `pnpm vitest run test/pages/subscribeTrackFlow.test.tsx`
   * Expected Outcome: Subscribe flow completes, page re-renders with “Subscribed”.
2. Logging Check:
   * Action: Run test with `LOG_LEVEL=debug`.
   * Expected Log: Combination of service, action, and UI logs across flow.
   * Toggle Mechanism: `LOG_LEVEL`.