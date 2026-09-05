/**
 * Athlete Score Submission Server Functions
 *
 * Server functions for athletes to submit their own scores in online competitions.
 * Includes validation for submission windows and score format based on workout scheme.
 *
 * OBSERVABILITY:
 * - All athlete score submissions are logged with user and event IDs
 * - Submission window status checks are logged
 * - Validation failures tracked for debugging
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray, isNull, ne, type SQL } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionEventsTable,
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { scoresTable } from "@/db/schemas/scores"
import { workouts } from "@/db/schemas/workouts"
import { competitionCan } from "@/lib/competitions/capabilities"
import { perpetualSubmissionsClosed } from "@/lib/competitions/perpetual-dates"
import {
  addRequestContextAttribute,
  logEntityUpdated,
  logError,
  logInfo,
  logWarning,
  updateRequestContext,
} from "@/lib/logging"
import {
  decodeScore,
  formatScore,
  type ScoreStatus,
  type ScoreType,
  type WorkoutScheme,
} from "@/lib/scoring"
import { isBenchmarkCompetition } from "@/server/benchmark-submissions"
import {
  divisionScopeFromId,
  recordCompetitionResult,
} from "@/server/competition-results"
import { getSessionFromCookie } from "@/utils/auth"
import { AppError } from "@/utils/errors"

// ============================================================================
// Types
// ============================================================================

export interface AthleteScoreSubmission {
  trackWorkoutId: string
  score: string
  status: "scored" | "cap"
  /** Secondary score (reps at cap) for time-capped workouts */
  secondaryScore?: string
  /** Tiebreak score if applicable */
  tiebreakScore?: string
}

export interface SubmissionWindowStatus {
  isOpen: boolean
  opensAt: string | null
  closesAt: string | null
  reason?: string
}

export interface AthleteEventScore {
  scoreId: string | null
  scoreValue: number | null
  displayScore: string | null
  status: string | null
  secondaryValue: number | null
  tiebreakValue: number | null
  submittedAt: Date | null
}

export interface BenchmarkViewerScore {
  displayScore: string
  status: string | null
}

export type BenchmarkViewerScores = Record<string, BenchmarkViewerScore>

// ============================================================================
// Input Schemas
// ============================================================================

const submitScoreInputSchema = z.object({
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  divisionId: z.string().optional(),
  score: z.string().min(1, "Score is required"),
  status: z.enum(["scored", "cap"]),
  secondaryScore: z.string().optional(),
  tiebreakScore: z.string().optional(),
})

const getScoreInputSchema = z.object({
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  divisionId: z.string().optional(),
})

const getSubmissionWindowInputSchema = z.object({
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if current time is within the event's submission window.
 */
async function checkSubmissionWindow(
  competitionId: string,
  trackWorkoutId: string,
): Promise<SubmissionWindowStatus> {
  const db = getDb()

  // Get competition type
  const [competition] = await db
    .select({
      competitionType: competitionsTable.competitionType,
      startDate: competitionsTable.startDate,
      endDate: competitionsTable.endDate,
    })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  if (!competition) {
    return {
      isOpen: false,
      opensAt: null,
      closesAt: null,
      reason: "Competition not found",
    }
  }

  if (competitionCan(competition.competitionType, "perpetual")) {
    if (perpetualSubmissionsClosed(competition)) {
      return {
        isOpen: false,
        opensAt: null,
        closesAt: null,
        reason: "Submissions have closed for this competition",
      }
    }
    return {
      isOpen: true,
      opensAt: null,
      closesAt: null,
    }
  }

  if (!competitionCan(competition.competitionType, "submissionWindows")) {
    return {
      isOpen: false,
      opensAt: null,
      closesAt: null,
      reason: "This is not an online competition",
    }
  }

  // Get competition event with submission window
  const [event] = await db
    .select({
      submissionOpensAt: competitionEventsTable.submissionOpensAt,
      submissionClosesAt: competitionEventsTable.submissionClosesAt,
    })
    .from(competitionEventsTable)
    .where(
      and(
        eq(competitionEventsTable.competitionId, competitionId),
        eq(competitionEventsTable.trackWorkoutId, trackWorkoutId),
      ),
    )
    .limit(1)

  // If no event record exists, submission not configured
  if (!event) {
    return {
      isOpen: false,
      opensAt: null,
      closesAt: null,
      reason: "Submission window not configured",
    }
  }

  // If no submission window is configured, submission not allowed
  if (!event.submissionOpensAt || !event.submissionClosesAt) {
    return {
      isOpen: false,
      opensAt: null,
      closesAt: null,
      reason: "Submission window not configured",
    }
  }

  // Check if current time is within the window
  const now = new Date()
  const opensAt = new Date(event.submissionOpensAt)
  const closesAt = new Date(event.submissionClosesAt)

  if (now < opensAt) {
    return {
      isOpen: false,
      opensAt: event.submissionOpensAt,
      closesAt: event.submissionClosesAt,
      reason: "Submission window has not opened yet",
    }
  }

  if (now > closesAt) {
    return {
      isOpen: false,
      opensAt: event.submissionOpensAt,
      closesAt: event.submissionClosesAt,
      reason: "Submission window has closed",
    }
  }

  return {
    isOpen: true,
    opensAt: event.submissionOpensAt,
    closesAt: event.submissionClosesAt,
  }
}

/**
 * Resolution outcome for an athlete's division when reading/writing a score.
 * Callers handle each kind explicitly so a null divisionId is never silently
 * collapsed into an unscoped (event, user) query that leaks across divisions.
 */
type ResolvedDivision =
  | { kind: "specific"; divisionId: string }
  | { kind: "open" } // exactly one registration with a null divisionId
  | { kind: "ambiguous" } // multiple registrations and caller did not pick one
  | { kind: "notFound" } // caller asked for a divisionId the user is not in

/**
 * Resolve which division to scope a score read/write to.
 */
async function resolveAthleteDivisionId({
  competitionId,
  userId,
  requestedDivisionId,
}: {
  competitionId: string
  userId: string
  requestedDivisionId?: string
}): Promise<ResolvedDivision> {
  const db = getDb()

  const baseConditions = [
    eq(competitionRegistrationsTable.eventId, competitionId),
    eq(competitionRegistrationsTable.userId, userId),
    ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
  ]

  if (requestedDivisionId) {
    const [reg] = await db
      .select({ divisionId: competitionRegistrationsTable.divisionId })
      .from(competitionRegistrationsTable)
      .where(
        and(
          ...baseConditions,
          eq(competitionRegistrationsTable.divisionId, requestedDivisionId),
        ),
      )
      .limit(1)
    if (!reg) return { kind: "notFound" }
    return { kind: "specific", divisionId: requestedDivisionId }
  }

  const regs = await db
    .select({ divisionId: competitionRegistrationsTable.divisionId })
    .from(competitionRegistrationsTable)
    .where(and(...baseConditions))
    .limit(2)

  if (regs.length === 0) return { kind: "notFound" }
  if (regs.length > 1) return { kind: "ambiguous" }
  const divisionId = regs[0].divisionId
  return divisionId ? { kind: "specific", divisionId } : { kind: "open" }
}

/**
 * Build the predicate that scopes a score query to a resolved division. Returns
 * null when the resolved division can't pick a unique row (ambiguous or not
 * found), letting the caller short-circuit with an empty result instead of
 * dropping the divisionId predicate and reading from another division.
 */
function divisionScopePredicate(resolved: ResolvedDivision): SQL | null {
  switch (resolved.kind) {
    case "specific":
      return eq(scoresTable.scalingLevelId, resolved.divisionId)
    case "open":
      return isNull(scoresTable.scalingLevelId)
    case "ambiguous":
    case "notFound":
      return null
  }
}

const EMPTY_ATHLETE_EVENT_SCORE: AthleteEventScore = {
  scoreId: null,
  scoreValue: null,
  displayScore: null,
  status: null,
  secondaryValue: null,
  tiebreakValue: null,
  submittedAt: null,
}

function decodeAthleteScoreForDisplay(
  scoreValue: number | null,
  scheme: string,
): string | null {
  if (scoreValue === null) return null
  return decodeScore(scoreValue, scheme as WorkoutScheme, { compact: false })
}

/**
 * Read the authenticated viewer's scores for a set of competition workouts.
 *
 * The registration lookup deliberately uses the same unique-division
 * resolution as getAthleteEventScoreFn. The score lookup is one division-
 * scoped query for every requested track workout.
 */
export async function getBenchmarkViewerScores({
  competitionId,
  trackWorkoutIds,
}: {
  competitionId: string
  trackWorkoutIds: string[]
}): Promise<BenchmarkViewerScores> {
  if (trackWorkoutIds.length === 0) return {}

  const session = await getSessionFromCookie()
  if (!session?.userId) return {}

  const resolved = await resolveAthleteDivisionId({
    competitionId,
    userId: session.userId,
  })
  const divisionPredicate = divisionScopePredicate(resolved)
  if (!divisionPredicate) return {}

  const db = getDb()
  const scoreRows = await db
    .select({
      trackWorkoutId: scoresTable.competitionEventId,
      scoreValue: scoresTable.scoreValue,
      scoreType: scoresTable.scoreType,
      secondaryValue: scoresTable.secondaryValue,
      status: scoresTable.status,
      scheme: scoresTable.scheme,
      timeCapMs: scoresTable.timeCapMs,
    })
    .from(scoresTable)
    .where(
      and(
        inArray(scoresTable.competitionEventId, trackWorkoutIds),
        eq(scoresTable.userId, session.userId),
        divisionPredicate,
      ),
    )

  const viewerScores: BenchmarkViewerScores = {}
  for (const score of scoreRows) {
    if (!score.trackWorkoutId) continue
    if (score.scoreValue === null && score.status === "scored") continue

    const displayScore = formatScore({
      scheme: score.scheme as WorkoutScheme,
      scoreType: score.scoreType as ScoreType,
      value: score.scoreValue,
      status: score.status as ScoreStatus,
      timeCap:
        score.secondaryValue !== null
          ? {
              ms: score.timeCapMs ?? 0,
              secondaryValue: score.secondaryValue,
            }
          : undefined,
    })
    viewerScores[score.trackWorkoutId] = {
      displayScore,
      status: score.status,
    }
  }

  return viewerScores
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the submission window status for an event
 */
export const getSubmissionWindowStatusFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getSubmissionWindowInputSchema.parse(data))
  .handler(async ({ data }): Promise<SubmissionWindowStatus> => {
    return checkSubmissionWindow(data.competitionId, data.trackWorkoutId)
  })

/**
 * Get the athlete's existing score for an event
 */
export const getAthleteEventScoreFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getScoreInputSchema.parse(data))
  .handler(async ({ data }): Promise<AthleteEventScore> => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      logWarning({
        message: "[AthleteScore] Get score denied - not authenticated",
        attributes: {
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
        },
      })
      throw new Error("Not authenticated")
    }

    // Update request context
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)
    addRequestContextAttribute("trackWorkoutId", data.trackWorkoutId)

    const db = getDb()

    // Resolve the athlete's division for this competition. When an athlete is
    // registered in multiple divisions that share a workout, scores are keyed
    // per-division — pick the right row by scoping to divisionId. Ambiguous /
    // not-found resolutions return an empty score rather than dropping the
    // divisionId predicate (which would leak across divisions).
    const resolved = await resolveAthleteDivisionId({
      competitionId: data.competitionId,
      userId: session.userId,
      requestedDivisionId: data.divisionId,
    })

    const divisionPredicate = divisionScopePredicate(resolved)
    if (!divisionPredicate) return EMPTY_ATHLETE_EVENT_SCORE

    const scoreConditions = [
      eq(scoresTable.competitionEventId, data.trackWorkoutId),
      eq(scoresTable.userId, session.userId),
      divisionPredicate,
    ]

    // Get the user's existing score for this event (division-scoped)
    const [existingScore] = await db
      .select({
        id: scoresTable.id,
        scoreValue: scoresTable.scoreValue,
        status: scoresTable.status,
        secondaryValue: scoresTable.secondaryValue,
        tiebreakValue: scoresTable.tiebreakValue,
        recordedAt: scoresTable.recordedAt,
        scheme: scoresTable.scheme,
      })
      .from(scoresTable)
      .where(and(...scoreConditions))
      .limit(1)

    if (!existingScore) return EMPTY_ATHLETE_EVENT_SCORE

    // Decode the score for display
    const displayScore = decodeAthleteScoreForDisplay(
      existingScore.scoreValue,
      existingScore.scheme,
    )

    return {
      scoreId: existingScore.id,
      scoreValue: existingScore.scoreValue,
      displayScore,
      status: existingScore.status,
      secondaryValue: existingScore.secondaryValue,
      tiebreakValue: existingScore.tiebreakValue,
      submittedAt: existingScore.recordedAt,
    }
  })

/**
 * Submit or update an athlete's score for an event
 */
export const submitAthleteScoreFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitScoreInputSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{
      success: boolean
      scoreId: string
      message: string
    }> => {
      const session = await getSessionFromCookie()
      if (!session?.userId) {
        logWarning({
          message: "[AthleteScore] Submission denied - not authenticated",
          attributes: {
            competitionId: data.competitionId,
            trackWorkoutId: data.trackWorkoutId,
          },
        })
        throw new Error("Not authenticated")
      }

      if (await isBenchmarkCompetition(data.competitionId)) {
        throw new AppError(
          "UNPROCESSABLE_CONTENT",
          "Benchmark scores must be submitted through the benchmark submission flow",
        )
      }

      const db = getDb()

      // Update request context
      updateRequestContext({ userId: session.userId })
      addRequestContextAttribute("competitionId", data.competitionId)
      addRequestContextAttribute("trackWorkoutId", data.trackWorkoutId)

      logInfo({
        message: "[AthleteScore] Score submission started",
        attributes: {
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          userId: session.userId,
          status: data.status,
        },
      })

      // 1. Resolve the registration scoped to the division the athlete is
      // submitting for. If divisionId is provided, match it exactly. Otherwise,
      // only proceed when the user has a single registration — ambiguity between
      // multi-division registrations would silently write to the wrong division.
      const regConditions = [
        eq(competitionRegistrationsTable.eventId, data.competitionId),
        eq(competitionRegistrationsTable.userId, session.userId),
        ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
      ]
      if (data.divisionId) {
        regConditions.push(
          eq(competitionRegistrationsTable.divisionId, data.divisionId),
        )
      }

      const registrations = await db
        .select({
          id: competitionRegistrationsTable.id,
          divisionId: competitionRegistrationsTable.divisionId,
        })
        .from(competitionRegistrationsTable)
        .where(and(...regConditions))
        .limit(2)

      if (registrations.length === 0) {
        logWarning({
          message: "[AthleteScore] Submission denied - not registered",
          attributes: {
            competitionId: data.competitionId,
            trackWorkoutId: data.trackWorkoutId,
            userId: session.userId,
            divisionId: data.divisionId ?? null,
          },
        })
        throw new Error("You are not registered for this competition")
      }

      if (registrations.length > 1) {
        logWarning({
          message: "[AthleteScore] Submission denied - ambiguous division",
          attributes: {
            competitionId: data.competitionId,
            trackWorkoutId: data.trackWorkoutId,
            userId: session.userId,
          },
        })
        throw new Error(
          "You are registered in multiple divisions for this competition. Please specify which division to submit for.",
        )
      }

      const registration = registrations[0]
      addRequestContextAttribute("registrationId", registration.id)

      // 2. Check submission window
      const windowStatus = await checkSubmissionWindow(
        data.competitionId,
        data.trackWorkoutId,
      )

      if (!windowStatus.isOpen) {
        logWarning({
          message: "[AthleteScore] Submission window blocked",
          attributes: {
            competitionId: data.competitionId,
            trackWorkoutId: data.trackWorkoutId,
            userId: session.userId,
            reason: windowStatus.reason,
            opensAt: windowStatus.opensAt,
            closesAt: windowStatus.closesAt,
          },
        })
        throw new Error(windowStatus.reason || "Submission window is not open")
      }

      // The competition-result boundary loads the programmed workout and owner
      // itself, then decides and persists the claim as one canonical command.
      const receipt = await recordCompetitionResult({
        db,
        command: {
          athleteUserId: session.userId,
          trackWorkoutId: data.trackWorkoutId,
          divisionScope: divisionScopeFromId(registration.divisionId),
          claim: {
            score: data.score,
            status: data.status,
            secondaryScore: data.secondaryScore,
            tiebreakScore: data.tiebreakScore,
          },
        },
      })
      const finalScoreId = receipt.scoreId

      if (!finalScoreId) {
        logError({
          message: "[AthleteScore] Failed to retrieve score after upsert",
          attributes: {
            competitionId: data.competitionId,
            trackWorkoutId: data.trackWorkoutId,
            userId: session.userId,
          },
        })
        throw new Error("Failed to save score")
      }

      addRequestContextAttribute("scoreId", finalScoreId)
      logEntityUpdated({
        entity: "athleteScore",
        id: finalScoreId,
        attributes: {
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          userId: session.userId,
          registrationId: registration.id,
          status: data.status,
        },
      })

      logInfo({
        message: "[AthleteScore] Score submitted successfully",
        attributes: {
          scoreId: finalScoreId,
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          userId: session.userId,
          status: data.status,
        },
      })

      return {
        success: true,
        scoreId: finalScoreId,
        message: "Score submitted successfully",
      }
    },
  )

/**
 * Get workout details needed for score submission UI
 */
export const getEventWorkoutDetailsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getScoreInputSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{
      workoutId: string
      name: string
      scheme: WorkoutScheme
      scoreType: ScoreType | null
      timeCap: number | null
      tiebreakScheme: string | null
      repsPerRound: number | null
    }> => {
      const db = getDb()

      const [result] = await db
        .select({
          workoutId: workouts.id,
          name: workouts.name,
          scheme: workouts.scheme,
          scoreType: workouts.scoreType,
          timeCap: workouts.timeCap,
          tiebreakScheme: workouts.tiebreakScheme,
          repsPerRound: workouts.repsPerRound,
        })
        .from(trackWorkoutsTable)
        .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
        .limit(1)

      if (!result) {
        throw new Error("Event not found")
      }

      return {
        workoutId: result.workoutId,
        name: result.name,
        scheme: result.scheme as WorkoutScheme,
        scoreType: result.scoreType as ScoreType | null,
        timeCap: result.timeCap,
        tiebreakScheme: result.tiebreakScheme,
        repsPerRound: result.repsPerRound,
      }
    },
  )
