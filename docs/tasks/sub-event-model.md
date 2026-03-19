# Sub-Event Model: Multiple Workouts Per Event

## Problem

Organizers sometimes need multiple workouts in a single competition event. Example: Valentine's Day Massacre had a 2K row, 8K row, and max double unders that should have been one event scored out of 100 points, but we had to create 3 separate events because the system enforces 1:1 event-to-workout.

## Solution: `parentEventId` on `trackWorkoutsTable`

Add a single nullable column. Sub-events are full events with their own scores, heats, and submissions. The parent is a grouping container for the leaderboard.

## Schema Changes

### 1. `trackWorkoutsTable` (programming.ts)

```diff
+ parentEventId: varchar({ length: 255 }),  // FK → trackWorkoutsTable.id (self-reference)
- trackOrder: int().notNull(),
+ trackOrder: decimal({ precision: 6, scale: 2 }).notNull(),  // int → decimal for 3.1, 3.2, 3.3
```

Add index:
```
index("track_workout_parent_idx").on(table.parentEventId)
```

Add self-referencing relation:
```typescript
// In trackWorkoutsRelations
parent: one(trackWorkoutsTable, {
  fields: [trackWorkoutsTable.parentEventId],
  references: [trackWorkoutsTable.id],
  relationName: "parentChild",
}),
children: many(trackWorkoutsTable, { relationName: "parentChild" }),
```

### 2. Migration

- Add `parentEventId` column (nullable, no FK constraint — PlanetScale)
- Change `trackOrder` from `int` to `decimal(6,2)`
- All existing data: `parentEventId` = null, `trackOrder` stays the same (1.00, 2.00, etc.)

## Implementation Phases

### Phase 1: Schema + Leaderboard Core

**Files:**
- `src/db/schemas/programming.ts` — add column, change trackOrder type, add relation
- `src/server/competition-leaderboard.ts` — aggregate sub-event points into parent

**Leaderboard logic (~30 lines in `getCompetitionLeaderboard`):**

```
1. Fetch all trackWorkouts (already done)
2. Partition: parents = has children, standalone = no parent & no children
3. Process standalone events normally (no change)
4. Process sub-events normally (they have scores, they get ranked & pointed)
5. Skip parent events in the scoring loop (no scores)
6. After scoring loop: for each parent, create an eventResults entry that sums children's points
7. Parent's eventResults shows: combined points, no individual score display
```

The parent event appears in `CompetitionLeaderboardEntry.eventResults` with aggregated points. Sub-events also appear individually so the athlete can see their rank per workout.

**Key detail:** The parent's `pointsMultiplier` is ignored — each sub-event has its own multiplier. The organizer distributes the weight across sub-events however they want.

### Phase 2: Server Functions

**Files:**
- `src/server-fns/competition-workouts-fns.ts`

Changes:
- `addWorkoutToCompetitionFn`: Accept optional `parentEventId`. When adding a sub-event, auto-assign decimal trackOrder (parent.trackOrder + 0.01 * childCount + 0.01).
- `getCompetitionWorkoutsFn`: Include `parentEventId` in response. No filtering change — sub-events are returned alongside parents, sorted by trackOrder (decimal sort works correctly: 3.00, 3.01, 3.02, 4.00).
- `removeWorkoutFromCompetitionFn`: When removing a parent, also remove all children (cascade). When removing a sub-event, reorder remaining siblings.
- `reorderCompetitionEventsFn`: Handle sub-event reordering within parent. When a parent moves from order 3 to order 5, its children move too (5.01, 5.02, 5.03).
- `saveCompetitionEventFn`: No change — still saves one event at a time.

New function:
- `convertToParentEventFn`: Convert an existing standalone event into a parent (for when an organizer realizes they need to split an event). Move existing scores to a new sub-event.

### Phase 3: Organizer UI

**Event List Page** (`/compete/organizer/$competitionId/events/index.tsx`)
- Sub-events render indented under their parent
- Parent shows a collapse/expand toggle
- "Add Sub-Event" button on parent rows
- Drag-to-reorder works within parent group

**Parent Event Detail Page** (`/compete/organizer/$competitionId/events/$eventId/index.tsx`)
- When the event has children, show a different layout:
  - Top section: parent event name, description, overall points multiplier breakdown
  - Tabs or accordion for each sub-event workout
  - Each sub-event section: workout details, scheme, scoring config, scaling descriptions, points multiplier
  - "Add Sub-Event" button
- When standalone (no children), unchanged from current behavior

**Scaling Descriptions UX Challenge:**
- Each sub-event × each division = a scaling description
- 3 sub-events × 4 divisions = 12 descriptions to write
- Solution: tabbed layout. Division tabs across the top, sub-event sections within each tab. Or sub-event tabs with division sections within.
- Recommendation: **Sub-event tabs → division rows within** (organizer thinks "let me describe the 2K row for each division" not "let me describe everything for RX division")

### Phase 4: Athlete UI

**Event List** (`/compete/$slug/workouts/index.tsx`)
- Parent events render as expandable cards
- Collapsed: shows parent name, total points available, number of sub-workouts
- Expanded: shows each sub-workout with scheme badge, individual point value
- Standalone events: unchanged

**Event Detail** (`/compete/$slug/workouts/$eventId.tsx`)
- When navigating to a parent event: show all sub-workouts in sections
- Each sub-workout section: workout description, scaling descriptions, score entry, heat schedule
- Score entry per sub-workout (each has its own form)
- When navigating to a sub-event directly (from leaderboard link): show just that sub-workout but with breadcrumb back to parent

### Phase 5: Heat Schedule

No structural changes. Each sub-event gets its own heats. The organizer schedules heats per sub-workout.

UI consideration: on the heat schedule page, sub-events could be grouped under the parent for visual clarity.

## What Doesn't Change

- `scores` table — sub-events are events, `competitionEventId` points to sub-event ID
- `competition_heats` — `trackWorkoutId` points to sub-event ID
- `video_submissions` — `trackWorkoutId` points to sub-event ID
- `event_resources` — can be per sub-event or per parent
- `event_judging_sheets` — per sub-event
- `competition_events` (submission windows) — per sub-event or per parent (organizer choice)
- Judge scheduling — per sub-event

## Score Entry for Sub-Events

### Current Flow

The organizer selects an event from a dropdown, then sees a list of athletes with one score input each. Scores auto-save on blur/tab. Inputs change dynamically based on workout scheme (time, reps, load, etc.). The judge API endpoint (`/api/compete/scores/judge`) receives one score at a time with a `trackWorkoutId`.

### Multi-Column Score Entry

When a parent event is selected, the score entry page renders **one column per sub-event** instead of a single score column:

```
[Event 3: Rowing + DUs ▼]  [Division: RX ▼]

Heat 1:
Lane | Athlete       | 2K Row (time) | 8K Row (time) | Max DUs (reps)
1    | John Smith    | 7:23  ✓       | 28:45  ✓      | 156  ✓
2    | Jane Doe      | 8:45  ✓       | 31:12  ✓      | ___  ○
```

**Why this works with minimal changes:**

- **Each column has its own scheme** — time, reps, load inputs already exist in `ScoreInputRow`. We render multiple per athlete row, each with the sub-event's workout scheme.
- **Each cell saves independently** — the judge API already takes `trackWorkoutId` per save. Each sub-event column sends to its own `trackWorkoutId`. The existing auto-save queue handles this.
- **Tab order flows naturally** — Tab across sub-event columns for one athlete, then down to next athlete. Same keyboard navigation, just wider.
- **Heat assignments are shared** — athletes in Heat 1 are in Heat 1 for all sub-events of the parent. No per-sub-event heat confusion.
- **Progress tracking** — "X/Y fully scored" means all sub-events have scores for that athlete. Per-sub-event status indicators (✓) per cell.

### Changes Required

**`score-input-row.tsx`** (~50 lines):
- Accept an array of sub-event configs instead of a single `workoutScheme`
- Render one input group per sub-event (each with its own scheme, tiebreak, time cap config)
- Each input group saves independently with its own `trackWorkoutId`
- Status indicator per sub-event cell (✓ per column, not per row)

**Results page** (`results.tsx`) (~30 lines):
- When a parent event is selected from the dropdown, fetch all its children
- Pass sub-event array to each `ScoreInputRow`
- Column headers show sub-event workout names with scheme badges
- Progress display: "X/Y fully scored" (all sub-events have scores)

**Judge API** (`/api/compete/scores/judge`):
- **No change.** Each sub-event score is a separate API call with its own `trackWorkoutId`.

### Standalone Events

When the selected event has no children, the UI is **identical to today** — one score column. Zero change for the default case.

### Mobile Consideration

Multiple score columns gets tight on phone screens. Options:
1. **Horizontal scroll** on the score grid (common data table pattern) — recommended for laptop/tablet scoring
2. **Sub-event tabs within each athlete row** — tap to switch which sub-event you're scoring on mobile

Option 1 is the primary approach since most organizers score on laptop/tablet at a table.

## Edge Cases

1. **Organizer creates parent then never adds sub-events**: Parent behaves like a standalone event (has its own workoutId, can receive scores).
2. **Converting standalone → parent**: Need a flow to add children. Existing scores stay on the parent (acts as first sub-event) or get migrated.
3. **Single sub-event**: Allowed. Some organizers might want the visual grouping even with one workout.
4. **Nested sub-events (grandchildren)**: Not supported. `parentEventId` only goes one level deep.
5. **trackOrder collisions**: Decimal gives us 99 sub-events per parent (X.01 to X.99). Sufficient.

## Estimated Effort

| Phase | Files | Lines Changed | Effort |
|-------|-------|---------------|--------|
| 1. Schema + Leaderboard | 2 | ~50 | Small |
| 2. Server Functions | 1-2 | ~80 | Small |
| 3. Organizer UI (event mgmt) | 3-4 | ~200 | Medium |
| 4. Score Entry (multi-column) | 2-3 | ~80 | Small-Medium |
| 5. Athlete UI | 2-3 | ~150 | Medium |
| 6. Heat Schedule UI | 1 | ~30 | Small |
| **Total** | **~12 files** | **~590 lines** | **Medium** |

Compare to the full 1:many junction table approach: ~20+ files, ~1000+ lines, critical changes to scores/heats/submissions.
