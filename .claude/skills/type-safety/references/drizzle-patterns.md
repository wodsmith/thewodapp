# Drizzle ORM Type Patterns

## The Problem

Drizzle's `.with()` clause loads relations at runtime but TypeScript doesn't infer them:

```typescript
// Runtime: returns { id, trackId, workout: { name, scheme, ... } }
// TypeScript sees: { id, trackId } - no workout property!
const result = await db.query.trackWorkoutsTable.findFirst({
  with: { workout: true }
})
result.workout.name  // TS Error: Property 'workout' does not exist
```

## Solution 1: Type Alias Cast (Simple Cases)

### Single Relation

```typescript
import { type TrackWorkout, type Workout } from "@/db/schema"

type TrackWorkoutWithWorkout = TrackWorkout & { workout: Workout }

const result = await db.query.trackWorkoutsTable.findFirst({
  with: { workout: true }
}) as TrackWorkoutWithWorkout | undefined
```

### Multiple Relations

```typescript
import { type TrackWorkout, type Workout, type ProgrammingTrack } from "@/db/schema"

type TrackWorkoutWithRelations = TrackWorkout & {
  workout: Workout
  track: ProgrammingTrack
}

const result = await db.query.trackWorkoutsTable.findFirst({
  with: {
    workout: true,
    track: true
  }
}) as TrackWorkoutWithRelations | undefined
```

### Nested Relations

```typescript
import { type TrackWorkout, type ProgrammingTrack, type Competition } from "@/db/schema"

type TrackWorkoutWithNestedRelations = TrackWorkout & {
  track: ProgrammingTrack & {
    competition: Competition
  }
}

const result = await db.query.trackWorkoutsTable.findFirst({
  with: {
    track: {
      with: { competition: true }
    }
  }
}) as TrackWorkoutWithNestedRelations | undefined
```

## Solution 2: Explicit Joins (Complex Cases)

When you need deep relation chains or specific field selection, explicit joins are more type-safe:

```typescript
// Get trackWorkout with workout data via explicit join
const result = await db
  .select({
    // TrackWorkout fields
    id: trackWorkoutsTable.id,
    trackId: trackWorkoutsTable.trackId,
    workoutId: trackWorkoutsTable.workoutId,
    trackOrder: trackWorkoutsTable.trackOrder,
    // Workout fields (fully typed!)
    workoutName: workoutsTable.name,
    workoutDescription: workoutsTable.description,
    workoutScheme: workoutsTable.scheme,
    workoutType: workoutsTable.workoutType,
    workoutScope: workoutsTable.scope,
    workoutTeamId: workoutsTable.teamId,
  })
  .from(trackWorkoutsTable)
  .innerJoin(workoutsTable, eq(trackWorkoutsTable.workoutId, workoutsTable.id))
  .where(eq(trackWorkoutsTable.id, trackWorkoutId))

// TypeScript fully infers all properties - no cast needed!
```

### Multi-Table Join Example (Real from competition-scores.ts)

```typescript
// Verify ownership via track -> competition relation chain
const ownershipCheck = await db
  .select({
    trackWorkoutId: trackWorkoutsTable.id,
    ownerTeamId: programmingTracksTable.ownerTeamId,
  })
  .from(trackWorkoutsTable)
  .innerJoin(
    programmingTracksTable,
    eq(trackWorkoutsTable.trackId, programmingTracksTable.id)
  )
  .where(eq(trackWorkoutsTable.id, trackWorkoutId))
```

## Optional Relations

When a relation might be null (one-to-one optional):

```typescript
type TrackWorkoutWithOptionalWorkout = TrackWorkout & { workout: Workout | null }
```

## Array Relations (One-to-Many)

```typescript
type TrackWithWorkouts = ProgrammingTrack & { 
  trackWorkouts: TrackWorkout[] 
}

type CompetitionWithRegistrations = Competition & {
  registrations: CompetitionRegistration[]
}
```

## Why Cast at All?

Drizzle's query builder with `.with()` doesn't automatically narrow the return type to include relations. The cast is necessary to tell TypeScript the shape of the returned data. However:

- Use base schema types, not manual definitions
- Create type aliases for reusability
- Keep casts simple and based on real types
- **Prefer explicit joins** when type safety is critical

## When to Use Which

| Scenario | Recommended Approach |
|----------|---------------------|
| Simple single relation | Type alias cast |
| Multiple flat relations | Type alias cast |
| Deep nested relations | Explicit join |
| Need specific field selection | Explicit join |
| Performance critical (fewer columns) | Explicit join |
| Quick fix, low complexity | Type alias cast |
