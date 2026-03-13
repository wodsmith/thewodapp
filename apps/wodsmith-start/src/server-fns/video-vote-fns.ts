/**
 * Video Vote Server Functions
 *
 * Handles public voting on video submissions for online competitions.
 * Users can upvote impressive performances or downvote with a reason.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, count, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
  createVideoVoteId,
  downvoteReasons,
  videoVotesTable,
} from "@/db/schemas/video-votes"
import { videoSubmissionsTable } from "@/db/schemas/video-submissions"
import { userTable } from "@/db/schemas/users"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const castVoteInputSchema = z
  .object({
    videoSubmissionId: z.string().min(1),
    voteType: z.enum(["upvote", "downvote"]),
    reason: z.enum(downvoteReasons).optional(),
    reasonDetail: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.voteType === "downvote" && !data.reason) {
        return false
      }
      return true
    },
    { message: "A reason is required for downvotes", path: ["reason"] },
  )

const removeVoteInputSchema = z.object({
  videoSubmissionId: z.string().min(1),
})

const getVoteCountsInputSchema = z.object({
  videoSubmissionIds: z.array(z.string().min(1)).min(1).max(100),
})

const getFlaggedSubmissionsInputSchema = z.object({
  competitionId: z.string().min(1),
  trackWorkoutId: z.string().optional(),
  minDownvotes: z.number().int().min(1).default(3),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Cast a vote (upvote or downvote) on a video submission.
 * If the user already voted, their vote is updated.
 * Users cannot vote on their own submissions.
 */
export const castVideoVoteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => castVoteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("You must be signed in to vote")
    }

    const db = getDb()

    // Verify the submission exists and get the submitter's userId
    const [submission] = await db
      .select({
        id: videoSubmissionsTable.id,
        userId: videoSubmissionsTable.userId,
      })
      .from(videoSubmissionsTable)
      .where(eq(videoSubmissionsTable.id, data.videoSubmissionId))
      .limit(1)

    if (!submission) {
      throw new Error("Video submission not found")
    }

    // Cannot vote on your own submission
    if (submission.userId === session.userId) {
      throw new Error("You cannot vote on your own submission")
    }

    const now = new Date()

    // Upsert: insert or update existing vote
    await db
      .insert(videoVotesTable)
      .values({
        id: createVideoVoteId(),
        videoSubmissionId: data.videoSubmissionId,
        userId: session.userId,
        voteType: data.voteType,
        reason: data.voteType === "downvote" ? (data.reason ?? null) : null,
        reasonDetail:
          data.voteType === "downvote" ? (data.reasonDetail ?? null) : null,
        votedAt: now,
      })
      .onDuplicateKeyUpdate({
        set: {
          voteType: data.voteType,
          reason: data.voteType === "downvote" ? (data.reason ?? null) : null,
          reasonDetail:
            data.voteType === "downvote" ? (data.reasonDetail ?? null) : null,
          updatedAt: now,
        },
      })

    return { success: true }
  })

/**
 * Remove the current user's vote on a video submission.
 */
export const removeVideoVoteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => removeVoteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("You must be signed in")
    }

    const db = getDb()

    await db
      .delete(videoVotesTable)
      .where(
        and(
          eq(videoVotesTable.videoSubmissionId, data.videoSubmissionId),
          eq(videoVotesTable.userId, session.userId),
        ),
      )

    return { success: true }
  })

/**
 * Get vote counts and the current user's vote for multiple submissions.
 * Used to display vote counts on the leaderboard.
 */
export const getVideoVoteCountsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getVoteCountsInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    const db = getDb()

    // Get aggregated vote counts per submission
    const voteCounts = await db
      .select({
        videoSubmissionId: videoVotesTable.videoSubmissionId,
        voteType: videoVotesTable.voteType,
        count: count(),
      })
      .from(videoVotesTable)
      .where(
        inArray(videoVotesTable.videoSubmissionId, data.videoSubmissionIds),
      )
      .groupBy(videoVotesTable.videoSubmissionId, videoVotesTable.voteType)

    // Get current user's votes if authenticated
    let userVotes: Array<{
      videoSubmissionId: string
      voteType: string
    }> = []

    if (session?.userId) {
      userVotes = await db
        .select({
          videoSubmissionId: videoVotesTable.videoSubmissionId,
          voteType: videoVotesTable.voteType,
        })
        .from(videoVotesTable)
        .where(
          and(
            inArray(videoVotesTable.videoSubmissionId, data.videoSubmissionIds),
            eq(videoVotesTable.userId, session.userId),
          ),
        )
    }

    // Build result map
    const userVoteMap = new Map(
      userVotes.map((v) => [v.videoSubmissionId, v.voteType]),
    )

    const result: Record<
      string,
      {
        upvotes: number
        downvotes: number
        userVote: "upvote" | "downvote" | null
      }
    > = {}

    // Initialize all requested submissions
    for (const id of data.videoSubmissionIds) {
      result[id] = {
        upvotes: 0,
        downvotes: 0,
        userVote: (userVoteMap.get(id) as "upvote" | "downvote") ?? null,
      }
    }

    // Fill in counts
    for (const row of voteCounts) {
      const entry = result[row.videoSubmissionId]
      if (entry) {
        if (row.voteType === "upvote") {
          entry.upvotes = row.count
        } else if (row.voteType === "downvote") {
          entry.downvotes = row.count
        }
      }
    }

    return { votes: result }
  })

/**
 * Get flagged video submissions (those with many downvotes) for organizer review.
 * Returns submissions sorted by downvote count descending.
 */
export const getFlaggedSubmissionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getFlaggedSubmissionsInputSchema.parse(data))
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

    // Get submissions with downvote counts >= threshold
    // Join through video_submissions to filter by competition
    const flaggedQuery = db
      .select({
        videoSubmissionId: videoVotesTable.videoSubmissionId,
        downvotes: count(),
      })
      .from(videoVotesTable)
      .innerJoin(
        videoSubmissionsTable,
        eq(videoVotesTable.videoSubmissionId, videoSubmissionsTable.id),
      )
      .where(
        and(
          eq(videoVotesTable.voteType, "downvote"),
          ...(data.trackWorkoutId
            ? [eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId)]
            : []),
        ),
      )
      .groupBy(videoVotesTable.videoSubmissionId)
      .having(sql`count(*) >= ${data.minDownvotes}`)
      .orderBy(sql`count(*) desc`)

    const flaggedRows = await flaggedQuery

    if (flaggedRows.length === 0) {
      return { flagged: [] }
    }

    // Get submission details with athlete info
    const submissionIds = flaggedRows.map((r) => r.videoSubmissionId)
    const submissions = await db
      .select({
        id: videoSubmissionsTable.id,
        videoUrl: videoSubmissionsTable.videoUrl,
        trackWorkoutId: videoSubmissionsTable.trackWorkoutId,
        submittedAt: videoSubmissionsTable.submittedAt,
        reviewStatus: videoSubmissionsTable.reviewStatus,
        athleteFirstName: userTable.firstName,
        athleteLastName: userTable.lastName,
        userId: videoSubmissionsTable.userId,
      })
      .from(videoSubmissionsTable)
      .innerJoin(userTable, eq(videoSubmissionsTable.userId, userTable.id))
      .where(inArray(videoSubmissionsTable.id, submissionIds))

    const submissionMap = new Map(submissions.map((s) => [s.id, s]))

    // Get downvote reasons breakdown per submission
    const reasonBreakdown = await db
      .select({
        videoSubmissionId: videoVotesTable.videoSubmissionId,
        reason: videoVotesTable.reason,
        count: count(),
      })
      .from(videoVotesTable)
      .where(
        and(
          inArray(videoVotesTable.videoSubmissionId, submissionIds),
          eq(videoVotesTable.voteType, "downvote"),
        ),
      )
      .groupBy(videoVotesTable.videoSubmissionId, videoVotesTable.reason)

    const reasonMap = new Map<
      string,
      Array<{ reason: string | null; count: number }>
    >()
    for (const row of reasonBreakdown) {
      const existing = reasonMap.get(row.videoSubmissionId) ?? []
      existing.push({ reason: row.reason, count: row.count })
      reasonMap.set(row.videoSubmissionId, existing)
    }

    // Build result
    const flagged = flaggedRows
      .map((row) => {
        const submission = submissionMap.get(row.videoSubmissionId)
        if (!submission) return null

        return {
          submissionId: row.videoSubmissionId,
          downvotes: row.downvotes,
          videoUrl: submission.videoUrl,
          trackWorkoutId: submission.trackWorkoutId,
          submittedAt: submission.submittedAt,
          reviewStatus: submission.reviewStatus,
          athlete: {
            id: submission.userId,
            firstName: submission.athleteFirstName,
            lastName: submission.athleteLastName,
          },
          reasons: reasonMap.get(row.videoSubmissionId) ?? [],
        }
      })
      .filter(Boolean)

    return { flagged }
  })
