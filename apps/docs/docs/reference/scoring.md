---
sidebar_position: 2
---

# Scoring Rules Reference

Technical specifications for scoring, ranking, and tiebreaker calculations.

## Score Types

When configuring a competition event, you can specify how multiple sets/rounds are aggregated into a final score.

![Score Type Dropdown](/img/reference/scoring-score-type-dropdown.png)

| Score Type | Display Name | Description |
|------------|--------------|-------------|
| `none` | None | No aggregation, raw score used |
| `min` | Min (lowest single set wins) | Best (lowest) score across rounds |
| `max` | Max (highest single set wins) | Best (highest) score across rounds |
| `sum` | Sum (total across rounds) | Total of all round scores |
| `average` | Average (mean across rounds) | Mean of all round scores |

### When to Use Each Type

- **Min**: For Time workouts where lowest time wins
- **Max**: AMRAP, Max Reps, Max Load where highest wins
- **Sum**: Multi-round workouts where total matters
- **Average**: Normalized scoring across different round counts

## Tiebreak Schemes

When athletes have equal primary scores, the tiebreak scheme determines the winner.

![Tiebreak Dropdown](/img/reference/scoring-tiebreak-dropdown.png)

| Scheme | Description |
|--------|-------------|
| `none` | No tiebreaker (tied athletes share placement) |
| `time` | Time to reach a specific rep count or round |
| `reps` | Reps completed at a specific time checkpoint |

### Common Tiebreak Scenarios

| Workout Type | Primary Score | Tiebreak | Example |
|--------------|---------------|----------|---------|
| AMRAP | Rounds+Reps | Time | Time to complete last full round |
| For Time | Time | - | N/A (time is already precise) |
| Max Load | Weight | Fewer attempts | Athlete with fewer attempts at max weight wins |

## Score Entry Formats

![Score Entry for Time](/img/reference/scoring-results-entry.png)

### Time Format

```
MM:SS       # Minutes:Seconds (e.g., 3:45)
M:SS        # Single digit minutes (e.g., 8:42)
H:MM:SS     # Hours:Minutes:Seconds (e.g., 1:05:30)
SS          # Seconds only (e.g., 90 = 1:30)
```

Valid examples: `8:42`, `12:05`, `0:59`, `3:45.000`

### Rounds + Reps Format

```
R+r         # Rounds + Reps (e.g., 5+12)
R.r         # Alternative format (e.g., 5.12)
```

Valid examples: `5+12`, `10+0`, `7+15`

### Weight Format

```
NNN         # Whole number (e.g., 225)
NNN.N       # Decimal allowed (e.g., 102.5)
```

Note: Units (lbs/kg) are not entered with the score.

### Integer Scores

For reps, calories, points, meters, and feet:

```
NNN         # Whole number only (e.g., 150)
```

## Competition Ranking

### Points-Based Ranking

In competition mode, athletes receive placement points based on finish position per event. The overall ranking is determined by total points.

| Position | Points |
|----------|--------|
| 1st | 100 |
| 2nd | 95 |
| 3rd | 90 |
| 4th | 86 |
| 5th | 83 |
| 6th+ | 83 - (position - 5) |

Overall ranking = Sum of event points (highest total wins).

### Place-Based Ranking

Alternative system using simple placement points:

| Position | Points |
|----------|--------|
| 1st | 1 |
| 2nd | 2 |
| 3rd | 3 |
| nth | n |

Overall ranking = Sum of placements (lowest total wins).

### Points Multiplier

Competition events can have a **Points Multiplier** (100% = normal, 200% = 2x points) to weight certain events more heavily in overall standings.

![Event Edit with Points Multiplier](/img/reference/scoring-event-edit.png)

## Cap Scoring

When athletes don't complete a For Time workout within the time cap:

```
CAP + (remaining reps)
```

### Ranking Logic

- Athletes who finish beat all capped athletes
- Among capped athletes, fewer remaining reps = better finish
- Athletes with same remaining reps are tied

## Division Scoring

Each division maintains its own:
- Leaderboard
- Rankings
- Score comparisons

Athletes in different divisions (RX, Scaled, Masters, etc.) do not compete against each other for placement points.

## DNS/DNF/WD Status

| Status | Meaning | Ranking |
|--------|---------|---------|
| **DNS** | Did Not Start | Last in event (receives lowest possible points) |
| **DNF** | Did Not Finish | Below all finishers, above DNS |
| **WD** | Withdrawn | Removed from rankings entirely |

## Score Validation

The app validates scores based on the event's scheme:

| Scheme | Valid Format | Invalid |
|--------|--------------|---------|
| Time | 8:42, 12:05, 0:59, 90 | 8.42, 8-42 |
| Rounds+Reps | 5+12, 10+0, 5.12 | 5/12, 5:12 |
| Load | 225, 102.5 | 225lbs, 102.5kg |
| Reps/Points/etc. | 150, 50 | 150.5, -10 |

## Auto-Save Behavior

When entering results in the competition results screen:
- Scores auto-save as you type (after brief debounce)
- A "Saved" indicator appears next to each score
- Preview shows formatted score before saving

---

*See also: [Workout Types Reference](/reference/workout-types)*
