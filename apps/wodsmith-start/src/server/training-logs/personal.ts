import { eq } from "drizzle-orm"
import type { Database } from "@/db"
import { createScoreId, type Score, scoresTable } from "@/db/schemas/scores"
import {
  decodeScore,
  parseScore,
  type ScoreType,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"
import {
  buildWorkoutResultScoring,
  encodeWorkoutResultRounds,
  normalizeWorkoutResultRounds,
  resolveWorkoutResultScoreType,
  type WorkoutResultRoundInput,
} from "@/lib/scoring/result"
import { writeWorkoutResultRounds } from "./rounds"

interface PersonalWorkoutResultWorkout {
  scheme: string
  scoreType: string | null
  timeCap: number | null
}

export interface SubmitPersonalWorkoutResultInput {
  db: Database
  userId: string
  teamId: string
  workoutId: string
  scalingLevelId: string
  result: NormalizedSubmittedPersonalWorkoutResult
  asRx: boolean
  notes?: string
  recordedAt: Date
}

export interface NormalizedSubmittedPersonalWorkoutResult {
  scheme: WorkoutScheme
  scoreType: ScoreType
  scoreValue: number | null
  status: "scored"
  statusOrder: number
  sortKey: string | null
  timeCapMs: number | null
  rounds: ReturnType<typeof normalizeWorkoutResultRounds>
  formatted: string
}

export interface CreatePersonalWorkoutResultInput {
  db: Database
  userId: string
  teamId: string
  workoutId: string
  scoreValue: number | null
  scheme: string
  asRx: boolean
  scalingLevelId?: string
  notes?: string
  scheduledWorkoutInstanceId?: string
  recordedAt?: Date
}

export interface UpdatePersonalWorkoutResultInput {
  db: Database
  scoreId: string
  existing: {
    scheme: string
    scoreType: string | null
  }
  scoreValue?: number | null
  notes?: string
  asRx?: boolean
  scalingLevelId?: string
  date?: string
  roundScores?: WorkoutResultRoundInput[]
}

function normalizeEncodedPersonalWorkoutResult(
  scoreValue: number | null,
  scheme: WorkoutScheme,
  scoreType: ScoreType,
) {
  const scoring = buildWorkoutResultScoring({
    value: scoreValue,
    status: "scored",
    scheme,
    scoreType,
  })

  return {
    scoreValue,
    status: "scored" as const,
    statusOrder: scoring.statusOrder,
    sortKey: scoring.sortKey ? sortKeyToString(scoring.sortKey) : null,
  }
}

export function normalizeSubmittedPersonalWorkoutResult({
  workout,
  score,
  roundScores,
}: {
  workout: PersonalWorkoutResultWorkout
  score: string
  roundScores?: WorkoutResultRoundInput[]
}): NormalizedSubmittedPersonalWorkoutResult {
  const scheme = workout.scheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(scheme, workout.scoreType)
  const isMultiRound = !!(roundScores && roundScores.length > 0)

  let scoreValue: number | null
  let formatted: string

  if (isMultiRound && roundScores) {
    const encoded = encodeWorkoutResultRounds(roundScores, scheme, scoreType)
    if (encoded.rounds.length !== roundScores.length) {
      throw new Error("Every round must be a valid score")
    }
    scoreValue = encoded.aggregated
    formatted = scoreValue !== null ? decodeScore(scoreValue, scheme) : ""
  } else {
    if (!score.trim()) {
      throw new Error("Score is required")
    }

    const parsed = parseScore(score, scheme, { timePrecision: "seconds" })
    if (!parsed.isValid) {
      throw new Error(parsed.error || "Invalid score")
    }

    scoreValue = parsed.encoded
    formatted = parsed.formatted || ""
  }

  const result = normalizeEncodedPersonalWorkoutResult(
    scoreValue,
    scheme,
    scoreType,
  )
  const rounds = isMultiRound
    ? normalizeWorkoutResultRounds(roundScores ?? [], scheme, {
        roundsRepsInput: "score",
      })
    : []

  return {
    scheme,
    scoreType,
    ...result,
    timeCapMs: workout.timeCap ? workout.timeCap * 1000 : null,
    rounds,
    formatted,
  }
}

// @lat: [[domain#Domain Model#Scoring#Personal training logs]]
export async function submitPersonalWorkoutResult({
  db,
  userId,
  teamId,
  workoutId,
  scalingLevelId,
  result,
  asRx,
  notes,
  recordedAt,
}: SubmitPersonalWorkoutResultInput): Promise<{
  success: true
  scoreId: string
  formatted: string
}> {
  const scoreId = createScoreId()

  await db.insert(scoresTable).values({
    id: scoreId,
    userId,
    teamId,
    workoutId,
    scheme: result.scheme,
    scoreType: result.scoreType,
    scoreValue: result.scoreValue,
    status: result.status,
    statusOrder: result.statusOrder,
    sortKey: result.sortKey,
    scalingLevelId,
    asRx,
    notes: notes || null,
    recordedAt,
    timeCapMs: result.timeCapMs,
  })

  if (result.rounds.length > 0) {
    await writeWorkoutResultRounds(db, scoreId, result.rounds, {
      replaceExisting: false,
    })
  }

  return { success: true, scoreId, formatted: result.formatted }
}

export async function createPersonalWorkoutResult({
  db,
  userId,
  teamId,
  workoutId,
  scoreValue,
  scheme: rawScheme,
  asRx,
  scalingLevelId,
  notes,
  scheduledWorkoutInstanceId,
  recordedAt,
}: CreatePersonalWorkoutResultInput): Promise<Score> {
  const scheme = rawScheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(scheme)
  const result = normalizeEncodedPersonalWorkoutResult(
    scoreValue,
    scheme,
    scoreType,
  )
  const scoreId = createScoreId()

  await db.insert(scoresTable).values({
    id: scoreId,
    userId,
    teamId,
    workoutId,
    scoreValue: result.scoreValue,
    scheme,
    scoreType,
    asRx,
    scalingLevelId: scalingLevelId ?? null,
    notes: notes ?? null,
    scheduledWorkoutInstanceId: scheduledWorkoutInstanceId ?? null,
    recordedAt: recordedAt ?? new Date(),
    status: result.status,
    statusOrder: result.statusOrder,
    sortKey: result.sortKey,
  })

  const newScore = await db.query.scoresTable.findFirst({
    where: eq(scoresTable.id, scoreId),
  })

  if (!newScore) {
    throw new Error("Failed to create log")
  }

  return newScore
}

export async function updatePersonalWorkoutResult({
  db,
  scoreId,
  existing,
  scoreValue,
  notes,
  asRx,
  scalingLevelId,
  date,
  roundScores,
}: UpdatePersonalWorkoutResultInput): Promise<Score> {
  const scheme = existing.scheme as WorkoutScheme
  const scoreType = resolveWorkoutResultScoreType(scheme, existing.scoreType)
  const isMultiRound = !!(roundScores && roundScores.length > 0)
  const updateData: {
    scoreValue?: number | null
    notes?: string | null
    asRx?: boolean
    scalingLevelId?: string | null
    sortKey?: string | null
    recordedAt?: Date
    updatedAt: Date
  } = {
    updatedAt: new Date(),
  }

  if (isMultiRound && roundScores) {
    const encoded = encodeWorkoutResultRounds(roundScores, scheme, scoreType)
    if (encoded.rounds.length !== roundScores.length) {
      throw new Error("Every round must be a valid score")
    }
    const result = normalizeEncodedPersonalWorkoutResult(
      encoded.aggregated,
      scheme,
      scoreType,
    )
    updateData.scoreValue = result.scoreValue
    updateData.sortKey = result.sortKey
  } else if (scoreValue !== undefined) {
    const result = normalizeEncodedPersonalWorkoutResult(
      scoreValue,
      scheme,
      scoreType,
    )
    updateData.scoreValue = result.scoreValue
    updateData.sortKey = result.sortKey
  }

  if (notes !== undefined) updateData.notes = notes || null
  if (asRx !== undefined) updateData.asRx = asRx
  if (scalingLevelId !== undefined) {
    updateData.scalingLevelId = scalingLevelId || null
  }
  if (date !== undefined) updateData.recordedAt = new Date(date)

  await db
    .update(scoresTable)
    .set(updateData)
    .where(eq(scoresTable.id, scoreId))

  const updatedScore = await db.query.scoresTable.findFirst({
    where: eq(scoresTable.id, scoreId),
  })

  if (!updatedScore) {
    throw new Error("Failed to update score")
  }

  if (isMultiRound && roundScores) {
    const rounds = normalizeWorkoutResultRounds(roundScores, scheme, {
      roundsRepsInput: "score",
    })
    await writeWorkoutResultRounds(db, scoreId, rounds, {
      replaceExisting: true,
    })
  }

  return updatedScore
}
