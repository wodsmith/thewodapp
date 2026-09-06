import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, isNull, or } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { scalingGroupsTable, TEAM_PERMISSIONS, workouts } from "@/db/schema"
import { requireWorkoutTeamWrite } from "@/server/workout-import/access"
import { getSessionFromCookie } from "@/utils/auth"

/** Ordinary edit choices use the workout's current owner and write permission. */
export const getWorkoutEditScalingGroupsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({ workoutId: z.string().min(1) })
      .strict()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    return getDb().transaction(
      async (tx) => {
        const workout = await tx.query.workouts.findFirst({
          where: eq(workouts.id, data.workoutId),
          columns: { teamId: true },
        })
        if (!workout) return { scalingGroups: [] }
        if (!workout.teamId)
          throw new Error("Workout has no editable owner team")
        await requireWorkoutTeamWrite(
          session.userId,
          workout.teamId,
          TEAM_PERMISSIONS.EDIT_COMPONENTS,
          tx,
        )
        const scalingGroups = await tx
          .select({
            id: scalingGroupsTable.id,
            title: scalingGroupsTable.title,
          })
          .from(scalingGroupsTable)
          .where(
            or(
              eq(scalingGroupsTable.teamId, workout.teamId),
              and(
                isNull(scalingGroupsTable.teamId),
                eq(scalingGroupsTable.isSystem, true),
              ),
            ),
          )
          .orderBy(asc(scalingGroupsTable.title))
        return { scalingGroups }
      },
      { isolationLevel: "read committed" },
    )
  })
