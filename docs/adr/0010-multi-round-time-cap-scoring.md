---
status: proposed
date: 2026-04-12
decision-makers: [Zac Jones]
consulted: []
informed: []
---

# ADR-0010: Multi-Round Time Cap Scoring and Per-Round Leaderboard Display

## Context and Problem Statement

Partner and team divisions often run "split-round" workouts: e.g. workout 2 is a 2-round for-time event where partner 1 does round 1 and partner 2 does round 2, each round has its own 18-minute time cap, and the team's score is the **sum** of the two round times. The current scoring pipeline supports multi-round encoding but has two blind spots that make the leaderboard misleading and, in the worst case, wrong:

1. **Per-round cap state is lost.** `scoreRoundsTable` stores per-round `value` and has a nullable `status` column, but the submission path (`src/server-fns/competition-score-fns.ts`) hardcodes `status: null` on every round and carries a single `scoreStatus` on the parent score. A scorer cannot mark "round 1 capped at 18:00 + reps remaining, round 2 finished cleanly," so the overall score gets saved as `status: "scored"` and the aggregate time is sum-of-rounds — even if one round was capped.
2. **Rounds aren't displayed.** `competition-leaderboard.ts` only selects the aggregated `scoreValue` and formats it as a single total. Round times never reach `eventResults`, so athletes and organizers can't see how the total was built ("where did my 24:32 come from?").

The consequence is a ranking bug. Under the convention that every missed rep at cap adds 1 second to the round's encoded time, two teams can end up in the wrong order:

- **Team A**: both partners finish cleanly. Round 1 = 9:00, Round 2 = 9:00. Total = 18:00. Status = `scored`.
- **Team B**: partner 1 finishes fast (4:00), partner 2 gets capped at 10:00 with 2 missed reps → encoded as 10:02. Total = 14:02. Status = `scored` (because nothing in the pipeline knows a round was capped).

`compareScores` would rank Team B above Team A, even though Team B failed to complete the workout and Team A completed it. Per the user's rule — *any team that got capped on any round must sort below any team that completed all rounds* — this is incorrect.

The existing sort already honors this rule at the top level: `STATUS_ORDER` puts `cap` after `scored` (`src/lib/scoring/sort/compare.ts:28`). The fix is to make sure the overall score is marked `cap` whenever *any* round is capped, and to surface the per-round breakdown on displays.

Related code:
- `src/db/schemas/scores.ts` — `scoresTable`, `scoreRoundsTable` (already has `status`, `secondaryValue` columns per round)
- `src/server-fns/competition-score-fns.ts` — submission upsert + round insert (`:290` schema, `:1062` round handling)
- `src/components/organizer/results/score-input-row.tsx` / `use-score-row-state.ts` — multi-round entry UI
- `src/lib/scoring/aggregate/index.ts` — `aggregateValues` (no cap awareness)
- `src/lib/scoring/sort/compare.ts` + `sort-key.ts` — `STATUS_ORDER`-based sort (already correct given correct input)
- `src/server/competition-leaderboard.ts` — `fetchScores` and `eventResults` construction (no rounds join)
- `src/components/leaderboard-page-content.tsx` — leaderboard render
- `src/components/compete/athlete-score-submission.tsx` — athlete-facing score view

## Decision Drivers

- A team that failed to complete any round must sort below every team that completed all rounds, regardless of total encoded time
- Athletes and organizers need transparency: the total time plus each round's time, with capped rounds clearly flagged
- Per-round capture should round-trip — what the scorer enters for round 1 should be what's displayed for round 1
- Minimize schema churn: `scoreRoundsTable.status` and `scoreRoundsTable.secondaryValue` already exist
- The sort layer already works correctly given a correct top-level `status` — we should funnel truth *into* it rather than rewrite it
- Reps@cap must be captured per round (not just per score) because different rounds can cap with different remaining rep counts

## Considered Options

- **Option A: Per-round CAP capture at score entry (chosen).** Extend the round schema + UI so the scorer flags each round as `scored` or `cap` (and enters reps@cap when capped). Persist to `scoreRoundsTable.status`/`secondaryValue`. Derive the overall `scoresTable.status` as `"cap"` iff any round is `"cap"`. Join `scoreRoundsTable` in the leaderboard query and expose `rounds: [...]` in `eventResults`.
- **Option B: Infer cap from encoded time vs configured cap.** If a round's encoded value ≥ that round's configured `timeCap`, auto-mark the round (and overall score) as capped. Zero UI change.
- **Option C: Single aggregate cap flag, no per-round truth.** Add a single "workout was capped on some round" checkbox on the parent score. Still display the sum of round times in the existing slot.

## Decision Outcome

Chosen option: **"Option A: Per-round CAP capture at score entry"**, because it's the only option that gives correct ranking *and* honest display without heuristics that will misfire on legitimate edge cases.

Option B is rejected because the convention "each missed rep adds 1 second" means a legitimately completed round can encode to a time greater than the cap (e.g., 10:02 on a 10:00 cap is a valid completion). Inference from `value ≥ cap` produces false positives exactly in the situation that prompted this ADR.

Option C is rejected because it erases per-round granularity. The user's design intent is that partner 1's round 1 and partner 2's round 2 are visibly attributed — collapsing them into "capped somewhere" defeats the transparency goal. It also re-creates the same class of bug at a coarser level: we still can't show round 1's 4:00 next to round 2's CAP + 50 reps.

### Consequences

- Good, because the leaderboard correctly ranks capped teams below finishers under the existing `STATUS_ORDER` without modifying sort logic
- Good, because the total + per-round breakdown gives athletes and organizers visible provenance of every score
- Good, because reps@cap is captured *per round*, which matches reality for partner splits where different partners may cap at different points
- Good, because `scoreRoundsTable.status` and `secondaryValue` already exist — no new columns on the rounds table
- Good, because the sort layer and `computeSortKey` stay untouched; all correctness flows from a correct top-level `status`
- Neutral, because the scoring entry UI gets a new per-round CAP affordance (one more thing for scorers to click on capped rounds)
- Bad, because historical multi-round scores entered under the old flow won't have per-round statuses; they'll all read as `scored` regardless of whether a round was actually capped (mitigated by only showing the new breakdown for scores that have round-level status data)

### Non-Goals

- **Per-round time caps configured per workout.** Workouts currently carry a single `timeCap` field. This ADR assumes that single cap applies to each round; per-round cap configuration is a separate change.
- **Recomputing historical scores.** Existing multi-round scores stay as-is. We don't backfill per-round statuses.
- **Partner attribution.** We display "Round 1" and "Round 2" — we don't track *which* partner did which round. That's a future enhancement.
- **Changing the "missed reps as seconds" convention.** The penalty math for capped rounds stays the same; this ADR is about capturing *that a round was capped*, not changing how the number is computed.
- **Sort algorithm changes.** `STATUS_ORDER`, `compareScores`, and `computeSortKey` stay untouched.

## Implementation Plan

### Schema Changes

No new columns. `scoreRoundsTable` already has:

```typescript
// src/db/schemas/scores.ts
status: varchar({ length: 255 }),       // per-round status, will now be populated
secondaryValue: int(),                  // per-round reps@cap, will now be populated
```

We simply start using them. The parent `scoresTable.status` remains the top-level source of truth for sorting; per-round statuses are the source of truth for *whether* the top-level status should be `cap`.

### Score Entry (UI)

**`src/components/organizer/results/use-score-row-state.ts`** and **`score-input-row.tsx`**:

1. Extend the internal `RoundScoreState` to track per-round `status` and `secondaryScore`:
   ```typescript
   interface RoundScoreState {
     roundNumber: number
     score: string
     status: "scored" | "cap"
     secondaryScore: string   // reps@cap when status === "cap"
   }
   ```
2. Add a per-row "CAP" toggle next to each round input (only shown when `isTimeCapped` and `isMultiRound`). Toggling CAP:
   - Locks the round time input to the configured `timeCap` (or shows a CAP placeholder)
   - Reveals a secondary input for "reps at cap"
   - Marks that round's state `status: "cap"`
3. `getAggregateScore()` continues to sum round encoded values, but no longer determines the parent status. Derive parent status at submit time:
   ```typescript
   const anyCap = roundScores.some((r) => r.status === "cap")
   const newScoreStatus = anyCap ? "cap" : "scored"
   ```
4. Emit the richer round shape in `ScoreEntryData.roundScores`:
   ```typescript
   roundScores?: Array<{
     score: string
     status: "scored" | "cap"
     secondaryScore: string | null
   }>
   ```

**`src/components/compete/athlete-score-submission.tsx`** — same affordance for the athlete-submitted score path.

### Input Schema + Submit Path

**`src/server-fns/competition-score-fns.ts`**:

1. Extend `roundScoreSchema`:
   ```typescript
   const roundScoreSchema = z.object({
     score: z.string(),
     parts: z.tuple([z.string(), z.string()]).optional(),
     status: z.enum(["scored", "cap"]).default("scored"),
     secondaryScore: z.string().nullable().optional(),
   })
   ```
2. Before encoding, derive the top-level status from the rounds:
   ```typescript
   const anyRoundCapped =
     data.roundScores?.some((r) => r.status === "cap") ?? false
   const topLevelStatus = anyRoundCapped ? "cap" : mapToNewStatus(data.scoreStatus)
   ```
3. When any round is capped, the parent `scoreValue` is still the sum of encoded round values (including the per-round reps@cap → seconds penalty). That keeps tiebreaking within the `cap` bucket meaningful.
4. Populate a parent `secondaryValue` for the `cap` bucket's secondary sort. Sum of per-round `secondaryScore` is a reasonable default (higher total reps completed → better tiebreak), but this is a small design call; document it in code.
5. In the round insert loop, persist `status` and `secondaryValue` per round instead of hardcoding `status: null`:
   ```typescript
   return {
     scoreId: id,
     roundNumber: index + 1,
     value: roundValue,
     status: round.status,
     secondaryValue: round.status === "cap" ? parseInt(round.secondaryScore ?? "0", 10) : null,
   }
   ```
6. `computeSortKey` already handles `status: "cap"` + `timeCap.secondaryValue`. Pass the derived parent status and summed secondary.

### Leaderboard Query + Display

**`src/server/competition-leaderboard.ts`**:

1. In `fetchScores`, after the existing `scoresTable` select, fetch rounds for those score IDs:
   ```typescript
   const rounds = scoreIds.length > 0
     ? await db.select({
         scoreId: scoreRoundsTable.scoreId,
         roundNumber: scoreRoundsTable.roundNumber,
         value: scoreRoundsTable.value,
         status: scoreRoundsTable.status,
         secondaryValue: scoreRoundsTable.secondaryValue,
       })
       .from(scoreRoundsTable)
       .where(inArray(scoreRoundsTable.scoreId, scoreIds))
     : []
   ```
2. Group rounds by `scoreId` into a `Map<string, ScoreRoundRecord[]>` and attach to each score.
3. Extend `eventResults[]` with a `rounds` field:
   ```typescript
   rounds: Array<{
     roundNumber: number
     formatted: string       // decoded "9:00", "CAP + 50 reps", etc.
     status: "scored" | "cap" | null
     secondaryValue: number | null
   }>
   ```
4. When formatting, use the existing `decodeScore` / `formatScore` for each round value, and append a CAP indicator when `status === "cap"`.

**`src/components/leaderboard-page-content.tsx`** — Render the round breakdown under the total score cell:
```
24:32
  R1: 9:00
  R2: 15:32 CAP (+32 reps)
```
Only render the breakdown when `rounds.length > 0` so single-round workouts don't gain visual noise.

**`src/components/compete/athlete-score-submission.tsx`** and **`src/routes/compete/$slug/scores.tsx`** — Same treatment for athlete-facing score views.

### Affected Paths

- Modified: `src/db/schemas/scores.ts` — no schema change, but `scoreRoundsTable.status`/`secondaryValue` comments should document they are now populated
- Modified: `src/server-fns/competition-score-fns.ts` — round schema, status derivation, round insert, parent secondary calc
- Modified: `src/components/organizer/results/use-score-row-state.ts` — per-round status/secondary state
- Modified: `src/components/organizer/results/score-input-row.tsx` — CAP toggle + reps@cap input per round
- Modified: `src/components/compete/athlete-score-submission.tsx` — same UI on athlete submit path
- Modified: `src/server/competition-leaderboard.ts` — `fetchScores` joins rounds, `eventResults` carries `rounds[]`
- Modified: `src/components/leaderboard-page-content.tsx` — round breakdown render
- Modified: `src/routes/compete/$slug/scores.tsx` — round breakdown render
- Modified: `lat.md/domain.md#Scoring` — document multi-round cap semantics
- Added (tests): `src/lib/scoring/**` test coverage for parent-status derivation and one round capped

### Patterns to Follow

- Server functions in `src/server-fns/` using `createServerFn` with zod validation
- `requireTeamPermission` on organizer-facing score entry
- `computeSortKey` + `sortKeyToString` for the parent score; no new sort code
- `decodeScore` / `formatScore` for display; don't handroll formatters
- Only read `env` from `cloudflare:workers`
- MySQL syntax (`CAST(... AS UNSIGNED)`, not SQLite syntax)

### Patterns to Avoid

- Don't modify `compareScores` or `STATUS_ORDER` — the correctness already lives there
- Don't infer cap state from encoded value vs configured cap (rejected Option B)
- Don't collapse per-round statuses into a single parent checkbox (rejected Option C)
- Don't backfill historical scores — display only the new breakdown when round-level data exists
- Don't introduce a new "sum of times with cap penalty" scheme; continue using existing `time-with-cap` + `sum` aggregation

## Verification

- [ ] Scorer can mark any individual round as CAP in the multi-round input row and enter reps@cap for that round
- [ ] Saving with any round marked CAP persists `scoreRoundsTable.status = "cap"` and `secondaryValue = N` for that round
- [ ] Saving with any round marked CAP persists `scoresTable.status = "cap"` regardless of the summed encoded time
- [ ] Saving with all rounds `scored` persists `scoresTable.status = "scored"`
- [ ] Leaderboard ranks any team with `status = "cap"` below every team with `status = "scored"` (existing behavior, now correctly triggered)
- [ ] Test scenario: Team A (R1 9:00 + R2 9:00, both scored, total 18:00) ranks above Team B (R1 4:00 scored + R2 10:00 cap +2 reps, total 14:02)
- [ ] Leaderboard renders total time plus per-round times under it for multi-round workouts
- [ ] Per-round CAP indicator is visible next to capped round times ("R2: 15:32 CAP (+32 reps)")
- [ ] Single-round workouts show no round breakdown (no visual regression)
- [ ] Historical multi-round scores (no round status) display as before — total only, no breakdown
- [ ] Athlete-facing score view (`athlete-score-submission.tsx`, `scores.tsx`) shows the same breakdown
- [ ] Sort key computation still encodes `cap` status correctly (spot-check with `extractFromSortKey`)
- [ ] Tiebreaking within the `cap` bucket uses summed per-round reps@cap (higher = better)

## More Information

- `src/lib/scoring/sort/compare.ts:28` — `STATUS_ORDER`-based sort (already correct)
- `src/lib/scoring/sort/sort-key.ts` — `computeSortKey` handles `cap` + `timeCap.secondaryValue`
- Conversation 2026-04-12 — original bug report: Team B outranking Team A under the current behavior
- ADR-0004 — penalty framework (related but orthogonal: ADR-0004 is about organizer video review, this ADR is about live/entered score state)
