/**
 * Video Submission Server Functions for TanStack Start
 * Handles athlete video submissions for online competition events.
 * Includes claimed score submission alongside video.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, count, eq, inArray, isNotNull, ne, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionEventsTable,
  competitionRegistrationsTable,
  competitionsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoreRoundsTable, scoresTable } from "@/db/schemas/scores"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import type { ReviewStatus } from "@/db/schemas/video-submissions"
import {
  createVideoSubmissionId,
  videoSubmissionsTable,
} from "@/db/schemas/video-submissions"
import { videoVotesTable } from "@/db/schemas/video-votes"
import type { TiebreakScheme } from "@/db/schemas/workouts"
import { workouts } from "@/db/schemas/workouts"
import {
  computeSortKey,
  decodeScore,
  encodeRounds,
  encodeScore,
  getDefaultScoreType,
  parseScore,
  type ScoreType,
  STATUS_ORDER,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"
import { getSessionFromCookie } from "@/utils/auth"
import { autochunk } from "@/utils/batch-query"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const getVideoSubmissionInputSchema = z.object({
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionId: z.string().optional(),
})

const getOrganizerSubmissionsInputSchema = z.object({
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionFilter: z.string().optional(),
  statusFilter: z.enum(["all", "pending", "reviewed"]).optional(),
})

const submitVideoInputSchema = z.object({
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  competitionId: z.string().min(1, "Competition ID is required"),
  divisionId: z.string().optional(),
  videoUrl: z.string().url("Please enter a valid URL").max(2000),
  notes: z.string().max(1000).optional(),
  // 0-indexed position for team video submissions (0 for individuals)
  videoIndex: z.number().int().min(0).optional().default(0),
  // Score fields
  score: z.string().optional(),
  scoreStatus: z.enum(["scored", "cap"]).optional(),
  secondaryScore: z.string().optional(),
  tiebreakScore: z.string().optional(),
  // Per-round scores for multi-round workouts
  roundScores: z
    .array(z.object({ score: z.string() }))
    .optional(),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map status to the simplified type for scores table.
 */
function getStatusOrder(status: "scored" | "cap"): number {
  switch (status) {
    case "scored":
      return STATUS_ORDER.scored
    case "cap":
      return STATUS_ORDER.cap
    default:
      return STATUS_ORDER.scored
  }
}

/**
 * Check if current time is within the event's submission window.
 * Only applies to online competitions.
 */
async function checkSubmissionWindow(
  competitionId: string,
  trackWorkoutId: string,
): Promise<{
  allowed: boolean
  reason?: string
  opensAt?: Date
  closesAt?: Date
}> {
  const db = getDb()

  // Get competition type
  const [competition] = await db
    .select({
      competitionType: competitionsTable.competitionType,
    })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  if (!competition) {
    return { allowed: false, reason: "Competition not found" }
  }

  // Only check submission windows for online competitions
  if (competition.competitionType !== "online") {
    return {
      allowed: false,
      reason: "Video submissions are only for online competitions",
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

  // If no event record exists, allow submission (backward compatibility)
  if (!event) {
    return { allowed: true }
  }

  // If no submission window is configured, allow submission
  if (!event.submissionOpensAt || !event.submissionClosesAt) {
    return { allowed: true }
  }

  // Parse dates
  const now = new Date()
  const opensAt = new Date(event.submissionOpensAt)
  const closesAt = new Date(event.submissionClosesAt)

  if (now < opensAt) {
    return {
      allowed: false,
      reason: "Submission window has not opened yet",
      opensAt,
      closesAt,
    }
  }

  if (now > closesAt) {
    return {
      allowed: false,
      reason: "Submission window has closed",
      opensAt,
      closesAt,
    }
  }

  return { allowed: true, opensAt, closesAt }
}

/**
 * Get the athlete's registration for a competition.
 * When divisionId is provided, returns the registration for that specific division.
 * When omitted, falls back to the first registration found (backward compat).
 * For team members, returns the captain's registration with isCaptain=false.
 */
async function getAthleteRegistration(
  competitionId: string,
  userId: string,
  divisionId?: string,
): Promise<{
  id: string
  divisionId: string | null
  captainUserId: string | null
  athleteTeamId: string | null
  isCaptain: boolean
} | null> {
  const db = getDb()

  // Build where conditions — include divisionId filter when provided
  const conditions = [
    eq(competitionRegistrationsTable.eventId, competitionId),
    eq(competitionRegistrationsTable.userId, userId),
    ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
  ]
  if (divisionId) {
    conditions.push(eq(competitionRegistrationsTable.divisionId, divisionId))
  }

  // First, look for the user's own registration (works for captains and individuals)
  const [registration] = await db
    .select({
      id: competitionRegistrationsTable.id,
      divisionId: competitionRegistrationsTable.divisionId,
      captainUserId: competitionRegistrationsTable.captainUserId,
      athleteTeamId: competitionRegistrationsTable.athleteTeamId,
    })
    .from(competitionRegistrationsTable)
    .where(and(...conditions))
    .limit(1)

  if (!registration) {
    return null
  }

  // Individual registration (no team) — always treated as captain
  if (!registration.athleteTeamId) {
    return { ...registration, isCaptain: true }
  }

  // Team registration — check if this user is the captain
  const isCaptain = registration.captainUserId === userId

  // If captain, use their own registration
  if (isCaptain) {
    return { ...registration, isCaptain: true }
  }

  // Non-captain team member: find the captain's registration (used for video submissions)
  const [captainReg] = await db
    .select({
      id: competitionRegistrationsTable.id,
      divisionId: competitionRegistrationsTable.divisionId,
      captainUserId: competitionRegistrationsTable.captainUserId,
      athleteTeamId: competitionRegistrationsTable.athleteTeamId,
    })
    .from(competitionRegistrationsTable)
    .where(
      and(
        eq(competitionRegistrationsTable.eventId, competitionId),
        eq(
          competitionRegistrationsTable.athleteTeamId,
          registration.athleteTeamId,
        ),
        eq(competitionRegistrationsTable.userId, registration.captainUserId!),
        ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
      ),
    )
    .limit(1)

  // Return captain's registration with isCaptain=false for the current user
  if (captainReg) {
    return { ...captainReg, isCaptain: false }
  }

  // Fallback: captain registration not found, use the member's own
  return { ...registration, isCaptain: false }
}

/**
 * Get the team size for a division. Returns 1 for individuals.
 */
async function getTeamSize(divisionId: string | null): Promise<number> {
  if (!divisionId) return 1
  const db = getDb()
  const [division] = await db
    .select({ teamSize: scalingLevelsTable.teamSize })
    .from(scalingLevelsTable)
    .where(eq(scalingLevelsTable.id, divisionId))
    .limit(1)
  return division?.teamSize ?? 1
}

/**
 * Get workout details needed for score submission.
 */
async function getWorkoutDetails(trackWorkoutId: string) {
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
      roundsToScore: workouts.roundsToScore,
      trackId: trackWorkoutsTable.trackId,
    })
    .from(trackWorkoutsTable)
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .where(eq(trackWorkoutsTable.id, trackWorkoutId))
    .limit(1)

  return result ?? null
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the current user's video submission(s) for an event.
 * For teams, returns all video submissions (up to teamSize) and captain status.
 * For individuals, returns a single submission (backward compatible).
 */
export const getVideoSubmissionFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getVideoSubmissionInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      return {
        submissions: [],
        teamSize: 1,
        isCaptain: true,
        canSubmit: false,
        reason: "Not authenticated",
        isRegistered: false,
        workout: null,
        existingScore: null,
      }
    }

    const db = getDb()

    // Check if user is registered for this competition (scoped to division when provided)
    const registration = await getAthleteRegistration(
      data.competitionId,
      session.userId,
      data.divisionId,
    )

    if (!registration) {
      return {
        submissions: [],
        teamSize: 1,
        isCaptain: true,
        canSubmit: false,
        reason: "You must be registered for this competition to submit a video",
        isRegistered: false,
        workout: null,
        existingScore: null,
      }
    }

    // Check submission window
    const windowCheck = await checkSubmissionWindow(
      data.competitionId,
      data.trackWorkoutId,
    )

    // Get team size for this division
    const teamSize = await getTeamSize(registration.divisionId)

    // Non-captain team members cannot submit
    const canSubmit = windowCheck.allowed && registration.isCaptain
    const reason = !registration.isCaptain
      ? "Only the team captain can submit videos and scores"
      : windowCheck.reason

    // Get all existing submissions for this registration + event (ordered by videoIndex)
    const submissions = await db
      .select({
        id: videoSubmissionsTable.id,
        videoIndex: videoSubmissionsTable.videoIndex,
        videoUrl: videoSubmissionsTable.videoUrl,
        notes: videoSubmissionsTable.notes,
        submittedAt: videoSubmissionsTable.submittedAt,
        updatedAt: videoSubmissionsTable.updatedAt,
        reviewStatus: videoSubmissionsTable.reviewStatus,
        statusUpdatedAt: videoSubmissionsTable.statusUpdatedAt,
        reviewerNotes: videoSubmissionsTable.reviewerNotes,
      })
      .from(videoSubmissionsTable)
      .where(
        and(
          eq(videoSubmissionsTable.registrationId, registration.id),
          eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
        ),
      )
      .orderBy(videoSubmissionsTable.videoIndex)

    // Get workout details for score input
    const workout = await getWorkoutDetails(data.trackWorkoutId)

    // Get existing score — for teams, look up by captain's userId
    let existingScore: {
      scoreValue: number | null
      displayScore: string | null
      status: string | null
      secondaryValue: number | null
      tiebreakValue: number | null
      roundScores: Array<{
        roundNumber: number
        value: number
        displayScore: string | null
      }>
    } | null = null

    // Score belongs to the captain (or the individual athlete)
    const scoreUserId = registration.captainUserId ?? session.userId

    // Scope score lookup by division when available
    const scoreConditions = [
      eq(scoresTable.competitionEventId, data.trackWorkoutId),
      eq(scoresTable.userId, scoreUserId),
    ]
    if (registration.divisionId) {
      scoreConditions.push(
        eq(scoresTable.scalingLevelId, registration.divisionId),
      )
    }

    const [score] = await db
      .select({
        id: scoresTable.id,
        scoreValue: scoresTable.scoreValue,
        status: scoresTable.status,
        secondaryValue: scoresTable.secondaryValue,
        tiebreakValue: scoresTable.tiebreakValue,
        scheme: scoresTable.scheme,
      })
      .from(scoresTable)
      .where(and(...scoreConditions))
      .limit(1)

    if (score) {
      let displayScore: string | null = null
      if (score.scoreValue !== null && score.scheme) {
        displayScore = decodeScore(
          score.scoreValue,
          score.scheme as WorkoutScheme,
          { compact: false },
        )
      }

      // Load round scores if this is a multi-round workout
      let roundScores: Array<{
        roundNumber: number
        value: number
        displayScore: string | null
        status: string | null
      }> = []

      if (workout && (workout.roundsToScore ?? 1) > 1) {
        const rounds = await db
          .select({
            roundNumber: scoreRoundsTable.roundNumber,
            value: scoreRoundsTable.value,
            status: scoreRoundsTable.status,
          })
          .from(scoreRoundsTable)
          .where(eq(scoreRoundsTable.scoreId, score.id))
          .orderBy(asc(scoreRoundsTable.roundNumber))

        roundScores = rounds.map((r) => ({
          roundNumber: r.roundNumber,
          value: r.value,
          displayScore: score.scheme
            ? decodeScore(r.value, score.scheme as WorkoutScheme, {
                compact: false,
              })
            : null,
          status: r.status,
        }))
      }

      existingScore = {
        scoreValue: score.scoreValue,
        displayScore,
        status: score.status,
        secondaryValue: score.secondaryValue,
        tiebreakValue: score.tiebreakValue,
        roundScores,
      }
    }

    return {
      submissions: submissions.map((s) => ({
        ...s,
        reviewStatus: s.reviewStatus as ReviewStatus,
      })),
      teamSize,
      isCaptain: registration.isCaptain,
      canSubmit,
      reason,
      isRegistered: true,
      submissionWindow:
        windowCheck.opensAt && windowCheck.closesAt
          ? {
              opensAt: windowCheck.opensAt.toISOString(),
              closesAt: windowCheck.closesAt.toISOString(),
            }
          : null,
      workout: workout
        ? {
            workoutId: workout.workoutId,
            name: workout.name,
            scheme: workout.scheme as WorkoutScheme,
            scoreType: workout.scoreType as ScoreType | null,
            timeCap: workout.timeCap,
            tiebreakScheme: workout.tiebreakScheme,
            repsPerRound: workout.repsPerRound,
            roundsToScore: workout.roundsToScore,
          }
        : null,
      existingScore,
    }
  })

/**
 * Batch-check submission status for multiple track workouts.
 * Returns a map of trackWorkoutId -> { hasSubmitted, submittedCount, teamSize, canSubmit }
 * Only meaningful for online competitions with a registered athlete.
 */
export const getBatchSubmissionStatusFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionId: z.string().min(1),
        trackWorkoutIds: z.array(z.string().min(1)).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    type Status = {
      hasSubmitted: boolean
      submittedCount: number
      teamSize: number
      canSubmit: boolean
    }
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      return { statuses: {} as Record<string, Status> }
    }

    const db = getDb()

    const registration = await getAthleteRegistration(
      data.competitionId,
      session.userId,
    )
    if (!registration) {
      return { statuses: {} as Record<string, Status> }
    }

    const teamSize = await getTeamSize(registration.divisionId)

    // Fetch submission windows and existing submissions in parallel
    const [events, submissions] = await Promise.all([
      db
        .select({
          trackWorkoutId: competitionEventsTable.trackWorkoutId,
          submissionOpensAt: competitionEventsTable.submissionOpensAt,
          submissionClosesAt: competitionEventsTable.submissionClosesAt,
        })
        .from(competitionEventsTable)
        .where(
          and(
            eq(competitionEventsTable.competitionId, data.competitionId),
            inArray(
              competitionEventsTable.trackWorkoutId,
              data.trackWorkoutIds,
            ),
          ),
        ),
      db
        .select({
          trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
          videoIndex: videoSubmissionsTable.videoIndex,
        })
        .from(videoSubmissionsTable)
        .where(
          and(
            eq(videoSubmissionsTable.registrationId, registration.id),
            inArray(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutIds),
          ),
        ),
    ])

    // Count submissions per trackWorkoutId
    const submissionCountMap = new Map<string, number>()
    for (const s of submissions) {
      submissionCountMap.set(
        s.trackWorkoutId,
        (submissionCountMap.get(s.trackWorkoutId) ?? 0) + 1,
      )
    }

    const eventMap = new Map(events.map((e) => [e.trackWorkoutId, e]))
    const now = new Date()

    const statuses: Record<string, Status> = {}

    for (const twId of data.trackWorkoutIds) {
      const event = eventMap.get(twId)
      let canSubmit = registration.isCaptain

      if (canSubmit && event?.submissionOpensAt && event?.submissionClosesAt) {
        const opensAt = new Date(event.submissionOpensAt)
        const closesAt = new Date(event.submissionClosesAt)
        canSubmit = now >= opensAt && now <= closesAt
      }

      const submittedCount = submissionCountMap.get(twId) ?? 0

      statuses[twId] = {
        hasSubmitted: submittedCount > 0,
        submittedCount,
        teamSize,
        canSubmit,
      }
    }

    return { statuses }
  })

/**
 * Per-division submission & score data for the athlete score panel.
 * Returns for each (registration, trackWorkout) pair:
 *  - whether a video has been submitted & its review status
 *  - the athlete's score display value + status
 *  - whether the submission window is open
 */
export const getAthleteDivisionSubmissionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionId: z.string().min(1),
        trackWorkoutIds: z.array(z.string().min(1)).min(1),
        registrationId: z.string().min(1),
        divisionId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    interface WorkoutSubmission {
      trackWorkoutId: string
      hasVideo: boolean
      videoReviewStatus: ReviewStatus | null
      hasScore: boolean
      displayScore: string | null
      scoreStatus: string | null
      secondaryValue: number | null
      verificationStatus: string | null
      canSubmit: boolean
      windowStatus: "open" | "not_yet_open" | "closed" | "no_window"
    }

    const session = await getSessionFromCookie()
    if (!session?.userId) {
      return { submissions: [] as WorkoutSubmission[] }
    }

    const db = getDb()

    // Verify the registration belongs to the user (or their team captain)
    const [registration] = await db
      .select({
        id: competitionRegistrationsTable.id,
        userId: competitionRegistrationsTable.userId,
        captainUserId: competitionRegistrationsTable.captainUserId,
        divisionId: competitionRegistrationsTable.divisionId,
      })
      .from(competitionRegistrationsTable)
      .where(
        and(
          eq(competitionRegistrationsTable.id, data.registrationId),
          ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
        ),
      )
      .limit(1)

    if (!registration) {
      return { submissions: [] as WorkoutSubmission[] }
    }

    // Ensure the user owns this registration or is a team member
    const isOwner = registration.userId === session.userId
    const isCaptain = registration.captainUserId === session.userId
    if (!isOwner && !isCaptain) {
      return { submissions: [] as WorkoutSubmission[] }
    }

    // For team registrations, only the captain can submit
    const isTeamCaptain = !registration.captainUserId || registration.captainUserId === session.userId
    const scoreUserId = registration.captainUserId ?? registration.userId

    // Fetch events, video submissions, and scores in parallel
    const [events, videoSubs, scores] = await Promise.all([
      db
        .select({
          trackWorkoutId: competitionEventsTable.trackWorkoutId,
          submissionOpensAt: competitionEventsTable.submissionOpensAt,
          submissionClosesAt: competitionEventsTable.submissionClosesAt,
        })
        .from(competitionEventsTable)
        .where(
          and(
            eq(competitionEventsTable.competitionId, data.competitionId),
            inArray(
              competitionEventsTable.trackWorkoutId,
              data.trackWorkoutIds,
            ),
          ),
        ),
      db
        .select({
          trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
          reviewStatus: videoSubmissionsTable.reviewStatus,
        })
        .from(videoSubmissionsTable)
        .where(
          and(
            eq(videoSubmissionsTable.registrationId, data.registrationId),
            inArray(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutIds),
          ),
        ),
      db
        .select({
          competitionEventId: scoresTable.competitionEventId,
          scoreValue: scoresTable.scoreValue,
          secondaryValue: scoresTable.secondaryValue,
          status: scoresTable.status,
          scheme: scoresTable.scheme,
          verificationStatus: scoresTable.verificationStatus,
        })
        .from(scoresTable)
        .where(
          and(
            eq(scoresTable.userId, scoreUserId),
            inArray(scoresTable.competitionEventId, data.trackWorkoutIds),
            ...(data.divisionId
              ? [eq(scoresTable.scalingLevelId, data.divisionId)]
              : []),
          ),
        ),
    ])

    const eventMap = new Map(events.map((e) => [e.trackWorkoutId, e]))
    // Group videos by trackWorkoutId, pick highest-precedence review status
    const reviewStatusPrecedence: Record<string, number> = {
      verified: 4,
      approved: 3,
      under_review: 2,
      adjusted: 1,
      penalized: 1,
      invalid: 0,
    }
    const videoMap = new Map<
      string,
      { hasVideo: boolean; reviewStatus: ReviewStatus | null }
    >()
    for (const v of videoSubs) {
      const existing = videoMap.get(v.trackWorkoutId)
      const newStatus = v.reviewStatus as ReviewStatus | null
      if (!existing) {
        videoMap.set(v.trackWorkoutId, {
          hasVideo: true,
          reviewStatus: newStatus,
        })
      } else {
        const existingRank = existing.reviewStatus
          ? (reviewStatusPrecedence[existing.reviewStatus] ?? -1)
          : -1
        const newRank = newStatus
          ? (reviewStatusPrecedence[newStatus] ?? -1)
          : -1
        if (newRank > existingRank) {
          existing.reviewStatus = newStatus
        }
      }
    }
    const scoreMap = new Map(
      scores.map((s) => [s.competitionEventId, s]),
    )

    const now = new Date()
    const submissions: WorkoutSubmission[] = data.trackWorkoutIds.map(
      (twId) => {
        const event = eventMap.get(twId)
        let canSubmit = isTeamCaptain
        let windowStatus: WorkoutSubmission["windowStatus"] = "no_window"

        if (event?.submissionOpensAt && event?.submissionClosesAt) {
          const opensAt = new Date(event.submissionOpensAt)
          const closesAt = new Date(event.submissionClosesAt)
          if (now < opensAt) {
            canSubmit = false
            windowStatus = "not_yet_open"
          } else if (now > closesAt) {
            canSubmit = false
            windowStatus = "closed"
          } else {
            canSubmit = isTeamCaptain
            windowStatus = "open"
          }
        }

        const video = videoMap.get(twId)
        const score = scoreMap.get(twId)
        let displayScore: string | null = null
        if (score?.scoreValue !== null && score?.scheme) {
          displayScore = decodeScore(
            score.scoreValue!,
            score.scheme as WorkoutScheme,
            { compact: true },
          )
        }

        return {
          trackWorkoutId: twId,
          hasVideo: video?.hasVideo ?? false,
          videoReviewStatus: video?.reviewStatus ?? null,
          hasScore: score !== undefined && score.scoreValue !== null,
          displayScore,
          scoreStatus: score?.status ?? null,
          secondaryValue: score?.secondaryValue ?? null,
          verificationStatus: score?.verificationStatus ?? null,
          canSubmit,
          windowStatus,
        }
      },
    )

    return { submissions }
  })

/**
 * Submit or update a video submission for an event.
 * Also saves the claimed score to the scores table.
 * Only the team captain can submit for team divisions.
 * Athletes can re-submit until the submission window closes.
 */
export const submitVideoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitVideoInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    // Check if user is registered for this competition (scoped to division when provided)
    const registration = await getAthleteRegistration(
      data.competitionId,
      session.userId,
      data.divisionId,
    )

    if (!registration) {
      throw new Error(
        "You must be registered for this competition to submit a video",
      )
    }

    // Only team captains can submit for team divisions
    if (!registration.isCaptain) {
      throw new Error("Only the team captain can submit videos and scores")
    }

    // Check submission window
    const windowCheck = await checkSubmissionWindow(
      data.competitionId,
      data.trackWorkoutId,
    )

    if (!windowCheck.allowed) {
      throw new Error(windowCheck.reason ?? "Cannot submit video at this time")
    }

    // Validate videoIndex against team size
    const teamSize = await getTeamSize(registration.divisionId)
    if (data.videoIndex >= teamSize) {
      throw new Error(
        `Video index ${data.videoIndex} exceeds team size of ${teamSize}`,
      )
    }

    // Check for existing video submission at this index
    const [existingSubmission] = await db
      .select({ id: videoSubmissionsTable.id })
      .from(videoSubmissionsTable)
      .where(
        and(
          eq(videoSubmissionsTable.registrationId, registration.id),
          eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
          eq(videoSubmissionsTable.videoIndex, data.videoIndex),
        ),
      )
      .limit(1)

    const now = new Date()

    // Save or update video submission
    let submissionId: string

    if (existingSubmission) {
      // Update existing submission
      await db
        .update(videoSubmissionsTable)
        .set({
          videoUrl: data.videoUrl,
          notes: data.notes ?? null,
          submittedAt: now,
          updatedAt: now,
        })
        .where(eq(videoSubmissionsTable.id, existingSubmission.id))

      submissionId = existingSubmission.id
    } else {
      // Create new submission
      const id = createVideoSubmissionId()
      await db.insert(videoSubmissionsTable).values({
        id,
        registrationId: registration.id,
        trackWorkoutId: data.trackWorkoutId,
        videoIndex: data.videoIndex,
        userId: session.userId,
        videoUrl: data.videoUrl,
        notes: data.notes ?? null,
        submittedAt: now,
      })

      submissionId = id
    }

    // Save claimed score if provided (single score or round scores)
    const hasRoundScores =
      data.roundScores && data.roundScores.length > 0
    const hasScore = data.score || hasRoundScores

    if (hasScore) {
      // Get workout details for encoding
      const workout = await getWorkoutDetails(data.trackWorkoutId)

      if (!workout) {
        throw new Error("Workout not found")
      }

      const scheme = workout.scheme as WorkoutScheme
      const scoreType =
        (workout.scoreType as ScoreType) || getDefaultScoreType(scheme)

      // Encode the score — multi-round or single
      let encodedValue: number | null = null
      let encodedRounds: number[] = []

      if (hasRoundScores && data.roundScores) {
        // Multi-round: validate and encode each round, then aggregate
        for (const rs of data.roundScores) {
          const roundResult = parseScore(rs.score, scheme)
          if (!roundResult.isValid) {
            throw new Error(
              `Invalid round score: ${roundResult.error || "Please check your entry"}`,
            )
          }
        }
        const roundInputs = data.roundScores.map((rs) => ({ raw: rs.score }))
        const roundsResult = encodeRounds(roundInputs, scheme, scoreType)
        encodedValue = roundsResult.aggregated
        encodedRounds = roundsResult.rounds
      } else if (data.score) {
        // Single score: parse and encode directly
        const parseResult = parseScore(data.score, scheme)
        if (!parseResult.isValid) {
          throw new Error(
            `Invalid score format: ${parseResult.error || "Please check your entry"}`,
          )
        }
        encodedValue = encodeScore(data.score, scheme)
      }

      // Derive status server-side (ignore client-provided scoreStatus)
      // For time-with-cap:
      // - Single-round: time >= cap → capped, clamp to cap
      // - Multi-round: cap applies per round. Any round with encoded time >= cap
      //   is capped for that round; summed total is preserved so the display
      //   reflects what the team actually entered (e.g., 4:00 + 10:02 = 14:02).
      //   Under the "missed reps add seconds" convention, a capped round's
      //   encoded value already bakes in the penalty, so the sum is meaningful.
      let status: "scored" | "cap" = "scored"
      let secondaryValue: number | null = null
      const roundStatuses: Array<"scored" | "cap"> = []

      if (
        scheme === "time-with-cap" &&
        workout.timeCap &&
        encodedValue !== null
      ) {
        const capMs = workout.timeCap * 1000

        if (hasRoundScores && encodedRounds.length > 0) {
          // Per-round cap inference — don't clamp the summed total.
          let cappedCount = 0
          for (const roundValue of encodedRounds) {
            const isRoundCapped = roundValue >= capMs
            roundStatuses.push(isRoundCapped ? "cap" : "scored")
            if (isRoundCapped) cappedCount++
          }
          if (cappedCount > 0) {
            status = "cap"
          }
        } else if (encodedValue >= capMs) {
          // Single-round: preserve legacy clamp + reps-at-cap behavior
          status = "cap"
          encodedValue = capMs

          if (data.secondaryScore) {
            const trimmed = data.secondaryScore.trim()
            if (trimmed) {
              const parsed = Number.parseInt(trimmed, 10)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                secondaryValue = parsed
              }
            }
          }
        }
      }

      // Parse tiebreak score
      let tiebreakValue: number | null = null
      if (data.tiebreakScore && workout.tiebreakScheme) {
        tiebreakValue = encodeScore(
          data.tiebreakScore,
          workout.tiebreakScheme as WorkoutScheme,
        )
        if (tiebreakValue === null) {
          throw new Error(
            `Invalid tiebreak score format: "${data.tiebreakScore}". Please check your entry.`,
          )
        }
      }

      // Time cap in milliseconds
      const timeCapMs = workout.timeCap ? workout.timeCap * 1000 : null

      // Compute sort key (includes secondary_value and tiebreak for proper ordering)
      const sortKey =
        encodedValue !== null
          ? computeSortKey({
              value: encodedValue,
              status,
              scheme,
              scoreType,
              timeCap:
                status === "cap" && secondaryValue !== null
                  ? { ms: timeCapMs ?? 0, secondaryValue }
                  : undefined,
              tiebreak:
                tiebreakValue !== null && workout.tiebreakScheme
                  ? {
                      scheme: workout.tiebreakScheme as "time" | "reps",
                      value: tiebreakValue,
                    }
                  : undefined,
            })
          : null

      // Get teamId from track
      const [track] = await db
        .select({
          ownerTeamId: programmingTracksTable.ownerTeamId,
        })
        .from(programmingTracksTable)
        .where(eq(programmingTracksTable.id, workout.trackId))
        .limit(1)

      if (!track?.ownerTeamId) {
        throw new Error("Could not determine team ownership")
      }

      // Upsert the score
      await db
        .insert(scoresTable)
        .values({
          userId: session.userId,
          teamId: track.ownerTeamId,
          workoutId: workout.workoutId,
          competitionEventId: data.trackWorkoutId,
          scheme,
          scoreType,
          scoreValue: encodedValue,
          status,
          statusOrder: getStatusOrder(status),
          sortKey: sortKey ? sortKeyToString(sortKey) : null,
          tiebreakScheme: (workout.tiebreakScheme as TiebreakScheme) ?? null,
          tiebreakValue,
          timeCapMs,
          secondaryValue,
          scalingLevelId: registration.divisionId,
          asRx: true,
          recordedAt: now,
        })
        .onDuplicateKeyUpdate({
          set: {
            scoreValue: encodedValue,
            status,
            statusOrder: getStatusOrder(status),
            sortKey: sortKey ? sortKeyToString(sortKey) : null,
            tiebreakScheme: (workout.tiebreakScheme as TiebreakScheme) ?? null,
            tiebreakValue,
            timeCapMs,
            secondaryValue,
            scalingLevelId: registration.divisionId,
            updatedAt: now,
          },
        })

      // Save round scores if multi-round
      if (encodedRounds.length > 0) {
        // Look up the score ID for the upserted score
        const [upsertedScore] = await db
          .select({ id: scoresTable.id })
          .from(scoresTable)
          .where(
            and(
              eq(scoresTable.competitionEventId, data.trackWorkoutId),
              eq(scoresTable.userId, session.userId),
              registration.divisionId
                ? eq(scoresTable.scalingLevelId, registration.divisionId)
                : sql`1=1`,
            ),
          )
          .limit(1)

        if (upsertedScore) {
          // Delete existing rounds
          await db
            .delete(scoreRoundsTable)
            .where(eq(scoreRoundsTable.scoreId, upsertedScore.id))

          // Insert new rounds. Persist per-round cap status from the
          // per-round derivation above so the leaderboard can later rank
          // by number of capped rounds.
          const roundsToInsert = encodedRounds.map((value, index) => ({
            scoreId: upsertedScore.id,
            roundNumber: index + 1,
            value,
            status: roundStatuses[index] ?? null,
          }))

          await db.insert(scoreRoundsTable).values(roundsToInsert)
        }
      }
    }

    return {
      success: true,
      submissionId,
      isUpdate: !!existingSubmission,
    }
  })

/**
 * Get all video submissions for an event (organizer view).
 * Includes athlete info, division, and review status (based on whether a verified score exists).
 */
export const getOrganizerSubmissionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getOrganizerSubmissionsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify user is authenticated and has organizer permission
    const [competition] = await db
      .select({ organizingTeamId: competitionsTable.organizingTeamId })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!competition) {
      throw new Error("NOT_FOUND: Competition not found")
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    // Get all video submissions for this event with athlete and registration info
    const submissions = await db
      .select({
        id: videoSubmissionsTable.id,
        videoIndex: videoSubmissionsTable.videoIndex,
        videoUrl: videoSubmissionsTable.videoUrl,
        notes: videoSubmissionsTable.notes,
        submittedAt: videoSubmissionsTable.submittedAt,
        reviewedAt: videoSubmissionsTable.reviewedAt,
        registrationId: videoSubmissionsTable.registrationId,
        userId: videoSubmissionsTable.userId,
        // Athlete info
        athleteFirstName: userTable.firstName,
        athleteLastName: userTable.lastName,
        athleteEmail: userTable.email,
        athleteAvatar: userTable.avatar,
        // Division info
        divisionId: competitionRegistrationsTable.divisionId,
        divisionLabel: scalingLevelsTable.label,
        // Team name (for team divisions)
        teamName: competitionRegistrationsTable.teamName,
      })
      .from(videoSubmissionsTable)
      .innerJoin(
        competitionRegistrationsTable,
        eq(
          videoSubmissionsTable.registrationId,
          competitionRegistrationsTable.id,
        ),
      )
      .innerJoin(userTable, eq(videoSubmissionsTable.userId, userTable.id))
      .leftJoin(
        scalingLevelsTable,
        eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
      )
      .where(eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId))
      .orderBy(asc(videoSubmissionsTable.videoIndex))

    // Get scores for all submissions to determine review status
    // A submission is "reviewed" if there's a corresponding score entry
    const submissionUserIds = submissions.map((s) => s.userId)

    const scoresMap: Record<
      string,
      { scoreValue: number | null; status: string; displayScore: string | null }
    > = {}

    if (submissionUserIds.length > 0) {
      const scores = await db
        .select({
          userId: scoresTable.userId,
          scoreValue: scoresTable.scoreValue,
          status: scoresTable.status,
          scheme: scoresTable.scheme,
        })
        .from(scoresTable)
        .where(eq(scoresTable.competitionEventId, data.trackWorkoutId))

      for (const score of scores) {
        let displayScore: string | null = null
        if (score.scoreValue !== null && score.scheme) {
          displayScore = decodeScore(
            score.scoreValue,
            score.scheme as WorkoutScheme,
            { compact: false },
          )
        }
        scoresMap[score.userId] = {
          scoreValue: score.scoreValue,
          status: score.status,
          displayScore,
        }
      }
    }

    // Batch-fetch vote counts for all submissions
    const submissionIds = submissions.map((s) => s.id)
    const voteCountsMap: Record<
      string,
      { upvotes: number; downvotes: number }
    > = {}

    if (submissionIds.length > 0) {
      const voteCounts = await db
        .select({
          videoSubmissionId: videoVotesTable.videoSubmissionId,
          voteType: videoVotesTable.voteType,
          count: count(),
        })
        .from(videoVotesTable)
        .where(inArray(videoVotesTable.videoSubmissionId, submissionIds))
        .groupBy(videoVotesTable.videoSubmissionId, videoVotesTable.voteType)

      for (const row of voteCounts) {
        if (!voteCountsMap[row.videoSubmissionId]) {
          voteCountsMap[row.videoSubmissionId] = { upvotes: 0, downvotes: 0 }
        }
        if (row.voteType === "upvote") {
          voteCountsMap[row.videoSubmissionId].upvotes = row.count
        } else if (row.voteType === "downvote") {
          voteCountsMap[row.videoSubmissionId].downvotes = row.count
        }
      }
    }

    // Combine submissions with scores and vote counts
    const result = submissions.map((submission) => {
      const score = scoresMap[submission.userId]
      const votes = voteCountsMap[submission.id] ?? {
        upvotes: 0,
        downvotes: 0,
      }
      return {
        id: submission.id,
        videoIndex: submission.videoIndex,
        videoUrl: submission.videoUrl,
        notes: submission.notes,
        submittedAt: submission.submittedAt,
        registrationId: submission.registrationId,
        athlete: {
          id: submission.userId,
          firstName: submission.athleteFirstName,
          lastName: submission.athleteLastName,
          email: submission.athleteEmail,
          avatar: submission.athleteAvatar,
        },
        division: submission.divisionId
          ? {
              id: submission.divisionId,
              label: submission.divisionLabel,
            }
          : null,
        teamName: submission.teamName,
        score: score
          ? {
              value: score.scoreValue,
              displayScore: score.displayScore,
              status: score.status,
            }
          : null,
        votes,
        // Review status based on whether an organizer has reviewed
        reviewStatus: submission.reviewedAt
          ? ("reviewed" as const)
          : ("pending" as const),
      }
    })

    // Apply filters
    let filtered = result

    // Division filter
    if (data.divisionFilter) {
      filtered = filtered.filter((s) => s.division?.id === data.divisionFilter)
    }

    // Status filter
    if (data.statusFilter && data.statusFilter !== "all") {
      filtered = filtered.filter((s) => s.reviewStatus === data.statusFilter)
    }

    // Compute per-registration review status from the full (unfiltered) set
    // so grouped rows show correct status even when a status filter is active
    const registrationReviewStatus = new Map<string, boolean>()
    for (const s of result) {
      const current = registrationReviewStatus.get(s.registrationId) ?? true
      if (s.reviewStatus !== "reviewed") {
        registrationReviewStatus.set(s.registrationId, false)
      } else if (!registrationReviewStatus.has(s.registrationId)) {
        registrationReviewStatus.set(s.registrationId, current)
      }
    }

    // Calculate totals
    const totalSubmissions = result.length
    const reviewedCount = result.filter(
      (s) => s.reviewStatus === "reviewed",
    ).length
    const pendingCount = totalSubmissions - reviewedCount

    return {
      submissions: filtered.map((s) => ({
        ...s,
        registrationAllReviewed:
          registrationReviewStatus.get(s.registrationId) ?? false,
      })),
      totals: {
        total: totalSubmissions,
        reviewed: reviewedCount,
        pending: pendingCount,
      },
    }
  })

/**
 * Get submission counts grouped by trackWorkoutId for the review index page.
 * Returns total submissions and reviewed count (users with scores) per event.
 */
export const getSubmissionCountsByEventFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        trackWorkoutIds: z.array(z.string().min(1)).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Query 1: total submissions per trackWorkoutId
    const submissionCounts = await autochunk(
      { items: data.trackWorkoutIds },
      async (chunk) =>
        db
          .select({
            trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
            total: count(),
          })
          .from(videoSubmissionsTable)
          .where(inArray(videoSubmissionsTable.trackWorkoutId, chunk))
          .groupBy(videoSubmissionsTable.trackWorkoutId),
    )

    // Query 2: reviewed count — submissions where reviewedAt is set
    const reviewedCounts = await autochunk(
      { items: data.trackWorkoutIds },
      async (chunk) =>
        db
          .select({
            trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
            reviewed: count(),
          })
          .from(videoSubmissionsTable)
          .where(
            and(
              inArray(videoSubmissionsTable.trackWorkoutId, chunk),
              isNotNull(videoSubmissionsTable.reviewedAt),
            ),
          )
          .groupBy(videoSubmissionsTable.trackWorkoutId),
    )

    // Build result map
    const subMap = new Map(
      submissionCounts.map((r) => [r.trackWorkoutId, r.total]),
    )
    const revMap = new Map(
      reviewedCounts.map((r) => [r.trackWorkoutId, r.reviewed]),
    )

    const counts: Record<
      string,
      { total: number; reviewed: number; pending: number }
    > = {}

    for (const twId of data.trackWorkoutIds) {
      const total = subMap.get(twId) ?? 0
      const reviewed = revMap.get(twId) ?? 0
      counts[twId] = { total, reviewed, pending: total - reviewed }
    }

    return { counts }
  })

/**
 * Get a single video submission by ID for organizer review.
 */
export const getOrganizerSubmissionDetailFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        submissionId: z.string().min(1),
        competitionId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify user has organizer permission for this competition
    const [competition] = await db
      .select({ organizingTeamId: competitionsTable.organizingTeamId })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!competition) {
      throw new Error("NOT_FOUND: Competition not found")
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    const [submission] = await db
      .select({
        id: videoSubmissionsTable.id,
        videoIndex: videoSubmissionsTable.videoIndex,
        videoUrl: videoSubmissionsTable.videoUrl,
        notes: videoSubmissionsTable.notes,
        submittedAt: videoSubmissionsTable.submittedAt,
        reviewedAt: videoSubmissionsTable.reviewedAt,
        reviewedBy: videoSubmissionsTable.reviewedBy,
        trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
        registrationId: videoSubmissionsTable.registrationId,
        userId: videoSubmissionsTable.userId,
        // Athlete info
        athleteFirstName: userTable.firstName,
        athleteLastName: userTable.lastName,
        athleteEmail: userTable.email,
        athleteAvatar: userTable.avatar,
        // Division info
        divisionId: competitionRegistrationsTable.divisionId,
        divisionLabel: scalingLevelsTable.label,
        // Team name
        teamName: competitionRegistrationsTable.teamName,
      })
      .from(videoSubmissionsTable)
      .innerJoin(
        competitionRegistrationsTable,
        eq(
          videoSubmissionsTable.registrationId,
          competitionRegistrationsTable.id,
        ),
      )
      .innerJoin(userTable, eq(videoSubmissionsTable.userId, userTable.id))
      .leftJoin(
        scalingLevelsTable,
        eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
      )
      .where(eq(videoSubmissionsTable.id, data.submissionId))
      .limit(1)

    if (!submission) {
      return { submission: null }
    }

    // Get score for this user + event
    const [score] = await db
      .select({
        id: scoresTable.id,
        scoreValue: scoresTable.scoreValue,
        status: scoresTable.status,
        scheme: scoresTable.scheme,
      })
      .from(scoresTable)
      .where(
        and(
          eq(scoresTable.competitionEventId, submission.trackWorkoutId),
          eq(scoresTable.userId, submission.userId),
        ),
      )
      .limit(1)

    let displayScore: string | null = null
    if (
      score?.scoreValue !== null &&
      score?.scoreValue !== undefined &&
      score?.scheme
    ) {
      displayScore = decodeScore(
        score.scoreValue,
        score.scheme as WorkoutScheme,
        { compact: false },
      )
    }

    // Load per-round scores for multi-round workouts so the organizer
    // review page can show the round-by-round breakdown.
    let roundScores: Array<{
      roundNumber: number
      value: number
      displayScore: string | null
      status: string | null
    }> = []
    if (score?.id && score?.scheme) {
      const rounds = await db
        .select({
          roundNumber: scoreRoundsTable.roundNumber,
          value: scoreRoundsTable.value,
          status: scoreRoundsTable.status,
        })
        .from(scoreRoundsTable)
        .where(eq(scoreRoundsTable.scoreId, score.id))
        .orderBy(asc(scoreRoundsTable.roundNumber))

      roundScores = rounds.map((r) => ({
        roundNumber: r.roundNumber,
        value: r.value,
        displayScore: decodeScore(r.value, score.scheme as WorkoutScheme, {
          compact: false,
        }),
        status: r.status,
      }))
    }

    return {
      submission: {
        id: submission.id,
        registrationId: submission.registrationId,
        videoIndex: submission.videoIndex,
        videoUrl: submission.videoUrl,
        notes: submission.notes,
        submittedAt: submission.submittedAt,
        reviewedAt: submission.reviewedAt,
        reviewedBy: submission.reviewedBy,
        trackWorkoutId: submission.trackWorkoutId,
        athlete: {
          id: submission.userId,
          firstName: submission.athleteFirstName,
          lastName: submission.athleteLastName,
          email: submission.athleteEmail,
          avatar: submission.athleteAvatar,
        },
        division: submission.divisionId
          ? {
              id: submission.divisionId,
              label: submission.divisionLabel,
            }
          : null,
        teamName: submission.teamName,
        scoreId: score?.id ?? null,
        score: score
          ? {
              value: score.scoreValue,
              displayScore,
              status: score.status,
              roundScores,
            }
          : null,
        reviewStatus: submission.reviewedAt
          ? ("reviewed" as const)
          : ("pending" as const),
      },
    }
  })

/**
 * Mark a video submission as reviewed by an organizer.
 */
export const markSubmissionReviewedFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        submissionId: z.string().min(1),
        competitionId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    // Verify organizer permission
    const [competition] = await db
      .select({ organizingTeamId: competitionsTable.organizingTeamId })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!competition) {
      throw new Error("NOT_FOUND: Competition not found")
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    await db
      .update(videoSubmissionsTable)
      .set({
        reviewedAt: new Date(),
        reviewedBy: session.userId,
        reviewStatus: "under_review",
        statusUpdatedAt: new Date(),
      })
      .where(eq(videoSubmissionsTable.id, data.submissionId))

    return { success: true }
  })

/**
 * Unmark a video submission review (set back to pending).
 */
export const unmarkSubmissionReviewedFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        submissionId: z.string().min(1),
        competitionId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    // Verify organizer permission
    const [competition] = await db
      .select({ organizingTeamId: competitionsTable.organizingTeamId })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!competition) {
      throw new Error("NOT_FOUND: Competition not found")
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    await db
      .update(videoSubmissionsTable)
      .set({
        reviewedAt: null,
        reviewedBy: null,
        reviewStatus: "pending",
        statusUpdatedAt: new Date(),
      })
      .where(eq(videoSubmissionsTable.id, data.submissionId))

    return { success: true }
  })

/**
 * Get all sibling video submissions for the same registration + event.
 * Given one submissionId, returns all videos sharing the same
 * registrationId + trackWorkoutId, ordered by videoIndex.
 */
export const getSiblingSubmissionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        submissionId: z.string().min(1),
        competitionId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify organizer permission
    const [competition] = await db
      .select({ organizingTeamId: competitionsTable.organizingTeamId })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!competition) {
      throw new Error("NOT_FOUND: Competition not found")
    }

    await requireTeamPermission(
      competition.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    // Look up the target submission to get its grouping keys,
    // scoped to the competition via the registration's eventId
    const [target] = await db
      .select({
        registrationId: videoSubmissionsTable.registrationId,
        trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
      })
      .from(videoSubmissionsTable)
      .innerJoin(
        competitionRegistrationsTable,
        eq(
          videoSubmissionsTable.registrationId,
          competitionRegistrationsTable.id,
        ),
      )
      .where(
        and(
          eq(videoSubmissionsTable.id, data.submissionId),
          eq(competitionRegistrationsTable.eventId, data.competitionId),
        ),
      )
      .limit(1)

    if (!target) {
      return { siblings: [] }
    }

    // Fetch all sibling submissions for this registration + event
    const siblings = await db
      .select({
        id: videoSubmissionsTable.id,
        videoIndex: videoSubmissionsTable.videoIndex,
        videoUrl: videoSubmissionsTable.videoUrl,
        notes: videoSubmissionsTable.notes,
        submittedAt: videoSubmissionsTable.submittedAt,
        reviewedAt: videoSubmissionsTable.reviewedAt,
        userId: videoSubmissionsTable.userId,
        athleteFirstName: userTable.firstName,
        athleteLastName: userTable.lastName,
      })
      .from(videoSubmissionsTable)
      .innerJoin(userTable, eq(videoSubmissionsTable.userId, userTable.id))
      .where(
        and(
          eq(videoSubmissionsTable.registrationId, target.registrationId),
          eq(videoSubmissionsTable.trackWorkoutId, target.trackWorkoutId),
        ),
      )
      .orderBy(asc(videoSubmissionsTable.videoIndex))

    return {
      siblings: siblings.map((s) => ({
        id: s.id,
        videoIndex: s.videoIndex,
        videoUrl: s.videoUrl,
        notes: s.notes,
        submittedAt: s.submittedAt,
        reviewedAt: s.reviewedAt,
        userId: s.userId,
        athleteFirstName: s.athleteFirstName,
        athleteLastName: s.athleteLastName,
      })),
    }
  })

/**
 * Public endpoint: fetch all video submissions for a given registration + event.
 * Used on the public leaderboard to show tabbed team member videos.
 * No auth required — video URLs on published leaderboards are already public.
 */
export const getLeaderboardVideosFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        videoSubmissionId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Look up the target submission to get its grouping keys
    const [target] = await db
      .select({
        registrationId: videoSubmissionsTable.registrationId,
        trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
      })
      .from(videoSubmissionsTable)
      .where(eq(videoSubmissionsTable.id, data.videoSubmissionId))
      .limit(1)

    if (!target) {
      return { videos: [] }
    }

    const siblings = await db
      .select({
        id: videoSubmissionsTable.id,
        videoIndex: videoSubmissionsTable.videoIndex,
        videoUrl: videoSubmissionsTable.videoUrl,
        userId: videoSubmissionsTable.userId,
        athleteFirstName: userTable.firstName,
        athleteLastName: userTable.lastName,
      })
      .from(videoSubmissionsTable)
      .innerJoin(userTable, eq(videoSubmissionsTable.userId, userTable.id))
      .where(
        and(
          eq(videoSubmissionsTable.registrationId, target.registrationId),
          eq(videoSubmissionsTable.trackWorkoutId, target.trackWorkoutId),
        ),
      )
      .orderBy(asc(videoSubmissionsTable.videoIndex))

    return {
      videos: siblings.map((s) => ({
        id: s.id,
        videoIndex: s.videoIndex,
        videoUrl: s.videoUrl,
        athleteName:
          `${s.athleteFirstName || ""} ${s.athleteLastName || ""}`.trim() ||
          "Unknown",
      })),
    }
  })
