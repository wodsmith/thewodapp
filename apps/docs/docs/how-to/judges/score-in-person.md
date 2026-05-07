---
sidebar_position: 3
---

# How to Score In-Person Events

Enter live results for athletes during an in-person competition.

## Prerequisites

- Approved volunteer with **score-input** access on the in-person competition
- The competition is in-person type (online competitions use the [video review flow](/how-to/judges/review-submissions))
- Heat assignments are published (organizers do this from **Volunteers → Judge Schedule**)

## Where to Score

Organizers run scoring through the competition's **Results** page, which is also reachable on a tablet or phone via a deep link the organizer shares before the event:

- Per-event grid: `/compete/organizer/{competitionId}/results?event={eventId}`
- Mobile-optimized score entry: shared by the organizer on the day

If you only have score-input access (not full organizer access), you'll be redirected to a scoped score-entry view that only shows the event/heat you're assigned to.

## Score Entry Formats

Match the input format to the workout type — the field shows a live preview of how WODsmith will interpret your input.

| Workout Type | Format | Examples | Notes |
| --- | --- | --- | --- |
| **For Time** | `mm:ss` or `m:ss` | `3:45`, `12:30`, `1:02:34.567` | Bare digits (no colon) are read as raw seconds |
| **AMRAP** | `rounds+reps` | `8+15`, `12+0` | The `+0` is required if the athlete didn't break into a partial round |
| **Max Weight** | number | `225`, `185.5` | Lb or kg per the workout setting |
| **For Time (capped)** | mm:ss or `cap` | `4:32`, `cap` | If athlete hit the cap, enter the **reps completed** in the secondary field that appears |

The live "Parsed as: X" feedback turns green for valid inputs and red for invalid — fix red errors before submitting.

## Multi-Round Workouts

When `roundsToScore > 1` (e.g., a 3-round chipper), the form renders one input per round:

- Enter each round's time (or AMRAP score) separately
- WODsmith sums them server-side and derives per-round cap status
- The leaderboard tiebreaker honors "fewer capped rounds wins"

Don't sum manually — let WODsmith do it.

## Tiebreakers

Some workouts have a tiebreaker (e.g., "time at the end of round 2 of a 3-round AMRAP"). When present, an extra **Tiebreak Score** field appears using its own scheme:

- **Time tiebreak** — `M:SS.mmm` (e.g., `2:30.250`)
- **Reps tiebreak** — integer (e.g., `100`)

Always enter the tiebreaker — leaving it blank silently drops it on save.

## Status Overrides

If the athlete didn't complete the workout, use the **Status** dropdown:

| Status | Meaning |
| --- | --- |
| **scored** | Normal completion (this is the default) |
| **cap** | Hit the time cap (auto-set when input ≥ cap on capped workouts) |
| **dnf** | Did not finish — for partial AMRAP or capped time workouts |
| **dns** | Did not start — athlete was registered but didn't compete |
| **dq** | Disqualified — rule violation |
| **withdrawn** | Athlete withdrew before completing |

When you pick a terminal status (`dnf`, `dns`, `dq`, `withdrawn`), the score input collapses — leave it blank.

## Saving and Confirming

Scores **auto-save** as you type — there's no separate "submit" button. The save status shows next to the input:

- **Saved** — confirmed in the database
- **Saving…** — request in flight
- **Error** — something went wrong (most often a parse error or stale registration)

Always wait for **Saved** before moving to the next athlete. If you see **Error**, fix the issue or flag the organizer — don't skip past it.

## Common Mistakes

- **Bare digits on a time workout** — `2000` is read as **2000 seconds (33:20)**, not "20:00". Always include the colon for times.
- **Forgetting `+0` on AMRAP** — `12` alone is invalid for AMRAP; use `12+0`.
- **Editing across multiple divisions** — an athlete registered in two divisions for the same workout has *two separate scores*. Each one is scoped by division — make sure you're scoring the correct registration row.
- **Pre-filling the cap value** — for `time-with-cap` workouts, WODsmith auto-derives `cap` status when you enter a time ≥ the cap. Don't override the status manually.

## After the Heat

Once the heat is complete:

1. Verify all athletes in the heat have a **Saved** status
2. Flag any disputes to the organizer immediately — disputed scores are easier to resolve before the next heat starts
3. Move to your next assigned heat (the **Schedule** tab shows your rotation)

---

*See also: [How to Review Video Submissions](/how-to/judges/review-submissions) | [How to Apply a Penalty](/how-to/judges/apply-penalty)*
