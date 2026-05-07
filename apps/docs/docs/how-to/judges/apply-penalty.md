---
sidebar_position: 4
---

# How to Apply a Penalty

Adjust an athlete's score for a no-rep, missed standard, or other infraction caught during video review.

## Prerequisites

- Score-input access on the competition
- An open submission with status **Pending** or **Under Review**

## When to Penalize vs Adjust vs Invalidate

WODsmith gives reviewers three ways to change a score:

| Action | Use when | Effect |
| --- | --- | --- |
| **Adjust** | You want to overwrite the score with a specific value | Sets `scoreValue` directly (status: Adjusted) |
| **Penalize** | You want to apply a percentage hit (e.g., −5% per no-rep) | Scales the score; status: Penalized |
| **Invalid** | The submission can't be scored at all (wrong workout, can't see the athlete, etc.) | Removes the score from rankings; status: Invalid |

Pick the lightest tool that fits the infraction. Most no-reps are best handled with a percentage penalty rather than a manual override — it's auditable and reversible.

## Applying a Percentage Penalty

1. Open the submission's review page (see [Review Video Submissions](/how-to/judges/review-submissions)).
2. In the score section, click **Apply Penalty**.
3. Pick **Penalty Type** — typically `percentage`.
4. Enter the **Penalty %** (e.g., `5` for a 5% time addition or rep deduction).
5. For multi-round submissions, the form shows one checkbox per round (all checked by default). Uncheck rounds the penalty *shouldn't* apply to.
6. Review the **Before / After** preview line for each round.
7. Click **Verify with Penalty**.

The server re-derives:

- Per-round status (a previously-uncapped round may flip to `cap` after the time penalty)
- Parent aggregate (total time, total reps)
- Capped round count (used as the leaderboard tiebreaker)
- Sort key

The athlete's leaderboard entry updates to show the new value with a "Penalized" badge.

## Adjusting a Single Round

For multi-round submissions where only one round had an issue:

1. Click the **Edit** action on that round's input.
2. Override the round's time or reps directly.
3. Save.

WODsmith treats this as an **Adjust** (not a penalty) and re-aggregates the parent score.

## Direct Score Override

For single-round submissions where you want to set the final score outright:

1. Edit the **Final Score** field.
2. Save with status **Adjusted**.

Use this sparingly — penalties are easier to audit because they record both the original and the percentage applied.

## Invalidating a Submission

When the video doesn't show the workout (wrong event, athlete not visible, hopelessly broken video link):

1. Open the submission's review page.
2. Set **Status** to **Invalid**.
3. Add a note explaining why (this is shown to the athlete).
4. Click **Mark as Reviewed**.

The score is dropped from rankings. The athlete can re-upload a corrected video if the submission window is still open — invalid submissions don't permanently lock them out.

## Reversing a Penalty

Penalties and adjustments are reversible:

1. Reopen the submission.
2. Click **Reset to Submitted Score** (or change the status back to **Pending**).
3. Save.

The original athlete-submitted score is restored. The audit trail records both the penalty and the reversal.

## Penalty Audit Trail

Every penalty captures:

- Reviewer identity (who applied it)
- Original score
- Penalty type and percentage
- Affected rounds (for multi-round)
- Resulting score
- Timestamp

This is visible to organizers from the submission page and to athletes via the score's status badge. The trail makes it easy to defend a contested score in writing.

---

*See also: [How to Review Video Submissions](/how-to/judges/review-submissions)*
