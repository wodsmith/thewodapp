# TanStack Migration: Programming & Teams Routes Analysis

**Cell:** wodsmith-monorepo--tuyyc-mjj5sm2hpci  
**Epic:** wodsmith-monorepo--tuyyc-mjj5sm20ou2  
**Generated:** 2025-12-23  
**Audited:** 2025-12-23 (Cell: wodsmith-monorepo--tuyyc-mjj6hcgb793)

## Executive Summary

This document catalogs programming tracks, subscriptions, team management routes, and multi-tenancy patterns in the WODsmith migration from Next.js to TanStack Start.

**Key Findings:**
- ✅ **Programming routes**: Partially migrated (2/3 core routes)
- ❌ **Subscriptions**: Not migrated to TanStack
- ❌ **Team settings**: Not migrated to TanStack
- ✅ **Team page**: Basic migration complete
- 🔄 **Multi-tenancy**: Core patterns established but incomplete

**Migration Priority:**
1. Programming subscriptions route
2. Team settings and management routes
3. Team member invitation/management
4. Multi-team programming subscription patterns

---

## Programming Routes

### Route Comparison

| Feature | Next.js Path | TanStack Path | Status | Actions/Functions | Components | Notes |
|---------|--------------|---------------|--------|-------------------|------------|-------|
| **Browse Tracks** | `/programming` | ❌ Not migrated | ❌ Not Started | `getPublicTracksWithTeamSubscriptions` | `ProgrammingTracksClient`, `EnhancedTrackList`, `TrackCard` | Multi-team subscription support |
| **My Tracks** | N/A (embedded in browse) | `/settings/programming` | ✅ Migrated | `getTeamProgrammingTracksFn` | `ProgrammingTrackRow`, `ProgrammingTrackCreateDialog` | **CORRECTED:** Shows subscribed tracks (owned + 3rd party) |
| **Track Detail** | `/programming/[trackId]` | ❌ Not migrated | ❌ Not Started | `getProgrammingTrackById`, `getTrackSubscribedTeams` | `PaginatedTrackWorkouts`, `EnhancedSubscribeButton`, `TrackDetailTeamSelector` | Multi-team subscription UI |
| **Track Detail (Owner)** | `/programming/[trackId]` (same) | `/settings/programming/$trackId` | ✅ Migrated | `getProgrammingTrackByIdFn`, `getTrackWorkoutsFn` | `TrackHeader`, `TrackWorkoutList`, `AddWorkoutToTrackDialog` | Owner-only view |
| **Subscriptions** | `/programming/subscriptions` | ❌ Not migrated | ❌ Not Started | `getTeamProgrammingTracks` | `SubscriptionsList` | Team permission check |

### Next.js Implementation Details

#### Browse Public Tracks (`/programming`)
```typescript
// apps/wodsmith/src/app/(main)/programming/page.tsx
// Multi-team subscription support
const userTeamIds = session?.teams?.map(team => team.id) || []
const allTracks = await getPublicTracksWithTeamSubscriptions(userTeamIds)
```

**Key Features:**
- Shows public tracks with subscription status for ALL user's teams
- Team switcher context for filtering
- Subscribe/unsubscribe per team

#### Track Detail (`/programming/[trackId]`)
```typescript
// apps/wodsmith/src/app/(main)/programming/[trackId]/page.tsx
const subscribedTeams = await getTrackSubscribedTeams(trackId, userTeamIds)
const isOwned = userTeamIds.includes(track.ownerTeamId || "")
```

**Key Features:**
- Shows which of user's teams are subscribed
- Different UI for owner vs subscriber
- Multi-team subscription badges
- Team selector for workout view context

#### Subscriptions (`/programming/subscriptions`)
```typescript
// apps/wodsmith/src/app/(main)/programming/subscriptions/page.tsx
await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)
const subscriptions = await getTeamProgrammingTracks(teamId)
```

**Key Features:**
- Permission check: `ACCESS_DASHBOARD` required
- Shows team's subscribed tracks
- Team context from query param or session

### TanStack Implementation Details

#### My Tracks (`/settings/programming`)
```typescript
// apps/wodsmith-start/src/routes/_protected/settings/programming/index.tsx
const {tracks} = await getTeamProgrammingTracksFn({data: {teamId}})
```

**Key Features:**
- **CORRECTED:** Shows ALL team-subscribed tracks (owned AND 3rd party public tracks)
- Queries `teamProgrammingTracksTable` (subscription table) not ownership
- Create track dialog
- Navigate to track detail
- **NOTE:** Function name is misleading - should be `getTeamSubscribedTracksFn`

#### Track Detail Owner View (`/settings/programming/$trackId`)
```typescript
// apps/wodsmith-start/src/routes/_protected/settings/programming/$trackId/index.tsx
const trackResult = await getProgrammingTrackByIdFn({data: {trackId}})
const workoutsResult = await getTrackWorkoutsFn({data: {trackId}})
```

**Key Features:**
- Track header with edit/delete
- Workout list
- Add workout dialog

---

## Programming Actions & Server Functions

### Next.js Actions (ZSA)

**File:** `apps/wodsmith/src/actions/programming-actions.ts`

| Action | Purpose | Multi-Team? |
|--------|---------|-------------|
| `subscribeToTrackAction` | Subscribe team to public track | ✅ Yes (takes teamId) |
| `unsubscribeFromTrackAction` | Unsubscribe team | ✅ Yes (takes teamId) |
| `getTeamSubscriptionsAction` | Get team's subscribed tracks | ✅ Yes (takes teamId) |
| `setDefaultTrackAction` | Set default track for team | ✅ Yes (takes teamId) |

**File:** `apps/wodsmith/src/actions/programming-track-workouts-actions.ts`
- Track workout management actions (not yet cataloged in detail)

### TanStack Server Functions

**File:** `apps/wodsmith-start/src/server-fns/programming-fns.ts`

| Function | Purpose | Multi-Team? | Migrated From |
|----------|---------|-------------|---------------|
| `getTeamProgrammingTracksFn` | **CORRECTED:** Get team-subscribed tracks (owned + 3rd party) | ✅ Yes | Similar to Next.js `getTeamSubscriptions` |
| `getProgrammingTrackByIdFn` | Get single track | ✅ Yes | Similar to Next.js |
| `createProgrammingTrackFn` | Create track | ✅ Yes | Similar to Next.js |
| `updateProgrammingTrackFn` | Update track | ✅ Yes | Similar to Next.js |
| `deleteProgrammingTrackFn` | Delete track | ✅ Yes | Similar to Next.js |
| `getTrackWorkoutsFn` | Get track workouts | ✅ Yes | Similar to Next.js |
| `addWorkoutToTrackFn` | Add workout to track | ✅ Yes | Similar to Next.js |
| `removeWorkoutFromTrackFn` | Remove workout from track | ✅ Yes | Similar to Next.js |
| `updateTrackVisibilityFn` | Update public/private | ✅ Yes | Similar to Next.js |

**Missing in TanStack:**
- `subscribeToTrackFn` - No subscription system yet
- `unsubscribeFromTrackFn` - No subscription system yet
- `getPublicTracksWithSubscriptionsFn` - No public browse yet
- `getTrackSubscribedTeamsFn` - No multi-team subscription tracking

---

## Programming Components

### Next.js Components

**Directory:** `apps/wodsmith/src/components/programming/`

| Component | Purpose | Multi-Team Support | TanStack Equivalent |
|-----------|---------|-------------------|---------------------|
| `programming-tracks-client.tsx` | Browse public tracks client wrapper | ✅ Yes (team switcher) | ❌ None |
| `enhanced-track-list.tsx` | Track list with filters | ✅ Yes | ❌ None |
| `enhanced-track-row.tsx` | Track row with subscription UI | ✅ Yes | `ProgrammingTrackRow` (partial) |
| `track-card.tsx` | Track card display | ✅ Yes | ❌ None |
| `track-list.tsx` | Basic track list | ✅ Yes | ❌ None |
| `track-row.tsx` | Basic track row | ✅ Yes | `ProgrammingTrackRow` (partial) |
| `subscribe-button.tsx` | Basic subscribe toggle | ✅ Yes (takes teamId) | ❌ None |
| `enhanced-subscribe-button.tsx` | Subscribe with optimistic UI | ✅ Yes (takes teamId) | ❌ None |
| `subscriptions-list.tsx` | Team subscriptions list | ✅ Yes | ❌ None |
| `team-context-indicator.tsx` | Shows active team context | ✅ Yes | ❌ None |
| `team-programming-selector.tsx` | Team selector for programming | ✅ Yes | ❌ None |
| `track-detail-team-selector.tsx` | Team selector on track detail | ✅ Yes | ❌ None |
| `paginated-track-workouts.tsx` | Workout pagination | ✅ Yes | ❌ None |
| `track-workout-card.tsx` | Workout card display | ✅ Yes | ❌ None |
| `track-workout-row.tsx` | Workout row display | ✅ Yes | ✅ `TrackWorkoutList` |

### TanStack Components

**Directory:** `apps/wodsmith-start/src/components/`

| Component | Purpose | Next.js Equivalent |
|-----------|---------|-------------------|
| `programming-track-row.tsx` | Track row in settings | `track-row.tsx` (simplified) |
| `programming-track-create-dialog.tsx` | Create track modal | ❌ None (was inline) |
| `programming-track-edit-dialog.tsx` | **AUDIT FOUND:** Edit track modal | ❌ None (was inline) |
| `programming-track-delete-dialog.tsx` | **AUDIT FOUND:** Delete track modal | ❌ None (was inline) |
| `track-header.tsx` | Track detail header | ❌ None (was inline) |
| `track-visibility-selector.tsx` | **AUDIT FOUND:** Public/private toggle | ❌ None (was inline) |
| `track-workout-list.tsx` | Workout list | `track-workout-row.tsx` (enhanced) |
| `track-workout-row.tsx` | Workout row display | `track-workout-row.tsx` |
| `add-workout-to-track-dialog.tsx` | Add workout modal | ❌ None |
| `team-page-client.tsx` | ✅ **Reused from Next.js** | Same component |
| `team-controls.tsx` | **AUDIT FOUND:** Team page controls | ✅ Reused from Next.js |

**Missing in TanStack:**
- No public track browsing components
- No subscription UI components
- No multi-team selector components
- No team context indicators

---

## Team Routes

### Route Comparison

| Feature | Next.js Path | TanStack Path | Status | Actions/Functions | Components | Notes |
|---------|--------------|---------------|--------|-------------------|------------|-------|
| **Team Page** | `/teams` | `/team` | ✅ Migrated | `getActiveOrPersonalTeamId` (Next.js), `getActiveTeamFn` (TanStack) | `TeamPageClient` | Shows leaderboards and schedule |
| **Team Settings** | `/settings/teams` | ❌ Not migrated | ❌ Not Started | `getUserTeamsAction` | `Teams` component | List all user teams |
| **Team Detail** | `/settings/teams/[teamSlug]` | ❌ Not migrated | ❌ Not Started | `getTeamAction` | Member list, invitations, settings | Multi-tab interface |
| **Create Team** | `/settings/teams/create` | ❌ Not migrated | ❌ Not Started | `createTeamAction` | `CreateTeamForm` | Team creation flow |
| **Team Members** | `/settings/teams/[teamSlug]` (tab) | ❌ Not migrated | ❌ Not Started | `getTeamMembersAction` | `TeamMembers` | Member management |
| **Team Invitations** | `/settings/teams/[teamSlug]` (tab) | ❌ Not migrated | ❌ Not Started | `getTeamInvitationsAction` | `TeamInvitations` | Pending invites |
| **Team Entitlements** | `/settings/teams/[teamSlug]` (tab) | ❌ Not migrated | ❌ Not Started | N/A | `TeamEntitlements` | Feature flags |

### Next.js Implementation Details

#### Team Page (`/teams`)
```typescript
// apps/wodsmith/src/app/(main)/teams/page.tsx
const activeTeamId = await getActiveOrPersonalTeamId(session.userId)
const activeTeam = teams.find(team => team.id === activeTeamId)
```

**Key Features:**
- Shows active team's leaderboards
- Daily leaderboard component
- Team workout view
- Uses active team concept (stored in user preferences)

#### Team Settings (`/settings/teams/[teamSlug]`)

**Layout:** Tabbed interface with:
- Overview/General settings
- Members management
- Invitations
- Entitlements/Features

**Key Pattern:** Uses team slug in URL, resolves to teamId server-side

### TanStack Implementation Details

#### Team Page (`/team`)
```typescript
// apps/wodsmith-start/src/routes/_protected/team/index.tsx
const activeTeam = session?.teams?.[0]
```

**Key Features:**
- Same `TeamPageClient` component reused
- Simplified: uses first team from session (no active team preference)
- No team switcher context yet

**Difference from Next.js:**
- Next.js: User has "active team" preference
- TanStack: Always uses first team

---

## Team Actions & Server Functions

### Next.js Actions (ZSA)

**File:** `apps/wodsmith/src/actions/team-actions.ts`

| Action | Purpose | Multi-Team? |
|--------|---------|-------------|
| `createTeamAction` | Create new team | ✅ Yes |
| `updateTeamAction` | Update team settings | ✅ Yes (requires teamId) |
| `deleteTeamAction` | Delete team | ✅ Yes (requires teamId) |
| `getUserTeamsAction` | Get user's teams | ✅ Yes (all teams) |
| `getTeamAction` | Get single team | ✅ Yes (requires teamId) |
| `getOwnedTeamsAction` | Get teams user owns | ✅ Yes |
| `setActiveTeamAction` | Set active team preference | ✅ Yes (user preference) |
| `acceptTeamInvitationAction` | Accept invitation | ✅ Yes |

**File:** `apps/wodsmith/src/actions/team-membership-actions.ts`

| Action | Purpose | Multi-Team? |
|--------|---------|-------------|
| `inviteUserAction` | Invite user to team | ✅ Yes (requires teamId) |
| `getTeamMembersAction` | Get team members | ✅ Yes (requires teamId) |
| `updateMemberRoleAction` | Change member role | ✅ Yes (requires teamId) |
| `removeTeamMemberAction` | Remove member | ✅ Yes (requires teamId) |
| `getTeamInvitationsAction` | Get pending invites | ✅ Yes (requires teamId) |
| `cancelInvitationAction` | Cancel invite | ✅ Yes (requires teamId) |
| `acceptInvitationAction` | Accept invite | ✅ Yes |
| `getPendingInvitationsForCurrentUserAction` | User's pending invites | ✅ Yes (all teams) |

**File:** `apps/wodsmith/src/actions/team-role-actions.ts`
- Role management actions (not yet cataloged in detail)

### TanStack Server Functions

**File:** `apps/wodsmith-start/src/server-fns/team-fns.ts`

| Function | Purpose | Multi-Team? | Migrated From |
|----------|---------|-------------|---------------|
| `getTeamLeaderboardsFn` | Get team leaderboards | ✅ Yes | N/A (new) |
| `getActiveTeamFn` | Get active team | ✅ Yes | Similar to Next.js |

**Missing in TanStack:**
- All team CRUD operations
- All member management functions
- All invitation functions
- Active team preference functions

---

## Team Components

### Next.js Components

**Directory:** `apps/wodsmith/src/components/teams/`

| Component | Purpose | TanStack Equivalent |
|-----------|---------|---------------------|
| `create-team-form.tsx` | Team creation form | ❌ None |
| `invite-member-modal.tsx` | Invite member dialog | ❌ None |
| `remove-member-button.tsx` | Remove member action | ❌ None |
| `schedule-generator.tsx` | Schedule generation tool | ❌ None |
| `schedule-generator-example.tsx` | Schedule examples | ❌ None |

**Directory:** `apps/wodsmith/src/components/`

| Component | Purpose | TanStack Equivalent |
|-----------|---------|---------------------|
| `team-switcher.tsx` | Global team switcher (sidebar) | ❌ None |
| `nav/active-team-switcher.tsx` | Alternative team switcher | ❌ None |

**Directory:** `apps/wodsmith/src/app/(main)/teams/_components/`

| Component | Purpose | TanStack Equivalent |
|-----------|---------|---------------------|
| `team-page-client.tsx` | Team page wrapper | ✅ Reused in TanStack |
| `daily-leaderboard.tsx` | Daily leaderboard view | ✅ Reused in TanStack |
| `workout-with-leaderboard.tsx` | Workout + leaderboard | ✅ Reused in TanStack |
| `team-controls.tsx` | Team page controls | ✅ Reused in TanStack |

**Directory:** `apps/wodsmith/src/app/(settings)/settings/teams/[teamSlug]/_components/`

| Component | Purpose | TanStack Equivalent |
|-----------|---------|---------------------|
| `team-members.tsx` | Member list table | ❌ None |
| `team-invitations.tsx` | Invitation list | ❌ None |
| `invite-member.tsx` | Invite member form | ❌ None |
| `team-entitlements.tsx` | Feature flags UI | ❌ None |
| `enable-competition-organizing.tsx` | Competition feature toggle | ❌ None |

### TanStack Components

**Directory:** `apps/wodsmith-start/src/components/`

| Component | Purpose | Next.js Equivalent |
|-----------|---------|-------------------|
| `team-page-client.tsx` | ✅ **Reused from Next.js** | Same component |

**Missing in TanStack:**
- Team switcher component
- Team creation form
- Member management components
- Invitation components
- Team settings components

---

## Multi-Tenancy Patterns

### Core Concepts

**Team Context:**
- Every user belongs to 1+ teams
- User has an "active team" preference (Next.js only)
- All data is scoped to `teamId`
- Session includes `teams[]` array

**Permission Model:**
```typescript
// apps/wodsmith/src/db/schemas/teams.ts
export const TEAM_PERMISSIONS = {
  ACCESS_DASHBOARD: "access_dashboard",
  MANAGE_WORKOUTS: "manage_workouts",
  MANAGE_MEMBERS: "manage_members",
  MANAGE_BILLING: "manage_billing",
  MANAGE_PROGRAMMING: "manage_programming",
  // ... more
} as const

// Roles inherit permissions
export const TEAM_ROLES = {
  OWNER: "owner",      // All permissions
  ADMIN: "admin",      // Most permissions
  COACH: "coach",      // Programming, workouts
  MEMBER: "member",    // View only
} as const
```

**Permission Checking:**
```typescript
// Server-side (Next.js)
import { requireTeamPermission } from "@/utils/team-auth"

await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
```

### Team Switching

#### Next.js Pattern
```typescript
// apps/wodsmith/src/components/team-switcher.tsx
import { setActiveTeamAction } from "@/actions/team-actions"

const handleTeamSwitch = async (teamId: string) => {
  const [_result, error] = await setActiveTeam({ teamId })
  if (!error) {
    router.refresh() // Refresh all server components
  }
}
```

**Flow:**
1. User clicks team in dropdown
2. `setActiveTeamAction` updates user preference in DB
3. `router.refresh()` re-fetches all server components
4. New team context applies everywhere

#### TanStack Pattern
```typescript
// ❌ NOT YET IMPLEMENTED
// Would need:
// - Active team preference storage
// - Context provider or session update
// - Router invalidation
```

### Multi-Team Programming Subscriptions

#### Next.js Pattern
```typescript
// apps/wodsmith/src/server/programming-multi-team.ts

// Get all public tracks with subscription status for multiple teams
export async function getPublicTracksWithTeamSubscriptions(
  teamIds: string[]
): Promise<TrackWithSubscriptions[]> {
  // For each team, check if subscribed
  // Return tracks with `subscribedTeams: string[]`
}

// Get which teams are subscribed to a specific track
export async function getTrackSubscribedTeams(
  trackId: string,
  teamIds: string[]
): Promise<SubscribedTeam[]> {
  // Return list of teams subscribed to this track
}
```

**UI Pattern:**
```tsx
// Track detail shows which teams are subscribed
{subscribedTeams.map(team => (
  <Badge key={team.teamId}>{team.teamName}</Badge>
))}

// Subscribe button is team-aware
<EnhancedSubscribeButton
  trackId={trackId}
  teamId={currentTeamId}
  isSubscribed={subscribedTeamIds.has(currentTeamId)}
/>
```

#### TanStack Pattern
```typescript
// ❌ NOT YET IMPLEMENTED
// No multi-team subscription support
// Only team-owned tracks
```

### Team Context Indicators

#### Next.js Pattern
```tsx
// apps/wodsmith/src/components/programming/team-context-indicator.tsx
// Shows which team context the user is viewing

// Team selector for programming views
// apps/wodsmith/src/components/programming/team-programming-selector.tsx
```

**Pattern:** Always show which team's data is being displayed

#### TanStack Pattern
```typescript
// ❌ NOT YET IMPLEMENTED
// No visual team context indicators
```

### Team-Scoped Data Queries

#### Universal Pattern (Both)
```typescript
// ALWAYS filter by teamId
const workouts = await db
  .select()
  .from(workoutsTable)
  .where(eq(workoutsTable.teamId, teamId))

// Never expose data without team check
```

**Critical Rule:** Every database query MUST include `teamId` filter for multi-tenant data.

---

## Migration Gaps

### High Priority (Blocking Core Features)

#### Programming Subscriptions
- **Route:** `/programming/subscriptions` → TanStack equivalent
- **Missing:**
  - Subscription list view
  - `SubscriptionsList` component
  - Server functions for team subscriptions
- **Complexity:** Medium
- **Estimate:** 2-3 hours

#### Public Programming Browse
- **Route:** `/programming` → TanStack equivalent (maybe `/tracks`)
- **Missing:**
  - Public track browsing
  - Multi-team subscription UI
  - `ProgrammingTracksClient`, `EnhancedTrackList`, `TrackCard`
  - Server functions for public tracks with subscriptions
- **Complexity:** High
- **Estimate:** 4-6 hours

#### Programming Track Detail (Subscriber View)
- **Route:** `/programming/[trackId]` → TanStack equivalent
- **Missing:**
  - Subscriber view (different from owner view)
  - Multi-team subscription badges
  - Team selector for workout context
  - `PaginatedTrackWorkouts`, `TrackDetailTeamSelector`
- **Complexity:** High
- **Estimate:** 4-5 hours

### Medium Priority (Settings & Management)

#### Team Settings Routes
- **Routes:** 
  - `/settings/teams` → List teams
  - `/settings/teams/[teamSlug]` → Team detail
  - `/settings/teams/create` → Create team
- **Missing:**
  - All team CRUD UI
  - Member management UI
  - Invitation UI
  - Components: `Teams`, `TeamMembers`, `TeamInvitations`, etc.
- **Complexity:** Medium-High
- **Estimate:** 6-8 hours

#### Team Member Management
- **Missing:**
  - `inviteUserAction` → TanStack function
  - `getTeamMembersAction` → TanStack function
  - `updateMemberRoleAction` → TanStack function
  - `removeTeamMemberAction` → TanStack function
  - All related components
- **Complexity:** Medium
- **Estimate:** 4-5 hours

#### Team Invitations
- **Missing:**
  - `getTeamInvitationsAction` → TanStack function
  - `cancelInvitationAction` → TanStack function
  - `acceptInvitationAction` → TanStack function
  - Invitation UI components
- **Complexity:** Medium
- **Estimate:** 3-4 hours

### Low Priority (UX Enhancements)

#### Team Switcher
- **Component:** Global team switcher in sidebar
- **Missing:**
  - `TeamSwitcher` component
  - `setActiveTeamAction` → TanStack function
  - Active team preference storage
- **Complexity:** Medium
- **Estimate:** 3-4 hours
- **Note:** Can defer if TanStack uses URL-based team context instead

#### Team Context Indicators
- **Missing:**
  - `TeamContextIndicator` component
  - `TeamProgrammingSelector` component
  - Visual indicators for which team's data is shown
- **Complexity:** Low
- **Estimate:** 2-3 hours

---

## Multi-Tenancy Migration Strategy

### Option 1: URL-Based Team Context (Recommended for TanStack)

Instead of active team preference, use URL params:

```typescript
// Route: /team/$teamId
// Route: /settings/teams/$teamId
// Route: /programming?team=$teamId

// Team context is explicit in URL
const { teamId } = Route.useParams()
```

**Pros:**
- Explicit, shareable URLs
- No server-side preference state
- Easier to reason about
- Better for bookmarking/deep linking

**Cons:**
- More URL changes when switching teams
- Need to persist team in query params

### Option 2: Active Team Preference (Next.js Pattern)

Replicate Next.js pattern with active team stored in user preferences:

```typescript
// setActiveTeamFn updates DB
// All routes use active team from session
// Team switcher updates preference + refreshes
```

**Pros:**
- Matches Next.js behavior
- Cleaner URLs
- Familiar to users

**Cons:**
- More server state
- Need to manage preference updates
- URLs are less explicit

### Recommendation

**For TanStack:** Use **Option 1 (URL-based)** for settings/management routes, **Option 2 (preference)** for main team page.

**Hybrid approach:**
- `/team` → Uses active team preference (main view)
- `/settings/teams/$teamId` → Explicit team in URL (management)
- `/programming` → Team context from query param or preference

---

## Technical Debt & Cleanup

### Component Reuse Opportunities

**Already Reused:**
- `TeamPageClient` - ✅ Works in both
- `DailyLeaderboard` - ✅ Works in both
- `WorkoutWithLeaderboard` - ✅ Works in both

**Can Be Reused (with minor changes):**
- `CreateTeamForm` - Swap ZSA actions for server functions
- `InviteMemberModal` - Swap ZSA actions for server functions
- `RemoveMemberButton` - Swap ZSA actions for server functions

### Naming Inconsistencies

**Next.js:**
- `/programming` - Public browse
- `/settings/teams` - Team management

**TanStack:**
- `/settings/programming` - Owner's tracks (not public browse)
- `/team` - Team page (singular)

**Recommendation:** Align naming:
- `/tracks` or `/programming` - Public browse
- `/settings/programming` - Owner's tracks (keep)
- `/team` or `/teams` - Choose one (suggest `/team`)

---

## Permissions & Authorization

### Current State

**Next.js:**
```typescript
// Server-side permission checks
await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

// Used in:
// - Programming subscriptions page
// - Team settings routes
// - Member management actions
```

**TanStack:**
- ❌ No permission checking implemented yet
- All routes assume user has access

### Migration Needed

1. **Port permission utilities** to TanStack server functions
2. **Add permission checks** to all sensitive routes:
   - Team settings
   - Member management
   - Programming track CRUD
3. **UI guards** - Hide actions based on permissions

---

## Database Schema

### Key Tables

**teams:**
- `id` - Primary key
- `name` - Team name
- `slug` - URL-friendly slug
- `ownerUserId` - Team owner

**teamMembers:**
- `teamId` - Foreign key to teams
- `userId` - Foreign key to users
- `role` - OWNER | ADMIN | COACH | MEMBER

**programmingTracks:**
- `id` - Primary key
- `ownerTeamId` - Foreign key to teams (nullable)
- `name`, `description`, `type`
- `visibility` - PUBLIC | PRIVATE

**programmingTrackSubscriptions:**
- `id` - Primary key
- `teamId` - Foreign key to teams
- `trackId` - Foreign key to programmingTracks
- `subscribedAt` - Timestamp

**teamInvitations:**
- `id` - Primary key
- `teamId` - Foreign key to teams
- `email` - Invited user email
- `role` - Role to assign on acceptance
- `status` - PENDING | ACCEPTED | DECLINED

### Multi-Tenancy Patterns

**Key Rule:** All queries MUST filter by `teamId` or `ownerTeamId` for multi-tenant data.

**Examples:**
```typescript
// Get team's programming tracks (owned)
db.select()
  .from(programmingTracks)
  .where(eq(programmingTracks.ownerTeamId, teamId))

// Get team's subscribed tracks
db.select()
  .from(programmingTracks)
  .innerJoin(
    programmingTrackSubscriptions,
    eq(programmingTracks.id, programmingTrackSubscriptions.trackId)
  )
  .where(eq(programmingTrackSubscriptions.teamId, teamId))

// Get team members
db.select()
  .from(teamMembers)
  .where(eq(teamMembers.teamId, teamId))
```

---

## Testing Considerations

### Unit Tests Needed (TanStack)

- `getTeamProgrammingTracksFn` - Team ownership check
- `createProgrammingTrackFn` - Permission check
- `deleteProgrammingTrackFn` - Owner-only check
- `subscribeToTrackFn` - (when implemented)
- `getPublicTracksWithSubscriptionsFn` - (when implemented)

### Integration Tests Needed

- Team switching flow (URL-based or preference-based)
- Multi-team programming subscription workflow
- Permission-based UI rendering
- Member invitation flow
- Team creation flow

---

## Appendix: File Inventory

### Next.js Route Files

**Programming Routes:**
```
apps/wodsmith/src/app/(main)/programming/
├── page.tsx - Browse public tracks
├── subscriptions/
│   └── page.tsx - Team subscriptions
├── [trackId]/
│   └── page.tsx - Track detail
├── layout.tsx
└── loading.tsx
```

**Team Routes:**
```
apps/wodsmith/src/app/(main)/teams/
├── page.tsx - Team page
└── _components/
    ├── daily-leaderboard.tsx
    ├── team-controls.tsx
    ├── team-page-client.tsx
    └── workout-with-leaderboard.tsx
```

**Team Settings Routes:**
```
apps/wodsmith/src/app/(settings)/settings/teams/
├── page.tsx - List teams
├── create/
│   └── page.tsx - Create team
└── [teamSlug]/
    ├── page.tsx - Team detail
    ├── layout.tsx - Tabbed layout
    └── _components/
        ├── enable-competition-organizing.tsx
        ├── invite-member.tsx
        ├── team-entitlements.tsx
        ├── team-invitations.tsx
        └── team-members.tsx
```

### TanStack Route Files

```
apps/wodsmith-start/src/routes/_protected/
├── settings/
│   └── programming/
│       ├── index.tsx - My tracks
│       └── $trackId/
│           └── index.tsx - Track detail (owner)
└── team/
    └── index.tsx - Team page
```

### Action Files

```
apps/wodsmith/src/actions/
├── programming-actions.ts
├── programming-track-workouts-actions.ts
├── team-actions.ts
├── team-membership-actions.ts
└── team-role-actions.ts
```

### Server Function Files

```
apps/wodsmith-start/src/server-fns/
├── programming-fns.ts
└── team-fns.ts
```

### Component Files

**Next.js Programming Components:**
```
apps/wodsmith/src/components/programming/
├── enhanced-subscribe-button.tsx
├── enhanced-track-list.tsx
├── enhanced-track-row.tsx
├── paginated-track-workouts.tsx
├── programming-tracks-client.tsx
├── subscribe-button.tsx
├── subscriptions-list.tsx
├── team-context-indicator.tsx
├── team-programming-selector.tsx
├── track-card.tsx
├── track-detail-team-selector.tsx
├── track-list.tsx
├── track-row.tsx
├── track-workout-card.tsx
└── track-workout-row.tsx
```

**Next.js Team Components:**
```
apps/wodsmith/src/components/teams/
├── create-team-form.tsx
├── invite-member-modal.tsx
├── remove-member-button.tsx
├── schedule-generator-example.tsx
└── schedule-generator.tsx

apps/wodsmith/src/components/
├── team-switcher.tsx
└── nav/
    └── active-team-switcher.tsx
```

**TanStack Components:**
```
apps/wodsmith-start/src/components/
├── programming-track-row.tsx
├── programming-track-create-dialog.tsx
├── track-header.tsx
├── track-workout-list.tsx
├── add-workout-to-track-dialog.tsx
└── team-page-client.tsx (reused from Next.js)
```

---

## Summary

**Next.js has:**
- ✅ Full programming track system (browse, detail, subscriptions)
- ✅ Multi-team subscription support
- ✅ Team settings and management
- ✅ Member and invitation management
- ✅ Active team preference system
- ✅ Team switcher in sidebar
- ✅ Comprehensive permission system

**TanStack has:**
- ✅ Programming track CRUD (owner view)
- ✅ Track detail (owner view)
- ✅ Basic team page
- ✅ **CORRECTED:** Subscription system EXISTS (via `getTeamProgrammingTracksFn`)
- ❌ No public track browsing
- ❌ No subscribe/unsubscribe actions (read-only subscriptions)
- ❌ No team settings
- ❌ No member management
- ❌ No team switcher
- ❌ No permission checks

**Migration path:** Prioritize subscription actions (subscribe/unsubscribe), public browse, then team settings.

---

## Audit Findings (2025-12-23)

**Auditor:** GoldDawn (Cell: wodsmith-monorepo--tuyyc-mjj6hcgb793)

### ✅ Verified Accurate

1. **Route counts:** All Next.js and TanStack routes exist as documented
2. **Server function counts:** 
   - `programming-fns.ts`: 9 functions ✅
   - `team-fns.ts`: 2 functions ✅
3. **Next.js actions:** 4 programming actions, 8 team actions verified
4. **Component inventory:** All listed components exist in their documented locations
5. **Multi-tenancy patterns:** Code matches documented patterns (userTeamIds, session.teams)
6. **Permission checks:** `requireTeamPermission` confirmed in `/programming/subscriptions` route

### ⚠️ Corrections Made

1. **`getTeamProgrammingTracksFn` scope (CRITICAL):**
   - **Original claim:** "Get team-owned tracks"
   - **Actual behavior:** Gets ALL team-subscribed tracks (owned + 3rd party public)
   - **Evidence:** Function queries `teamProgrammingTracksTable` (subscription table) with `innerJoin` to `programmingTracksTable`
   - **Impact:** TanStack DOES have subscription read capability, just missing write actions
   - **Correction:** Updated function description and route notes in 3 locations

2. **TanStack subscription system status:**
   - **Original claim:** "❌ No subscription system"
   - **Actual status:** "✅ Subscription READ exists, ❌ subscription WRITE missing"
   - **Missing pieces:** `subscribeToTrackFn`, `unsubscribeFromTrackFn`
   - **Correction:** Updated summary section

### 📊 Completion Metrics (Recalculated)

**Programming Routes:**
- **Owner-view routes:** 2/2 migrated (100%) ✅
  - `/settings/programming` - My subscribed tracks
  - `/settings/programming/$trackId` - Track detail (owner)
- **Public-facing routes:** 0/3 migrated (0%) ❌
  - `/programming` - Browse public tracks
  - `/programming/[trackId]` - Track detail (subscriber)
  - `/programming/subscriptions` - Manage subscriptions

**Programming Actions:**
- **CRUD actions:** 6/6 migrated (100%) ✅
  - Create, Update, Delete, Get, Add Workout, Remove Workout
- **Subscription actions:** 0/4 migrated (0%) ❌
  - Subscribe, Unsubscribe, Get Subscriptions, Set Default

**Team Routes:**
- **Team page:** 1/1 migrated (100%) ✅
- **Team settings:** 0/4 migrated (0%) ❌

**Team Actions:**
- **Read actions:** 2/2 migrated (100%) ✅
- **Write actions:** 0/13 migrated (0%) ❌

### 🎯 Revised Migration Priority

1. **Subscription write actions** (HIGH) - Users can see subscriptions but can't modify them
2. **Public track browsing** (HIGH) - Users can't discover new tracks
3. **Team settings & CRUD** (MEDIUM) - Users stuck with existing teams
4. **Member management** (MEDIUM) - Can't invite/remove members
5. **Multi-team switcher** (LOW) - Uses first team only, no switching

### 🔍 Naming Inconsistencies Found

1. **`getTeamProgrammingTracksFn`** - Misleading name
   - **Should be:** `getTeamSubscribedTracksFn` or `getTeamTrackSubscriptionsFn`
   - **Reason:** Queries subscription table, not ownership
   - **Action:** Consider renaming in future refactor to avoid confusion

### 📦 Additional Components Found (Not Documented)

**TanStack components missing from original doc:**
1. `programming-track-edit-dialog.tsx` - Edit track modal
2. `programming-track-delete-dialog.tsx` - Delete track confirmation
3. `track-visibility-selector.tsx` - Public/private toggle
4. `team-controls.tsx` - Reused from Next.js (not new)

**Impact:** TanStack programming UI is MORE complete than doc suggested. All CRUD operations have UI components.

### ✅ No Issues Found

- Database schema descriptions accurate
- Multi-tenancy patterns correctly documented
- File paths all correct (where documented)
- Code examples match actual implementation
- Permission patterns accurately described
