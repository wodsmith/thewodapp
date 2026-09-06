import { createServerFn } from "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { programmingTracksTable, teamTable } from "@/db/schema"
import {
  workoutImportDestinationSchema,
  workoutImportSaveInputSchema,
} from "@/lib/workout-import"
import { requireWorkoutImportAccess } from "@/server/workout-import/access"
import { saveWorkoutImport } from "@/server/workout-import/persistence"
import { getSessionFromCookie } from "@/utils/auth"

export const getWorkoutImportAccessFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({ destination: workoutImportDestinationSchema })
      .strict()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) return { hasAccess: false as const }
    try {
      return await getDb().transaction(async (tx) => {
        const scope = await requireWorkoutImportAccess(
          { userId: session.userId, destination: data.destination },
          tx,
        )
        const team = await tx.query.teamTable.findFirst({
          where: eq(teamTable.id, scope.teamId),
          columns: { name: true },
        })
        const track =
          scope.destination.kind === "track"
            ? await tx.query.programmingTracksTable.findFirst({
                where: eq(programmingTracksTable.id, scope.destination.trackId),
                columns: { name: true },
              })
            : null
        return {
          hasAccess: true as const,
          scope,
          teamName: team?.name ?? "Personal team",
          trackName: track?.name ?? null,
        }
      })
    } catch {
      return { hasAccess: false as const }
    }
  })

export const saveWorkoutImportFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => workoutImportSaveInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")
    return saveWorkoutImport({ userId: session.userId, input: data })
  })
