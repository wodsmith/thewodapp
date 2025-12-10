# Scoring Library Guide

This guide shows you how to implement workout scoring in the Wodsmith UI using the scoring library at `@/lib/scoring`.

## Quick Reference

```typescript
import {
  // Parsing user input
  parseScore,
  parseTiebreak,
  
  // Encoding for database
  encodeScore,
  encodeRounds,
  computeSortKey,
  
  // Decoding for display
  decodeScore,
  formatScore,
  formatRounds,
  formatScoreWithTiebreak,
  
  // Sorting
  compareScores,
  sortScores,
  
  // Types
  type Score,
  type ScoreInput,
  type WorkoutScheme,
} from "@/lib/scoring"
```

---

## How to Parse User Input

When a user enters a score in an input field, use `parseScore()` to validate and normalize it.

### Time Input (Smart Parsing)

Users don't need to type colons. The parser handles various formats:

```typescript
const result = parseScore("1234", "time")
// { isValid: true, encoded: 754000, formatted: "12:34" }

const result2 = parseScore("12:34.567", "time")
// { isValid: true, encoded: 754567, formatted: "12:34.567" }
```

### Rounds + Reps Input

Require explicit `+` separator for rounds and reps:

```typescript
const result = parseScore("5+12", "rounds-reps")
// { isValid: true, encoded: 500012, formatted: "5+12" }

// Plain number = complete rounds
const result2 = parseScore("5", "rounds-reps")
// { isValid: true, encoded: 500000, formatted: "5+0", warnings: ["Interpreted as complete rounds"] }
```

**UI Tip**: Use two separate input fields for rounds and reps, then combine them:

```typescript
const combined = repsInput ? `${roundsInput}+${repsInput}` : roundsInput
const result = parseScore(combined, "rounds-reps")
```

### Load Input

```typescript
const result = parseScore("225", "load", { unit: "lbs" })
// { isValid: true, encoded: 102058, formatted: "225" }

const result2 = parseScore("100", "load", { unit: "kg" })
// { isValid: true, encoded: 100000, formatted: "100" }
```

### Handling Parse Errors

```typescript
const result = parseScore(userInput, scheme)

if (!result.isValid) {
  // Show error to user
  setError(result.error) // e.g., "Invalid time format"
  return
}

// Use the encoded value
const encodedValue = result.encoded
const displayValue = result.formatted
```

---

## How to Handle Multi-Round Workouts

For workouts like "10x3 Back Squat" or "3 Rounds For Time":

```typescript
import { encodeRounds, formatRounds } from "@/lib/scoring"

// Collect round inputs from UI
const rounds = [
  { raw: "225" },
  { raw: "235" },
  { raw: "245" },
]

// Encode all rounds with aggregation
const result = encodeRounds(rounds, "load", "max", { unit: "lbs" })
// result.rounds = [102058, 106594, 111130]  // Individual encoded values
// result.aggregated = 111130                 // Max value (best lift)

// Format for display
const scoreRounds = result.rounds.map((value, i) => ({
  roundNumber: i + 1,
  value,
}))
const displayStrings = formatRounds(scoreRounds, "load", { 
  weightUnit: "lbs", 
  includeUnit: true 
})
// ["225 lbs", "235 lbs", "245 lbs"]
```

### Score Type Options

The `scoreType` parameter determines how rounds are aggregated:

| Score Type | Use Case | Example |
|------------|----------|---------|
| `"max"` | Best round (default for load, reps) | Heaviest lift in 10x3 |
| `"min"` | Best round (default for time) | Fastest split time |
| `"sum"` | Total | Combined time for 3 rounds |
| `"average"` | Average | Average split time |
| `"first"` | First attempt only | First lift in a complex |
| `"last"` | Last attempt only | Final sprint |

---

## How to Handle Time-Capped Workouts

Time-capped workouts have two possible outcomes:
1. **Finished**: Athlete completes under the cap
2. **Capped**: Athlete hits the time cap with partial work

### Finished Under Cap

```typescript
const score: Score = {
  scheme: "time-with-cap",
  scoreType: "min",
  value: 754000, // 12:34 finish time
  status: "scored",
  timeCap: {
    ms: 900000, // 15:00 cap
    secondaryScheme: "reps",
    secondaryValue: 0,
  },
}

formatScore(score) // "12:34"
```

### Hit the Time Cap

```typescript
const score: Score = {
  scheme: "time-with-cap",
  scoreType: "min",
  value: null, // No finish time
  status: "cap",
  timeCap: {
    ms: 900000, // 15:00 cap
    secondaryScheme: "reps",
    secondaryValue: 142, // Reps completed when capped
  },
}

formatScore(score) // "CAP (142 reps)"
formatScore(score, { showStatus: false }) // "142 reps"
```

### UI Implementation

```tsx
function ScoreInput({ workout }) {
  const [finished, setFinished] = useState(true)
  const [timeInput, setTimeInput] = useState("")
  const [repsInput, setRepsInput] = useState("")
  
  const handleSubmit = () => {
    if (finished) {
      const result = parseScore(timeInput, "time-with-cap")
      // Save with status: "scored", value: result.encoded
    } else {
      const reps = parseInt(repsInput, 10)
      // Save with status: "cap", value: null, secondaryValue: reps
    }
  }
  
  return (
    <div>
      <Toggle value={finished} onChange={setFinished} labels={["Finished", "CAP"]} />
      {finished ? (
        <TimeInput value={timeInput} onChange={setTimeInput} />
      ) : (
        <NumberInput label="Reps completed" value={repsInput} onChange={setRepsInput} />
      )}
    </div>
  )
}
```

---

## How to Handle Tiebreaks

Tiebreaks resolve ties when primary scores are equal.

### AMRAP with Time Tiebreak

```typescript
const score: Score = {
  scheme: "rounds-reps",
  scoreType: "max",
  value: 500012, // 5+12
  status: "scored",
  tiebreak: {
    scheme: "time",
    value: 510000, // Time to complete round 5 (8:30)
  },
}

formatScoreWithTiebreak(score) // "5+12 (TB: 8:30)"
```

### For Time with Reps Tiebreak

```typescript
const score: Score = {
  scheme: "time",
  scoreType: "min",
  value: 754000, // 12:34
  status: "scored",
  tiebreak: {
    scheme: "reps",
    value: 150, // Reps at a checkpoint
  },
}

formatScoreWithTiebreak(score) // "12:34 (TB: 150)"
```

### Parsing Tiebreak Input

```typescript
const tiebreakResult = parseTiebreak("830", "time")
// { isValid: true, encoded: 510000, formatted: "8:30" }

const tiebreakResult2 = parseTiebreak("150", "reps")
// { isValid: true, encoded: 150, formatted: "150" }
```

---

## How to Sort and Rank Scores

### Sorting an Array of Scores

```typescript
import { sortScores, compareScores } from "@/lib/scoring"

const scores: Score[] = [/* ... */]

// Sort in place
sortScores(scores)

// Or use with Array.sort()
scores.sort(compareScores)
```

### Sorting Rules

1. **Status order**: scored → cap → dq → withdrawn
2. **Primary value**: Based on scheme (lower time is better, higher reps is better)
3. **Secondary value**: For capped scores, higher reps/rounds is better
4. **Tiebreak**: When primary scores are equal

### Computing Sort Keys for Database

Store a sort key for efficient database queries:

```typescript
import { computeSortKey } from "@/lib/scoring"

const sortKey = computeSortKey(score)
// Returns bigint that encodes status + normalized value

// Store as string in D1/SQLite (TEXT column)
const sortKeyString = sortKey.toString()
```

### Finding Rank

```typescript
import { findRank } from "@/lib/scoring"

const athleteScore: Score = { /* ... */ }
const allScores: Score[] = [/* ... */]

const rank = findRank(athleteScore, allScores) // 1-indexed rank
```

---

## How to Display Scores

### Basic Display

```typescript
import { decodeScore, formatScore } from "@/lib/scoring"

// From encoded value
const display = decodeScore(754567, "time") // "12:34.567"

// From Score object (handles status, tiebreaks, etc.)
const display = formatScore(score) // "12:34.567" or "CAP (142 reps)"
```

### With Units

```typescript
// Load
decodeScore(102058, "load", { weightUnit: "lbs", includeUnit: true })
// "225 lbs"

decodeScore(102058, "load", { weightUnit: "kg", includeUnit: true })
// "100 kg"

// Distance
decodeScore(5000000, "meters", { includeUnit: true })
// "5000m"

// Reps/Calories/Points
decodeScore(150, "reps", { includeUnit: true })
// "150 reps"
```

### Compact vs Full Display

```typescript
// Full (shows ms if present)
decodeScore(754567, "time") // "12:34.567"

// Compact (hides .000 ms)
decodeScore(754000, "time") // "12:34"
```

---

## How to Save Scores to the Database

### Preparing Score Data

```typescript
import { encodeScore, computeSortKey, type ScoreStatusNew } from "@/lib/scoring"
import { scoresTable, scoreRoundsTable } from "@/db/schema"

// Single score
const scoreValue = encodeScore(userInput, workout.scheme, { unit: "lbs" })
const sortKey = computeSortKey({
  value: scoreValue,
  status: "scored",
  scheme: workout.scheme,
  scoreType: workout.scoreType ?? "max",
})

await db.insert(scoresTable).values({
  userId,
  teamId,
  workoutId: workout.id,
  scheme: workout.scheme,
  scoreType: workout.scoreType ?? "max",
  scoreValue,
  status: "scored",
  statusOrder: 0,
  sortKey: sortKey.toString(),
  recordedAt: new Date(),
})
```

### Saving Multi-Round Scores

```typescript
const { rounds, aggregated } = encodeRounds(roundInputs, workout.scheme, scoreType)

// Insert main score
const [insertedScore] = await db.insert(scoresTable).values({
  // ...
  scoreValue: aggregated,
}).returning()

// Insert rounds
await db.insert(scoreRoundsTable).values(
  rounds.map((value, i) => ({
    scoreId: insertedScore.id,
    roundNumber: i + 1,
    value,
  }))
)
```

---

## How to Query Leaderboards

### Basic Leaderboard Query

```sql
SELECT * FROM scores
WHERE workout_id = ?
  AND team_id = ?
ORDER BY status_order ASC, sort_key ASC
LIMIT 50
```

### With Drizzle

```typescript
import { asc, and, eq } from "drizzle-orm"
import { scoresTable } from "@/db/schema"

const leaderboard = await db
  .select()
  .from(scoresTable)
  .where(
    and(
      eq(scoresTable.workoutId, workoutId),
      eq(scoresTable.teamId, teamId),
    )
  )
  .orderBy(
    asc(scoresTable.statusOrder),
    asc(scoresTable.sortKey),
  )
  .limit(50)
```

---

## Scheme Reference

| Scheme | Encoding | Sort Direction | Default Score Type |
|--------|----------|----------------|-------------------|
| `time` | milliseconds | asc (lower better) | min |
| `time-with-cap` | milliseconds | asc | min |
| `rounds-reps` | rounds×100000 + reps | desc (higher better) | max |
| `reps` | integer | desc | max |
| `emom` | milliseconds | desc | max |
| `load` | grams | desc | max |
| `calories` | integer | desc | max |
| `meters` | millimeters | desc | max |
| `feet` | millimeters | desc | max |
| `points` | integer | desc | max |
| `pass-fail` | 1 or 0 | desc | first |

---

## Status Reference

| Status | Order | Description |
|--------|-------|-------------|
| `scored` | 0 | Normal completed score |
| `cap` | 1 | Hit time cap |
| `dq` | 2 | Disqualified |
| `withdrawn` | 3 | Withdrawn from competition |

Lower status order sorts first, so finished athletes always rank above capped athletes.
