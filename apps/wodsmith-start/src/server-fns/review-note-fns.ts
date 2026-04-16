/**
 * Review Note Server Functions for TanStack Start
 * Handles organizer review notes on video submissions.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionRegistrationsTable } from "@/db/schemas/competitions"
import { createReviewNoteId } from "@/db/schemas/common"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { reviewNotesTable } from "@/db/schemas/review-notes"
import { userTable } from "@/db/schemas/users"
import { videoSubmissionsTable } from "@/db/schemas/video-submissions"
import { movements, workoutMovements } from "@/db/schemas/workouts"
import { getSessionFromCookie } from "@/utils/auth"
import { requireSubmissionReviewAccess } from "@/utils/team-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const getReviewNotesInputSchema = z.object({
  videoSubmissionId: z.string().min(1),
  competitionId: z.string().min(1),
})

const createReviewNoteInputSchema = z.object({
  videoSubmissionId: z.string().min(1),
  competitionId: z.string().min(1),
  type: z.enum(["general", "no-rep"]).default("general"),
  content: z.string().min(1).max(2000),
  timestampSeconds: z.number().int().min(0).optional(),
  movementId: z.string().optional(),
})

const updateReviewNoteInputSchema = z.object({
  noteId: z.string().min(1),
  competitionId: z.string().min(1),
  type: z.enum(["general", "no-rep"]).optional(),
  content: z.string().min(1).max(2000).optional(),
  movementId: z.string().nullable().optional(),
})

const deleteReviewNoteInputSchema = z.object({
  noteId: z.string().min(1),
  competitionId: z.string().min(1),
})

const getWorkoutMovementsInputSchema = z
  .object({
    workoutId: z.string().min(1).optional(),
    trackWorkoutId: z.string().min(1).optional(),
    competitionId: z.string().min(1),
  })
  .refine((data) => data.workoutId || data.trackWorkoutId, {
    message: "Either workoutId or trackWorkoutId is required",
  })

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all review notes for a video submission.
 * Ordered by timestampSeconds ascending (nulls last).
 */
export const getReviewNotesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getReviewNotesInputSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()

    const { organizingTeamId } = await requireSubmissionReviewAccess(
      data.competitionId,
    )

    // Query notes with reviewer info and movement name
    const notes = await db
      .select({
        id: reviewNotesTable.id,
        type: reviewNotesTable.type,
        content: reviewNotesTable.content,
        timestampSeconds: reviewNotesTable.timestampSeconds,
        movementId: reviewNotesTable.movementId,
        movementName: movements.name,
        createdAt: reviewNotesTable.createdAt,
        reviewerId: userTable.id,
        reviewerFirstName: userTable.firstName,
        reviewerLastName: userTable.lastName,
        reviewerAvatar: userTable.avatar,
      })
      .from(reviewNotesTable)
      .innerJoin(userTable, eq(reviewNotesTable.userId, userTable.id))
      .leftJoin(movements, eq(reviewNotesTable.movementId, movements.id))
      .where(
        and(
          eq(reviewNotesTable.videoSubmissionId, data.videoSubmissionId),
          eq(reviewNotesTable.teamId, organizingTeamId),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${reviewNotesTable.timestampSeconds} IS NULL THEN 1 ELSE 0 END`,
        asc(reviewNotesTable.timestampSeconds),
      )

    return {
      notes: notes.map((n) => ({
        id: n.id,
        type: n.type,
        content: n.content,
        timestampSeconds: n.timestampSeconds,
        movementId: n.movementId,
        movementName: n.movementName,
        createdAt: n.createdAt,
        reviewer: {
          id: n.reviewerId,
          firstName: n.reviewerFirstName,
          lastName: n.reviewerLastName,
          avatar: n.reviewerAvatar,
        },
      })),
    }
  })

/**
 * Create a review note on a video submission.
 */
export const createReviewNoteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createReviewNoteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    const { organizingTeamId } = await requireSubmissionReviewAccess(
      data.competitionId,
    )

    // Verify video submission belongs to this competition
    const [submission] = await db
      .select({ id: videoSubmissionsTable.id })
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
          eq(videoSubmissionsTable.id, data.videoSubmissionId),
          eq(competitionRegistrationsTable.eventId, data.competitionId),
        ),
      )
      .limit(1)

    if (!submission) {
      throw new Error(
        "NOT_FOUND: Video submission not found for this competition",
      )
    }

    const id = createReviewNoteId()

    await db.insert(reviewNotesTable).values({
      id,
      videoSubmissionId: data.videoSubmissionId,
      userId: session.userId,
      teamId: organizingTeamId,
      type: data.type,
      content: data.content,
      timestampSeconds: data.timestampSeconds ?? null,
      movementId: data.movementId ?? null,
    })

    // Return the created note with reviewer info
    const [note] = await db
      .select({
        id: reviewNotesTable.id,
        type: reviewNotesTable.type,
        content: reviewNotesTable.content,
        timestampSeconds: reviewNotesTable.timestampSeconds,
        movementId: reviewNotesTable.movementId,
        movementName: movements.name,
        createdAt: reviewNotesTable.createdAt,
        reviewerId: userTable.id,
        reviewerFirstName: userTable.firstName,
        reviewerLastName: userTable.lastName,
        reviewerAvatar: userTable.avatar,
      })
      .from(reviewNotesTable)
      .innerJoin(userTable, eq(reviewNotesTable.userId, userTable.id))
      .leftJoin(movements, eq(reviewNotesTable.movementId, movements.id))
      .where(eq(reviewNotesTable.id, id))
      .limit(1)

    return {
      note: {
        id: note.id,
        type: note.type,
        content: note.content,
        timestampSeconds: note.timestampSeconds,
        movementId: note.movementId,
        movementName: note.movementName,
        createdAt: note.createdAt,
        reviewer: {
          id: note.reviewerId,
          firstName: note.reviewerFirstName,
          lastName: note.reviewerLastName,
          avatar: note.reviewerAvatar,
        },
      },
    }
  })

/**
 * Update a review note (content, type, or movement).
 */
export const updateReviewNoteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateReviewNoteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    const { organizingTeamId } = await requireSubmissionReviewAccess(
      data.competitionId,
    )

    // Build update fields
    const updates: Record<string, unknown> = {}
    if (data.type !== undefined) updates.type = data.type
    if (data.content !== undefined) updates.content = data.content
    if (data.movementId !== undefined) updates.movementId = data.movementId

    if (Object.keys(updates).length === 0) {
      throw new Error("No fields to update")
    }

    await db
      .update(reviewNotesTable)
      .set(updates)
      .where(
        and(
          eq(reviewNotesTable.id, data.noteId),
          eq(reviewNotesTable.teamId, organizingTeamId),
        ),
      )

    return { success: true }
  })

/**
 * Delete a review note.
 */
export const deleteReviewNoteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteReviewNoteInputSchema.parse(data))
  .handler(async ({ data }) => {
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    const { organizingTeamId } = await requireSubmissionReviewAccess(
      data.competitionId,
    )

    // Verify note exists and belongs to this competition's team
    const [note] = await db
      .select({ id: reviewNotesTable.id })
      .from(reviewNotesTable)
      .where(
        and(
          eq(reviewNotesTable.id, data.noteId),
          eq(reviewNotesTable.teamId, organizingTeamId),
        ),
      )
      .limit(1)

    if (!note) {
      throw new Error("NOT_FOUND: Review note not found")
    }

    await db
      .delete(reviewNotesTable)
      .where(
        and(
          eq(reviewNotesTable.id, data.noteId),
          eq(reviewNotesTable.teamId, organizingTeamId),
        ),
      )

    return { success: true }
  })

/**
 * Get movements for a workout (for tagging notes with specific movements).
 */
export const getWorkoutMovementsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getWorkoutMovementsInputSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()

    await requireSubmissionReviewAccess(data.competitionId)

    // Resolve workoutId from trackWorkoutId if needed
    let resolvedWorkoutId = data.workoutId
    if (!resolvedWorkoutId && data.trackWorkoutId) {
      const [trackWorkout] = await db
        .select({ workoutId: trackWorkoutsTable.workoutId })
        .from(trackWorkoutsTable)
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
        .limit(1)

      if (!trackWorkout) {
        return { movements: [] }
      }
      resolvedWorkoutId = trackWorkout.workoutId
    }

    if (!resolvedWorkoutId) {
      return { movements: [] }
    }

    const results = await db
      .select({
        id: movements.id,
        name: movements.name,
        type: movements.type,
      })
      .from(workoutMovements)
      .innerJoin(movements, eq(workoutMovements.movementId, movements.id))
      .where(eq(workoutMovements.workoutId, resolvedWorkoutId))

    return {
      movements: results,
    }
  })

/**
 * Get review notes for ALL video submissions sharing the same
 * registrationId + trackWorkoutId. Enables aggregated movement tally
 * across multiple team videos.
 */
export const getReviewNotesForRegistrationFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        registrationId: z.string().min(1),
        trackWorkoutId: z.string().min(1),
        competitionId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    const { organizingTeamId } = await requireSubmissionReviewAccess(
      data.competitionId,
    )

    // Get all video submission IDs for this registration + event,
    // scoped to the competition via the registration's eventId
    const submissionRows = await db
      .select({ id: videoSubmissionsTable.id })
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
          eq(videoSubmissionsTable.registrationId, data.registrationId),
          eq(videoSubmissionsTable.trackWorkoutId, data.trackWorkoutId),
          eq(competitionRegistrationsTable.eventId, data.competitionId),
        ),
      )

    const submissionIds = submissionRows.map((r) => r.id)
    if (submissionIds.length === 0) {
      return { notes: [] }
    }

    // Query notes across all sibling submissions
    const notes = await db
      .select({
        id: reviewNotesTable.id,
        type: reviewNotesTable.type,
        content: reviewNotesTable.content,
        timestampSeconds: reviewNotesTable.timestampSeconds,
        movementId: reviewNotesTable.movementId,
        movementName: movements.name,
        videoSubmissionId: reviewNotesTable.videoSubmissionId,
        createdAt: reviewNotesTable.createdAt,
        reviewerId: userTable.id,
        reviewerFirstName: userTable.firstName,
        reviewerLastName: userTable.lastName,
        reviewerAvatar: userTable.avatar,
      })
      .from(reviewNotesTable)
      .innerJoin(userTable, eq(reviewNotesTable.userId, userTable.id))
      .leftJoin(movements, eq(reviewNotesTable.movementId, movements.id))
      .where(
        and(
          inArray(reviewNotesTable.videoSubmissionId, submissionIds),
          eq(reviewNotesTable.teamId, organizingTeamId),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${reviewNotesTable.timestampSeconds} IS NULL THEN 1 ELSE 0 END`,
        asc(reviewNotesTable.timestampSeconds),
      )

    return {
      notes: notes.map((n) => ({
        id: n.id,
        type: n.type,
        content: n.content,
        timestampSeconds: n.timestampSeconds,
        movementId: n.movementId,
        movementName: n.movementName,
        videoSubmissionId: n.videoSubmissionId,
        createdAt: n.createdAt,
        reviewer: {
          id: n.reviewerId,
          firstName: n.reviewerFirstName,
          lastName: n.reviewerLastName,
          avatar: n.reviewerAvatar,
        },
      })),
    }
  })
