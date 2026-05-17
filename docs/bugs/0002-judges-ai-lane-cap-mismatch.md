# 0002 — AI judge scheduler: lane cap mismatch with occupied lanes

## Symptom

On the AI judge-scheduling page for "Winter Throwdown 2025" → "Fran"
(`tw_winter_event1_fran`), the coverage card reports `0 / 20` even though the
visible grid only shows 3 heats × 5 lanes. The agent loops:

1. Proposes 5 valid rotations covering lanes 1–5 for heats 1–3.
2. Coverage check reports "70% covered, 6 gaps" — gaps include lane 5 of heat
   3 and lanes 6–11 of heat 3.
3. Agent tries to fill those gaps with `startingLane = 6, 7, 8, 9, 10, 11`.
4. `propose_rotation` hard-rejects each one with
   "Starting lane N exceeds heat 3's lane count (5)."
5. Agent retries, eventually gives up or burns step budget.

## Root cause

Two data sources disagree about how wide heat 3 is:

```
heat_number  venue_id  venue.lane_count  occupied_lanes
1            NULL      NULL              1,2,3,4,5
2            NULL      NULL              1,2,3,4,5
3            NULL      NULL              1,2,3,4,6,7,8,9,10,11
```

- `competitionHeatsTable.venue_id` is NULL for all three heats of this
  workout, so the context loader at
  `apps/wodsmith-start/src/server/judge-scheduler/context.ts:101`
  falls back to `getCompetitionFallbackLaneCount(competitionId)`, which returns
  5 (max across the competition's venues, or default).
- `competitionHeatAssignmentsTable` has 10 athletes in heat 3 with lane
  numbers 1, 2, 3, 4, 6, 7, 8, 9, 10, 11 — there's a real gap at lane 5 and
  athletes assigned past the fallback lane count.

The `EventContextDto` returned to the agent therefore has
`{ laneCount: 5, occupiedLanes: [1,2,3,4,6,7,8,9,10,11] }` for heat 3.

Downstream code is inconsistent about which one wins:

- `apps/wodsmith-start/src/lib/judge-rotation-utils.ts:153` (used by
  `calculateCoverage` / `computeCoverageFromProposals`) **prefers
  occupiedLanes when present** — that's where `totalSlots = 20` comes from.
- `apps/wodsmith-start/src/lib/judge-scheduler/tools.ts:62` (used by
  `validateProposal`) **only checks `heat.laneCount`** — so lanes 6–11 get
  rejected even though those slots count toward coverage.

Result: the agent is told to fill 20 slots but is structurally forbidden from
filling 6 of them, so it cannot finish.

## Fix options

### 1. Make validation respect occupied lanes (recommended — small)

Update `validateProposal` in
`apps/wodsmith-start/src/lib/judge-scheduler/tools.ts:58` to use the same
"prefer occupiedLanes when present" rule as coverage:

```ts
const effectiveCap =
  heat.occupiedLanes.length > 0
    ? Math.max(...heat.occupiedLanes)
    : heat.laneCount
if (proposal.startingLane > effectiveCap) { ... }
```

Or, stricter and probably better: hard-reject when the proposal targets a
heat,lane pair that isn't actually a slot the coverage report tracks. That
also prevents the agent from proposing the missing lane 5 of heat 3 (no
athlete there → no slot to judge).

### 2. Fix the demo data

`tw_winter_event1_fran` heats should either:

- Have a `venue_id` pointing to a venue with `lane_count >= 11`, or
- Have their `competition_heat_assignments` reseeded to lanes 1–5 so the
  data lines up with the implied 5-lane venue.

This is a demo-only issue (Winter Throwdown 2025 on the `demo` branch), but
the underlying mismatch could happen in any competition where heats are
created without a venue.

### 3. UI: extend the coverage grid

The coverage grid in
`apps/wodsmith-start/src/routes/compete/organizer/$competitionId/judges-ai.tsx`
currently caps lane columns at the venue/fallback `laneCount`. It should
follow the same `max(laneCount, occupiedLanes)` rule so organizers can see
the actual slots and the gaps the agent is trying to fill.

## Recommended sequence

1. Apply option 1 so the agent can complete on the existing demo data.
2. Fix the demo data (option 2) so the UI and agent stop disagreeing.
3. Address option 3 separately — the grid will then accurately reflect the
   coverage report regardless of data shape.
