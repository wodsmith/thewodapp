# Phase 2: Competition Platform Implementation Plan

## Overview

**Scope:** Event & Series Creation (Admin) + Registration System (Public)
**Timeline:** 4-5 weeks (25-30 development days)
**Status:** In Progress (2/11 milestones complete)

## Implementation Philosophy

1. **Build in Testable Increments** - Each milestone is independently deployable
2. **Maximize Pattern Reuse** - Copy existing admin patterns (programming tracks, scaling groups)
3. **Database-First Validation** - Server functions with robust error handling before UI
4. **Quality Over Speed** - Complete, polished features rather than quick prototypes

## User Preferences

✅ **Priority:** Complete - All features from the start (polished, production-ready)
✅ **Workouts:** Defer to Phase 3 (no competition linking now)
✅ **Registration:** Simple - Just register (no status/payment/waiver complexity)
✅ **Forms:** Full page forms (not dialogs)

## Milestones

### ✅ Milestone 1: Competition Groups Backend (Days 1-2)
**Status:** Complete
**Goal:** Implement server functions for creating and managing competition groups/series

**Deliverables:**
- Zod validation schemas (`src/schemas/competitions.ts`)
- Server functions (`src/server/competitions.ts`):
  - `createCompetitionGroup()` - With entitlement and slug validation
  - `getCompetitionGroups()` - With competition counts
  - `getCompetitionGroup()` - Single group lookup
  - `updateCompetitionGroup()` - With conflict checking
  - `deleteCompetitionGroup()` - With safety checks

### ✅ Milestone 2: Competition Groups Admin UI (Days 3-4)
**Status:** Complete
**Goal:** Build admin interface for creating and managing series

**Deliverables:**
- Server actions (`src/actions/competition-actions.ts`)
- Series list page with card grid layout
- Series creation page with full page form
- Client components:
  - `CompetitionGroupsList` - Grid with delete confirmation
  - `CompetitionGroupForm` - Form with auto-slug generation

**Routes:**
- `/admin/teams/[teamId]/competitions/series` - List all series
- `/admin/teams/[teamId]/competitions/series/new` - Create new series

### 🔄 Milestone 3: Competition Creation Backend (Days 5-7)
**Status:** Pending
**Goal:** Implement server functions for competition CRUD

**Tasks:**
- Implement `createCompetition()` with:
  - HOST_COMPETITIONS entitlement check
  - Global slug uniqueness validation
  - Auto-create competition_event team
  - Add creator as team owner
- Implement `getCompetitions()`, `getCompetition()`, `updateCompetition()`, `deleteCompetition()`

### ⏳ Milestone 4: Competition Admin UI (Days 8-11)
**Status:** Pending
**Goal:** Build complete admin UI for competition management

**Routes:**
- `/admin/teams/[teamId]/competitions/page.tsx` - List all competitions
- `/admin/teams/[teamId]/competitions/new/page.tsx` - Create competition (full page)
- `/admin/teams/[teamId]/competitions/[competitionId]/page.tsx` - Competition detail
- `/admin/teams/[teamId]/competitions/[competitionId]/edit/page.tsx` - Edit competition

### ⏳ Milestone 5: Division Management (Days 12-14)
**Status:** Pending
**Goal:** Link competitions to scaling groups for divisions

**Approach:**
- Reuse existing scaling groups (no new tables)
- Store scalingGroupId in competition.settings JSON
- Division selection during registration

### ⏳ Milestone 6: Registration Backend (Days 15-17)
**Status:** Pending
**Goal:** Implement athlete registration system

**Key Functions:**
- `registerForCompetition()` - Creates team_membership in competition_event team
- `getUserCompetitionRegistration()` - Check if already registered
- `getCompetitionRegistrations()` - List all athletes
- `cancelCompetitionRegistration()` - Cancel registration

### ⏳ Milestone 7: Public Registration UI (Days 18-20)
**Status:** Pending
**Goal:** Build public-facing competition pages and registration flow

**Routes:**
- `/compete` - Browse all competitions
- `/compete/[slug]` - Competition detail
- `/compete/[slug]/register` - Registration form (full page)

### ⏳ Milestone 8: Athlete Dashboard (Days 21-22)
**Status:** Pending
**Goal:** Post-registration athlete view

**Routes:**
- `/compete/my-events` - List of registered competitions
- `/compete/profile` - Athlete profile management

### ⏳ Milestone 9: Admin Athlete Management (Days 23-24)
**Status:** Pending
**Goal:** Admin tools for managing athlete registrations

**Routes:**
- `/admin/teams/[teamId]/competitions/[competitionId]/athletes` - Athletes list
- `/admin/teams/[teamId]/competitions/[competitionId]/athletes/new` - Manual registration

### ⏳ Milestone 10: Navigation & Routes (Days 25-26)
**Status:** Pending
**Goal:** Complete navigation structure

**Tasks:**
- Add "Competitions" to admin sidebar
- Add "Compete" to main navigation
- Create competition admin layout with tabs
- Create public competition layout

### ⏳ Milestone 11: Testing & Documentation (Days 27-30)
**Status:** Pending
**Goal:** Comprehensive testing and documentation

**Tasks:**
- End-to-end testing (admin and athlete flows)
- Error handling validation
- Performance testing
- Seed script for demo data
- Update documentation

## Key Architecture Decisions

### Team Structure
- **Organizing Team** (type='gym', canHostCompetitions=true) - The gym hosting competitions
- **Competition Event Team** (type='competition_event') - Auto-created per competition for athlete management

### Data Model
- Competition Groups (series) organize multiple competitions
- Competitions have globally unique slugs for public URLs
- Divisions reuse existing scaling groups system
- Registration creates team_membership in competition_event team

### Routes Structure
**Admin routes:** `/admin/teams/[teamId]/competitions/...`
**Public routes:** `/compete/[slug]/...`

## Success Criteria

### Functional Requirements
- [x] Admin can create competition series/groups
- [x] Admin can list and delete series
- [ ] Admin can create competitions with dates and settings
- [ ] Admin can assign divisions to competitions
- [ ] Athletes can browse public competitions
- [ ] Athletes can register for competitions
- [ ] Athletes can view their registered competitions
- [ ] Registration window enforced
- [ ] Duplicate registrations prevented
- [ ] Team membership auto-created

### Technical Requirements
- [x] Type-safe schemas with Zod validation
- [x] Server functions with entitlement checks
- [x] Server actions with proper permission checks
- [x] Full page forms with React Hook Form
- [x] Path revalidation after mutations
- [x] Mobile-responsive UI
- [x] Loading states and toast notifications

## Files Created

### Backend (Phase 2 so far)
- `src/schemas/competitions.ts` - Zod validation schemas
- `src/actions/competition-actions.ts` - Server actions
- `src/server/competitions.ts` - Competition group functions implemented

### Admin UI (Phase 2 so far)
- `src/app/(admin)/admin/teams/[teamId]/competitions/series/page.tsx` - List page
- `src/app/(admin)/admin/teams/[teamId]/competitions/series/new/page.tsx` - Create page
- `src/app/(admin)/admin/teams/[teamId]/competitions/series/_components/competition-groups-list.tsx` - List component
- `src/app/(admin)/admin/teams/[teamId]/competitions/series/_components/competition-group-form.tsx` - Form component

## Next Steps

1. **Milestone 3:** Implement competition creation backend with team auto-creation
2. **Milestone 4:** Build competition admin UI with full CRUD operations
3. Continue through remaining milestones sequentially

## Notes

- Phase 1 completed all database migrations - no schema changes needed for Phase 2
- All competition operations require HOST_COMPETITIONS feature
- Pattern reuse from programming tracks and team management proven successful
- Full page forms preferred over dialogs for better mobile experience
