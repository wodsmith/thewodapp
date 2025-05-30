"use server";

import { z } from "zod";
import { getUserWorkouts, createWorkout } from "@/server/workouts";
import { ZSAError, createServerAction } from "zsa";

const createWorkoutSchema = z.object({
  workout: z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required").max(255, "Name is too long"),
    description: z.string().min(1, "Description is required"),
    scope: z.enum(["private", "public"]).default("private"),
    scheme: z.enum([
      "time",
      "time-with-cap",
      "pass-fail",
      "rounds-reps",
      "reps",
      "emom",
      "load",
      "calories",
      "meters",
      "feet",
      "points",
    ]),
    repsPerRound: z.number().nullable(),
    roundsToScore: z.number().nullable(),
    sugarId: z.string().nullable(),
    tiebreakScheme: z.enum(["time", "reps"]).nullable(),
    secondaryScheme: z
      .enum([
        "time",
        "pass-fail",
        "rounds-reps",
        "reps",
        "emom",
        "load",
        "calories",
        "meters",
        "feet",
        "points",
      ])
      .nullable(),
    createdAt: z.date(),
  }),
  tagIds: z.array(z.string()).default([]),
  movementIds: z.array(z.string()).default([]),
  userId: z.string().min(1, "User ID is required"),
});

/**
 * Create a new workout
 */
export const createWorkoutAction = createServerAction()
  .input(createWorkoutSchema)
  .handler(async ({ input }) => {
    try {
      const result = await createWorkout(input);
      return { success: true, data: result };
    } catch (error) {
      console.error("Failed to create workout:", error);

      if (error instanceof ZSAError) {
        throw error;
      }

      throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create workout");
    }
  });

/**
 * Get all workouts for the current user
 */
export const getUserWorkoutsAction = createServerAction().handler(async () => {
  try {
    const workouts = await getUserWorkouts();
    return { success: true, data: workouts };
  } catch (error) {
    console.error("Failed to get user workouts:", error);

    if (error instanceof ZSAError) {
      throw error;
    }

    throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get user workouts");
  }
});
