/**
 * Volunteer Shift CRUD Server Functions for TanStack Start
 * Functions for managing volunteer shifts (time-based shifts for non-judge roles)
 * These are admin-only operations requiring MANAGE_COMPETITIONS permission.
 */

import { createServerFn } from "@tanstack/react-start"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionsTable,
	VOLUNTEER_ROLE_TYPES,
	volunteerShiftsTable,
} from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const competitionIdSchema = z
	.string()
	.startsWith("comp_", "Invalid competition ID")

const shiftIdSchema = z
	.string()
	.startsWith("vshf_", "Invalid volunteer shift ID")

const volunteerRoleTypeSchema = z.enum([
	VOLUNTEER_ROLE_TYPES.JUDGE,
	VOLUNTEER_ROLE_TYPES.HEAD_JUDGE,
	VOLUNTEER_ROLE_TYPES.SCOREKEEPER,
	VOLUNTEER_ROLE_TYPES.EMCEE,
	VOLUNTEER_ROLE_TYPES.FLOOR_MANAGER,
	VOLUNTEER_ROLE_TYPES.MEDIA,
	VOLUNTEER_ROLE_TYPES.GENERAL,
	VOLUNTEER_ROLE_TYPES.EQUIPMENT,
	VOLUNTEER_ROLE_TYPES.MEDICAL,
	VOLUNTEER_ROLE_TYPES.CHECK_IN,
	VOLUNTEER_ROLE_TYPES.STAFF,
])

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get competition and validate organizer permission
 * Returns the competition if authorized, throws otherwise
 */
async function getCompetitionWithAuthCheck(competitionId: string) {
	const db = getDb()

	const competition = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, competitionId),
	})

	if (!competition) {
		throw new Error("NOT_FOUND: Competition not found")
	}

	// Check organizer permission on the organizing team
	await requireTeamPermission(
		competition.organizingTeamId,
		TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
	)

	return competition
}

// ============================================================================
// CRUD Functions
// ============================================================================

/**
 * Create a new volunteer shift
 */
export const createShiftFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				competitionId: competitionIdSchema,
				name: z.string().min(1, "Name is required").max(200),
				roleType: volunteerRoleTypeSchema,
				startTime: z.coerce.date(),
				endTime: z.coerce.date(),
				location: z.string().max(200).optional(),
				capacity: z.number().int().min(1).default(1),
				notes: z.string().max(1000).optional(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		// Validate competition and check permission
		await getCompetitionWithAuthCheck(data.competitionId)

		// Validate end time is after start time
		if (data.endTime <= data.startTime) {
			throw new Error("VALIDATION_ERROR: End time must be after start time")
		}

		const db = getDb()

		const [newShift] = await db
			.insert(volunteerShiftsTable)
			.values({
				competitionId: data.competitionId,
				name: data.name,
				roleType: data.roleType,
				startTime: data.startTime,
				endTime: data.endTime,
				location: data.location,
				capacity: data.capacity,
				notes: data.notes,
			})
			.returning()

		if (!newShift) {
			throw new Error("Failed to create volunteer shift")
		}

		return newShift
	})

/**
 * Get all shifts for a competition, ordered by start time
 */
export const getCompetitionShiftsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				competitionId: competitionIdSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		// Validate competition and check permission
		await getCompetitionWithAuthCheck(data.competitionId)

		const db = getDb()

		const shifts = await db.query.volunteerShiftsTable.findMany({
			where: eq(volunteerShiftsTable.competitionId, data.competitionId),
			orderBy: [asc(volunteerShiftsTable.startTime)],
			with: {
				assignments: {
					with: {
						membership: {
							with: {
								user: true,
							},
						},
					},
				},
			},
		})

		return shifts
	})

/**
 * Update a volunteer shift by ID
 */
export const updateShiftFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				shiftId: shiftIdSchema,
				name: z.string().min(1, "Name is required").max(200).optional(),
				roleType: volunteerRoleTypeSchema.optional(),
				startTime: z.coerce.date().optional(),
				endTime: z.coerce.date().optional(),
				location: z.string().max(200).nullable().optional(),
				capacity: z.number().int().min(1).optional(),
				notes: z.string().max(1000).nullable().optional(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Get the shift to find its competition
		const existingShift = await db.query.volunteerShiftsTable.findFirst({
			where: eq(volunteerShiftsTable.id, data.shiftId),
		})

		if (!existingShift) {
			throw new Error("NOT_FOUND: Volunteer shift not found")
		}

		// Validate permission for this competition
		await getCompetitionWithAuthCheck(existingShift.competitionId)

		// Build update values
		const updateValues: Partial<typeof volunteerShiftsTable.$inferInsert> = {}

		if (data.name !== undefined) updateValues.name = data.name
		if (data.roleType !== undefined) updateValues.roleType = data.roleType
		if (data.startTime !== undefined) updateValues.startTime = data.startTime
		if (data.endTime !== undefined) updateValues.endTime = data.endTime
		if (data.location !== undefined)
			updateValues.location = data.location ?? undefined
		if (data.capacity !== undefined) updateValues.capacity = data.capacity
		if (data.notes !== undefined) updateValues.notes = data.notes ?? undefined

		// Validate times if both are being set or one is changing
		const newStartTime = data.startTime ?? existingShift.startTime
		const newEndTime = data.endTime ?? existingShift.endTime

		if (newEndTime <= newStartTime) {
			throw new Error("VALIDATION_ERROR: End time must be after start time")
		}

		updateValues.updatedAt = new Date()

		const [updatedShift] = await db
			.update(volunteerShiftsTable)
			.set(updateValues)
			.where(eq(volunteerShiftsTable.id, data.shiftId))
			.returning()

		if (!updatedShift) {
			throw new Error("Failed to update volunteer shift")
		}

		return updatedShift
	})

/**
 * Delete a volunteer shift by ID
 * Cascade deletes associated assignments due to foreign key constraint
 */
export const deleteShiftFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				shiftId: shiftIdSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Get the shift to find its competition
		const existingShift = await db.query.volunteerShiftsTable.findFirst({
			where: eq(volunteerShiftsTable.id, data.shiftId),
		})

		if (!existingShift) {
			throw new Error("NOT_FOUND: Volunteer shift not found")
		}

		// Validate permission for this competition
		await getCompetitionWithAuthCheck(existingShift.competitionId)

		// Delete the shift (assignments cascade delete via foreign key)
		await db
			.delete(volunteerShiftsTable)
			.where(eq(volunteerShiftsTable.id, data.shiftId))

		return { success: true }
	})
