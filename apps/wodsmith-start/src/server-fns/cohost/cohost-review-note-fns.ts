/**
 * Cohost Review Note Server Functions
 * Mirrors review-note-fns.ts with cohost auth.
 * Allows cohosts with scoring permission to create, update, delete review notes
 * and fetch workout movements for note tagging.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionRegistrationsTable,
  competitionsTable,
} from "@/db/schemas/competitions"
import { createReviewNoteId } from "@/db/schemas/common"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { reviewNotesTable } from "@/db/schemas/review-notes"
import { userTable } from "@/db/schemas/users"
import { videoSubmissionsTable } from "@/db/schemas/video-submissions"
import { movements, workoutMovements } from "@/db/schemas/workouts"
import { getSessionFromCookie } from "@/utils/auth"
import {
  requireCohostCompetitionOwnership,
  requireCohostPermission,
} from "@/utils/cohost-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostGetReviewNotesInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  videoSubmissionId: z.string().min(1),
  competitionId: z.string().min(1),
})

const cohostCreateReviewNoteInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  videoSubmissionId: z.string().min(1),
  competitionId: z.string().min(1),
  type: z.enum(["general", "no-rep"]).default("general"),
  content: z.string().min(1).max(2000),
  timestampSeconds: z.number().int().min(0).optional(),
  movementId: z.string().optional(),
})

const cohostUpdateReviewNoteInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  noteId: z.string().min(1),
  competitionId: z.string().min(1),
  type: z.enum(["general", "no-rep"]).optional(),
  content: z.string().min(1).max(2000).optional(),
  movementId: z.string().nullable().optional(),
})

const cohostDeleteReviewNoteInputSchema = z.object({
  competitionTeamId: z.string().min(1, "Competition team ID is required"),
  noteId: z.string().min(1),
  competitionId: z.string().min(1),
})

const cohostGetWorkoutMovementsInputSchema = z
  .object({
    competitionTeamId: z.string().min(1, "Competition team ID is required"),
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
 * Get all review notes for a video submission (cohost).
 */
export const cohostGetReviewNotesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostGetReviewNotesInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "scoring")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

    // Get organizing team ID for note filtering
    const [competition] = await db
      .select({ organizingTeamId: competitionsTable.organizingTeamId })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!competition) {
      throw new Error("NOT_FOUND: Competition not found")
    }

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
          eq(reviewNotesTable.teamId, competition.organizingTeamId),
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
 * Create a review note on a video submission (cohost).
 */
export const cohostCreateReviewNoteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostCreateReviewNoteInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "scoring")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    // Get organizing team ID for the note
    const [competition] = await db
      .select({ organizingTeamId: competitionsTable.organizingTeamId })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!competition) {
      throw new Error("NOT_FOUND: Competition not found")
    }

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
      teamId: competition.organizingTeamId,
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
 * Update a review note (cohost).
 */
export const cohostUpdateReviewNoteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostUpdateReviewNoteInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "scoring")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    // Get organizing team ID
    const [competition] = await db
      .select({ organizingTeamId: competitionsTable.organizingTeamId })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!competition) {
      throw new Error("NOT_FOUND: Competition not found")
    }

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
          eq(reviewNotesTable.teamId, competition.organizingTeamId),
        ),
      )

    return { success: true }
  })

/**
 * Delete a review note (cohost).
 */
export const cohostDeleteReviewNoteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    cohostDeleteReviewNoteInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "scoring")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    const db = getDb()

    // Get organizing team ID
    const [competition] = await db
      .select({ organizingTeamId: competitionsTable.organizingTeamId })
      .from(competitionsTable)
      .where(eq(competitionsTable.id, data.competitionId))
      .limit(1)

    if (!competition) {
      throw new Error("NOT_FOUND: Competition not found")
    }

    // Verify note exists and belongs to this competition's team
    const [note] = await db
      .select({ id: reviewNotesTable.id })
      .from(reviewNotesTable)
      .where(
        and(
          eq(reviewNotesTable.id, data.noteId),
          eq(reviewNotesTable.teamId, competition.organizingTeamId),
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
          eq(reviewNotesTable.teamId, competition.organizingTeamId),
        ),
      )

    return { success: true }
  })

/**
 * Get movements for a workout (cohost — for tagging notes with movements).
 */
export const cohostGetWorkoutMovementsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostGetWorkoutMovementsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "scoring")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    const db = getDb()

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

    return { movements: results }
  })
