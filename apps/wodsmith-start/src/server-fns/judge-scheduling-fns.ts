/**
 * Judge Scheduling Server Functions for TanStack Start
 * Port of apps/wodsmith/src/server/judge-scheduling.ts and judge-schedule.ts
 * Converted from Next.js server actions to TanStack Start createServerFn pattern
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	type CompetitionHeatVolunteer,
	competitionHeatsTable,
	competitionJudgeRotationsTable,
	judgeAssignmentVersionsTable,
	judgeHeatAssignmentsTable,
	teamMembershipTable,
	trackWorkoutsTable,
	userTable,
	VOLUNTEER_ROLE_TYPES,
} from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import type {
	VolunteerAvailability,
	VolunteerMembershipMetadata,
} from "@/db/schemas/volunteers"
import { autochunk, chunk } from "@/utils/batch-query"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Types
// ============================================================================

export interface JudgeVolunteerInfo {
	membershipId: string
	userId: string
	firstName: string | null
	lastName: string | null
	avatar?: string | null
	volunteerRoleTypes: string[]
	credentials?: string
	availability?: VolunteerAvailability
	availabilityNotes?: string
}

export interface JudgeHeatAssignment extends CompetitionHeatVolunteer {
	volunteer: JudgeVolunteerInfo
	versionId: string | null
	isManualOverride: boolean
}

export interface JudgeConflictInfo {
	heatId: string
	heatNumber: number
	scheduledTime: Date | null
	trackWorkoutId: string
}

export interface JudgeOverview {
	totalJudges: number
	judgesRequired: number
	coveragePercent: number
	totalSlots: number
	coveredSlots: number
	gaps: number
	overlaps: number
}

// ============================================================================
// Input Schemas
// ============================================================================

const competitionTeamIdSchema = z
	.string()
	.startsWith("team_", "Invalid team ID")

const membershipIdSchema = z
	.string()
	.startsWith("tmem_", "Invalid membership ID")

const heatIdSchema = z.string().startsWith("cheat_", "Invalid heat ID")

const assignmentIdSchema = z
	.string()
	.startsWith("chvol_", "Invalid assignment ID")

const volunteerRoleTypeSchema = z.enum([
	VOLUNTEER_ROLE_TYPES.JUDGE,
	VOLUNTEER_ROLE_TYPES.HEAD_JUDGE,
	VOLUNTEER_ROLE_TYPES.EQUIPMENT,
	VOLUNTEER_ROLE_TYPES.MEDICAL,
	VOLUNTEER_ROLE_TYPES.CHECK_IN,
	VOLUNTEER_ROLE_TYPES.STAFF,
	VOLUNTEER_ROLE_TYPES.SCOREKEEPER,
	VOLUNTEER_ROLE_TYPES.EMCEE,
	VOLUNTEER_ROLE_TYPES.FLOOR_MANAGER,
	VOLUNTEER_ROLE_TYPES.MEDIA,
	VOLUNTEER_ROLE_TYPES.GENERAL,
])

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse volunteer metadata from membership record
 */
function parseVolunteerMetadata(
	metadata: string | null,
): VolunteerMembershipMetadata | null {
	if (!metadata) return null
	try {
		return JSON.parse(metadata) as VolunteerMembershipMetadata
	} catch {
		return null
	}
}

/**
 * Check if volunteer has judge or head_judge role type
 */
function isJudge(metadata: string | null): boolean {
	const meta = parseVolunteerMetadata(metadata)
	if (!meta?.volunteerRoleTypes) return false
	return (
		meta.volunteerRoleTypes.includes(VOLUNTEER_ROLE_TYPES.JUDGE) ||
		meta.volunteerRoleTypes.includes(VOLUNTEER_ROLE_TYPES.HEAD_JUDGE)
	)
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all volunteers with judge or head_judge role types for a competition team.
 */
export const getJudgeVolunteersFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ competitionTeamId: competitionTeamIdSchema }).parse(data),
	)
	.handler(async ({ data }): Promise<JudgeVolunteerInfo[]> => {
		const db = getDb()

		// Get all memberships for the competition team
		const memberships = await db
			.select({
				id: teamMembershipTable.id,
				userId: teamMembershipTable.userId,
				metadata: teamMembershipTable.metadata,
			})
			.from(teamMembershipTable)
			.where(eq(teamMembershipTable.teamId, data.competitionTeamId))

		// Filter for judge volunteers
		const judgeVolunteers = memberships.filter((m) => isJudge(m.metadata))

		if (judgeVolunteers.length === 0) {
			return []
		}

		// Fetch users in batches
		const userIds = [...new Set(judgeVolunteers.map((v) => v.userId))]
		const users = await autochunk({ items: userIds }, async (userChunk) =>
			db
				.select({
					id: userTable.id,
					firstName: userTable.firstName,
					lastName: userTable.lastName,
					avatar: userTable.avatar,
				})
				.from(userTable)
				.where(inArray(userTable.id, userChunk)),
		)
		const userMap = new Map(users.map((u) => [u.id, u]))

		// Build result
		return judgeVolunteers.map((volunteer) => {
			const meta = parseVolunteerMetadata(volunteer.metadata)
			const user = userMap.get(volunteer.userId)

			return {
				membershipId: volunteer.id,
				userId: volunteer.userId,
				firstName: user?.firstName ?? null,
				lastName: user?.lastName ?? null,
				avatar: user?.avatar ?? null,
				volunteerRoleTypes: meta?.volunteerRoleTypes ?? [],
				credentials: meta?.credentials,
				availability: meta?.availability,
				availabilityNotes: meta?.availabilityNotes,
			}
		})
	})

/**
 * Get all judge assignments for all heats of a track workout (event).
 */
export const getJudgeHeatAssignmentsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				trackWorkoutId: z.string().min(1, "Track workout ID is required"),
				versionId: z.string().optional(),
			})
			.parse(data),
	)
	.handler(async ({ data }): Promise<JudgeHeatAssignment[]> => {
		const db = getDb()

		// If no versionId provided, find the active version for this event
		let targetVersionId = data.versionId
		if (!targetVersionId) {
			const activeVersion = await db
				.select()
				.from(judgeAssignmentVersionsTable)
				.where(
					and(
						eq(
							judgeAssignmentVersionsTable.trackWorkoutId,
							data.trackWorkoutId,
						),
						eq(judgeAssignmentVersionsTable.isActive, true),
					),
				)
				.limit(1)
				.then((rows) => rows[0] ?? null)

			// If no active version exists, return empty array (nothing published yet)
			if (!activeVersion) {
				return []
			}

			targetVersionId = activeVersion.id
		}

		// Get all heats for this event
		const heats = await db
			.select({ id: competitionHeatsTable.id })
			.from(competitionHeatsTable)
			.where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

		if (heats.length === 0) {
			return []
		}

		const heatIds = heats.map((h) => h.id)

		// Fetch assignments in batches, filtered by versionId
		const assignments = await autochunk({ items: heatIds }, async (heatChunk) =>
			db
				.select()
				.from(judgeHeatAssignmentsTable)
				.where(
					and(
						inArray(judgeHeatAssignmentsTable.heatId, heatChunk),
						eq(judgeHeatAssignmentsTable.versionId, targetVersionId!),
					),
				),
		)

		if (assignments.length === 0) {
			return []
		}

		// Get unique membership IDs
		const membershipIds = [...new Set(assignments.map((a) => a.membershipId))]

		// Fetch memberships in batches
		const memberships = await autochunk(
			{ items: membershipIds },
			async (membershipChunk) =>
				db
					.select({
						id: teamMembershipTable.id,
						userId: teamMembershipTable.userId,
						metadata: teamMembershipTable.metadata,
					})
					.from(teamMembershipTable)
					.where(inArray(teamMembershipTable.id, membershipChunk)),
		)

		// Fetch users in batches
		const userIds = [...new Set(memberships.map((m) => m.userId))]
		const users = await autochunk({ items: userIds }, async (userChunk) =>
			db
				.select({
					id: userTable.id,
					firstName: userTable.firstName,
					lastName: userTable.lastName,
					avatar: userTable.avatar,
				})
				.from(userTable)
				.where(inArray(userTable.id, userChunk)),
		)
		const userMap = new Map(users.map((u) => [u.id, u]))

		// Build membership info map
		const membershipMap = new Map(
			memberships.map((m) => {
				const meta = parseVolunteerMetadata(m.metadata)
				const user = userMap.get(m.userId)

				return [
					m.id,
					{
						membershipId: m.id,
						userId: m.userId,
						firstName: user?.firstName ?? null,
						lastName: user?.lastName ?? null,
						avatar: user?.avatar ?? null,
						volunteerRoleTypes: meta?.volunteerRoleTypes ?? [],
						credentials: meta?.credentials,
						availabilityNotes: meta?.availabilityNotes,
					},
				]
			}),
		)

		// Build result
		return assignments.map((assignment) => ({
			...assignment,
			volunteer:
				membershipMap.get(assignment.membershipId) ??
				({
					membershipId: assignment.membershipId,
					userId: "",
					firstName: null,
					lastName: null,
					volunteerRoleTypes: [],
				} as JudgeVolunteerInfo),
		}))
	})

/**
 * Get rotations for an event
 */
export const getRotationsForEventFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ trackWorkoutId: z.string() }).parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const rotations = await db.query.competitionJudgeRotationsTable.findMany({
			where: eq(
				competitionJudgeRotationsTable.trackWorkoutId,
				data.trackWorkoutId,
			),
			orderBy: (table, { asc }) => [asc(table.startingHeat)],
		})

		// Get event defaults from trackWorkout
		const event = await db.query.trackWorkoutsTable.findFirst({
			where: eq(trackWorkoutsTable.id, data.trackWorkoutId),
		})

		const eventDefaults = {
			defaultHeatsCount: event?.defaultHeatsCount ?? null,
			defaultLaneShiftPattern: event?.defaultLaneShiftPattern ?? null,
			minHeatBuffer: event?.minHeatBuffer ?? null,
		}

		return {
			rotations,
			eventDefaults,
		}
	})

// Note: getVersionHistoryFn and getActiveVersionFn are in judge-assignment-fns.ts

/**
 * Get judge conflicts for a heat
 */
export const getJudgeConflictsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z
			.object({
				membershipId: membershipIdSchema,
				heatId: heatIdSchema,
			})
			.parse(data),
	)
	.handler(async ({ data }): Promise<JudgeConflictInfo | null> => {
		const db = getDb()

		// Get the target heat's time
		const targetHeat = await db
			.select({
				scheduledTime: competitionHeatsTable.scheduledTime,
				durationMinutes: competitionHeatsTable.durationMinutes,
			})
			.from(competitionHeatsTable)
			.where(eq(competitionHeatsTable.id, data.heatId))
			.then((rows) => rows[0])

		if (!targetHeat?.scheduledTime) {
			// No scheduled time, can't check conflicts
			return null
		}

		// Get all heat assignments for this judge
		const judgeAssignments = await db
			.select({
				heatId: judgeHeatAssignmentsTable.heatId,
			})
			.from(judgeHeatAssignmentsTable)
			.where(eq(judgeHeatAssignmentsTable.membershipId, data.membershipId))

		if (judgeAssignments.length === 0) {
			return null
		}

		const assignedHeatIds = judgeAssignments.map((a) => a.heatId)

		// Fetch heat details in batches
		const assignedHeats = await autochunk(
			{ items: assignedHeatIds },
			async (heatChunk) =>
				db
					.select({
						id: competitionHeatsTable.id,
						heatNumber: competitionHeatsTable.heatNumber,
						scheduledTime: competitionHeatsTable.scheduledTime,
						durationMinutes: competitionHeatsTable.durationMinutes,
						trackWorkoutId: competitionHeatsTable.trackWorkoutId,
					})
					.from(competitionHeatsTable)
					.where(inArray(competitionHeatsTable.id, heatChunk)),
		)

		// Check for time overlaps
		const targetStart = new Date(targetHeat.scheduledTime)
		const targetEnd = new Date(targetStart)
		targetEnd.setMinutes(
			targetEnd.getMinutes() + (targetHeat.durationMinutes ?? 15),
		)

		for (const heat of assignedHeats) {
			if (!heat.scheduledTime || heat.id === data.heatId) continue

			const heatStart = new Date(heat.scheduledTime)
			const heatEnd = new Date(heatStart)
			heatEnd.setMinutes(heatEnd.getMinutes() + (heat.durationMinutes ?? 15))

			// Check for overlap: (start1 < end2) AND (end1 > start2)
			if (targetStart < heatEnd && targetEnd > heatStart) {
				return {
					heatId: heat.id,
					heatNumber: heat.heatNumber,
					scheduledTime: heat.scheduledTime,
					trackWorkoutId: heat.trackWorkoutId,
				}
			}
		}

		return null
	})

/**
 * Calculate the minimum number of unique judges required to achieve full coverage.
 */
export function calculateRequiredJudges(
	heats: Array<{ heatNumber: number; laneCount: number }>,
	rotationLength = 3,
): number {
	if (heats.length === 0) return 0

	// Total slots that need coverage
	const totalSlots = heats.reduce((sum, heat) => sum + heat.laneCount, 0)

	// Average lanes per heat
	const avgLanes =
		heats.reduce((sum, heat) => sum + heat.laneCount, 0) / heats.length

	// If each judge works rotationLength heats, they cover rotationLength slots
	// We need enough judges to cover avgLanes at any given time
	const judgesPerHeat = Math.ceil(avgLanes)

	// Minimum judges needed (considering rotations)
	const minJudges = Math.ceil(totalSlots / (rotationLength * avgLanes))

	return Math.max(minJudges, judgesPerHeat)
}

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Assign a single judge to a heat lane
 */
export const assignJudgeToHeatFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				heatId: heatIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				membershipId: membershipIdSchema,
				laneNumber: z.number().int().min(1),
				position: volunteerRoleTypeSchema.nullable().optional(),
				instructions: z.string().nullable().optional(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()
		const [assignment] = await db
			.insert(judgeHeatAssignmentsTable)
			.values({
				heatId: data.heatId,
				membershipId: data.membershipId,
				laneNumber: data.laneNumber,
				position: data.position ?? null,
				instructions: data.instructions ?? null,
			})
			.returning()

		if (!assignment) {
			throw new Error("Failed to assign judge to heat")
		}

		return { success: true, data: assignment }
	})

/**
 * Bulk assign multiple judges to a heat
 */
export const bulkAssignJudgesToHeatFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				heatId: heatIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				assignments: z.array(
					z.object({
						membershipId: membershipIdSchema,
						laneNumber: z.number().int().min(1).nullable(),
						position: volunteerRoleTypeSchema.nullable().optional(),
						instructions: z.string().nullable().optional(),
					}),
				),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		if (data.assignments.length === 0) {
			return { success: true, data: [] }
		}

		const db = getDb()

		// Each insert row uses ~7 params (id, heatId, membershipId, laneNumber, position, instructions, commonColumns)
		// D1 has a 100 param limit, so max 14 rows per batch (14 * 7 = 98)
		// Use 10 to be safe
		const INSERT_BATCH_SIZE = 10

		const results = await Promise.all(
			chunk(data.assignments, INSERT_BATCH_SIZE).map((batch) =>
				db
					.insert(judgeHeatAssignmentsTable)
					.values(
						batch.map((a) => ({
							heatId: data.heatId,
							membershipId: a.membershipId,
							laneNumber: a.laneNumber,
							position: a.position ?? null,
							instructions: a.instructions ?? null,
						})),
					)
					.returning(),
			),
		)

		return { success: true, data: results.flat() }
	})

/**
 * Remove a judge assignment from a heat
 */
export const removeJudgeFromHeatFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				assignmentId: assignmentIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()
		await db
			.delete(judgeHeatAssignmentsTable)
			.where(eq(judgeHeatAssignmentsTable.id, data.assignmentId))

		return { success: true }
	})

/**
 * Move a judge assignment to a different heat/lane
 */
export const moveJudgeAssignmentFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				assignmentId: assignmentIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
				targetHeatId: heatIdSchema,
				targetLaneNumber: z.number().int().min(1),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()
		await db
			.update(judgeHeatAssignmentsTable)
			.set({
				heatId: data.targetHeatId,
				laneNumber: data.targetLaneNumber,
				updatedAt: new Date(),
			})
			.where(eq(judgeHeatAssignmentsTable.id, data.assignmentId))

		return { success: true }
	})

/**
 * Copy judge assignments from one heat to another
 */
export const copyJudgeAssignmentsToHeatFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				sourceHeatId: heatIdSchema,
				targetHeatId: heatIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()

		// Get source assignments
		const sourceAssignments = await db
			.select()
			.from(judgeHeatAssignmentsTable)
			.where(eq(judgeHeatAssignmentsTable.heatId, data.sourceHeatId))

		if (sourceAssignments.length === 0) {
			return { success: true, data: [] }
		}

		// Insert into target heat in batches
		const INSERT_BATCH_SIZE = 10
		const results = await Promise.all(
			chunk(sourceAssignments, INSERT_BATCH_SIZE).map((batch) =>
				db
					.insert(judgeHeatAssignmentsTable)
					.values(
						batch.map((a) => ({
							heatId: data.targetHeatId,
							membershipId: a.membershipId,
							laneNumber: a.laneNumber,
							position: a.position,
							instructions: a.instructions,
						})),
					)
					.returning(),
			),
		)

		return { success: true, data: results.flat() }
	})

/**
 * Copy judge assignments from a heat to all remaining heats in the event
 */
export const copyJudgeAssignmentsToRemainingHeatsFn = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		z
			.object({
				sourceHeatId: heatIdSchema,
				trackWorkoutId: z.string().min(1, "Track workout ID is required"),
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()

		// Get source heat details
		const sourceHeat = await db
			.select({ heatNumber: competitionHeatsTable.heatNumber })
			.from(competitionHeatsTable)
			.where(eq(competitionHeatsTable.id, data.sourceHeatId))
			.then((rows) => rows[0])

		if (!sourceHeat) {
			throw new Error("Source heat not found")
		}

		// Get all heats for this event to filter by heat number
		const allHeats = await db
			.select({
				id: competitionHeatsTable.id,
				heatNumber: competitionHeatsTable.heatNumber,
			})
			.from(competitionHeatsTable)
			.where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

		const targetHeats = allHeats
			.filter((h) => h.heatNumber > sourceHeat.heatNumber)
			.sort((a, b) => a.heatNumber - b.heatNumber)

		if (targetHeats.length === 0) {
			return { success: true, data: [] }
		}

		// Get source assignments
		const sourceAssignments = await db
			.select()
			.from(judgeHeatAssignmentsTable)
			.where(eq(judgeHeatAssignmentsTable.heatId, data.sourceHeatId))

		if (sourceAssignments.length === 0) {
			return { success: true, data: [] }
		}

		// Copy to each remaining heat
		const INSERT_BATCH_SIZE = 10
		const results = await Promise.all(
			targetHeats.map(async (heat) => {
				const batchResults = await Promise.all(
					chunk(sourceAssignments, INSERT_BATCH_SIZE).map((batch) =>
						db
							.insert(judgeHeatAssignmentsTable)
							.values(
								batch.map((a) => ({
									heatId: heat.id,
									membershipId: a.membershipId,
									laneNumber: a.laneNumber,
									position: a.position,
									instructions: a.instructions,
								})),
							)
							.returning(),
					),
				)

				return {
					heatId: heat.id,
					assignments: batchResults.flat(),
				}
			}),
		)

		return { success: true, data: results }
	})

/**
 * Clear all judge assignments from a heat
 */
export const clearHeatJudgeAssignmentsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				heatId: heatIdSchema,
				organizingTeamId: competitionTeamIdSchema,
				competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireTeamPermission(
			data.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()
		await db
			.delete(judgeHeatAssignmentsTable)
			.where(eq(judgeHeatAssignmentsTable.heatId, data.heatId))

		return { success: true }
	})
