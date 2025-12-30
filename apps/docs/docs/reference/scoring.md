---
sidebar_position: 2
---

# Scoring Rules Reference

Technical specifications for scoring, ranking, and tiebreaker calculations.

## Score Types

| Type | Format | Used For |
|------|--------|----------|
| **Time** | mm:ss.ms | For Time workouts |
| **Rounds+Reps** | R+r | AMRAPs |
| **Reps** | Integer | Tabata, max reps |
| **Weight** | lbs/kg | Strength, 1RM |
| **Points** | Integer | Competition rankings |

## Competition Ranking

### Points-Based Ranking

Athletes receive points based on finish position per event:

| Position | Points |
|----------|--------|
| 1st | 100 |
| 2nd | 95 |
| 3rd | 90 |
| 4th | 86 |
| 5th | 83 |
| 6th+ | 83 - (position - 5) |

Overall ranking = Sum of event points (lowest total wins).

### Place-Based Ranking

Alternative system using placement points:

| Position | Points |
|----------|--------|
| 1st | 1 |
| 2nd | 2 |
| 3rd | 3 |
| nth | n |

Overall ranking = Sum of placements (lowest total wins).

## Tiebreaker Rules

When athletes have equal scores/points:

### Within Event

1. **For Time**: Earlier finish wins
2. **AMRAP**: Time to complete last full round
3. **Strength**: Fewer attempts at max weight

### Overall Competition

1. **Head-to-head**: More event wins
2. **Best finish**: Better best event placement
3. **Most recent**: Latest event placement

## Cap Scoring

When athletes don't complete within time cap:

```
CAP + (reps remaining)
```

### Calculation

- Total required reps minus completed reps
- Higher remaining reps = worse finish
- Athletes who finish beat all capped athletes

## Scaled Division Scoring

Scaled athletes:
- Compete within their division only
- Use same scoring rules as RX
- Separate leaderboard

## Score Validation

Valid score formats:

| Type | Valid | Invalid |
|------|-------|---------|
| Time | 8:42, 12:05, 0:59 | 8.42, 8-42 |
| Rounds | 5+12, 10+0 | 5.12, 5/12 |
| Weight | 225, 102.5 | 225lbs |

## DNS/DNF/WD Status

| Status | Meaning | Ranking |
|--------|---------|---------|
| **DNS** | Did Not Start | Last in event |
| **DNF** | Did Not Finish | Below all finishers |
| **WD** | Withdrawn | Removed from rankings |

---

*See also: [Workout Types Reference](/reference/workout-types)*
