/**
 * Cohost Submission Verification Server Functions
 * Mirrors submission-verification-fns.ts and video-submission-fns.ts with cohost auth.
 * Allows cohosts to view submissions, verify/reject scores.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, count, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionEventsTable,
  competitionRegistrationsTable,
} from "@/db/schemas/competitions"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { scoresTable, scoreVerificationLogsTable } from "@/db/schemas/scores"
import { userTable } from "@/db/schemas/users"
import { videoSubmissionsTable } from "@/db/schemas/video-submissions"
import { videoVotesTable } from "@/db/schemas/video-votes"
import { workouts } from "@/db/schemas/workouts"
import { logInfo } from "@/lib/logging"
import {
  computeSortKey,
  decodeScore,
  encodeScore,
  sortKeyToString,
  type WorkoutScheme,
} from "@/lib/scoring"
import { getSessionFromCookie } from "@/utils/auth"
import { autochunk } from "@/utils/batch-query"
import { requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostGetOrganizerSubmissionsInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  divisionFilter: z.string().optional(),
  statusFilter: z.enum(["all", "pending", "reviewed"]).optional(),
})

const cohostGetSubmissionDetailInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  scoreId: z.string().min(1),
})

const cohostVerifySubmissionScoreInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().min(1),
  scoreId: z.string().min(1),
  action: z.enum(["verify", "adjust", "invalid"]),
  adjustedScore: z.string().optional(),
  adjustedScoreStatus: z.enum(["scored", "cap"]).optional(),
  secondaryScore: z.string().optional(),
  tieBreakScore: z.string().optional(),
  reviewerNotes: z.string().optional(),
  penaltyType: z.enum(["minor", "major"]).optional(),
  penaltyPercentage: z.number().min(0).max(100).optional(),
  noRepCount: z.number().int().min(0).optional(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all video submissions for an event (cohost organizer view)
 */
export const cohostGetOrganizerSubmissionsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    cohostGetOrganizerSubmissionsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    // Get all video submissions for this event with athlete and registration info
    const submissions = await db
      .select({
        id: videoSubmissionsTable.id,
        videoUrl: videoSubmissionsTable.videoUrl,
        notes: videoSubmissionsTable.notes,
        submittedAt: videoSubmissionsTable.submittedAt,
        reviewedAt: videoSubmissionsTable.reviewedAt,
        registrationId: videoSubmissionsTable.registrationId,
        userId: videoSubmissionsTable.userId,
        athleteFirstName: userTable.firstName,
        athleteLastName: userTable.lastName,
        athleteEmail: userTable.email,
        athleteAvatar: userTable.avatar,
        divisionId: competitionRegistrationsTable.divisionId,
        divisionLabel: scalingLevelsTable.label,
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

    // Get scores for all submissions
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

    // Batch-fetch vote counts
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

    const result = submissions.map((submission) => {
      const score = scoresMap[submission.userId]
      const votes = voteCountsMap[submission.id] ?? {
        upvotes: 0,
        downvotes: 0,
      }
      return {
        id: submission.id,
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
        reviewStatus: submission.reviewedAt
          ? ("reviewed" as const)
          : ("pending" as const),
      }
    })

    // Apply filters
    let filtered = result

    if (data.divisionFilter) {
      filtered = filtered.filter((s) => s.division?.id === data.divisionFilter)
    }

    if (data.statusFilter && data.statusFilter !== "all") {
      filtered = filtered.filter((s) => s.reviewStatus === data.statusFilter)
    }

    const totalSubmissions = result.length
    const reviewedCount = result.filter(
      (s) => s.reviewStatus === "reviewed",
    ).length
    const pendingCount = totalSubmissions - reviewedCount

    return {
      submissions: filtered,
      totals: {
        total: totalSubmissions,
        reviewed: reviewedCount,
        pending: pendingCount,
      },
    }
  })

/**
 * Get a single submission detail for verification (cohost)
 */
export const cohostGetSubmissionDetailFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostGetSubmissionDetailInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    // Verify the event belongs to this competition
    const [competitionEvent] = await db
      .select({
        id: competitionEventsTable.id,
        submissionOpensAt: competitionEventsTable.submissionOpensAt,
        submissionClosesAt: competitionEventsTable.submissionClosesAt,
      })
      .from(competitionEventsTable)
      .where(
        and(
          eq(competitionEventsTable.competitionId, data.competitionId),
          eq(competitionEventsTable.trackWorkoutId, data.trackWorkoutId),
        ),
      )
      .limit(1)

    if (!competitionEvent) {
      throw new Error("Event not found in this competition")
    }

    // Get the score with user info
    const [score] = await db
      .select({
        id: scoresTable.id,
        userId: scoresTable.userId,
        scoreValue: scoresTable.scoreValue,
        status: scoresTable.status,
        scheme: scoresTable.scheme,
        tiebreakValue: scoresTable.tiebreakValue,
        tiebreakScheme: scoresTable.tiebreakScheme,
        secondaryValue: scoresTable.secondaryValue,
        notes: scoresTable.notes,
        recordedAt: scoresTable.recordedAt,
        scalingLevelId: scoresTable.scalingLevelId,
        verificationStatus: scoresTable.verificationStatus,
        verifiedAt: scoresTable.verifiedAt,
        verifiedByUserId: scoresTable.verifiedByUserId,
        penaltyType: scoresTable.penaltyType,
        penaltyPercentage: scoresTable.penaltyPercentage,
        noRepCount: scoresTable.noRepCount,
      })
      .from(scoresTable)
      .where(
        and(
          eq(scoresTable.id, data.scoreId),
          eq(scoresTable.competitionEventId, data.trackWorkoutId),
        ),
      )
      .limit(1)

    // Get event details
    const [trackWorkout] = await db
      .select({
        id: trackWorkoutsTable.id,
        trackOrder: trackWorkoutsTable.trackOrder,
        workoutId: workouts.id,
        workoutName: workouts.name,
        workoutDescription: workouts.description,
        workoutScheme: workouts.scheme,
        workoutTimeCap: workouts.timeCap,
      })
      .from(trackWorkoutsTable)
      .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
      .limit(1)

    if (!trackWorkout) {
      throw new Error("Event not found")
    }

    const event = {
      id: trackWorkout.id,
      trackOrder: trackWorkout.trackOrder,
      workout: {
        id: trackWorkout.workoutId,
        name: trackWorkout.workoutName,
        description: trackWorkout.workoutDescription,
        scheme: trackWorkout.workoutScheme,
        timeCap: trackWorkout.workoutTimeCap,
      },
      submissionWindow: {
        opensAt: competitionEvent?.submissionOpensAt ?? null,
        closesAt: competitionEvent?.submissionClosesAt ?? null,
      },
    }

    if (!score) {
      return { submission: null, event }
    }

    // Get user info
    const [user] = await db
      .select({
        id: userTable.id,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        email: userTable.email,
        avatar: userTable.avatar,
      })
      .from(userTable)
      .where(eq(userTable.id, score.userId))
      .limit(1)

    if (!user) {
      return { submission: null, event }
    }

    // Get division info
    let divisionLabel = "Open"
    if (score.scalingLevelId) {
      const [division] = await db
        .select({ label: scalingLevelsTable.label })
        .from(scalingLevelsTable)
        .where(eq(scalingLevelsTable.id, score.scalingLevelId))
        .limit(1)
      if (division) {
        divisionLabel = division.label
      }
    }

    // Get registration info
    const [registration] = await db
      .select({
        id: competitionRegistrationsTable.id,
        teamName: competitionRegistrationsTable.teamName,
      })
      .from(competitionRegistrationsTable)
      .where(
        and(
          eq(competitionRegistrationsTable.eventId, data.competitionId),
          eq(competitionRegistrationsTable.userId, score.userId),
        ),
      )
      .limit(1)

    // Get video URL
    let videoUrl: string | null = null
    if (registration) {
      const [videoSubmission] = await db
        .select({ videoUrl: videoSubmissionsTable.videoUrl })
        .from(videoSubmissionsTable)
        .where(
          and(
            eq(videoSubmissionsTable.registrationId, registration.id),
            eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
          ),
        )
        .limit(1)
      if (videoSubmission) {
        videoUrl = videoSubmission.videoUrl
      }
    }

    // Get verifier name
    let verifiedByName: string | null = null
    if (score.verifiedByUserId) {
      const [verifier] = await db
        .select({
          firstName: userTable.firstName,
          lastName: userTable.lastName,
        })
        .from(userTable)
        .where(eq(userTable.id, score.verifiedByUserId))
        .limit(1)
      if (verifier) {
        verifiedByName =
          `${verifier.firstName || ""} ${verifier.lastName || ""}`.trim() ||
          null
      }
    }

    // Decode score for display
    let displayValue = ""
    if (score.scoreValue !== null) {
      displayValue = decodeScore(
        score.scoreValue,
        score.scheme as WorkoutScheme,
        { compact: false },
      )
    }

    let tiebreakDisplay: string | null = null
    if (score.tiebreakValue !== null && score.tiebreakScheme) {
      tiebreakDisplay = decodeScore(
        score.tiebreakValue,
        score.tiebreakScheme as WorkoutScheme,
        { compact: false },
      )
    }

    const submission = {
      id: score.id,
      athlete: {
        userId: user.id,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        avatar: user.avatar,
        divisionId: score.scalingLevelId,
        divisionLabel,
        teamName: registration?.teamName ?? null,
        registrationId: registration?.id ?? "",
      },
      score: {
        displayValue,
        rawValue: score.scoreValue,
        status: score.status,
        tiebreakValue: tiebreakDisplay,
        secondaryValue: score.secondaryValue,
      },
      verification: {
        status:
          (score.verificationStatus as "verified" | "adjusted" | "invalid") ??
          null,
        verifiedAt: score.verifiedAt ?? null,
        verifiedByName,
        penaltyType: (score.penaltyType as "minor" | "major") ?? null,
        penaltyPercentage: score.penaltyPercentage ?? null,
        noRepCount: score.noRepCount ?? null,
      },
      videoUrl,
      submittedAt: score.recordedAt,
      notes: score.notes,
    }

    return { submission, event }
  })

/**
 * Verify or adjust a submitted competition score (cohost)
 */
export const cohostVerifySubmissionScoreFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    cohostVerifySubmissionScoreInputSchema.parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{ success: boolean; verificationStatus: string }> => {
      await requireCohostPermission(data.competitionTeamId)

      const session = await getSessionFromCookie()
      if (!session?.userId) {
        throw new Error("Not authenticated")
      }

      const db = getDb()

      // Verify the event belongs to this competition
      const [competitionEvent] = await db
        .select({ id: competitionEventsTable.id })
        .from(competitionEventsTable)
        .where(
          and(
            eq(competitionEventsTable.competitionId, data.competitionId),
            eq(competitionEventsTable.trackWorkoutId, data.trackWorkoutId),
          ),
        )
        .limit(1)

      if (!competitionEvent) {
        throw new Error("Event not found in this competition")
      }

      // Load the score
      const [score] = await db
        .select({
          id: scoresTable.id,
          userId: scoresTable.userId,
          scheme: scoresTable.scheme,
          scoreType: scoresTable.scoreType,
          tiebreakScheme: scoresTable.tiebreakScheme,
          timeCapMs: scoresTable.timeCapMs,
          scoreValue: scoresTable.scoreValue,
          status: scoresTable.status,
          secondaryValue: scoresTable.secondaryValue,
          tiebreakValue: scoresTable.tiebreakValue,
        })
        .from(scoresTable)
        .where(
          and(
            eq(scoresTable.id, data.scoreId),
            eq(scoresTable.competitionEventId, data.trackWorkoutId),
          ),
        )
        .limit(1)

      if (!score) {
        throw new Error("Score not found")
      }

      // Look up registration for video submission updates
      const [registration] = await db
        .select({ id: competitionRegistrationsTable.id })
        .from(competitionRegistrationsTable)
        .where(
          and(
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            eq(competitionRegistrationsTable.userId, score.userId),
          ),
        )
        .limit(1)

      const now = new Date()

      if (data.action === "verify") {
        await db.transaction(async (tx) => {
          await tx
            .update(scoresTable)
            .set({
              verificationStatus: "verified",
              verifiedAt: now,
              verifiedByUserId: session.userId,
              penaltyType: null,
              penaltyPercentage: null,
              noRepCount: null,
              updatedAt: now,
            })
            .where(eq(scoresTable.id, data.scoreId))

          await tx.insert(scoreVerificationLogsTable).values({
            scoreId: data.scoreId,
            competitionId: data.competitionId,
            trackWorkoutId: data.trackWorkoutId,
            athleteUserId: score.userId,
            action: "verified",
            performedByUserId: session.userId,
            performedAt: now,
          })

          if (registration) {
            await tx
              .update(videoSubmissionsTable)
              .set({
                reviewStatus: "verified",
                statusUpdatedAt: now,
                reviewedAt: now,
                reviewedBy: session.userId,
                reviewerNotes: data.reviewerNotes || null,
              })
              .where(
                and(
                  eq(videoSubmissionsTable.registrationId, registration.id),
                  eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
                ),
              )
          }
        })

        logInfo({
          message: "[Score] Cohost verified score",
          attributes: {
            scoreId: data.scoreId,
            competitionId: data.competitionId,
            verifiedByUserId: session.userId,
          },
        })

        return { success: true, verificationStatus: "verified" }
      }

      if (data.action === "invalid") {
        const scheme = score.scheme as WorkoutScheme
        const zeroSortKey = computeSortKey({
          value: null,
          status: "scored",
          scheme,
          scoreType: (score.scoreType as "max" | "min") ?? "max",
        })

        await db.transaction(async (tx) => {
          await tx
            .update(scoresTable)
            .set({
              scoreValue: 0,
              secondaryValue: null,
              tiebreakValue: null,
              status: "scored",
              statusOrder: 0,
              sortKey: zeroSortKey ? sortKeyToString(zeroSortKey) : null,
              verificationStatus: "invalid",
              verifiedAt: now,
              verifiedByUserId: session.userId,
              penaltyType: null,
              penaltyPercentage: null,
              noRepCount: data.noRepCount ?? null,
              updatedAt: now,
            })
            .where(eq(scoresTable.id, data.scoreId))

          await tx.insert(scoreVerificationLogsTable).values({
            scoreId: data.scoreId,
            competitionId: data.competitionId,
            trackWorkoutId: data.trackWorkoutId,
            athleteUserId: score.userId,
            action: "invalid",
            originalScoreValue: score.scoreValue,
            originalStatus: score.status,
            originalSecondaryValue: score.secondaryValue,
            originalTiebreakValue: score.tiebreakValue,
            newScoreValue: 0,
            newStatus: "scored",
            noRepCount: data.noRepCount ?? null,
            performedByUserId: session.userId,
            performedAt: now,
          })

          if (registration) {
            await tx
              .update(videoSubmissionsTable)
              .set({
                reviewStatus: "invalid",
                statusUpdatedAt: now,
                reviewedAt: now,
                reviewedBy: session.userId,
                reviewerNotes: data.reviewerNotes || null,
              })
              .where(
                and(
                  eq(videoSubmissionsTable.registrationId, registration.id),
                  eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
                ),
              )
          }
        })

        logInfo({
          message: "[Score] Cohost marked score invalid",
          attributes: {
            scoreId: data.scoreId,
            competitionId: data.competitionId,
            verifiedByUserId: session.userId,
          },
        })

        return { success: true, verificationStatus: "invalid" }
      }

      // action === "adjust"
      if (!data.adjustedScore || !data.adjustedScoreStatus) {
        throw new Error(
          "adjustedScore and adjustedScoreStatus are required for adjust action",
        )
      }

      const scheme = score.scheme as WorkoutScheme
      const newStatus = data.adjustedScoreStatus

      let encodedValue: number | null = null
      if (newStatus === "cap" && score.timeCapMs) {
        encodedValue = score.timeCapMs
      } else {
        encodedValue = encodeScore(data.adjustedScore, scheme)
      }

      let secondaryValue: number | null = null
      if (data.secondaryScore && newStatus === "cap") {
        const parsed = Number.parseInt(data.secondaryScore.trim(), 10)
        if (!Number.isNaN(parsed) && parsed >= 0) {
          secondaryValue = parsed
        }
      }

      let tiebreakValue: number | null = null
      if (data.tieBreakScore && score.tiebreakScheme) {
        try {
          tiebreakValue = encodeScore(
            data.tieBreakScore,
            score.tiebreakScheme as WorkoutScheme,
          )
        } catch {
          // Ignore tiebreak encoding errors
        }
      }

      const statusOrder = newStatus === "cap" ? 1 : 0
      const sortKey =
        encodedValue !== null
          ? computeSortKey({
              value: encodedValue,
              status: newStatus,
              scheme,
              scoreType: (score.scoreType as "max" | "min") ?? "max",
              timeCap:
                newStatus === "cap" &&
                score.timeCapMs &&
                secondaryValue !== null
                  ? { ms: score.timeCapMs, secondaryValue }
                  : undefined,
              tiebreak:
                tiebreakValue !== null && score.tiebreakScheme
                  ? {
                      scheme: score.tiebreakScheme as "time" | "reps",
                      value: tiebreakValue,
                    }
                  : undefined,
            })
          : null

      const videoReviewStatus = data.penaltyType ? "penalized" : "adjusted"

      await db.transaction(async (tx) => {
        await tx
          .update(scoresTable)
          .set({
            scoreValue: encodedValue,
            status: newStatus,
            statusOrder,
            sortKey: sortKey ? sortKeyToString(sortKey) : null,
            secondaryValue,
            tiebreakValue,
            verificationStatus: "adjusted",
            verifiedAt: now,
            verifiedByUserId: session.userId,
            penaltyType: data.penaltyType ?? null,
            penaltyPercentage: data.penaltyPercentage ?? null,
            noRepCount: data.noRepCount ?? null,
            updatedAt: now,
          })
          .where(eq(scoresTable.id, data.scoreId))

        await tx.insert(scoreVerificationLogsTable).values({
          scoreId: data.scoreId,
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
          athleteUserId: score.userId,
          action: "adjusted",
          originalScoreValue: score.scoreValue,
          originalStatus: score.status,
          originalSecondaryValue: score.secondaryValue,
          originalTiebreakValue: score.tiebreakValue,
          newScoreValue: encodedValue,
          newStatus,
          newSecondaryValue: secondaryValue,
          newTiebreakValue: tiebreakValue,
          penaltyType: data.penaltyType ?? null,
          penaltyPercentage: data.penaltyPercentage ?? null,
          noRepCount: data.noRepCount ?? null,
          performedByUserId: session.userId,
          performedAt: now,
        })

        if (registration) {
          await tx
            .update(videoSubmissionsTable)
            .set({
              reviewStatus: videoReviewStatus,
              statusUpdatedAt: now,
              reviewedAt: now,
              reviewedBy: session.userId,
              reviewerNotes: data.reviewerNotes || null,
            })
            .where(
              and(
                eq(videoSubmissionsTable.registrationId, registration.id),
                eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
              ),
            )
        }
      })

      logInfo({
        message: "[Score] Cohost adjusted score",
        attributes: {
          scoreId: data.scoreId,
          competitionId: data.competitionId,
          verifiedByUserId: session.userId,
          newStatus,
          encodedValue,
        },
      })

      return { success: true, verificationStatus: "adjusted" }
    },
  )

/**
 * Get all submissions list for an event (cohost navigation view)
 */
export const cohostGetEventSubmissionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionTeamId: z.string().min(1),
        competitionId: z.string().min(1),
        trackWorkoutId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId)
    const db = getDb()

    // Verify the event belongs to this competition
    const [competitionEvent] = await db
      .select({ id: competitionEventsTable.id })
      .from(competitionEventsTable)
      .where(
        and(
          eq(competitionEventsTable.competitionId, data.competitionId),
          eq(competitionEventsTable.trackWorkoutId, data.trackWorkoutId),
        ),
      )
      .limit(1)

    if (!competitionEvent) {
      throw new Error("Event not found in this competition")
    }

    // Get all scores for this event
    const scores = await db
      .select({
        id: scoresTable.id,
        userId: scoresTable.userId,
        scoreValue: scoresTable.scoreValue,
        status: scoresTable.status,
        scheme: scoresTable.scheme,
        scalingLevelId: scoresTable.scalingLevelId,
        verificationStatus: scoresTable.verificationStatus,
      })
      .from(scoresTable)
      .where(eq(scoresTable.competitionEventId, data.trackWorkoutId))

    if (scores.length === 0) {
      return { submissions: [] }
    }

    // Get user info
    const userIds = scores.map((s) => s.userId)
    const users = await autochunk({ items: userIds }, async (chunk) =>
      db
        .select({
          id: userTable.id,
          firstName: userTable.firstName,
          lastName: userTable.lastName,
        })
        .from(userTable)
        .where(inArray(userTable.id, chunk)),
    )
    const userMap = new Map(users.map((u) => [u.id, u]))

    // Get division info
    const divisionIds = scores
      .map((s) => s.scalingLevelId)
      .filter((id): id is string => id !== null)
    const divisions =
      divisionIds.length > 0
        ? await autochunk(
            { items: [...new Set(divisionIds)] },
            async (chunk) =>
              db
                .select({
                  id: scalingLevelsTable.id,
                  label: scalingLevelsTable.label,
                })
                .from(scalingLevelsTable)
                .where(inArray(scalingLevelsTable.id, chunk)),
          )
        : []
    const divisionMap = new Map(divisions.map((d) => [d.id, d]))

    // Get registration info
    const registrations = await autochunk({ items: userIds }, async (chunk) =>
      db
        .select({
          userId: competitionRegistrationsTable.userId,
          teamName: competitionRegistrationsTable.teamName,
        })
        .from(competitionRegistrationsTable)
        .where(
          and(
            eq(competitionRegistrationsTable.eventId, data.competitionId),
            inArray(competitionRegistrationsTable.userId, chunk),
          ),
        ),
    )
    const registrationMap = new Map(registrations.map((r) => [r.userId, r]))

    const submissions = scores.map((score) => {
      const user = userMap.get(score.userId)
      const division = score.scalingLevelId
        ? divisionMap.get(score.scalingLevelId)
        : null
      const reg = registrationMap.get(score.userId)

      let scoreDisplay = ""
      if (score.scoreValue !== null && score.scheme) {
        scoreDisplay = decodeScore(
          score.scoreValue,
          score.scheme as WorkoutScheme,
          { compact: false },
        )
      }

      return {
        id: score.id,
        athleteName: user
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : "Unknown",
        teamName: reg?.teamName ?? null,
        divisionLabel: division?.label ?? "Open",
        hasVideo: false, // simplified for list view
        scoreDisplay,
        status: score.verificationStatus ?? "pending",
      }
    })

    return { submissions }
  })
