# Plan: Move Competition Admin to /compete

## Implementation Status

**Status:** Phase 1-3 Complete ✅

**Commit:** `590df36` - feat: move competition admin to /compete/organizer

**Completed:**
- ✅ Phase 1: Core Routes (organizer dashboard, CRUD pages, divisions)
- ✅ Phase 2: Navigation Integration (CompeteNav, Manage button)
- ✅ Phase 3: Admin Cleanup (removed competitions from admin)

**Pending:**
- ⏳ Phase 4: Polish (styling, mobile, breadcrumbs, loading states)
- ⏳ Series management routes (not yet migrated)

---

## Summary
Move competition management from `/admin/teams/competitions` to `/compete/organizer` as a compete-first product experience. Remove competition routes from admin entirely.

## Team Context Decision

**Recommendation: Stay signed in as organizing team (gym)**

The database has two team concepts:
- `organizingTeamId` - The gym that owns/creates competitions (user-facing)
- `competitionTeamId` - Auto-created internal team for athlete membership (internal only)

**Why organizing team context:**
1. Natural ownership model - gym owns competition
2. Already has MANAGE_PROGRAMMING permission
3. No context switching needed between competitions
4. Simpler UX - manage all competitions from one session
5. Competition team is purely internal (for athlete memberships)

**Implementation:** User stays signed into their gym team. Permission checks use `organizingTeamId`. No team switching needed.

## Route Structure

```
/compete/organizer/                       (Organizer Dashboard)
├── page.tsx                              (My Competitions list)
├── new/page.tsx                          (Create competition)
├── [competitionId]/
│   ├── page.tsx                          (Competition overview)
│   ├── edit/page.tsx                     (Edit competition)
│   └── divisions/page.tsx                (Manage divisions)
└── series/
    ├── page.tsx                          (Series list)
    ├── new/page.tsx                      (Create series)
    └── [groupId]/
        ├── page.tsx                      (Series detail)
        └── edit/page.tsx                 (Edit series)

/compete/[slug]/                          (Public views - existing)
└── (add "Manage" button for organizers)
```

## Navigation

**CompeteNav updates:**
```tsx
// For authenticated users with organizing permissions:
<Link href="/compete/organizer">My Competitions</Link>
<Link href="/compete/organizer/new">+ Create</Link>
```

**Public competition pages:**
- Show "Manage" button if user has MANAGE_PROGRAMMING on organizingTeamId
- Links to `/compete/organizer/[competitionId]`

## Team Selection (Multi-Team Users)

For users who manage multiple gyms:
1. Show team selector in organizer dashboard header
2. Filter "My Competitions" by selected team
3. Pre-select team when creating new competition
4. Use session's active team as default

Helper function:
```typescript
// src/utils/get-user-organizing-teams.ts
export async function getUserOrganizingTeams(userId: string) {
  // Returns teams where user has MANAGE_PROGRAMMING permission
}
```

## Implementation Phases

### Phase 1: Core Routes (Create organizer structure)
1. Create `/compete/organizer/layout.tsx` with team context
2. Create organizer dashboard page with competition list
3. Create new competition page (reuse CompetitionForm)
4. Create competition detail/edit pages

### Phase 2: Navigation Integration
1. Update CompeteNav with organizer links (conditional on permission)
2. Add "Manage" button to public competition pages
3. Create team selector for multi-team users

### Phase 3: Admin Cleanup
1. Update admin sidebar to remove competitions section
2. Delete `/admin/teams/competitions/` routes
3. Delete `/admin/teams/[teamId]/competitions/` routes
4. Update any stale links/references

### Phase 4: Polish
1. Styling to match compete aesthetic
2. Mobile responsive organizer views
3. Breadcrumb navigation
4. Empty states and loading states

## Key Components to Reuse

From `/admin/teams/[teamId]/competitions/_components/`:
- `competition-form.tsx` → Reuse for create/edit
- `competitions-list.tsx` → Adapt for organizer dashboard
- `competition-actions.tsx` → Reuse action menus
- `division-manager.tsx` → Reuse for divisions page

From `/admin/teams/[teamId]/competitions/series/_components/`:
- `competition-group-form.tsx` → Reuse for series
- `competition-groups-list.tsx` → Adapt for series page

## Authorization Pattern

```typescript
// In organizer pages:
const session = await getSessionFromCookie()
if (!session?.userId) redirect("/sign-in")

// Get user's organizing teams
const organizingTeams = await getUserOrganizingTeams(session.userId)
if (organizingTeams.length === 0) {
  // Show "No organizing permissions" state
  return <NoPermissionView />
}

// For specific competition actions:
await requireTeamPermission(competition.organizingTeamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
```

## Critical Files

**To Create:**
- `src/app/(compete)/compete/organizer/layout.tsx`
- `src/app/(compete)/compete/organizer/page.tsx`
- `src/app/(compete)/compete/organizer/new/page.tsx`
- `src/app/(compete)/compete/organizer/[competitionId]/page.tsx`
- `src/app/(compete)/compete/organizer/[competitionId]/edit/page.tsx`
- `src/app/(compete)/compete/organizer/[competitionId]/divisions/page.tsx`
- `src/app/(compete)/compete/organizer/series/**`
- `src/utils/get-user-organizing-teams.ts`

**To Modify:**
- `src/components/nav/compete-nav.tsx` - Add organizer links
- `src/app/(compete)/compete/[slug]/page.tsx` - Add manage button

**To Delete (Phase 3):**
- `src/app/(admin)/admin/teams/competitions/**`
- `src/app/(admin)/admin/teams/[teamId]/competitions/**`
- `src/app/(admin)/admin/_components/admin-sidebar.tsx` - Remove competitions section
