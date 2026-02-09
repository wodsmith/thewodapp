# Workout Tracking Entitlement Gating - Investigation & Implementation Plan

**App: `apps/wodsmith-start`** (TanStack Start on Cloudflare Workers)

All file paths below are relative to `apps/wodsmith-start/` unless otherwise noted.

## Goal

Hide all personal workout tracking features (Workouts, Log, Team, Profile/Settings) behind an entitlement that site admins can grant to specific teams. Only teams with the entitlement see these nav items and can access the routes. `/compete` routes remain publicly accessible regardless.

---

## Current State

### Features Currently Ungated

These routes/nav items are accessible to **any authenticated user**, with no entitlement check:

| Nav Item | Route(s) | Description |
|----------|----------|-------------|
| **Workouts** | `/workouts`, `/workouts/new`, `/workouts/$id`, `/workouts/$id/edit`, `/workouts/$id/schedule` | Workout library, creation, editing, scheduling |
| **Log** | `/log`, `/log/new`, `/log/$id/edit` | Personal workout log |
| **Team** | `/team` | Team management page |
| **Dashboard** | `/dashboard` | Team dashboard with scheduled workouts |
| **Settings** | `/settings/*` (profile, teams, security, sessions, programming) | User profile and team settings |
| **Programming** | `/programming`, `/programming/$trackId`, `/programming/subscriptions` | Programming track browsing |
| **Movements** | `/movements`, `/movements/new`, `/movements/$id` | Movement library |
| **Calculator** | `/calculator`, `/calculator/spreadsheet` | Workout calculators |
| **Admin** | `/_protected/admin/*` | Team admin features (programming, scaling) |

### Existing Entitlement System

The app has a mature entitlement system already in place:

- **Feature table** (`feature`): Defines available features with keys like `basic_workouts`, `programming_tracks`, etc.
- **Team Feature Entitlements** (`team_feature_entitlement`): Snapshot source-of-truth for what features a team has
- **Entitlement Overrides** (`team_entitlement_override`): Manual admin overrides per team
- **`hasFeature(teamId, featureKey)`**: Checks overrides first, then snapshots - **ready to use**
- **Existing pattern**: The `/compete/organizer` route already gates on `HOST_COMPETITIONS` feature

### Existing Feature Keys (in `src/config/features.ts`)

```typescript
BASIC_WORKOUTS: "basic_workouts"        // category: workouts
PROGRAMMING_TRACKS: "programming_tracks" // category: programming
PROGRAM_CALENDAR: "program_calendar"     // category: programming
PROGRAM_ANALYTICS: "program_analytics"   // category: programming
CUSTOM_SCALING_GROUPS: "custom_scaling_groups" // category: scaling
AI_WORKOUT_GENERATION: "ai_workout_generation" // category: ai
AI_PROGRAMMING_ASSISTANT: "ai_programming_assistant" // category: ai
MULTI_TEAM_MANAGEMENT: "multi_team_management" // category: team
HOST_COMPETITIONS: "host_competitions"   // category: team
```

### Seed Data - admin@example.com

- **User**: `usr_demo1admin`, role: `admin`
- **Teams**:
  - `team_cokkpu1klwo0ulfhl1iwzpvnbox1` (CrossFit Box One) - Pro plan, owner
  - `team_personaladmin` (Admin Personal) - Free plan, owner
  - `team_winter_throwdown_2025` (competition event team) - admin
- **CrossFit Box One** already has `feat_basic_workouts` feature entitlement

---

## Proposed Implementation

### Option A: New Feature Key (Recommended)

Add a new feature: `WORKOUT_TRACKING: "workout_tracking"` (category: `workouts`)

**Why new key instead of reusing `basic_workouts`?**
- `basic_workouts` is already granted to all plans (Free, Pro, Enterprise) via `plan_feature`
- A new key avoids disrupting existing plan definitions
- Semantically clearer: this gates the *entire tracking experience*, not just "basic workout creation"
- Easier to grant/revoke independently via `team_entitlement_override`

### Option B: Reuse `basic_workouts`

Remove `basic_workouts` from all plan_feature associations so no plan grants it by default, then manually grant it to specific teams. Simpler but riskier - breaks existing teams' access unless carefully migrated.

**Recommendation: Option A** - new `workout_tracking` feature key.

---

## Implementation Steps

### 1. Add New Feature Key

**File: `src/config/features.ts`**
```typescript
export const FEATURES = {
  // ...existing...
  WORKOUT_TRACKING: "workout_tracking", // NEW - gates all non-compete tracking features
} as const
```

### 2. Add Feature to Database (Seed + Migration)

**File: `scripts/seed.sql`** - Add to feature INSERT:
```sql
('feat_workout_tracking', 'workout_tracking', 'Workout Tracking',
 'Access to personal workout tracking features (workouts, log, team, settings)',
 'workouts', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
```

**File: `scripts/seed.sql`** - Add entitlement override for admin's teams:
```sql
-- Grant workout_tracking to CrossFit Box One (admin@example.com's gym team)
INSERT OR IGNORE INTO team_entitlement_override
  (id, teamId, type, key, value, reason, expiresAt, createdBy, createdAt, updatedAt, updateCounter)
VALUES
  ('teo_box1_workout_tracking', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1', 'feature', 'workout_tracking', 'true', 'Early access grant', NULL, 'usr_demo1admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0),
  ('teo_padmin_workout_tracking', 'team_personaladmin', 'feature', 'workout_tracking', 'true', 'Early access grant', NULL, 'usr_demo1admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);
```

Also need a DB push/migration to add the feature row.

### 3. Create Server Function to Check Entitlement

**File: `src/server-fns/entitlements.ts`** (or add to existing)

Create a `checkWorkoutTrackingAccess` server function that:
1. Gets active team ID from cookie
2. Calls `hasFeature(teamId, FEATURES.WORKOUT_TRACKING)`
3. Returns boolean

This should be called in:
- The `_protected` layout route's `beforeLoad` (to expose to all child routes)
- Or a new layout route wrapper for tracking-specific routes

### 4. Gate Navigation Items

**Files to modify:**
- `src/components/nav/main-nav.tsx` - Hide Workouts, Log, Team links + settings icon
- `src/components/nav/mobile-nav.tsx` - Same items on mobile
- `src/components/settings/settings-sidebar.tsx` - Hide Programming settings item (keep Profile, Security, Sessions as account-level)

**Approach**: Pass `hasWorkoutTracking: boolean` prop down from the root layout that already fetches the session. The nav components conditionally render tracking items.

### 5. Gate Routes (Server-Side)

**Option 5A: Middleware in `_protected.tsx` layout** (simpler)
- Check entitlement in `_protected` route's `beforeLoad`
- Pass result to context
- Each tracking route checks context and redirects if no entitlement

**Option 5B: New layout route** (cleaner separation)
- Create `_protected/_tracking.tsx` layout route
- Move tracking routes (workouts, log, team, dashboard, programming, movements, calculator, admin) under it
- `_tracking.tsx` `beforeLoad` checks entitlement, redirects to `/compete` if missing

**Recommendation: 5A** - Less file reorganization. Just add the check to `_protected.tsx` and have individual routes check `context.hasWorkoutTracking`.

### 6. Redirect Behavior

When a user without the entitlement hits a tracking route:
- Redirect to `/compete` (the only feature they have access to)
- The logo link should go to `/compete` instead of `/workouts` for these users

### 7. What Stays Accessible Without Entitlement

| Feature | Why |
|---------|-----|
| `/compete/*` | Competition platform - public |
| `/settings/profile` | Basic account management |
| `/settings/security` | Password/security management |
| `/settings/sessions` | Session management |
| `/settings/teams` | Team creation (needed for compete organizer flow) |
| Auth routes | Sign in/up/out |

### 8. Admin Granting Mechanism

The `team_entitlement_override` table already supports this perfectly:
- Site admin creates an override with `type='feature'`, `key='workout_tracking'`, `value='true'`
- `hasFeature()` checks overrides FIRST, so this works immediately
- Could add a simple admin UI page later, but for now SQL/seed is sufficient

---

## Files to Touch (all under `apps/wodsmith-start/`)

| File | Change |
|------|--------|
| `src/config/features.ts` | Add `WORKOUT_TRACKING` constant |
| `scripts/seed.sql` | Add feature row + override for admin teams |
| `scripts/seed-pr.sql` | Same for PR environments |
| `src/routes/_protected.tsx` | Check entitlement in `beforeLoad`, expose to context |
| `src/components/nav/main-nav.tsx` | Conditionally render tracking nav items |
| `src/components/nav/mobile-nav.tsx` | Same for mobile |
| `src/components/settings/settings-sidebar.tsx` | Hide Programming settings link |
| `src/routes/_protected/workouts/index.tsx` | Redirect if no entitlement |
| `src/routes/_protected/log/index.tsx` | Redirect if no entitlement |
| `src/routes/_protected/team/index.tsx` | Redirect if no entitlement |
| `src/routes/_protected/dashboard.tsx` | Redirect if no entitlement |
| `src/routes/_protected/programming/index.tsx` | Redirect if no entitlement |
| `src/routes/_protected/movements/index.tsx` | Redirect if no entitlement |
| `src/routes/_protected/calculator/index.tsx` | Redirect if no entitlement |
| `src/routes/_protected/settings/programming/index.tsx` | Redirect if no entitlement |
| `src/routes/_protected/admin/*` | Redirect if no entitlement |

---

## Complexity Assessment

**Low-Medium complexity**. The entitlement system is already built and battle-tested (used for HOST_COMPETITIONS). The main work is:

1. Add 1 feature key + seed data (~30 min)
2. Wire entitlement check into protected layout (~1 hour)
3. Conditionally render nav items in 3 files (~30 min)
4. Add redirect guards to ~10 route files (~1-2 hours)

**Estimated total: ~3-4 hours of implementation**

---

## Risk Considerations

- **Existing users**: If deployed without granting the entitlement to existing teams, they'd lose access. Need a migration strategy or make the feature default-granted in plans initially, then remove later.
- **Session caching**: The nav currently gets session data from the root layout. Entitlement data needs to be included or separately fetched.
- **Route vs Nav consistency**: Must ensure both nav hiding AND route-level redirects are in place. Hiding nav alone is insufficient (users could bookmark/direct-link).
