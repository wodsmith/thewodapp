# TanStack Start Migration Checklist

**Epic:** wodsmith-monorepo--tuyyc-mjj5sm20ou2
**Last Updated:** December 28, 2025
**Migration Status:** 72% Complete (Competition platform nearly complete, core app functional)

---

## 📋 Executive Summary

This master checklist consolidates analysis from 5 detailed migration documents to provide a comprehensive overview of the WODsmith migration from Next.js to TanStack Start.

### Overall Progress

| Category                                 | Total Routes | ✅ Migrated | 🔄 Partial | ❌ Not Started | % Complete |
| ---------------------------------------- | ------------ | ----------- | ---------- | -------------- | ---------- |
| **Authentication**                       | 7            | 2           | 0          | 5              | 29%        |
| **Main App** (workouts, logs, movements) | 17           | 10          | 2          | 5              | 59%        |
| **Programming & Teams**                  | 7            | 3           | 1          | 3              | 43%        |
| **Settings & Admin**                     | 19           | 2           | 0          | 17             | 11%        |
| **Competition Platform**                 | 39           | 35          | 2          | 2              | 90%        |
| **TOTAL**                                | **89**       | **52**      | **5**      | **32**         | **58%**    |

### Action/Function Coverage

| Category           | Next.js Actions | TanStack Functions | Missing               |
| ------------------ | --------------- | ------------------ | --------------------- |
| **Authentication** | 10              | 2                  | 8 (80%)               |
| **Workouts**       | 21              | 8                  | 13 (62%)              |
| **Logs**           | 5               | 7                  | 0 (0%) ✅             |
| **Movements**      | 4               | 1                  | 3 (75%)               |
| **Programming**    | 4               | 9                  | 4 subscriptions (44%) |
| **Teams**          | 16              | 3                  | 13 (81%)              |
| **Settings**       | 4 files         | 0                  | 4 (100%)              |
| **Admin**          | 5 files         | 0                  | 5 (100%)              |
| **Compete**        | 12 files        | 29                 | 0 (0%) ✅             |

**Server Functions Summary:** 182 total server functions implemented across 29 files.

### Critical Gaps

**MUST HAVE (Blocking):**

- ❌ Email verification flow
- ❌ Password reset flow
- ❌ Google SSO
- ✅ Log editing - DONE (updateLogFn implemented)
- ❌ Movements section (routes missing, 1 function exists)
- ❌ Add workout to track
- ❌ Advanced workout filters & pagination
- ❌ Programming subscriptions
- ❌ Team settings and member management
- ✅ Competition public pages (discovery, detail, tabs) - DONE
- ✅ Competition registration flow - DONE (register + success routes)
- ✅ Competition organizer events management - DONE
- ✅ Competition organizer athletes/divisions/scheduling routes - DONE

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

### Test Coverage by Category

| Category                 | E2E Tests | Integration Tests | Unit Tests     | Coverage % | Status         | Priority                  |
| ------------------------ | --------- | ----------------- | -------------- | ---------- | -------------- | ------------------------- |
| **Auth**                 | 8         | 0                 | 0              | 40%        | 🟡 E2E only    | P0 - Add integration      |
| **Main App (Workouts)**  | 0         | 5                 | ~200 (scoring) | 30%        | 🟡 Partial     | P0 - Add E2E, integration |
| **Main App (Logs)**      | 0         | 0                 | 0              | 0%         | 🔴 None        | P0 - Critical gap         |
| **Main App (Movements)** | 0         | 0                 | 0              | 0%         | 🔴 None        | P1 - Add all              |
| **Programming/Teams**    | 0         | 3                 | 14             | 50%        | 🟡 Partial     | P1 - Add E2E              |
| **Settings**             | 0         | 0                 | 0              | 0%         | 🔴 None        | P1 - Add integration      |
| **Admin**                | 0         | 2                 | 0              | 10%        | 🔴 Minimal     | P1 - Add integration      |
| **Compete**              | 0         | 0                 | ~200 (server)  | 60%        | 🟢 Server only | P0 - Add E2E, integration |

**Overall:** 538 tests passing in wodsmith-start. Test coverage is strong for competition platform.

### Test Creation Priority Order

**Week 1 (P0 - Blockers):**

1. `test/actions/log-actions.test.ts` - Log CRUD (users can't fix mistakes)
2. `test/actions/scheduling-actions.test.ts` - Workout scheduling
3. `e2e/compete/registration.spec.ts` - Revenue path

**Week 2 (P0 - Auth):** 4. `test/actions/sign-in-actions.test.ts` - Sign-in integration 5. `test/actions/sign-up-actions.test.ts` - Sign-up integration 6. `test/actions/forgot-password-actions.test.ts` - Password reset

**Week 3 (P1 - Core Features):** 7. `test/actions/movement-actions.test.ts` - Movement CRUD 8. `test/utils/team-auth.test.ts` - Permission helpers 9. `test/integration/team-settings.test.ts` - Team management

**Week 4 (P1 - Admin):** 10. `test/integration/scheduling-workflow.test.ts` - FullCalendar scheduling 11. `test/actions/entitlement-admin-actions.test.ts` - Plan management 12. `e2e/scheduling.spec.ts` - Scheduling E2E

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

---

## 🔍 Audit Findings (December 23, 2025)

Five comprehensive audits were completed to verify the accuracy of this checklist against the actual Next.js and TanStack codebases. Key corrections:

### Summary of Corrections

| Metric                     | Original | Corrected | Change                     |
| -------------------------- | -------- | --------- | -------------------------- |
| **Total Routes**           | 89       | 113       | +24 routes (+27%)          |
| **Auth Routes**            | 7        | 8         | +1 (Google OAuth split)    |
| **Main App Routes**        | 17       | 20        | +3                         |
| **Settings/Admin Routes**  | 19       | 39        | +20 (dual routing pattern) |
| **Compete Components**     | 102+     | 115+      | +13                        |
| **Workout Functions (TS)** | ~4       | 8         | +4                         |
| **Log Functions (TS)**     | 1        | 7         | +6 (TanStack ahead)        |

### Key Audit Findings

1. **Auth:** Google OAuth has 2 separate route files. `canSignUp` IS implemented (was incorrectly marked missing).

2. **Main App:** TanStack has 8 workout functions (not ~4) and 7 log functions (MORE than Next.js's 5). Log editing route is the main gap.

3. **Programming:** `getTeamProgrammingTracksFn` gets ALL team-subscribed tracks (not just owned). TanStack HAS subscription read capability, just missing write actions.

4. **Admin:** MAJOR correction - Route count doubled (19 → 39) due to dual routing pattern (explicit teamId + active team routes). Discovered undocumented Gym Scheduler AI feature.

5. **Compete:** Path prefix is `(compete)/compete/`, not `(main)/compete/`. Component count updated to 115+.

---

## 🎯 Priority Matrix

### P0 - CRITICAL (Blocks Core User Flows)

#### Authentication (2/7 complete)

- [x] ✅ Sign In (email/password)
- [x] ✅ Sign Up (email/password)
- [ ] ❌ Forgot Password
- [ ] ❌ Reset Password
- [ ] ❌ Email Verification
- [ ] ❌ Google SSO (initiation + callback)
- [ ] ❌ Team Invite Acceptance

#### Core Workouts (3/6 complete)

- [x] ✅ Workouts List (missing: filters, pagination)
- [x] ✅ Workout Detail (missing: remix, sets, leaderboards)
- [x] ✅ Create Workout (needs verification)
- [x] 🔄 Edit Workout (exists, needs verification)
- [x] 🔄 Schedule Workout (exists, needs verification)
- [ ] ❌ Add Workout to Track

#### Logging (3/3 complete) ✅

- [x] ✅ Log List - DONE
- [x] ✅ Log New - DONE
- [x] ✅ Log Edit - DONE (updateLogFn, getLogByIdFn implemented)

#### Compete - Core Flow (10/10 complete) ✅

- [x] ✅ Competition Discovery (`/compete`) - DONE
- [x] ✅ Competition Detail (`/compete/$slug`) - DONE with layout, hero, tabs
- [x] ✅ Leaderboard Display (`/compete/$slug/leaderboard`) - DONE
- [x] ✅ Registration Flow (`/compete/$slug/register` + `/register/success`) - DONE
- [x] ✅ Organizer Dashboard (`/compete/organizer`) - DONE with series management
- [x] ✅ Athletes Management (`/compete/organizer/$id/athletes`) - DONE
- [x] ✅ Divisions Configuration (`/compete/organizer/$id/divisions`) - DONE
- [x] ✅ Events Management - DONE with drag-drop, create/add/edit
- [x] ✅ Heat Scheduling (`/compete/organizer/$id/schedule`) - DONE
- [x] ✅ Results Entry (`/compete/organizer/$id/results`) - DONE

**P0 Estimated Effort:** ~~8-10 weeks~~ COMPLETE

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

#### Compete - Enhanced (7/7 complete) ✅

- [x] ✅ Workouts Tab (`/compete/$slug/workouts`) - DONE
- [x] ✅ Schedule Tab (`/compete/$slug/schedule`) - DONE
- [ ] ❌ Athlete Portal (profile editing)
- [x] ✅ Volunteer Management (`/compete/organizer/$id/volunteers`) - DONE
- [x] ✅ My Schedule (`/compete/$slug/my-schedule`) - DONE
- [x] ✅ Revenue Tracking (`/compete/organizer/$id/revenue`) - DONE
- [x] ✅ Competition Settings (`/compete/organizer/$id/settings`) - DONE

**P1 Estimated Effort:** ~~6-8 weeks~~ Mostly complete, only athlete portal remaining

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

10. **Week 12-13:** Public compete ✅ COMPLETE
    - [x] Competition discovery - DONE
    - [x] Competition detail - DONE
    - [x] Leaderboard - DONE
    - [x] Workouts/schedule tabs - DONE

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

| Section         | Routes      | Components | Actions      | Effort          | Complexity  |
| --------------- | ----------- | ---------- | ------------ | --------------- | ----------- |
| **Auth**        | 5 remaining | 5          | 8            | 1-2 weeks       | Medium      |
| **Workouts**    | 6 remaining | 15         | 17           | 2-3 weeks       | Medium-High |
| **Logs**        | 1 remaining | 3          | 4            | 3-5 days        | Low         |
| **Movements**   | 3           | 4          | 4            | 1 week          | Low         |
| **Programming** | 4           | 12         | 4            | 2 weeks         | Medium      |
| **Teams**       | 4           | 10         | 14           | 2 weeks         | Medium      |
| **Settings**    | 6           | 8          | 4 files      | 1-2 weeks       | Medium      |
| **Admin**       | 17          | 40+        | 5 files      | 3-4 weeks       | High        |
| **Compete**     | 39          | 102+       | 12 files     | 6-9 weeks       | Very High   |
| **TOTAL**       | **85**      | **199+**   | **72 files** | **20-28 weeks** | -           |

---

## 📚 Detailed Section Links

### Analysis Documents

1. **[Authentication Routes](tanstack-migration/tanstack-migration-auth.md)** - Sign in/up, password reset, SSO, email verification
2. **[Main App Routes](tanstack-migration/tanstack-migration-main-workouts.md)** - Workouts, logs, movements, calculator
3. **[Programming & Teams](tanstack-migration/tanstack-migration-programming-teams.md)** - Programming tracks, subscriptions, team management
4. **[Settings & Admin](tanstack-migration/tanstack-migration-settings-admin.md)** - User settings, admin dashboard, gym management
5. **[Competition Platform](tanstack-migration/tanstack-migration-compete.md)** - Compete subsystem (largest section)

---

## ✅ Master Migration Checklist

### 🔐 Authentication (29% complete)

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

- [ ] ❌ Google SSO (initiation)
- [ ] ❌ Google SSO (callback)
- [ ] ❌ Turnstile captcha integration
- [ ] ❌ Feature flag system
- [ ] ❌ PostHog analytics

#### Advanced Features

- [ ] ❌ Email verification flow
- [ ] ❌ Passkey registration (WebAuthn)
- [ ] ❌ Team invite acceptance
- [ ] ❌ SSO buttons component

---

### 🏋️ Workouts (35% complete)

#### Routes

- [x] ✅ Workouts List - DONE (partial: missing filters, pagination)
- [x] ✅ Workout Detail - DONE (partial: missing remix, sets, leaderboards)
- [x] 🔄 Create Workout - EXISTS (needs verification)
- [x] 🔄 Edit Workout - EXISTS (needs verification)
- [x] 🔄 Schedule Workout - EXISTS (needs verification)
- [ ] ❌ Add to Programming Track

#### Features

- [ ] ❌ Advanced filtering (tags, movements, types, tracks)
- [ ] ❌ Pagination (50 items/page)
- [ ] ❌ Remix tracking (source/remixed workouts)
- [ ] ❌ Multi-round sets display
- [ ] ❌ Leaderboards
- [ ] ❌ Scaling data display
- [ ] ❌ Team-specific workout views

#### Actions/Functions

- [x] ✅ `getWorkoutsFn` - Basic list
- [x] ✅ `getScheduledWorkoutsWithResultsFn`
- [x] ✅ `getWorkoutByIdFn`
- [x] ✅ `getWorkoutScheduledInstancesFn`
- [ ] ❌ `createWorkoutRemixFn`
- [ ] ❌ `addWorkoutToTrackFn`
- [ ] ❌ `alignWorkoutScalingWithTrackFn`
- [ ] ❌ `getRemixedWorkoutsFn`
- [ ] ❌ `getResultSetsByIdFn` (multi-round)
- [ ] ❌ `getTeamLeaderboardsFn`

---

### 📝 Logs (100% complete) ✅

#### Routes

- [x] ✅ Log List - DONE
- [x] ✅ Log New - DONE
- [x] ✅ Log Edit - Functions ready (route may need UI)

#### Actions/Functions

- [x] ✅ `getWorkoutScoresFn` - DONE
- [x] ✅ `getLogsByUserFn` - DONE
- [x] ✅ `getLogByIdFn` - DONE
- [x] ✅ `submitLogFn` - DONE
- [x] ✅ `createLogFn` - DONE
- [x] ✅ `updateLogFn` - DONE
- [x] ✅ `getScalingLevelsFn` - DONE

---

### 🏃 Movements (25% complete)

#### Routes

- [ ] ❌ Movements List (`/movements`)
- [ ] ❌ Movement Detail (`/movements/$id`)
- [ ] ❌ Create Movement (`/movements/new`)

#### Actions/Functions

- [x] ✅ `getAllMovementsFn` - DONE
- [ ] ❌ `createMovementFn`
- [ ] ❌ `getMovementByIdFn`
- [ ] ❌ `getWorkoutsByMovementIdFn`

---

### 🔢 Calculator (0% complete)

#### Routes

- [ ] ❌ Barbell Calculator (`/calculator`)
- [ ] ❌ Spreadsheet Calculator (`/calculator/spreadsheet`)

---

### 📅 Programming Tracks (43% complete)

#### Routes

- [x] ✅ My Tracks (`/settings/programming`) - Owner view
- [x] ✅ Track Detail (`/settings/programming/$trackId`) - Owner view
- [ ] ❌ Public Browse (`/programming` or `/tracks`)
- [ ] ❌ Track Detail (subscriber view)
- [ ] ❌ Subscriptions (`/programming/subscriptions`)

#### Functions

- [x] ✅ `getTeamProgrammingTracksFn`
- [x] ✅ `getProgrammingTrackByIdFn`
- [x] ✅ `createProgrammingTrackFn`
- [x] ✅ `updateProgrammingTrackFn`
- [x] ✅ `deleteProgrammingTrackFn`
- [x] ✅ `getTrackWorkoutsFn`
- [x] ✅ `addWorkoutToTrackFn`
- [x] ✅ `removeWorkoutFromTrackFn`
- [x] ✅ `updateTrackVisibilityFn`
- [ ] ❌ `subscribeToTrackFn`
- [ ] ❌ `unsubscribeFromTrackFn`
- [ ] ❌ `getPublicTracksWithSubscriptionsFn`
- [ ] ❌ `getTrackSubscribedTeamsFn`

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

### ⚙️ Settings (5% complete)

#### Routes

- [x] 🔄 Settings Root (layout only)
- [ ] ❌ Profile (`/settings/profile`)
- [ ] ❌ Security/Passkeys (`/settings/security`)
- [ ] ❌ Sessions (`/settings/sessions`)
- [ ] ❌ Teams List (`/settings/teams`)
- [ ] ❌ Team Details (`/settings/teams/$teamSlug`)
- [ ] ❌ Create Team (`/settings/teams/create`)

#### Functions

- [ ] ❌ Profile update functions
- [ ] ❌ Passkey CRUD functions
- [ ] ❌ Session management functions
- [ ] ❌ Team CRUD functions

---

### 🔧 Admin (5% complete)

#### Routes

- [ ] ❌ Admin Dashboard (`/admin`)
- [ ] ❌ Entitlements (`/admin/entitlements`)
- [ ] ❌ Organizer Requests (`/admin/organizer-requests`)
- [ ] ❌ Team Scheduling (`/admin/teams/$teamId`)
- [x] 🔄 Programming Dashboard (`/admin/teams/$teamId/programming`)
- [x] 🔄 Programming Track Detail (`/admin/teams/$teamId/programming/$trackId`)
- [ ] ❌ Scaling Groups (`/admin/teams/$teamId/scaling`)
- [ ] ❌ Coaches (`/admin/teams/$teamId/coaches`)
- [ ] ❌ Gym Setup (`/admin/teams/$teamId/gym-setup`)
- [ ] ❌ Classes (`/admin/teams/$teamId/classes`)
- [ ] ❌ Schedule Templates (`/admin/teams/$teamId/schedule-templates`)
- [ ] ❌ Schedule Week (`/admin/teams/$teamId/schedule-week`)

#### Functions

- [ ] ❌ Entitlement admin functions
- [ ] ❌ Organizer request functions
- [ ] ❌ Scheduling functions (calendar)
- [ ] ❌ Scaling group functions
- [ ] ❌ Coaches/classes/gym functions

---

### 🏆 Competition Platform (90% complete) ✅

#### Public Routes (12/15 complete)

- [x] ✅ Competition Landing (`/compete`) - DONE with search, filtering
- [x] ✅ Competition Detail (`/compete/$slug`) - DONE with layout, hero, tabs
- [x] ✅ Leaderboard Tab (`/compete/$slug/leaderboard`) - DONE with division selector
- [x] ✅ Workouts Tab (`/compete/$slug/workouts`) - DONE with WorkoutCard
- [x] ✅ Schedule Tab (`/compete/$slug/schedule`) - DONE with heat display
- [x] ✅ Registration (`/compete/$slug/register`) - DONE with full form
- [x] ✅ Registration Success (`/compete/$slug/register/success`) - DONE with payment receipt
- [ ] ❌ Team Management (`/compete/$slug/teams/$registrationId`)
- [ ] ❌ Athlete Profile (`/compete/athlete`)
- [ ] ❌ Edit Profile (`/compete/athlete/edit`)
- [ ] ❌ Sponsors (`/compete/athlete/sponsors`)
- [ ] ❌ Invoices (`/compete/athlete/invoices`)
- [x] ✅ Volunteer Signup (`/compete/$slug/volunteer`) - DONE
- [x] ✅ My Schedule (`/compete/$slug/my-schedule`) - DONE
- [x] ✅ Invite Acceptance (`/compete/invite/$token`) - DONE

#### Organizer Routes (22/24 complete)

- [x] ✅ Competition List (`/compete/organizer`) - DONE with team filter
- [x] ✅ Create Competition (`/compete/organizer/new`) - DONE
- [ ] ❌ Onboard (`/compete/organizer/onboard`)
- [ ] ❌ Payout Settings (`/compete/organizer/settings/payouts/$teamSlug`)
- [x] ✅ Series List (`/compete/organizer/series`) - DONE
- [x] ✅ Create Series (`/compete/organizer/series/new`) - DONE
- [x] ✅ Series Detail (`/compete/organizer/series/$groupId`) - DONE
- [x] ✅ Edit Series (`/compete/organizer/series/$groupId/edit`) - DONE
- [x] ✅ Competition Overview (`/compete/organizer/$competitionId`) - DONE
- [x] ✅ Edit Competition (`/compete/organizer/$competitionId/edit`) - DONE
- [x] ✅ Athletes (`/compete/organizer/$competitionId/athletes`) - DONE
- [x] ✅ Divisions (`/compete/organizer/$competitionId/divisions`) - DONE
- [x] ✅ Events (`/compete/organizer/$competitionId/events`) - DONE with drag-drop reorder, create/add dialogs
- [x] ✅ Event Detail (`/compete/organizer/$competitionId/events/$eventId`) - DONE with full edit form
- [x] ✅ Schedule Manager (`/compete/organizer/$competitionId/schedule`) - DONE with heat management, venues, drag-drop assignments
- [x] ✅ Results Entry (`/compete/organizer/$competitionId/results`) - DONE with score entry, heat grouping
- [x] ✅ Volunteers (`/compete/organizer/$competitionId/volunteers`) - DONE
- [x] ✅ Pricing (`/compete/organizer/$competitionId/pricing`) - DONE
- [x] ✅ Revenue (`/compete/organizer/$competitionId/revenue`) - DONE
- [x] ✅ Settings (`/compete/organizer/$competitionId/settings`) - DONE
- [x] ✅ Sponsors (`/compete/organizer/$competitionId/sponsors`) - DONE
- [x] ✅ Danger Zone (`/compete/organizer/$competitionId/danger-zone`) - DONE

#### Functions (29 files, 182 functions) ✅

- [x] ✅ `competition-fns.ts` - Competition CRUD, public listing (10 functions)
- [x] ✅ `competition-detail-fns.ts` - Registration counts, user status (11 functions)
- [x] ✅ `competition-workouts-fns.ts` - Published workouts, division descriptions
- [x] ✅ `competition-heats-fns.ts` - Heats with assignments
- [x] ✅ `competition-divisions-fns.ts` - Public divisions (10 functions)
- [x] ✅ `leaderboard-fns.ts` - Leaderboard data
- [x] ✅ `organizer-onboarding-fns.ts` - Organizer request submission
- [x] ✅ `organizer-admin-fns.ts` - Admin organizer request review
- [x] ✅ `volunteer-profile-fns.ts` - Volunteer profile updates
- [x] ✅ `volunteer-fns.ts` - Volunteer management (12 functions)
- [x] ✅ `volunteer-schedule-fns.ts` - Volunteer scheduling
- [x] ✅ `competition-score-fns.ts` - Score entry, save, delete
- [x] ✅ `commerce-fns.ts` - Fee config, revenue stats (5 functions)
- [x] ✅ `stripe-connect-fns.ts` - Stripe Connect integration (9 functions)
- [x] ✅ `registration-fns.ts` - Registration payment flow (3 functions)
- [x] ✅ `invite-fns.ts` - Team/volunteer invitations (6 functions)
- [x] ✅ `sponsor-fns.ts` - Sponsor management (14 functions)
- [x] ✅ `judge-assignment-fns.ts` - Judge assignments
- [x] ✅ `judge-rotation-fns.ts` - Judge rotations
- [x] ✅ `judge-scheduling-fns.ts` - Judge scheduling
- [x] ✅ `affiliate-fns.ts` - Affiliate management

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
  .handler(async ({input}) => {
    return withRateLimit(async () => {
      // ... logic
      throw new ZSAError('NOT_AUTHORIZED', 'Error message')
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
    throw new Error('Error message')
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

**Sprint 2 (Completed - Competition Public):**

1. ✅ Competition discovery page - DONE
2. ✅ Competition detail with all tabs - DONE
3. ✅ Organizer dashboard with series - DONE
4. ✅ Server functions for workouts, heats, divisions, leaderboard - DONE

**Sprint 2.5 (Completed - Test Migration):**

1. ✅ Scoring tests migrated (multi-round, time-cap-tiebreak) - 71 tests
2. ✅ Competition leaderboard tests migrated - 83 tests
3. ✅ Organizer onboarding tests migrated (actions + server) - 80 tests
4. ✅ Volunteer tests migrated (profile + utilities) - 89 tests
5. ✅ Judge tests migrated (rotation-utils + scheduling) - 48 tests
6. ✅ Commerce and Stripe Connect tests migrated
7. ✅ Schedule page content tests migrated - 17 tests
8. ✅ **Total: 538 tests passing in wodsmith-start** (1 flaky test)

**Sprint 3 (Current - December 2025):**

1. ✅ Competition registration flow - DONE
2. ✅ Organizer competition management routes - DONE
3. ❌ Programming subscriptions (public browse, subscribe)
4. ❌ Team settings (settings routes, member management)

**Sprint 4 (Next):**

1. ❌ Auth completion (forgot/reset password, email verification)
2. ❌ Movements section (routes + remaining functions)
3. ❌ Settings completion (profile, security, sessions)
4. ❌ Team management routes

**Sprint 5:**

1. ❌ Calculator routes
2. ❌ Google SSO
3. ❌ Programming subscriptions
4. ❌ Feature parity verification

**Sprint 6-8:** Admin dashboard (scheduling, entitlements, gym management)

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

**Document Status:** ✅ COMPLETE
**Next Review:** Weekly (or after major milestone)
**Changelog:** See commit history
