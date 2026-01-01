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

## Recently Completed (Dec 30, 2025)

| ID            | Title                                  | Priority | Status    |
| ------------- | -------------------------------------- | -------- | --------- |
| `mjsssckipwv` | Admin Team Scheduling Calendar         | P2       | ✅ Closed |
| `mjssscknri9` | Admin Gym Management Routes            | P2       | ✅ Closed |
| `mjssscj4dnn` | Organizer Waiver Management Page       | P0       | ✅ Closed |
| `mjssscjau44` | Waiver Signing in Registration Flow    | P0       | ✅ Closed |
| `mjssscjf0vb` | Teammate Waiver Signing & Status Badge | P0       | ✅ Closed |

---

## Open Tasks (Pending)

| ID            | Title                                      | Priority | Parent Epic      |
| ------------- | ------------------------------------------ | -------- | ---------------- |
| `mjsssclcj07` | Update Migration Checklist                 | P3       | Feature Parity   |
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

### Waiver Management & Admin Features (Dec 30)

- **Waiver Management System** - All P0 tasks completed

  - Organizer waiver management page with CRUD and drag-drop reordering
  - Waiver signing step component for registration flow
  - Waiver status badge for athletes list
  - Database migration for waivers tables (0065_add-waivers-tables.sql)

- **Admin Team Features** - All P2 tasks completed
  - Admin teams list page with stats and filtering
  - Team detail page with overview and scheduling tabs
  - Team scheduling calendar using FullCalendar

---

## Known Technical Issues

### Critical: Server Function Dynamic Imports (RESOLVED)

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
- `waiver-fns.ts`
- `organizer-onboarding-fns.ts`
- `admin-team-fns.ts`

**Debugging Guide:** See AGENTS.md section "Debugging TanStack Start Vite Errors"

---

## Current Working State

### Recent Commits (Dec 30)

1. `55384e49` - feat(wodsmith-start): add waivers migration with camelCase columns
2. `e5137cd8` - feat(wodsmith-start): add waiver management and admin team features
3. `ac0483bc` - feat(wodsmith-start): add remaining migration routes and fix dynamic imports

### New Routes Added

- `/compete/organizer/$competitionId/waivers` - Waiver management page
- `/compete/$slug/register` - Registration with waiver signing step
- `/admin/teams` - Admin teams list
- `/admin/teams/$teamId` - Team detail with overview tab
- `/admin/teams/$teamId/scheduling` - Team scheduling calendar

### New Components

- `waiver-list.tsx` - Drag-drop waiver list with CRUD
- `waiver-form-dialog.tsx` - Create/edit waiver dialog
- `waiver-signing-step.tsx` - Registration waiver signing
- `waiver-status-badge.tsx` - Athlete waiver status indicator
- `team-scheduling-calendar.tsx` - FullCalendar for admin

### Database Migrations

- `0065_add-waivers-tables.sql` - Creates `waivers` and `waiver_signatures` tables with camelCase columns

---

## Statistics

### Beads Summary

- **Total Issues:** ~220
- **Closed:** ~205
- **Open:** ~5
- **In Progress:** 0
- **Blocked:** 1 (`wodsmith-2k9.2` - logs.ts refactor)

### Open Epics

1. `mjssscibcb3` - TanStack Start Migration - Complete Feature Parity (nearly complete)
2. `mjj85obzlwv` - Organizer Competition Detail - Sidebar Layout
3. `jqf` - Fix Stripe Connect OAuth session issues
4. `t76` - Public Volunteer Sign-up Page
5. `wodsmith-2k9` - Remove legacy results/sets tables
6. `wodsmith-ulx` - Replace compete scoring with @/lib/scoring

---

## Next Steps

1. ~~Fix remaining server-fns files~~ ✅ Done
2. ~~Complete waiver management tasks~~ ✅ Done
3. ~~Complete admin team features~~ ✅ Done
4. **Close epic** - `mjssscibcb3` can be closed once PR is merged
5. **Production testing** - Test all new features in staging environment
6. **Documentation** - Update user-facing docs for new features

---

## Related Documentation

- [TanStack Start Migration Plan](/docs/plans/migrate-to-tanstack-start.md)
- [TanStack Start Research](/docs/research/tanstack-start-research.md)
- [ADR: Migrate to TanStack Start](/docs/adr/0001-migrate-to-tanstack-start.md)
- [AGENTS.md](/AGENTS.md) - Contains TanStack Start debugging guide
