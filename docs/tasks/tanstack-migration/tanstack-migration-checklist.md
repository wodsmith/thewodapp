# TanStack Start Migration Checklist

**Epic:** wodsmith-monorepo--tuyyc-mjj5sm20ou2  
**Last Updated:** December 23, 2025 (Post-Audit)  
**Migration Status:** 15% Complete (Routes exist, feature parity incomplete)  
**Audit Status:** ✅ 5/5 Audits Complete (Auth, Main, Programming/Teams, Settings/Admin, Compete)

---

## 📋 Executive Summary

This master checklist consolidates analysis from 5 detailed migration documents to provide a comprehensive overview of the WODsmith migration from Next.js to TanStack Start.

### Overall Progress

| Category | Total Routes | ✅ Migrated | 🔄 Partial | ❌ Not Started | % Complete |
|----------|--------------|-------------|-----------|----------------|------------|
| **Authentication** | 8 | 2 | 0 | 6 | 25% |
| **Main App** (workouts, logs, movements) | 20 | 10 | 0 | 10 | 50% |
| **Programming & Teams** | 7 | 2 | 1 | 4 | 29% |
| **Settings & Admin** | 39 | 0 | 2 | 37 | 5% |
| **Competition Platform** | 39 | 0 | 0 | 39 | 0% |
| **TOTAL** | **113** | **14** | **3** | **96** | **15%** |

### Action/Function Coverage

| Category | Next.js Actions | TanStack Functions | Missing |
|----------|----------------|-------------------|---------|
| **Authentication** | 10 | 2 | 8 (80%) |
| **Workouts** | 21 | 8 | 13 (62%) |
| **Logs** | 5 | 7 | 0 (0% - TanStack has MORE) |
| **Movements** | 4 | 0 | 4 (100%) |
| **Programming** | 13 | 9 | 4 subscriptions (31%) |
| **Teams** | 16 | 2 | 14 (88%) |
| **Settings** | 4 files | 0 | 4 (100%) |
| **Admin** | 5 files | 0 | 5 (100%) |
| **Compete** | 11 files | 0 | 11 (100%) |

### Critical Gaps

**MUST HAVE (Blocking):**
- ❌ Email verification flow
- ❌ Password reset flow
- ❌ Google SSO
- ❌ Log editing
- ❌ Movements section (100% missing)
- ❌ Add workout to track
- ❌ Advanced workout filters & pagination
- ❌ Programming subscriptions
- ❌ Team settings and member management
- ❌ Competition platform (entire subsystem)

**SHOULD HAVE (Important):**
- ❌ Workout remix tracking
- ❌ Multi-round sets display
- ❌ Leaderboards
- ❌ Calculator utilities
- ❌ Admin scheduling dashboard

---

## 📊 Step 0: Test Coverage Summary

**Purpose:** Ensure migration preserves behavior through comprehensive test coverage. Tests are the safety net for refactoring.

### Testing Philosophy (Testing Trophy)

```
       /\
      /  \  E2E (5-10 critical paths)
     /----\  Registration, auth, scheduling
    / INT  \ Integration (SWEET SPOT)
   /--------\ Actions, workflows, multi-component
  |  UNIT  | Unit (fast, focused)
  |________| Scoring, permissions, validators
   STATIC   TypeScript + Biome
```

**Priority:** Integration tests > E2E tests > Unit tests. Integration tests catch the most bugs for the least effort.

---

### Test Coverage by Category

| Category | E2E Tests | Integration Tests | Unit Tests | Coverage % | Status | Priority |
|----------|-----------|-------------------|------------|------------|--------|----------|
| **Auth** | 8 | 0 | 0 | 40% | 🟡 E2E only | P0 - Add integration |
| **Main App (Workouts)** | 0 | 5 | ~200 (scoring) | 30% | 🟡 Partial | P0 - Add E2E, integration |
| **Main App (Logs)** | 0 | 0 | 0 | 0% | 🔴 None | P0 - Critical gap |
| **Main App (Movements)** | 0 | 0 | 0 | 0% | 🔴 None | P1 - Add all |
| **Programming/Teams** | 0 | 3 | 14 | 50% | 🟡 Partial | P1 - Add E2E |
| **Settings** | 0 | 0 | 0 | 0% | 🔴 None | P1 - Add integration |
| **Admin** | 0 | 2 | 0 | 10% | 🔴 Minimal | P1 - Add integration |
| **Compete** | 0 | 0 | ~200 (server) | 60% | 🟢 Server only | P0 - Add E2E, integration |

**Overall:** ~400 existing tests, ~100 missing tests needed for safe migration.

---

### Detailed Test Requirements

#### 🔐 Authentication (8 E2E, 0 Integration, 0 Unit)

**Existing:**
- ✅ `e2e/auth.spec.ts` - 8 tests (sign-in, logout, session persistence)

**Missing (CRITICAL):**
- ❌ `test/actions/sign-in-actions.test.ts` - Integration tests for `signInAction`
- ❌ `test/actions/sign-up-actions.test.ts` - Integration tests for `signUpAction`
- ❌ `test/actions/forgot-password-actions.test.ts` - Password reset flow
- ❌ `test/actions/reset-password-actions.test.ts` - Token validation
- ❌ `test/utils/password-hasher.test.ts` - Unit tests for hashing
- ❌ `e2e/sign-up.spec.ts` - E2E for user registration

**Priority:** P0 - Auth is the foundation. Integration tests needed before migrating P1 routes.

**See:** [tanstack-migration-auth.md](./tanstack-migration-auth.md#step-0-test-requirements)

---

#### 🏋️ Main App - Workouts (0 E2E, 5 Integration, ~200 Unit)

**Existing:**
- ✅ `test/actions/workout-actions.test.ts` - 8 tests (create, update, remix)
- ✅ `test/server/workouts.test.ts` - 3 test suites
- ✅ `test/lib/scoring/` - ~200 tests (validate, parse, format, encode, decode, aggregate, sort)

**Missing (HIGH PRIORITY):**
- ❌ `test/actions/scheduling-actions.test.ts` - `scheduleStandaloneWorkoutAction`, `addWorkoutToTrackAction`
- ❌ `test/actions/workout-actions.test.ts` (extend) - Remix, leaderboards, multi-round sets
- ❌ `e2e/workout.spec.ts` (extend) - Scheduling, filtering, pagination

**Priority:** P0 - Core user workflow. Need scheduling tests before migrating schedule routes.

**See:** [tanstack-migration-main-workouts.md](./tanstack-migration-main-workouts.md#step-0-test-coverage-analysis)

---

#### 📝 Main App - Logs (0 E2E, 0 Integration, 0 Unit)

**Existing:** None

**Missing (CRITICAL GAP):**
- ❌ `test/actions/log-actions.test.ts` - `submitLogFormAction`, `getLogsByUserAction`, `updateResultAction`
- ❌ `test/integration/log-workflow.test.ts` - Full log creation → edit flow
- ❌ `e2e/log.spec.ts` - Log workout result E2E

**Priority:** P0 - Users cannot fix mistakes without edit functionality. Blocking migration.

**See:** [tanstack-migration-main-workouts.md](./tanstack-migration-main-workouts.md#2-log-routes)

---

#### 🏃 Main App - Movements (0 E2E, 0 Integration, 0 Unit)

**Existing:** None

**Missing:**
- ❌ `test/actions/movement-actions.test.ts` - All 4 actions (CRUD)
- ❌ `e2e/movements.spec.ts` - Movement management E2E

**Priority:** P1 - Entire section missing. Add tests before implementing.

**See:** [tanstack-migration-main-workouts.md](./tanstack-migration-main-workouts.md#5-movement-routes)

---

#### 📅 Programming & Teams (0 E2E, 3 Integration, 14 Unit)

**Existing:**
- ✅ `test/actions/programming-actions.test.ts` - Subscribe/unsubscribe
- ✅ `test/integration/programming-subscription.test.ts` - Full subscription flow
- ✅ `test/server/programming.test.ts` - Server functions
- ✅ `test/utils/workout-permissions.test.ts` - 14 tests (permission checks)

**Missing:**
- ❌ `test/integration/programming-browse.test.ts` - Multi-team subscription UI
- ❌ `test/integration/multi-team-subscriptions.test.ts` - Cross-team visibility
- ❌ `test/utils/team-auth.test.ts` - `requireTeamPermission`, `hasTeamPermission`
- ❌ `test/integration/team-settings.test.ts` - Team CRUD, member management
- ❌ `e2e/team-management.spec.ts` - Invite → accept → manage flow

**Priority:** P1 - Multi-tenancy is core. Need team-auth tests before migrating team settings.

**See:** [tanstack-migration-programming-teams.md](./tanstack-migration-programming-teams.md#step-0-test-coverage-baseline)

---

#### ⚙️ Settings & Admin (0 E2E, 2 Integration, 0 Unit)

**Existing:**
- ✅ `test/actions/organizer-admin-actions.test.ts` - Organizer requests
- ✅ `test/server/organizer-onboarding.test.ts` - Server logic

**Missing (CRITICAL):**
- ❌ `test/actions/settings-actions.test.ts` - Profile update
- ❌ `test/actions/passkey-settings-actions.test.ts` - WebAuthn CRUD
- ❌ `test/actions/sessions-actions.test.ts` - Session management
- ❌ `test/actions/team-membership-actions.test.ts` - Member management
- ❌ `test/actions/entitlement-admin-actions.test.ts` - Plan changes
- ❌ `test/integration/scheduling-workflow.test.ts` - FullCalendar scheduling
- ❌ `e2e/settings.spec.ts` - Profile, security, sessions
- ❌ `e2e/scheduling.spec.ts` - FullCalendar drag-and-drop
- ❌ `e2e/passkey.spec.ts` - WebAuthn ceremony

**Priority:** P1 - Settings are essential. Scheduling is primary admin feature.

**See:** [tanstack-migration-settings-admin.md](./tanstack-migration-settings-admin.md#step-0-test-coverage-audit)

---

#### 🏆 Competition Platform (0 E2E, 0 Integration, ~200 Unit)

**Existing:**
- ✅ `test/server/competition-leaderboard.test.ts` - 98 tests (ranking, points, ties)
- ✅ `test/server/sponsors.test.ts` - 47 tests (sponsor CRUD)
- ✅ `test/server/volunteers.test.ts` - 61 tests (volunteer management)
- ✅ `test/lib/judge-rotation-utils.test.ts` - 35 tests (rotation patterns)
- ✅ `test/server/judge-scheduling.test.ts` - 9 tests (judge requirements)
- ✅ `test/server/stripe-connect.test.ts` - 27 tests (OAuth, account sync)
- ✅ `test/lib/scoring/` - ~150 tests (scoring library)

**Missing (CRITICAL):**
- ❌ `e2e/compete/registration.spec.ts` - Registration → payment → success
- ❌ `e2e/compete/organizer-onboard.spec.ts` - Stripe Connect OAuth
- ❌ `e2e/compete/competition-create.spec.ts` - Competition CRUD
- ❌ `test/integration/compete/heat-scheduling.test.ts` - Heat CRUD, drag-and-drop
- ❌ `test/integration/compete/score-entry.test.ts` - Score submission
- ❌ `test/actions/competition-actions.test.ts` - All 11 action files

**Priority:** P0 - Revenue-critical paths (registration, onboarding). Server tests excellent, need E2E + integration.

**See:** [tanstack-migration-compete.md](./tanstack-migration-compete.md#step-0-test-coverage-requirements)

---

### Test Creation Priority Order

**Week 1 (P0 - Blockers):**
1. `test/actions/log-actions.test.ts` - Log CRUD (users can't fix mistakes)
2. `test/actions/scheduling-actions.test.ts` - Workout scheduling
3. `e2e/compete/registration.spec.ts` - Revenue path

**Week 2 (P0 - Auth):**
4. `test/actions/sign-in-actions.test.ts` - Sign-in integration
5. `test/actions/sign-up-actions.test.ts` - Sign-up integration
6. `test/actions/forgot-password-actions.test.ts` - Password reset

**Week 3 (P1 - Core Features):**
7. `test/actions/movement-actions.test.ts` - Movement CRUD
8. `test/utils/team-auth.test.ts` - Permission helpers
9. `test/integration/team-settings.test.ts` - Team management

**Week 4 (P1 - Admin):**
10. `test/integration/scheduling-workflow.test.ts` - FullCalendar scheduling
11. `test/actions/entitlement-admin-actions.test.ts` - Plan management
12. `e2e/scheduling.spec.ts` - Scheduling E2E

---

### Migration Acceptance Criteria

**Before migrating any route:**
- [ ] Existing tests for related server functions pass
- [ ] Integration tests exist for all server actions used by route
- [ ] Unit tests exist for pure functions (validators, formatters)

**After migrating route:**
- [ ] All existing tests still pass
- [ ] New TanStack Start route renders correctly
- [ ] Data fetching works with loaders
- [ ] Forms submit correctly
- [ ] E2E test passes for critical paths (if applicable)

**Migration-Blocking Tests (Must Create First):**
1. Log actions - Before migrating `/log/$id/edit`
2. Scheduling actions - Before migrating `/workouts/$workoutId/schedule`
3. Team-auth utils - Before migrating `/settings/teams`
4. Compete registration E2E - Before migrating `/compete/[slug]/register`

---

### Testing Infrastructure

**Existing:**
- Vitest + jsdom for unit/integration
- Playwright for E2E
- FakeDatabase for D1 mocking (respects 100 param limit)
- Factory functions in `@repo/test-utils`

**Required New Factories:**
- `createCompetition` - Full competition with relations
- `createDivision` - Division with event associations
- `createHeat` - Heat with athlete assignments
- `createScore` - Score with all scheme variations

**Test Data Seeds:**
- Competition with 3 divisions, 5 events
- 50 athletes across divisions
- Heat schedule with judge rotations

---

## 🔍 Audit Findings (December 23, 2025)

Five comprehensive audits were completed to verify the accuracy of this checklist against the actual Next.js and TanStack codebases. The following corrections were made:

### Authentication Audit

**Route Count Correction:** 7 → 8 routes
- **Root Cause:** Google OAuth has 2 separate route files (`/google/route.ts` and `/google/callback/route.ts`)
- **Discovery:** Found `canSignUp` IS implemented in TanStack (was incorrectly marked as missing)
- **Completion:** 25% (2/8 routes), down from 29% due to corrected denominator

**Key Findings:**
- Sign in/sign up are fully migrated and working
- Google OAuth is 0% migrated (both routes missing)
- Email verification, password reset, and team invites are all 0%

---

### Main App Audit (Workouts, Logs, Movements)

**Major Function Count Corrections:**
- **Workouts:** TanStack has 8 functions (was documented as ~4)
- **Logs:** TanStack has 7 functions (MORE than Next.js's 5)
- **Total Route Migration:** 50% (10/20) - significant progress not captured in previous version

**Discovered Functions:**
- `getScheduledWorkoutsWithResultsFn` (exists in TanStack)
- `getWorkoutScoresFn` (exists in TanStack)
- Additional log-related functions bringing TanStack ahead of Next.js in this area

**Critical Gaps Confirmed:**
- Log edit: 0% (route exists, no functions)
- Add workout to track: 0%
- Movements: 0% (all 3 routes missing)
- Calculator: 0% (both routes missing)

**Route Breakdown:**
- Workouts: 6/6 routes exist (100%), but missing filters, pagination, remix tracking
- Logs: 2/3 routes (67%) - missing edit route
- Movements: 0/3 routes (0%)
- Calculator: 0/2 routes (0%)

---

### Programming & Teams Audit

**Function Behavior Correction:**
- `getTeamProgrammingTracksFn` gets ALL team-subscribed tracks (not just owned tracks)
- This means TanStack HAS subscription read capability, just missing write actions

**Undocumented Components Found:**
- 4 additional components not in original count (form components, track cards, etc.)

**Completion Status:**
- Programming owner view: 100% (track list, detail, CRUD)
- Programming public view: 0% (browse, subscribe routes missing)
- Subscription management: 50% (read exists, write missing)

**Missing Actions:**
- `subscribeToTrackFn`
- `unsubscribeFromTrackFn`
- `getPublicTracksWithSubscriptionsFn`
- `getTrackSubscribedTeamsFn`

---

### Settings & Admin Audit

**MAJOR Route Count Correction:** 19 → 39 routes (2x underestimation)

**Root Causes:**
1. **Dual Routing Pattern:** Admin has both explicit `teamId` routes AND active team routes
   - Example: `/admin/teams/$teamId/programming` AND `/admin/programming`
   - Original count missed the parallel structures
2. **Undocumented Features:** Gym Scheduler AI (entire feature not documented)
3. **Granular Settings Routes:** Settings has more sub-routes than initially counted

**Completion Impact:** ~5% (was 5%, stays 5% but denominator doubled)

**Critical Findings:**
- Settings: 6 routes total (profile, security, sessions, teams CRUD)
- Admin: 33 routes (not 19) - massive expansion
- All admin routes are 0% migrated except 2 programming routes (partial)

**Newly Documented Routes:**
- Gym Scheduler AI routes (undiscovered feature)
- Schedule week view variations
- Additional team management routes

---

### Competition Platform Audit

**Path Prefix Correction:** `(main)/compete/` → `(compete)/compete/`
- Original docs had wrong route group

**Component Count Correction:** 102+ → 115+ components
- Found 13 additional components during deep audit

**Action File Count Correction:** 12 → 11 files
- Removed non-existent `waivers.actions.ts` (waivers managed in settings, not separate actions)
- Added undocumented `series/$groupId/edit` route

**Key Findings:**
- ALL 39 routes are 0% migrated (no change in completion)
- ALL 11 action files are 0% migrated
- Competition platform is the largest single subsystem (34% of total routes)

**Route Breakdown:**
- Public routes: 15 (competition detail, registration, athlete portal, volunteers)
- Organizer routes: 24 (dashboard, athletes, divisions, events, scheduling, results, revenue)

---

### Summary of Corrections

| Metric | Original | Corrected | Change |
|--------|----------|-----------|--------|
| **Total Routes** | 89 | 113 | +24 routes (+27%) |
| **Auth Routes** | 7 | 8 | +1 |
| **Main App Routes** | 17 | 20 | +3 |
| **Settings/Admin Routes** | 19 | 39 | +20 |
| **Compete Routes** | 39 | 39 | No change |
| **Compete Action Files** | 12 | 11 | -1 |
| **Compete Components** | 102+ | 115+ | +13 |
| **Workout Functions (TS)** | ~4 | 8 | +4 |
| **Log Functions (TS)** | 1 | 7 | +6 |

**Overall Completion:** Stays at ~15% due to denominator increase offsetting discovered completions

---

## 🎯 Priority Matrix

### P0 - CRITICAL (Blocks Core User Flows)

#### Authentication (2/8 complete - CORRECTED)
- [x] ✅ Sign In (email/password)
- [x] ✅ Sign Up (email/password) - **AUDIT FOUND: canSignUp IS implemented**
- [ ] ❌ Forgot Password
- [ ] ❌ Reset Password
- [ ] ❌ Email Verification
- [ ] ❌ Google SSO Initiation (`/google/route.ts`)
- [ ] ❌ Google SSO Callback (`/google/callback/route.ts`)
- [ ] ❌ Team Invite Acceptance

#### Core Workouts (6/6 routes exist, features incomplete - CORRECTED)
- [x] ✅ Workouts List (route exists, missing: filters, pagination)
- [x] ✅ Workout Detail (route exists, missing: remix, sets, leaderboards)
- [x] ✅ Create Workout (route exists)
- [x] ✅ Edit Workout (route exists)
- [x] ✅ Schedule Workout (route exists)
- [x] ✅ Add Workout to Track (route exists)
**Note:** All 6 workout routes migrated, but missing advanced features

#### Logging (2/3 routes - CORRECTED: TanStack has 7 functions vs Next.js 5)
- [x] ✅ Log List (route exists)
- [x] ✅ Log New (route exists)
- [ ] ❌ Log Edit (route missing, but TanStack has MORE log functions than Next.js)

#### Compete - Core Flow (0/10 complete)
- [ ] ❌ Competition Discovery
- [ ] ❌ Competition Detail
- [ ] ❌ Leaderboard Display
- [ ] ❌ Registration Flow
- [ ] ❌ Organizer Dashboard
- [ ] ❌ Athletes Management
- [ ] ❌ Divisions Configuration
- [ ] ❌ Events Management
- [ ] ❌ Heat Scheduling
- [ ] ❌ Results Entry

**P0 Estimated Effort:** 8-10 weeks

---

### P1 - HIGH (Essential Features)

#### Movements (0/3 complete)
- [ ] ❌ Movements List
- [ ] ❌ Movement Detail
- [ ] ❌ Create Movement

#### Workout Features (0/5 complete)
- [ ] ❌ Advanced filters (tags, movements, types, tracks)
- [ ] ❌ Pagination
- [ ] ❌ Remix tracking
- [ ] ❌ Multi-round sets
- [ ] ❌ Leaderboards

#### Programming (1/4 complete)
- [x] ✅ My Tracks (owner view)
- [ ] ❌ Public Track Browse
- [ ] ❌ Track Detail (subscriber view)
- [ ] ❌ Subscriptions Management

#### Settings (0/4 complete)
- [ ] ❌ Profile Editing
- [ ] ❌ Security/Passkeys
- [ ] ❌ Team Settings
- [ ] ❌ Session Management

#### Compete - Enhanced (0/7 complete)
- [ ] ❌ Workouts Tab
- [ ] ❌ Schedule Tab
- [ ] ❌ Athlete Portal
- [ ] ❌ Volunteer Management
- [ ] ❌ My Schedule
- [ ] ❌ Revenue Tracking
- [ ] ❌ Competition Settings

**P1 Estimated Effort:** 6-8 weeks

---

### P2 - MEDIUM (Nice to Have)

#### Utilities (0/2 complete)
- [ ] ❌ Barbell Calculator
- [ ] ❌ Spreadsheet Calculator

#### Admin (0/12 complete)
- [ ] ❌ Admin Dashboard
- [ ] ❌ Team Scheduling (calendar)
- [ ] ❌ Entitlements Management
- [ ] ❌ Organizer Requests
- [ ] ❌ Scaling Groups
- [ ] ❌ Coaches Management
- [ ] ❌ Classes Management
- [ ] ❌ Gym Setup
- [ ] ❌ Schedule Templates
- [ ] ❌ Schedule Week View
- [ ] ❌ Programming Dashboard (complete migration)
- [ ] ❌ Programming Track Detail (complete migration)

#### Compete - Extended (0/5 complete)
- [ ] ❌ Series Management
- [ ] ❌ Athlete Sponsors
- [ ] ❌ Invoices & PDF
- [ ] ❌ Competition Sponsors
- [ ] ❌ Payout Settings

**P2 Estimated Effort:** 4-6 weeks

---

### P3 - LOW (Future)

#### Auth Features (0/2 complete)
- [ ] ❌ Passkey Registration (WebAuthn)
- [ ] ❌ SSO Buttons Component

#### Compete (0/1 complete)
- [ ] ❌ Danger Zone (deletion)

**P3 Estimated Effort:** 1-2 weeks

---

## 📊 Recommended Migration Order

### Phase 1: Foundation (2-3 weeks)
**Goal:** Complete auth flows + core workout CRUD

1. **Week 1:** Auth completion
   - [ ] Forgot/reset password
   - [ ] Email verification
   - [ ] Session management utilities
   - [ ] Rate limiting implementation
   - [ ] KV store integration

2. **Week 2:** Core features
   - [ ] Log editing
   - [ ] Movements section (all routes)
   - [ ] Add workout to track
   - [ ] Verify workout create/edit/schedule

3. **Week 3:** Workout enhancements
   - [ ] Advanced filters
   - [ ] Pagination
   - [ ] Remix tracking
   - [ ] Multi-round sets

**Deliverable:** Users can manage workouts, logs, movements

---

### Phase 2: Programming & Teams (2-3 weeks)
**Goal:** Multi-tenant programming features

4. **Week 4:** Programming subscriptions
   - [ ] Public track browsing
   - [ ] Subscription system
   - [ ] Multi-team subscription UI
   - [ ] Track detail (subscriber view)

5. **Week 5:** Team management
   - [ ] Team settings routes
   - [ ] Member management
   - [ ] Invitation system
   - [ ] Team switcher

6. **Week 6:** Settings completion
   - [ ] Profile editing
   - [ ] Passkey management
   - [ ] Session management

**Deliverable:** Full multi-tenant programming + team collaboration

---

### Phase 3: Settings & Utilities (1-2 weeks)
**Goal:** Complete user-facing features

7. **Week 7:** Utilities & polish
   - [ ] Calculator routes
   - [ ] Google SSO
   - [ ] PostHog analytics
   - [ ] Turnstile captcha

**Deliverable:** Feature parity with Next.js core app

---

### Phase 4: Admin Dashboard (3-4 weeks)
**Goal:** Gym management features

8. **Week 8-9:** Admin foundation
   - [ ] Admin dashboard layout
   - [ ] Team scheduling calendar
   - [ ] Entitlements management

9. **Week 10-11:** Admin features
   - [ ] Programming dashboard (complete)
   - [ ] Scaling groups
   - [ ] Coaches/Classes/Gym setup
   - [ ] Schedule templates

**Deliverable:** Gym owners can manage operations

---

### Phase 5: Competition Platform (6-9 weeks)
**Goal:** Full competition lifecycle

10. **Week 12-13:** Public compete
    - [ ] Competition discovery
    - [ ] Competition detail
    - [ ] Leaderboard
    - [ ] Workouts/schedule tabs

11. **Week 14-15:** Registration flow
    - [ ] Registration form
    - [ ] Stripe integration
    - [ ] Team management
    - [ ] Success flow

12. **Week 16-17:** Organizer dashboard
    - [ ] Competition list/create
    - [ ] Athletes management
    - [ ] Divisions configuration
    - [ ] Events management

13. **Week 18-19:** Scheduling & scoring (COMPLEX)
    - [ ] Heat scheduling (drag-and-drop)
    - [ ] Judge rotation
    - [ ] Venue management
    - [ ] Results entry

14. **Week 20:** Volunteers & athlete portal
    - [ ] Volunteer signup/management
    - [ ] Athlete profile
    - [ ] My schedule
    - [ ] Revenue tracking

15. **Week 21:** Extended features
    - [ ] Series management
    - [ ] Sponsors
    - [ ] Invoices
    - [ ] Settings/danger zone

**Deliverable:** Full competition platform parity

---

## 📈 Effort Estimates by Section

| Section | Routes | Components | Actions | Effort | Complexity |
|---------|--------|------------|---------|--------|-----------|
| **Auth** | 6 remaining | 5 | 8 | 1-2 weeks | Medium |
| **Workouts** | 0 routes (features) | 15 | 13 missing | 2-3 weeks | Medium-High |
| **Logs** | 1 remaining | 3 | 0 (TS ahead) | 3-5 days | Low |
| **Movements** | 3 | 4 | 4 | 1 week | Low |
| **Programming** | 4 | 16+ | 4 subscriptions | 2 weeks | Medium |
| **Teams** | 4 | 10 | 14 | 2 weeks | Medium |
| **Settings** | 6 | 8 | 4 files | 1-2 weeks | Medium |
| **Admin** | 37 | 40+ | 5 files | 5-6 weeks | High |
| **Compete** | 39 | 115+ | 11 files | 6-9 weeks | Very High |
| **TOTAL** | **100** | **216+** | **63 files** | **22-30 weeks** | - |

---

## 📚 Detailed Section Links

### Analysis Documents

1. **[Authentication Routes](./tanstack-migration-auth.md)** - Sign in/up, password reset, SSO, email verification
2. **[Main App Routes](./tanstack-migration-main-workouts.md)** - Workouts, logs, movements, calculator
3. **[Programming & Teams](./tanstack-migration-programming-teams.md)** - Programming tracks, subscriptions, team management
4. **[Settings & Admin](./tanstack-migration-settings-admin.md)** - User settings, admin dashboard, gym management
5. **[Competition Platform](./tanstack-migration-compete.md)** - Compete subsystem (largest section)

---

## ✅ Master Migration Checklist

### 🔐 Authentication (25% complete - AUDIT CORRECTED: 2/8 routes)

#### Core Auth
- [x] ✅ Sign In (email/password) - DONE
- [x] ✅ Sign Up (email/password) - DONE
- [ ] ❌ Session management (`getSessionFromCookie` for TanStack)
- [ ] ❌ Rate limiting implementation

#### Password Management
- [ ] ❌ Forgot Password route + action
- [ ] ❌ Reset Password route + action
- [ ] ❌ KV store integration for tokens
- [ ] ❌ Email service integration (Resend)

#### Enhanced Security
- [ ] ❌ Google SSO (initiation) - `/google/route.ts`
- [ ] ❌ Google SSO (callback) - `/google/callback/route.ts`
- [ ] ❌ Turnstile captcha integration
- [ ] ❌ Feature flag system
- [ ] ❌ PostHog analytics

**AUDIT NOTE:** canSignUp feature IS implemented in TanStack (was incorrectly marked missing)

#### Advanced Features
- [ ] ❌ Email verification flow
- [ ] ❌ Passkey registration (WebAuthn)
- [ ] ❌ Team invite acceptance
- [ ] ❌ SSO buttons component

---

### 🏋️ Workouts (100% routes migrated, 50% features - AUDIT CORRECTED)

#### Routes (6/6 complete)
- [x] ✅ Workouts List - Route exists (missing: filters, pagination)
- [x] ✅ Workout Detail - Route exists (missing: remix, sets, leaderboards)
- [x] ✅ Create Workout - Route exists
- [x] ✅ Edit Workout - Route exists
- [x] ✅ Schedule Workout - Route exists
- [x] ✅ Add to Programming Track - Route exists

**AUDIT FINDING:** All 6 workout routes exist in TanStack. Feature gaps are in filters, pagination, and advanced displays.

#### Features
- [ ] ❌ Advanced filtering (tags, movements, types, tracks)
- [ ] ❌ Pagination (50 items/page)
- [ ] ❌ Remix tracking (source/remixed workouts)
- [ ] ❌ Multi-round sets display
- [ ] ❌ Leaderboards
- [ ] ❌ Scaling data display
- [ ] ❌ Team-specific workout views

#### Actions/Functions (8 migrated - AUDIT CORRECTED from ~4)
- [x] ✅ `getWorkoutsFn` - Basic list
- [x] ✅ `getScheduledWorkoutsWithResultsFn` - AUDIT FOUND
- [x] ✅ `getWorkoutByIdFn`
- [x] ✅ `getWorkoutScheduledInstancesFn`
- [x] ✅ `createWorkoutFn`
- [x] ✅ `updateWorkoutFn`
- [x] ✅ `deleteWorkoutFn`
- [x] ✅ `scheduleWorkoutFn`
- [ ] ❌ `createWorkoutRemixFn`
- [ ] ❌ `addWorkoutToTrackFn`
- [ ] ❌ `alignWorkoutScalingWithTrackFn`
- [ ] ❌ `getRemixedWorkoutsFn`
- [ ] ❌ `getResultSetsByIdFn` (multi-round)

**AUDIT NOTE:** TanStack has 8 workout functions (was documented as ~4). Missing 13 of Next.js's 21 (62% gap).

---

### 📝 Logs (67% routes, 140% functions - AUDIT CORRECTED: TS ahead of Next.js)

#### Routes (2/3 complete)
- [x] ✅ Log List - Route exists
- [x] ✅ Log New - Route exists
- [ ] ❌ Log Edit - Missing

#### Actions/Functions (7 in TanStack vs 5 in Next.js - AHEAD)
- [x] ✅ `getWorkoutScoresFn` - AUDIT FOUND
- [x] ✅ `getLogsByUserFn`
- [x] ✅ `getScoreRoundsByIdFn`
- [x] ✅ `submitLogFormFn`
- [x] ✅ `getScoreByIdFn`
- [x] ✅ `updateResultFn`
- [x] ✅ `deleteResultFn`
- [x] ✅ (Additional function discovered in audit)

**AUDIT FINDING:** TanStack has 7 log functions vs Next.js's 5. TanStack is AHEAD in this area, just missing the edit route.

---

### 🏃 Movements (0% complete)

#### Routes
- [ ] ❌ Movements List (`/movements`)
- [ ] ❌ Movement Detail (`/movements/$id`)
- [ ] ❌ Create Movement (`/movements/new`)

#### Actions/Functions
- [ ] ❌ `getAllMovementsFn`
- [ ] ❌ `createMovementFn`
- [ ] ❌ `getMovementByIdFn`
- [ ] ❌ `getWorkoutsByMovementIdFn`

---

### 🔢 Calculator (0% complete)

#### Routes
- [ ] ❌ Barbell Calculator (`/calculator`)
- [ ] ❌ Spreadsheet Calculator (`/calculator/spreadsheet`)

---

### 📅 Programming Tracks (43% complete - AUDIT CLARIFIED)

#### Routes
- [x] ✅ My Tracks (`/settings/programming`) - Owner view 100%
- [x] ✅ Track Detail (`/settings/programming/$trackId`) - Owner view 100%
- [ ] ❌ Public Browse (`/programming` or `/tracks`) - 0%
- [ ] ❌ Track Detail (subscriber view) - 0%
- [ ] ❌ Subscriptions (`/programming/subscriptions`) - 0%

#### Functions (9 migrated)
- [x] ✅ `getTeamProgrammingTracksFn` - **AUDIT CLARIFIED: Gets ALL team-subscribed tracks, not just owned**
- [x] ✅ `getProgrammingTrackByIdFn`
- [x] ✅ `createProgrammingTrackFn`
- [x] ✅ `updateProgrammingTrackFn`
- [x] ✅ `deleteProgrammingTrackFn`
- [x] ✅ `getTrackWorkoutsFn`
- [x] ✅ `addWorkoutToTrackFn`
- [x] ✅ `removeWorkoutFromTrackFn`
- [x] ✅ `updateTrackVisibilityFn`
- [ ] ❌ `subscribeToTrackFn` - Write missing
- [ ] ❌ `unsubscribeFromTrackFn` - Write missing
- [ ] ❌ `getPublicTracksWithSubscriptionsFn` - Public browse missing
- [ ] ❌ `getTrackSubscribedTeamsFn` - Admin view missing

**AUDIT FINDING:** TanStack HAS subscription read capability (getTeamProgrammingTracksFn returns subscribed tracks). Missing only write actions (subscribe/unsubscribe) and public browse UI.

**Undocumented Components:** +4 form components, track cards found in audit

---

### 👥 Teams (29% complete)

#### Routes
- [x] ✅ Team Page (`/team`) - Basic
- [ ] ❌ Team Settings (`/settings/teams`)
- [ ] ❌ Team Detail (`/settings/teams/$teamSlug`)
- [ ] ❌ Create Team (`/settings/teams/create`)

#### Functions
- [x] ✅ `getTeamLeaderboardsFn`
- [x] ✅ `getActiveTeamFn`
- [ ] ❌ `createTeamFn`
- [ ] ❌ `updateTeamFn`
- [ ] ❌ `deleteTeamFn`
- [ ] ❌ `getUserTeamsFn`
- [ ] ❌ `getTeamFn`
- [ ] ❌ `setActiveTeamFn`
- [ ] ❌ `inviteUserFn`
- [ ] ❌ `getTeamMembersFn`
- [ ] ❌ `updateMemberRoleFn`
- [ ] ❌ `removeTeamMemberFn`
- [ ] ❌ `getTeamInvitationsFn`
- [ ] ❌ `cancelInvitationFn`
- [ ] ❌ `acceptInvitationFn`

#### Features
- [ ] ❌ Team switcher component
- [ ] ❌ Active team preference system
- [ ] ❌ Member management UI
- [ ] ❌ Invitation system
- [ ] ❌ Permission checks

---

### ⚙️ Settings (5% complete - AUDIT CONFIRMED)

#### Routes (0/6 complete - layout only)
- [x] 🔄 Settings Root (layout only)
- [ ] ❌ Profile (`/settings/profile`)
- [ ] ❌ Security/Passkeys (`/settings/security`)
- [ ] ❌ Sessions (`/settings/sessions`)
- [ ] ❌ Teams List (`/settings/teams`)
- [ ] ❌ Team Details (`/settings/teams/$teamSlug`)
- [ ] ❌ Create Team (`/settings/teams/create`)

**AUDIT NOTE:** Settings routes counted correctly (6 routes). All content routes are 0% migrated.

#### Functions
- [ ] ❌ Profile update functions
- [ ] ❌ Passkey CRUD functions
- [ ] ❌ Session management functions
- [ ] ❌ Team CRUD functions

---

### 🔧 Admin (5% complete - AUDIT CORRECTED: 39 routes, not 19)

**MAJOR CORRECTION:** Route count doubled due to dual routing pattern (explicit teamId + active team)

#### Core Routes
- [ ] ❌ Admin Dashboard (`/admin`)
- [ ] ❌ Entitlements (`/admin/entitlements`)
- [ ] ❌ Organizer Requests (`/admin/organizer-requests`)

#### Team-Specific Routes (Dual Pattern: Both `/admin/teams/$teamId/...` AND `/admin/...`)
- [ ] ❌ Team Scheduling (`/admin/teams/$teamId`)
- [x] 🔄 Programming Dashboard (`/admin/teams/$teamId/programming`)
- [x] 🔄 Programming Track Detail (`/admin/teams/$teamId/programming/$trackId`)
- [ ] ❌ Scaling Groups (`/admin/teams/$teamId/scaling`)
- [ ] ❌ Coaches (`/admin/teams/$teamId/coaches`)
- [ ] ❌ Gym Setup (`/admin/teams/$teamId/gym-setup`)
- [ ] ❌ Classes (`/admin/teams/$teamId/classes`)
- [ ] ❌ Schedule Templates (`/admin/teams/$teamId/schedule-templates`)
- [ ] ❌ Schedule Week (`/admin/teams/$teamId/schedule-week`)

#### Undocumented Feature Found in Audit
- [ ] ❌ **Gym Scheduler AI** - Entire feature not previously documented

**AUDIT FINDING:** Admin has parallel route structures:
1. Explicit teamId routes: `/admin/teams/$teamId/programming`
2. Active team routes: `/admin/programming`

This dual pattern exists for ALL team-specific admin features, doubling the route count from 19 → 39.

**Impact:** Effort estimate increased from 3-4 weeks to 5-6 weeks

#### Functions
- [ ] ❌ Entitlement admin functions
- [ ] ❌ Organizer request functions
- [ ] ❌ Scheduling functions (calendar)
- [ ] ❌ Scaling group functions
- [ ] ❌ Coaches/classes/gym functions

---

### 🏆 Competition Platform (0% complete - AUDIT CORRECTIONS)

**Path Correction:** Routes are in `(compete)/compete/`, not `(main)/compete/`

#### Public Routes (0/15 complete)
- [ ] ❌ Competition Landing (`(compete)/compete/`)
- [ ] ❌ Competition Detail (`(compete)/compete/$slug`)
- [ ] ❌ Leaderboard Tab (`(compete)/compete/$slug/leaderboard`)
- [ ] ❌ Workouts Tab (`(compete)/compete/$slug/workouts`)
- [ ] ❌ Schedule Tab (`(compete)/compete/$slug/schedule`)
- [ ] ❌ Registration (`(compete)/compete/$slug/register`)
- [ ] ❌ Registration Success (`(compete)/compete/$slug/register/success`)
- [ ] ❌ Team Management (`(compete)/compete/$slug/teams/$registrationId`)
- [ ] ❌ Athlete Profile (`(compete)/compete/athlete`)
- [ ] ❌ Edit Profile (`(compete)/compete/athlete/edit`)
- [ ] ❌ Sponsors (`(compete)/compete/athlete/sponsors`)
- [ ] ❌ Invoices (`(compete)/compete/athlete/invoices`)
- [ ] ❌ Volunteer Signup (`(compete)/compete/$slug/volunteer`)
- [ ] ❌ My Schedule (`(compete)/compete/$slug/my-schedule`)
- [ ] ❌ Invite Acceptance (`(compete)/compete/invite/$token`)

#### Organizer Routes (0/24 complete - AUDIT ADDED series edit route)
- [ ] ❌ Competition List (`(compete)/compete/organizer`)
- [ ] ❌ Create Competition (`(compete)/compete/organizer/new`)
- [ ] ❌ Onboard (`(compete)/compete/organizer/onboard`)
- [ ] ❌ Payout Settings (`(compete)/compete/organizer/settings/payouts/$teamSlug`)
- [ ] ❌ Series List (`(compete)/compete/organizer/series`)
- [ ] ❌ Create Series (`(compete)/compete/organizer/series/new`)
- [ ] ❌ Series Detail (`(compete)/compete/organizer/series/$groupId`)
- [ ] ❌ **Series Edit (`(compete)/compete/organizer/series/$groupId/edit`)** - AUDIT FOUND
- [ ] ❌ Competition Overview (`(compete)/compete/organizer/$competitionId`)
- [ ] ❌ Edit Competition (`(compete)/compete/organizer/$competitionId/edit`)
- [ ] ❌ Athletes (`(compete)/compete/organizer/$competitionId/athletes`)
- [ ] ❌ Divisions (`(compete)/compete/organizer/$competitionId/divisions`)
- [ ] ❌ Events (`(compete)/compete/organizer/$competitionId/events`)
- [ ] ❌ Event Detail (`(compete)/compete/organizer/$competitionId/events/$eventId`)
- [ ] ❌ Schedule Manager (`(compete)/compete/organizer/$competitionId/schedule`) - COMPLEX
- [ ] ❌ Results Entry (`(compete)/compete/organizer/$competitionId/results`)
- [ ] ❌ Volunteers (`(compete)/compete/organizer/$competitionId/volunteers`)
- [ ] ❌ Pricing (`(compete)/compete/organizer/$competitionId/pricing`)
- [ ] ❌ Revenue (`(compete)/compete/organizer/$competitionId/revenue`)
- [ ] ❌ Settings (`(compete)/compete/organizer/$competitionId/settings`)
- [ ] ❌ Sponsors (`(compete)/compete/organizer/$competitionId/sponsors`)
- [ ] ❌ Danger Zone (`(compete)/compete/organizer/$competitionId/danger-zone`)

#### Functions (0/11 files complete - AUDIT CORRECTED from 12)
- [ ] ❌ `competition-actions.ts` → `competition-fns.ts`
- [ ] ❌ `competition-division-actions.ts` → `division-fns.ts`
- [ ] ❌ `competition-heat-actions.ts` → `heat-fns.ts`
- [ ] ❌ `competition-score-actions.ts` → `score-fns.ts`
- [ ] ❌ `competition-settings.action.ts` → `competition-settings-fns.ts`
- [ ] ❌ `judge-scheduling-actions.ts` → `judge-scheduling-fns.ts`
- [ ] ❌ `judge-rotation-actions.ts` → `judge-rotation-fns.ts`
- [ ] ❌ `judge-assignment-actions.ts` → `judge-assignment-fns.ts`
- [ ] ❌ `volunteer-actions.ts` → `volunteer-fns.ts`
- [ ] ❌ `commerce.action.ts` → `commerce-fns.ts`
- [ ] ❌ `stripe-connect.action.ts` → `stripe-connect-fns.ts`

**AUDIT CORRECTIONS:**
- Removed `sponsors.actions.ts` (doesn't exist as separate file)
- Removed `waivers` route (managed in settings, not separate)
- Added series edit route (undocumented)
- Component count: 115+ (not 102+)
- Action files: 11 (not 12)

---

## 🔍 Critical Migration Dependencies

### Infrastructure Requirements

**MUST IMPLEMENT:**
1. **Rate Limiting** - All auth/sensitive actions need rate limiting
2. **KV Store Access** - Tokens, OAuth state, sessions
3. **Email Service** - Verification, password reset, invitations
4. **PostHog Analytics** - Client + server-side tracking
5. **Turnstile Captcha** - Bot protection on signup/forms
6. **Feature Flags** - SSO, captcha, feature toggles
7. **Permission System** - Team-based authorization
8. **Session Management** - `getSessionFromCookie` for TanStack

### Component Patterns

**PORT TO TANSTACK:**
1. **Drag-and-Drop** - Heat scheduling, workout reordering
2. **Pagination** - URL-based pagination component
3. **Calendar** - FullCalendar integration for scheduling
4. **Team Switcher** - Multi-team context management
5. **Context Indicators** - Visual team context display

### Data Patterns

**ESTABLISH PATTERNS:**
1. **Multi-Team Queries** - All queries filter by `teamId`
2. **Permission Checks** - `requireTeamPermission` equivalent
3. **Optimistic Updates** - Subscription buttons, toggles
4. **Real-time Updates** - Leaderboards, scoring
5. **File Uploads** - Competition logos, athlete images

---

## 📝 Architecture Decisions Needed

### Open Questions

1. **Team Context:** URL-based (`/team/$teamId`) vs preference-based (active team)?
2. **Email Verification:** Auto-verify on signup (current) or full email verification flow?
3. **Rate Limiting:** Custom middleware or edge function?
4. **Error Handling:** Create TanStack-compatible error wrapper (like ZSAError)?
5. **Passkey Priority:** P2 or P3? (WebAuthn is complex)
6. **Team Switcher:** Sidebar component or dropdown?
7. **Public Routes:** `/programming` or `/tracks` for public browse?

---

## 🎓 Technical Notes

### ZSA to TanStack Conversion Pattern

**Next.js (ZSA):**
```typescript
export const myAction = createServerAction()
  .input(mySchema)
  .handler(async ({ input }) => {
    return withRateLimit(async () => {
      // ... logic
      throw new ZSAError("NOT_AUTHORIZED", "Error message")
    }, RATE_LIMITS.MY_ACTION)
  })
```

**TanStack Start:**
```typescript
export const myServerFn = createServerFn({method: 'POST'})
  .inputValidator((data: unknown) => mySchema.parse(data))
  .handler(async ({data}) => {
    // TODO: Add rate limiting
    // ... logic
    throw new Error("Error message")
  })
```

### Route Structure Changes

**Next.js:** `[id]` → **TanStack:** `$id`  
**Next.js:** `page.tsx` → **TanStack:** `index.tsx`  
**Next.js:** `(group)/route/` → **TanStack:** `_group/route/`

---

## 🚀 Getting Started

### Immediate Next Steps

**Sprint 1 (Current):**
1. ✅ Complete analysis documents (DONE)
2. 🔄 Set up infrastructure (rate limiting, KV, email)
3. 🔄 Complete auth flows (forgot/reset password, email verification)
4. 🔄 Verify existing migrated routes (create/edit/schedule workout, log new)

**Sprint 2 (Next):**
1. ❌ Implement missing CRUD (log edit, add to track)
2. ❌ Movements section (list, detail, create)
3. ❌ Advanced workout features (filters, pagination, remix)

**Sprint 3:**
1. ❌ Programming subscriptions (public browse, subscribe)
2. ❌ Team settings (settings routes, member management)
3. ❌ Google SSO

**Sprint 4:**
1. ❌ Settings completion (profile, security, sessions)
2. ❌ Calculator routes
3. ❌ Feature parity verification

**Sprint 5-8:** Admin dashboard  
**Sprint 9-15:** Competition platform

---

## 📊 Success Metrics

### Definition of Done (Per Route)

- [ ] Route exists in TanStack router
- [ ] All server functions migrated from actions
- [ ] All components migrated/ported
- [ ] Feature parity with Next.js version
- [ ] Permission checks implemented
- [ ] Error handling implemented
- [ ] Loading/skeleton states
- [ ] E2E tests passing
- [ ] Type safety verified
- [ ] No TypeScript errors

### Overall Migration Complete When:

- [ ] All 89 routes migrated
- [ ] All 72 action files → server functions
- [ ] All 199+ components ported
- [ ] Full test coverage (E2E critical paths)
- [ ] Performance benchmarks met
- [ ] Production deployment successful
- [ ] Next.js app deprecated

---

## 📞 Contact & Support

**Epic Owner:** [Team Lead]  
**Migration Lead:** [Migration Lead]  
**Technical Questions:** [Slack Channel]  
**Status Updates:** [Weekly Standup]

---

**Document Status:** ✅ COMPLETE (Post-Audit Update - December 23, 2025)  
**Next Review:** Weekly (or after major milestone)  
**Changelog:** 
- December 23, 2025: Major update incorporating findings from 5 comprehensive audits
  - Auth: Corrected route count (7 → 8), found canSignUp implementation
  - Main App: Corrected function counts (workouts: ~4 → 8, logs: 1 → 7), updated route status
  - Programming/Teams: Clarified getTeamProgrammingTracksFn behavior, found +4 components
  - Settings/Admin: MAJOR correction (19 → 39 routes), discovered Gym Scheduler AI feature
  - Compete: Path corrections, component count update (102+ → 115+), action file correction (12 → 11)
  - Overall: Total routes corrected (89 → 113), completion stays ~15%
