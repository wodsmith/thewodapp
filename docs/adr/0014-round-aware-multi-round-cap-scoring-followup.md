---
status: proposed
date: 2026-05-23
decision-makers: [Zac Jones]
consulted: []
informed: []
---

# ADR-0014: Round-Aware Multi-Round Cap Scoring Follow-Up

## Context and Problem Statement

ADR-0010 fixed the first multi-round `time-with-cap` correctness problem, but the app still needs richer round-level truth so entry, display, audit, and penalties cannot drift apart.

The current implementation preserves summed multi-round totals, derives parent `cap` status when any round is capped, persists `scoreRoundsTable.status`, and sorts capped scores by `cappedRoundCount` before summed time. That is the right ranking direction, especially for the rule "fewer capped rounds beats more capped rounds."

The remaining gaps are now clear:

1. Per-round reps-at-cap are not captured. The app mostly infers cap state from encoded round time versus `timeCap`, so it cannot store "round 2 capped with 42 reps completed" as structured truth.
2. Public leaderboards show an aggregate score plus an `N/M cap` badge, but they do not show each round's score. Athletes still need to see how a total was built.
3. Verification audit logs snapshot parent score fields only. They cannot reconstruct old or new `scoreRoundsTable` rows, which means rollback/review can drop important data.
4. Multi-round penalties and direct adjustments can create contradictory displays when the parent total changes but round rows are preserved or handled separately.
5. `backfillMultiRoundCapScoresFn` can fall back to default `scoreType` when a workout is misconfigured, but the result does not make that risk visible enough to the caller.

This ADR is a follow-up to [ADR-0010](./0010-multi-round-time-cap-scoring.md). It does not replace the existing "capped scores sort below completed scores" rule; it makes the round-level data model honest enough for the current sorting and display rules to be applied consistently.

## Decision Drivers

- Each capped round must preserve its own reps-at-cap value, not just a parent status.
- Current cap-bucket ordering must be respected: fewer capped rounds ranks ahead of more capped rounds before summed total time.
- Public leaderboard displays must show both aggregate score and per-round breakdown so totals are explainable.
- Verification history must be complete enough to review and reconstruct what changed.
- Penalties and adjustments must keep parent totals, round rows, sort keys, and displays consistent.
- The follow-up should build on existing columns where possible: `scoreRoundsTable.status` and `scoreRoundsTable.secondaryValue` already exist.
- Backfills must be safe to preview and must report potentially dangerous assumptions.

## Decision Outcome

Adopt explicit per-round cap status and reps-at-cap capture while keeping current cap-count sorting.

Multi-round score-entry payloads will carry `status` and `secondaryScore` for each round. The app will persist those fields to `scoreRoundsTable.status` and `scoreRoundsTable.secondaryValue`, derive the parent `status`, `cappedRoundCount`, aggregate value, and `sortKey` from the stored rounds, fetch full round breakdowns for public leaderboards, snapshot round arrays in audit logs, and make penalties rewrite round rows before re-aggregating the parent.

The system will treat round rows as the durable source of truth for multi-round cap state. The parent score remains the aggregate used for leaderboard ranking and display, but its `status`, `cappedRoundCount`, and `sortKey` are derived from the round rows. Once a write path accepts explicit round status, it must not infer a multi-round cap from `encodedRound >= timeCap` except as a validation warning or rejection reason.

Sorting stays as currently shipped:

1. `status = "scored"` beats `status = "cap"`.
2. Within the `cap` bucket, fewer capped rounds beats more capped rounds.
3. When capped-round counts match, summed total time remains the next ordering signal unless a future ADR explicitly adds a reps-at-cap tiebreaker.

Per-round reps-at-cap are required for display and audit truth. They do not replace `cappedRoundCount` sorting.

### Consequences

- Good, because capped-round counts and reps-at-cap can both be represented without overloading one field.
- Good, because public leaderboards will explain aggregate scores instead of hiding round provenance behind a badge.
- Good, because score verification logs can reconstruct exactly what changed.
- Good, because penalties and adjustments must update round rows and parent totals through one consistent path.
- Neutral, because score-entry UIs need more controls for multi-round capped workouts.
- Bad, because the audit log schema likely needs either a child table or JSON snapshot fields.
- Bad, because public leaderboard payloads get larger when an event has multi-round scores.

### Non-Goals

- Do not change the rule that capped teams sort below fully completed teams.
- Do not replace `cappedRoundCount` ordering with summed reps-at-cap.
- Do not add per-round time-cap configuration. The workout's single `timeCap` still applies to every round.
- Do not run an automatic global historical migration. Backfills should be targeted and previewable.
- Do not redesign all scoring schemes. This ADR applies to multi-round `time-with-cap` scoring.

## Implementation Plan

### Round Entry Contract

Update every multi-round score-entry path to send round objects with explicit cap state:

```typescript
roundScores?: Array<{
  roundNumber: number
  score: string
  status: "scored" | "cap"
  secondaryScore: string | null
}>
```

For a capped round, `secondaryScore` is required and represents reps completed at cap. For a scored round, `secondaryScore` must be null. Payloads without `status` are not valid for multi-round `time-with-cap` writes after this ADR is implemented; compatibility with old clients should be handled by failing validation, not by silently falling back to cap inference.

Affected entry surfaces:

- `apps/wodsmith-start/src/components/organizer/results/use-score-row-state.ts`
- `apps/wodsmith-start/src/components/organizer/results/score-input-row.tsx`
- `apps/wodsmith-start/src/components/compete/video-submission-form.tsx`
- `apps/wodsmith-start/src/components/compete/enter-score-form.tsx`
- `apps/wodsmith-start/src/routes/compete/$slug/scores.tsx`
- `apps/wodsmith-start/src/routes/compete/cohost/$competitionId/results.tsx`
- `apps/wodsmith-start/src/routes/compete/$slug/review/$eventId/$submissionId.tsx`
- `apps/wodsmith-start/src/routes/compete/cohost/$competitionId/events/$eventId/submissions/$submissionId.tsx`
- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId.tsx`
- `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/results.tsx`
- `apps/wodsmith-start/src/routes/api/compete/scores/judge.ts`

The UI should expose a per-round cap control for multi-round `time-with-cap` workouts and a per-round reps-at-cap input when that round is capped. The existing aggregate preview should remain.

### Server Validation and Persistence

Extend server schemas to accept explicit round status and secondary score:

- `apps/wodsmith-start/src/server-fns/competition-score-fns.ts`
- `apps/wodsmith-start/src/server-fns/video-submission-fns.ts`
- `apps/wodsmith-start/src/server-fns/submission-verification-fns.ts`
- `apps/wodsmith-start/src/routes/api/compete/scores/judge.ts`

Validation requirements:

- Multi-round payloads must contain exactly the expected number of contiguous rounds when the path owns full score entry.
- `status === "cap"` requires a non-negative integer `secondaryScore`.
- `status === "scored"` requires `secondaryScore` to be absent/null.
- `roundNumber` must be unique and must match `1..roundsToScore` when the path owns full score entry.
- `score` must still encode successfully through the existing score helpers; status does not make an invalid score string acceptable.
- The server may warn or reject impossible combinations, but explicit round status is the source of truth once captured. Do not rely only on `encodedRound >= timeCap`.
- For multi-round `time-with-cap`, a scored round whose encoded value is greater than or equal to the cap is allowed only if the domain still treats "missed reps add seconds" as a valid completion encoding. If a path cannot distinguish that case, it must preserve the explicit `status` and record no `secondaryValue`.

Persistence requirements:

- Insert/update `scoreRoundsTable.status` for every round.
- Insert/update `scoreRoundsTable.secondaryValue` for every capped round and set it to `null` for every scored round.
- Derive parent `scoresTable.status = "cap"` when any round status is `"cap"`.
- Derive `cappedRoundCount` from round statuses and pass it to `computeSortKey`.
- Keep parent `scoreValue` as the aggregate of encoded round values using the workout's `scoreType`.
- Keep parent `secondaryValue` for legacy single-round caps only unless a future decision defines a parent-level multi-round secondary summary.
- Delete-and-reinsert round rows only when the replacement payload is complete and validated. Partial round rewrites must merge with existing rows before computing the parent.

### Public Leaderboard Display

Update `apps/wodsmith-start/src/server/competition-leaderboard.ts` so public leaderboard event results carry full round breakdowns, not only `{ cappedRoundCount, totalRoundCount }`.

Expected shape:

```typescript
rounds: Array<{
  roundNumber: number
  value: number
  formatted: string
  status: "scored" | "cap" | null
  secondaryValue: number | null
}>
```

`rounds` must be ordered by `roundNumber`. Use `decodeScore` / `formatScore` for each row using the parent score's scheme unless `schemeOverride` is present. Do not derive the displayed cap label from `value >= timeCap`; use the row's persisted `status`.

Render aggregate score first, then the round breakdown in:

- `apps/wodsmith-start/src/components/competition-leaderboard-table.tsx`
- `apps/wodsmith-start/src/components/online-competition-leaderboard-table.tsx`

The existing `N/M cap` badge may remain, but it is not enough by itself. A capped round should show both cap state and reps-at-cap, for example:

```text
24:32
R1: 9:00
R2: CAP (15:32, 42 reps)
```

### Audit Snapshots

Add full round snapshots to verification logs.

Preferred implementation: create a child table keyed to `scoreVerificationLogsTable.id` with old/new round snapshots, one row per round per side. If that is too heavy for the first pass, add JSON snapshot fields only with an explicit follow-up to normalize them.

Snapshot semantics:

- `verify` actions should snapshot the current round rows as both old and new, or snapshot them once with a side/action that unambiguously means "verified unchanged".
- `adjusted` actions must snapshot old rows before any delete/update and new rows after the replacement rows are computed.
- `invalid` actions must snapshot old rows and either snapshot an empty new array or explicit zeroed/new rows, matching whatever the invalid action actually persists.
- First-time manual score entry should snapshot `oldRounds = []` and `newRounds = inserted rows`.

Snapshot fields must preserve:

- `roundNumber`
- encoded `value`
- `status`
- `secondaryValue`
- `schemeOverride`
- `notes`

Affected code:

- `apps/wodsmith-start/src/db/schemas/scores.ts`
- generated score verification migrations under `apps/wodsmith-start/src/db/mysql-migrations/`
- `apps/wodsmith-start/src/server-fns/submission-verification-fns.ts`
- `apps/wodsmith-start/src/routes/compete/$slug/review/$eventId/$submissionId.tsx`
- `apps/wodsmith-start/src/routes/compete/cohost/$competitionId/events/$eventId/submissions/$submissionId.tsx`
- verification log display in `apps/wodsmith-start/src/routes/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId.tsx`

### Penalties and Adjustments

Multi-round penalties must be round-aware. Direct parent-only penalty writes are not acceptable for multi-round scores because they create contradictory displays.

Required behavior:

- A penalty against a multi-round score must produce replacement round rows, then re-aggregate the parent.
- Parent `scoreValue`, parent `status`, round statuses, per-round `secondaryValue`, `cappedRoundCount`, and `sortKey` must all be recomputed together.
- If the UI lets reviewers select which rounds receive a penalty, unselected rounds must be preserved exactly.
- If the UI applies a penalty to all rounds, the server still rewrites every round row and derives the parent from those rewritten rows.
- Direct adjustments without round inputs must be blocked for multi-round scores unless the request explicitly declares `clearRoundBreakdown: true` and the server deletes the existing `scoreRoundsTable` rows in the same transaction. They must not leave displays where parent total and round breakdown disagree.
- If a multi-round adjustment includes round inputs, it must include a complete validated replacement set. Do not accept a parent `adjustedScore` and a partial round set in the same request.

### Backfill Diagnostics

Extend `backfillMultiRoundCapScoresFn` to surface `scoreType` fallback risk. The function currently prefers workout `scoreType`, then score row `scoreType`, then `getDefaultScoreType("time-with-cap")`; the response must distinguish those cases.

The result should include:

```typescript
{
  scoreTypeScoreRowFallbackCount: number
  scoreTypeDefaultFallbackCount: number
  warnings: Array<{
    scoreId: string
    trackWorkoutId: string | null
    fallback: "score-row" | "default"
    message: string
  }>
}
```

`scoreTypeScoreRowFallbackCount` increments when the workout is missing `scoreType` and the score row supplies it. `scoreTypeDefaultFallbackCount` increments when both are missing and the default score type is used. When `dryRun` is true, warnings must be returned without writing changes. When `dryRun` is false, warnings should still be returned and logged.

### Documentation and Tests

Update `lat.md/domain.md#Domain Model#Scoring#Multi-round time caps`, `lat.md/domain.md#Domain Model#Video Submissions#Round Breakdown Display`, and `lat.md/domain.md#Domain Model#Video Submissions#Score Adjustments` after implementation.

Add or update tests for:

- Per-round cap status and reps-at-cap entry payloads.
- Server validation of capped round `secondaryScore`.
- Persistence of `scoreRoundsTable.status` and `secondaryValue`.
- Parent status derivation from explicit round statuses.
- `cappedRoundCount` sorting remains unchanged.
- Public leaderboard aggregate plus full round breakdown display.
- Audit snapshot creation for verify, adjust, invalid, and penalty flows.
- Multi-round penalties rewrite round rows and keep parent totals consistent.
- Direct multi-round adjustments without round rows are rejected unless they explicitly clear the breakdown.
- Backfill warning/result fields when `scoreType` falls back.

## Patterns to Follow

- Use existing zod validation in server functions.
- Use existing score helpers: `parseScore`, `encodeScore`, `encodeRounds`, `aggregateValues`, `decodeScore`, `formatScore`, `computeSortKey`, and `sortKeyToString`.
- Keep MySQL-compatible SQL in generated Drizzle migrations under `apps/wodsmith-start/src/db/mysql-migrations/`.
- Keep leaderboard sorting centralized through `computeSortKey` / `compareScores`; do not hand-roll sort logic in UI components.
- Keep single-round `time-with-cap` behavior compatible with existing parent `secondaryValue` semantics.

## Patterns to Avoid

- Do not infer cap state only from encoded value once explicit round status exists.
- Do not accept legacy multi-round `time-with-cap` payloads without per-round status after this ADR is implemented.
- Do not collapse round status into a parent checkbox.
- Do not store only parent-level audit snapshots for multi-round scores.
- Do not apply multi-round penalties by changing only `scoresTable.scoreValue`.
- Do not preserve existing round rows after changing a multi-round parent total unless the request also supplied the full replacement round set.
- Do not replace `cappedRoundCount` ordering with summed reps-at-cap.
- Do not ship public leaderboard round data without preserving the aggregate score.

## Verification

- [ ] Multi-round `time-with-cap` UIs let scorers mark each round as scored or capped.
- [ ] Capped rounds require reps-at-cap and persist it to `scoreRoundsTable.secondaryValue`.
- [ ] Parent `scoresTable.status` is `"cap"` when any explicit round status is `"cap"`.
- [ ] Parent `scoreValue` is still the aggregate of encoded round values.
- [ ] `computeSortKey` and `compareScores` still rank fewer capped rounds ahead of more capped rounds.
- [ ] Public leaderboards render aggregate score plus every round's formatted score.
- [ ] Public leaderboard capped rounds show cap state and reps-at-cap.
- [ ] Verification logs snapshot old and new round arrays for multi-round score changes.
- [ ] Multi-round penalties rewrite round rows and re-aggregate parent totals.
- [ ] Direct multi-round adjustments cannot leave parent totals and round breakdowns contradictory.
- [ ] Backfill dry runs and writes return `scoreTypeScoreRowFallbackCount`, `scoreTypeDefaultFallbackCount`, and per-score warnings.
- [ ] `lat check` passes after docs are updated.

## More Information

- [ADR-0010: Multi-Round Time Cap Scoring and Per-Round Leaderboard Display](./0010-multi-round-time-cap-scoring.md)
- `lat.md/domain.md#Domain Model#Scoring#Multi-round time caps`
- `lat.md/domain.md#Domain Model#Video Submissions#Round Breakdown Display`
- `lat.md/domain.md#Domain Model#Video Submissions#Score Adjustments`
- Conversation 2026-05-23: follow-up decision to capture per-round reps-at-cap, show public round breakdowns, snapshot full round audit state, make multi-round penalties round-aware, and return backfill fallback warnings.
