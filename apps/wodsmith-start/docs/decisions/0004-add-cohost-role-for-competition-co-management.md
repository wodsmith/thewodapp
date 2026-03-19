---
status: "proposed"
date: 2026-03-19
decision-makers: "Zac Jones"
---

# Add cohost role for competition co-management

## Context and Problem Statement

Competition organizers frequently partner with someone at a different gym to co-run an event. That person needs access to nearly all organizer tools — managing divisions, entering scores, scheduling heats, coordinating volunteers — but should not be able to change the competition's identity (name, dates, slug) or delete it.

Today, the only way to grant organizer access is via `admin` or `owner` roles on the **organizing team** (`$competitionId.tsx` line 45–51). This is too broad: it gives access to *all* competitions for that gym and all team settings. There is no per-competition elevated role between "full organizer" and "volunteer."

The existing volunteer system (`SYSTEM_ROLES_ENUM.VOLUNTEER`) is for operational roles (judge, scorekeeper, emcee) and does not grant access to organizer routes.

## Decision Drivers

* Cohosts need access to nearly all competition management routes, scoped to a single competition
* The edit page (name, dates, slug, description) and danger zone (delete) must remain organizer-only
* Revenue, pricing/coupons, and settings visibility should be configurable per-cohost (organizer chooses at invite time)
* The invite flow must be clearly separated from volunteer invites to prevent accidental privilege escalation
* Must work within existing team/membership/session architecture
* Parent route `/compete/organizer` requires `HOST_COMPETITIONS` entitlement — cohosts don't have this on their own team

## Considered Options

* **Option A: New `cohost` system role on the competition_event team** — Per-competition scope, same team volunteers join
* **Option B: New `cohost` system role on the organizing team** — Gym-level scope, grants access to all competitions for that gym

## Decision Outcome

Chosen option: **Option A — `cohost` system role on the competition_event team**, because:

1. Cohost access is inherently per-competition, not per-gym. A cohost at Gym B helping run one event at Gym A shouldn't see Gym A's other competitions.
2. The competition_event team already hosts volunteers — familiar membership pattern.
3. Clean separation: organizing team roles (`admin`/`owner`) = full gym access, competition team roles (`cohost`/`volunteer`) = per-competition access.
4. No risk of accidentally granting cross-competition access.

### Consequences

* Good, because organizers can delegate competition management without sharing full team access
* Good, because cohost permissions are configurable per-invite (revenue, pricing, settings)
* Good, because the invite flow is separate from volunteers, preventing accidental privilege escalation
* Bad, because the auth gate in `$competitionId.tsx` must now check two teams (organizing team + competition team), adding complexity
* Bad, because the parent route `/compete/organizer` entitlement check needs a bypass path for cohosts
* Bad, because the dashboard must merge two data sources (own competitions + cohosted competitions)
* Neutral, because the sidebar gains conditional logic based on cohost permissions, but this is straightforward

## Implementation Plan

### Phase 1: Schema Changes

**`src/db/schemas/teams.ts`** — Add cohost to system roles:
```typescript
export const SYSTEM_ROLES_ENUM = {
  OWNER: "owner",
  ADMIN: "admin",
  CAPTAIN: "captain",
  MEMBER: "member",
  GUEST: "guest",
  VOLUNTEER: "volunteer",
  COHOST: "cohost", // NEW
} as const
```

**New file: `src/db/schemas/cohost.ts`** — Define cohost metadata (separate from volunteers to maintain clear role boundaries):
```typescript
export interface CohostMembershipMetadata {
  /** Can view revenue stats and financial dashboard */
  canViewRevenue: boolean       // default: false
  /** Can modify settings (capacity, scoring, rotation) */
  canEditSettings: boolean      // default: true
  /** Can manage pricing and coupons */
  canManagePricing: boolean     // default: false
  /** Optional notes from organizer */
  inviteNotes?: string
}
```

No new tables needed — cohost is a `teamMembershipTable` row with `roleId: "cohost"`, `isSystemRole: true`, on the competition_event team, with `CohostMembershipMetadata` in the `metadata` JSON column.

### Phase 2: Auth Gate Changes

**`src/routes/compete/organizer/$competitionId.tsx`** — Expand auth and expose cohost context via `beforeLoad` (not loader).

**Important**: In TanStack Router, child `beforeLoad` functions run *before* parent loaders. Route-level guards in child `beforeLoad` cannot access parent loader data. Therefore, `isCohost` and `cohostPermissions` must be computed in the parent's `beforeLoad` and returned as context.

```typescript
// In beforeLoad (runs before loaders, context flows to child beforeLoad):
beforeLoad: async ({ params, context }) => {
  const session = context.session
  if (!session?.user?.id) {
    throw redirect({ to: "/sign-in", search: { redirect: `...` } })
  }

  // Fetch competition (lightweight query needed for auth decision)
  const { competition } = await getCompetitionByIdFn({
    data: { competitionId: params.competitionId },
  })
  if (!competition) throw notFound()

  const isOrganizerAdmin =
    session.user?.role === "admin" ||
    !!session.teams?.find(
      (t) =>
        t.id === competition.organizingTeamId &&
        (t.role.id === "admin" || t.role.id === "owner"),
    )

  const isCohost = !!session.teams?.find(
    (t) =>
      t.id === competition.competitionTeamId &&
      t.role.id === "cohost",
  )

  if (!isOrganizerAdmin && !isCohost) {
    throw redirect({ to: "/compete" })
  }

  const cohostPermissions = isCohost
    ? getCohostPermissions(session, competition.competitionTeamId)
    : null

  // Return via context so child beforeLoad guards can read it
  return { competition, isCohost, cohostPermissions }
},

// Loader can use context.competition for additional data fetching
loader: async ({ context }) => {
  return { competition: context.competition }
},
```

The `getCohostPermissions` helper reads the membership metadata from the session and returns the `CohostMembershipMetadata` fields. Child routes access `context.isCohost` and `context.cohostPermissions` in their `beforeLoad`.

**`src/routes/compete/organizer.tsx`** — Parent entitlement check must allow cohosts through:
```typescript
// Existing check: has HOST_COMPETITIONS entitlement
// NEW: OR user has any cohost membership on any competition team
const hasHostCompetitions = /* existing check */
const hasCohostMembership = await hasCohostMembershipsFn({ data: { userId: session.user.id } })

if (!hasHostCompetitions && !hasCohostMembership) {
  throw redirect({ to: "/compete/organizer/onboard" })
}
```

This requires a new server function `hasCohostMembershipsFn` that checks if the user has any active `cohost` memberships.

### Phase 3: Route-Level Guards

These routes need explicit cohost blocks in their `beforeLoad` (reading `context.isCohost` and `context.cohostPermissions` provided by the parent `beforeLoad`):

**`src/routes/compete/organizer/$competitionId/edit.tsx`** — Always blocked for cohosts:
```typescript
// In beforeLoad or at component level
if (context.isCohost) {
  throw redirect({ to: `/compete/organizer/${params.competitionId}` })
}
```

**`src/routes/compete/organizer/$competitionId/danger-zone.tsx`** — Always blocked for cohosts.

**`src/routes/compete/organizer/$competitionId/revenue.tsx`** — Blocked unless `cohostPermissions.canViewRevenue`:
```typescript
if (context.isCohost && !context.cohostPermissions?.canViewRevenue) {
  throw redirect({ to: `/compete/organizer/${params.competitionId}` })
}
```

**`src/routes/compete/organizer/$competitionId/settings.tsx`** — Blocked unless `cohostPermissions.canEditSettings`.

**`src/routes/compete/organizer/$competitionId/pricing.tsx`** — Blocked unless `cohostPermissions.canManagePricing`.

**`src/routes/compete/organizer/$competitionId/coupons.tsx`** — Blocked unless `cohostPermissions.canManagePricing`.

### Phase 4: Sidebar Changes

**`src/components/competition-sidebar.tsx`** — Accept new props and filter nav items:

```typescript
interface CompetitionSidebarProps {
  competitionId: string
  competitionType?: "in-person" | "online"
  children: React.ReactNode
  // NEW
  isCohost?: boolean
  cohostPermissions?: CohostMembershipMetadata | null
}
```

In `getNavigation`, add a `hidden` flag to items:
- **Always hidden for cohosts**: "Danger Zone" in Settings group
- **Edit page**: Remove from sidebar for cohosts (edit is only accessible via the overview, not sidebar — but if there's a link, hide it)
- **Revenue**: hidden unless `cohostPermissions.canViewRevenue`
- **Settings**: hidden unless `cohostPermissions.canEditSettings`
- **Pricing**: hidden unless `cohostPermissions.canManagePricing`
- **Coupons**: hidden unless `cohostPermissions.canManagePricing`

### Phase 5: Dashboard Changes

**`src/routes/compete/organizer/_dashboard/index.tsx`** — Add cohosted competitions to listing:

New server function `getCohostCompetitionsFn({ data: { userId } })`:
- Query `teamMembershipTable` where `roleId = "cohost"` and `isSystemRole = true`
- Join to `competitionsTable` via `competitionTeamId`
- Return competitions with a `cohosted: true` flag

Dashboard merges both lists. Cohosted competitions display a "Cohost" badge.

### Phase 6: Invite Flow

**New component: `src/routes/compete/organizer/$competitionId/-components/invite-cohost-dialog.tsx`**

Separate dialog from volunteer invites. Fields:
- **Name** (optional)
- **Email** (required)
- **Permission toggles** (checkboxes with defaults):
  - [ ] Can view revenue — default OFF
  - [ ] Can edit settings (capacity, scoring, rotation) — default ON
  - [ ] Can manage pricing & coupons — default OFF

**New server function in `src/server-fns/cohost-fns.ts`**:
- `inviteCohostFn` — Creates a team invitation on the competition_event team with `roleId: "cohost"` and `CohostMembershipMetadata` in metadata. Sends cohost-specific invitation email with a unique token link. Requires `MANAGE_COMPETITIONS` permission on organizing team.
- `getCohostInviteFn` — Retrieve a cohost invitation by token. Used by the accept-invite page to show competition details and permission summary before the invitee accepts.
- `acceptCohostInviteFn` — Accept a cohost invitation token. Validates token is not expired, creates `teamMembershipTable` row with `roleId: "cohost"` and metadata from the invitation, marks invitation `acceptedAt`. Requires authenticated user (redirect to sign-in/sign-up if not). Follows the same pattern as `acceptVolunteerInviteFn`.
- `getCohostsFn` — List cohosts for a competition.
- `updateCohostPermissionsFn` — Update a cohost's permission toggles.
- `removeCohostFn` — Remove a cohost from a competition.
- `hasCohostMembershipsFn` — Check if a user is cohost on any competition (for parent route bypass).

**Invite acceptance route**: Add a route (e.g., `/compete/cohost-invite/$token`) or reuse the existing invite acceptance infrastructure. The flow:
1. Invitee clicks email link with token
2. Route calls `getCohostInviteFn` to validate token and display competition name + granted permissions
3. If not authenticated, redirect to sign-in/sign-up with return URL
4. On accept, calls `acceptCohostInviteFn` which creates the membership and redirects to the competition overview

**UI placement**: Add an "Invite Cohost" button on the competition overview page or a dedicated section on the volunteers page (separate from volunteer roster). The button should be visually distinct and only visible to organizer admins/owners (not to other cohosts).

### Phase 7: Session Data — Verified, No Changes Needed

**Verified**: `getUserTeamsWithPermissions()` in `src/utils/auth.ts` (line 106) fetches ALL `teamMembershipTable` records for a user with **no filtering** on team type or role. Competition_event team memberships (including `volunteer` roles) already appear in `session.teams[]`.

This means a `cohost` membership on a competition_event team will automatically flow into the session as:
```typescript
{
  id: competitionEventTeamId,
  name: "...",
  slug: "...",
  type: "competition_event",
  role: { id: "cohost", name: "cohost", isSystemRole: true },
  permissions: [...],
}
```

The `session.teams?.find(t => t.id === competition.competitionTeamId && t.role.id === "cohost")` check in the auth gate will work without any session builder changes.

**Key files verified**:
- `src/utils/auth.ts` — `getUserTeamsWithPermissions()` (no team type filter)
- `src/utils/kv-session.ts` — `KVSession` interface includes `type` field on teams

### Affected Paths Summary

| File | Change |
|------|--------|
| `src/db/schemas/teams.ts` | Add `COHOST` to `SYSTEM_ROLES_ENUM` |
| New: `src/db/schemas/cohost.ts` | `CohostMembershipMetadata` interface |
| `src/routes/compete/organizer.tsx` | Bypass entitlement for cohosts |
| `src/routes/compete/organizer/$competitionId.tsx` | Move auth + cohost context to `beforeLoad` |
| `src/routes/compete/organizer/$competitionId/edit.tsx` | Block cohosts |
| `src/routes/compete/organizer/$competitionId/danger-zone.tsx` | Block cohosts |
| `src/routes/compete/organizer/$competitionId/revenue.tsx` | Conditional cohost access |
| `src/routes/compete/organizer/$competitionId/settings.tsx` | Conditional cohost access |
| `src/routes/compete/organizer/$competitionId/pricing.tsx` | Conditional cohost access |
| `src/routes/compete/organizer/$competitionId/coupons.tsx` | Conditional cohost access |
| `src/components/competition-sidebar.tsx` | Filter nav items by cohost permissions |
| `src/routes/compete/organizer/_dashboard/index.tsx` | Show cohosted competitions |
| New: `src/server-fns/cohost-fns.ts` | Cohost CRUD, invite, accept server functions |
| New: invite-cohost-dialog component | Separate invite UI with permission toggles |
| New: cohost invite acceptance route | Token validation + accept flow (e.g., `/compete/cohost-invite/$token`) |
| New: `src/server/cohost.ts` | Cohost helper functions (`getCohostPermissions`, etc.) |

### Patterns to Follow

* **System role pattern**: Same as `VOLUNTEER` in `SYSTEM_ROLES_ENUM` — `roleId: "cohost"`, `isSystemRole: true` on `teamMembershipTable`
* **Metadata pattern**: JSON in `teamMembershipTable.metadata`, same as `VolunteerMembershipMetadata`
* **Invitation pattern**: Same as `inviteVolunteerFn` — create `teamInvitationTable` row, send email, accept flow
* **Server functions**: `createServerFn` in `src/server-fns/` with Zod input validation
* **Auth checks**: Match existing `session.teams?.find()` pattern in route loaders

### Patterns to Avoid

* **Do NOT reuse the volunteer invite dialog** — Cohost is a separate flow to prevent accidental elevation
* **Do NOT add cohost to `VOLUNTEER_ROLE_TYPES`** — Cohost is a system role, not a volunteer role type
* **Do NOT grant cohost access to series management, payout settings, or cross-competition routes** — Cohost scope is single-competition only
* **Do NOT add cohost to the organizing team** — They belong on the competition_event team for per-competition scoping
* **Do NOT allow cohosts to invite other cohosts** — Only organizer admin/owner can invite cohosts

### Dependencies

* No new packages required
* No new env vars
* No database migration (uses existing tables with new role value + metadata)

### Verification

- [ ] `COHOST` exists in `SYSTEM_ROLES_ENUM` in `src/db/schemas/teams.ts`
- [ ] `CohostMembershipMetadata` interface is defined with `canViewRevenue`, `canEditSettings`, `canManagePricing` fields
- [ ] Cohost on competition_event team can access `/compete/organizer/$competitionId/` (overview)
- [ ] Cohost can access: divisions, events, submission-windows, scoring, athletes, waivers, schedule, locations, volunteers, results, sponsors
- [ ] Cohost is redirected away from `/edit` route
- [ ] Cohost is redirected away from `/danger-zone` route
- [ ] Cohost with `canViewRevenue: false` is redirected away from `/revenue`
- [ ] Cohost with `canViewRevenue: true` can access `/revenue`
- [ ] Cohost with `canEditSettings: false` is redirected away from `/settings`
- [ ] Cohost with `canEditSettings: true` can access `/settings`
- [ ] Cohost with `canManagePricing: false` is redirected away from `/pricing` and `/coupons`
- [ ] Cohost with `canManagePricing: true` can access `/pricing` and `/coupons`
- [ ] Sidebar hides items the cohost cannot access
- [ ] Sidebar never shows "Danger Zone" for cohosts
- [ ] Invite Cohost dialog is separate from Invite Volunteer dialog
- [ ] Invite Cohost dialog has permission toggles with correct defaults (revenue OFF, settings ON, pricing OFF)
- [ ] Only organizer admin/owner can see the "Invite Cohost" button — cohosts cannot invite other cohosts
- [ ] Dashboard shows cohosted competitions with a visual "Cohost" badge
- [ ] Parent route `/compete/organizer` allows cohost users through without `HOST_COMPETITIONS` entitlement
- [ ] Cohost invite email contains a valid token link to the acceptance route
- [ ] Acceptance route validates token (not expired, not already accepted) and shows competition name + granted permissions
- [ ] Unauthenticated invitee is redirected to sign-in/sign-up with return URL back to acceptance
- [ ] Accepting the invite creates a `teamMembershipTable` row with `roleId: "cohost"` and correct metadata
- [ ] After acceptance, invitee is redirected to the competition overview page
- [ ] `isCohost` and `cohostPermissions` are exposed via parent `beforeLoad` context (not loader data)
- [ ] Organizer admin/owner experience is unchanged (no regressions)
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes

## Pros and Cons of the Options

### Option A: Cohost role on competition_event team (chosen)

New `cohost` system role on the per-competition team, alongside existing `volunteer` role. Auth gate checks both organizing team and competition team.

* Good, because cohost access is scoped to a single competition — no cross-competition leakage
* Good, because it reuses the existing team membership + metadata pattern (familiar to codebase)
* Good, because clean role hierarchy: organizing team (admin/owner) > competition team (cohost) > competition team (volunteer)
* Bad, because auth gate must now check two teams, adding a second `session.teams?.find()` branch
* Bad, because parent route entitlement check needs a bypass path for cohost users
* Bad, because dashboard must merge own competitions + cohosted competitions from different data sources

### Option B: Cohost role on organizing team

New `cohost` system role on the gym/organizing team. Simplifies auth since existing check already looks at organizing team.

* Good, because auth gate requires minimal changes (just add `"cohost"` to the role check)
* Good, because parent route entitlement check needs no changes (organizing team already has HOST_COMPETITIONS)
* Good, because dashboard already shows competitions for the organizing team
* Bad, because cohost gains implicit access to ALL competitions for that gym, not just one
* Bad, because removing cohost access from one competition is impossible without removing them from the team entirely
* Bad, because mixing gym-level and competition-level roles on the same team creates a confusing permission model
* Bad, because the organizer's team member list shows a "cohost" from another gym alongside real staff

## More Information

**Route access matrix for cohosts (default permissions)**:

| Route | Cohost Access | Configurable? |
|-------|--------------|---------------|
| Overview | Yes | No |
| Divisions | Yes | No |
| Events | Yes | No |
| Submission Windows | Yes | No |
| Scoring | Yes | No |
| Registrations | Yes | No |
| Waivers | Yes | No |
| Schedule | Yes | No |
| Locations | Yes | No |
| Volunteers | Yes | No |
| Results/Submissions | Yes | No |
| Sponsors | Yes | No |
| Settings | Yes (default ON) | Yes |
| Pricing | No (default OFF) | Yes |
| Coupons | No (default OFF) | Yes |
| Revenue | No (default OFF) | Yes |
| Edit | No | No (always blocked) |
| Danger Zone | No | No (always blocked) |

**Revisit this ADR when**:
- Cohosts need to manage series (cross-competition scope — may need different approach)
- An organizer wants to grant partial edit access (e.g., description but not dates)
- Multiple cohost permission presets are needed (e.g., "full cohost" vs "day-of coordinator")
