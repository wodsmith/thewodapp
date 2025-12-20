---
name: type-safety
description: Fix type assertions and improve TypeScript type safety. Use when encountering 'as unknown as' casts, manual type definitions that duplicate schema types, or unclear type errors in database queries, especially with Drizzle ORM relations. Also use when verifying types
triggers:
  - "Property 'workout' does not exist"
  - "Property 'track' does not exist"
  - "Property 'competition' does not exist"
  - "Property 'organizingTeam' does not exist"
  - "TS2339: Property does not exist on type"
  - "TS2551: Property does not exist"
  - "with: { relation: true }"
  - "as unknown as"
  - "Drizzle relation type"
---

# Type Safety

Improve TypeScript type safety by eliminating unsafe type assertions and using proper types from the source.

## CRITICAL: Drizzle Relation Type Inference Failure

**This is a recurring bug in WODsmith.** Drizzle's `with: { relation: true }` clause does NOT automatically include relation types in the return type. This causes:

```
error TS2339: Property 'workout' does not exist on type '{ id: string; trackId: string; ... }'
error TS2551: Property 'track' does not exist on type '{ ... }'. Did you mean 'trackId'?
```

### Root Cause

1. Query uses `db.query.table.findFirst({ with: { workout: true } })`
2. Runtime: Returns object with `workout` property populated
3. Compile time: TypeScript only sees base table columns, not relations
4. Result: Type errors when accessing `.workout`, `.track`, `.competition`, etc.

### Three Fix Strategies (Choose Based on Context)

#### Strategy 1: Type Alias with Cast (Simple, for single file use)

```typescript
import { type TrackWorkout, type Workout } from "@/db/schema"

type TrackWorkoutWithWorkout = TrackWorkout & { workout: Workout }

const result = await db.query.trackWorkoutsTable.findFirst({
  where: eq(trackWorkoutsTable.id, id),
  with: { workout: true }
}) as TrackWorkoutWithWorkout | undefined
```

#### Strategy 2: Explicit Join (Most Type-Safe, for complex queries)

When relation chains are deep or you need specific fields:

```typescript
// Instead of .with() which has type inference issues:
const result = await db
  .select({
    id: trackWorkoutsTable.id,
    trackId: trackWorkoutsTable.trackId,
    // ... other trackWorkout fields
    workout: workoutsTable,  // Full workout object
    // OR select specific fields:
    workoutName: workoutsTable.name,
    workoutScheme: workoutsTable.scheme,
  })
  .from(trackWorkoutsTable)
  .innerJoin(workoutsTable, eq(trackWorkoutsTable.workoutId, workoutsTable.id))
  .where(eq(trackWorkoutsTable.id, id))
```

#### Strategy 3: Type Guard for Optional Relations

```typescript
// When relation might not be loaded
if (result && 'workout' in result && result.workout) {
  const workout = result.workout as Workout
  // Use workout safely
}

// Or with type guard function
function hasWorkout(tw: TrackWorkout): tw is TrackWorkout & { workout: Workout } {
  return 'workout' in tw && tw.workout !== undefined
}
```

## Common WODsmith Type Error Patterns

### Pattern 1: Missing `.workout` on trackWorkout

**Error:** `Property 'workout' does not exist on type '{ createdAt: Date; ... workoutId: string; }'`

**Files affected:** competition-scores.ts, competition-workouts.ts, programming.ts

**Fix:** Use Strategy 1 or 2 above.

### Pattern 2: Missing `.track` or `.competition`

**Error:** `Property 'track' does not exist... Did you mean 'trackId'?`

**Fix:** Same strategies. The relation IS loaded, TypeScript just doesn't know.

### Pattern 3: Missing New Schema Columns

**Error:** `Property 'minHeatBuffer' is missing in type`

**Cause:** Schema changed, new columns added, but code constructing objects manually doesn't include them.

**Fix:** Add the missing properties with appropriate defaults (usually `null`):

```typescript
const tempWorkout = {
  ...existingFields,
  defaultHeatsCount: null,
  defaultLaneShiftPattern: null,
  minHeatBuffer: null,  // New field!
}
```

### Pattern 4: Possibly Undefined Array Access

**Error:** `'rot1' is possibly 'undefined'`

**Fix:** Add null checks before accessing:

```typescript
// Bad
const rot1 = rotations.find(r => r.id === id1)
const rot2 = rotations.find(r => r.id === id2)
console.log(rot1.startingHeat)  // Error!

// Good
if (!rot1 || !rot2) {
  continue  // or throw, or return early
}
console.log(rot1.startingHeat)  // Safe
```

## Prevention Checklist

When writing queries with relations:

1. [ ] Check if return type includes relation properties
2. [ ] If not, create type alias: `type XWithY = X & { y: Y }`
3. [ ] Apply cast at query site: `as XWithY | undefined`
4. [ ] For complex joins, prefer explicit `.select().from().innerJoin()`
5. [ ] When constructing objects manually, check schema for ALL current columns

## References

For detailed examples and patterns, see:
- [references/drizzle-patterns.md](references/drizzle-patterns.md) - Common Drizzle ORM type patterns
- [references/examples.md](references/examples.md) - Real examples from the codebase
