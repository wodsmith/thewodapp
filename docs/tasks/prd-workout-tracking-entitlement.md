# PRD: Workout Tracking Entitlement Gating

**App:** `apps/wodsmith-start` (TanStack Start on Cloudflare Workers)
**Status:** Draft
**Priority:** High

---

## Problem

All personal workout tracking features (Workouts, Log, Team, Dashboard, Programming, Movements, Calculator, Settings) are currently accessible to every authenticated user. We are not ready for broad usage of these features and need to restrict access to only teams that have been explicitly granted access by a site admin.

## Solution

Introduce a new `workout_tracking` feature entitlement. Teams without this entitlement will not see tracking-related nav items and will be redirected to `/compete` if they attempt to access tracking routes directly. Site admins grant this entitlement per-team via the existing `team_entitlement_override` table.

## Success Criteria

- Users whose active team lacks `workout_tracking` entitlement see only "Compete" in the nav
- Direct URL access to gated routes redirects to `/compete`
- Users whose active team HAS the entitlement see full nav and can access all tracking routes
- `admin@example.com` seed data has the entitlement on both their teams
- `/compete/*` routes are completely unaffected
- Account-level settings (profile, security, sessions, teams) remain accessible to all authenticated users

---

## Architecture Overview

### Data Flow

```
__root.tsx (beforeLoad)
  ├─ getOptionalSession() → session (includes user.teams)
  ├─ getActiveTeamIdFn() → activeTeamId
  └─ checkWorkoutTrackingAccess() → hasWorkoutTracking  ← NEW
      │
      ├─ MainNav receives { session, activeTeamId, hasWorkoutTracking }
      │   ├─ Desktop: conditionally renders Workouts, Log, Team links
      │   └─ Mobile: same
      │
      └─ _protected.tsx (beforeLoad) receives hasWorkoutTracking from context
          └─ Individual route beforeLoad checks → redirect to /compete if false
```

### Entitlement Check Path

```
hasFeature(teamId, "workout_tracking")
  1. Check team_entitlement_override (type='feature', key='workout_tracking')
     → If found: return override value (true/false)
  2. Check team_feature_entitlement snapshot
     → If found: return true
  3. Fallback to plan_feature via plan definition
     → If found: return true
  4. Return false
```

### Existing Pattern to Follow

`src/routes/compete/organizer.tsx` already implements this exact pattern for `HOST_COMPETITIONS`:
- `createServerFn` that calls `hasFeature(teamId, FEATURES.HOST_COMPETITIONS)`
- `beforeLoad` calls the server fn
- Redirects to onboarding if feature not present

---

## What Gets Gated vs. What Stays Open

### Gated (requires `workout_tracking` entitlement)

| Route | Description |
|-------|-------------|
| `/workouts` and all sub-routes | Workout library, create, edit, schedule |
| `/log` and all sub-routes | Personal workout log |
| `/team` | Team management page |
| `/dashboard` | Team dashboard |
| `/programming` and all sub-routes | Programming track browsing |
| `/movements` and all sub-routes | Movement library |
| `/calculator` and all sub-routes | Workout calculators |
| `/_protected/admin/*` | Team admin (programming, scaling) |
| `/settings/programming` and sub-routes | Programming settings |

### Nav Items Gated

| Component | Items Hidden |
|-----------|-------------|
| Desktop nav (`main-nav.tsx`) | Workouts, Log, Team links |
| Mobile nav (`mobile-nav.tsx`) | Workouts, Log, Team links |
| Settings sidebar (`settings-sidebar.tsx`) | Programming link |

### Always Accessible (no entitlement needed)

| Route | Reason |
|-------|--------|
| `/compete/*` | Competition platform - unrelated to tracking |
| `/settings/profile` | Account management |
| `/settings/security` | Security settings |
| `/settings/sessions` | Session management |
| `/settings/teams` and sub-routes | Team creation/management (needed for organizer flow) |
| `/forgot-password` | Password reset |
| Auth routes (`/sign-in`, `/sign-up`, etc.) | Authentication |

---

## Implementation Checklist

### Phase 1: Feature Definition

- [ ] **1.1** Add `WORKOUT_TRACKING` to feature constants
  - **File:** `apps/wodsmith-start/src/config/features.ts`
  - Add `WORKOUT_TRACKING: "workout_tracking"` to the `FEATURES` object
  - Category: `workouts`

- [ ] **1.2** Add feature row to main seed SQL
  - **File:** `apps/wodsmith-start/scripts/seed.sql`
  - Add to the `INSERT INTO feature` statement:
    ```sql
    ('feat_workout_tracking', 'workout_tracking', 'Workout Tracking',
     'Access to personal workout tracking features (workouts, log, team, settings)',
     'workouts', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
    ```

- [ ] **1.3** Add entitlement override for admin@example.com's teams in seed SQL
  - **File:** `apps/wodsmith-start/scripts/seed.sql`
  - Add `team_entitlement_override` rows for:
    - `team_cokkpu1klwo0ulfhl1iwzpvnbox1` (CrossFit Box One)
    - `team_personaladmin` (Admin Personal)
  - Use `type='feature'`, `key='workout_tracking'`, `value='true'`
  - Use `createdBy='usr_demo1admin'`, `reason='Early access grant'`

- [ ] **1.4** Add same feature + override to PR seed SQL
  - **File:** `apps/wodsmith-start/scripts/seed-pr.sql`
  - Mirror the feature row and override row for the PR seed user/team

- [ ] **1.5** Push schema/seed to local D1
  - Run `pnpm db:push` from `apps/wodsmith-start/`
  - Re-run seed: apply updated `seed.sql` to local D1

### Phase 2: Server-Side Entitlement Check

- [ ] **2.1** Create `checkWorkoutTrackingAccess` server function
  - **File:** `apps/wodsmith-start/src/server-fns/entitlements.ts` (new file or add to existing)
  - Use `createServerFn({ method: "GET" })`
  - Implementation:
    1. Call `getSessionFromCookie()` to get session
    2. Call `getActiveTeamId()` to get active team
    3. If no session or no active team, return `false`
    4. Call `hasFeature(activeTeamId, FEATURES.WORKOUT_TRACKING)`
    5. Return the boolean result
  - Import `hasFeature` from `@/server/entitlements`
  - Import `FEATURES` from `@/config/features`

- [ ] **2.2** Wire entitlement check into root route `beforeLoad`
  - **File:** `apps/wodsmith-start/src/routes/__root.tsx`
  - In `beforeLoad`, after getting `session` and `activeTeamId`:
    - If `session?.user` exists, call `checkWorkoutTrackingAccess()`
    - Otherwise set `hasWorkoutTracking = false`
  - Add `hasWorkoutTracking` to the returned context object
  - Update `RootComponent` to destructure `hasWorkoutTracking` from context

### Phase 3: Navigation Gating

- [ ] **3.1** Update `MainNav` props and rendering
  - **File:** `apps/wodsmith-start/src/components/nav/main-nav.tsx`
  - Add `hasWorkoutTracking: boolean` to `MainNavProps`
  - Wrap Workouts, Log, Team `<Link>`/`<a>` elements in `{hasWorkoutTracking && (...)}`
  - Update logo `href`: use `/compete` when `!hasWorkoutTracking && session?.user`, otherwise keep current behavior (`/workouts` when authenticated, `/` when not)
  - Keep Compete link always visible
  - Keep team switcher, profile icon, dark mode toggle, logout always visible

- [ ] **3.2** Update `MobileNav` rendering
  - **File:** `apps/wodsmith-start/src/components/nav/mobile-nav.tsx`
  - Add `hasWorkoutTracking: boolean` to `MobileNavProps`
  - Apply same conditional rendering as desktop: hide Workouts, Log, Team when `!hasWorkoutTracking`
  - Keep Compete link always visible

- [ ] **3.3** Pass `hasWorkoutTracking` from root to nav components
  - **File:** `apps/wodsmith-start/src/routes/__root.tsx`
  - Pass `hasWorkoutTracking` prop to `<MainNav>`
  - `MainNav` already receives and passes data to `MobileNav` - thread it through

- [ ] **3.4** Update `SettingsSidebar` to conditionally show Programming
  - **File:** `apps/wodsmith-start/src/components/settings/settings-sidebar.tsx`
  - Option A: Accept `hasWorkoutTracking` prop and conditionally filter `sidebarNavItems`
  - Option B: Use route context to read the value
  - Hide the "Programming" sidebar item when `!hasWorkoutTracking`
  - Keep Profile, Teams, Security, Sessions, Change Password, Sign out visible always

### Phase 4: Route-Level Gating

For each gated route, add a `beforeLoad` check (or modify existing `beforeLoad`) that reads the `hasWorkoutTracking` value from parent route context and redirects to `/compete` if `false`.

**Pattern for each route:**
```typescript
beforeLoad: async ({ context }) => {
  if (!context.hasWorkoutTracking) {
    throw redirect({ to: '/compete' })
  }
}
```

If the route already has a `beforeLoad`, add the check as the first line.

- [ ] **4.1** Gate `/workouts` routes
  - **File:** `apps/wodsmith-start/src/routes/_protected/workouts/index.tsx`
  - Add redirect check in `beforeLoad`
  - This gates all child routes (`/workouts/new`, `/workouts/$id`, `/workouts/$id/edit`, `/workouts/$id/schedule`) if using a layout — otherwise gate each individually

- [ ] **4.2** Gate `/log` routes
  - **File:** `apps/wodsmith-start/src/routes/_protected/log/index.tsx`
  - Add redirect check in `beforeLoad`
  - Verify child routes (`/log/new`, `/log/$id/edit`) are also gated

- [ ] **4.3** Gate `/team` route
  - **File:** `apps/wodsmith-start/src/routes/_protected/team/index.tsx`
  - Add redirect check in `beforeLoad`

- [ ] **4.4** Gate `/dashboard` route
  - **File:** `apps/wodsmith-start/src/routes/_protected/dashboard.tsx`
  - Add redirect check in `beforeLoad`

- [ ] **4.5** Gate `/programming` routes
  - **File:** `apps/wodsmith-start/src/routes/_protected/programming/index.tsx`
  - Add redirect check in `beforeLoad`
  - Verify child routes (`/$trackId`, `/subscriptions`) are also gated

- [ ] **4.6** Gate `/movements` routes
  - **File:** `apps/wodsmith-start/src/routes/_protected/movements/index.tsx`
  - Add redirect check in `beforeLoad`
  - Verify child routes (`/new`, `/$id`) are also gated

- [ ] **4.7** Gate `/calculator` routes
  - **File:** `apps/wodsmith-start/src/routes/_protected/calculator/index.tsx`
  - Add redirect check in `beforeLoad`
  - Verify `/calculator/spreadsheet` is also gated

- [ ] **4.8** Gate `/settings/programming` routes
  - **File:** `apps/wodsmith-start/src/routes/_protected/settings/programming/index.tsx`
  - Add redirect check in `beforeLoad`
  - Verify `/$trackId` child is also gated

- [ ] **4.9** Gate `/_protected/admin/*` routes
  - **Files:**
    - `apps/wodsmith-start/src/routes/_protected/admin/teams/programming/index.tsx`
    - `apps/wodsmith-start/src/routes/_protected/admin/teams/programming/$trackId/index.tsx`
    - `apps/wodsmith-start/src/routes/_protected/admin/teams/scaling/index.tsx`
  - Add redirect check in `beforeLoad` for each

- [ ] **4.10** Propagate `hasWorkoutTracking` through `_protected.tsx` context
  - **File:** `apps/wodsmith-start/src/routes/_protected.tsx`
  - In `beforeLoad`, read `hasWorkoutTracking` from the parent (root) context
  - Re-expose it so child routes can access via `context.hasWorkoutTracking`
  - Alternatively, child routes may access it from the root context directly — verify TanStack Router context inheritance behavior

### Phase 5: Redirect & Fallback Behavior

- [ ] **5.1** Set default authenticated landing page based on entitlement
  - If user navigates to `/` while authenticated:
    - With entitlement: redirect to `/workouts` (current behavior)
    - Without entitlement: redirect to `/compete`
  - **File:** Wherever the authenticated `/` redirect is handled (check `__root.tsx` or home route)

- [ ] **5.2** Update 404/catch-all behavior for gated routes
  - Ensure that a user without entitlement who hits a gated route gets redirected to `/compete`, not a 404

### Phase 6: Verification & Testing

- [ ] **6.1** Manual test: user WITHOUT entitlement
  - Sign in as a user whose active team does NOT have `workout_tracking`
  - Verify nav only shows: Compete, team switcher, profile icon, dark mode, logout
  - Verify direct URL to `/workouts` redirects to `/compete`
  - Verify direct URL to `/log` redirects to `/compete`
  - Verify direct URL to `/team` redirects to `/compete`
  - Verify direct URL to `/dashboard` redirects to `/compete`
  - Verify direct URL to `/programming` redirects to `/compete`
  - Verify direct URL to `/movements` redirects to `/compete`
  - Verify direct URL to `/calculator` redirects to `/compete`
  - Verify direct URL to `/settings/programming` redirects to `/compete`
  - Verify `/settings/profile` still accessible
  - Verify `/settings/security` still accessible
  - Verify `/settings/sessions` still accessible
  - Verify `/settings/teams` still accessible
  - Verify `/compete` fully functional
  - Verify logo links to `/compete`

- [ ] **6.2** Manual test: user WITH entitlement (admin@example.com)
  - Sign in as `admin@example.com` / `password123`
  - Verify full nav visible: Workouts, Log, Team, Compete
  - Verify all tracking routes accessible
  - Verify settings sidebar shows Programming
  - Verify logo links to `/workouts`

- [ ] **6.3** Manual test: team switching
  - If user has multiple teams, some with entitlement and some without
  - Switching to a team without entitlement should hide tracking nav items
  - Switching back should restore them

- [ ] **6.4** Type check
  - Run `pnpm type-check` from `apps/wodsmith-start/`
  - Ensure no TypeScript errors

- [ ] **6.5** Lint check
  - Run `pnpm lint` from `apps/wodsmith-start/`
  - Ensure no linting errors

- [ ] **6.6** Run tests
  - Run `pnpm test` from `apps/wodsmith-start/`
  - Ensure existing tests pass

---

## Key Files Reference (all under `apps/wodsmith-start/`)

| File | Role |
|------|------|
| `src/config/features.ts` | Feature key constants |
| `src/config/limits.ts` | Limit key constants |
| `src/server/entitlements.ts` | `hasFeature()`, `getTeamPlan()` - core entitlement service |
| `src/db/schemas/entitlements.ts` | Entitlement DB schema |
| `src/routes/__root.tsx` | Root layout - fetches session, passes to MainNav |
| `src/routes/_protected.tsx` | Protected layout - validates auth |
| `src/components/nav/main-nav.tsx` | Desktop navigation |
| `src/components/nav/mobile-nav.tsx` | Mobile navigation |
| `src/components/settings/settings-sidebar.tsx` | Settings page sidebar |
| `src/utils/team-auth.ts` | `getActiveTeamId()` utility |
| `src/utils/auth.ts` | `getSessionFromCookie()` |
| `scripts/seed.sql` | Main development seed data |
| `scripts/seed-pr.sql` | PR environment seed data |

## Risk Considerations

- **Existing production users:** If deployed without granting entitlement to existing teams, they lose tracking access. Consider a migration that grants the override to all existing teams initially, then selectively revokes.
- **Session/team switching:** Entitlement check must be reactive to team switching. If `activeTeamId` changes, the nav and route access must update accordingly.
- **Nav-only vs route-level:** Both layers (nav hiding + route redirect) are required. Nav hiding alone is insufficient — users can bookmark or share direct links.
- **Performance:** The `hasFeature()` call adds 1-2 DB queries per page load. This runs in `__root.tsx` `beforeLoad` which already makes 3 calls. Consider caching the result in the session/context if performance is a concern.
