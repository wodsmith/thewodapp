# TanStack Start Remediation Plan

**Date:** 2025-12-12  
**Epic:** thewodapp-jf2  
**Status:** Active

## Executive Summary

This remediation plan addresses non-compliant patterns found in the `apps/wodsmith-start` TanStack Start application. The audit evaluated server functions, routes, root configuration, and API routes against official TanStack Start best practices.

### Overall Compliance Score: 67%

| Area | Compliance | Priority |
|------|------------|----------|
| Server Functions | 63% (12/19 files) | HIGH |
| Route Patterns | 70% | MEDIUM |
| Root Route | 60% | HIGH |
| API Routes | 85% | LOW |

---

## Phase 1: Critical Fixes (Week 1-2)

### 1.1 Server Function Syntax Migration

**Issue:** 7 files use deprecated `createServerFn("GET", async () => {})` syntax.

**Affected Files:**
- `auth.ts` - 3 functions
- `team.ts` - 2 functions  
- `team-membership.ts` - 2 functions
- `teams-context.ts` - 3 functions
- `user.ts` - 1 function
- `passkeys.ts` - multiple functions
- `team-role.ts` - 1 function

**Migration Pattern:**

```typescript
// BEFORE (deprecated)
export const getCurrentUserFn = createServerFn("GET", async () => {
  const session = await getSessionFromCookie()
  return { session, activeTeamId: null }
})

// AFTER (modern)
export const getCurrentUserFn = createServerFn({ method: 'GET' })
  .validator(z.object({}))
  .handler(async () => {
    const session = await getSessionFromCookie()
    return { session, activeTeamId: null }
  })
```

**Action Items:**
- [ ] Migrate `auth.ts` (3 functions)
- [ ] Migrate `team.ts` (2 functions)
- [ ] Migrate `team-membership.ts` (2 functions)
- [ ] Migrate `teams-context.ts` (3 functions)
- [ ] Migrate `user.ts` (1 function)
- [ ] Migrate `passkeys.ts` (all functions)
- [ ] Migrate `team-role.ts` (1 function)

**Estimated Effort:** 4 hours

---

### 1.2 Add Missing Input Validators

**Issue:** 10 server functions lack `.validator()` chains, missing type safety.

**Functions Requiring Validators:**
1. `getCurrentUserFn` - needs `z.object({})`
2. `logoutFn` - needs `z.object({})`
3. `requireAuthFn` - needs `z.object({})`
4. `getUserTeamsFn` - needs `z.object({})`
5. `getOwnedTeamsFn` - needs `z.object({})`
6. `getActiveTeamFn` - needs `z.object({})`
7. `setActiveTeamFn` - needs team ID validator
8. `getTeamContextFn` - needs `z.object({})`
9. `getCurrentUserProfileFn` - needs `z.object({})`
10. Various passkey functions

**Pattern:**

```typescript
// Even no-input functions need empty validator
export const logoutFn = createServerFn({ method: 'POST' })
  .validator(z.object({}))
  .handler(async () => {
    // ...
  })
```

**Estimated Effort:** 2 hours

---

### 1.3 Root Route Production Fixes

**Issue:** `__root.tsx` contains demo content unsuitable for production.

**Required Changes:**

1. **Remove Demo Navigation Links** (lines 72-124)
```tsx
// REMOVE THIS ENTIRE BLOCK
<div className="p-2 flex gap-2 text-lg">
  <Link to="/">Home</Link>
  <Link to="/posts">Posts</Link>
  <Link to="/users">Users</Link>
  <Link to="/route-a">Pathless Layout</Link>
  <Link to="/deferred">Deferred</Link>
  <Link to="/this-route-does-not-exist">This Route Does Not Exist</Link>
</div>
<hr />
```

2. **Update SEO Metadata**
```tsx
head: () => ({
  meta: [
    { charSet: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ...seo({
      title: 'Wodsmith - Workout Management Platform',
      description: 'Professional workout management for CrossFit gyms',
    }),
  ],
  // ...
})
```

3. **Add Global Providers**
```tsx
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            {children}
          </SessionProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
```

4. **Remove custom script loading** (audit `/customScript.js` purpose first)

5. **Remove TypeScript error suppression** (line 115)

**Estimated Effort:** 2 hours

---

## Phase 2: Route Improvements (Week 3)

### 2.1 Add Error Components to Routes

**Issue:** No routes define `errorComponent` or `pendingComponent`.

**Pattern to Apply:**
```tsx
export const Route = createFileRoute('/_main/workouts/$id')({
  loader: async ({ params }) => {
    return getWorkoutByIdFn({ data: { id: params.id } })
  },
  component: WorkoutPage,
  errorComponent: WorkoutError,
  pendingComponent: () => <LoadingSpinner />,
})
```

**Create Shared Components:**
- `src/components/errors/RouteError.tsx`
- `src/components/loading/RouteLoading.tsx`

**Routes to Update (28 total):**
- All `_main/` routes (12)
- All `_auth/` routes (6)
- All `_settings/` routes (4)
- All `_admin/` routes (6)

**Estimated Effort:** 4 hours

---

### 2.2 Standardize Loader Return Types

**Issue:** Inconsistent loader data structures across routes.

**Standard Pattern:**
```typescript
// Define consistent response shape
type LoaderResponse<T> = {
  data: T
  meta?: {
    totalCount?: number
    page?: number
    pageSize?: number
  }
}

// Apply to all loaders
export const Route = createFileRoute('/_main/workouts')({
  loader: async () => {
    const result = await getUserWorkoutsFn({ data: { teamId: 'xxx' } })
    return result // { data: workouts, totalCount, ... }
  },
})
```

**Estimated Effort:** 3 hours

---

### 2.3 Extract Admin Inline DB Queries

**Issue:** `admin.teams.tsx` and `admin.teams.programming.tsx` have direct DB queries in loaders.

**Migration:**
```typescript
// BEFORE (in route file)
loader: async () => {
  const db = getDb()
  return db.select().from(teams).all()
}

// AFTER (server function)
// In server-functions/admin.ts
export const getAdminTeamsFn = createServerFn({ method: 'GET' })
  .validator(z.object({}))
  .handler(async () => {
    return getAllTeamsForAdmin()
  })

// In route
loader: () => getAdminTeamsFn()
```

**Estimated Effort:** 2 hours

---

## Phase 3: Polish & Optimization (Week 4)

### 3.1 Import Standardization

**Issue:** Mixed path aliases (`~/` vs `@/`)

**Action:** Standardize all imports to use `@/` prefix.

**Files to Update:**
- `passkeys.ts` - uses `~/`
- `teams-context.ts` - uses `~/`

**Estimated Effort:** 30 minutes

---

### 3.2 Logging Standardization

**Issue:** Mixed `console.log/error` and structured logging.

**Action:** Replace all `console.log/error` with `logDebug/logError` from `@/lib/logging/posthog-otel-logger`.

**Files to Update:**
- `team-role.ts`
- Various API routes

**Estimated Effort:** 1 hour

---

### 3.3 API Route Fixes

**Issue:** CSS syntax errors in OG image generation.

**Files:**
- `og.ts` (lines 260-261)
- `og-competition.ts` (lines 260-261)

**Fix:**
```css
/* Before */
left: 0
top: 0

/* After */
left: 0;
top: 0;
```

**Issue:** Missing cache headers on OG endpoints.

**Fix:**
```typescript
return new Response(svg, {
  headers: {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=86400, s-maxage=86400',
  },
})
```

**Estimated Effort:** 30 minutes

---

## Phase 4: Enhancements (Week 5+)

### 4.1 Add Rate Limiting

**Target:** `/api/chat` endpoint (AI abuse prevention)

### 4.2 Add CSRF Protection

**Target:** OAuth callback routes

### 4.3 Consider Server Action Migration

**Candidates for migration from API routes to server functions:**
- `users.ts` (JSONPlaceholder fetch)
- `users.$userId.ts` (JSONPlaceholder fetch)

These are demo routes and can likely be removed entirely.

---

## Verification Checklist

After remediation, verify:

- [ ] `pnpm build` completes without errors
- [ ] `pnpm type-check` passes
- [ ] All server functions use modern syntax
- [ ] All routes have error/pending components
- [ ] Root route renders production content
- [ ] No demo links visible in production build
- [ ] OG images render correctly
- [ ] All imports use `@/` prefix

---

## Reference Documents

- [TanStack Start Best Practices](./tanstack-start-best-practices.md)
- [Route Audit Report](./tasks/2025-12-12-route-audit-report.md)
- [TanStack Start Migration Plan](./tanstack-start-migration-plan.md)

---

## Timeline Summary

| Phase | Duration | Items |
|-------|----------|-------|
| Phase 1 | Week 1-2 | Critical syntax fixes, validators, root cleanup |
| Phase 2 | Week 3 | Route improvements, error handling |
| Phase 3 | Week 4 | Polish, imports, logging |
| Phase 4 | Week 5+ | Enhancements |

**Total Estimated Effort:** ~20 hours

---

*Generated by swarm evaluation epic thewodapp-jf2*
