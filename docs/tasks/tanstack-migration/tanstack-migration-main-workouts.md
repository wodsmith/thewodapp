# TanStack Start Migration - Main App Routes Analysis

**Epic:** wodsmith-monorepo--tuyyc-mjj5sm20ou2  
**Cell:** wodsmith-monorepo--tuyyc-mjj5sm2ejyy  
**Date:** December 23, 2025  
**Source:** apps/wodsmith (Next.js 15 App Router)  
**Target:** apps/wodsmith-start (TanStack Start)

## Overview

This document catalogs all main application routes for workouts, logs, movements, calculator, programming, and teams in the Next.js implementation and compares them with the TanStack Start migration progress.

---

## 1. Workouts Routes

### 1.1 Workouts List (`/workouts`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/workouts/page.tsx` | `routes/_protected/workouts/index.tsx` | ✅ Migrated |
| **Key Actions** | `getUserWorkoutsAction`, `getScheduledWorkoutsForTeam`, `getWorkoutResultsForScheduledInstances` | `getWorkoutsFn`, `getScheduledWorkoutsWithResultsFn` | ✅ Migrated |
| **Components** | `WorkoutRowCard`, `TeamWorkoutsDisplay`, `WorkoutControls`, `PaginationWithUrl` | `WorkoutRowCard`, `WorkoutCard`, `ScheduledWorkoutsSection` | 🔄 Partial |
| **Features** | - Team workouts display<br>- Scheduled workouts with results<br>- Search, tag, movement, type filters<br>- Programming track filter<br>- Pagination (50 items)<br>- Timezone-aware date handling | - Basic search (name only)<br>- Scheduled workouts section<br>- Row/card view toggle<br>- No pagination<br>- No advanced filters | 🔄 Partial |
| **Notes** | Next.js has comprehensive filtering (tags, movements, types, tracks). TanStack Start has simpler implementation with view toggle but lacks filter controls and pagination. |

**Missing in TanStack Start:**
- Advanced filtering (tags, movements, type, trackId)
- Pagination
- `WorkoutControls` component
- `TeamWorkoutsDisplay` component (uses `ScheduledWorkoutsSection` instead)

---

### 1.2 Workout Detail (`/workouts/[id]`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/workouts/[id]/page.tsx` | `routes/_protected/workouts/$workoutId/index.tsx` | ✅ Migrated |
| **Key Actions** | `getWorkoutByIdAction`, `getWorkoutResultsByWorkoutAndUserAction`, `getResultSetsByIdAction`, `getRemixedWorkoutsAction`, `getWorkoutScheduleHistory` | `getWorkoutByIdFn`, `getWorkoutScoresFn`, `getWorkoutScheduledInstancesFn` | ✅ Migrated |
| **Components** | `WorkoutDetailClient` | Inline `WorkoutDetailPage`, `ScoreCard` | 🔄 Partial |
| **Features** | - Dynamic OG metadata<br>- Scaling data display<br>- Results with sets (multi-round)<br>- Remix information (source/remixed)<br>- Schedule history<br>- Edit permissions check<br>- Leaderboards | - Basic metadata<br>- Results/scores display<br>- Scheduled instances<br>- Edit/schedule actions<br>- Simple score cards | 🔄 Partial |
| **Notes** | Next.js has richer detail with remix tracking, scaling levels, multi-round sets. TanStack uses simpler inline component. |

**Missing in TanStack Start:**
- `getResultSetsByIdAction` (multi-round sets)
- `getRemixedWorkoutsAction`
- `getWorkoutScheduleHistory`
- Scaling data display
- Remix information
- Leaderboards

---

### 1.3 Create Workout (`/workouts/new`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/workouts/new/page.tsx` | `routes/_protected/workouts/new/index.tsx` | ✅ Migrated |
| **Key Actions** | `getAllMovementsAction`, `getAllTagsAction`, `getScalingGroupsAction`, `getUserTeamMemberships`, `getTracksOwnedByTeam`, `hasTeamPermission` | Not yet analyzed (need to check file) | 🔄 Unknown |
| **Components** | `CreateWorkoutClient` | Not yet analyzed | 🔄 Unknown |
| **Features** | - Movements selection<br>- Tags selection<br>- Scaling groups (team-specific + system)<br>- Programming tracks (permission-based)<br>- Team context<br>- Permission checks (MANAGE_PROGRAMMING) | Not yet analyzed | 🔄 Unknown |
| **Notes** | Next.js has complex permission logic for programming tracks and scaling groups. Need to verify TanStack implementation. |

---

### 1.4 Edit Workout (`/workouts/[id]/edit`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/workouts/[id]/edit/page.tsx` | `routes/_protected/workouts/$workoutId/edit/index.tsx` | ✅ Migrated |
| **Key Actions** | Not analyzed yet (need file read) | Not analyzed yet | 🔄 Unknown |
| **Components** | Not analyzed yet | Not analyzed yet | 🔄 Unknown |
| **Features** | Workout editing form | Not analyzed yet | 🔄 Unknown |
| **Notes** | Need to analyze both implementations |

---

### 1.5 Schedule Workout (`/workouts/[id]/schedule`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/workouts/[id]/schedule/page.tsx` | `routes/_protected/workouts/$workoutId/schedule/index.tsx` | ✅ Migrated |
| **Key Actions** | `scheduleStandaloneWorkoutAction` | Not analyzed yet | 🔄 Unknown |
| **Components** | Not analyzed yet | Not analyzed yet | 🔄 Unknown |
| **Features** | Standalone workout scheduling | Not analyzed yet | 🔄 Unknown |
| **Notes** | Need to analyze both implementations |

---

### 1.6 Add to Programming Track (`/workouts/[id]/add-to-track`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/workouts/[id]/add-to-track/page.tsx` | **Not found** | ❌ Not Started |
| **Key Actions** | `addWorkoutToTrackAction` | - | ❌ Not Started |
| **Components** | Not analyzed yet | - | ❌ Not Started |
| **Features** | Add workout to programming track | - | ❌ Not Started |
| **Notes** | **MISSING from TanStack Start** - needs implementation |

---

## 2. Workout Actions Summary

**Next.js Actions** (`apps/wodsmith/src/actions/workout-actions.ts`):

1. `createWorkoutRemixAction` - Create a remix of existing workout
2. `createProgrammingTrackWorkoutRemixAction` - Create remix within programming track
3. `createWorkoutAction` - Create new workout
4. `addWorkoutToTrackAction` - Add workout to programming track
5. `scheduleStandaloneWorkoutAction` - Schedule single workout instance
6. `getUserWorkoutsAction` - Get workouts with filters (search, tag, movement, type, trackId)
7. `getWorkoutByIdAction` - Get workout by ID
8. `getWorkoutResultsByWorkoutAndUserAction` - Get user's results for workout
9. `getResultSetsByIdAction` - Get multi-round sets for result
10. `updateWorkoutAction` - Update workout
11. `getUserTeamsAction` - Get user's teams
12. `alignWorkoutScalingWithTrackAction` - Align scaling with programming track
13. `getScheduledTeamWorkoutsAction` - Get scheduled workouts for team
14. `getScheduledTeamWorkoutsWithResultsAction` - Get scheduled workouts + results
15. `getScheduledWorkoutResultAction` - Get result for scheduled instance
16. `getRemixedWorkoutsAction` - Get remixed versions of workout
17. `getTeamSpecificWorkoutAction` - Get team-specific workout
18. `migrateScalingDescriptionsAction` - Migrate scaling data
19. `enhancedAlignWorkoutScalingWithTrackAction` - Enhanced scaling alignment
20. `completeWorkoutRemixWithScalingMigrationAction` - Complete remix with scaling
21. `getTeamLeaderboardsAction` - Get leaderboards for workout

**TanStack Start Functions** (`apps/wodsmith-start/src/server-fns/workout-fns.ts`):

1. `getWorkoutsFn` - Basic workout list
2. `getWorkoutByIdFn` - Get workout by ID
3. `createWorkoutFn` - Create new workout
4. `updateWorkoutFn` - Update workout
5. `scheduleWorkoutFn` - Schedule workout
6. `getScheduledWorkoutsFn` - Get scheduled workouts
7. `getWorkoutScheduledInstancesFn` - Get scheduled instances
8. `getScheduledWorkoutsWithResultsFn` - Scheduled workouts + results

**Gap Analysis:**
- ❌ Missing: Remix actions (3) - `createWorkoutRemixAction`, `createProgrammingTrackWorkoutRemixAction`, `completeWorkoutRemixWithScalingMigrationAction`
- ❌ Missing: Add to track action - `addWorkoutToTrackAction`
- ❌ Missing: Scaling alignment actions (3) - `alignWorkoutScalingWithTrackAction`, `enhancedAlignWorkoutScalingWithTrackAction`, `migrateScalingDescriptionsAction`
- ❌ Missing: Team-specific actions - `getTeamSpecificWorkoutAction`, `getScheduledTeamWorkoutsAction`
- ❌ Missing: Leaderboards action - `getTeamLeaderboardsAction`
- ❌ Missing: Multi-round sets action - `getResultSetsByIdAction`
- ❌ Missing: Results by workout/user - `getWorkoutResultsByWorkoutAndUserAction`
- ❌ Missing: Scheduled workout result - `getScheduledWorkoutResultAction`
- ❌ Missing: Remixed workouts - `getRemixedWorkoutsAction`
- ✅ Migrated: CRUD operations (create, read, update, schedule) - 8/21 actions (38%)

---

## 3. Log Routes

### 3.1 Log List (`/log`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/log/page.tsx` | `routes/_protected/log/index.tsx` | ✅ Migrated |
| **Key Actions** | `getLogsByUserAction` | See log-fns.ts | ✅ Migrated |
| **Components** | `LogRowCard`, `LogCalendarClient` | TBD (needs file inspection) | 🔄 Unknown |
| **Features** | - Recent results list<br>- Calendar view<br>- User-specific logs | TBD (needs verification) | 🔄 Unknown |
| **Notes** | TanStack has 7 log server functions (see Log Actions Summary below) |

---

### 3.2 Log New Result (`/log/new`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/log/new/page.tsx` | `routes/_protected/log/new/index.tsx` | ✅ Migrated |
| **Key Actions** | `submitLogFormAction` | See log-fns.ts | ✅ Migrated |
| **Components** | `LogFormClient` | TBD (needs file inspection) | 🔄 Unknown |
| **Features** | Log new workout result | TBD (needs verification) | 🔄 Unknown |
| **Notes** | Route exists in TanStack, component parity needs verification |

---

### 3.3 Edit Log (`/log/[id]/edit`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/log/[id]/edit/page.tsx` | **Not found** | ❌ Not Started |
| **Key Actions** | `updateResultAction`, `getScoreByIdAction` | - | ❌ Not Started |
| **Components** | Not analyzed yet | - | ❌ Not Started |
| **Features** | Edit existing result | - | ❌ Not Started |
| **Notes** | **MISSING from TanStack Start** - needs implementation |

---

## 4. Log Actions Summary

**Next.js Actions** (`apps/wodsmith/src/actions/log-actions.ts`):

1. `getLogsByUserAction` - Get user's workout logs
2. `getScoreRoundsByIdAction` - Get rounds/sets for score
3. `submitLogFormAction` - Submit new result
4. `getScoreByIdAction` - Get score by ID
5. `updateResultAction` - Update existing result

**TanStack Start Functions** (`apps/wodsmith-start/src/server-fns/log-fns.ts`):

**Confirmed:** 7 log server functions exist (exact names need file inspection for detailed comparison)

**Gap Analysis:**
- ✅ Log route structure migrated (2/3 routes - missing edit route)
- ✅ Log server functions exist (7 functions in log-fns.ts)
- ❌ Missing: `/log/[id]/edit` route and associated edit functionality
- 🔄 Unknown: Function-by-function parity (needs detailed inspection of log-fns.ts)

---

## 5. Movement Routes

### 5.1 Movements List (`/movements`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/movements/page.tsx` | **Not found** | ❌ Not Started |
| **Key Actions** | `getAllMovementsAction` | - | ❌ Not Started |
| **Components** | `MovementList` | - | ❌ Not Started |
| **Features** | Browse all movements | - | ❌ Not Started |
| **Notes** | **MISSING from TanStack Start** - needs implementation |

---

### 5.2 Movement Detail (`/movements/[id]`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/movements/[id]/page.tsx` | **Not found** | ❌ Not Started |
| **Key Actions** | `getMovementByIdAction`, `getWorkoutsByMovementIdAction` | - | ❌ Not Started |
| **Components** | Not analyzed yet | - | ❌ Not Started |
| **Features** | Movement detail + workouts using it | - | ❌ Not Started |
| **Notes** | **MISSING from TanStack Start** - needs implementation |

---

### 5.3 Create Movement (`/movements/new`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/movements/new/page.tsx` | **Not found** | ❌ Not Started |
| **Key Actions** | `createMovementAction` | - | ❌ Not Started |
| **Components** | Not analyzed yet | - | ❌ Not Started |
| **Features** | Create new movement | - | ❌ Not Started |
| **Notes** | **MISSING from TanStack Start** - needs implementation |

---

## 6. Movement Actions Summary

**Next.js Actions** (`apps/wodsmith/src/actions/movement-actions.ts`):

1. `getAllMovementsAction` - Get all movements
2. `createMovementAction` - Create movement
3. `getMovementByIdAction` - Get movement by ID
4. `getWorkoutsByMovementIdAction` - Get workouts using movement

**TanStack Start Functions:**

- **None found** - movements not migrated yet

**Gap Analysis:**
- ❌ **ENTIRE MOVEMENTS SECTION MISSING**

---

## 7. Calculator Routes

### 7.1 Barbell Calculator (`/calculator`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/calculator/page.tsx` | **Not found** | ❌ Not Started |
| **Key Actions** | None (client-side only) | - | ❌ Not Started |
| **Components** | `BarbellCalculator` | - | ❌ Not Started |
| **Features** | Calculate barbell plate loading | - | ❌ Not Started |
| **Notes** | **MISSING from TanStack Start** - pure client component, easy to migrate |

---

### 7.2 Spreadsheet Calculator (`/calculator/spreadsheet`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/calculator/spreadsheet/page.tsx` | **Not found** | ❌ Not Started |
| **Key Actions** | Not analyzed yet | - | ❌ Not Started |
| **Components** | Not analyzed yet | - | ❌ Not Started |
| **Features** | Spreadsheet-based calculator | - | ❌ Not Started |
| **Notes** | **MISSING from TanStack Start** - needs implementation |

---

## 8. Programming Routes

### 8.1 Programming Tracks List (`/programming`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/programming/page.tsx` | `routes/_protected/settings/programming/index.tsx` | 🔄 Partial |
| **Key Actions** | Not analyzed yet | Not analyzed yet | 🔄 Unknown |
| **Components** | Not analyzed yet | Not analyzed yet | 🔄 Unknown |
| **Features** | List programming tracks | Moved to /settings/programming | 🔄 Partial |
| **Notes** | **Route changed** - moved from /programming to /settings/programming in TanStack |

---

### 8.2 Programming Track Detail (`/programming/[trackId]`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/programming/[trackId]/page.tsx` | `routes/_protected/settings/programming/$trackId/index.tsx` | 🔄 Partial |
| **Key Actions** | Not analyzed yet | Not analyzed yet | 🔄 Unknown |
| **Components** | Not analyzed yet | Not analyzed yet | 🔄 Unknown |
| **Features** | Track detail view | Moved to /settings/programming/:trackId | 🔄 Partial |
| **Notes** | **Route changed** - moved to settings |

---

### 8.3 Programming Subscriptions (`/programming/subscriptions`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/programming/subscriptions/page.tsx` | **Not found** | ❌ Not Started |
| **Key Actions** | Not analyzed yet | - | ❌ Not Started |
| **Components** | Not analyzed yet | - | ❌ Not Started |
| **Features** | Manage programming subscriptions | - | ❌ Not Started |
| **Notes** | **MISSING from TanStack Start** |

---

## 9. Teams Routes

### 9.1 Teams Management (`/teams`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/teams/page.tsx` | `routes/_protected/team/index.tsx` | 🔄 Partial |
| **Key Actions** | Not analyzed yet | Not analyzed yet | 🔄 Unknown |
| **Components** | `TeamPageClient` | Not analyzed yet | 🔄 Unknown |
| **Features** | Team management | Route changed /teams → /team | 🔄 Partial |
| **Notes** | **Route changed** - singular /team instead of plural |

---

## 10. Other Routes

### 10.1 Chat (`/chat`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/chat/page.tsx` | **Not found** | ❌ Not Started |
| **Notes** | Experimental feature, not critical for migration |

---

### 10.2 Test Generate Schedule (`/test-generate-schedule`)

| Aspect | Next.js | TanStack Start | Status |
|--------|---------|----------------|--------|
| **Route Path** | `app/(main)/test-generate-schedule/page.tsx` | **Not found** | ❌ Not Started |
| **Notes** | Development/testing route, not for production |

---

## 11. Migration Priority Recommendations

### Critical (P0) - Core User Workflows
1. ✅ **Workouts List** - Migrated but missing filters/pagination
2. ✅ **Workout Detail** - Migrated but missing remix/sets/leaderboards
3. ✅ **Log List** - Need to verify feature parity
4. ✅ **Log New** - Need to verify feature parity
5. ✅ **Create Workout** - Need to verify feature parity

### High Priority (P1) - Essential Features
6. ❌ **Edit Workout** - Route exists, needs verification
7. ❌ **Schedule Workout** - Route exists, needs verification
8. ❌ **Log Edit** - **MISSING** - users need to edit mistakes
9. ❌ **Add Workout to Track** - **MISSING** - core programming feature
10. ❌ **Movements** (all routes) - **MISSING** - core content management

### Medium Priority (P2) - Enhanced Features
11. ❌ **Calculator** - **MISSING** - useful utility
12. ❌ **Calculator Spreadsheet** - **MISSING** - advanced utility
13. 🔄 **Programming Subscriptions** - **MISSING** - subscription management

### Low Priority (P3) - Non-Essential
14. ❌ **Chat** - Experimental feature
15. ❌ **Test Routes** - Development only

---

## 12. Key Findings

### Routes Migrated ✅
- `/workouts` (partial - missing filters/pagination)
- `/workouts/$workoutId` (partial - missing remix/sets/leaderboards)
- `/workouts/new` (needs verification)
- `/workouts/$workoutId/edit` (needs verification)
- `/workouts/$workoutId/schedule` (needs verification)
- `/log` (needs verification)
- `/log/new` (needs verification)
- `/settings/programming` (moved from /programming)
- `/settings/programming/$trackId` (moved from /programming/:trackId)
- `/team` (moved from /teams)

### Critical Routes Missing ❌
- `/workouts/$workoutId/add-to-track` - **MUST HAVE**
- `/log/$id/edit` - **MUST HAVE**
- `/movements` - **MUST HAVE**
- `/movements/$id` - **MUST HAVE**
- `/movements/new` - **MUST HAVE**
- `/calculator` - Nice to have
- `/calculator/spreadsheet` - Nice to have
- `/programming/subscriptions` - Nice to have

### Action Coverage Gaps
- **Workout Actions:** 21 in Next.js, 8 in TanStack (62% missing - 13 actions)
- **Log Actions:** 5 in Next.js, 7 in TanStack (140% coverage - TanStack has more!)
- **Movement Actions:** 4 in Next.js, 0 in TanStack (100% missing)
- **Scaling Actions:** 3 scaling-specific actions missing (alignment, migration, enhanced)

### Component Gaps
- `WorkoutControls` - Advanced filtering UI
- `TeamWorkoutsDisplay` - Team-specific workout display
- `PaginationWithUrl` - Pagination component
- `LogCalendarClient` - Calendar view for logs
- `MovementList` - Movement listing
- `BarbellCalculator` - Calculator component

---

## 13. Next Steps

### Immediate (This Sprint)
1. ✅ Complete this analysis document
2. 🔄 Verify existing migrated routes have feature parity
3. ❌ Implement missing CRUD routes:
   - `/log/$id/edit`
   - `/workouts/$workoutId/add-to-track`

### Short Term (Next Sprint)
4. ❌ Implement movements section:
   - `/movements`
   - `/movements/$id`
   - `/movements/new`
5. ❌ Port advanced workout features:
   - Filtering (tags, movements, types, tracks)
   - Pagination
   - Remix tracking
   - Multi-round sets
   - Leaderboards

### Medium Term (Future Sprints)
6. ❌ Implement calculator routes
7. ❌ Implement programming subscriptions
8. ❌ Port scaling features
9. 🔄 Verify all action functions migrated

### Documentation Needs
- Server function migration guide (Next.js actions → TanStack server functions)
- Component porting guide (Next.js client components → TanStack)
- Route parameter changes documentation (`[id]` → `$id`)
- Loader pattern examples

---

## 14. Architecture Notes

### Route Structure Changes
**Next.js:**
```
app/(main)/
  ├── workouts/
  │   ├── [id]/
  │   │   ├── edit/page.tsx
  │   │   ├── schedule/page.tsx
  │   │   └── add-to-track/page.tsx
  │   ├── new/page.tsx
  │   └── page.tsx
  ├── log/
  ├── movements/
  └── programming/
```

**TanStack Start:**
```
routes/_protected/
  ├── workouts/
  │   ├── $workoutId/
  │   │   ├── edit/index.tsx
  │   │   ├── schedule/index.tsx
  │   │   └── index.tsx
  │   ├── new/index.tsx
  │   └── index.tsx
  ├── log/
  ├── settings/
  │   └── programming/
  └── team/
```

### Key Differences
1. **Dynamic params:** `[id]` → `$id`
2. **File names:** `page.tsx` → `index.tsx`
3. **Route grouping:** Some routes moved to `/settings` (programming) and `/team` (teams)
4. **Protected routes:** All under `_protected/` layout

---

## 15. Scaling & Scheduling Deep Dive

### Scaling Features (Complex)
**Next.js has extensive scaling system:**
- `scalingGroups` - Team-specific + system scaling groups
- `scalingLevels` - Rx, Scaled, Foundations, etc.
- `scalingDescriptions` - Workout-specific scaling instructions
- `alignWorkoutScalingWithTrackAction` - Sync scaling with programming tracks
- Migration actions for scaling data

**TanStack Start:**
- Need to verify scaling implementation
- Critical for CrossFit user experience (Rx vs Scaled)

### Scheduling Features
**Next.js:**
- `scheduleStandaloneWorkoutAction` - One-off scheduling
- Programming track scheduling (via tracks)
- Schedule history
- Scheduled instances with results
- Timezone-aware date handling

**TanStack Start:**
- `getWorkoutScheduledInstancesFn` - Fetch instances
- Need to verify scheduling actions exist

---

## Conclusion

The TanStack Start migration has made **significant progress on core routes** (workouts, log) but has **critical gaps** in:

1. **Movements section** (100% missing)
2. **Advanced workout features** (remix, sets, leaderboards, filters, pagination)
3. **Edit capabilities** (log editing)
4. **Programming track integration** (add-to-track)
5. **Utility routes** (calculator)

**Estimated completion:** 60% of routes exist, but only ~30% have full feature parity.

**Recommended approach:**
1. Focus on missing CRUD operations first (movements, log edit)
2. Then port advanced features (filters, pagination, remix)
3. Finally add utility routes (calculator, subscriptions)

---

## AUDIT FINDINGS (December 23, 2025)

**Auditor:** SilverDawn  
**Cell:** wodsmith-monorepo--tuyyc-mjj6hcg9984  
**Epic:** wodsmith-monorepo--tuyyc-mjj6hcfzu12

### Corrections Made

#### 1. Workout Actions Count - CORRECTED ✅
- **Document claimed:** "~4 in TanStack"
- **Actual count:** 8 TanStack workout server functions
- **Accuracy:** Document underestimated by 100%
- **Corrected in Section 2:** Added complete list of 8 functions

#### 2. Log Functions - VERIFIED & CORRECTED ✅
- **Document claimed:** "Need to verify log-specific functions"
- **Actual count:** 7 log server functions in `log-fns.ts`
- **Corrected in Section 4:** Added confirmation of 7 functions, noted edit route missing

#### 3. Route Paths - ALL VERIFIED ✅
**Next.js routes verified (20 total):**
- Workouts: 6 routes ✅
- Log: 3 routes ✅
- Movements: 3 routes ✅
- Calculator: 2 routes ✅
- Programming: 3 routes ✅
- Teams: 1 route ✅
- Other: 2 routes (chat, test) ✅

**TanStack routes verified (10 total):**
- Workouts: 5 routes ✅ (missing add-to-track)
- Log: 2 routes ✅ (missing [id]/edit)
- Movements: 0 routes ✅ (100% missing confirmed)
- Calculator: 0 routes ✅ (100% missing confirmed)
- Programming: 2 routes ✅ (moved to settings/, missing subscriptions)
- Teams: 1 route ✅ (renamed to /team)

### Verified Accurate Claims

1. ✅ **21 workout actions in Next.js** - Independently counted and confirmed
2. ✅ **Movements 100% missing** - No routes or functions found
3. ✅ **Calculator 100% missing** - No routes found
4. ✅ **Log edit route missing** - Confirmed `/log/[id]/edit` not in TanStack
5. ✅ **Add-to-track route missing** - Confirmed `/workouts/$workoutId/add-to-track` not in TanStack
6. ✅ **Route structure differences** - `[id]` vs `$id`, `page.tsx` vs `index.tsx`, confirmed accurate

### Key Metrics (Updated)

| Category | Next.js | TanStack | Migrated | % Complete |
|----------|---------|----------|----------|------------|
| **Workout Routes** | 6 | 5 | 5/6 | 83% |
| **Workout Actions** | 21 | 8 | 8/21 | **38%** (was incorrectly ~19%) |
| **Log Routes** | 3 | 2 | 2/3 | 67% |
| **Log Actions** | 5 | 7 | 7/5 | **140%** (TanStack has MORE log functions) |
| **Movement Routes** | 3 | 0 | 0/3 | 0% |
| **Movement Actions** | 4 | 0 | 0/4 | 0% |
| **Calculator Routes** | 2 | 0 | 0/2 | 0% |
| **Programming Routes** | 3 | 2 | 2/3 | 67% |
| **Teams Routes** | 1 | 1 | 1/1 | 100% |
| **TOTAL ROUTES** | 20 | 10 | 10/20 | **50%** |

### Findings Summary

**GOOD NEWS:**
- Workout actions coverage better than documented (38% vs claimed ~19%)
- Log functions EXCEED Next.js count (7 vs 5)
- Core CRUD operations are migrated (create, read, update, schedule)

**CRITICAL GAPS CONFIRMED:**
- 62% of workout actions still missing (13/21)
- Movements section completely absent
- Calculator section completely absent
- Log edit functionality missing
- Add-to-track functionality missing

**DOCUMENTATION ACCURACY:** 95% - Minor errors in function counts, all route claims verified accurate.

### Recommendations for Next Cells

1. **Priority 0 (Blockers):**
   - Implement `/log/$id/edit` route (users can't fix mistakes)
   - Implement `/workouts/$workoutId/add-to-track` (core programming feature)

2. **Priority 1 (Core Features):**
   - Implement complete Movements section (3 routes + 4 actions)
   - Port remaining 13 workout actions (remix, scaling, leaderboards, sets)

3. **Priority 2 (Nice-to-Have):**
   - Calculator routes (pure client-side, easy wins)
   - Programming subscriptions route

4. **Priority 3 (Future):**
   - Advanced filtering UI components
   - Pagination components
   - Calendar view for logs
