# Athlete Lane Filter for Judge Rotation Grid - Updated Plan

## User Requirement Update

The user clarified that **sometimes heats won't have athletes scheduled but judges should still be assignable**. Therefore, the lane filtering needs to be **optional/toggleable**.

## Current State

✅ **Subtask 1 Complete**: `HeatInfo` type now supports optional `occupiedLanes?: Set<number>` field, and `calculateCoverage` correctly filters lanes when this field is provided (backward compatible when undefined).

## Remaining Work

### Subtask 2: Add "unavailable" status to TimelineCell (IN PROGRESS)

**File**: `src/routes/compete/organizer/$competitionId/-components/judges/rotation-timeline.tsx`

Changes needed:
1. Add `status: "unavailable"` option to TimelineCell
2. Render unavailable cells with dark/striped pattern
3. Make unavailable cells non-interactive (no click, no drop target)
4. Add to legend

### Subtask 3: Pass heat assignments + add toggle for lane filtering

**File**: `src/routes/compete/organizer/$competitionId/-components/judges/judge-scheduling-container.tsx`

Changes needed:
1. Pass full `HeatWithAssignments` data to RotationTimeline (not just heatNumber/scheduledTime)
2. Add a toggle/checkbox: **"Only show lanes with athletes"** or **"Hide empty lanes"**
3. When toggle is ON:
   - Compute `occupiedLanes` per heat from assignments
   - Pass to coverage calculation
   - Render empty lanes as "unavailable"
4. When toggle is OFF (default):
   - All lanes are available for judge assignment
   - Current behavior preserved

### UI Design for Toggle

```
┌─────────────────────────────────────────────────────┐
│ Rotation Timeline                                   │
│ Event Name - 8 heats x 10 lanes                     │
│                                                     │
│ ☐ Only show lanes with athletes                     │
│                                                     │
│ ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐   │
│ │ Lane│ H1  │ H2  │ H3  │ H4  │ H5  │ H6  │ H7  │   │
│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤   │
│ │ L1  │ ██  │ ██  │     │     │ ██  │ ██  │     │   │
│ │ L2  │     │     │ ░░  │ ░░  │     │     │ ░░  │   │ <- ░░ = unavailable (empty lane)
│ │ L3  │ ██  │     │     │ ██  │     │ ██  │     │   │
│ └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘   │
│                                                     │
│ Legend: □ Empty  ■ Covered  ░ No Athlete           │
└─────────────────────────────────────────────────────┘
```

When toggle is OFF, all cells are interactive. When toggle is ON, lanes without athletes show as striped/unavailable.

## Updated Subtask Breakdown

| # | Task | Files | Status |
|---|------|-------|--------|
| 1 | Update HeatInfo type + calculateCoverage | `judge-rotation-utils.ts`, tests | ✅ Done |
| 2 | Add "unavailable" status to TimelineCell | `rotation-timeline.tsx` | ✅ Done |
| 3 | Add toggle + pass heat assignments | `judge-scheduling-container.tsx`, `rotation-timeline.tsx` | ✅ Done |

## Implementation Notes

### Toggle State Location
- Store in component state (useState) - no need to persist
- Default: OFF (all lanes available)

### Props Changes for RotationTimeline

```typescript
interface RotationTimelineProps {
  // existing props...

  // NEW: Full heat data with assignments
  heatsWithAssignments: HeatWithAssignments[]

  // OR: Computed occupied lanes per heat
  occupiedLanesByHeat?: Map<number, Set<number>>  // heatNumber -> Set of lane numbers

  // NEW: Whether to filter lanes
  filterEmptyLanes: boolean
}
```

### Coverage Stats Update

When filter is ON, coverage stats should reflect:
- `totalSlots`: Only lanes with athletes
- `coveredSlots`: Judges assigned to lanes with athletes
- `coveragePercent`: Percentage of athlete lanes covered

When filter is OFF:
- Current behavior (all lanes count)
