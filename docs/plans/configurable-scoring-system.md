# Configurable Competition Scoring System

> **Status:** Draft - Pending Team Review  
> **Author:** CoolRiver (Swarm Coordinator)  
> **Date:** 2026-01-01  
> **Epic:** configurable-scoring

## Executive Summary

Replace the current hard-coded competition scoring system with a configurable one that supports:
- **Multiple scoring algorithms**: Traditional (fixed step), P-Score (performance-based)
- **Custom scoring tables**: Organizers can create their own point distributions
- **Configurable tiebreakers**: Countback + optional head-to-head on designated event
- **Flexible DNF/DNS handling**: Configurable per scoring type

---

## Background

### Current State

The scoring system lives in `apps/wodsmith/src/server/competition-leaderboard.ts` with three modes:

```typescript
type ScoringSettings =
  | { type: "winner_takes_more" }         // Hard-coded array: [100, 85, 75, 67...]
  | { type: "even_spread" }               // Linear: 100 / (n-1) per place
  | { type: "fixed_step"; step: number }  // 100, 95, 90... (configurable step)
```

**Problems:**
1. `winner_takes_more` uses a hard-coded 28-element array - can't customize
2. No support for performance-based scoring (P-Score)
3. Tiebreakers are hard-coded (countback only)
4. DNF/DNS handling is implicit, not configurable

### Scoring Algorithms Requested

#### Traditional (Current Default)
- First place: 100 points
- Subsequent places: decrease by fixed step (default 5)
- Simple, predictable, placement-based

#### P-Score (Performance-Based)
- Rewards *margin of victory*, not just placement
- Formula based on best/median scores:
  - **Timed events**: `100 – (X – Best) × (50 / (Median – Best))`
  - **Reps/Load events**: `100 – (Best – X) × (50 / (Best – Median))`
- First place = 100, Median = 50, below median = negative possible
- Median calculated from **top half of field only**

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Config scope** | Competition-level | Simpler UX, can extend to division-level later |
| **Custom tables** | Template-based | Pick preset, override specific place→points mappings |
| **Event type for P-Score** | Infer from `scheme` | Already tracked: `time`/`time-with-cap` = ascending, others = descending |
| **Negative scores** | Allowed | True P-Score behavior - dramatic negatives are a feature |
| **Primary tiebreaker** | Countback | Most 1st places → 2nd places → etc. |
| **Secondary tiebreaker** | Head-to-head (optional) | Designate "final event" or specific event as decider |
| **DNF/DNS/WD** | Configurable | P-Score: based on worst actual performance |

---

## Technical Design

### 1. Schema Changes

#### New Type: `ScoringConfig`

```typescript
// apps/wodsmith/src/types/competitions.ts

type ScoringAlgorithm = 
  | "traditional"     // Fixed step (default: 5)
  | "p_score"         // Performance-based
  | "custom"          // Custom points table

type TiebreakerMethod =
  | "countback"       // Most 1st places → 2nd → etc.
  | "head_to_head"    // Compare placement in designated event
  | "none"            // Ties remain ties

interface ScoringConfig {
  algorithm: ScoringAlgorithm
  
  // Traditional settings
  traditional?: {
    step: number           // Points decrease per place (default: 5)
    firstPlacePoints: number // Usually 100
  }
  
  // P-Score settings  
  pScore?: {
    allowNegatives: boolean  // Default: true
    medianField: "top_half" | "all"  // Default: top_half
  }
  
  // Custom points table
  customTable?: {
    baseTemplate: "traditional" | "p_score" | "winner_takes_more"
    overrides: Record<number, number>  // place → points mapping
  }
  
  // Tiebreaker configuration
  tiebreaker: {
    primary: TiebreakerMethod    // Default: countback
    secondary?: TiebreakerMethod // Optional: head_to_head
    headToHeadEventId?: string   // If secondary is head_to_head
  }
  
  // Status handling
  statusHandling: {
    dnf: "worst_performance" | "zero" | "last_place"
    dns: "worst_performance" | "zero" | "exclude"
    withdrawn: "zero" | "exclude"
  }
}
```

#### Score Multiplier Integration

The existing `trackWorkouts.pointsMultiplier` field is preserved and works with all scoring algorithms. The multiplier applies **after** the scoring algorithm calculates base points:

```
Base Points (from algorithm) × (pointsMultiplier / 100) = Final Points
```

**Example with P-Score:**
- Athlete scores 85 P-Score points on an event
- Event has `pointsMultiplier: 50` (worth 50% of full points)
- Final points: `85 × 0.50 = 42.5 points`

**Two-part events:** Set each part's multiplier to 50 so both parts together equal one full event:
- Part A: `pointsMultiplier: 50`
- Part B: `pointsMultiplier: 50`
- Total: 100% of a normal event

#### Competition Settings

```typescript
interface CompetitionSettings {
  divisions?: { scalingGroupId: string }
  scoringConfig?: ScoringConfig
}
```

### 2. Scoring Library Updates

#### New File: `lib/scoring/algorithms/p-score.ts`

```typescript
interface PScoreInput {
  scores: Array<{
    userId: string
    value: number  // Normalized score value
    status: "scored" | "cap" | "dnf" | "dns" | "withdrawn"
  }>
  scheme: WorkoutScheme  // Determines sort direction
  config: ScoringConfig["pScore"]
}

interface PScoreResult {
  userId: string
  pScore: number  // Can be negative
  rank: number
}

// Memoized median calculation - same inputs = same median
const medianCache = new Map<string, { best: number; median: number }>()

function getMedianCacheKey(scores: number[], medianField: "top_half" | "all"): string {
  return `${scores.join(",")}:${medianField}`
}

function calculateBestAndMedian(
  sortedScores: number[],
  medianField: "top_half" | "all"
): { best: number; median: number } {
  const cacheKey = getMedianCacheKey(sortedScores, medianField)
  
  if (medianCache.has(cacheKey)) {
    return medianCache.get(cacheKey)!
  }
  
  const best = sortedScores[0]
  const medianPool = medianField === "top_half" 
    ? sortedScores.slice(0, Math.ceil(sortedScores.length / 2))
    : sortedScores
  const median = medianPool[Math.floor(medianPool.length / 2)]
  
  const result = { best, median }
  medianCache.set(cacheKey, result)
  return result
}

function calculatePScore(input: PScoreInput): PScoreResult[] {
  // 1. Filter to scored entries, sort by performance
  // 2. Calculate best and median (memoized)
  // 3. Apply formula based on scheme direction
  // 4. Handle DNF/DNS per config
  // 5. Return with ranks
}

export function clearPScoreCache(): void {
  medianCache.clear()
}
```

#### Updated: `lib/scoring/algorithms/index.ts`

```typescript
// Request-scoped memoization cache
// Key: hash of (eventId, scoringConfig)
const pointsCache = new Map<string, Map<string, number>>()

function getCacheKey(eventId: string, config: ScoringConfig): string {
  return `${eventId}:${JSON.stringify(config)}`
}

export function calculateEventPoints(
  eventId: string,
  scores: EventScore[],
  config: ScoringConfig,
  athleteCount: number,
  cache: Map<string, Map<string, number>> = pointsCache
): Map<string, number> {
  const cacheKey = getCacheKey(eventId, config)
  
  // Return cached result if available
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!
  }
  
  let result: Map<string, number>
  switch (config.algorithm) {
    case "traditional":
      result = calculateTraditionalPoints(scores, config.traditional, athleteCount)
      break
    case "p_score":
      result = calculatePScorePoints(scores, config.pScore)
      break
    case "custom":
      result = calculateCustomPoints(scores, config.customTable, athleteCount)
      break
  }
  
  // Cache and return
  cache.set(cacheKey, result)
  return result
}

// Clear cache at end of request (called by request handler)
export function clearScoringCache(): void {
  pointsCache.clear()
}
```

### 3. Leaderboard Calculation Updates

#### File: `server/competition-leaderboard.ts`

```typescript
// Updated getCompetitionLeaderboard()

async function getCompetitionLeaderboard(competitionId: string) {
  const competition = await getCompetition(competitionId)
  const scoringConfig = resolveScoringConfig(competition.settings)
  
  // ... existing event/score fetching ...
  
  // Per-event scoring
  for (const event of events) {
    const eventScores = scores.filter(s => s.competitionEventId === event.id)
    const points = calculateEventPoints(eventScores, scoringConfig, athleteCount)
    
    // Apply multiplier
    for (const [userId, basePoints] of points) {
      const multipliedPoints = Math.round(basePoints * (event.pointsMultiplier / 100))
      totals.get(userId).push({ eventId: event.id, points: multipliedPoints })
    }
  }
  
  // Overall ranking with configurable tiebreaker
  return rankOverall(totals, scoringConfig.tiebreaker)
}

function rankOverall(
  totals: Map<string, EventPoints[]>,
  tiebreakerConfig: ScoringConfig["tiebreaker"]
): LeaderboardEntry[] {
  // 1. Sum points per athlete
  // 2. Sort by total descending
  // 3. Apply primary tiebreaker (countback)
  // 4. If still tied and secondary exists, apply head-to-head
  // 5. Assign final ranks
}
```

### 4. UI Components

#### New: Scoring Configuration Form

```
┌─────────────────────────────────────────────────────────────┐
│ Scoring Configuration                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Scoring Algorithm:                                          │
│ ○ Traditional (placement-based)                             │
│   └─ Step: [5] points between places                        │
│                                                             │
│ ○ P-Score (performance-based)                               │
│   └─ ☑ Allow negative scores                                │
│   └─ Median calculated from: [Top half of field ▾]          │
│                                                             │
│ ○ Custom                                                    │
│   └─ Based on: [Traditional ▾]                              │
│   └─ [Edit Points Table...]                                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Tiebreakers                                                 │
│                                                             │
│ Primary: Countback (most 1st places, then 2nd, etc.)        │
│                                                             │
│ Secondary (if still tied):                                  │
│ ○ None (allow ties)                                         │
│ ○ Head-to-head on final event                               │
│ ○ Head-to-head on specific event: [Event 5 ▾]               │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ DNF/DNS Handling                                            │
│                                                             │
│ DNF (Did Not Finish): [Worst performance ▾]                 │
│ DNS (Did Not Start):  [Zero points ▾]                       │
│ Withdrawn:            [Exclude from ranking ▾]              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### New: Custom Points Table Editor

```
┌─────────────────────────────────────────────────────────────┐
│ Custom Points Table                                         │
│ Based on: Traditional (step=5)                              │
├─────────────────────────────────────────────────────────────┤
│ Place │ Default │ Custom │                                  │
│───────┼─────────┼────────┤                                  │
│   1   │   100   │ [100]  │                                  │
│   2   │    95   │ [ 95]  │                                  │
│   3   │    90   │ [ 90]  │                                  │
│   4   │    85   │ [ 80]  │ ← Modified                       │
│   5   │    80   │ [ 70]  │ ← Modified                       │
│  ...  │   ...   │  ...   │                                  │
│  20+  │    5    │ [  1]  │                                  │
├─────────────────────────────────────────────────────────────┤
│ Preview: 1st=100, 2nd=95, 3rd=90, 4th=80, 5th=70...         │
│                                                             │
│ [Reset to Default]                    [Save]                │
└─────────────────────────────────────────────────────────────┘
```

#### Updated: Leaderboard Display

- Show scoring algorithm badge: `[P-Score]` or `[Traditional]`
- For P-Score: show per-event P-Score values (can be negative, colored red)
- Tooltip explaining scoring method on hover

---

## Implementation Plan

### Phase 1: Core Scoring Library (Foundation)
**Files:** `lib/scoring/algorithms/`

1. Create P-Score algorithm implementation
2. Create scoring algorithm factory/registry
3. Add comprehensive unit tests for all algorithms
4. Ensure backward compatibility with existing `calculatePoints()`

**Dependencies:** None  
**Estimated effort:** 2-3 hours

### Phase 2: Schema & Type Updates
**Files:** `types/competitions.ts`

1. Define new `ScoringConfig` type
2. Update `CompetitionSettings` interface
3. Add Zod schemas for validation

**Dependencies:** Phase 1  
**Estimated effort:** 1-2 hours

### Phase 3: Leaderboard Calculation
**Files:** `server/competition-leaderboard.ts`

1. Integrate new scoring algorithms
2. Implement configurable tiebreaker logic
3. Handle DNF/DNS per config
4. Update existing tests, add new ones

**Dependencies:** Phase 1, Phase 2  
**Estimated effort:** 3-4 hours

### Phase 4: UI - Scoring Configuration
**Files:** `components/compete/scoring-config-form.tsx`

1. Build scoring algorithm selector
2. Build tiebreaker configuration UI
3. Build DNF/DNS handling options
4. Integration with competition settings form

**Dependencies:** Phase 2  
**Estimated effort:** 3-4 hours

### Phase 5: UI - Custom Points Table
**Files:** `components/compete/custom-points-editor.tsx`

1. Template selection
2. Points table editor with preview
3. Validation (no gaps, reasonable values)
4. Save/reset functionality

**Dependencies:** Phase 4  
**Estimated effort:** 2-3 hours

### Phase 6: Leaderboard Display Updates
**Files:** `components/compete/competition-leaderboard-table.tsx`

1. Show scoring algorithm indicator
2. Display negative P-Scores correctly (red, with sign)
3. Add scoring method tooltip/explainer
4. Update any hardcoded assumptions

**Dependencies:** Phase 3  
**Estimated effort:** 1-2 hours

### Phase 7: Integration Testing & Documentation
1. E2E tests for full scoring flows
2. Test migration from legacy settings
3. Update organizer documentation
4. Add scoring explainer content for athletes

**Dependencies:** All phases  
**Estimated effort:** 2-3 hours

---

## Task Breakdown (Cells)

| ID | Title | Type | Priority | Dependencies | Files |
|----|-------|------|----------|--------------|-------|
| 1 | Implement P-Score algorithm | task | P0 | - | `lib/scoring/algorithms/p-score.ts` |
| 2 | Create scoring algorithm factory | task | P0 | - | `lib/scoring/algorithms/index.ts` |
| 3 | Add scoring algorithm unit tests | task | P0 | 1, 2 | `test/lib/scoring/` |
| 4 | Define ScoringConfig types | task | P1 | - | `types/competitions.ts` |
| 5 | Add ScoringConfig Zod schemas | task | P1 | 4 | `schemas/competitions.ts` |
| 6 | Integrate algorithms in leaderboard | task | P1 | 1, 2, 4 | `server/competition-leaderboard.ts` |
| 7 | Implement configurable tiebreakers | task | P1 | 6 | `server/competition-leaderboard.ts` |
| 8 | Add leaderboard calculation tests | task | P1 | 6, 7 | `test/server/` |
| 9 | Build scoring config form component | task | P2 | 4, 5 | `components/compete/` |
| 10 | Build custom points table editor | task | P2 | 9 | `components/compete/` |
| 11 | Update leaderboard display for P-Score | task | P2 | 6 | `components/compete/` |
| 12 | E2E tests for scoring flows | task | P2 | all | `e2e/` |
| 13 | Update organizer documentation | chore | P3 | all | `docs/` |

---

## Implementation Notes

### Clean Implementation

This is a **new implementation**, not a migration. There is no legacy scoring data to migrate - we're building the configurable system from scratch.

**Default behavior:** New competitions default to `{ algorithm: "traditional", traditional: { step: 5 } }` unless the organizer explicitly configures a different scoring method.

---

## Scalability & Future Considerations

### Current Approach (MVP)

- Calculate leaderboard on-demand per request
- Acceptable performance for competitions up to ~500 athletes
- Simple, no cache invalidation complexity
- **Request-scoped memoization** for scoring calculations:
  - Memoize `calculateEventPoints()` - cache results per (eventId, scoringConfig hash)
  - Memoize P-Score median calculation - same inputs = same median
  - Use simple Map-based memoization (lives for duration of request, not persistent)
  - Low overhead, prevents redundant calculations within a single request

### Future Optimizations

When scaling becomes a concern, the architecture supports these enhancements:

1. **Leaderboard Caching**
   - Cache computed leaderboard results
   - Invalidate on score changes (new score submission, score edit, score deletion)
   - TTL-based expiry as fallback

2. **CDN Caching for Public Leaderboards**
   - Public competition leaderboards can be edge-cached
   - Invalidate via cache tags when scores update
   - Significantly reduces compute for high-traffic events

3. **Persistent Memoization** (if request-scoped isn't sufficient)
   - Upgrade from Map-based to Redis or D1-backed cache
   - Persist across requests for frequently-accessed leaderboards
   - Event scores rarely change once submitted

The current implementation should be designed with these future optimizations in mind - avoid tightly coupling calculation with rendering, ensure score mutations have clear hooks for cache invalidation.

---

## Open Questions

1. **P-Score display precision**: Should we show 1 decimal (768.8) or round to integers?
   - **Recommendation**: 1 decimal for per-event, integers for totals

2. **Maximum custom table size**: How many places should we support?
   - **Recommendation**: 100 places (covers large competitions)

3. **Negative score floor**: Should there be a minimum (e.g., -1000)?
   - **Recommendation**: No floor - let P-Score be P-Score

4. **Historical data**: Should changing scoring retroactively recalculate?
   - **Recommendation**: Yes, leaderboard always reflects current settings

---

## Success Criteria

- [ ] P-Score produces correct results matching reference spreadsheets
- [ ] Existing competitions unaffected (backward compatible)
- [ ] Organizers can switch between Traditional/P-Score without data loss
- [ ] Custom tables can replicate both built-in algorithms
- [ ] Tiebreakers resolve correctly per configuration
- [ ] DNF/DNS handling matches configured behavior
- [ ] Leaderboard displays negative scores correctly
- [ ] Unit test coverage >90% for scoring algorithms
- [ ] E2E test covers full competition lifecycle with each scoring type

---

## References

- [P-Score at Rogue Invitational (Men)](https://thebarbellspin.com/competition/how-p-score-would-have-changed-the-mens-leaderboard-at-rogue-invitational/)
- [P-Score at CrossFit Games](https://thebarbellspin.com/crossfit-games/the-crossfit-games-did-not-find-the-fittest-on-earth/)
- [P-Score Spreadsheet Examples](https://docs.google.com/spreadsheets/d/1jVjdvT6Qr0P7ij1p0KcIeNh4-HEZyu3sGV7BcQ7z-Xw/)
- Current implementation: `apps/wodsmith/src/server/competition-leaderboard.ts`
