import "server-only"

import { eq, inArray } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "@/db/schema"

type Db = DrizzleD1Database<typeof schema>
import {
	type CompetitionHeatVolunteer,
	competitionHeatsTable,
	competitionHeatVolunteersTable,
	teamMembershipTable,
	userTable,
	VOLUNTEER_ROLE_TYPES,
	type VolunteerMembershipMetadata,
} from "@/db/schema"
import { autochunk, chunk } from "@/utils/batch-query"

// ============================================================================
// Types
// ============================================================================

export interface JudgeVolunteerInfo {
	membershipId: string
	userId: string
	firstName: string | null
	lastName: string | null
	volunteerRoleTypes: string[]
	credentials?: string
	availabilityNotes?: string
}

export interface JudgeHeatAssignment extends CompetitionHeatVolunteer {
	volunteer: JudgeVolunteerInfo
}

export interface JudgeConflictInfo {
	heatId: string
	heatNumber: number
	scheduledTime: Date | null
	trackWorkoutId: string
}

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
// 1. Get Judge Volunteers
// ============================================================================

/**
 * Get all volunteers with judge or head_judge role types for a competition team.
 * Uses sql-batching pattern for fetching user details.
 */
export async function getJudgeVolunteers(
	db: Db,
	competitionTeamId: string,
): Promise<JudgeVolunteerInfo[]> {
	// Get all memberships for the competition team
	const memberships = await db
		.select({
			id: teamMembershipTable.id,
			userId: teamMembershipTable.userId,
			metadata: teamMembershipTable.metadata,
		})
		.from(teamMembershipTable)
		.where(eq(teamMembershipTable.teamId, competitionTeamId))

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
			volunteerRoleTypes: meta?.volunteerRoleTypes ?? [],
			credentials: meta?.credentials,
			availabilityNotes: meta?.availabilityNotes,
		}
	})
}

// ============================================================================
// 2. Get Judge Heat Assignments
// ============================================================================

/**
 * Get all judge assignments for all heats of a track workout (event).
 * Uses sql-batching pattern for fetching related data.
 */
export async function getJudgeHeatAssignments(
	db: Db,
	trackWorkoutId: string,
): Promise<JudgeHeatAssignment[]> {
	// Get all heats for this event
	const heats = await db
		.select({ id: competitionHeatsTable.id })
		.from(competitionHeatsTable)
		.where(eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId))

	if (heats.length === 0) {
		return []
	}

	const heatIds = heats.map((h) => h.id)

	// Fetch assignments in batches
	const assignments = await autochunk({ items: heatIds }, async (heatChunk) =>
		db
			.select()
			.from(competitionHeatVolunteersTable)
			.where(inArray(competitionHeatVolunteersTable.heatId, heatChunk)),
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
}

// ============================================================================
// 3. Assign Judge to Heat
// ============================================================================

/**
 * Assign a single judge to a heat lane.
 */
export async function assignJudgeToHeat(
	db: Db,
	params: {
		heatId: string
		membershipId: string
		laneNumber: number
		position?: schema.VolunteerRoleType | null
		instructions?: string | null
	},
): Promise<CompetitionHeatVolunteer> {
	const [assignment] = await db
		.insert(competitionHeatVolunteersTable)
		.values({
			heatId: params.heatId,
			membershipId: params.membershipId,
			laneNumber: params.laneNumber,
			position: params.position ?? null,
			instructions: params.instructions ?? null,
		})
		.returning()

	if (!assignment) {
		throw new Error("Failed to assign judge to heat")
	}

	return assignment
}

// ============================================================================
// 4. Bulk Assign Judges to Heat
// ============================================================================

/**
 * Bulk assign multiple judges to a heat.
 * Batches inserts to avoid D1 SQL variable limit.
 */
export async function bulkAssignJudgesToHeat(
	db: Db,
	params: {
		heatId: string
		assignments: Array<{
			membershipId: string
			laneNumber: number | null
			position?: schema.VolunteerRoleType | null
			instructions?: string | null
		}>
	},
): Promise<CompetitionHeatVolunteer[]> {
	if (params.assignments.length === 0) {
		return []
	}

	// Each insert row uses ~7 params (id, heatId, membershipId, laneNumber, position, instructions, commonColumns)
	// D1 has a 100 param limit, so max 14 rows per batch (14 * 7 = 98)
	// Use 10 to be safe
	const INSERT_BATCH_SIZE = 10

	const results = await Promise.all(
		chunk(params.assignments, INSERT_BATCH_SIZE).map((batch) =>
			db
				.insert(competitionHeatVolunteersTable)
				.values(
					batch.map((a) => ({
						heatId: params.heatId,
						membershipId: a.membershipId,
						laneNumber: a.laneNumber,
						position: a.position ?? null,
						instructions: a.instructions ?? null,
					})),
				)
				.returning(),
		),
	)

	return results.flat()
}

// ============================================================================
// 5. Remove Judge from Heat
// ============================================================================

/**
 * Remove a judge assignment from a heat.
 */
export async function removeJudgeFromHeat(
	db: Db,
	assignmentId: string,
): Promise<void> {
	await db
		.delete(competitionHeatVolunteersTable)
		.where(eq(competitionHeatVolunteersTable.id, assignmentId))
}

// ============================================================================
// 6. Move Judge Assignment
// ============================================================================

/**
 * Move a judge assignment to a different heat and/or lane.
 */
export async function moveJudgeAssignment(
	db: Db,
	params: {
		assignmentId: string
		targetHeatId: string
		targetLaneNumber: number
	},
): Promise<void> {
	await db
		.update(competitionHeatVolunteersTable)
		.set({
			heatId: params.targetHeatId,
			laneNumber: params.targetLaneNumber,
			updatedAt: new Date(),
		})
		.where(eq(competitionHeatVolunteersTable.id, params.assignmentId))
}

// ============================================================================
// 7. Get Judge Conflicts
// ============================================================================

/**
 * Check if a judge has time conflicts with other heat assignments.
 * Returns conflict info if the judge is already assigned to a heat that overlaps in time.
 */
export async function getJudgeConflicts(
	db: Db,
	membershipId: string,
	heatId: string,
): Promise<JudgeConflictInfo | null> {
	// Get the target heat's time
	const targetHeat = await db
		.select({
			scheduledTime: competitionHeatsTable.scheduledTime,
			durationMinutes: competitionHeatsTable.durationMinutes,
		})
		.from(competitionHeatsTable)
		.where(eq(competitionHeatsTable.id, heatId))
		.get()

	if (!targetHeat?.scheduledTime) {
		// No scheduled time, can't check conflicts
		return null
	}

	// Get all heat assignments for this judge
	const judgeAssignments = await db
		.select({
			heatId: competitionHeatVolunteersTable.heatId,
		})
		.from(competitionHeatVolunteersTable)
		.where(eq(competitionHeatVolunteersTable.membershipId, membershipId))

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
		if (!heat.scheduledTime || heat.id === heatId) continue

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
}

// ============================================================================
// 8. Copy Judge Assignments to Heat
// ============================================================================

/**
 * Copy all judge assignments from one heat to another heat.
 * Useful for copying from previous heat when judges work multiple heats.
 */
export async function copyJudgeAssignmentsToHeat(
	db: Db,
	params: {
		sourceHeatId: string
		targetHeatId: string
	},
): Promise<CompetitionHeatVolunteer[]> {
	// Get source assignments
	const sourceAssignments = await db
		.select()
		.from(competitionHeatVolunteersTable)
		.where(eq(competitionHeatVolunteersTable.heatId, params.sourceHeatId))

	if (sourceAssignments.length === 0) {
		return []
	}

	// Insert into target heat
	return bulkAssignJudgesToHeat(db, {
		heatId: params.targetHeatId,
		assignments: sourceAssignments.map((a) => ({
			membershipId: a.membershipId,
			laneNumber: a.laneNumber,
			position: a.position,
			instructions: a.instructions,
		})),
	})
}

// ============================================================================
// 9. Copy Judge Assignments to Remaining Heats
// ============================================================================

/**
 * Copy judge assignments from a source heat to all subsequent heats in the same event.
 * Primary workflow for multi-heat judging where same judges work multiple consecutive heats.
 */
export async function copyJudgeAssignmentsToRemainingHeats(
	db: Db,
	params: {
		sourceHeatId: string
		trackWorkoutId: string
	},
): Promise<Array<{ heatId: string; assignments: CompetitionHeatVolunteer[] }>> {
	// Get source heat details
	const sourceHeat = await db
		.select({ heatNumber: competitionHeatsTable.heatNumber })
		.from(competitionHeatsTable)
		.where(eq(competitionHeatsTable.id, params.sourceHeatId))
		.get()

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
		.where(eq(competitionHeatsTable.trackWorkoutId, params.trackWorkoutId))

	const targetHeats = allHeats
		.filter((h) => h.heatNumber > sourceHeat.heatNumber)
		.sort((a, b) => a.heatNumber - b.heatNumber)

	if (targetHeats.length === 0) {
		return []
	}

	// Get source assignments
	const sourceAssignments = await db
		.select()
		.from(competitionHeatVolunteersTable)
		.where(eq(competitionHeatVolunteersTable.heatId, params.sourceHeatId))

	if (sourceAssignments.length === 0) {
		return []
	}

	// Copy to each remaining heat
	const results = await Promise.all(
		targetHeats.map(async (heat) => {
			const assignments = await bulkAssignJudgesToHeat(db, {
				heatId: heat.id,
				assignments: sourceAssignments.map((a) => ({
					membershipId: a.membershipId,
					laneNumber: a.laneNumber,
					position: a.position,
					instructions: a.instructions,
				})),
			})

			return {
				heatId: heat.id,
				assignments,
			}
		}),
	)

	return results
}

// ============================================================================
// 10. Clear Heat Judge Assignments
// ============================================================================

/**
 * Remove all judge assignments from a heat.
 * Useful for clearing a heat before reassigning or when changing heat structure.
 */
export async function clearHeatJudgeAssignments(
	db: Db,
	heatId: string,
): Promise<void> {
	await db
		.delete(competitionHeatVolunteersTable)
		.where(eq(competitionHeatVolunteersTable.heatId, heatId))
}
