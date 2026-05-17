---
sidebar_position: 3
---

# How to Run Event Day

Manage scoring, leaderboards, judges, and broadcasts during your competition.

## Prerequisites

- Competition with events created and divisions configured
- Heats scheduled (in-person) or submission windows open (online)
- Volunteers approved with the appropriate roles

## In-Person Score Entry

### Accessing Score Entry

1. Open your competition from **ORGANIZE**.
2. Click **Results** in the sidebar (under "Run Competition").

![Results page for an in-person competition](/img/how-to/organizers/organizer-results.png)

The Results page is the per-event grid where you (and any judges with score-input access) enter live scores.

### Score Entry Interface

The grid shows:

- **Event selector** — pick which event to score
- **Division filter** — narrow to RX, Scaled, etc.
- **Score format hint** — reminder of the expected input (Time, Reps, etc.)
- **Heat sections** — athletes grouped by their heat assignment

### Entering Scores

1. Pick the event from the dropdown.
2. Find the athlete in their heat row.
3. Type the score in the input field.
4. Scores **auto-save** as you type — the live "Parsed as: X" preview confirms how WODsmith reads your input (green = valid, red = error).

### Score Entry Formats

| Workout Type | Input | Examples |
| --- | --- | --- |
| For Time | mm:ss | `3:45`, `12:30`, `1:02:34.567` |
| AMRAP | rounds+reps | `8+15`, `12+0` |
| Max Weight | number | `225`, `185.5` |
| For Time (capped) | mm:ss or `cap` | `4:32`, `cap` (then enter reps completed) |

### Status Overrides

When an athlete didn't finish or was DQ'd, change the status dropdown next to the score:

- `dnf` — did not finish
- `dns` — did not start
- `dq` — disqualified
- `withdrawn` — pulled out
- `cap` — auto-set when input ≥ time cap

Terminal statuses collapse the score input — leave it blank.

## Online Submission Review

For **online competitions**, the Results sidebar item changes to **Submissions** and surfaces every video submission grouped by event:

![Submissions overview for an online competition](/img/how-to/organizers/organizer-online-results.png)

Each event row shows pending / reviewed / total counts and a progress bar. Click any event to see its submissions and open individual videos in the verification flow at `/compete/organizer/{competitionId}/events/{eventId}/submissions/{submissionId}`.

Sub-events nest under their parent event. The parent itself doesn't carry scores — scoring happens at the leaf level — but the parent card aggregates the child counts for at-a-glance progress.

You can delegate this work to volunteers — see [Managing Judges](#managing-judges-and-volunteers) below.

## The Public Leaderboard

Athletes and spectators see a live leaderboard on the public competition page:

![Public leaderboard with per-event scores](/img/how-to/athletes/athlete-leaderboard.png)

It updates in real time as judges submit or verify scores. Rankings recompute automatically.

For online competitions, scores **only appear once you publish the division** for that event. From the **Results** page, toggle each (event, division) pair from **Draft** to **Published** to release results progressively — for example, publish RX once all RX videos are reviewed without waiting on Scaled.

## Leaderboard Preview (organizer-only)

Before publishing, use the **Leaderboard Preview** sidebar link to see the full leaderboard *as if every score were published*. This includes:

- Scores on draft events
- Unpublished division results
- Every event as a column (no division filtering)

Use this to sanity-check the standings before flipping the public leaderboard. Cohosts with `leaderboardPreview` permission can see the preview too.

## Managing Judges and Volunteers

### The Volunteers Tab

1. Click **Volunteers** in the sidebar.
2. The page splits into four tabs: **Roster**, **Shifts**, **Judge Schedule**, **Registration Rules**.

![Volunteers page with the four tabs](/img/how-to/organizers/organizer-volunteers.png)

### Roster

The roster lists confirmed volunteers with their roles. From here you can:

- **Invite Volunteer** — send a direct invite via email
- **Copy Signup Link** — share a public signup URL
- **Approve / activate** applications
- **Grant score-input access** — the entitlement that unlocks the **Review** queue (online) or score-entry views (in-person) for that volunteer

A volunteer needs score-input access on the competition team to act as a judge.

### Judge Scheduling

The **Judge Schedule** tab is the rotation grid. You set:

- **Default Heats per Rotation** — how many heats before judges shift lanes
- **Lane Shift Pattern** — Stay, Shift Right, Random
- **Heat Buffer** — minimum heats between a judge's rotations
- **Per-judge overrides** — drag judges onto specific lane/heat cells

Click **Publish Rotations** when ready. Judges see their assignments on their **Schedule** view; they can't see them until you publish.

## Broadcasts During the Event

Broadcasts are the fastest way to reach all athletes, all volunteers, or just one division.

1. Click **Broadcasts** in the sidebar.
2. Compose: title, body, audience (all athletes / by division / volunteers / public), optional question filters.
3. **Preview recipient count** before sending.
4. Click **Send Broadcast**.

Athletes see broadcasts on their **Announcements** tab and (if email is enabled) in their inbox. Use these for floor-briefing reminders, schedule changes, score corrections, weather updates, and post-event awards announcements.

## Handling Ties

Default tiebreakers, in order:

1. Total points across events
2. Tiebreaker scores (per-event tiebreak field)
3. For multi-round capped workouts: fewer capped rounds wins
4. Earlier registration time (last resort)

Configure the per-event tiebreak field from the event detail page. Set it before scoring starts — backfilling tiebreakers across already-entered scores is messy.

---

*See also: [How to Manage Registrations](/how-to/organizers/manage-registrations) | [How to Schedule Heats](/how-to/organizers/schedule-heats) | [How to Send Broadcasts](/how-to/organizers/send-broadcasts)*
