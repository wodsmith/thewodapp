import "server-only"

import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionHeatAssignmentsTable,
	competitionHeatsTable,
	competitionRegistrationsTable,
	competitionVenuesTable,
	scalingLevelsTable,
	trackWorkoutsTable,
	userTable,
	type CompetitionHeat,
	type CompetitionHeatAssignment,
	type CompetitionVenue,
} from "@/db/schema"
import { chunk, SQL_BATCH_SIZE } from "@/utils/batch-query"

const BATCH_SIZE = SQL_BATCH_SIZE

// ============================================================================
// Metadata Parsing
// ============================================================================

const registrationMetadataSchema = z
	.object({
		affiliates: z.record(z.string()).optional(),
	})
	.passthrough()

/**
 * Extract affiliate from registration metadata with runtime validation
 */
function getAffiliate(metadata: string | null, userId: string): string | null {
	if (!metadata) return null
	try {
		const result = registrationMetadataSchema.safeParse(JSON.parse(metadata))
		if (!result.success) return null
		return result.data.affiliates?.[userId] ?? null
	} catch {
		return null
	}
}

// ============================================================================
// Types
// ============================================================================

export interface VenueWithHeats extends CompetitionVenue {
	heats: CompetitionHeat[]
}

export interface HeatWithAssignments extends CompetitionHeat {
	venue: CompetitionVenue | null
	division: { id: string; label: string } | null
	assignments: Array<{
		id: string
		laneNumber: number
		registration: {
			id: string
			teamName: string | null
			user: { id: string; firstName: string | null; lastName: string | null }
			division: { id: string; label: string } | null
			affiliate: string | null
		}
	}>
}

export interface UnassignedRegistration {
	id: string
	teamName: string | null
	user: { id: string; firstName: string | null; lastName: string | null }
	division: { id: string; label: string } | null
}

// ============================================================================
// Venue Functions
// ============================================================================

/**
 * Get all venues for a competition
 */
export async function getCompetitionVenues(
	competitionId: string,
): Promise<CompetitionVenue[]> {
	const db = getDb()

	return db
		.select()
		.from(competitionVenuesTable)
		.where(eq(competitionVenuesTable.competitionId, competitionId))
		.orderBy(asc(competitionVenuesTable.sortOrder))
}

/**
 * Create a new venue
 */
export async function createVenue(params: {
	competitionId: string
	name: string
	laneCount: number
	transitionMinutes?: number
	sortOrder?: number
}): Promise<CompetitionVenue> {
	const db = getDb()

	// Get next sort order if not provided
	let sortOrder = params.sortOrder
	if (sortOrder === undefined) {
		const existing = await getCompetitionVenues(params.competitionId)
		sortOrder = existing.length
	}

	const [venue] = await db
		.insert(competitionVenuesTable)
		.values({
			competitionId: params.competitionId,
			name: params.name,
			laneCount: params.laneCount,
			transitionMinutes: params.transitionMinutes ?? 3,
			sortOrder,
		})
		.returning()

	if (!venue) {
		throw new Error("Failed to create venue")
	}

	return venue
}

/**
 * Update a venue
 */
export async function updateVenue(params: {
	id: string
	name?: string
	laneCount?: number
	transitionMinutes?: number
	sortOrder?: number
}): Promise<void> {
	const db = getDb()

	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	}

	if (params.name !== undefined) updateData.name = params.name
	if (params.laneCount !== undefined) updateData.laneCount = params.laneCount
	if (params.transitionMinutes !== undefined)
		updateData.transitionMinutes = params.transitionMinutes
	if (params.sortOrder !== undefined) updateData.sortOrder = params.sortOrder

	await db
		.update(competitionVenuesTable)
		.set(updateData)
		.where(eq(competitionVenuesTable.id, params.id))
}

/**
 * Delete a venue
 */
export async function deleteVenue(id: string): Promise<void> {
	const db = getDb()

	await db
		.delete(competitionVenuesTable)
		.where(eq(competitionVenuesTable.id, id))
}

// ============================================================================
// Heat Functions
// ============================================================================

/**
 * Get all heats for a workout with assignments
 */
export async function getHeatsForWorkout(
	trackWorkoutId: string,
): Promise<HeatWithAssignments[]> {
	const db = getDb()

	// Get heats
	const heats = await db
		.select()
		.from(competitionHeatsTable)
		.where(eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId))
		.orderBy(asc(competitionHeatsTable.heatNumber))

	if (heats.length === 0) {
		return []
	}

	// Get venue IDs and division IDs
	const venueIds = heats
		.map((h) => h.venueId)
		.filter((id): id is string => id !== null)
	const divisionIds = heats
		.map((h) => h.divisionId)
		.filter((id): id is string => id !== null)

	// Fetch venues
	const venues =
		venueIds.length > 0
			? await db
					.select()
					.from(competitionVenuesTable)
					.where(inArray(competitionVenuesTable.id, venueIds))
			: []
	const venueMap = new Map(venues.map((v) => [v.id, v]))

	// Fetch divisions
	const divisions =
		divisionIds.length > 0
			? await db
					.select({
						id: scalingLevelsTable.id,
						label: scalingLevelsTable.label,
					})
					.from(scalingLevelsTable)
					.where(inArray(scalingLevelsTable.id, divisionIds))
			: []
	const divisionMap = new Map(divisions.map((d) => [d.id, d]))

	// Fetch assignments in batches to avoid SQLite variable limit
	const heatIds = heats.map((h) => h.id)
	const assignmentBatches = await Promise.all(
		chunk(heatIds, BATCH_SIZE).map((batch) =>
			db
				.select({
					id: competitionHeatAssignmentsTable.id,
					heatId: competitionHeatAssignmentsTable.heatId,
					laneNumber: competitionHeatAssignmentsTable.laneNumber,
					registrationId: competitionHeatAssignmentsTable.registrationId,
				})
				.from(competitionHeatAssignmentsTable)
				.where(inArray(competitionHeatAssignmentsTable.heatId, batch))
				.orderBy(asc(competitionHeatAssignmentsTable.laneNumber)),
		),
	)
	const assignments = assignmentBatches.flat()

	// Fetch registrations in batches
	const registrationIds = [...new Set(assignments.map((a) => a.registrationId))]
	const registrationBatches =
		registrationIds.length > 0
			? await Promise.all(
					chunk(registrationIds, BATCH_SIZE).map((batch) =>
						db
							.select({
								id: competitionRegistrationsTable.id,
								teamName: competitionRegistrationsTable.teamName,
								userId: competitionRegistrationsTable.userId,
								divisionId: competitionRegistrationsTable.divisionId,
								metadata: competitionRegistrationsTable.metadata,
							})
							.from(competitionRegistrationsTable)
							.where(inArray(competitionRegistrationsTable.id, batch)),
					),
				)
			: []
	const registrations = registrationBatches.flat()

	// Fetch users in batches
	const userIds = [...new Set(registrations.map((r) => r.userId))]
	const userBatches =
		userIds.length > 0
			? await Promise.all(
					chunk(userIds, BATCH_SIZE).map((batch) =>
						db
							.select({
								id: userTable.id,
								firstName: userTable.firstName,
								lastName: userTable.lastName,
							})
							.from(userTable)
							.where(inArray(userTable.id, batch)),
					),
				)
			: []
	const users = userBatches.flat()
	const userMap = new Map(users.map((u) => [u.id, u]))

	// Fetch divisions in batches
	const regDivisionIds = [
		...new Set(
			registrations
				.map((r) => r.divisionId)
				.filter((id): id is string => id !== null),
		),
	]
	const regDivBatches =
		regDivisionIds.length > 0
			? await Promise.all(
					chunk(regDivisionIds, BATCH_SIZE).map((batch) =>
						db
							.select({
								id: scalingLevelsTable.id,
								label: scalingLevelsTable.label,
							})
							.from(scalingLevelsTable)
							.where(inArray(scalingLevelsTable.id, batch)),
					),
				)
			: []
	const regDivisions = regDivBatches.flat()
	const regDivisionMap = new Map(regDivisions.map((d) => [d.id, d]))

	// Build registration map
	const registrationMap = new Map(
		registrations.map((r) => [
			r.id,
			{
				id: r.id,
				teamName: r.teamName,
				user: userMap.get(r.userId) ?? {
					id: r.userId,
					firstName: null,
					lastName: null,
				},
				division: r.divisionId
					? (regDivisionMap.get(r.divisionId) ?? null)
					: null,
				affiliate: getAffiliate(r.metadata, r.userId),
			},
		]),
	)

	// Group assignments by heat
	const assignmentsByHeat = new Map<string, typeof assignments>()
	for (const assignment of assignments) {
		const existing = assignmentsByHeat.get(assignment.heatId) ?? []
		existing.push(assignment)
		assignmentsByHeat.set(assignment.heatId, existing)
	}

	// Build result
	return heats.map((heat) => ({
		...heat,
		venue: heat.venueId ? (venueMap.get(heat.venueId) ?? null) : null,
		division: heat.divisionId
			? (divisionMap.get(heat.divisionId) ?? null)
			: null,
		assignments: (assignmentsByHeat.get(heat.id) ?? []).map((a) => ({
			id: a.id,
			laneNumber: a.laneNumber,
			registration: registrationMap.get(a.registrationId) ?? {
				id: a.registrationId,
				teamName: null,
				user: { id: "", firstName: null, lastName: null },
				division: null,
				affiliate: null,
			},
		})),
	}))
}

/**
 * Get all heats for a competition (full schedule)
 */
export async function getHeatsForCompetition(
	competitionId: string,
): Promise<HeatWithAssignments[]> {
	const db = getDb()

	const heats = await db
		.select()
		.from(competitionHeatsTable)
		.where(eq(competitionHeatsTable.competitionId, competitionId))
		.orderBy(
			asc(competitionHeatsTable.scheduledTime),
			asc(competitionHeatsTable.heatNumber),
		)

	if (heats.length === 0) {
		return []
	}

	// Reuse the same logic as getHeatsForWorkout but for all heats
	const venueIds = heats
		.map((h) => h.venueId)
		.filter((id): id is string => id !== null)
	const divisionIds = heats
		.map((h) => h.divisionId)
		.filter((id): id is string => id !== null)

	const venues =
		venueIds.length > 0
			? await db
					.select()
					.from(competitionVenuesTable)
					.where(inArray(competitionVenuesTable.id, venueIds))
			: []
	const venueMap = new Map(venues.map((v) => [v.id, v]))

	const divisions =
		divisionIds.length > 0
			? await db
					.select({
						id: scalingLevelsTable.id,
						label: scalingLevelsTable.label,
					})
					.from(scalingLevelsTable)
					.where(inArray(scalingLevelsTable.id, divisionIds))
			: []
	const divisionMap = new Map(divisions.map((d) => [d.id, d]))

	// Fetch assignments in batches to avoid SQLite variable limit
	const heatIds = heats.map((h) => h.id)
	const assignmentBatches = await Promise.all(
		chunk(heatIds, BATCH_SIZE).map((batch) =>
			db
				.select({
					id: competitionHeatAssignmentsTable.id,
					heatId: competitionHeatAssignmentsTable.heatId,
					laneNumber: competitionHeatAssignmentsTable.laneNumber,
					registrationId: competitionHeatAssignmentsTable.registrationId,
				})
				.from(competitionHeatAssignmentsTable)
				.where(inArray(competitionHeatAssignmentsTable.heatId, batch))
				.orderBy(asc(competitionHeatAssignmentsTable.laneNumber)),
		),
	)
	const assignments = assignmentBatches.flat()

	// Fetch registrations in batches
	const registrationIds = [...new Set(assignments.map((a) => a.registrationId))]
	const registrationBatches =
		registrationIds.length > 0
			? await Promise.all(
					chunk(registrationIds, BATCH_SIZE).map((batch) =>
						db
							.select({
								id: competitionRegistrationsTable.id,
								teamName: competitionRegistrationsTable.teamName,
								userId: competitionRegistrationsTable.userId,
								divisionId: competitionRegistrationsTable.divisionId,
								metadata: competitionRegistrationsTable.metadata,
							})
							.from(competitionRegistrationsTable)
							.where(inArray(competitionRegistrationsTable.id, batch)),
					),
				)
			: []
	const registrations = registrationBatches.flat()

	// Fetch users in batches
	const userIds = [...new Set(registrations.map((r) => r.userId))]
	const userBatches =
		userIds.length > 0
			? await Promise.all(
					chunk(userIds, BATCH_SIZE).map((batch) =>
						db
							.select({
								id: userTable.id,
								firstName: userTable.firstName,
								lastName: userTable.lastName,
							})
							.from(userTable)
							.where(inArray(userTable.id, batch)),
					),
				)
			: []
	const users = userBatches.flat()
	const userMap = new Map(users.map((u) => [u.id, u]))

	// Fetch divisions in batches
	const regDivisionIds = [
		...new Set(
			registrations
				.map((r) => r.divisionId)
				.filter((id): id is string => id !== null),
		),
	]
	const regDivBatches =
		regDivisionIds.length > 0
			? await Promise.all(
					chunk(regDivisionIds, BATCH_SIZE).map((batch) =>
						db
							.select({
								id: scalingLevelsTable.id,
								label: scalingLevelsTable.label,
							})
							.from(scalingLevelsTable)
							.where(inArray(scalingLevelsTable.id, batch)),
					),
				)
			: []
	const regDivisions = regDivBatches.flat()
	const regDivisionMap = new Map(regDivisions.map((d) => [d.id, d]))

	const registrationMap = new Map(
		registrations.map((r) => [
			r.id,
			{
				id: r.id,
				teamName: r.teamName,
				user: userMap.get(r.userId) ?? {
					id: r.userId,
					firstName: null,
					lastName: null,
				},
				division: r.divisionId
					? (regDivisionMap.get(r.divisionId) ?? null)
					: null,
				affiliate: getAffiliate(r.metadata, r.userId),
			},
		]),
	)

	const assignmentsByHeat = new Map<string, typeof assignments>()
	for (const assignment of assignments) {
		const existing = assignmentsByHeat.get(assignment.heatId) ?? []
		existing.push(assignment)
		assignmentsByHeat.set(assignment.heatId, existing)
	}

	return heats.map((heat) => ({
		...heat,
		venue: heat.venueId ? (venueMap.get(heat.venueId) ?? null) : null,
		division: heat.divisionId
			? (divisionMap.get(heat.divisionId) ?? null)
			: null,
		assignments: (assignmentsByHeat.get(heat.id) ?? []).map((a) => ({
			id: a.id,
			laneNumber: a.laneNumber,
			registration: registrationMap.get(a.registrationId) ?? {
				id: a.registrationId,
				teamName: null,
				user: { id: "", firstName: null, lastName: null },
				division: null,
				affiliate: null,
			},
		})),
	}))
}

/**
 * Create a new heat
 */
export async function createHeat(params: {
	competitionId: string
	trackWorkoutId: string
	heatNumber: number
	venueId?: string | null
	scheduledTime?: Date | null
	durationMinutes?: number | null
	divisionId?: string | null
	notes?: string | null
}): Promise<CompetitionHeat> {
	const db = getDb()

	const [heat] = await db
		.insert(competitionHeatsTable)
		.values({
			competitionId: params.competitionId,
			trackWorkoutId: params.trackWorkoutId,
			heatNumber: params.heatNumber,
			venueId: params.venueId ?? null,
			scheduledTime: params.scheduledTime ?? null,
			durationMinutes: params.durationMinutes ?? null,
			divisionId: params.divisionId ?? null,
			notes: params.notes ?? null,
		})
		.returning()

	if (!heat) {
		throw new Error("Failed to create heat")
	}

	return heat
}

/**
 * Update a heat
 */
export async function updateHeat(params: {
	id: string
	heatNumber?: number
	venueId?: string | null
	scheduledTime?: Date | null
	divisionId?: string | null
	notes?: string | null
}): Promise<void> {
	const db = getDb()

	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	}

	if (params.heatNumber !== undefined) updateData.heatNumber = params.heatNumber
	if (params.venueId !== undefined) updateData.venueId = params.venueId
	if (params.scheduledTime !== undefined)
		updateData.scheduledTime = params.scheduledTime
	if (params.divisionId !== undefined) updateData.divisionId = params.divisionId
	if (params.notes !== undefined) updateData.notes = params.notes

	await db
		.update(competitionHeatsTable)
		.set(updateData)
		.where(eq(competitionHeatsTable.id, params.id))
}

/**
 * Delete a heat
 */
export async function deleteHeat(id: string): Promise<void> {
	const db = getDb()

	await db.delete(competitionHeatsTable).where(eq(competitionHeatsTable.id, id))
}

/**
 * Bulk create heats for a workout
 * Batches inserts to avoid D1 SQL variable limit
 */
export async function bulkCreateHeats(params: {
	competitionId: string
	trackWorkoutId: string
	count: number
	venueId?: string | null
	divisionId?: string | null
	startTime?: Date | null
	durationMinutes?: number | null
}): Promise<CompetitionHeat[]> {
	const db = getDb()

	// Get current max heat number
	const startNumber = await getNextHeatNumber(params.trackWorkoutId)

	const heatsToCreate = []
	let currentTime = params.startTime ? new Date(params.startTime) : null

	for (let i = 0; i < params.count; i++) {
		heatsToCreate.push({
			competitionId: params.competitionId,
			trackWorkoutId: params.trackWorkoutId,
			heatNumber: startNumber + i,
			venueId: params.venueId ?? null,
			scheduledTime: currentTime ? new Date(currentTime) : null,
			durationMinutes: params.durationMinutes ?? null,
			divisionId: params.divisionId ?? null,
			notes: null,
		})

		// Increment time for next heat
		if (currentTime && params.durationMinutes) {
			currentTime = new Date(currentTime)
			currentTime.setMinutes(currentTime.getMinutes() + params.durationMinutes)
		}
	}

	// Each heat row uses ~8 params - batch to stay under D1's 100 param limit
	const INSERT_BATCH_SIZE = 10

	const results = await Promise.all(
		chunk(heatsToCreate, INSERT_BATCH_SIZE).map((batch) =>
			db.insert(competitionHeatsTable).values(batch).returning(),
		),
	)

	return results.flat()
}

/**
 * Get the next heat number for a workout
 */
export async function getNextHeatNumber(
	trackWorkoutId: string,
): Promise<number> {
	const db = getDb()

	const heats = await db
		.select({ heatNumber: competitionHeatsTable.heatNumber })
		.from(competitionHeatsTable)
		.where(eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId))

	if (heats.length === 0) {
		return 1
	}

	const maxNumber = Math.max(...heats.map((h) => h.heatNumber))
	return maxNumber + 1
}

// ============================================================================
// Assignment Functions
// ============================================================================

/**
 * Assign a registration to a heat lane
 */
export async function assignToHeat(params: {
	heatId: string
	registrationId: string
	laneNumber: number
}): Promise<CompetitionHeatAssignment> {
	const db = getDb()

	const [assignment] = await db
		.insert(competitionHeatAssignmentsTable)
		.values({
			heatId: params.heatId,
			registrationId: params.registrationId,
			laneNumber: params.laneNumber,
		})
		.returning()

	if (!assignment) {
		throw new Error("Failed to assign to heat")
	}

	return assignment
}

/**
 * Remove an assignment from a heat
 */
export async function removeFromHeat(assignmentId: string): Promise<void> {
	const db = getDb()

	await db
		.delete(competitionHeatAssignmentsTable)
		.where(eq(competitionHeatAssignmentsTable.id, assignmentId))
}

/**
 * Get an assignment by ID
 */
export async function getAssignment(
	assignmentId: string,
): Promise<CompetitionHeatAssignment | null> {
	const db = getDb()

	const assignment = await db
		.select()
		.from(competitionHeatAssignmentsTable)
		.where(eq(competitionHeatAssignmentsTable.id, assignmentId))
		.get()

	return assignment ?? null
}

/**
 * Update a lane assignment
 */
export async function updateAssignment(params: {
	id: string
	laneNumber: number
}): Promise<void> {
	const db = getDb()

	await db
		.update(competitionHeatAssignmentsTable)
		.set({ laneNumber: params.laneNumber, updatedAt: new Date() })
		.where(eq(competitionHeatAssignmentsTable.id, params.id))
}

/**
 * Bulk assign registrations to a heat
 * Batches inserts to avoid D1 SQL variable limit
 */
export async function bulkAssignToHeat(
	heatId: string,
	assignments: Array<{ registrationId: string; laneNumber: number }>,
): Promise<CompetitionHeatAssignment[]> {
	const db = getDb()

	if (assignments.length === 0) {
		return []
	}

	// Each insert row uses ~3 params (heatId, registrationId, laneNumber)
	// Use smaller batch size to stay well under D1's 100 param limit
	const INSERT_BATCH_SIZE = 25

	const results = await Promise.all(
		chunk(assignments, INSERT_BATCH_SIZE).map((batch) =>
			db
				.insert(competitionHeatAssignmentsTable)
				.values(
					batch.map((a) => ({
						heatId,
						registrationId: a.registrationId,
						laneNumber: a.laneNumber,
					})),
				)
				.returning(),
		),
	)

	return results.flat()
}

/**
 * Get unassigned registrations for a specific workout
 */
export async function getUnassignedRegistrations(
	competitionId: string,
	trackWorkoutId: string,
): Promise<UnassignedRegistration[]> {
	const db = getDb()

	// Get all heat IDs for this workout
	const heats = await db
		.select({ id: competitionHeatsTable.id })
		.from(competitionHeatsTable)
		.where(eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId))

	const heatIds = heats.map((h) => h.id)

	// Get all assigned registration IDs for these heats (batched)
	const assignedBatches =
		heatIds.length > 0
			? await Promise.all(
					chunk(heatIds, BATCH_SIZE).map((batch) =>
						db
							.select({
								registrationId: competitionHeatAssignmentsTable.registrationId,
							})
							.from(competitionHeatAssignmentsTable)
							.where(inArray(competitionHeatAssignmentsTable.heatId, batch)),
					),
				)
			: []
	const assignedIds = [
		...new Set(assignedBatches.flat().map((a) => a.registrationId)),
	]

	// Get all registrations for this competition that are not assigned
	// For notInArray, we filter in JS to avoid SQLite variable limits
	const allRegistrations = await db
		.select({
			id: competitionRegistrationsTable.id,
			teamName: competitionRegistrationsTable.teamName,
			userId: competitionRegistrationsTable.userId,
			divisionId: competitionRegistrationsTable.divisionId,
		})
		.from(competitionRegistrationsTable)
		.where(eq(competitionRegistrationsTable.eventId, competitionId))

	const assignedSet = new Set(assignedIds)
	const registrations = allRegistrations.filter((r) => !assignedSet.has(r.id))

	// Fetch users in batches
	const userIds = [...new Set(registrations.map((r) => r.userId))]
	const userBatches =
		userIds.length > 0
			? await Promise.all(
					chunk(userIds, BATCH_SIZE).map((batch) =>
						db
							.select({
								id: userTable.id,
								firstName: userTable.firstName,
								lastName: userTable.lastName,
							})
							.from(userTable)
							.where(inArray(userTable.id, batch)),
					),
				)
			: []
	const users = userBatches.flat()
	const userMap = new Map(users.map((u) => [u.id, u]))

	// Fetch divisions in batches
	const divisionIds = [
		...new Set(
			registrations
				.map((r) => r.divisionId)
				.filter((id): id is string => id !== null),
		),
	]
	const divBatches =
		divisionIds.length > 0
			? await Promise.all(
					chunk(divisionIds, BATCH_SIZE).map((batch) =>
						db
							.select({
								id: scalingLevelsTable.id,
								label: scalingLevelsTable.label,
							})
							.from(scalingLevelsTable)
							.where(inArray(scalingLevelsTable.id, batch)),
					),
				)
			: []
	const divisions = divBatches.flat()
	const divisionMap = new Map(divisions.map((d) => [d.id, d]))

	return registrations.map((r) => ({
		id: r.id,
		teamName: r.teamName,
		user: userMap.get(r.userId) ?? {
			id: r.userId,
			firstName: null,
			lastName: null,
		},
		division: r.divisionId ? (divisionMap.get(r.divisionId) ?? null) : null,
	}))
}

/**
 * Get heats for a specific user's registrations (for athlete view)
 */
export async function getHeatsForUser(
	competitionId: string,
	userId: string,
): Promise<
	Array<{
		heat: HeatWithAssignments
		trackWorkout: { id: string; trackOrder: number }
		laneNumber: number
	}>
> {
	const db = getDb()

	// Get user's registration
	const registration = await db
		.select({ id: competitionRegistrationsTable.id })
		.from(competitionRegistrationsTable)
		.where(
			and(
				eq(competitionRegistrationsTable.eventId, competitionId),
				eq(competitionRegistrationsTable.userId, userId),
			),
		)
		.limit(1)

	const userRegistration = registration[0]
	if (!userRegistration) {
		return []
	}

	const registrationId = userRegistration.id

	// Get assignments for this registration
	const assignments = await db
		.select({
			heatId: competitionHeatAssignmentsTable.heatId,
			laneNumber: competitionHeatAssignmentsTable.laneNumber,
		})
		.from(competitionHeatAssignmentsTable)
		.where(eq(competitionHeatAssignmentsTable.registrationId, registrationId))

	if (assignments.length === 0) {
		return []
	}

	const heatIds = assignments.map((a) => a.heatId)
	const allHeats = await getHeatsForCompetition(competitionId)
	const userHeats = allHeats.filter((h) => heatIds.includes(h.id))

	// Get track workout info
	const trackWorkoutIds = [...new Set(userHeats.map((h) => h.trackWorkoutId))]
	const trackWorkouts = await db
		.select({
			id: trackWorkoutsTable.id,
			trackOrder: trackWorkoutsTable.trackOrder,
		})
		.from(trackWorkoutsTable)
		.where(inArray(trackWorkoutsTable.id, trackWorkoutIds))
	const trackWorkoutMap = new Map(trackWorkouts.map((tw) => [tw.id, tw]))

	return userHeats.map((heat) => ({
		heat,
		trackWorkout: trackWorkoutMap.get(heat.trackWorkoutId) ?? {
			id: heat.trackWorkoutId,
			trackOrder: 0,
		},
		laneNumber: assignments.find((a) => a.heatId === heat.id)?.laneNumber ?? 0,
	}))
}
