import type { WodsmithDb } from "@repo/wodsmith-db/mysql"
import { eq, max } from "drizzle-orm"
import {
  createTrackWorkoutId,
  programmingTracksTable,
  trackWorkoutsTable,
  workouts,
} from "@/db/schema"
import { CROSSFIT_TRACK_ID } from "@/lib/crossfit/source"

export async function appendCrossFitWorkout(
  db: WodsmithDb,
  workoutId: string,
  notes?: string,
) {
  return db.transaction(async (tx) => {
    const [track] = await tx
      .select({ id: programmingTracksTable.id })
      .from(programmingTracksTable)
      .where(eq(programmingTracksTable.id, CROSSFIT_TRACK_ID))
      .for("update")
    if (!track) throw new Error("CrossFit.com track not found")
    const [workout] = await tx
      .select({ id: workouts.id })
      .from(workouts)
      .where(eq(workouts.id, workoutId))
      .for("update")
    if (!workout) throw new Error("Workout not found")
    const [last] = await tx
      .select({ order: max(trackWorkoutsTable.trackOrder) })
      .from(trackWorkoutsTable)
      .where(eq(trackWorkoutsTable.trackId, track.id))
    const trackOrder = Math.floor(Number(last?.order ?? 0)) + 1
    if (trackOrder > 9999) throw new Error("Track order capacity reached")
    const id = createTrackWorkoutId()
    await tx.insert(trackWorkoutsTable).values({
      id,
      trackId: track.id,
      workoutId,
      trackOrder,
      notes: notes ?? null,
    })
    const [created] = await tx
      .select()
      .from(trackWorkoutsTable)
      .where(eq(trackWorkoutsTable.id, id))
    return { trackWorkout: created }
  })
}
