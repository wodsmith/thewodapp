# Phase 3: Add Workouts to Competitions

## Overview

Add workout support to competitions by extending the existing programming tracks infrastructure. Competitions will auto-create a programming track, and workouts are added as track workouts with competition-specific metadata.

## Decisions Made

- **Data Model**: Reuse programming tracks (not new tables)
- **Scoring**: Points-based (1st = 100pts, 2nd = 95pts, etc.)
- **Division Variations**: Use existing `workoutScalingDescriptionsTable`
- **Heat Management**: Defer to Phase 4

---

## Schema Changes

### 1. Add `competitionId` to `programmingTracksTable`

```typescript
// In src/db/schemas/programming.ts
competitionId: text().references(() => competitionsTable.id, { onDelete: "cascade" }),
```

- `null` for regular tracks, set for competition tracks
- Enables querying tracks by competition
- Auto-cleanup when competition deleted

### 2. Refactor `trackWorkoutsTable` columns

```typescript
// In src/db/schemas/programming.ts - trackWorkoutsTable
// RENAME: dayNumber → trackOrder
trackOrder: integer().notNull(),    // Display order (1, 2, 3...)
// DROP: weekNumber (no longer needed)
// ADD: pointsMultiplier for weighted events
pointsMultiplier: integer().default(100),
```

- **Rename** `dayNumber` to `trackOrder` - unified ordering for both regular tracks and competitions
- **Drop** `weekNumber` - not needed, simplifies the model
- **Add** `pointsMultiplier` - allows weighted events (e.g., finals worth 2x)

### 3. Add competition context to `results` table (optional)

```typescript
// In src/db/schemas/workouts.ts - results table
competitionPoints: integer(),   // Calculated points for this result
competitionRank: integer(),     // Rank within division for this event
```

Alternatively, calculate these at query time for simplicity.

### 4. Extend `CompetitionSettings` interface

```typescript
// In src/types/competitions.ts
export interface CompetitionSettings {
  divisions?: {
    scalingGroupId: string
  }
  scoring?: ScoringSettings
}

// Scoring configuration - three types available (1st place always = 100 points)
export type ScoringSettings =
  | {
      type: 'winner_takes_more'
      // Points: 100, 85, 75, 67, 60, 54... (decreasing increments favor top finishers)
    }
  | {
      type: 'even_spread'
      // Points distributed linearly: for 5 athletes → 100, 75, 50, 25, 0
    }
  | {
      type: 'fixed_step'
      step: number  // Default: 5
      // Points: 100, 95, 90, 85... (fixed decrement per place)
    }
```

**Scoring Type Examples (5 athletes):**

| Type | Formula | Points |
|------|---------|--------|
| `winner_takes_more` | Decreasing increments | 100, 85, 75, 67, 60 |
| `even_spread` | `100 - (place-1) * (100 / (count-1))` | 100, 75, 50, 25, 0 |
| `fixed_step` (step=5) | `100 - (place-1) * step` | 100, 95, 90, 85, 80 |

---

## Implementation Steps

### Phase 3.1: Schema & Migration

1. **Update `programmingTracksTable`** - Add `competitionId` column with FK to competitions
2. **Refactor `trackWorkoutsTable`**:
   - Rename `dayNumber` → `trackOrder`
   - Drop `weekNumber` column
   - Add `pointsMultiplier` column
3. **Update indexes** - Rename `track_workout_day_idx` to `track_workout_order_idx`
4. **Update relations** - Add competition → track relation
5. **Update all usages** - Find/replace `dayNumber` → `trackOrder` throughout codebase
6. **Export from schema** - Update `src/db/schema.ts`
7. **Generate migration**: `pnpm db:generate refactor_track_workouts`

### Phase 3.2: Auto-Create Track on Competition Creation

Extend `createCompetition()` in `src/server/competitions.ts`:

```typescript
// After creating competition and competition team:
await db.insert(programmingTracksTable).values({
  name: `${params.name} - Events`,
  description: `Competition events for ${params.name}`,
  type: "team_owned",
  ownerTeamId: competitionTeamId,
  competitionId: competition.id,
  scalingGroupId: settings?.divisions?.scalingGroupId,
  isPublic: false,
})
// Track can be queried via: WHERE competitionId = competition.id
```

### Phase 3.3: Competition Workout CRUD

Create `src/server/competition-workouts.ts`:

```typescript
export async function addWorkoutToCompetition(params: {
  competitionId: string
  workoutId: string
  trackOrder: number
  pointsMultiplier?: number
  notes?: string
})

export async function getCompetitionWorkouts(competitionId: string)

export async function updateCompetitionWorkout(params: {
  trackWorkoutId: string
  trackOrder?: number
  pointsMultiplier?: number
  notes?: string
})

export async function removeWorkoutFromCompetition(trackWorkoutId: string)

export async function reorderCompetitionEvents(
  competitionId: string,
  updates: { trackWorkoutId: string; trackOrder: number }[]
)
```

### Phase 3.4: Competition Leaderboard Service

Create `src/server/competition-leaderboard.ts`:

```typescript
export interface CompetitionLeaderboardEntry {
  registrationId: string
  userId: string
  athleteName: string
  divisionId: string
  divisionLabel: string
  totalPoints: number
  overallRank: number
  eventResults: Array<{
    trackWorkoutId: string
    trackOrder: number
    eventName: string
    rank: number
    points: number
    rawScore: string
    formattedScore: string
  }>
}

export async function getCompetitionLeaderboard(params: {
  competitionId: string
  divisionId?: string  // Filter by division
}): Promise<CompetitionLeaderboardEntry[]>

export async function getEventLeaderboard(params: {
  competitionId: string
  trackWorkoutId: string
  divisionId?: string
})
```

**Points Calculation Logic**:
1. For each event, rank athletes within their division by score
2. Apply scoring based on competition's `scoring.type`:
   - **winner_takes_more**: `[100, 85, 75, 67, 60, 54, 49, 45, 41, 38, 35, 32, 30, 28, 26, 24, 22, 20, ...]`
   - **even_spread**: `100 - (place - 1) * (100 / (athleteCount - 1))`
   - **fixed_step**: `100 - (place - 1) * step`
3. Multiply event points by `pointsMultiplier / 100` if set (allows weighted events, e.g., 200 = 2x points)
4. Sum all event points for overall standings
5. Tie-breaker: count of 1st places, then 2nd places, etc.

### Phase 3.5: Server Actions

Add to `src/actions/competition-actions.ts`:

```typescript
// Competition Workout Actions
export const addWorkoutToCompetitionAction = authenticatedAction(...)
export const updateCompetitionWorkoutAction = authenticatedAction(...)
export const removeWorkoutFromCompetitionAction = authenticatedAction(...)
export const reorderCompetitionEventsAction = authenticatedAction(...)

// Leaderboard Actions (public)
export const getCompetitionLeaderboardAction = publicAction(...)
export const getEventLeaderboardAction = publicAction(...)
```

### Phase 3.6: UI Components

#### Organizer UI
- **Event Manager**: `src/app/(compete)/compete/organizer/[competitionId]/events/`
  - List events with drag-to-reorder
  - Add workout modal (search existing workouts)
  - Edit event settings (points multiplier, notes)
  - Remove event

#### Public UI
- **Competition Detail Page**: `src/app/(compete)/compete/[slug]/page.tsx`
  - Events section on main details page (summary view of workouts)
  - Show schedule if dates set

- **Events Tab**: `src/app/(compete)/compete/[slug]/events/page.tsx`
  - Full list of competition events/workouts
  - Division-specific descriptions for each workout
  - Event order and details

- **Leaderboard Tab**: `src/app/(compete)/compete/[slug]/leaderboard/page.tsx`
  - Division tabs/selector
  - Overall standings table (rank, athlete, total points, per-event breakdown)
  - Click event column to see event leaderboard detail

---

## Division-Specific Workout Descriptions

Use existing `workoutScalingDescriptionsTable` for variations:

```
Competition uses scalingGroupId: "sgrp_abc"
  → Scaling levels: "Male RX", "Male Intermediate", "Female RX", etc.

Workout "Fran" links to:
  workoutScalingDescriptionsTable entries:
    - (workoutId: "wk_fran", scalingLevelId: "slvl_male_rx", description: "21-15-9: Thrusters 95lb, Pull-ups")
    - (workoutId: "wk_fran", scalingLevelId: "slvl_male_int", description: "21-15-9: Thrusters 65lb, Ring Rows")
```

When displaying workout for a division, join to get division-specific description.

---

## Results Flow

1. Admin adds workout to competition → Creates `trackWorkoutsTable` entry with `trackOrder`
2. Athlete performs workout → Logs result in `results` table with `scheduledWorkoutInstanceId`
3. Leaderboard query:
   - Get competition track → Get track workouts
   - Get all results for those workouts, filtered by registered athletes
   - Group by division, rank by score, calculate points
   - Aggregate for overall standings

---

## Heat Management (Deferred to Phase 4)

When ready, add these tables:

```typescript
// competition_heats: Time slots per workout/division
// competition_heat_assignments: Athlete → heat + lane mapping
```

No current schema changes needed - purely additive when implemented.

---

## Critical Files

| File | Changes |
|------|---------|
| `src/db/schemas/programming.ts` | Add `competitionId`, rename `dayNumber`→`trackOrder`, drop `weekNumber`, add `pointsMultiplier` |
| `src/db/schemas/competitions.ts` | Add relations to programming track |
| `src/db/schema.ts` | Update exports |
| `src/types/competitions.ts` | Extend `CompetitionSettings` |
| `src/server/competitions.ts` | Auto-create track on competition creation |
| `src/server/competition-workouts.ts` | NEW - Workout CRUD for competitions |
| `src/server/competition-leaderboard.ts` | NEW - Leaderboard queries |
| `src/actions/competition-actions.ts` | Add workout and leaderboard actions |
| `src/utils/score-formatting.ts` | Reference for score calculation |
| `src/server/leaderboard.ts` | Reference for leaderboard patterns |

---

## Migration Commands

```bash
pnpm db:generate add_competition_track_support
pnpm db:migrate:dev
```
