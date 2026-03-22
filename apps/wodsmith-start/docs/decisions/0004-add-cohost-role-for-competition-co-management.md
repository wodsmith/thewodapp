---
status: "proposed"
date: 2026-03-21
decision-makers: "Zac Jones"
consulted: ""
informed: ""
---

# Add cohost role for competition co-management with dedicated route tree

## Context and Problem Statement

Competition organizers need to delegate management tasks to collaborators (co-hosts) without sharing their primary organizer login or team credentials. Today, only members of the organizing team with `admin` or `owner` roles and the `HOST_COMPETITIONS` entitlement can access the organizer dashboard. There is no way to grant a third party limited access to a specific competition.

How should we let organizers invite co-hosts to help manage individual competitions, with configurable permissions, while keeping the existing organizer experience completely untouched?

Related code:
- `src/routes/compete/organizer.tsx` — organizer layout (entitlement check)
- `src/routes/compete/organizer/$competitionId.tsx` — competition layout (sidebar + auth)
- `src/routes/compete/organizer/$competitionId/` — ~17 organizer route pages
- `src/server-fns/competition-*.ts` — organizer server functions (~7 files)
- `src/server-fns/cohost-fns.ts` — cohost invite/accept/CRUD (already exists)
- `src/db/schemas/cohost.ts` — CohostMembershipMetadata interface (already exists)
- `src/server/cohost.ts` — getCohostPermissions helper (already exists)

## Decision Drivers

* Organizers must be able to invite collaborators to a single competition without giving full team access
* Cohosts need access to most management pages but should be blocked from destructive actions (delete competition, edit core identity)
* Some features (revenue, pricing/coupons) should be gated behind per-cohost permission flags set by the organizer
* The existing organizer routes, server functions, and entitlement checks must remain completely unchanged — zero modifications to the ~22 organizer server function files
* Clean separation: cohost code should be fully independent so organizer and cohost features can evolve without coupling
* The cohost must not need a `HOST_COMPETITIONS` entitlement — access is derived from team membership on the competition_event team

## Considered Options

* **Option A**: Add COHOST role to competition_event teams, sharing organizer routes — cohosts navigate via the same `/compete/organizer/$competitionId/` routes with a `requireCompetitionManagePermission` helper that accepts either organizer or cohost credentials
* **Option B**: Add COHOST role to the organizing team itself (alongside admin/owner) — cohosts get organizing team membership with a restricted role
* **Option C**: Add COHOST role to competition_event teams with a dedicated `/compete/cohost/$competitionId/` route tree — cohosts get their own layout, sidebar, server functions, and route pages, completely separate from organizer routes

## Decision Outcome

Chosen option: **Option C — Dedicated cohost route tree**, because it requires zero changes to existing organizer code, provides clean separation of concerns, and allows cohost features to evolve independently.

### Consequences

* Good, because zero modifications to the ~22 organizer server function files — no `requireCompetitionManagePermission` helper needed, no call-site migration
* Good, because the organizer experience is completely unchanged and cannot regress
* Good, because each cohost server function can be tuned for the cohost role without worrying about breaking organizer functionality
* Good, because cohost layout checks cohost membership directly on the competition_event team — no entitlement bypass needed in the organizer parent route
* Good, because cohost and organizer features can diverge over time (different nav items, different data views) without coupling
* Good, because cohost route pages can reuse UI components (forms, lists, tables) from the organizer routes while using their own server functions
* Bad, because route pages are duplicated across organizer and cohost trees (mitigated by sharing UI components)
* Bad, because server functions that read the same data are duplicated with different auth wrappers (acceptable trade-off for isolation)
* Neutral, because the cohost sidebar is a separate component but can share visual structure with the organizer sidebar

## Implementation Plan

### Phase 1: Schema (already complete)

The COHOST system role and metadata interface already exist on the branch:

**`src/db/schemas/cohost.ts`** — `CohostMembershipMetadata` interface with five permission flags:
- `canViewRevenue: boolean` — can view revenue stats and financial dashboard
- `canEditCapacity: boolean` — can modify capacity defaults and per-division max spots
- `canEditScoring: boolean` — can modify scoring algorithm, point distribution, tiebreak rules
- `canEditRotation: boolean` — can modify judge rotation defaults (heats per rotation, lane shift pattern, min heat buffer)
- `canManagePricing: boolean` — can manage pricing and coupons

**`src/db/schema.ts`** — `SYSTEM_ROLES_ENUM.COHOST` already defined.

Team membership row for a cohost:
```
teamMembershipTable {
  teamId: competition_event team ID
  userId: cohost user ID
  roleId: "cohost"
  isSystemRole: true
  metadata: JSON.stringify(CohostMembershipMetadata)
}
```

### Phase 2: Cohost auth helper

Create `src/utils/cohost-auth.ts`:

**`requireCohostPermission(competitionTeamId: string, permissionKey?: keyof CohostMembershipMetadata)`**
- Reads session from cookie
- Finds team membership with `role.id === "cohost"` on the given competition team
- If `permissionKey` is provided, parses metadata and checks that the specific permission is `true`
- Throws `FORBIDDEN` if not a cohost or lacks the requested permission
- Site admins bypass all checks (consistent with `requireTeamPermission`)
- Returns the parsed `CohostMembershipMetadata` for use in downstream logic

This is intentionally separate from `requireTeamPermission` — it checks a different role on a different team type.

### Phase 3: Cohost layout route

Create `src/routes/compete/cohost/$competitionId.tsx`:

- Uses `createFileRoute("/compete/cohost/$competitionId")`
- Loader: requires authentication, fetches competition by ID (reuses `getCompetitionByIdFn` from `competition-detail-fns`), verifies user has cohost membership on the competition's team via session data (`session.teams.find(t => t.id === competition.teamId && t.role.id === "cohost")`)
- Redirects to `/sign-in` if not authenticated, `/compete` if not a cohost
- Renders `CohostSidebar` (Phase 5) wrapping `<Outlet />`
- Provides competition data and cohost permissions to child routes via route context or loader data

### Phase 4: Cohost server functions (dedicated, separate from organizer)

Create a `src/server-fns/cohost/` subdirectory with dedicated server function files. Each file mirrors an organizer server function file but uses `requireCohostPermission` instead of `requireTeamPermission`.

| Cohost server function file | Mirrors organizer file | Auth |
|---|---|---|
| `cohost/cohost-competition-fns.ts` | `competition-detail-fns.ts` | `requireCohostPermission(teamId)` |
| `cohost/cohost-division-fns.ts` | `competition-divisions-fns.ts` | `requireCohostPermission(teamId)` |
| `cohost/cohost-event-fns.ts` | `competition-event-fns.ts` | `requireCohostPermission(teamId)` |
| `cohost/cohost-workout-fns.ts` | `competition-workouts-fns.ts` | `requireCohostPermission(teamId)` |
| `cohost/cohost-registration-fns.ts` | `registration-fns.ts` | `requireCohostPermission(teamId)` |
| `cohost/cohost-waiver-fns.ts` | `waiver-fns.ts` | `requireCohostPermission(teamId)` |
| `cohost/cohost-schedule-fns.ts` | `competition-heats-fns.ts` | `requireCohostPermission(teamId)` |
| `cohost/cohost-location-fns.ts` | (location queries) | `requireCohostPermission(teamId)` |
| `cohost/cohost-volunteer-fns.ts` | `volunteer-fns.ts` | `requireCohostPermission(teamId)` |
| `cohost/cohost-results-fns.ts` | `competition-score-fns.ts` | `requireCohostPermission(teamId)` |
| `cohost/cohost-submission-fns.ts` | `video-submission-fns.ts` | `requireCohostPermission(teamId)` |
| `cohost/cohost-sponsor-fns.ts` | `sponsor-fns.ts` | `requireCohostPermission(teamId)` |
| `cohost/cohost-settings-fns.ts` | (settings queries) | `requireCohostPermission(teamId, "canEditCapacity"/"canEditScoring"/"canEditRotation")` |
| `cohost/cohost-pricing-fns.ts` | `commerce-fns.ts` | `requireCohostPermission(teamId, "canManagePricing")` |
| `cohost/cohost-revenue-fns.ts` | (revenue queries) | `requireCohostPermission(teamId, "canViewRevenue")` |
| `cohost/cohost-coupon-fns.ts` | `coupon-fns.ts` | `requireCohostPermission(teamId, "canManagePricing")` |

Key principles for cohost server functions:
- **Separate files**: Each is its own file in `src/server-fns/cohost/`, prefixed with `cohost-`
- **Own auth boundary**: Every function calls `requireCohostPermission` — never `requireTeamPermission`
- **Same DB queries**: They can read/write the same data (same tables, same Drizzle queries) — the auth layer is what differs
- **Permission-gated features**: Functions for settings, pricing, revenue, and coupons pass the relevant `permissionKey` to `requireCohostPermission`
- **No write access for destructive operations**: No `deleteCompetition`, no `updateCompetitionSlug`, no functions that exist only in the organizer's danger-zone or edit routes

### Phase 5: Cohost sidebar component

Create `src/components/cohost-sidebar.tsx`:

- Separate component from `CompetitionSidebar` (the organizer sidebar)
- Same visual structure (uses the same `Sidebar`, `SidebarMenu`, `SidebarMenuItem` primitives from `src/components/ui/sidebar.tsx`)
- Base path is `/compete/cohost/${competitionId}` instead of `/compete/organizer/${competitionId}`
- Navigation items match the cohost route pages (no "Edit Competition", no "Danger Zone")
- Conditionally shows/hides nav items based on cohost permissions:
  - `settings` link: only if any of `canEditCapacity`, `canEditScoring`, or `canEditRotation`
  - `pricing` and `coupons` links: only if `canManagePricing`
  - `revenue` link: only if `canViewRevenue`
- Accepts `permissions: CohostMembershipMetadata` as a prop (provided by the layout route loader)
- Header can say "Co-Hosting" or show a badge to distinguish from the organizer sidebar

### Phase 6: Cohost route pages

Create route pages under `src/routes/compete/cohost/$competitionId/`:

```
cohost/$competitionId/
├── index.tsx                      (overview)
├── divisions.tsx                  (view/manage divisions)
├── events/                        (view/manage events)
│   ├── index.tsx
│   ├── $eventId.tsx
│   └── $eventId/
│       ├── index.tsx
│       └── submissions/           (online only)
├── athletes.tsx                   (registrations)
├── waivers.tsx                    (waivers)
├── schedule.tsx                   (in-person only)
├── locations.tsx                  (venues)
├── volunteers.tsx                 (volunteers)
├── results.tsx                    (results entry)
├── submission-windows.tsx         (online only)
├── sponsors.tsx                   (sponsors)
├── settings.tsx                   (conditional on canEditCapacity/canEditScoring/canEditRotation)
├── pricing.tsx                    (conditional on canManagePricing)
├── revenue.tsx                    (conditional on canViewRevenue)
├── coupons.tsx                    (conditional on canManagePricing)
└── scoring.tsx                    (scoring config)
```

Key principles for cohost route pages:
- **Separate route files**: Each is its own file — they are NOT the same files as the organizer routes
- **Reuse UI components**: They CAN import and reuse the same UI components from organizer routes (forms, lists, tables, etc. from `src/components/` and `src/routes/compete/organizer/$competitionId/-components/`). The forms, table columns, and display logic can be shared
- **Own server functions**: They import from `src/server-fns/cohost/` — never from the organizer server function files
- **Permission-gated routes**: Routes for gated features (settings, pricing, revenue, coupons) should check permissions in their loader and redirect or show a 403 state if the cohost lacks the required permission
- **No edit.tsx or danger-zone.tsx**: These routes simply do not exist in the cohost tree — no need to block them at runtime

### Phase 7: Cohost entry point (from public competition page)

On the public competition page (`src/routes/compete/$slug.tsx`), detect if the current user is a cohost for this competition:

- In the loader, check `session.teams` for a membership with `role.id === "cohost"` on the competition's team
- If the user is a cohost, render a "Manage as Co-Host" button/link that navigates to `/compete/cohost/${competitionId}`
- If the user is both an organizer AND a cohost (unlikely but possible), show the organizer link as primary

### Phase 8: Invite flow (mostly complete)

The invite flow is already implemented on the branch:

- **`src/server-fns/cohost-fns.ts`**: `inviteCohostFn`, `acceptCohostInviteFn`, `getCohostInviteFn`, `getCohostsFn`, `updateCohostPermissionsFn`, `removeCohostFn`
- **`src/routes/compete/cohost-invite/$token.tsx`**: Invite acceptance page
- **`src/routes/compete/organizer/$competitionId/-components/invite-cohost-dialog.tsx`**: Organizer-side invite dialog

One change needed: after accepting an invite, redirect to `/compete/cohost/${competitionId}` instead of `/compete/organizer/${competitionId}` (the current code navigates to the organizer route, which the cohost cannot access).

### Phase 9: Session data verification

Ensure the session serialization (`src/utils/kv-session.ts`) includes:
- Team memberships with `roleId: "cohost"` and `isSystemRole: true`
- The `metadata` field on those memberships (contains permission flags)
- The `role.id` value so the cohost layout can check `t.role.id === "cohost"`

This should already work if the session serializer includes all team memberships, but verify with a manual test after implementing the layout route.

## Route Access Matrix

Routes that simply don't exist in the cohost tree are marked N/A.

| Route | Organizer | Cohost (default) | Cohost (all perms) |
|---|---|---|---|
| Overview (index) | Full access | Full access | Full access |
| Divisions | Full access | Full access | Full access |
| Events | Full access | Full access | Full access |
| Scoring | Full access | Full access | Full access |
| Registrations (athletes) | Full access | Full access | Full access |
| Waivers | Full access | Full access | Full access |
| Schedule | Full access | Full access | Full access |
| Locations | Full access | Full access | Full access |
| Volunteers | Full access | Full access | Full access |
| Results | Full access | Full access | Full access |
| Submission Windows | Full access | Full access | Full access |
| Sponsors | Full access | Full access | Full access |
| Settings | Full access | Blocked | `canEditCapacity` / `canEditScoring` / `canEditRotation` |
| Pricing | Full access | Blocked | `canManagePricing` |
| Revenue | Full access | Blocked | `canViewRevenue` |
| Coupons | Full access | Blocked | `canManagePricing` |
| Edit Competition | Full access | N/A (route doesn't exist) | N/A |
| Danger Zone | Full access | N/A (route doesn't exist) | N/A |

## Verification

- [ ] Organizer can invite a cohost via the invite dialog on the organizer settings or overview page
- [ ] Invited user receives an email with a link to `/compete/cohost-invite/$token`
- [ ] Accepting the invite creates a `teamMembershipTable` row with `roleId: "cohost"` and correct permissions metadata
- [ ] After accepting, the cohost is redirected to `/compete/cohost/$competitionId` (not organizer route)
- [ ] Cohost layout route loads successfully and shows the cohost sidebar
- [ ] Cohost can navigate to all default-access pages (overview, divisions, events, athletes, etc.)
- [ ] Cohost WITHOUT any of `canEditCapacity`/`canEditScoring`/`canEditRotation` cannot access the settings page
- [ ] Cohost WITHOUT `canManagePricing` cannot access pricing or coupons pages
- [ ] Cohost WITHOUT `canViewRevenue` cannot access the revenue page
- [ ] Cohost WITH all permissions can access settings, pricing, revenue, and coupons
- [ ] Cohost sidebar does not show nav items for gated routes when the cohost lacks permissions
- [ ] Cohost sidebar does not show "Edit Competition" or "Danger Zone" links
- [ ] Cohost cannot navigate to `/compete/organizer/$competitionId/` (organizer routes reject non-organizers)
- [ ] Organizer routes are completely unchanged — no regressions
- [ ] Organizer can update cohost permissions via `updateCohostPermissionsFn`
- [ ] Organizer can remove a cohost via `removeCohostFn` — cohost loses access immediately
- [ ] Session refresh after permission update reflects new permissions in cohost layout and sidebar
- [ ] Public competition page shows "Manage as Co-Host" button for users who are cohosts
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes

## Affected Paths

**New files:**
- `src/utils/cohost-auth.ts` — `requireCohostPermission` helper
- `src/routes/compete/cohost/$competitionId.tsx` — cohost layout route
- `src/routes/compete/cohost/$competitionId/index.tsx` — overview
- `src/routes/compete/cohost/$competitionId/divisions.tsx`
- `src/routes/compete/cohost/$competitionId/events/` — events tree
- `src/routes/compete/cohost/$competitionId/athletes.tsx`
- `src/routes/compete/cohost/$competitionId/waivers.tsx`
- `src/routes/compete/cohost/$competitionId/schedule.tsx`
- `src/routes/compete/cohost/$competitionId/locations.tsx`
- `src/routes/compete/cohost/$competitionId/volunteers.tsx`
- `src/routes/compete/cohost/$competitionId/results.tsx`
- `src/routes/compete/cohost/$competitionId/submission-windows.tsx`
- `src/routes/compete/cohost/$competitionId/sponsors.tsx`
- `src/routes/compete/cohost/$competitionId/settings.tsx`
- `src/routes/compete/cohost/$competitionId/pricing.tsx`
- `src/routes/compete/cohost/$competitionId/revenue.tsx`
- `src/routes/compete/cohost/$competitionId/coupons.tsx`
- `src/routes/compete/cohost/$competitionId/scoring.tsx`
- `src/components/cohost-sidebar.tsx` — cohost sidebar component
- `src/server-fns/cohost/cohost-competition-fns.ts`
- `src/server-fns/cohost/cohost-division-fns.ts`
- `src/server-fns/cohost/cohost-event-fns.ts`
- `src/server-fns/cohost/cohost-workout-fns.ts`
- `src/server-fns/cohost/cohost-registration-fns.ts`
- `src/server-fns/cohost/cohost-waiver-fns.ts`
- `src/server-fns/cohost/cohost-schedule-fns.ts`
- `src/server-fns/cohost/cohost-location-fns.ts`
- `src/server-fns/cohost/cohost-volunteer-fns.ts`
- `src/server-fns/cohost/cohost-results-fns.ts`
- `src/server-fns/cohost/cohost-submission-fns.ts`
- `src/server-fns/cohost/cohost-sponsor-fns.ts`
- `src/server-fns/cohost/cohost-settings-fns.ts`
- `src/server-fns/cohost/cohost-pricing-fns.ts`
- `src/server-fns/cohost/cohost-revenue-fns.ts`
- `src/server-fns/cohost/cohost-coupon-fns.ts`

**Already exists (on branch):**
- `src/db/schemas/cohost.ts` — `CohostMembershipMetadata`, `DEFAULT_COHOST_PERMISSIONS`
- `src/server/cohost.ts` — `getCohostPermissions`
- `src/server-fns/cohost-fns.ts` — invite/accept/CRUD server functions
- `src/routes/compete/cohost-invite.tsx` — invite layout
- `src/routes/compete/cohost-invite/$token.tsx` — invite acceptance page
- `src/routes/compete/organizer/$competitionId/-components/invite-cohost-dialog.tsx`

**Modified:**
- `src/routes/compete/cohost-invite/$token.tsx` — change post-accept redirect from `/compete/organizer/$competitionId` to `/compete/cohost/$competitionId`
- `src/routes/compete/$slug.tsx` — add "Manage as Co-Host" entry point

**Not modified (key point):**
- `src/routes/compete/organizer.tsx` — no changes
- `src/routes/compete/organizer/$competitionId.tsx` — no changes
- `src/routes/compete/organizer/$competitionId/*.tsx` — no changes to any organizer route page
- `src/server-fns/competition-*.ts` — no changes to any organizer server function
- `src/utils/team-auth.ts` — no changes

## Pros and Cons of the Options

### Option A: Cohost role sharing organizer routes

Cohosts navigate via the same `/compete/organizer/$competitionId/` routes. A `requireCompetitionManagePermission` helper replaces `requireTeamPermission` at ~179 call sites across ~22 server function files.

* Good, because no route duplication — single source of truth for UI
* Good, because cohosts see the exact same experience as organizers
* Bad, because requires modifying all ~22 organizer server function files
* Bad, because `requireCompetitionManagePermission` must handle two fundamentally different auth paths (organizing team permission vs. competition team cohost role) in a single helper
* Bad, because the organizer parent route's entitlement check must be bypassed for cohosts (cohosts don't need `HOST_COMPETITIONS`)
* Bad, because any future organizer feature automatically becomes a cohost feature unless explicitly blocked
* Bad, because risk of regressions in organizer experience during the migration

### Option B: Cohost role on organizing team

Cohosts become members of the organizing team with a restricted "cohost" role.

* Good, because existing `requireTeamPermission` works without modification
* Bad, because grants access to ALL competitions under that organizing team, not just one
* Bad, because pollutes the organizing team's member list with per-competition collaborators
* Bad, because cannot scope permissions per-competition
* Bad, because cohost removal from one competition requires careful handling to not affect others

### Option C: Dedicated cohost route tree (chosen)

Cohosts get their own route tree at `/compete/cohost/$competitionId/` with dedicated layout, sidebar, server functions, and route pages.

* Good, because zero changes to organizer code
* Good, because clean separation — organizer and cohost features evolve independently
* Good, because each cohost server function has its own auth boundary
* Good, because cohost sidebar can be tailored (no edit/danger-zone, permission-gated items)
* Good, because simpler auth — cohost layout checks cohost membership on competition_event team directly
* Bad, because route pages are duplicated (mitigated by sharing UI components)
* Bad, because cohost server functions duplicate DB query logic with different auth (acceptable trade-off)
* Neutral, because cohost experience may diverge from organizer over time (could be good or bad depending on needs)

## More Information

- Cohost membership is on the **competition_event team** (the team associated with the competition itself), not on the organizing team. This scopes access to a single competition.
- The `CohostMembershipMetadata` is stored as JSON in `teamMembershipTable.metadata`. The five permission flags (`canViewRevenue`, `canEditCapacity`, `canEditScoring`, `canEditRotation`, `canManagePricing`) are organizer-configurable at invite time and can be updated later.
- Cohosts do not need the `HOST_COMPETITIONS` entitlement. Their access is derived entirely from team membership with `roleId: "cohost"`.
- The invite flow sends an email with a tokenized link to `/compete/cohost-invite/$token`. The recipient must have a WODsmith account to accept. Upon acceptance, the `teamMembershipTable` row is created and sessions are refreshed.
- Future work: cohost activity audit log, cohost-specific notification preferences, "promote cohost to organizer" flow, bulk-invite cohosts, cohost templates (preset permission profiles).
