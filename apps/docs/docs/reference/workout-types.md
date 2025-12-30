---
sidebar_position: 1
---

# Workout Types Reference

Technical specifications for all workout formats supported in WodSmith.

## AMRAP (As Many Rounds/Reps As Possible)

| Attribute | Description |
|-----------|-------------|
| **Format** | Timed workout with maximum repetitions |
| **Time Cap** | Required, 1-60 minutes |
| **Scoring** | Rounds + Reps (e.g., "5+12") |
| **Tiebreaker** | Time to complete last full round |

### Score Format

```
ROUNDS+REPS
```

Example: `5+12` = 5 complete rounds plus 12 additional reps

## For Time

| Attribute | Description |
|-----------|-------------|
| **Format** | Complete prescribed work as fast as possible |
| **Time Cap** | Optional but recommended |
| **Scoring** | Time (mm:ss) or CAP+(reps remaining) |
| **Tiebreaker** | Earlier finish |

### Score Format

```
mm:ss        # Completed under cap
CAP+REPS     # Did not finish
```

Example: `8:42` or `CAP+15`

## EMOM (Every Minute On the Minute)

| Attribute | Description |
|-----------|-------------|
| **Format** | Prescribed work at start of each minute |
| **Duration** | Total minutes |
| **Scoring** | Completed/Not Completed, or total reps |
| **Rest** | Remainder of each minute |

### Variants

- **Standard EMOM**: Same work every minute
- **Alternating EMOM**: Different work on odd/even minutes
- **E2MOM**: Every 2 minutes

## Tabata

| Attribute | Description |
|-----------|-------------|
| **Format** | 20 seconds work / 10 seconds rest |
| **Rounds** | Typically 8 rounds (4 minutes total) |
| **Scoring** | Lowest round or total reps |
| **Standard** | Tabata protocol (8 × 20s/10s) |

## Strength

| Attribute | Description |
|-----------|-------------|
| **Format** | Sets × Reps at prescribed intensity |
| **Rest** | Between sets (typically 2-3 minutes) |
| **Scoring** | Max weight, total volume, or completion |

### Common Formats

```
5x5 @ 80%      # 5 sets of 5 reps at 80% 1RM
3x10 @ moderate # 3 sets of 10 at moderate weight
5RM            # Find 5 rep max
```

## Chipper

| Attribute | Description |
|-----------|-------------|
| **Format** | Sequential movements, high reps |
| **Scoring** | Time or CAP+reps |
| **Structure** | Complete all reps of one movement before next |

## Ladder

| Attribute | Description |
|-----------|-------------|
| **Format** | Increasing or decreasing rep schemes |
| **Scoring** | Time or rounds completed |
| **Variants** | Ascending, descending, or pyramid |

### Common Patterns

```
21-15-9        # Descending
1-2-3-4-5...   # Ascending
1-2-3-4-5-4-3-2-1  # Pyramid
```

## Custom

| Attribute | Description |
|-----------|-------------|
| **Format** | User-defined structure |
| **Scoring** | Configurable |
| **Use Case** | Non-standard workout formats |

---

*See also: [Scoring Rules Reference](/reference/scoring)*
