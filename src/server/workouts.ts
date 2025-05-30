import "server-only";
import { getDB } from "@/db";
import {
  workouts,
  workoutTags,
  tags,
  workoutMovements,
  movements,
  results,
} from "@/db/schema";
import { requireVerifiedEmail } from "@/utils/auth";
import { ZSAError } from "zsa";
import { eq, or, and, inArray, gte, lt, isNotNull } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { Workout } from "@/db/schema";

/**
 * Helper function to fetch tags by workout IDs
 */
async function fetchTagsByWorkoutId(
  db: ReturnType<typeof getDB>,
  workoutIds: string[]
): Promise<Map<string, Array<{ id: string; name: string }>>> {
  if (workoutIds.length === 0) return new Map();

  const workoutTagsData = await db
    .select({
      workoutId: workoutTags.workoutId,
      tagId: tags.id,
      tagName: tags.name,
    })
    .from(workoutTags)
    .innerJoin(tags, eq(workoutTags.tagId, tags.id))
    .where(inArray(workoutTags.workoutId, workoutIds));

  const tagsByWorkoutId = new Map<
    string,
    Array<{ id: string; name: string }>
  >();

  for (const item of workoutTagsData) {
    if (!tagsByWorkoutId.has(item.workoutId)) {
      tagsByWorkoutId.set(item.workoutId, []);
    }
    tagsByWorkoutId.get(item.workoutId)!.push({
      id: item.tagId,
      name: item.tagName,
    });
  }

  return tagsByWorkoutId;
}

/**
 * Helper function to fetch movements by workout IDs
 */
async function fetchMovementsByWorkoutId(
  db: ReturnType<typeof getDB>,
  workoutIds: string[]
): Promise<Map<string, Array<{ id: string; name: string; type: string }>>> {
  if (workoutIds.length === 0) return new Map();

  const workoutMovementsData = await db
    .select({
      workoutId: workoutMovements.workoutId,
      movementId: movements.id,
      movementName: movements.name,
      movementType: movements.type,
    })
    .from(workoutMovements)
    .innerJoin(movements, eq(workoutMovements.movementId, movements.id))
    .where(inArray(workoutMovements.workoutId, workoutIds));

  const movementsByWorkoutId = new Map<
    string,
    Array<{ id: string; name: string; type: string }>
  >();

  for (const item of workoutMovementsData) {
    if (!movementsByWorkoutId.has(item?.workoutId || "")) {
      movementsByWorkoutId.set(item?.workoutId || "", []);
    }
    movementsByWorkoutId.get(item?.workoutId || "")!.push({
      id: item.movementId,
      name: item.movementName,
      type: item.movementType,
    });
  }

  return movementsByWorkoutId;
}

/**
 * Helper function to fetch today's results by workout IDs
 */
async function fetchTodaysResultsByWorkoutId(
  db: ReturnType<typeof getDB>,
  userId: string,
  workoutIds: string[]
): Promise<Map<string, Array<(typeof todaysResults)[0]>>> {
  if (workoutIds.length === 0) return new Map();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaysResults = await db
    .select()
    .from(results)
    .where(
      and(
        eq(results.userId, userId),
        isNotNull(results.workoutId),
        inArray(results.workoutId, workoutIds),
        gte(results.date, today),
        lt(results.date, tomorrow)
      )
    );

  const resultsByWorkoutId = new Map<
    string,
    Array<(typeof todaysResults)[0]>
  >();

  for (const result of todaysResults) {
    const workoutId = result.workoutId!;

    if (!resultsByWorkoutId.has(workoutId)) {
      resultsByWorkoutId.set(workoutId, []);
    }
    resultsByWorkoutId.get(workoutId)!.push(result);
  }

  return resultsByWorkoutId;
}

/**
 * Get all workouts for the current user (public workouts + user's private workouts)
 */
export async function getUserWorkouts() {
  const session = await requireVerifiedEmail();

  if (!session) {
    throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
  }

  const userId = session.userId;

  const db = getDB();

  // Base workouts and ids
  const allWorkouts = await db
    .select()
    .from(workouts)
    .where(or(eq(workouts.scope, "public"), eq(workouts.userId, userId)));

  const workoutIds = allWorkouts.map((w) => w.id);

  // Fetch related data in parallel
  const [tagsByWorkoutId, movementsByWorkoutId, resultsByWorkoutId] =
    await Promise.all([
      fetchTagsByWorkoutId(db, workoutIds),
      fetchMovementsByWorkoutId(db, workoutIds),
      fetchTodaysResultsByWorkoutId(db, userId, workoutIds),
    ]);

  // Compose final structure
  return allWorkouts.map((w) => ({
    ...w,
    tags: tagsByWorkoutId.get(w.id) || [],
    movements: movementsByWorkoutId.get(w.id) || [],
    resultsToday: resultsByWorkoutId.get(w.id) || [],
  }));
}

/**
 * Create a new workout with tags and movements
 */
export async function createWorkout({
  workout,
  tagIds,
  movementIds,
  userId,
}: {
  workout: Omit<Workout, "id" | "updatedAt" | "updateCounter" | "userId"> & {
    createdAt: Date;
  };
  tagIds: string[];
  movementIds: string[];
  userId: string;
}) {
  const db = getDB();

  // Create the workout first
  const newWorkout = await db
    .insert(workouts)
    .values({
      id: `workout_${createId()}`,
      name: workout.name,
      description: workout.description,
      scope: workout.scope,
      scheme: workout.scheme,
      repsPerRound: workout.repsPerRound,
      roundsToScore: workout.roundsToScore,
      userId,
      sugarId: workout.sugarId,
      tiebreakScheme: workout.tiebreakScheme,
      secondaryScheme: workout.secondaryScheme,
      createdAt: workout.createdAt,
      updatedAt: workout.createdAt,
    })
    .returning();

  const createdWorkout = newWorkout?.[0];

  if (!createdWorkout) {
    throw new ZSAError("ERROR", "Could not create workout");
  }

  const workoutId = createdWorkout.id;

  // Create workout-tag associations
  if (tagIds.length > 0) {
    const workoutTagValues = tagIds.map((tagId) => ({
      id: `wt_${createId()}`,
      workoutId,
      tagId,
    }));
    await db.insert(workoutTags).values(workoutTagValues);
  }

  // Create workout-movement associations
  if (movementIds.length > 0) {
    const workoutMovementValues = movementIds.map((movementId) => ({
      id: `wm_${createId()}`,
      workoutId,
      movementId,
    }));
    await db.insert(workoutMovements).values(workoutMovementValues);
  }

  return {
    id: workoutId,
    name: workout.name,
    description: workout.description,
  };
}
