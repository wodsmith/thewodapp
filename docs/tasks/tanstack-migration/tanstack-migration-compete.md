# TanStack Start Migration - Competition Platform (Compete)

**Epic:** wodsmith-monorepo--tuyyc-mjj5sm20ou2
**Status:** In Progress (38% Complete)
**Complexity:** CRITICAL - Largest feature area in the application
**Last Updated:** December 24, 2025

## Overview

The Competition Platform is the most complex feature area in WODsmith, encompassing the entire competition lifecycle from organizer onboarding through athlete registration, scheduling, judging, scoring, and leaderboards. This represents approximately 40% of the application's total functionality.

**Key Subsystems:**

- Public competition discovery and detail pages
- Multi-step registration flow with team management
- Organizer dashboard with competition CRUD
- Complex heat scheduling with drag-and-drop
- Judge assignment and rotation scheduling
- Live scoring and results entry
- Leaderboard with real-time updates
- Volunteer management and scheduling
- Athlete portal with profile, sponsors, invoices
- Series management for multi-event competitions
- Stripe Connect integration for payments
- Revenue tracking and payout management

---

## ⚠️ PATH CORRECTION

**IMPORTANT:** All routes are in `apps/wodsmith/src/app/(compete)/compete/`, NOT `(main)/compete/`.

## 📊 PUBLIC ROUTES (Athlete/Spectator Experience)

### Competition Discovery & Detail

| Route                  | Next.js Path                                                    | Status  | Priority | Actions                                          | Components                                                                                      | Notes                               |
| ---------------------- | --------------------------------------------------------------- | ------- | -------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Landing Page**       | `(compete)/compete/(public)/page.tsx`                           | ✅ DONE | P0       | competition-fns.ts                               | competition-search.tsx, competition-section.tsx, competition-row.tsx                            | Competition search and listing      |
| **Competition Detail** | `(compete)/compete/(public)/[slug]/(tabs)/page.tsx`             | ✅ DONE | P0       | competition-fns.ts, competition-detail-fns.ts    | competition-hero.tsx, competition-tabs.tsx, registration-sidebar.tsx, event-details-content.tsx | Layout with hero, tabs, overview    |
| **Leaderboard Tab**    | `(compete)/compete/(public)/[slug]/(tabs)/leaderboard/page.tsx` | ✅ DONE | P0       | leaderboard-fns.ts, competition-divisions-fns.ts | leaderboard-page-content.tsx                                                                    | Leaderboard with division filtering |
| **Workouts Tab**       | `(compete)/compete/(public)/[slug]/(tabs)/workouts/page.tsx`    | ✅ DONE | P1       | competition-workouts-fns.ts                      | workout-card.tsx                                                                                | Competition workouts display        |
| **Schedule Tab**       | `(compete)/compete/(public)/[slug]/(tabs)/schedule/page.tsx`    | ✅ DONE | P1       | competition-heats-fns.ts                         | schedule-page-content.tsx                                                                       | Heat schedule with filtering        |

**Layout:** `(compete)/compete/(public)/[slug]/(tabs)/layout.tsx` - Shared layout for tabbed pages

### Registration Flow

| Route                    | Next.js Path                                                        | Status         | Priority | Actions                                    | Components                                                                  | Notes                                |
| ------------------------ | ------------------------------------------------------------------- | -------------- | -------- | ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------ |
| **Registration**         | `(compete)/compete/(public)/[slug]/register/page.tsx`               | ❌ Not Started | P0       | commerce.action.ts, competition-actions.ts | registration-form.tsx, affiliate-combobox.tsx                               | Multi-step registration with payment |
| **Registration Success** | `(compete)/compete/(public)/[slug]/register/success/page.tsx`       | ❌ Not Started | P0       | competition-actions.ts                     | profile-completion-form.tsx, copy-invite-link.tsx, refresh-button.tsx       | Post-registration confirmation       |
| **Team Management**      | `(compete)/compete/(public)/[slug]/teams/[registrationId]/page.tsx` | ❌ Not Started | P0       | competition-actions.ts                     | copy-invite-link-button.tsx, affiliate-editor.tsx, pending-team-invites.tsx | Team roster and invite management    |

### Athlete Portal

| Route               | Next.js Path                                                        | Status         | Priority | Actions             | Components                                                                                               | Notes                                |
| ------------------- | ------------------------------------------------------------------- | -------------- | -------- | ------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Athlete Profile** | `(compete)/compete/(public)/athlete/page.tsx`                       | ❌ Not Started | P1       | sponsors.actions.ts | athlete-header.tsx, athlete-stats.tsx, competitive-history.tsx, benchmark-stats.tsx, sponsors-social.tsx | Public athlete profile               |
| **Edit Profile**    | `(compete)/compete/(public)/athlete/edit/page.tsx`                  | ❌ Not Started | P1       | sponsors.actions.ts | athlete-profile-form.tsx                                                                                 | Profile editing                      |
| **Sponsors**        | `(compete)/compete/(public)/athlete/sponsors/page.tsx`              | ❌ Not Started | P2       | sponsors.actions.ts | athlete-sponsors-list.tsx, athlete-sponsor-form-dialog.tsx                                               | Athlete sponsor management           |
| **Invoices**        | `(compete)/compete/(public)/athlete/invoices/page.tsx`              | ❌ Not Started | P2       | commerce.action.ts  | (list view)                                                                                              | Invoice history                      |
| **Invoice Detail**  | `(compete)/compete/(public)/athlete/invoices/[purchaseId]/page.tsx` | ❌ Not Started | P2       | commerce.action.ts  | invoice-pdf.tsx, download-invoice-button.tsx                                                             | Individual invoice with PDF download |

### Volunteer & Schedule

| Route                | Next.js Path                                             | Status         | Priority | Actions                                           | Components                                                                                                     | Notes                               |
| -------------------- | -------------------------------------------------------- | -------------- | -------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Volunteer Signup** | `(compete)/compete/(public)/[slug]/volunteer/page.tsx`   | ❌ Not Started | P1       | volunteer-actions.ts                              | volunteer-signup-form.tsx                                                                                      | Public volunteer registration       |
| **My Schedule**      | `(compete)/compete/(public)/[slug]/my-schedule/page.tsx` | ❌ Not Started | P1       | judge-scheduling-actions.ts, volunteer-actions.ts | schedule-view.tsx, event-section.tsx, rotation-card.tsx, volunteer-profile-card.tsx, edit-volunteer-dialog.tsx | Athlete/volunteer personal schedule |

**Layout:** `(compete)/compete/(public)/[slug]/my-schedule/layout.tsx` - Schedule page layout

### Invites

| Route                 | Next.js Path                                         | Status         | Priority | Actions                                      | Components                                                                         | Notes                                |
| --------------------- | ---------------------------------------------------- | -------------- | -------- | -------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| **Invite Acceptance** | `(compete)/compete/(public)/invite/[token]/page.tsx` | ❌ Not Started | P0       | competition-actions.ts, volunteer-actions.ts | accept-invite-button.tsx, invite-signup-form.tsx, accept-volunteer-invite-form.tsx | Team/volunteer invite token handling |

**Layout:** `(compete)/compete/(public)/layout.tsx` - Public compete layout

---

## 🏢 ORGANIZER ROUTES (Competition Management)

### Organizer Dashboard

| Route                  | Next.js Path                                                                   | Status         | Priority | Actions                  | Components                             | Notes                           |
| ---------------------- | ------------------------------------------------------------------------------ | -------------- | -------- | ------------------------ | -------------------------------------- | ------------------------------- |
| **Competition List**   | `(compete)/compete/organizer/(dashboard)/page.tsx`                             | ✅ DONE        | P0       | competition-fns.ts       | competitions-list.tsx, team-filter.tsx | Main organizer dashboard        |
| **Create Competition** | `(compete)/compete/organizer/(dashboard)/new/page.tsx`                         | ✅ DONE        | P0       | competition-fns.ts       | competition-form.tsx                   | Competition creation            |
| **Onboard Organizer**  | `(compete)/compete/organizer/(dashboard)/onboard/page.tsx`                     | ❌ Not Started | P0       | stripe-connect.action.ts | onboard-form.tsx                       | Stripe Connect onboarding       |
| **Onboard Pending**    | `(compete)/compete/organizer/(dashboard)/onboard/pending/page.tsx`             | ❌ Not Started | P0       | stripe-connect.action.ts | (pending state)                        | Onboarding in progress          |
| **Payout Settings**    | `(compete)/compete/organizer/(dashboard)/settings/payouts/[teamSlug]/page.tsx` | ❌ Not Started | P2       | stripe-connect.action.ts | (payout config)                        | Team-level payout configuration |

**Layout:** `(compete)/compete/organizer/(dashboard)/layout.tsx` - Dashboard layout
**Loading:** `(compete)/compete/organizer/(dashboard)/loading.tsx` - Dashboard loading state

### Series Management

| Route             | Next.js Path                                                             | Status  | Priority | Actions            | Components               | Notes                        |
| ----------------- | ------------------------------------------------------------------------ | ------- | -------- | ------------------ | ------------------------ | ---------------------------- |
| **Series List**   | `(compete)/compete/organizer/(dashboard)/series/page.tsx`                | ✅ DONE | P2       | competition-fns.ts | series-list.tsx          | Multi-competition series     |
| **Create Series** | `(compete)/compete/organizer/(dashboard)/series/new/page.tsx`            | ✅ DONE | P2       | competition-fns.ts | series-form.tsx          | Series creation              |
| **Series Detail** | `(compete)/compete/organizer/(dashboard)/series/[groupId]/page.tsx`      | ✅ DONE | P2       | competition-fns.ts | series-detail components | Individual series management |
| **Edit Series**   | `(compete)/compete/organizer/(dashboard)/series/[groupId]/edit/page.tsx` | ✅ DONE | P2       | competition-fns.ts | series-form.tsx          | Series editing               |

**Loading States:**

- `(compete)/compete/organizer/(dashboard)/series/loading.tsx`
- `(compete)/compete/organizer/(dashboard)/series/[groupId]/loading.tsx`

### Competition Management (with-sidebar)

| Route                    | Next.js Path                                                                    | Status         | Priority | Actions                         | Components                                                                                            | Notes                          |
| ------------------------ | ------------------------------------------------------------------------------- | -------------- | -------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Competition Overview** | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/page.tsx`           | ❌ Not Started | P0       | competition-actions.ts          | (overview dashboard)                                                                                  | Competition management home    |
| **Edit Competition**     | `(compete)/compete/organizer/[competitionId]/edit/page.tsx`                     | ❌ Not Started | P0       | competition-actions.ts          | organizer-competition-edit-form.tsx                                                                   | Competition details editing    |
| **Athletes**             | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/athletes/page.tsx`  | ❌ Not Started | P0       | competition-actions.ts          | organizer-registration-list.tsx                                                                       | Registration management        |
| **Divisions**            | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/divisions/page.tsx` | ❌ Not Started | P0       | competition-division-actions.ts | organizer-division-manager.tsx, organizer-division-item.tsx, organizer-template-selector.tsx          | Division configuration         |
| **Events**               | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/events/page.tsx`    | ❌ Not Started | P0       | competition-actions.ts          | organizer-event-manager.tsx, competition-event-row.tsx, create-event-dialog.tsx, add-event-dialog.tsx | Event/workout management       |
| **Event Detail**         | `(compete)/compete/organizer/[competitionId]/events/[eventId]/page.tsx`         | ❌ Not Started | P0       | competition-actions.ts          | event-details-form.tsx                                                                                | Individual event configuration |

**Shared Components:**

- `competition-sidebar.tsx` - Sidebar navigation
- `competition-header.tsx` - Page header with breadcrumbs
- `organizer-breadcrumb.tsx` - Breadcrumb navigation
- `organizer-competition-actions.tsx` - Action menu

### Scheduling & Heats

| Route                | Next.js Path                                                                   | Status         | Priority | Actions                                                                                                          | Components                                              | Notes                                                    |
| -------------------- | ------------------------------------------------------------------------------ | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| **Schedule Manager** | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/schedule/page.tsx` | ❌ Not Started | P0       | competition-heat-actions.ts, judge-scheduling-actions.ts, judge-rotation-actions.ts, judge-assignment-actions.ts | **Complex drag-and-drop system** - See components below | Heat scheduling with venue management and judge rotation |

**Schedule Components (High Complexity):**

- `schedule-page-client.tsx` - Main client container
- `schedule-container.tsx` - Schedule orchestrator
- `heat-schedule-manager.tsx` - Heat management
- `heat-schedule-container.tsx` - Heat container
- `heat-card.tsx` - Individual heat
- `draggable-athlete.tsx` - Athlete drag-and-drop
- `draggable-division.tsx` - Division drag-and-drop
- `venue-manager.tsx` - Venue/lane assignment
- `venue-manager-container.tsx` - Venue container
- `venue-manager-skeleton.tsx` - Loading state
- `heat-schedule-skeleton.tsx` - Loading state
- `event-overview.tsx` - Event summary
- `workout-preview.tsx` - Workout details

### Scoring & Results

| Route             | Next.js Path                                                                  | Status         | Priority | Actions                      | Components                                                        | Notes                  |
| ----------------- | ----------------------------------------------------------------------------- | -------------- | -------- | ---------------------------- | ----------------------------------------------------------------- | ---------------------- |
| **Results Entry** | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/results/page.tsx` | ❌ Not Started | P0       | competition-score-actions.ts | results-entry-form.tsx, heat-score-group.tsx, score-input-row.tsx | Live scoring interface |

### Volunteers & Judges

| Route          | Next.js Path                                                                     | Status         | Priority | Actions              | Components                                                                                                             | Notes                |
| -------------- | -------------------------------------------------------------------------------- | -------------- | -------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Volunteers** | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/volunteers/page.tsx` | ❌ Not Started | P1       | volunteer-actions.ts | volunteers-list.tsx, invited-volunteers-list.tsx, volunteer-row.tsx, invite-volunteer-dialog.tsx, volunteer-status.tsx | Volunteer management |

**Layout:** `(compete)/compete/organizer/[competitionId]/(with-sidebar)/volunteers/layout.tsx`

**Judge Components (NO PAGE ROUTE):**
Located at `volunteers/judges/_components/` - 11 judge scheduling components exist but no dedicated judge page route. Judges are managed within the schedule page and volunteer management.

**Judge Actions (used in schedule):**

- `judge-scheduling-actions.ts` - Judge availability
- `judge-rotation-actions.ts` - Judge rotation patterns
- `judge-assignment-actions.ts` - Judge-heat assignments

### Financial & Settings

| Route           | Next.js Path                                                                      | Status                | Priority | Actions                        | Components                                                                               | Notes                                                     |
| --------------- | --------------------------------------------------------------------------------- | --------------------- | -------- | ------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Pricing**     | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/pricing/page.tsx`     | ❌ Not Started        | P0       | commerce.action.ts             | pricing-settings-form.tsx, stripe-connection-required.tsx, stripe-connection-manager.tsx | Registration pricing                                      |
| **Revenue**     | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/revenue/page.tsx`     | ❌ Not Started        | P1       | commerce.action.ts             | revenue-stats-display.tsx                                                                | Revenue tracking                                          |
| **Settings**    | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/settings/page.tsx`    | ❌ Not Started        | P1       | competition-settings.action.ts | rotation-settings-form.tsx                                                               | Competition configuration                                 |
| **Sponsors**    | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/sponsors/page.tsx`    | ❌ Not Started        | P2       | sponsors.actions.ts            | sponsor-card.tsx                                                                         | Competition sponsor management                            |
| ~~**Waivers**~~ | ~~`waivers/page.tsx`~~                                                            | ⛔ **DOES NOT EXIST** | ~~P2~~   | ~~waivers.ts~~                 | N/A                                                                                      | **AUDIT FINDING: No waivers route or action file exists** |
| **Danger Zone** | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/danger-zone/page.tsx` | ❌ Not Started        | P2       | competition-actions.ts         | delete-competition-form.tsx                                                              | Competition deletion                                      |

**Layouts:**

- `(compete)/compete/organizer/layout.tsx` - Organizer section layout
- `(compete)/compete/organizer/[competitionId]/layout.tsx` - Competition layout

**Loading:** `(compete)/compete/organizer/[competitionId]/loading.tsx`

**Root Layout:** ⛔ **DOES NOT EXIST** - No `(compete)/compete/layout.tsx` file

---

## 📦 SHARED COMPONENTS

### Located in `src/components/compete/`

| Component                           | Purpose                        | Used By           |
| ----------------------------------- | ------------------------------ | ----------------- |
| `competition-leaderboard-table.tsx` | Leaderboard table with sorting | Leaderboard pages |
| `pending-team-invites.tsx`          | Team invite management         | Team management   |
| `stripe-connection-manager.tsx`     | Stripe Connect UI              | Pricing, revenue  |
| `volunteer-status.tsx`              | Volunteer status badge         | Volunteer lists   |

### Located in `src/components/landing/`

| Component               | Purpose           | Notes          |
| ----------------------- | ----------------- | -------------- |
| `features.tsx`          | Feature showcase  | Marketing page |
| `hero.tsx`              | Hero section      | Marketing page |
| `insights-features.tsx` | Insights features | Marketing page |
| `mission-hero.tsx`      | Mission statement | Marketing page |
| `pricing.tsx`           | Pricing cards     | Marketing page |
| `product-cards.tsx`     | Product features  | Marketing page |
| `social-proof.tsx`      | Testimonials      | Marketing page |

---

## 🔧 SERVER ACTIONS

### Competition Management (5 files)

- ✅ **competition-actions.ts** - CRUD operations, registration, events
- ✅ **competition-division-actions.ts** - Division management
- ✅ **competition-heat-actions.ts** - Heat scheduling
- ✅ **competition-score-actions.ts** - Score entry and leaderboard
- ✅ **competition-settings.action.ts** - Competition configuration

### Judging & Volunteers (4 files)

- ✅ **judge-scheduling-actions.ts** - Judge availability
- ✅ **judge-rotation-actions.ts** - Judge rotation patterns
- ✅ **judge-assignment-actions.ts** - Judge-heat assignments
- ✅ **volunteer-actions.ts** - Volunteer management

### Financial & Sponsors (3 files)

- ✅ **commerce.action.ts** - Registration purchases, pricing
- ✅ **stripe-connect.action.ts** - Stripe Connect onboarding
- ✅ **sponsors.actions.ts** - Sponsor management (athlete + competition)

### Legal & Compliance

- ⛔ **waivers.ts** - **DOES NOT EXIST** (mentioned in doc but not in codebase)

**AUDIT RESULT:** 11 of 12 claimed action files exist. Waivers functionality may be handled elsewhere or is not yet implemented.

---

## 🎯 MIGRATION PRIORITIES

### P0 - Core Competition Flow (Must Have)

1. Public competition discovery and detail pages
2. Registration flow (register → success → team management)
3. Leaderboard display
4. Organizer dashboard (list, create, edit)
5. Athletes management
6. Divisions configuration
7. Events/workouts management
8. Heat scheduling (COMPLEX - drag-and-drop)
9. Results entry/scoring
10. Pricing configuration

### P1 - Enhanced Features (Should Have)

1. Workouts tab
2. Schedule tab
3. Athlete portal (profile, edit)
4. Volunteer signup and management
5. My Schedule (athlete/volunteer)
6. Revenue tracking
7. Competition settings

### P2 - Extended Features (Nice to Have)

1. Series management
2. Athlete sponsors
3. Invoices and PDF downloads
4. Competition sponsors
5. Payout settings
6. Danger zone (deletion)

---

## ⚠️ CRITICAL COMPLEXITY AREAS

### 1. Heat Scheduling System

**Location:** `organizer/[competitionId]/(with-sidebar)/schedule/page.tsx`

**Complexity Drivers:**

- Drag-and-drop athletes between heats
- Drag-and-drop divisions to create heats
- Venue/lane assignment
- Judge rotation scheduling
- Multi-event coordination
- Real-time updates

**Components:** 15+ specialized components
**Actions:** 4 separate action files (heats, judge scheduling, rotation, assignment)

**Migration Strategy:**

- May need to rebuild drag-and-drop with TanStack Router-compatible library
- Consider splitting into smaller sub-pages
- Ensure state management works with TanStack Router

### 2. Registration Flow

**Location:** `compete/(public)/[slug]/register/`

**Complexity Drivers:**

- Multi-step form with validation
- Stripe payment integration
- Team vs individual registration
- Division selection
- Affiliate tracking
- Post-registration profile completion

**Migration Strategy:**

- Preserve form state across navigation
- Ensure Stripe integration works with new routing
- Test team invite flow thoroughly

### 3. Real-time Leaderboard

**Location:** `compete/(public)/[slug]/(tabs)/leaderboard/`

**Complexity Drivers:**

- Live score updates
- Division filtering
- Sorting and ranking calculations
- Performance with large datasets

**Migration Strategy:**

- Ensure data fetching works with TanStack Router loaders
- Consider optimistic updates
- Test with realistic data volumes

---

## 📋 TESTING REQUIREMENTS

### Critical User Flows

1. **Competition Discovery → Registration → Payment → Success**
2. **Organizer Onboard → Create Competition → Configure Divisions → Schedule Heats → Enter Scores**
3. **Athlete View Schedule → Check Leaderboard**
4. **Volunteer Signup → Accept Invite → View Schedule**
5. **Organizer Manage Team Invites → Track Revenue**

### Integration Points

- Stripe Connect (onboarding, payments)
- Database (D1 via Drizzle)
- Authentication (session management)
- File uploads (logos, images)
- Email (Resend for invites, confirmations)

---

## 📊 ESTIMATED EFFORT

**Total Routes:** 39 page routes + 1 undocumented (series edit) = **40 total page routes** ✅ VERIFIED
**Total Layouts:** 8 layout files ✅ VERIFIED
**Total Loading States:** 5 loading files ✅ VERIFIED
**Total Components:**

- Route components in `_components/`: 111 files ✅ VERIFIED
- Shared compete components: 4 files ✅ VERIFIED
- **Total: 115+ component files** (doc claimed 102+, actual is higher)
  **Total Actions:** 11 action files ✅ VERIFIED (doc claimed 12, waivers.ts does not exist)
  **Total .tsx Files:** 163 files in compete directory ✅ VERIFIED

**Complexity Breakdown:**

- **High Complexity:** 8 routes (scheduling, scoring, registration)
- **Medium Complexity:** 15 routes (management dashboards)
- **Low Complexity:** 15 routes (detail pages, lists)

**Estimated Timeline:**

- P0 (Core): 3-4 weeks
- P1 (Enhanced): 2-3 weeks
- P2 (Extended): 1-2 weeks

**Total:** 6-9 weeks for complete migration

---

## 🚀 NEXT STEPS

1. **Phase 1:** Public competition pages (discovery, detail, leaderboard)
2. **Phase 2:** Registration flow with Stripe integration
3. **Phase 3:** Organizer dashboard and competition CRUD
4. **Phase 4:** Division and event management
5. **Phase 5:** Heat scheduling (high complexity)
6. **Phase 6:** Scoring and results
7. **Phase 7:** Volunteers and athlete portal
8. **Phase 8:** Series and extended features

**Recommendation:** Start with Phase 1 to establish patterns for data fetching, layout structure, and component organization in TanStack Start before tackling the complex scheduling and registration flows.

---

## 🔍 AUDIT FINDINGS (Dec 23, 2025)

### ✅ Verified Accurate

1. **Route count:** 39 page routes confirmed (40 with undocumented series edit)
2. **TanStack Start:** 0% compete completion - no compete routes exist in `apps/wodsmith-start/`
3. **Action files:** 11 of 12 exist (all functional competition actions present)
4. **Component structure:** Well-organized with `_components/` pattern

### ❌ Corrections Made

1. **Path correction:** All routes are in `(compete)/compete/`, NOT `(main)/compete/`
   - Updated all 39 route paths in documentation
2. **Missing files identified:**
   - ⛔ `waivers.ts` action file does NOT exist
   - ⛔ Waivers page route does NOT exist
   - ⛔ Root `compete/layout.tsx` does NOT exist
3. **Undocumented route found:**
   - ✅ Added `series/[groupId]/edit/page.tsx` to Series Management section
4. **Component count updated:**
   - Doc claimed: 102+ components
   - Actual verified: 115+ component files (111 in `_components/` + 4 shared)
   - Total .tsx files: 163 (includes pages, layouts, loading states, components)

### 📝 Additional Notes

1. **Judge management:** 11 judge components exist in `volunteers/judges/_components/` but no dedicated judge page route. Judges are managed via schedule page and volunteer management.
2. **Layout structure:** 8 layout files and 5 loading state files provide good architectural separation
3. **Action files:** All 11 existing action files are well-organized and cover the compete domain comprehensively

### 🎯 Audit Conclusion

Documentation is **substantially accurate** with route count, complexity assessment, and structure. Main corrections were path prefix and removal of non-existent waivers functionality. Component count is actually **higher** than documented (115+ vs 102+), making this section even more substantial than initially described.
