# TanStack Start Migration Status

**Last Updated:** December 30, 2025

## Overview

This document tracks the migration of **wodsmith** (Next.js 15) to **wodsmith-start** (TanStack Start) with Cloudflare Workers deployment.

## Current Epic

**TanStack Start Migration - Complete Feature Parity**

- ID: `mjssscibcb3`
- Status: `open`
- Priority: P1
- Goal: Achieve 100% feature parity between wodsmith and wodsmith-start

---

## Active Tasks (In Progress)

| ID            | Title                                     | Priority | Parent Epic       |
| ------------- | ----------------------------------------- | -------- | ----------------- |
| `mjsssckdra5` | Admin Dashboard Layout & Entitlements     | P2       | Feature Parity    |
| `mjsssck16vi` | Programming Public Browse & Subscribe UI  | P1       | Feature Parity    |
| `mjssscixsz9` | Waiver Editor Components                  | P0       | Feature Parity    |
| `mjit5bbsgak` | Create ScheduledWorkoutCard component     | P1       | Workouts Redesign |
| `mjirfg7s9tu` | Create ListItem UI component              | P0       | Workouts Redesign |
| `mjirfg7zkj1` | Create WorkoutRowCard component           | P0       | Workouts Redesign |
| `mjj85ocitrt` | Create organizer competition layout route | P0       | Organizer Detail  |
| `mji2dkz8xtr` | Complete sign-in server function          | P1       | Auth PoC (closed) |
| `mji2dkzddly` | Complete sign-up server function          | P1       | Auth PoC (closed) |

---

## Open Tasks (Pending)

| ID            | Title                                      | Priority | Parent Epic      |
| ------------- | ------------------------------------------ | -------- | ---------------- |
| `mjsssclcj07` | Update Migration Checklist                 | P3       | Feature Parity   |
| `mjsssckipwv` | Admin Team Scheduling Calendar             | P2       | Feature Parity   |
| `mjssscknri9` | Admin Gym Management Routes                | P2       | Feature Parity   |
| `mjssscj4dnn` | Organizer Waiver Management Page           | P0       | Feature Parity   |
| `mjssscjau44` | Waiver Signing in Registration Flow        | P0       | Feature Parity   |
| `mjssscjf0vb` | Teammate Waiver Signing & Status Badge     | P0       | Feature Parity   |
| `mjj85ocpw2q` | Create organizer competition overview page | P1       | Organizer Detail |

---

## Completed Epics

### Phase 0-3: Foundation & Core Migration (Dec 11-12)

- **Migrate Wodsmith from Next.js to TanStack Start** (`dc6`) - 20 subtasks
  - Phase 0: Foundation Setup
  - Phase 1A/B: Database Layer & Core Utilities
  - Phase 2: Authentication System (Lucia-style with KV sessions)
  - Phase 3A/B/C: Server Functions (Auth, Workouts, Compete)
  - Phase 4: State Management (Zustand)
  - Phase 5A/B: UI Components (Shadcn/Radix + Domain)
  - Phase 6A-G: Routes (Auth, Main, Programming, Compete, Organizer, Admin, Settings)
  - Phase 7: API Routes
  - Phase 8-9: Integration Testing & Documentation

### Phase 4: Production Readiness (Dec 12)

- **Complete wodsmith-start Migration to Production** (`49w`) - 8 subtasks
  - Cloudflare Infrastructure Setup
  - Email Infrastructure (Resend/Brevo)
  - Google OAuth Routes
  - Entitlements System
  - Stripe Connect Integration
  - Credits & Billing System
  - Admin Team Routes (32 routes)
  - Competition Organizer Routes (15 routes)

### Server/Client Code Separation (Dec 12)

- **Fix Server/Client Code Separation** (`mj0`) - 5 subtasks
  - Renamed DB layer files to `.server.ts` pattern
  - Renamed auth/session utilities to `.server.ts` pattern
  - Moved sso-buttons.tsx out of routes directory
  - Updated all imports in server-functions
  - Updated all imports in routes

### TanStack Start Best Practices (Dec 12)

- **TanStack Start Best Practices Evaluation** (`jf2`) - 6 subtasks
  - Documented best practices guidelines
  - Audited server functions, routes, root route, API routes
  - Generated remediation plan

### Missing Exports Fix (Dec 12)

- **Fix TanStack Start Missing Export Errors** (`ah9`) - 9 subtasks
  - Auth & Passkey Server Functions
  - Teams Server & Actions
  - Workouts Server & Components
  - Movements, Logs, Programming
  - Competitions & Related
  - Nav & Settings Components
  - Scaling & Logging Utilities

### Component Porting (Dec 12)

- **Port Competition Organizer Components** (`663`) - 6 subtasks
  - Shared Components (Breadcrumb, TeamFilter, CompetitionsList)
  - Server Functions (getUserOrganizingTeamsFn)
  - Series Management, Competition Form, Events Management
  - Pricing and Revenue Components

### Auth PoC (Dec 23)

- **Phase 1: TanStack Start Auth PoC** (`mji2dkygr3u`) - 3 subtasks
  - Complete sign-in/sign-up server functions
  - Test auth flow end-to-end

### Workouts Migration (Dec 23)

- **Migrate Workouts List Page (MVP)** (`mji4wjphbtr`) - 2 subtasks
- **Redesign workouts page with row view** (`mjirfg7cldi`) - 4 subtasks

### Registration Flow (Dec 24)

- **Create registration success route** (`mjjimkepyln`)

### Calculator & Compete Extended (Dec 30)

- **Calculator Routes** (`mjssscksd19`) - Closed
- **Compete Extended - Athlete Portal** (`mjssscl1qdi`) - Closed
- **Compete Extended - Organizer Features** (`mjssscl6n04`) - Closed

---

## Known Technical Issues

### Critical: Server Function Dynamic Imports

**Problem:** TanStack Start bundles top-level imports from `server-fns/*.ts` files into the client bundle, causing Vite errors like:

```
Failed to resolve import "cloudflare:workers" from "src/db/index.ts"
```

**Solution:** Use dynamic imports inside `createServerFn` handlers:

```typescript
// BAD - Top-level imports
import {getDb} from '@/db'
export const myFn = createServerFn({method: 'GET'}).handler(async () => {
  const db = getDb()
})

// GOOD - Dynamic imports
export const myFn = createServerFn({method: 'GET'}).handler(async () => {
  const {getDb} = await import('@/db')
  const db = getDb()
})
```

**Files Fixed:**

- `admin-fns.ts`

**Files Still Needing Review:**

- `athlete-profile-fns.ts`
- `registration-fns.ts`
- `sponsor-fns.ts`
- `waiver-fns.ts`
- All other `server-fns/*.ts` files with top-level `@/db` imports (34 files total)

---

## Current Working State

### Modified Files (Uncommitted)

- `apps/wodsmith-start/package.json`
- `apps/wodsmith-start/src/db/schema.ts`
- `apps/wodsmith-start/src/routeTree.gen.ts`
- Auth routes: `reset-password.tsx`, `sign-in.tsx`, `sign-up.tsx`, `verify-email.tsx`
- Compete routes: `compete.tsx`, `$slug/register.tsx`, `register/success.tsx`
- Server functions: `auth-fns.ts`, `invite-fns.ts`, `organizer-admin-fns.ts`, `programming-fns.ts`, `registration-fns.ts`, `session-fns.ts`, `sponsor-fns.ts`, `team-settings-fns.ts`
- Utils: `auth.ts`, `team-auth.ts`

### New Untracked Files

- `src/components/compete/` - Competition components
- `src/components/editor/` - Rich text editor
- `src/components/team-switcher.tsx`
- `src/db/schemas/waivers.ts`
- `src/routes/_protected/calculator/`
- `src/routes/_protected/programming/`
- `src/routes/admin.tsx` and `src/routes/admin/`
- `src/routes/compete/$slug/teams/`
- `src/routes/compete/athlete/`
- `src/routes/compete/organizer/onboard/`
- `src/routes/compete/organizer/settings/`
- `src/server-fns/admin-fns.ts`
- `src/server-fns/athlete-profile-fns.ts`
- `src/server-fns/waiver-fns.ts`
- `src/state/` - Zustand stores

---

## Statistics

### Beads Summary

- **Total Issues:** 215
- **Closed:** ~190
- **Open:** ~15
- **In Progress:** 9
- **Blocked:** 1 (`wodsmith-2k9.2` - logs.ts refactor)

### Open Epics

1. `mjssscibcb3` - TanStack Start Migration - Complete Feature Parity
2. `mjj85obzlwv` - Organizer Competition Detail - Sidebar Layout
3. `jqf` - Fix Stripe Connect OAuth session issues
4. `t76` - Public Volunteer Sign-up Page
5. `wodsmith-2k9` - Remove legacy results/sets tables
6. `wodsmith-ulx` - Replace compete scoring with @/lib/scoring

---

## Next Steps

1. **Fix remaining server-fns files** - Convert top-level imports to dynamic imports
2. **Complete in-progress tasks** - Focus on P0/P1 items first
3. **Run type-check** - `pnpm type-check` in `apps/wodsmith-start`
4. **Test dev server** - Verify no Vite errors at `localhost:3000`
5. **Commit working state** - Once all errors resolved

---

## Related Documentation

- [TanStack Start Migration Plan](/docs/plans/migrate-to-tanstack-start.md)
- [TanStack Start Research](/docs/research/tanstack-start-research.md)
- [ADR: Migrate to TanStack Start](/docs/adr/0001-migrate-to-tanstack-start.md)
