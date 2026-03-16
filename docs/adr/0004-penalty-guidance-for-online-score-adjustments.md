---
status: proposed
date: 2026-03-07
decision-makers: [Zac Jones]
consulted: []
informed: []
---

# ADR-0004: Penalty Guidance for Online Competition Score Adjustments

## Context and Problem Statement

Organizers reviewing video submissions for online competitions can now log timestamped review notes with per-movement no-rep tallies (ADR-0003). However, there is no structured path from "I've identified 12 no-reps on wall balls" to "here's the adjusted score." Organizers must mentally calculate penalty deductions and manually enter adjusted scores with no guardrails or industry guidance.

CrossFit's penalty framework is the de facto standard for competitive fitness — most competition organizers are familiar with it. Their system defines five scoring outcomes (good video, valid with penalty, zero score, invalid, score adjustment) and uses percentage-based deductions for rep-based workouts and per-movement time penalties for time-based workouts. Under the 2024 rulebook, penalties were split into minor (small number of no-reps, modest deduction) and major (significant no-reps, 15–40% deduction). The 2025 rulebook collapsed these into a single discretionary "with penalty" category.

We don't want to enforce CrossFit's rules, but we should make it easy for organizers to follow this mental model when deciding how to penalize a performance. The review notes no-rep tally provides the input; we need UI guidance and audit trail for the output.

Related code:
- `src/db/schemas/scores.ts` — `scoresTable`, `scoreVerificationLogsTable`
- `src/db/schemas/video-submissions.ts` — `reviewStatus` includes "penalized" (defined, not implemented)
- `src/server-fns/submission-verification-fns.ts` — `verifySubmissionScoreFn` (existing adjust flow)
- `src/db/schemas/review-notes.ts` — review notes with movement tagging (ADR-0003, in-flight)
- `$submissionId.tsx` — organizer review detail page

## Decision Drivers

* Organizers need guidance translating no-rep tallies into score adjustments, not just a blank "enter new score" field
* CrossFit's minor/major penalty framework is widely understood and provides a useful mental model
* The existing "adjust" verification flow already handles score overrides and audit logging — we should extend it, not replace it
* Penalty type (minor/major) and invalid status are first-class score classifications — visible to athletes and on leaderboards, not just internal organizer notes
* The audit trail must capture *why* a score was adjusted (penalty type, percentage applied, no-rep count) not just the before/after values
* Both rep-based (AMRAP) and time-based (for-time) workouts need penalty guidance, but the math differs

## Considered Options

* **Option A: Guided penalty UI on existing adjust flow** — Add penalty type (minor/major) and percentage to the verification log. Build UI that uses the no-rep tally to suggest severity, shows before/after preview, and lets organizer override. No new tables.
* **Option B: Fully manual penalty entry** — Keep the current "adjust" flow as-is. Organizer calculates and enters the new score themselves. (Status quo.)
* **Option C: Per-event penalty configuration tables** — New tables for organizers to configure per-movement time penalties and percentage thresholds per event. System auto-calculates penalties. Organizer approves.

## Decision Outcome

Chosen option: **"Option A: Guided penalty UI on existing adjust flow"**, because it provides meaningful guidance without over-engineering. The no-rep tally from review notes drives suggestions; the organizer retains full control. No new tables — just new columns on the existing verification log and UI guidance on the existing review page.

Option B is insufficient — organizers calculating 20% of 252 reps in their head leads to errors and inconsistency. Option C is over-engineered for our current needs — per-movement time penalty configuration adds complexity most organizers won't use, and we can always add it later if demand exists.

### Consequences

* Good, because organizers get CrossFit-aligned guidance without being forced into rigid rules
* Good, because the audit trail captures penalty reasoning (type + percentage), not just score deltas
* Good, because no new tables — extends existing patterns with minimal schema changes
* Good, because before/after preview prevents "oops" moments on penalty application
* Good, because `invalid` verification status cleanly handles the "zero the score" case (edited video, wrong equipment, egregious no-rep count) separately from percentage-based penalties
* Neutral, because per-movement time penalty configuration (Option C) is deferred — organizers doing time-based penalties must calculate the time addition themselves for now, but they get the same guidance UI for selecting severity

### Non-Goals

* **Per-event or per-movement penalty configuration** — No admin UI for setting "10 seconds per snatch no-rep." Organizers use the guidance + manual override.
* **Automated penalty calculation** — The system suggests, never auto-applies. Organizer always confirms.
* **Appeal tracking** — No appeal inventory system (CrossFit's 2-appeal limit). Future concern.
* **Multi-tier review escalation** — No L1/L2/L3 reviewer workflow. Single organizer reviews and decides.
* **Public/community video review** — No crowdsourced flagging. Organizer-only.
* **Live event real-time no-rep tracking** — Online video review only.

## Penalty Guidance Framework (from CrossFit)

The UI guidance is informed by CrossFit's documented penalty system. This is reference material for the organizer, not enforced logic.

### Five Scoring Outcomes

| Outcome | Description | Maps to |
|---------|-------------|---------|
| **Good Video** | All standards met, score stands | `verificationStatus: "verified"` |
| **Valid With Penalty** | No-reps identified, score adjusted with penalty | `verificationStatus: "adjusted"` + `penaltyType: "minor"/"major"` |
| **Score Adjustment** | Rep count corrected, no punitive deduction | `verificationStatus: "adjusted"` + `penaltyType: null` |
| **Invalid** | Egregious violations (edited video, wrong movement/weight, unacceptable no-rep count) — zeroes this workout only | `verificationStatus: "invalid"` (new) |
| **DQ** | Malicious intent to manipulate results — removes ALL scores | Score `status: "dq"` |

### Penalty Severity Guidance

**Minor penalty** — A small number of no-reps relative to total work. Discretionary deduction at organizer's judgment. Typical for 1–5 no-reps on a moderate-volume workout.

**Major penalty** — A significant number of no-reps. CrossFit's 2024 rulebook specified **15–40% deduction** of total reps (or equivalent time). Real-world examples:
- Pat Vellner: 252 → 202 reps (~20% deduction)
- Tia-Clair Toomey: 232 → 198 reps (~15% deduction)

**Invalid** — Wrong movements performed, wrong weight used, edited/manipulated video, or an unacceptable volume of no-reps making the performance non-comparable. Zeroes this workout only; other scores remain. Not a "penalty" — it's a determination that the submission cannot be scored.

### Penalty Math by Workout Type

**Rep-based (AMRAP, total reps):**
- Deduction = `totalReps × penaltyPercentage`
- Adjusted score = `totalReps - deduction` (rounded to nearest whole rep)

**Time-based (for-time):**
- CrossFit uses per-no-rep time additions that vary by movement (e.g., 10s per snatch no-rep, 5s per false start)
- For our MVP: organizer enters the time addition manually or uses the percentage slider to add equivalent percentage of their finish time
- Adjusted score = `originalTime + timeAddition`

## Implementation Plan

### Schema Changes

**`scoresTable`** — Add 3 columns (denormalized from verification log for leaderboard/athlete display):

```typescript
// Penalty classification: null = no penalty, "minor" | "major"
// Visible to athletes and on leaderboards. Updated on each subsequent adjustment.
penaltyType: varchar({ length: 20 }),

// The percentage deduction applied (0-100). Updated on each subsequent adjustment.
penaltyPercentage: int(),

// Total no-rep count from review notes. Updated on each subsequent adjustment.
noRepCount: int(),
```

**`scoresTable.verificationStatus`** — Add `"invalid"` as a new value:

```typescript
// null = unreviewed, "verified" = confirmed, "adjusted" = overridden, "invalid" = zeroed (new)
verificationStatus: varchar({ length: 20 }),
```

When `verificationStatus` is set to `"invalid"`, the `scoreValue` is set to 0 and the athlete ranks last for this workout but retains all other competition scores.

**`scoreVerificationLogsTable`** — Add 3 columns for audit trail:

```typescript
// Penalty classification at time of action
penaltyType: varchar({ length: 20 }),

// The percentage deduction applied (0-100)
penaltyPercentage: int(),

// Snapshot of no-rep count at time of penalty (from review notes tally)
noRepCount: int(),
```

**`scoreVerificationLogsTable.action`** — Add `"invalid"` as a new action value alongside existing `"verified"` | `"adjusted"`.

**`videoSubmissionsTable.reviewStatuses`** — Replace `"penalized"` with `"invalid"`:

```typescript
export const reviewStatuses = [
  "pending",
  "under_review",
  "verified",
  "adjusted",
  "penalized",
  "invalid",
] as const
```

No new tables.

### Server Function Changes

**`src/server-fns/submission-verification-fns.ts`**:

Extend `verifySubmissionScoreFn` (or create a sibling `applyPenaltyFn`) to accept:

```typescript
z.object({
  scoreId: z.string(),
  competitionId: z.string(),
  trackWorkoutId: z.string(),
  action: z.enum(["verified", "adjusted", "invalid"]),
  // For "adjusted" action with penalty:
  penaltyType: z.enum(["minor", "major"]).optional(),
  penaltyPercentage: z.number().min(0).max(100).optional(),
  noRepCount: z.number().int().min(0).optional(),
  // For "adjusted":
  newScoreValue: z.number().int().optional(),
  newStatus: z.string().optional(),
  newSecondaryValue: z.number().int().optional(),
  newTiebreakValue: z.number().int().optional(),
})
```

For `"invalid"` action: set `scoreValue` to 0 and `verificationStatus` to `"invalid"`. Athlete ranks last for this workout but retains all other competition scores.

For `"adjusted"` with `penaltyType`: set `scoresTable.penaltyType`, `penaltyPercentage`, and `noRepCount` — these are the source of truth for leaderboard and athlete score views. Updated on each subsequent adjustment.

Log `penaltyType`, `penaltyPercentage`, and `noRepCount` in `scoreVerificationLogsTable` for audit trail.

Set `videoSubmissionsTable.reviewStatus` to `"penalized"` (for penalty adjustments), `"adjusted"` (for non-penalty adjustments), or `"invalid"` accordingly.

### UI Changes

**`$submissionId.tsx`** — Extend the verification controls section:

1. **No-rep tally summary card** (data from review notes, grouped by movement):
   - Shows movement name + no-rep count badge for each movement with notes
   - Total no-rep count prominently displayed
   - This card already exists in ADR-0003's plan — we build the penalty guidance off it

2. **Penalty guidance banner** (appears when no-rep count > 0):
   - If total no-reps is low relative to workout volume → suggest "Minor Penalty"
   - If total no-reps is high → suggest "Major Penalty" with explanation
   - If wrong movement/weight noted → suggest "Invalid"
   - These are suggestions with explanatory text, not enforced thresholds
   - Organizer can ignore the suggestion entirely

3. **Penalty application controls** (when organizer selects "Apply Penalty"):
   - **Penalty type selector**: Minor / Major radio buttons
   - **For Minor**: free-form percentage or direct score entry
   - **For Major**: range slider constrained to 15–40%, with the percentage and resulting deduction displayed
   - **Before/after preview**: shows original score, deduction amount, and resulting score side-by-side
   - **Override input**: organizer can always type the desired final score directly, bypassing percentage calculation
   - Submit button applies the penalty
   - **Separate "Mark Invalid" action**: confirmation dialog explaining this zeroes the workout score only. Not a penalty — a determination that the submission cannot be scored.

4. **Penalty badge on submission list** — Update `submission-status-badge.tsx` to distinguish "penalized" (with minor/major) and "invalid"

5. **Leaderboard penalty indicator** — Wherever scores are displayed on the leaderboard, show a penalty type badge next to penalized scores (e.g., "202 reps · Major Penalty") or invalid scores (e.g., "0 · Invalid"). The `penaltyType` and `verificationStatus` columns on `scoresTable` make this a simple conditional render — no extra queries.

6. **Athlete score view** — Athletes see the full penalty breakdown on their score detail: original score → adjusted score, penalty type (minor/major), percentage deduction, and no-rep count. Example: "Original: 252 reps → Penalized: 202 reps (Major Penalty, 20% deduction, 12 no-reps)". This transparency matches CrossFit's practice of emailing athletes with original score, modified score, and stated reason.

### Affected Paths

- Modified: `src/db/schemas/scores.ts` (add `penaltyType`/`penaltyPercentage`/`noRepCount` to `scoresTable`, add columns + `"invalid"` action to `scoreVerificationLogsTable`, add `"invalid"` to `verificationStatus`)
- Modified: `src/db/schemas/video-submissions.ts` (add `"invalid"` to `reviewStatuses`)
- Modified: `src/server-fns/submission-verification-fns.ts` (extend verify/adjust to handle penalties)
- Modified: `src/routes/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId.tsx` (penalty guidance UI)
- Modified: `src/components/compete/submission-status-badge.tsx` (invalid status, penalty type display)

### Patterns to Follow

- Server functions in `src/server-fns/` using `createServerFn` with zod validation
- Permission checks via `requireTeamPermission` with `MANAGE_COMPETITIONS`
- Audit logging in `scoreVerificationLogsTable` for every action
- `useServerFn` hook for client-side calls
- `autochunk` for any `inArray` queries with dynamic arrays

### Patterns to Avoid

- Don't auto-apply penalties — always require organizer confirmation
- Don't enforce specific no-rep thresholds for minor vs major — guidance only
- Don't create new tables for penalty configuration
- Don't modify how the leaderboard sorts — penalties change the score value, leaderboard sorting remains unchanged
- Don't use `process.env` — use `env` from `cloudflare:workers`

## Verification

- [ ] Organizer can view no-rep tally summary on the submission review page
- [ ] System suggests minor/major/invalid based on no-rep count (guidance text, not enforced)
- [ ] Organizer can select "Major Penalty" and use a 15–40% range slider
- [ ] Before/after score preview updates live as percentage changes
- [ ] Organizer can override with a direct score entry
- [ ] Applying a penalty sets `reviewStatus` to "penalized" and populates `scoresTable.penaltyType`/`penaltyPercentage`/`noRepCount`
- [ ] `scoreVerificationLogsTable` records `penaltyType`, `penaltyPercentage`, and `noRepCount` as audit snapshot
- [ ] Subsequent adjustments update the denormalized fields on `scoresTable`
- [ ] Original score values are preserved in the verification log (existing behavior)
- [ ] "Invalid" action zeroes the workout score (`verificationStatus: "invalid"`) without DQ-ing from other events
- [ ] Submission status badge distinguishes penalized (minor/major) and invalid states
- [ ] Leaderboard shows penalty type indicator next to penalized scores
- [ ] Athletes can see their penalty type on their score detail
- [ ] `scoresTable.penaltyType` is set on penalty application (queryable without log join)
- [ ] Penalty math works for both rep-based (AMRAP) and time-based (for-time) scores

## More Information

- CrossFit Games Competition Rulebook, Section 1.22 (five scoring outcomes)
- 2024 Quarterfinals penalty crisis: 599 penalties administered, 73 athletes knocked outside qualifying cutlines
- 2025 rule change: minor/major collapsed into discretionary "with penalty"
- ADR-0003: Review notes with movement tagging (provides the no-rep input data)
