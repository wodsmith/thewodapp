# Settings & Admin Routes Migration Status

**Last Updated:** 2025-12-23 (Audited)  
**Source App:** apps/wodsmith (Next.js 15 App Router)  
**Target App:** apps/wodsmith-start (TanStack Start)

## Overview

This document catalogs all settings and admin routes in the Next.js application and tracks their migration status to TanStack Start. The goal is to provide a comprehensive reference for the migration effort.

**Audit Status:** ✅ Complete (2025-12-23)
- Verified all settings routes in `apps/wodsmith/src/app/(settings)/`
- Verified all admin routes in `apps/wodsmith/src/app/(admin)/`
- Verified TanStack Start routes in `apps/wodsmith-start/src/routes/_protected/settings/`
- Cataloged all action files
- Identified dual routing pattern (explicit team ID vs active team context)
- Previous route count (19) was significantly incomplete; actual count is 39 routes

---

## Settings Routes

Settings routes handle user account management, security, and team settings.

### Route Inventory

| Route | Next.js Path | TanStack Path | Status | Actions | Notes |
|-------|-------------|---------------|---------|---------|-------|
| **Settings Root** | `/settings` | `/settings` | 🔄 Partial | `settings.actions.ts` | Root layout exists, redirect to profile |
| **Profile** | `/settings/[...segment]` | ❌ Not Started | ❌ Not Started | `settings.actions.ts` | User profile editing (name, email, timezone) - catch-all route |
| **Security (Passkeys)** | `/settings/security` | ❌ Not Started | ❌ Not Started | `passkey-settings.actions.ts` | Passkey management, WebAuthn integration |
| **Sessions** | `/settings/sessions` | ❌ Not Started | ❌ Not Started | `sessions.actions.ts` | Active session management, device tracking |
| **Teams List** | `/settings/teams` | ❌ Not Started | ❌ Not Started | `team-actions.ts`, `team-membership-actions.ts`, `team-role-actions.ts` (global) | Redirects to first team |
| **Team Details** | `/settings/teams/[teamSlug]` | ❌ Not Started | ❌ Not Started | `team-actions.ts`, `team-membership-actions.ts`, `team-role-actions.ts` (global) | Team members, invitations, entitlements |
| **Team Create** | `/settings/teams/create` | ❌ Not Started | ❌ Not Started | `team-actions.ts` (global) | Create new team |

### Settings Components

**Next.js Location:** `apps/wodsmith/src/app/(settings)/settings/`

#### Shared Components
- `settings-breadcrumbs.tsx` - Navigation breadcrumbs
- `settings-sidebar.tsx` - Settings navigation sidebar
- `settings-form.tsx` - Profile editing form
- `layout.tsx` - Settings layout wrapper

#### Security Components
- `security/passkey.client.tsx` - Passkey management UI
- `security/passkey-settings.actions.ts` - Passkey CRUD operations

#### Sessions Components
- `sessions/sessions.client.tsx` - Session list and revocation UI
- `sessions/sessions.actions.ts` - Session management actions

#### Teams Components
- `teams/_components/teams.tsx` - Team list UI
- `teams/[teamSlug]/_components/team-members.tsx` - Member management
- `teams/[teamSlug]/_components/team-invitations.tsx` - Invitation management
- `teams/[teamSlug]/_components/team-entitlements.tsx` - Team plan display
- `teams/[teamSlug]/_components/invite-member.tsx` - Invite dialog
- `teams/[teamSlug]/_components/enable-competition-organizing.tsx` - Competition feature toggle

### Settings Actions Summary

| Action File | Purpose | Key Functions |
|------------|---------|---------------|
| `settings.actions.ts` | User profile updates | Update name, email, timezone |
| `passkey-settings.actions.ts` | Passkey management | Create, delete, rename passkeys |
| `sessions.actions.ts` | Session management | List sessions, revoke sessions |
| Global `team-actions.ts` | Team CRUD | Create team, update settings |
| Global `team-membership-actions.ts` | Team member management | Invite members, remove members, manage roles |
| Global `team-role-actions.ts` | Team role management | Update member roles |

---

## Admin Routes

Admin routes provide system-wide management capabilities for platform administrators and team owners.

### Route Inventory

**Note:** The codebase uses TWO routing patterns for admin:
1. `/admin/teams/[teamId]/...` - Explicit team selection via URL parameter
2. `/admin/teams/...` - Uses active team from session context (`getAdminTeamContext`)

Both patterns coexist and serve different use cases.

| Route | Next.js Path | TanStack Path | Status | Actions | Notes |
|-------|-------------|---------------|---------|---------|-------|
| **Admin Dashboard** | `/admin` | ❌ Not Started | ❌ Not Started | N/A | Admin landing page, stats, quick actions |
| **Entitlements List** | `/admin/entitlements` | ❌ Not Started | ❌ Not Started | `entitlement-admin-actions.ts` | Manage team plans, overrides |
| **Entitlements Config** | `/admin/entitlements/config` | ❌ Not Started | ❌ Not Started | `entitlement-admin-actions.ts` | Configure entitlement rules |
| **Organizer Requests** | `/admin/organizer-requests` | ❌ Not Started | ❌ Not Started | `organizer-admin-actions.ts` | Review competition organizer applications |
| **Gym Scheduler Landing** | `/admin/teams/schedule` | ❌ Not Started | ❌ Not Started | N/A | Gym Scheduler AI landing page with stats |
| **Generate Schedule** | `/admin/teams/schedule/generate` | ❌ Not Started | ❌ Not Started | `generate-schedule-actions.ts` (global) | AI-powered schedule generation |
| **Schedule Classes** | `/admin/teams/schedule/classes` | ❌ Not Started | ❌ Not Started | TBD | Class catalog for scheduler |
| **Active Team Scheduling** | `/admin/teams` | ❌ Not Started | ❌ Not Started | `scheduling-actions.ts` | Workout scheduling calendar for active team |
| **Team Scheduling (by ID)** | `/admin/teams/[teamId]` | ❌ Not Started | ❌ Not Started | `scheduling-actions.ts` | Workout scheduling calendar with explicit team |
| **Programming Dashboard** | `/admin/teams/[teamId]/programming` | `/settings/programming` | 🔄 Partial | `programming-actions.ts`, `programming-track-actions.ts` | Track management, public track subscription |
| **Programming Track Detail** | `/admin/teams/[teamId]/programming/[trackId]` | `/settings/programming/$trackId` | 🔄 Partial | `programming-track-actions.ts` | Workout management within track |
| **Scaling Groups** | `/admin/teams/[teamId]/scaling` | ❌ Not Started | ❌ Not Started | TBD | Manage scaling options |
| **Coaches** | `/admin/teams/[teamId]/coaches` | ❌ Not Started | ❌ Not Started | TBD | Coach management |
| **Gym Setup** | `/admin/teams/[teamId]/gym-setup` | ❌ Not Started | ❌ Not Started | TBD | Gym configuration |
| **Classes** | `/admin/teams/[teamId]/classes` | ❌ Not Started | ❌ Not Started | TBD | Class scheduling |
| **Schedule Templates** | `/admin/teams/[teamId]/schedule-templates` | ❌ Not Started | ❌ Not Started | `schedule-template-actions.ts` (global) | Recurring schedule templates list |
| **Schedule Template Detail** | `/admin/teams/[teamId]/schedule-templates/[scheduleTemplateId]` | ❌ Not Started | ❌ Not Started | `schedule-template-actions.ts` (global) | Edit individual schedule template |
| **Schedule Week** | `/admin/teams/[teamId]/schedule-week` | ❌ Not Started | ❌ Not Started | TBD | Weekly schedule management |
| **Active Team Programming** | `/admin/teams/programming` | ❌ Not Started | ❌ Not Started | `programming-actions.ts`, `programming-track-actions.ts` | Programming for active team |
| **Active Team Programming Track** | `/admin/teams/programming/[trackId]` | ❌ Not Started | ❌ Not Started | `programming-track-actions.ts` | Track detail for active team |
| **Active Team Scaling** | `/admin/teams/scaling` | ❌ Not Started | ❌ Not Started | TBD | Scaling for active team |
| **Active Team Coaches** | `/admin/teams/coaches` | ❌ Not Started | ❌ Not Started | TBD | Coaches for active team |
| **Active Team Gym Setup** | `/admin/teams/gym-setup` | ❌ Not Started | ❌ Not Started | TBD | Gym setup for active team |
| **Active Team Classes** | `/admin/teams/classes` | ❌ Not Started | ❌ Not Started | TBD | Classes for active team |
| **Active Team Schedule Templates** | `/admin/teams/schedule-templates` | ❌ Not Started | ❌ Not Started | `schedule-template-actions.ts` (global) | Schedule templates for active team |
| **Active Team Schedule Template Detail** | `/admin/teams/schedule-templates/[scheduleTemplateId]` | ❌ Not Started | ❌ Not Started | `schedule-template-actions.ts` (global) | Template detail for active team |
| **Active Team Schedule Week** | `/admin/teams/schedule-week` | ❌ Not Started | ❌ Not Started | TBD | Schedule week for active team |

### Admin Components

**Next.js Location:** `apps/wodsmith/src/app/(admin)/admin/`

#### Shared Admin Components
- `_components/admin-layout-wrapper.tsx` - Admin layout container
- `_components/admin-sidebar.tsx` - Admin navigation sidebar
- `_components/admin-stats.tsx` - Dashboard statistics
- `_components/users/` - User management components

#### Entitlements Components
- `entitlements/_components/entitlements-management-client.tsx` - Main entitlements UI
- `entitlements/_components/team-entitlements-detail.tsx` - Per-team entitlement view
- `entitlements/_components/change-plan-dialog.tsx` - Plan change UI
- `entitlements/_components/entitlement-overrides-dialog.tsx` - Override management

#### Organizer Requests Components
- `organizer-requests/_components/organizer-requests-table.tsx` - Request review table

#### Team Management Components (per team)
**Location:** `admin/teams/[teamId]/_components/`

**Scheduling:**
- `team-scheduling-calendar.tsx` - Main calendar component (FullCalendar integration)
- `team-scheduling-container.tsx` - Scheduling state container
- `calendar-skeleton.tsx` - Loading state
- `workout-selection-modal.tsx` - Modal for scheduling workouts
- `workout-selection/` - Modular workout selection components
  - `scheduled-workouts.tsx` - Display scheduled workouts
  - `scheduling-details.tsx` - Scheduling form (date, time, class)
  - `track-selection.tsx` - Select programming track
  - `workout-selection.tsx` - Select workout from track

**Programming:**
- `programming/_components/programming-track-dashboard.tsx` - Track list and management
- `programming/_components/programming-track-create-dialog.tsx` - Create track
- `programming/_components/programming-track-edit-dialog.tsx` - Edit track
- `programming/_components/programming-track-delete-dialog.tsx` - Delete track
- `programming/_components/programming-track-row.tsx` - Track list item
- `programming/[trackId]/_components/track-workout-management.tsx` - Workout CRUD within track
- `programming/[trackId]/_components/track-workout-list.tsx` - Drag-drop workout reordering
- `programming/[trackId]/_components/track-workout-row.tsx` - Workout list item
- `programming/[trackId]/_components/add-workout-to-track-dialog.tsx` - Add existing workout
- `programming/[trackId]/_components/create-workout-modal.tsx` - Create new workout

**Scaling:**
- `scaling/_components/scaling-groups-list.tsx` - List scaling groups
- `scaling/_components/scaling-group-dialog.tsx` - CRUD scaling groups

**Schedule Templates:**
- `schedule-templates/_components/ScheduleTemplates.tsx` - Template management

**Schedule Week:**
- `schedule-week/_components/MasterSchedule.tsx` - Week view
- `schedule-week/_components/Schedule.tsx` - Schedule component
- `schedule-week/_components/ScheduleGrid.tsx` - Grid layout
- `schedule-week/_components/ScheduleStats.tsx` - Stats display
- `schedule-week/_components/CreateScheduleDialog.tsx` - Create schedule
- `schedule-week/_components/SlotAssignmentDialog.tsx` - Assign coaches/classes

**Classes, Coaches, Gym Setup:**
- `classes/_components/Classes.tsx`
- `coaches/_components/Coaches.tsx`
- `gym-setup/_components/GymSetup.tsx`

### Admin Actions Summary

| Action File | Purpose | Key Functions |
|------------|---------|---------------|
| `entitlement-admin-actions.ts` | Entitlement management | Change plans, add overrides, view usage |
| `organizer-admin-actions.ts` | Organizer requests | Approve/deny requests, update status |
| `get-users.action.ts` | User management | List users, user stats |
| `scheduling-actions.ts` | Workout scheduling | Schedule workouts, update schedules, delete schedules |
| `programming-actions.ts` | Programming management | Manage tracks, assign scaling |
| `programming-track-actions.ts` | Track-level operations | Add/remove workouts, reorder, visibility |
| Global `generate-schedule-actions.ts` | AI schedule generation | Generate optimized schedules |
| Global `schedule-template-actions.ts` | Schedule templates | CRUD schedule templates |
| Global `schedule-display-actions.ts` | Schedule display | Display and format schedules |

---

## Migration Progress Summary

### Settings Routes
- **Total Routes:** 7
- **✅ Migrated:** 0
- **🔄 Partial:** 1 (settings root layout)
- **❌ Not Started:** 6

### Admin Routes (Explicit Team Selection)
- **Total Routes with [teamId]:** 15
  - **✅ Migrated:** 0
  - **🔄 Partial:** 2 (programming dashboard, programming track detail)
  - **❌ Not Started:** 13

### Admin Routes (Active Team Context)
- **Total Routes without [teamId]:** 13
  - **✅ Migrated:** 0
  - **🔄 Partial:** 0
  - **❌ Not Started:** 13

### Platform Admin Routes
- **Total Routes:** 4 (admin dashboard, entitlements, entitlements/config, organizer-requests)
  - **✅ Migrated:** 0
  - **❌ Not Started:** 4

### Overall Progress
- **Total Routes:** 39 (7 settings + 28 admin + 4 platform admin)
- **Completion:** ~5% (layouts only, no full routes)
- **Note:** Previous count of 19 routes was significantly incomplete

---

## TanStack Start Current State

**Location:** `apps/wodsmith-start/src/routes/_protected/settings/`

### ✅ Verified Migrated Features
1. **Settings Root Layout** (`/settings`)
   - Layout component exists (basic Outlet wrapper)
   - No actual settings routes beyond programming

2. **Programming Tracks** (`/settings/programming/`)
   - Track list view
   - Track creation
   - Basic track management
   - Loader: `getTeamProgrammingTracksFn`

3. **Programming Track Detail** (`/settings/programming/$trackId/`)
   - Individual track view
   - Workout management within track

### ❌ Confirmed Missing TanStack Infrastructure
- No `/admin` routes exist in TanStack Start (verified)
- No security/passkey routes (verified)
- No session management routes (verified)
- No team settings routes (verified)
- No entitlements admin routes (verified)
- No scheduling routes - the primary admin feature (verified)
- No profile settings route (verified)
- Only 3 total route files in TanStack Start settings directory

---

## Migration Priorities

### Phase 1: Core Settings (Must-Have for MVP)
1. **Settings Profile** (`/settings/[...segment]`) - User account management
2. **Settings Security** (`/settings/security`) - Passkey management (authentication)
3. **Settings Teams** (`/settings/teams/*`) - Team switching, member management, invitations

### Phase 2: Admin Foundation (Core Admin Features)
4. **Admin Dashboard** (`/admin`) - Landing page, stats
5. **Admin Team Scheduling** (`/admin/teams` or `/admin/teams/[teamId]`) - Primary admin feature, FullCalendar-based
6. **Admin Programming** - Complete migration of partially done routes
   - Dashboard already partial in TanStack
   - Track detail already partial in TanStack
   - Need to complete both routes

### Phase 3: Advanced Admin (Power Features)
7. **Admin Entitlements** (`/admin/entitlements`, `/admin/entitlements/config`) - Plan management
8. **Schedule Templates** (`/admin/teams/[teamId]/schedule-templates/*`) - Recurring schedules
9. **Schedule Week** (`/admin/teams/[teamId]/schedule-week`) - Weekly schedule management

### Phase 4: Gym Scheduler AI (Experimental Feature)
10. **Gym Scheduler Landing** (`/admin/teams/schedule`) - AI scheduler dashboard
11. **Generate Schedule** (`/admin/teams/schedule/generate`) - AI-powered generation
12. **Schedule Classes** (`/admin/teams/schedule/classes`) - Class catalog

### Phase 5: Team Configuration (Nice-to-Have)
13. **Settings Sessions** (`/settings/sessions`) - Session management
14. **Admin Scaling** (`/admin/teams/[teamId]/scaling`) - Scaling groups
15. **Admin Coaches** (`/admin/teams/[teamId]/coaches`) - Coach management
16. **Admin Classes** (`/admin/teams/[teamId]/classes`) - Class management
17. **Admin Gym Setup** (`/admin/teams/[teamId]/gym-setup`) - Gym configuration

### Phase 6: Competition Features (Optional)
18. **Admin Organizer Requests** (`/admin/organizer-requests`) - Competition organizer applications

### Strategic Decision Required
**Dual Routing Pattern:**
- Current Next.js app has both explicit team ID routes AND active team context routes
- Decision needed: Migrate both patterns or standardize on one?
- Recommendation: Standardize on active team context (simpler URLs, better UX)
- Only use explicit team ID when admin needs to manage multiple teams simultaneously

---

## Technical Notes

### Dual Routing Pattern Discovery

**CRITICAL FINDING:** The Next.js admin codebase uses TWO distinct routing patterns that coexist:

#### Pattern 1: Explicit Team Selection (`/admin/teams/[teamId]/...`)
- Team ID passed as URL parameter
- Used for: programming, scaling, coaches, gym-setup, classes, schedule-templates, schedule-week
- Example: `/admin/teams/team-123/programming`
- **15 routes** follow this pattern

#### Pattern 2: Active Team Context (`/admin/teams/...`)
- Uses session's active team via `getAdminTeamContext()` utility
- No `[teamId]` in URL
- Used for: same features as Pattern 1, PLUS the gym scheduler AI section
- Example: `/admin/teams/programming`
- **13 routes** follow this pattern

#### Gym Scheduler AI Section (`/admin/teams/schedule/...`)
- Completely separate feature area
- Only exists in Pattern 2 (active team)
- 3 routes: landing, generate, classes
- Uses different action files: `generate-schedule-actions.ts`, `schedule-display-actions.ts`

**Migration Decision Needed:** 
- Should TanStack Start maintain both patterns?
- Or standardize on one approach (likely active team context for simpler URLs)?
- The dual pattern adds complexity but may serve different use cases (multi-team admin vs single-team workflows)

### Key Dependencies

**Settings Routes:**
- WebAuthn API (passkeys)
- UA-Parser-JS (session device detection)
- Session management with Lucia Auth
- Team permission checks

**Admin Routes:**
- FullCalendar (scheduling calendar)
- @atlaskit/pragmatic-drag-and-drop (workout reordering)
- Complex permission checks (team admin, platform admin)
- Entitlements system integration

### Action File Migration Strategy

1. **Settings Actions** → Convert to TanStack server functions
   - `settings.actions.ts` → `server-fns/settings-fns.ts`
   - `passkey-settings.actions.ts` → `server-fns/passkey-fns.ts`
   - `sessions.actions.ts` → `server-fns/sessions-fns.ts`

2. **Admin Actions** → Convert to TanStack server functions
   - `entitlement-admin-actions.ts` → `server-fns/entitlements-admin-fns.ts`
   - `organizer-admin-actions.ts` → `server-fns/organizer-admin-fns.ts`
   - `scheduling-actions.ts` → `server-fns/scheduling-fns.ts`
   - `programming-actions.ts` → Extend existing `programming-fns.ts`

### Layout Migration

**Next.js Layouts:**
- `(settings)/settings/layout.tsx` - Settings sidebar layout
- `(admin)/admin/layout.tsx` - Admin layout wrapper
- `(admin)/admin/teams/[teamId]/layout.tsx` - Team-specific sidebar

**TanStack Equivalent:**
- Use `_protected` layout pattern
- Create `_settings` layout for settings sidebar
- Create `_admin` layout for admin sidebar
- Nested layouts for team-specific routes

---

## Related Files

### Server Functions (TanStack)
- `apps/wodsmith-start/src/server-fns/programming-fns.ts` - Programming track operations

### Global Actions (Next.js)
- `apps/wodsmith/src/actions/team-actions.ts` - Team CRUD (shared across settings)
- `apps/wodsmith/src/actions/team-membership-actions.ts` - Team member management
- `apps/wodsmith/src/actions/team-role-actions.ts` - Team role management
- `apps/wodsmith/src/actions/generate-schedule-actions.ts` - AI schedule generation
- `apps/wodsmith/src/actions/schedule-template-actions.ts` - Schedule template CRUD
- `apps/wodsmith/src/actions/schedule-display-actions.ts` - Schedule display formatting
- `apps/wodsmith/src/server/organizer-onboarding.ts` - Organizer request server logic
- `apps/wodsmith/src/server/programming-tracks.ts` - Programming server logic
- `apps/wodsmith/src/server/programming-multi-team.ts` - Public track subscriptions

### Utilities
- `apps/wodsmith/src/utils/auth.ts` - Authentication helpers
- `apps/wodsmith/src/utils/team-auth.ts` - Team permission checks
- `apps/wodsmith/src/utils/kv-session.ts` - Session storage

---

## Audit Findings Summary

### Route Count Correction
- **Previous estimate:** 19 routes total
- **Actual count:** 39 routes total (2x underestimate)
- **Breakdown:**
  - 7 settings routes (unchanged)
  - 15 admin routes with explicit team ID
  - 13 admin routes with active team context
  - 4 platform admin routes (entitlements, organizer requests)

### Newly Discovered Routes
1. `/admin/teams/schedule` - Gym Scheduler AI landing page
2. `/admin/teams/schedule/generate` - AI schedule generation
3. `/admin/teams/schedule/classes` - Class catalog for scheduler
4. `/admin/teams/[teamId]/schedule-templates/[scheduleTemplateId]` - Template detail view
5. All 13 "active team context" variants of the explicit team ID routes

### Missing Action Files (Now Cataloged)
- `generate-schedule-actions.ts` - AI schedule generation
- `schedule-display-actions.ts` - Schedule formatting
- `schedule-template-actions.ts` - Template CRUD
- `team-membership-actions.ts` - Member management
- `team-role-actions.ts` - Role management
- `get-users.action.ts` - User listing

### Architectural Discovery
The dual routing pattern (explicit team ID vs active team) was not documented. This significantly impacts migration complexity and requires a strategic decision on whether to maintain both patterns in TanStack Start.

### Completion Percentage Correction
- **Previous:** ~10% complete (based on 19 routes)
- **Actual:** ~5% complete (based on 39 routes)
- Only 3 routes have ANY migration work:
  - Settings root layout (partial - just Outlet wrapper)
  - Programming dashboard (partial)
  - Programming track detail (partial)

## Next Steps

1. **Create TanStack Layouts**
   - `_protected/_settings/` layout with sidebar
   - `_protected/_admin/` layout with admin sidebar
   - Team-specific nested layouts

2. **Migrate Settings Routes** (in order)
   - Profile page + server functions
   - Security/passkey page + server functions
   - Teams pages + server functions
   - Sessions page + server functions

3. **Migrate Admin Routes** (in order)
   - Admin dashboard
   - Team scheduling (complex, calendar-based)
   - Entitlements management
   - Organizer requests

4. **Update Navigation**
   - Migrate settings sidebar navigation
   - Migrate admin sidebar navigation
   - Update breadcrumbs for TanStack routing

5. **Testing Strategy**
   - E2E tests for settings flows
   - E2E tests for admin workflows
   - Integration tests for server functions
   - Visual regression tests for complex UIs (calendar, drag-drop)
