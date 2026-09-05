import { eq } from "drizzle-orm"
import type { Database } from "@/db"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { workouts } from "@/db/schemas/workouts"
import { decideCompetitionResult } from "./decision"
import {
  CompetitionResultError,
  type CompetitionResultReceipt,
  divisionIdFromScope,
  type RecordCompetitionResultCommand,
} from "./domain"
import {
  persistCompetitionResultInTransaction,
  type ResultTransaction,
} from "./repository"

/** Executes the record command against authoritative programmed-workout data. */
export async function recordCompetitionResult(input: {
  db: Database
  command: RecordCompetitionResultCommand
}): Promise<CompetitionResultReceipt> {
  return input.db.transaction((tx) =>
    recordCompetitionResultInTransaction({ db: tx, command: input.command }),
  )
}

/** Used by submission workflows to commit the result with video and audit state. */
export async function recordCompetitionResultInTransaction(input: {
  db: ResultTransaction
  command: RecordCompetitionResultCommand
}): Promise<CompetitionResultReceipt> {
  const { db, command } = input
  const [programmedWorkout] = await db
    .select({
      workoutId: workouts.id,
      trackId: trackWorkoutsTable.trackId,
      scheme: workouts.scheme,
      scoreType: workouts.scoreType,
      roundsToScore: workouts.roundsToScore,
      timeCap: workouts.timeCap,
      tiebreakScheme: workouts.tiebreakScheme,
    })
    .from(trackWorkoutsTable)
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .where(eq(trackWorkoutsTable.id, command.trackWorkoutId))
    .limit(1)

  if (!programmedWorkout) {
    throw new CompetitionResultError(
      "programmed_workout_not_found",
      "Workout not found",
    )
  }

  const revision = decideCompetitionResult(command.claim, programmedWorkout)

  const [track] = await db
    .select({ ownerTeamId: programmingTracksTable.ownerTeamId })
    .from(programmingTracksTable)
    .where(eq(programmingTracksTable.id, programmedWorkout.trackId))
    .limit(1)
  if (!track?.ownerTeamId) {
    throw new CompetitionResultError(
      "programmed_workout_not_found",
      "Could not determine team ownership",
    )
  }
  if (
    (command.expectedWorkoutId &&
      command.expectedWorkoutId !== programmedWorkout.workoutId) ||
    (command.expectedOwnerTeamId &&
      command.expectedOwnerTeamId !== track.ownerTeamId)
  ) {
    throw new CompetitionResultError(
      "programmed_workout_mismatch",
      "Competition workout does not match the programmed event",
    )
  }

  return persistCompetitionResultInTransaction({
    db,
    target: {
      athleteUserId: command.athleteUserId,
      ownerTeamId: track.ownerTeamId,
      workoutId: programmedWorkout.workoutId,
      trackWorkoutId: command.trackWorkoutId,
      divisionId: divisionIdFromScope(command.divisionScope),
    },
    revision,
    recordedAt: command.recordedAt ?? new Date(),
  })
}
