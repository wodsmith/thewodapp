/**
 * Review Note Server Functions for TanStack Start
 * Handles organizer review notes on video submissions.
 */

import { createServerFn } from "@tanstack/react-start"
import { asc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { createReviewNoteId } from "@/db/schemas/common"
import { reviewNotesTable } from "@/db/schemas/review-notes"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import { movements, workoutMovements } from "@/db/schemas/workouts"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"

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
	content: z.string().min(1).max(2000),
	timestampSeconds: z.number().int().min(0).optional(),
	movementId: z.string().optional(),
})

const deleteReviewNoteInputSchema = z.object({
	noteId: z.string().min(1),
	competitionId: z.string().min(1),
})

const getWorkoutMovementsInputSchema = z.object({
	workoutId: z.string().min(1),
	competitionId: z.string().min(1),
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

		// Verify organizer permission
		const [competition] = await db
			.select({
				id: competitionsTable.id,
				organizingTeamId: competitionsTable.organizingTeamId,
			})
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

		// Query notes with reviewer info and movement name
		const notes = await db
			.select({
				id: reviewNotesTable.id,
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
				eq(reviewNotesTable.videoSubmissionId, data.videoSubmissionId),
			)
			.orderBy(
				sql`CASE WHEN ${reviewNotesTable.timestampSeconds} IS NULL THEN 1 ELSE 0 END`,
				asc(reviewNotesTable.timestampSeconds),
			)

		return {
			notes: notes.map((n) => ({
				id: n.id,
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

		// Verify organizer permission
		const [competition] = await db
			.select({
				id: competitionsTable.id,
				organizingTeamId: competitionsTable.organizingTeamId,
			})
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

		const id = createReviewNoteId()

		await db.insert(reviewNotesTable).values({
			id,
			videoSubmissionId: data.videoSubmissionId,
			userId: session.userId,
			teamId: competition.organizingTeamId,
			content: data.content,
			timestampSeconds: data.timestampSeconds ?? null,
			movementId: data.movementId ?? null,
		})

		// Return the created note with reviewer info
		const [note] = await db
			.select({
				id: reviewNotesTable.id,
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

		// Verify organizer permission
		const [competition] = await db
			.select({
				id: competitionsTable.id,
				organizingTeamId: competitionsTable.organizingTeamId,
			})
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

		// Verify note exists
		const [note] = await db
			.select({ id: reviewNotesTable.id })
			.from(reviewNotesTable)
			.where(eq(reviewNotesTable.id, data.noteId))
			.limit(1)

		if (!note) {
			throw new Error("NOT_FOUND: Review note not found")
		}

		await db
			.delete(reviewNotesTable)
			.where(eq(reviewNotesTable.id, data.noteId))

		return { success: true }
	})

/**
 * Get movements for a workout (for tagging notes with specific movements).
 */
export const getWorkoutMovementsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getWorkoutMovementsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify organizer permission
		const [competition] = await db
			.select({
				id: competitionsTable.id,
				organizingTeamId: competitionsTable.organizingTeamId,
			})
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

		const results = await db
			.select({
				id: movements.id,
				name: movements.name,
				type: movements.type,
			})
			.from(workoutMovements)
			.innerJoin(movements, eq(workoutMovements.movementId, movements.id))
			.where(eq(workoutMovements.workoutId, data.workoutId))

		return {
			movements: results,
		}
	})
