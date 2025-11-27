# Plan: Remove Dynamic [teamId] from Admin Routes

## Tracking
- **Status**: Implemented
- **Created**: 2025-11-26
- **Plan Commit**: `1777bef`
- **Implementation Commit**: `3493475`
- **Branch**: `zac/remove-dynamic-admin-team`

## Summary
Remove `[teamId]` dynamic parameter from all admin team routes. Instead of URL-based team context (`/admin/teams/abc123/programming`), use session-based active team (`/admin/teams/programming`). This simplifies URLs and leverages the recently-added active team session storage.

## Goal
Migrate admin routes from `/admin/teams/[teamId]/...` to `/admin/teams/...`, using the active team from session cookie instead of URL parameter.

## Key Decisions
- **No backwards-compatible redirects** - old URLs will 404
- **Replace `/admin/teams` list** - team scheduling becomes the index
- **Remove `AdminTeamSwitcher`** - navbar team switcher handles active team

## Route Structure Change

| Old Route | New Route |
|-----------|-----------|
| `/admin/teams/[teamId]` | `/admin/teams` |
| `/admin/teams/[teamId]/programming` | `/admin/teams/programming` |
| `/admin/teams/[teamId]/programming/[trackId]` | `/admin/teams/programming/[trackId]` |
| `/admin/teams/[teamId]/scaling` | `/admin/teams/scaling` |
| `/admin/teams/[teamId]/schedule-week` | `/admin/teams/schedule-week` |
| `/admin/teams/[teamId]/classes` | `/admin/teams/classes` |
| `/admin/teams/[teamId]/coaches` | `/admin/teams/coaches` |
| `/admin/teams/[teamId]/gym-setup` | `/admin/teams/gym-setup` |
| `/admin/teams/[teamId]/schedule-templates` | `/admin/teams/schedule-templates` |
| `/admin/teams/[teamId]/schedule-templates/[id]` | `/admin/teams/schedule-templates/[id]` |
| `/admin/teams/[teamId]/competitions` | `/admin/teams/competitions` |
| `/admin/teams/[teamId]/competitions/new` | `/admin/teams/competitions/new` |
| `/admin/teams/[teamId]/competitions/[id]` | `/admin/teams/competitions/[id]` |
| `/admin/teams/[teamId]/competitions/[id]/edit` | `/admin/teams/competitions/[id]/edit` |
| `/admin/teams/[teamId]/competitions/[id]/divisions` | `/admin/teams/competitions/[id]/divisions` |
| `/admin/teams/[teamId]/competitions/series` | `/admin/teams/competitions/series` |
| `/admin/teams/[teamId]/competitions/series/new` | `/admin/teams/competitions/series/new` |
| `/admin/teams/[teamId]/competitions/series/[groupId]` | `/admin/teams/competitions/series/[groupId]` |
| `/admin/teams/[teamId]/competitions/series/[groupId]/edit` | `/admin/teams/competitions/series/[groupId]/edit` |

## Implementation Steps

### Phase 1: Create Shared Team Context Utility

Create `src/app/(admin)/admin/teams/_utils/get-team-context.ts`:
```typescript
import { getActiveOrPersonalTeamId, getSessionFromCookie } from "@/utils/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/db"
import { eq } from "drizzle-orm"
import { teamTable } from "@/db/schema"

export async function getAdminTeamContext() {
  const session = await getSessionFromCookie()
  if (!session?.userId) redirect("/sign-in")

  const teamId = await getActiveOrPersonalTeamId(session.userId)
  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.id, teamId),
  })

  if (!team) notFound()

  return { teamId, team, session }
}
```

### Phase 2: Update Layout

Move `[teamId]/layout.tsx` to `teams/layout.tsx`:
- Remove teamId param extraction
- Use `getAdminTeamContext()` instead
- Pass teamId to `AdminSidebar` (still needed for display)

### Phase 3: Migrate Pages (19 total)

**Pattern for pages WITHOUT nested params:**
```typescript
// Before
export default async function Page({ params }) {
  const { teamId } = await params
  // ...
}

// After
import { getAdminTeamContext } from "../_utils/get-team-context"

export default async function Page() {
  const { teamId, team } = await getAdminTeamContext()
  // ...
}
```

**Pattern for pages WITH nested params:**
```typescript
// Before
export default async function Page({ params }) {
  const { teamId, trackId } = await params
  // ...
}

// After
import { getAdminTeamContext } from "../../_utils/get-team-context"

export default async function Page({ params }) {
  const { teamId, team } = await getAdminTeamContext()
  const { trackId } = await params
  // ...
}
```

**Pages to migrate (in order):**
1. `[teamId]/page.tsx` → `page.tsx` (replaces team list)
2. `[teamId]/programming/page.tsx` → `programming/page.tsx`
3. `[teamId]/programming/[trackId]/page.tsx` → `programming/[trackId]/page.tsx`
4. `[teamId]/scaling/page.tsx` → `scaling/page.tsx`
5. `[teamId]/schedule-week/page.tsx` → `schedule-week/page.tsx`
6. `[teamId]/classes/page.tsx` → `classes/page.tsx`
7. `[teamId]/coaches/page.tsx` → `coaches/page.tsx`
8. `[teamId]/gym-setup/page.tsx` → `gym-setup/page.tsx`
9. `[teamId]/schedule-templates/page.tsx` → `schedule-templates/page.tsx`
10. `[teamId]/schedule-templates/[scheduleTemplateId]/page.tsx` → `schedule-templates/[scheduleTemplateId]/page.tsx`
11. `[teamId]/competitions/page.tsx` → `competitions/page.tsx`
12. `[teamId]/competitions/new/page.tsx` → `competitions/new/page.tsx`
13. `[teamId]/competitions/[competitionId]/page.tsx` → `competitions/[competitionId]/page.tsx`
14. `[teamId]/competitions/[competitionId]/edit/page.tsx` → `competitions/[competitionId]/edit/page.tsx`
15. `[teamId]/competitions/[competitionId]/divisions/page.tsx` → `competitions/[competitionId]/divisions/page.tsx`
16. `[teamId]/competitions/series/page.tsx` → `competitions/series/page.tsx`
17. `[teamId]/competitions/series/new/page.tsx` → `competitions/series/new/page.tsx`
18. `[teamId]/competitions/series/[groupId]/page.tsx` → `competitions/series/[groupId]/page.tsx`
19. `[teamId]/competitions/series/[groupId]/edit/page.tsx` → `competitions/series/[groupId]/edit/page.tsx`

### Phase 4: Update AdminSidebar

Update `admin/_components/admin-sidebar.tsx`:
- Change all nav URLs from `/admin/teams/${teamId}/...` to `/admin/teams/...`
- Keep `currentTeamId` prop for team name display (if used)

### Phase 5: Remove AdminTeamSwitcher

- Delete `admin/_components/admin-team-switcher.tsx`
- Remove imports/usages in layout and other components

### Phase 6: Update Internal Links

Search and update all links containing `/admin/teams/${teamId}`:

**Files inside [teamId] routes (will be moved):**
- `competitions/series/new/_components/competition-group-form.tsx`
- `competitions/series/_components/competition-groups-list.tsx`
- `competitions/series/[groupId]/edit/_components/competition-group-edit-form.tsx`
- `competitions/series/[groupId]/_components/competition-group-actions.tsx`
- `competitions/_components/competitions-list.tsx`
- `competitions/_components/competition-form.tsx`
- `competitions/[competitionId]/edit/_components/competition-edit-form.tsx`
- `competitions/[competitionId]/_components/competition-actions.tsx`
- `programming/_components/programming-track-row.tsx`
- `schedule-templates/_components/ScheduleTemplates.tsx`
- `classes/_components/Classes.tsx`

**Files OUTSIDE [teamId] routes (must update separately):**
- `src/components/nav/mobile-nav.tsx`
- `src/components/nav/schedule-dropdown.tsx`
- `src/components/programming/subscriptions-list.tsx`
- `src/components/programming/enhanced-track-row.tsx`
- `src/app/(main)/teams/_components/team-page-client.tsx`
- `src/app/(main)/workouts/[id]/_components/workout-detail-client.tsx`
- `src/app/(settings)/settings/teams/_components/teams.tsx`
- `src/app/(admin)/admin/_components/admin-layout-wrapper.tsx`

**Action files to update (revalidatePath calls):**
- `[teamId]/_actions/programming-track-actions.ts` → move to `_actions/`
- `[teamId]/_actions/scheduling-actions.ts` → move to `_actions/`
- `src/actions/competition-actions.ts`
- `src/actions/workout-actions.ts`

### Phase 7: Move Supporting Directories

- `[teamId]/_actions/` → `_actions/` (at teams level)
- `[teamId]/_components/` → `_components/` (at teams level, merge)
- `[teamId]/_utils/` → `_utils/` (at teams level, merge)

### Phase 8: Cleanup

- Delete `[teamId]/` directory entirely
- Delete old `teams/page.tsx` (team list page)
- Verify no references to old URLs remain

## Critical Files to Read Before Implementation

1. `src/app/(admin)/admin/teams/[teamId]/layout.tsx` - Current layout logic
2. `src/app/(admin)/admin/_components/admin-sidebar.tsx` - Nav URL generation
3. `src/app/(admin)/admin/_components/admin-team-switcher.tsx` - To remove
4. `src/utils/auth.ts` - `getActiveOrPersonalTeamId()` function
5. `src/app/(admin)/admin/teams/[teamId]/page.tsx` - Example page pattern
6. `src/app/(admin)/admin/teams/[teamId]/programming/[trackId]/page.tsx` - Nested param example
7. `src/app/(admin)/admin/teams/page.tsx` - Current team list (to replace)
