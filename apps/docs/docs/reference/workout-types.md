---
sidebar_position: 1
---

# Workout Types Reference

Technical specifications for all workout schemes supported in WODsmith.

![Workout Scheme Dropdown](/img/reference/workout-scheme-dropdown.png)

## Available Workout Schemes

WODsmith supports the following workout schemes:

| Scheme          | Display Name          | Score Format       | Example        |
| --------------- | --------------------- | ------------------ | -------------- |
| `time`          | For Time              | mm:ss or m:ss      | 3:45, 12:30    |
| `time-with-cap` | For Time (with cap)   | mm:ss or CAP+reps  | 8:42 or CAP+15 |
| `rounds-reps`   | AMRAP (Rounds + Reps) | R+r                | 5+12, 10+0     |
| `reps`          | Max Reps              | Integer            | 150            |
| `load`          | Max Load              | lbs/kg             | 225            |
| `calories`      | Max Calories          | Integer            | 50             |
| `meters`        | Max Distance (meters) | Integer            | 1000           |
| `feet`          | Max Distance (feet)   | Integer            | 500            |
| `points`        | Points                | Integer            | 100            |
| `emom`          | EMOM                  | Completion or reps | -              |
| `pass-fail`     | Pass/Fail             | Pass or Fail       | -              |

## For Time

| Attribute      | Description                                  |
| -------------- | -------------------------------------------- |
| **Format**     | Complete prescribed work as fast as possible |
| **Scheme**     | `time`                                       |
| **Scoring**    | Time (MM:SS or M:SS)                         |
| **Tiebreaker** | Earlier finish                               |

### Score Input Format

```
3:45       # 3 minutes 45 seconds
12:30      # 12 minutes 30 seconds
1:05:30    # 1 hour 5 minutes 30 seconds
90         # Interpreted as 90 seconds (1:30)
```

## For Time (with cap)

| Attribute      | Description                                           |
| -------------- | ----------------------------------------------------- |
| **Format**     | Complete prescribed work with time limit              |
| **Scheme**     | `time-with-cap`                                       |
| **Scoring**    | Time or CAP+remaining reps                            |
| **Tiebreaker** | Earlier finish (timed), fewer remaining reps (capped) |

### Score Input Format

```
8:42       # Completed in 8:42
CAP+15     # Did not finish, 15 reps remaining
```

## AMRAP (As Many Rounds/Reps As Possible)

| Attribute      | Description                            |
| -------------- | -------------------------------------- |
| **Format**     | Timed workout with maximum repetitions |
| **Scheme**     | `rounds-reps`                          |
| **Scoring**    | Rounds + Reps (e.g., "5+12")           |
| **Tiebreaker** | Time to complete last full round       |

### Score Input Format

```
5+12       # 5 complete rounds plus 12 additional reps
10+0       # 10 complete rounds, no extra reps
5.12       # Alternative format (interpreted as 5+12)
```

![AMRAP Score Entry](/img/reference/scoring-amrap-entry.png)

## Max Reps

| Attribute    | Description                               |
| ------------ | ----------------------------------------- |
| **Format**   | Maximum repetitions in given time or sets |
| **Scheme**   | `reps`                                    |
| **Scoring**  | Total reps (integer)                      |
| **Use Case** | Tabata-style workouts, max effort sets    |

## Max Load (Strength)

| Attribute    | Description             |
| ------------ | ----------------------- |
| **Format**   | Heavy single or rep max |
| **Scheme**   | `load`                  |
| **Scoring**  | Weight in lbs or kg     |
| **Use Case** | 1RM tests, strength PRs |

### Common Formats

```
225        # 225 lbs
102.5      # 102.5 lbs (decimals allowed)
```

## EMOM (Every Minute On the Minute)

| Attribute   | Description                             |
| ----------- | --------------------------------------- |
| **Format**  | Prescribed work at start of each minute |
| **Scheme**  | `emom`                                  |
| **Scoring** | Completion status or total reps         |
| **Rest**    | Remainder of each minute                |

### Variants

- **Standard EMOM**: Same work every minute
- **Alternating EMOM**: Different work on odd/even minutes
- **E2MOM**: Every 2 minutes (still uses `emom` scheme)

## Distance-Based

### Meters

| Attribute    | Description                       |
| ------------ | --------------------------------- |
| **Format**   | Maximum distance in meters        |
| **Scheme**   | `meters`                          |
| **Scoring**  | Distance in meters                |
| **Use Case** | Row, run, or ski erg for distance |

### Feet

| Attribute    | Description                  |
| ------------ | ---------------------------- |
| **Format**   | Maximum distance in feet     |
| **Scheme**   | `feet`                       |
| **Scoring**  | Distance in feet             |
| **Use Case** | Handstand walks, sled pushes |

## Calories

| Attribute    | Description                               |
| ------------ | ----------------------------------------- |
| **Format**   | Maximum calories burned                   |
| **Scheme**   | `calories`                                |
| **Scoring**  | Calories (integer)                        |
| **Use Case** | Assault bike, rower, ski erg for calories |

## Points

| Attribute    | Description                              |
| ------------ | ---------------------------------------- |
| **Format**   | Point-based scoring                      |
| **Scheme**   | `points`                                 |
| **Scoring**  | Points (integer)                         |
| **Use Case** | Multi-modal scoring, judge-scored events |

## Pass/Fail

| Attribute    | Description                            |
| ------------ | -------------------------------------- |
| **Format**   | Binary completion status               |
| **Scheme**   | `pass-fail`                            |
| **Scoring**  | Pass or Fail                           |
| **Use Case** | Skill tests, minimum work requirements |

## Workout Styles vs Schemes

Note that some common workout terms describe _styles_ rather than scoring schemes:

| Term        | Description                                              | Typical Scheme                 |
| ----------- | -------------------------------------------------------- | ------------------------------ |
| **Chipper** | Sequential movements, complete all reps before moving on | `time` or `time-with-cap`      |
| **Ladder**  | Increasing/decreasing rep schemes (21-15-9, etc.)        | `time` or `time-with-cap`      |
| **Tabata**  | 20s work / 10s rest intervals                            | `reps` (lowest round or total) |
| **Pyramid** | Up-and-down rep scheme (1-2-3-4-3-2-1)                   | `time` or `rounds-reps`        |

These are programming styles that use the standard scoring schemes above.

---

_See also: [Scoring Rules Reference](/reference/scoring)_
