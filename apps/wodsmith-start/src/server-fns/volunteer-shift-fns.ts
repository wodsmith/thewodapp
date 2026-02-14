/**
 * Volunteer Shift CRUD Server Functions for TanStack Start
 * Functions for managing volunteer shifts (time-based shifts for non-judge roles)
 * These are admin-only operations requiring MANAGE_COMPETITIONS permission.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionsTable,
	teamMembershipTable,
	userTable,
	VOLUNTEER_ROLE_TYPES,
	volunteerShiftAssignmentsTable,
	volunteerShiftsTable,
} from "@/db/schema"
import type { VolunteerMembershipMetadata } from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
	createVolunteerShiftAssignmentId,
	createVolunteerShiftId,
} from "@/db/schemas/common"
import { autochunk } from "@/utils/batch-query"
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

const membershipIdSchema = z
	.string()
	.startsWith("tmem_", "Invalid team membership ID")

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
	VOLUNTEER_ROLE_TYPES.ATHLETE_CONTROL,
	VOLUNTEER_ROLE_TYPES.EQUIPMENT_TEAM,
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

		const newShiftId = createVolunteerShiftId()

		await db.insert(volunteerShiftsTable).values({
			id: newShiftId,
			competitionId: data.competitionId,
			name: data.name,
			roleType: data.roleType,
			startTime: data.startTime,
			endTime: data.endTime,
			location: data.location,
			capacity: data.capacity,
			notes: data.notes,
		})

		const newShift = await db.query.volunteerShiftsTable.findFirst({
			where: eq(volunteerShiftsTable.id, newShiftId),
		})

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

		await db
			.update(volunteerShiftsTable)
			.set(updateValues)
			.where(eq(volunteerShiftsTable.id, data.shiftId))

		const updatedShift = await db.query.volunteerShiftsTable.findFirst({
			where: eq(volunteerShiftsTable.id, data.shiftId),
		})

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

// ============================================================================
// Assignment Functions
// ============================================================================

/**
 * Helper to get shift with competition context for assignment operations
 * Validates organizer permission and returns shift with current assignment count
 */
async function getShiftWithAuthCheck(shiftId: string) {
	const db = getDb()

	const shift = await db.query.volunteerShiftsTable.findFirst({
		where: eq(volunteerShiftsTable.id, shiftId),
		with: {
			assignments: true,
		},
	})

	if (!shift) {
		throw new Error("NOT_FOUND: Volunteer shift not found")
	}

	// Validate permission for this competition
	await getCompetitionWithAuthCheck(shift.competitionId)

	return shift
}

/**
 * Parse volunteer role types from membership metadata
 */
function parseVolunteerRoleTypes(
	metadata: string | null,
): VolunteerMembershipMetadata["volunteerRoleTypes"] {
	if (!metadata) return []
	try {
		const parsed = JSON.parse(metadata) as VolunteerMembershipMetadata
		return parsed.volunteerRoleTypes ?? []
	} catch {
		return []
	}
}

/**
 * Assign a volunteer to a shift
 * Validates that shift capacity is not exceeded
 */
export const assignVolunteerToShiftFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				shiftId: shiftIdSchema,
				membershipId: membershipIdSchema,
				notes: z.string().max(500).optional(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Get shift with current assignments and validate permission
		const shift = await getShiftWithAuthCheck(data.shiftId)

		// Check if volunteer is already assigned to this shift
		const existingAssignment = shift.assignments.find(
			(a) => a.membershipId === data.membershipId,
		)
		if (existingAssignment) {
			throw new Error(
				"VALIDATION_ERROR: Volunteer is already assigned to this shift",
			)
		}

		// Validate capacity
		if (shift.assignments.length >= shift.capacity) {
			throw new Error(
				`VALIDATION_ERROR: Shift capacity (${shift.capacity}) has been reached`,
			)
		}

		// Verify membership exists
		const membership = await db.query.teamMembershipTable.findFirst({
			where: eq(teamMembershipTable.id, data.membershipId),
		})

		if (!membership) {
			throw new Error("NOT_FOUND: Team membership not found")
		}

		// Create the assignment
		const newAssignmentId = createVolunteerShiftAssignmentId()

		await db.insert(volunteerShiftAssignmentsTable).values({
			id: newAssignmentId,
			shiftId: data.shiftId,
			membershipId: data.membershipId,
			notes: data.notes,
		})

		const assignment =
			await db.query.volunteerShiftAssignmentsTable.findFirst({
				where: eq(volunteerShiftAssignmentsTable.id, newAssignmentId),
			})

		if (!assignment) {
			throw new Error("Failed to create shift assignment")
		}

		return assignment
	})

/**
 * Unassign a volunteer from a shift
 */
export const unassignVolunteerFromShiftFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				shiftId: shiftIdSchema,
				membershipId: membershipIdSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Validate permission via shift
		await getShiftWithAuthCheck(data.shiftId)

		// Check the assignment exists before deleting
		const existingAssignment =
			await db.query.volunteerShiftAssignmentsTable.findFirst({
				where: and(
					eq(volunteerShiftAssignmentsTable.shiftId, data.shiftId),
					eq(volunteerShiftAssignmentsTable.membershipId, data.membershipId),
				),
			})

		if (!existingAssignment) {
			throw new Error("NOT_FOUND: Assignment not found")
		}

		// Delete the assignment
		await db
			.delete(volunteerShiftAssignmentsTable)
			.where(eq(volunteerShiftAssignmentsTable.id, existingAssignment.id))

		return { success: true }
	})

/**
 * Get all assignments for a shift with volunteer details (name, email, roleTypes)
 */
export const getShiftAssignmentsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				shiftId: shiftIdSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		// Validate permission
		await getShiftWithAuthCheck(data.shiftId)

		const db = getDb()

		// Use join query to get assignments with membership and user data
		const rows = await db
			.select({
				assignment: volunteerShiftAssignmentsTable,
				membership: teamMembershipTable,
				user: userTable,
			})
			.from(volunteerShiftAssignmentsTable)
			.innerJoin(
				teamMembershipTable,
				eq(volunteerShiftAssignmentsTable.membershipId, teamMembershipTable.id),
			)
			.innerJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
			.where(eq(volunteerShiftAssignmentsTable.shiftId, data.shiftId))

		// Transform to include volunteer details
		return rows.map((row) => ({
			id: row.assignment.id,
			shiftId: row.assignment.shiftId,
			membershipId: row.assignment.membershipId,
			notes: row.assignment.notes,
			createdAt: row.assignment.createdAt,
			updatedAt: row.assignment.updatedAt,
			volunteer: {
				name: [row.user.firstName, row.user.lastName].filter(Boolean).join(" "),
				email: row.user.email,
				roleTypes: parseVolunteerRoleTypes(row.membership.metadata),
			},
		}))
	})

/**
 * Get all shift assignments for a specific volunteer (by membershipId)
 */
export const getVolunteerShiftsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				membershipId: membershipIdSchema,
				competitionId: competitionIdSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		// Validate permission for the competition
		await getCompetitionWithAuthCheck(data.competitionId)

		const db = getDb()

		// Get all assignments for this volunteer
		const assignments = await db.query.volunteerShiftAssignmentsTable.findMany({
			where: eq(volunteerShiftAssignmentsTable.membershipId, data.membershipId),
			with: {
				shift: true,
			},
		})

		// Filter to only include shifts from the specified competition
		const filteredAssignments = assignments.filter(
			(a) => a.shift.competitionId === data.competitionId,
		)

		// Return assignments with shift details
		return filteredAssignments.map((assignment) => ({
			id: assignment.id,
			shiftId: assignment.shiftId,
			membershipId: assignment.membershipId,
			notes: assignment.notes,
			createdAt: assignment.createdAt,
			updatedAt: assignment.updatedAt,
			shift: {
				id: assignment.shift.id,
				name: assignment.shift.name,
				roleType: assignment.shift.roleType,
				startTime: assignment.shift.startTime,
				endTime: assignment.shift.endTime,
				location: assignment.shift.location,
				capacity: assignment.shift.capacity,
			},
		}))
	})

/**
 * Bulk assign multiple volunteers to a shift at once
 * Validates capacity is not exceeded for all assignments combined
 */
export const bulkAssignVolunteersToShiftFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				shiftId: shiftIdSchema,
				membershipIds: z.array(membershipIdSchema).min(1),
				notes: z.string().max(500).optional(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Get shift with current assignments and validate permission
		const shift = await getShiftWithAuthCheck(data.shiftId)

		// Remove duplicates from membershipIds
		const uniqueMembershipIds = [...new Set(data.membershipIds)]

		// Check which volunteers are already assigned
		const existingMembershipIds = new Set(
			shift.assignments.map((a) => a.membershipId),
		)
		const newMembershipIds = uniqueMembershipIds.filter(
			(id) => !existingMembershipIds.has(id),
		)

		if (newMembershipIds.length === 0) {
			return {
				success: true,
				assignedCount: 0,
				skippedCount: uniqueMembershipIds.length,
				message: "All volunteers are already assigned to this shift",
			}
		}

		// Validate capacity for new assignments
		const totalAfterAssignment =
			shift.assignments.length + newMembershipIds.length
		if (totalAfterAssignment > shift.capacity) {
			throw new Error(
				`VALIDATION_ERROR: Cannot assign ${newMembershipIds.length} volunteers. ` +
					`Shift capacity is ${shift.capacity}, currently ${shift.assignments.length} assigned. ` +
					`Would exceed by ${totalAfterAssignment - shift.capacity}.`,
			)
		}

		// Verify all memberships exist using autochunk for D1 parameter limits
		const memberships = await autochunk(
			{ items: newMembershipIds, otherParametersCount: 0 },
			async (chunk) =>
				db
					.select({ id: teamMembershipTable.id })
					.from(teamMembershipTable)
					.where(inArray(teamMembershipTable.id, chunk)),
		)

		const foundMembershipIds = new Set(memberships.map((m) => m.id))
		const missingMembershipIds = newMembershipIds.filter(
			(id) => !foundMembershipIds.has(id),
		)

		if (missingMembershipIds.length > 0) {
			throw new Error(
				`NOT_FOUND: Team memberships not found: ${missingMembershipIds.join(", ")}`,
			)
		}

		// Create assignments with pre-generated IDs
		const assignmentValues = newMembershipIds.map((membershipId) => ({
			id: createVolunteerShiftAssignmentId(),
			shiftId: data.shiftId,
			membershipId,
			notes: data.notes,
		}))

		// MySQL parameter limit - batch inserts
		// volunteerShiftAssignmentsTable has ~6 columns per insert (id, shiftId, membershipId, notes, createdAt, updatedAt)
		const BATCH_SIZE = 15
		const allIds: string[] = []

		for (let i = 0; i < assignmentValues.length; i += BATCH_SIZE) {
			const batch = assignmentValues.slice(i, i + BATCH_SIZE)
			await db.insert(volunteerShiftAssignmentsTable).values(batch)
			allIds.push(...batch.map((v) => v.id))
		}

		// Query back the created assignments
		const createdAssignments = await autochunk(
			{ items: allIds, otherParametersCount: 0 },
			async (chunk) =>
				db.query.volunteerShiftAssignmentsTable.findMany({
					where: inArray(volunteerShiftAssignmentsTable.id, chunk),
				}),
		)

		return {
			success: true,
			assignedCount: createdAssignments.length,
			skippedCount: uniqueMembershipIds.length - newMembershipIds.length,
			assignments: createdAssignments,
		}
	})
