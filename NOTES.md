## Project Notes

- Porting an old Next.js website to this new template.
- Tech stack: Next.js, Cloudflare D1, Drizzle ORM.
- Database functions are being added to `./src/db/`.
- Server actions are being added to `./src/actions/`.
- Server actions are used by pages to load or mutate data.
- Need to re-implement `getWorkoutById` function in the new framework.
- Need to create a server action for `getWorkoutById`.
- Need to create server actions for `getResultSetsById` and `getWorkoutResultsByWorkoutAndUser`.
- Provided source code for `getResultSetsById` and `getWorkoutResultsByWorkoutAndUser` for reference.
- Match the style of `@server/workouts.ts` and `@actions/workout-actions.ts` for new implementations.
- Current focus: work on `/src/app/(main)/workouts/[id]/page.tsx` for the workout detail page.

## Source code referrence

```tsx
export async function getWorkoutResultsByWorkoutAndUser(
  workoutId: string,
  userId: string
): Promise<WorkoutResult[]> {
  const db = await getDbAsync();
  console.log(
    `Fetching workout results for workoutId: ${workoutId}, userId: ${userId}`
  );
  try {
    const workoutResultsData = await db
      .select()
      .from(results)
      .where(
        and(
          eq(results.workoutId, workoutId),
          eq(results.userId, userId),
          eq(results.type, "wod")
        )
      )
      .orderBy(results.date);
    console.log(`Found ${workoutResultsData.length} results.`);
    return workoutResultsData;
  } catch (error) {
    console.error("Error fetching workout results:", error);
    return [];
  }
}

export async function getWorkoutById(id: string) {
  const db = await getDbAsync();
  const workout = await db
    .select()
    .from(workouts)
    .where(eq(workouts.id, id))
    .get();
  if (!workout) return null;

  const workoutTagRows = await db
    .select()
    .from(workoutTags)
    .where(eq(workoutTags.workoutId, id));
  const tagIds = workoutTagRows.map((wt) => wt.tagId);
  const tagObjs = tagIds.length
    ? await db.select().from(tags).where(inArray(tags.id, tagIds))
    : [];

  const workoutMovementRows = await db
    .select()
    .from(workoutMovements)
    .where(eq(workoutMovements.workoutId, id));
  const movementIds = workoutMovementRows
    .map((wm) => wm.movementId)
    .filter((id): id is string => id !== null);
  const movementObjs = movementIds.length
    ? await db
        .select()
        .from(movements)
        .where(inArray(movements.id, movementIds))
    : [];

  return {
    ...workout,
    tags: tagObjs,
    movements: movementObjs,
  };
}

export async function createWorkout({
  workout,
  tagIds,
  movementIds,
  userId,
}: {
  workout: WorkoutCreate;
  tagIds: string[];
  movementIds: string[];
  userId: string;
}) {
  const db = await getDbAsync();
  await db.insert(workouts).values({ ...workout, userId });

  if (tagIds.length) {
    await db.insert(workoutTags).values(
      tagIds.map((tagId) => ({
        id: crypto.randomUUID(),
        workoutId: workout.id,
        tagId,
      }))
    );
  }
  if (movementIds.length) {
    await db.insert(workoutMovements).values(
      movementIds.map((movementId) => ({
        id: crypto.randomUUID(),
        workoutId: workout.id,
        movementId,
      }))
    );
  }
}

// Update a workout (with tags and movements)
export async function updateWorkout({
  id,
  workout,
  tagIds,
  movementIds,
}: {
  id: string;
  workout: WorkoutUpdate;
  tagIds: string[];
  movementIds: string[];
}) {
  const db = await getDbAsync();
  await db.update(workouts).set(workout).where(eq(workouts.id, id));
  await db.delete(workoutTags).where(eq(workoutTags.workoutId, id));
  await db.delete(workoutMovements).where(eq(workoutMovements.workoutId, id));
  if (tagIds.length) {
    await db.insert(workoutTags).values(
      tagIds.map((tagId) => ({
        id: crypto.randomUUID(),
        workoutId: id,
        tagId,
      }))
    );
  }
  if (movementIds.length) {
    await db.insert(workoutMovements).values(
      movementIds.map((movementId) => ({
        id: crypto.randomUUID(),
        workoutId: id,
        movementId,
      }))
    );
  }
}

export async function getResultSetsById(
  resultId: string
): Promise<ResultSet[]> {
  const db = await getDbAsync();
  console.log(`Fetching sets for resultId: ${resultId}`);
  try {
    const setDetails = await db
      .select()
      .from(sets)
      .where(eq(sets.resultId, resultId))
      .orderBy(sets.setNumber);
    console.log(`Found ${setDetails.length} sets for resultId ${resultId}.`);
    return setDetails;
  } catch (error) {
    console.error(`Error fetching sets for resultId ${resultId}:`, error);
    return [];
  }
}
```
