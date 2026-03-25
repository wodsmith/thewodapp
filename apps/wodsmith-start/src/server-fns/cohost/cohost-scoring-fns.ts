/**
 * Cohost Scoring Server Functions
 * Mirrors competition-score-fns.ts score entry/retrieval with cohost auth.
 * Allows cohosts to view and enter/update athlete scores.
 *
 * Note: Scoring CONFIG updates (algorithm, tiebreak rules) are in
 * cohost-competition-fns.ts (cohostUpdateScoringConfigFn).
 * This file handles score DATA entry and retrieval.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray, ne } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionEventsTable,
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import { userTable } from "@/db/schemas/users"
import {
  SCORE_STATUS_VALUES,
  type ScoreStatus,
  type ScoreType,
  type TiebreakScheme,
  type WorkoutScheme,
  workouts,
} from "@/db/schemas/workouts"
import {
  computeSortKey,
  decodeScore,
  encodeRounds,
  encodeScore,
  getDefaultScoreType,
  type WorkoutScheme as ScoringWorkoutScheme,
  STATUS_ORDER,
  sortKeyToString,
} from "@/lib/scoring"
import { logEntityUpdated, logInfo } from "@/lib/logging"
import { getSessionFromCookie } from "@/utils/auth"
import { autochunk } from "@/utils/batch-query"
import { requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Types
// ============================================================================

interface RoundScoreData {
  score: string
  parts?: [string, string]
}

// ============================================================================
// Input Schemas
// ============================================================================

const roundScoreSchema = z.object({
  score: z.string(),
  parts: z.tuple([z.string(), z.string()]).optional(),
})

const workoutInfoSchema = z.object({
  scheme: z.string(),
  scoreType: z.string().nullable(),
  repsPerRound: z.number().nullable(),
  roundsToScore: z.number().nullable(),
  timeCap: z.number().nullable(),
  tiebreakScheme: z.string().nullable().optional(),
})

const cohostGetEventScoreEntryDataInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  divisionId: z.string().optional(),
})

const cohostSaveScoreInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  workoutId: z.string().min(1),
  registrationId: z.string().min(1),
  userId: z.string().min(1),
  divisionId: z.string().nullable(),
  score: z.string(),
  scoreStatus: z.enum(SCORE_STATUS_VALUES),
  tieBreakScore: z.string().nullable().optional(),
  secondaryScore: z.string().nullable().optional(),
  roundScores: z.array(roundScoreSchema).optional(),
  workout: workoutInfoSchema.optional(),
})

const cohostDeleteScoreInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  userId: z.string().min(1),
})

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusOrder(status: ScoreStatus): number {
  switch (status) {
    case "scored":
      return STATUS_ORDER.scored
    case "cap":
      return STATUS_ORDER.cap
    case "dq":
      return STATUS_ORDER.dq
    case "withdrawn":
    case "dns":
    case "dnf":
      return STATUS_ORDER.withdrawn
    default:
      return STATUS_ORDER.scored
  }
}

function mapToNewStatus(
  status: ScoreStatus,
): "scored" | "cap" | "dq" | "withdrawn" {
  switch (status) {
    case "scored":
      return "scored"
    case "cap":
      return "cap"
    case "dq":
      return "dq"
    case "withdrawn":
    case "dns":
    case "dnf":
      return "withdrawn"
    default:
      return "scored"
  }
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get athletes and existing scores for score entry (cohost view)
 */
export const cohostGetEventScoreEntryDataFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostGetEventScoreEntryDataInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "scoring")
    const db = getDb()

    // Get the track workout with workout details
    const [result] = await db
      .select({
        trackWorkoutId: trackWorkoutsTable.id,
        trackOrder: trackWorkoutsTable.trackOrder,
        pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
        workoutId: workouts.id,
        workoutName: workouts.name,
        workoutDescription: workouts.description,
        workoutScheme: workouts.scheme,
        workoutScoreType: workouts.scoreType,
        workoutTiebreakScheme: workouts.tiebreakScheme,
        workoutTimeCap: workouts.timeCap,
        workoutRepsPerRound: workouts.repsPerRound,
        workoutRoundsToScore: workouts.roundsToScore,
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
      .limit(1)

    if (!result) {
      throw new Error("Event not found")
    }

    const trackWorkout = {
      id: result.trackWorkoutId,
      trackOrder: result.trackOrder,
      pointsMultiplier: result.pointsMultiplier,
      workout: {
        id: result.workoutId,
        name: result.workoutName,
        description: result.workoutDescription,
        scheme: result.workoutScheme as WorkoutScheme,
        scoreType: result.workoutScoreType as ScoreType | null,
        tiebreakScheme: result.workoutTiebreakScheme as TiebreakScheme | null,
        timeCap: result.workoutTimeCap,
        repsPerRound: result.workoutRepsPerRound,
        roundsToScore: result.workoutRoundsToScore,
      },
    }

    // Get registrations with optional division filter
    const registrations = await db
      .select({
        registration: competitionRegistrationsTable,
        user: userTable,
        division: scalingLevelsTable,
      })
      .from(competitionRegistrationsTable)
      .innerJoin(
        userTable,
        eq(competitionRegistrationsTable.userId, userTable.id),
      )
      .leftJoin(
        scalingLevelsTable,
        eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
      )
      .where(
        and(
          eq(competitionRegistrationsTable.eventId, data.competitionId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
          ...(data.divisionId
            ? [eq(competitionRegistrationsTable.divisionId, data.divisionId)]
            : []),
        ),
      )

    // Get existing scores
    const userIds = registrations.map((r) => r.user.id)
    const existingScores =
      userIds.length > 0
        ? await autochunk({ items: userIds }, async (chunk) =>
            db
              .select()
              .from(scoresTable)
              .where(
                and(
                  eq(scoresTable.competitionEventId, data.trackWorkoutId),
                  inArray(scoresTable.userId, chunk),
                ),
              ),
          )
        : []

    const scoreMap = new Map(existingScores.map((s) => [s.userId, s]))

    // Get score rounds for multi-round workouts
    const scoreIds = existingScores.map((s) => s.id)
    const allRounds =
      scoreIds.length > 0
        ? await autochunk({ items: scoreIds }, async (chunk) =>
            db
              .select()
              .from(scoreRoundsTable)
              .where(inArray(scoreRoundsTable.scoreId, chunk)),
          )
        : []

    const roundsByScoreId = new Map<
      string,
      Array<{ setNumber: number; score: number | null; reps: number | null }>
    >()
    for (const round of allRounds) {
      const existing = roundsByScoreId.get(round.scoreId) ?? []
      existing.push({
        setNumber: round.setNumber,
        score: round.score,
        reps: round.reps,
      })
      roundsByScoreId.set(round.scoreId, existing)
    }

    // Get all divisions for the filter dropdown
    const allDivisionIds = [
      ...new Set(
        registrations
          .map((r) => r.registration.divisionId)
          .filter((id): id is string => id !== null),
      ),
    ]
    const allDivisions =
      allDivisionIds.length > 0
        ? await db
            .select({
              id: scalingLevelsTable.id,
              label: scalingLevelsTable.label,
              position: scalingLevelsTable.position,
            })
            .from(scalingLevelsTable)
            .where(inArray(scalingLevelsTable.id, allDivisionIds))
        : []

    // Build athletes response
    const athletes = registrations.map((r) => {
      const score = scoreMap.get(r.user.id)
      const rounds = score ? (roundsByScoreId.get(score.id) ?? []) : []

      let wodScore: string | null = null
      if (score?.scoreValue !== null && score?.scheme) {
        wodScore = decodeScore(
          score.scoreValue!,
          score.scheme as ScoringWorkoutScheme,
          { compact: false },
        )
      }

      let tieBreakScore: string | null = null
      if (
        score?.tiebreakValue !== null &&
        score?.tiebreakScheme &&
        score?.tiebreakValue !== undefined
      ) {
        tieBreakScore = decodeScore(
          score.tiebreakValue!,
          score.tiebreakScheme as ScoringWorkoutScheme,
          { compact: false },
        )
      }

      return {
        registrationId: r.registration.id,
        userId: r.user.id,
        firstName: r.user.firstName || "",
        lastName: r.user.lastName || "",
        email: r.user.email || "",
        divisionId: r.registration.divisionId,
        divisionLabel: r.division?.label ?? "Open",
        teamName: r.registration.teamName ?? null,
        teamMembers: [],
        existingResult: score
          ? {
              resultId: score.id,
              wodScore,
              scoreStatus: (score.status as ScoreStatus) ?? null,
              tieBreakScore,
              secondaryScore:
                score.secondaryValue !== null
                  ? String(score.secondaryValue)
                  : null,
              sets: rounds.sort((a, b) => a.setNumber - b.setNumber),
            }
          : null,
      }
    })

    return {
      event: {
        id: trackWorkout.id,
        trackOrder: trackWorkout.trackOrder,
        pointsMultiplier: trackWorkout.pointsMultiplier,
        workout: trackWorkout.workout,
      },
      athletes,
      divisions: allDivisions.sort((a, b) => a.position - b.position),
    }
  })

/**
 * Save a competition score (cohost)
 */
export const cohostSaveCompetitionScoreFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => cohostSaveScoreInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "results")

    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    // Get workout info
    const [workout] = await db
      .select({
        scheme: workouts.scheme,
        scoreType: workouts.scoreType,
        timeCap: workouts.timeCap,
        tiebreakScheme: workouts.tiebreakScheme,
        repsPerRound: workouts.repsPerRound,
        roundsToScore: workouts.roundsToScore,
      })
      .from(workouts)
      .where(eq(workouts.id, data.workoutId))
      .limit(1)

    if (!workout) {
      throw new Error("Workout not found")
    }

    const scheme = (data.workout?.scheme ?? workout.scheme) as ScoringWorkoutScheme
    const scoreType =
      (data.workout?.scoreType as ScoreType) ??
      (workout.scoreType as ScoreType) ??
      getDefaultScoreType(scheme)
    const timeCap = data.workout?.timeCap ?? workout.timeCap
    const tiebreakScheme =
      (data.workout?.tiebreakScheme as TiebreakScheme) ??
      (workout.tiebreakScheme as TiebreakScheme)

    const status = mapToNewStatus(data.scoreStatus)
    const statusOrder = getStatusOrder(data.scoreStatus)

    // Encode the score
    let encodedValue: number | null = null
    if (
      status === "dq" ||
      status === "withdrawn" ||
      data.score === "" ||
      data.score === "0"
    ) {
      encodedValue = status === "dq" || status === "withdrawn" ? null : 0
    } else if (status === "cap" && timeCap) {
      encodedValue = timeCap * 1000 // Convert to ms
    } else {
      encodedValue = encodeScore(data.score, scheme)
    }

    // Parse secondary value
    let secondaryValue: number | null = null
    if (data.secondaryScore && status === "cap") {
      const parsed = Number.parseInt(data.secondaryScore.trim(), 10)
      if (!Number.isNaN(parsed) && parsed >= 0) {
        secondaryValue = parsed
      }
    }

    // Encode tiebreak
    let tiebreakValue: number | null = null
    if (data.tieBreakScore && tiebreakScheme) {
      try {
        tiebreakValue = encodeScore(
          data.tieBreakScore,
          tiebreakScheme as ScoringWorkoutScheme,
        )
      } catch {
        // Ignore
      }
    }

    // Compute sort key
    const sortKey =
      encodedValue !== null
        ? computeSortKey({
            value: encodedValue,
            status,
            scheme,
            scoreType: (scoreType as "max" | "min") ?? "max",
            timeCap:
              status === "cap" && timeCap && secondaryValue !== null
                ? { ms: timeCap * 1000, secondaryValue }
                : undefined,
            tiebreak:
              tiebreakValue !== null && tiebreakScheme
                ? {
                    scheme: tiebreakScheme as "time" | "reps",
                    value: tiebreakValue,
                  }
                : undefined,
          })
        : null

    const now = new Date()

    // Check for existing score
    const [existingScore] = await db
      .select({ id: scoresTable.id })
      .from(scoresTable)
      .where(
        and(
          eq(scoresTable.competitionEventId, data.trackWorkoutId),
          eq(scoresTable.userId, data.userId),
        ),
      )
      .limit(1)

    if (existingScore) {
      // Update
      await db
        .update(scoresTable)
        .set({
          scoreValue: encodedValue,
          status,
          statusOrder,
          sortKey: sortKey ? sortKeyToString(sortKey) : null,
          secondaryValue,
          tiebreakValue,
          scheme,
          scoreType,
          tiebreakScheme,
          timeCapMs: timeCap ? timeCap * 1000 : null,
          scalingLevelId: data.divisionId,
          recordedBy: session.userId,
          updatedAt: now,
        })
        .where(eq(scoresTable.id, existingScore.id))

      // Handle round scores
      if (data.roundScores && data.roundScores.length > 0) {
        await db
          .delete(scoreRoundsTable)
          .where(eq(scoreRoundsTable.scoreId, existingScore.id))

        const roundValues = data.roundScores.map((round, i) => ({
          scoreId: existingScore.id,
          setNumber: i + 1,
          score: encodeScore(round.score, scheme),
          reps: round.parts
            ? Number.parseInt(round.parts[1], 10) || null
            : null,
        }))

        if (roundValues.length > 0) {
          await db.insert(scoreRoundsTable).values(roundValues)
        }
      }

      logInfo({
        message: "[Score] Cohost updated score",
        attributes: {
          scoreId: existingScore.id,
          competitionId: data.competitionId,
          userId: data.userId,
          recordedBy: session.userId,
        },
      })

      return { success: true, scoreId: existingScore.id }
    }

    // Insert new score
    const scoreValues = {
      competitionEventId: data.trackWorkoutId,
      userId: data.userId,
      scoreValue: encodedValue,
      status,
      statusOrder,
      sortKey: sortKey ? sortKeyToString(sortKey) : null,
      secondaryValue,
      tiebreakValue,
      scheme,
      scoreType,
      tiebreakScheme,
      timeCapMs: timeCap ? timeCap * 1000 : null,
      scalingLevelId: data.divisionId,
      recordedBy: session.userId,
      recordedAt: now,
    }

    const result = await db
      .insert(scoresTable)
      .values(scoreValues)
      .$returningId()

    const scoreId = result[0]?.id

    // Handle round scores
    if (scoreId && data.roundScores && data.roundScores.length > 0) {
      const roundValues = data.roundScores.map((round, i) => ({
        scoreId,
        setNumber: i + 1,
        score: encodeScore(round.score, scheme),
        reps: round.parts
          ? Number.parseInt(round.parts[1], 10) || null
          : null,
      }))

      if (roundValues.length > 0) {
        await db.insert(scoreRoundsTable).values(roundValues)
      }
    }

    logInfo({
      message: "[Score] Cohost saved new score",
      attributes: {
        scoreId,
        competitionId: data.competitionId,
        userId: data.userId,
        recordedBy: session.userId,
      },
    })

    return { success: true, scoreId }
  })

/**
 * Delete a competition score (cohost)
 */
export const cohostDeleteCompetitionScoreFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) => cohostDeleteScoreInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "results")
    const db = getDb()

    const [score] = await db
      .select({ id: scoresTable.id })
      .from(scoresTable)
      .where(
        and(
          eq(scoresTable.competitionEventId, data.trackWorkoutId),
          eq(scoresTable.userId, data.userId),
        ),
      )
      .limit(1)

    if (!score) {
      return { success: true }
    }

    // Delete rounds first
    await db
      .delete(scoreRoundsTable)
      .where(eq(scoreRoundsTable.scoreId, score.id))

    // Delete score
    await db.delete(scoresTable).where(eq(scoresTable.id, score.id))

    logInfo({
      message: "[Score] Cohost deleted score",
      attributes: {
        scoreId: score.id,
        competitionId: data.competitionId,
        userId: data.userId,
      },
    })

    return { success: true }
  })
