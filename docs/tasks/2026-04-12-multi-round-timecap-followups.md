# Multi-Round Time-Cap Scoring — Follow-Up Issues

**Date:** 2026-04-12
**Context:** Audit after shipping the initial fix for multi-round `time-with-cap` video submissions clamping the summed total to `timeCap * 1000` (commit `2324eee3`, branch `zac/multi-round-timecap`).
**Related:** [ADR-0010](../adr/0010-multi-round-time-cap-scoring.md)

The initial fix covers **only** the athlete video submission path (`submitVideoFn`) and adds a backfill. A thorough audit of the rest of the codebase turned up several additional issues that the live-comp fix didn't close. These are tracked here so they don't get lost.

---

## P0 — Ship before next live comp (or ASAP)

### #1 — `formatScore` hides the summed total for capped multi-round scores ✅ DONE

**File:** `apps/wodsmith-start/src/lib/scoring/format/score.ts:58–66`

`formatScore` with `status: "cap"` ignores `score.value` entirely. It returns bare `"CAP"` (or `"CAP (N reps)"` if `secondaryValue` is set). Because multi-round capped scores don't set `secondaryValue`, the leaderboard and the series leaderboard render them as just `"CAP"` — **the 41:00 summed total never reaches the screen**.

Visible impact: athlete-facing leaderboard + series leaderboard + any component that calls `formatScore({status: "cap", ...})`. Submission preview is unaffected (it uses the per-round breakdown rendered separately).

**Fix sketch:** when `status === "cap"` and `score.value !== null`, render `decodeScore(score.value, scheme) + " · Cap"` or similar. Preserve existing `"CAP (N reps)"` behavior for single-round with `secondaryValue`. Don't hide the real number.

**Severity:** P0 visible regression. Highest-leverage, smallest change.

---

### #2 — Same clamping bug still live in two other score-entry paths ✅ DONE

The fix in `submitVideoFn` was **not** propagated to these two entry points. Both unconditionally do `encodedValue = workout.timeCap * 1000` when status is `"cap"`, regardless of whether the score was multi-round:

1. **`apps/wodsmith-start/src/server-fns/competition-score-fns.ts:929–935`** — `saveCompetitionScoreFn`. Reached from the organizer in-person scoring UI. Also hardcodes `status: null` on round inserts at `:1088–1093`.
2. **`apps/wodsmith-start/src/routes/api/compete/scores/judge.ts:227–229`** — HTTP judge API. Same pattern.

**Fix sketch:** Copy the per-round cap derivation pattern from `submitVideoFn` (`video-submission-fns.ts:996–1041`). Persist per-round status to `scoreRoundsTable.status` in both insert loops.

**Severity:** P0. Any organizer or judge entering a multi-round capped score will reintroduce the exact bug the initial fix addressed.

---

### #3 — Organizer adjustment path re-clamps multi-round scores

**File:** `apps/wodsmith-start/src/server-fns/submission-verification-fns.ts:465–466`

```ts
if (newStatus === "cap" && score.timeCapMs) {
  encodedValue = score.timeCapMs
}
```

When an organizer adjusts a video-reviewed score to `"cap"` status, the handler clamps to `timeCapMs`. `adjustedScore` is also a single string — the adjust flow has no concept of rounds, so per-round statuses never get re-derived. Additionally, the transaction never touches `scoreRoundsTable`, so rounds go stale.

**Fix sketch (minimum viable):** if the score has `>1` rows in `scoreRoundsTable`, do NOT re-clamp `scoreValue` on adjust-to-cap — either pass through the encoded `adjustedScore` as-is or reject the adjust action and require a round-aware adjustment UI. Document the limitation.

**Fix sketch (proper):** extend the adjust input schema to accept `adjustedRoundScores` (array) for multi-round workouts, re-encode per round, re-derive parent status, delete+insert rounds, recompute sort key — mirroring `submitVideoFn`.

**Severity:** P0. Any post-submission adjustment will reintroduce the bug and orphan the round rows.

---

## P1 — After live comp

### #4 — Verification / invalidation leave orphan round rows

**Files:** `apps/wodsmith-start/src/server-fns/submission-verification-fns.ts` — verify, adjust, invalid, delete actions.

None of these actions delete, re-insert, or update `scoreRoundsTable` rows. Specifically:

- **Invalid** zeroes the parent `scoreValue` but leaves rounds intact.
- **Adjust** overwrites parent `scoreValue` but leaves old rounds.
- **Verify** doesn't touch rounds (expected, but round-level verification would be valuable).

Result: the submission preview card and athlete score view can show rounds that no longer match the parent `scoreValue`. The leaderboard total and per-round breakdown diverge.

**Fix sketch:** teach each action to delete stale rounds on `invalid`; teach `adjust` to rewrite rounds when `adjustedRoundScores` is provided (see #3); teach the athlete score view to hide the round breakdown entirely when the parent has been organizer-adjusted, falling back to the total only.

---

### #5 — Audit log doesn't capture per-round state

**File:** `apps/wodsmith-start/src/db/schemas/scores.ts` — `scoreVerificationLogsTable`

Snapshot columns (`originalScoreValue`, `originalStatus`, `originalSecondaryValue`, `originalTiebreakValue`) cover parent-level fields only. Per-round values are not captured anywhere in the audit trail. A rollback of an organizer adjustment to a multi-round score can restore the parent total but cannot reconstruct the original per-round breakdown.

**Fix sketch:** either add a JSON column `originalRoundScores text` on `scoreVerificationLogsTable`, or create a sibling `scoreRoundVerificationLogsTable` keyed by the parent log entry. Backfill is not required — only forward-looking audit trails need it.

---

### #6 — Penalty math is parent-only

**File:** `apps/wodsmith-start/src/server-fns/submission-verification-fns.ts` — penalty application.

`penaltyType`, `penaltyPercentage`, and `noRepCount` are stored on the parent row only. Penalty math applies to the summed total, not to individual rounds. For a time-with-cap multi-round score with one capped round and one clean round, a "20% major penalty" halving the summed time doesn't line up with any coherent per-round semantics — and the display then shows the adjusted parent alongside stale rounds.

**Fix sketch:** deferred until multi-round adjust (see #3) exists. At that point, penalty math should operate on rounds and re-aggregate the parent.

---

### #7 — Sort key cannot express "fewer caps wins" ✅ DONE

**File:** `apps/wodsmith-start/src/lib/scoring/sort/sort-key.ts:51–124`

Within the `cap` bucket, `computeSortKey` sorts by primary value (summed time ascending). The 40-bit secondary segment is currently unused for multi-round caps — every multi-round cap score gets `secondaryValue = 0 → normalizedSecondary = SEGMENT_MAX`, a constant.

This means two teams both capped on at least one round rank by total time only. The user's stated intent — "2 capped rounds should rank below 1 capped round" — is not expressible today. Both teams tie on status, differentiate on total, which is usually intuitive but not always what's wanted.

**Fix sketch:** in the video submit path, set parent `secondaryValue = numRounds - cappedRoundsCount` when status is `"cap"`. Higher = fewer caps = better. `sort-key.ts` already inverts and the cap-bucket comparison falls through primary → secondary → tiebreak, so this slot becomes meaningful. Update `backfillMultiRoundCapScoresFn` to populate the same field during the rescan.

---

### #8 — Backfill doesn't warn on `scoreType` fallback

**File:** `apps/wodsmith-start/src/server-fns/competition-score-fns.ts:1638–1641` (approximate; inside `backfillMultiRoundCapScoresFn`)

When `tw.scoreType` is null the backfill falls back to `getDefaultScoreType("time-with-cap")` = `"min"`. For a partner 2-round workout where the organizer meant `"sum"` but forgot to set it on the workout row, the backfill will silently compute `min(R1, R2)` — internally consistent with the config but not what the organizer intended.

**Fix sketch:** return a `scoreTypeFallbackCount` in the backfill result + log a warning per affected score. The safer pattern is to require the caller to pass an explicit `defaultScoreType` param and refuse to fall back.

**Severity:** P1 — only a risk if the backfill is run against a comp with mis-configured workouts.

---

## OK as-is (no action needed, documented for future reference)

- **`submitVideoFn`** — fix applied, persists per-round status, preserves summed total. ✓
- **`backfillMultiRoundCapScoresFn`** — correct scoping, idempotent, can't touch other competitions, safe to retry. ✓
- **Leaderboard ranking math** — `competition-leaderboard.ts` + scoring algorithms (traditional / p_score / custom) honor `STATUS_ORDER` via `sortKey`; capped scores correctly rank below scored ones. ✓
- **Series leaderboard** — uses the same pipeline; ranking correct. (Display regression is #1.)
- **`log-fns.ts`** — personal logs don't clamp and handle rounds cleanly. ✓
- **`athlete-score-fns.ts`, `api/compete/scores/submit.ts`, `api/compete/video/submit.ts`** — single-score only; multi-round not supported, so no active bug. Add the per-round cap logic whenever multi-round is wired into these paths.

---

## Test coverage gaps exposed by this audit

- No integration test covers multi-round `time-with-cap` save → read → leaderboard render.
- No test asserts `formatScore({status: "cap", value: N, secondaryValue: null})` returns anything containing `N`.
- No test for organizer `adjust` action against a multi-round score.
- No test for `scoreRoundsTable` cleanup after `invalid`/`adjust`/`delete` verification actions.

Add these alongside the respective fixes.
