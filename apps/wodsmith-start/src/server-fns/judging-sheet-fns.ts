/**
 * Judging Sheet Server Functions for TanStack Start
 * Handles CRUD operations for competition event judging sheets
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { eventJudgingSheetsTable } from "@/db/schemas/judging-sheets"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { competitionsTable } from "@/db/schemas/competitions"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has permission on a team
 */
async function hasTeamPermission(
	teamId: string,
	permission: string,
): Promise<boolean> {
	const session = await getSessionFromCookie()
	if (!session?.userId) return false

	const team = session.teams?.find((t) => t.id === teamId)
	if (!team) return false

	return team.permissions.includes(permission)
}

/**
 * Require team permission or throw error
 */
async function requireTeamPermission(
	teamId: string,
	permission: string,
): Promise<void> {
	const hasPermission = await hasTeamPermission(teamId, permission)
	if (!hasPermission) {
		throw new Error(`Missing required permission: ${permission}`)
	}
}

// ============================================================================
// Input Schemas
// ============================================================================

const getEventJudgingSheetsInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
})

const createJudgingSheetInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	title: z.string().min(1, "Title is required").max(255),
	url: z.string().min(1, "URL is required"),
	r2Key: z.string().min(1, "R2 key is required"),
	originalFilename: z.string().min(1, "Original filename is required"),
	fileSize: z.number().int().positive(),
	mimeType: z.string().min(1, "MIME type is required"),
})

const updateJudgingSheetInputSchema = z.object({
	judgingSheetId: z.string().min(1, "Judging sheet ID is required"),
	title: z.string().min(1, "Title is required").max(255),
})

const deleteJudgingSheetInputSchema = z.object({
	judgingSheetId: z.string().min(1, "Judging sheet ID is required"),
})

const reorderJudgingSheetsInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	updates: z
		.array(
			z.object({
				judgingSheetId: z.string().min(1),
				sortOrder: z.number().int().min(0),
			}),
		)
		.min(1, "At least one update required"),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all judging sheets for a competition event
 * Public access (no auth required) - athletes need to download these
 */
export const getEventJudgingSheetsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getEventJudgingSheetsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const sheets = await db
			.select({
				id: eventJudgingSheetsTable.id,
				title: eventJudgingSheetsTable.title,
				url: eventJudgingSheetsTable.url,
				originalFilename: eventJudgingSheetsTable.originalFilename,
				fileSize: eventJudgingSheetsTable.fileSize,
				mimeType: eventJudgingSheetsTable.mimeType,
				sortOrder: eventJudgingSheetsTable.sortOrder,
				createdAt: eventJudgingSheetsTable.createdAt,
			})
			.from(eventJudgingSheetsTable)
			.where(eq(eventJudgingSheetsTable.trackWorkoutId, data.trackWorkoutId))
			.orderBy(asc(eventJudgingSheetsTable.sortOrder))

		return { sheets }
	})

/**
 * Create a new judging sheet
 * Requires MANAGE_COMPETITIONS permission
 */
export const createJudgingSheetFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createJudgingSheetInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Get the competition to verify ownership
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, data.competitionId),
		})

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Check permission on the organizing team
		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Verify the track workout belongs to this competition using a join
		const trackWorkoutResult = await db
			.select({
				trackWorkoutId: trackWorkoutsTable.id,
				competitionId: programmingTracksTable.competitionId,
			})
			.from(trackWorkoutsTable)
			.innerJoin(
				programmingTracksTable,
				eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
			)
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
			.limit(1)

		if (
			trackWorkoutResult.length === 0 ||
			trackWorkoutResult[0].competitionId !== data.competitionId
		) {
			throw new Error("Event not found or does not belong to this competition")
		}

		// Get the next sort order
		const existingSheets = await db
			.select({ sortOrder: eventJudgingSheetsTable.sortOrder })
			.from(eventJudgingSheetsTable)
			.where(eq(eventJudgingSheetsTable.trackWorkoutId, data.trackWorkoutId))

		const nextSortOrder =
			existingSheets.length > 0
				? Math.max(...existingSheets.map((s) => s.sortOrder)) + 1
				: 0

		// Create the judging sheet
		const [sheet] = await db
			.insert(eventJudgingSheetsTable)
			.values({
				competitionId: data.competitionId,
				trackWorkoutId: data.trackWorkoutId,
				title: data.title,
				url: data.url,
				r2Key: data.r2Key,
				originalFilename: data.originalFilename,
				fileSize: data.fileSize,
				mimeType: data.mimeType,
				uploadedBy: session.userId,
				sortOrder: nextSortOrder,
			})
			.returning()

		if (!sheet) {
			throw new Error("Failed to create judging sheet")
		}

		return { sheet }
	})

/**
 * Update a judging sheet title
 * Requires MANAGE_COMPETITIONS permission
 */
export const updateJudgingSheetFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateJudgingSheetInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Get the judging sheet with competition info
		const sheet = await db.query.eventJudgingSheetsTable.findFirst({
			where: eq(eventJudgingSheetsTable.id, data.judgingSheetId),
			with: {
				competition: true,
			},
		})

		if (!sheet) {
			throw new Error("Judging sheet not found")
		}

		// Check permission on the organizing team
		await requireTeamPermission(
			sheet.competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Update the title
		const [updated] = await db
			.update(eventJudgingSheetsTable)
			.set({
				title: data.title,
				updatedAt: new Date(),
			})
			.where(eq(eventJudgingSheetsTable.id, data.judgingSheetId))
			.returning()

		return { sheet: updated }
	})

/**
 * Delete a judging sheet
 * Requires MANAGE_COMPETITIONS permission
 * Note: This does not delete the file from R2, which would need to be handled separately
 */
export const deleteJudgingSheetFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteJudgingSheetInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Get the judging sheet with competition info
		const sheet = await db.query.eventJudgingSheetsTable.findFirst({
			where: eq(eventJudgingSheetsTable.id, data.judgingSheetId),
			with: {
				competition: true,
			},
		})

		if (!sheet) {
			throw new Error("Judging sheet not found")
		}

		// Check permission on the organizing team
		await requireTeamPermission(
			sheet.competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Delete the judging sheet record
		await db
			.delete(eventJudgingSheetsTable)
			.where(eq(eventJudgingSheetsTable.id, data.judgingSheetId))

		return { success: true }
	})

/**
 * Reorder judging sheets for an event
 * Requires MANAGE_COMPETITIONS permission
 */
export const reorderJudgingSheetsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		reorderJudgingSheetsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Verify authentication
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Not authenticated")
		}

		// Get the track workout to find the competition using a join
		const trackWorkoutResult = await db
			.select({
				trackWorkoutId: trackWorkoutsTable.id,
				competitionId: programmingTracksTable.competitionId,
				organizingTeamId: competitionsTable.organizingTeamId,
			})
			.from(trackWorkoutsTable)
			.innerJoin(
				programmingTracksTable,
				eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
			)
			.innerJoin(
				competitionsTable,
				eq(programmingTracksTable.competitionId, competitionsTable.id),
			)
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
			.limit(1)

		if (trackWorkoutResult.length === 0) {
			throw new Error("Event not found")
		}

		const competition = trackWorkoutResult[0]

		// Check permission on the organizing team
		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Update sort orders
		for (const update of data.updates) {
			await db
				.update(eventJudgingSheetsTable)
				.set({
					sortOrder: update.sortOrder,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(eventJudgingSheetsTable.id, update.judgingSheetId),
						eq(eventJudgingSheetsTable.trackWorkoutId, data.trackWorkoutId),
					),
				)
		}

		return { success: true }
	})
