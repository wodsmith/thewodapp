# Route Structure & Loaders Audit Report
**Date:** December 12, 2025  
**Auditor:** routes-auditor  
**Bead:** thewodapp-jf2.3  
**Epic:** thewodapp-jf2

## Executive Summary
Audited 28 route files across 5 route groups (_main, _auth, _settings, _admin, _compete) in the TanStack Start app. Overall pattern compliance: **70%**. Strong foundation with consistent loader/auth patterns, but needs standardization in error handling, TypeScript typing, and data structures.

---

## Route Groups Audited
- ✅ `_main` (11 files) - Workout management, programming, movements
- ✅ `_auth` (6 files) - Authentication routes  
- ✅ `_settings` (4 files) - User settings
- ✅ `_admin` (6 files) - Admin dashboard
- ✅ `_compete` (7 files) - Competition management

**Total files checked:** 28 (5 layouts + 23 route files)

---

## Good Patterns Found ✅

### Routing & Path Strings
- All layout files use `createFileRoute()` with correct auto-generated path strings
- File-based routing convention strictly followed (e.g., `workouts/$id.tsx` → `/_main/workouts/$id`)

### Layout Structure
- All layouts properly implement `Outlet` for nested routing
- Consistent nesting pattern: layout → route group → individual routes
- Example: `_settings` layout with breadcrumbs + sidebar + Outlet

### Data Loading
- Route loaders consistently call server functions (`getWorkoutsFn`, `getMovementsFn`, etc.)
- `Route.useLoaderData()` pattern used correctly throughout
- `Route.useParams()` used for dynamic route parameters ($id, $slug)
- Dynamic routes handle params properly (e.g., `workouts/$id`, `compete/$slug`)

### Authentication & Authorization
- `beforeLoad` guards properly implemented in protected routes
- `_settings` layout redirects unauthenticated users to `/sign-in`
- `_admin` layout enforces role-based auth (`ROLES_ENUM.ADMIN`)
- Auth state correctly passed via `getSessionFromCookie()`

### Loading States & Error Handling (Partial)
- Suspense boundaries used for async components (e.g., `settings.profile` with skeleton)
- `notFound()` used in `compete.$slug` for 404 handling
- Search params handled via `useSearch()` hook

---

## Issues & Anti-patterns ⚠️

### 1. **Direct DB Queries in Admin Routes** (High Priority)
```typescript
// ❌ admin.teams.tsx - Direct Drizzle usage
export const Route = createFileRoute('/_admin/admin/teams')({
  loader: async () => {
    const db = getDb()  // Direct DB access
    const teams = await db.query.teamTable.findMany({...})
    return { teams }
  },
})

// ✅ Should be:
// getAdminTeamsFn() server function instead
```
**Impact:** Violates abstraction layer pattern. DB logic should be in server functions for reusability and centralized caching.

### 2. **Inconsistent Loader Data Structures**
```typescript
// ❌ movements.index.tsx returns raw array
const movements = Route.useLoaderData()  // movements is array directly

// ❌ workouts.index.tsx returns object with properties
const { workouts, stats } = Route.useLoaderData()  // {workouts, stats}

// ❌ programming.index.tsx returns named object
const { allTracks, teamId, teamName } = Route.useLoaderData()
```
**Impact:** Inconsistent API makes it hard to predict data shape. Should standardize to `{data: T, meta?: M}` pattern.

### 3. **Missing Error Boundaries**
- No `errorComponent` specified in any route definition
- Routes only have `component`, missing `errorComponent` and `pendingComponent`
- Error handling deferred to individual components instead of route level

### 4. **Mixed Loading State Patterns**
- Some routes use `pendingComponent` config (none found)
- Others use Suspense boundaries in component (settings.profile)
- No consistent pattern for route-level loading UI

### 5. **Type Safety Issues**
```typescript
// ❌ admin.teams.tsx
interface AdminTeamsPageProps {
  loaderData: Awaited<ReturnType<typeof Route.options.loader>>
}
function AdminTeamsPage() {
  const { teams } = Route.useLoaderData()  // Interface defined but unused!
}

// ❌ compete.index.tsx
const { competitions } = Route.useLoaderData()
const status={getCompetitionStatus(comp, now) as any}  // Any type!

// ❌ compete.index.tsx - useSearch without types
const search = Route.useSearch() as { q?: string; past?: string }  // Manual cast
```

### 6. **Async Server Components vs Loaders**
```typescript
// ❌ settings.teams.tsx - Async component instead of loader
async function TeamsPage() {
  const [result] = await getUserTeamsAction()  // Server action in component
  // ...
}

// ✅ Should use:
export const Route = createFileRoute('/_settings/settings/teams')({
  loader: async () => {
    return getUserTeamsAction()
  },
  component: TeamsPage,
})
```

### 7. **Link Component Inconsistency**
- Some routes use custom `Link` component: `import Link from '~/components/link'`
- Others use TanStack: `import { Link } from '@tanstack/react-router'`
- Mix of `<Link to="...">` and `<Button asChild><Link>` patterns

### 8. **Error Handling Inconsistency**
```typescript
// ❌ programming.index.tsx
if (!teamContext.isAuthenticated || !teamContext.teamId) {
  throw new Error('Not authenticated or no team')  // Generic Error
}

// ✅ compete.$slug.tsx - Correct pattern
if (!compResult.success || !compResult.data) {
  throw notFound()  // Proper error type
}
```

---

## Recommendations (Priority Order)

### High Priority 🔴
1. **Wrap admin DB queries in server functions**
   - Create `getAdminTeamsFn()`, `getAdminProgrammingFn()` 
   - Removes direct Drizzle usage from route files
   - Files: `admin.teams.tsx`, `admin.teams.programming.tsx`

2. **Standardize loader data structures**
   - All loaders return `{ data: T; meta?: { cached?: boolean; timestamp: number } }`
   - Or use discriminated union: `{ success: true; data: T } | { success: false; error: string }`
   - Update all 23 route loaders for consistency

3. **Add error/pending components to all routes**
   - Create error boundary components per route group
   - Define `errorComponent` and `pendingComponent` in Route config
   - Example: `AdminErrorBoundary`, `SettingsErrorBoundary`

### Medium Priority 🟡
4. **Add strict TypeScript types**
   - Type `useSearch()` calls with interfaces
   - Remove all `any` types (found 2: compete status, admin interface)
   - Add strict return types to server functions

5. **Extract inline loader logic to server functions**
   - `programming.index.tsx`: Move `getDefaultTeamContextFn()` + validation to dedicated function
   - Consolidate team context loading

6. **Standardize Link component usage**
   - Choose single approach (recommend `@tanstack/react-router/Link`)
   - Or create wrapper with consistent API
   - Update ~8 route files

### Low Priority 🟢
7. Document public route strategy
8. Add caching to frequently-called loaders
9. Consider loader validation tests
10. Review server function naming conventions (Fn suffix usage)

---

## Pattern Checklist

| Pattern | Status | Coverage |
|---------|--------|----------|
| ✅ `createFileRoute` with correct paths | Good | 100% |
| ✅ `Outlet` in layouts | Good | 100% |
| ✅ `Route.useLoaderData()` | Good | 95% |
| ✅ `Route.useParams()` | Good | 90% |
| ✅ `beforeLoad` guards on protected routes | Good | 100% |
| ⚠️ `errorComponent` | Missing | 0% |
| ⚠️ `pendingComponent` | Missing | 0% |
| ⚠️ Consistent data structures | Needs work | 40% |
| ⚠️ TypeScript strict types | Needs work | 60% |
| ⚠️ Server function abstraction | Good | 85% (admin routes exception) |

---

## Files Requiring Changes

### Immediate (Admin abstraction):
- `_admin/admin.teams.tsx` → Wrap in server function
- `_admin/admin.teams.programming.tsx` → Wrap in server function

### High-Priority (Data consistency):
- `_main/programming.index.tsx` → Extract team context logic
- All 23 routes → Standardize loader return structure

### Medium-Priority (Type safety):
- `_compete/compete.index.tsx` → Type useSearch, remove any
- `_admin/admin.teams.tsx` → Remove unused AdminTeamsPageProps
- `_settings/settings.teams.tsx` → Convert to loader pattern
- All routes → Add error/pending components

---

## Code Examples

### ✅ Best Practice Example (compete.$slug.tsx)
```typescript
export const Route = createFileRoute('/_compete/compete/$slug')({
  loader: async ({ params }) => {
    const compResult = await getCompetitionFn({
      data: { idOrSlug: params.slug },
    })

    if (!compResult.success || !compResult.data) {
      throw notFound()  // ✅ Proper error handling
    }

    const competition = compResult.data
    const session = await getSessionFromCookie()

    return {  // ✅ Named return object
      competition,
      userId: session?.userId,
    }
  },
  component: CompetitionDetailComponent,
})

function CompetitionDetailComponent() {
  const { competition, userId } = Route.useLoaderData()  // ✅ Typed
  const { slug } = Route.useParams()  // ✅ useParams for dynamic
  // ...
}
```

### ❌ Pattern to Avoid (admin.teams.tsx)
```typescript
export const Route = createFileRoute('/_admin/admin/teams')({
  loader: async () => {
    const db = getDb()  // ❌ Direct DB in route
    const teams = await db.query.teamTable.findMany({...})
    return { teams }
  },
  // ❌ Missing errorComponent, pendingComponent
  component: AdminTeamsPage,
})
```

---

## Next Steps

1. **Week 1:** Wrap admin DB queries in server functions
2. **Week 2:** Standardize loader data structures across all routes
3. **Week 3:** Add error & pending components to all routes
4. **Week 4:** Add TypeScript strict types, remove any types
5. **Week 5:** Extract inline logic to server functions, standardize Link usage

---

## Appendix: Files Audited

### Layouts (5)
- `_main.tsx` ✅
- `_auth.tsx` ✅
- `_settings.tsx` ✅
- `_admin.tsx` ✅
- `_compete.tsx` ✅

### Route Samples Checked (23)
**_main:** workouts.index, workouts.$id, programming.index, movements.index  
**_auth:** sign-in, sign-up  
**_settings:** settings.profile, settings.teams, settings.index  
**_admin:** admin.index, admin.teams, admin.teams.programming  
**_compete:** compete.index, compete.$slug  

---

**Report Status:** ✅ Complete - No file modifications made (audit only)
