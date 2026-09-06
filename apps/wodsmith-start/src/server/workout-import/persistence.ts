import "server-only"
import { createId } from "@paralleldrive/cuid2"
import { and, eq, inArray, isNull, or } from "drizzle-orm"
import { type Database, getDb } from "@/db"
import {
  movements,
  scalingGroupsTable,
  trackWorkoutsTable,
  workoutImportReceiptsTable,
  workoutImportSessionsTable,
  workoutMovements,
  workouts,
} from "@/db/schema"
import {
  type NormalizedWorkoutSave,
  normalizedWorkoutSaveSchema,
  type WorkoutImportSaveInput,
  type WorkoutImportSaveResult,
  workoutImportSaveInputSchema,
} from "@/lib/workout-import"
import type { WorkoutImportDatabase } from "./access"
import {
  authorizeWorkoutImportSession,
  loadWorkoutImportSessionForUpdate,
} from "./sessions"

export async function validateWorkoutReferences(
  db: WorkoutImportDatabase,
  workout: Pick<NormalizedWorkoutSave, "movementIds" | "scalingGroupId">,
  teamId: string,
): Promise<void> {
  if (workout.movementIds.length) {
    const rows = await db
      .select({ id: movements.id })
      .from(movements)
      .where(inArray(movements.id, workout.movementIds))
    if (rows.length !== workout.movementIds.length)
      throw new Error("Select existing catalog movements")
  }
  if (workout.scalingGroupId) {
    const group = await db.query.scalingGroupsTable.findFirst({
      where: and(
        eq(scalingGroupsTable.id, workout.scalingGroupId),
        or(
          eq(scalingGroupsTable.teamId, teamId),
          and(
            isNull(scalingGroupsTable.teamId),
            eq(scalingGroupsTable.isSystem, true),
          ),
        ),
      ),
    })
    if (!group) throw new Error("Scaling group is unavailable for this team")
  }
}

export async function insertWorkoutWithMovements(
  db: WorkoutImportDatabase,
  input: NormalizedWorkoutSave,
  teamId: string,
  sourceWorkoutId: string | null = null,
): Promise<string> {
  const workoutId = `workout_${createId()}`
  const { movementIds, timeCapSeconds, ...fields } = input
  await db.insert(workouts).values({
    ...fields,
    id: workoutId,
    teamId,
    sourceWorkoutId,
    timeCap: timeCapSeconds,
  })
  if (movementIds.length)
    await db.insert(workoutMovements).values(
      movementIds.map((movementId) => ({
        id: `wm_${createId()}`,
        workoutId,
        movementId,
      })),
    )
  return workoutId
}

export async function workoutImportContentHash(
  input: WorkoutImportSaveInput,
): Promise<string> {
  // Zod normalizes key order and defaults; idempotency token is not content.
  const value = workoutImportSaveInputSchema.parse(input)
  const data = JSON.stringify({
    workout: value.workout,
    track: value.track ?? null,
    resolutions: [...value.resolutions].sort((a, b) =>
      a.questionId.localeCompare(b.questionId),
    ),
  })
  const bytes = new TextEncoder().encode(data)
  const hash = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("")
}

// @lat: [[workout-import#Workout Import#Atomic reviewed save]]
export async function saveWorkoutImport(
  { userId, input: raw }: { userId: string; input: WorkoutImportSaveInput },
  db: Database = getDb(),
): Promise<WorkoutImportSaveResult> {
  const input = workoutImportSaveInputSchema.parse(raw)
  const contentHash = await workoutImportContentHash(input)
  return db.transaction(
    async (tx) => {
      const session = await loadWorkoutImportSessionForUpdate(
        tx,
        userId,
        input.importId,
      )
      // Always authorize before examining the receipt, including lost-response retries.
      await authorizeWorkoutImportSession(tx, session)
      if (session.revision !== input.revision)
        throw new Error("Workout import revision changed")
      const receipt = await tx.query.workoutImportReceiptsTable.findFirst({
        where: eq(workoutImportReceiptsTable.importId, input.importId),
      })
      if (receipt) {
        if (
          receipt.userId !== userId ||
          receipt.teamId !== session.teamId ||
          receipt.revision !== input.revision ||
          receipt.contentHash !== contentHash
        )
          throw new Error("Workout import already saved with different content")
        return {
          workoutId: receipt.workoutId,
          trackWorkoutId: receipt.trackWorkoutId,
          importId: input.importId,
          revision: input.revision,
        }
      }
      if (!session.proposal)
        throw new Error("No reviewed workout import revision")
      if ((session.destination.kind === "track") !== !!input.track)
        throw new Error("Review the destination track position before saving")
      const resolutions = new Map(
        input.resolutions.map((r) => [r.questionId, r.answer]),
      )
      if (
        resolutions.size !== input.resolutions.length ||
        input.resolutions.some(
          (r) =>
            !session.proposal?.unresolved.some((q) => q.id === r.questionId),
        )
      )
        throw new Error("Invalid question resolution")
      const prescriptionAnswers: string[] = []
      for (const question of session.proposal.unresolved) {
        const answer = resolutions.get(question.id)
        if (question.field === "selectedPart" || !answer)
          throw new Error(`Resolve import question: ${question.id}`)
        if (question.choices.length && !question.choices.includes(answer))
          throw new Error(`Choose an allowed answer: ${question.id}`)
        if (question.field === "prescription") {
          prescriptionAnswers.push(`${question.reason}: ${answer}`)
        } else {
          const value = input.workout[question.field]
          if (
            value === null ||
            value === "" ||
            (Array.isArray(value) && !value.length)
          )
            throw new Error(`Complete workout field: ${question.field}`)
          if (
            question.choices.length &&
            ![value].flat().map(String).includes(answer)
          )
            throw new Error(
              `Answer must match workout field: ${question.field}`,
            )
        }
      }
      const reviewedWorkout = normalizedWorkoutSaveSchema.parse({
        ...input.workout,
        description: prescriptionAnswers.length
          ? `${input.workout.description}\n\nUser clarifications:\n${prescriptionAnswers.join("\n")}`
          : input.workout.description,
      })
      await validateWorkoutReferences(tx, reviewedWorkout, session.teamId)
      // Last authorization check precedes the first persistence write.
      await authorizeWorkoutImportSession(tx, session)
      const workoutId = await insertWorkoutWithMovements(
        tx,
        reviewedWorkout,
        session.teamId,
      )
      let trackWorkoutId: string | null = null
      if (session.destination.kind === "track" && input.track) {
        trackWorkoutId = `trwk_${createId()}`
        await tx.insert(trackWorkoutsTable).values({
          id: trackWorkoutId,
          trackId: session.destination.trackId,
          workoutId,
          trackOrder: input.track.trackOrder,
          notes: input.track.notes ?? null,
        })
      }
      await tx.insert(workoutImportReceiptsTable).values({
        importId: input.importId,
        userId,
        teamId: session.teamId,
        revision: input.revision,
        idempotencyKey: input.idempotencyKey,
        contentHash,
        workoutId,
        trackWorkoutId,
      })
      // Minimize sensitive data after success; retain scope and receipt for retries.
      await tx
        .update(workoutImportSessionsTable)
        .set({ savedWorkoutId: workoutId, proposal: null })
        .where(eq(workoutImportSessionsTable.id, input.importId))
      return {
        workoutId,
        trackWorkoutId,
        importId: input.importId,
        revision: input.revision,
      }
    },
    { isolationLevel: "read committed" },
  )
}
