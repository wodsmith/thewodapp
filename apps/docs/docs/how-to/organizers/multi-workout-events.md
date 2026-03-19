---
sidebar_position: 5
---

# How to Create Multi-Workout Events

Group several sub-events under one parent event. Athletes complete all sub-events within the same heat, and points from each sub-event contribute to the overall leaderboard.

Common examples:
- **Rowing Triathlon** — 2K Row, 500m Sprint, Max Cal Row
- **Snatch Ladder + Lifting** — Timed snatch ladder, then a three-lift total
- **Sprint Series** — A fast couplet followed by a max effort deadlift

## Prerequisites

- Competition created with at least one division
- Familiarity with adding standalone events

## Create the parent event

1. Open your competition from **ORGANIZE**
2. Click **Events** in the sidebar
3. Click **Add Event** and select **Create New**
4. Give the parent event a name that describes the overall challenge (e.g., "Rowing Triathlon")
5. Add a description explaining what athletes will face across all sub-events
6. Save the event

The scoring scheme on the parent doesn't matter — scoring is configured per sub-event.

## Add sub-events

1. On the events list, find your parent event and click the **+ Sub-Event** button
2. Create or select the workout for the first sub-event
3. Configure its scoring scheme, score type, and tiebreaker independently
4. Repeat for each sub-event under this parent

Sub-events appear indented beneath their parent in the events list. Each sub-event has its own:
- Scoring scheme (for time, max reps, max load, etc.)
- Score type (min, max, sum, average)
- Tiebreaker rules
- Points multiplier
- Division-specific scaling descriptions

## Configure points multipliers

By default, every sub-event is worth 1x points (multiplier = 100). To weight a sub-event differently:

1. Click the edit icon on the sub-event row
2. Set the **Points Multiplier** — e.g., 200 for 2x points on a finals-style lift
3. Save

Athletes earn separate placement points for each sub-event. The leaderboard aggregates points across all sub-events of a parent.

## Schedule heats

Heats are scheduled on the **parent event**, not on individual sub-events. Athletes complete all sub-events within their assigned heat.

1. Go to the **Schedule** tab
2. Find the parent event in the event list (sub-events are not shown here)
3. Create heats and assign athletes to lanes as you would for a standalone event
4. Each heat covers the full parent event — athletes move through all sub-events in sequence

For detailed heat scheduling steps, see [How to Schedule Heats](/how-to/organizers/schedule-heats).

## Enter results

Results are entered **per sub-event**, but athletes are grouped by the parent event's heats.

1. Go to the **Results** tab
2. Select the parent event from the dropdown
3. You'll see tabs for each sub-event
4. Switch between sub-event tabs to enter scores — each tab shows the same athletes (from the parent's heats) with the sub-event's scoring scheme
5. The leaderboard automatically aggregates points across all sub-events

For detailed score entry steps, see [How to Run Event Day](/how-to/organizers/event-day).

## Edit a parent event

1. Click the edit icon on the parent event row in the events list
2. The edit page shows the **Parent Event Settings** card at the top and tabbed sub-events below
3. Switch between sub-event tabs to edit each one — the **Save Changes** button saves whichever tab is active
4. To edit the parent name or description, scroll to the Parent Event Settings card

## Reorder sub-events

Drag sub-events within their parent group to reorder them. The order determines how they appear in the results tabs and on the athlete-facing leaderboard.

Sub-events cannot be dragged outside their parent group or reordered across parent boundaries.

## Remove a sub-event or parent

- **Removing a sub-event** deletes it and reorders the remaining siblings automatically
- **Removing a parent event** deletes the parent and all its sub-events

## Limitations

- Sub-events can only be one level deep — you cannot nest a sub-event under another sub-event
- A sub-event must belong to a parent within the same competition
- Parent events do not have scores of their own — only sub-events are scored

---

*See also: [How to Schedule Heats](/how-to/organizers/schedule-heats) · [How to Run Event Day](/how-to/organizers/event-day)*
