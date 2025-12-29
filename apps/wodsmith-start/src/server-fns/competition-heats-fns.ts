/**
 * Competition Heats Server Functions for TanStack Start
 * Port from apps/wodsmith/src/server/competition-heats.ts
 */

import { createServerFn } from "@tanstack/react-start"
import { asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	type CompetitionHeat,
	type CompetitionVenue,
	competitionHeatAssignmentsTable,
	competitionHeatsTable,
	competitionRegistrationsTable,
	competitionVenuesTable,
} from "@/db/schemas/competitions"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { userTable } from "@/db/schemas/users"
import { workouts } from "@/db/schemas/workouts"
import { chunk, SQL_BATCH_SIZE } from "@/utils/batch-query"

const BATCH_SIZE = SQL_BATCH_SIZE

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Metadata Parsing
// ============================================================================

const registrationMetadataSchema = z
	.object({
		affiliates: z.record(z.string(), z.string()).optional(),
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
// Venue Input Schemas
// ============================================================================

const createVenueInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	name: z.string().min(1, "Name is required").max(100),
	laneCount: z.number().int().min(1).max(100).default(3),
	transitionMinutes: z.number().int().min(0).max(120).default(3),
	sortOrder: z.number().int().min(0).optional(),
})

const updateVenueInputSchema = z.object({
	venueId: z.string().min(1, "Venue ID is required"),
	name: z.string().min(1).max(100).optional(),
	laneCount: z.number().int().min(1).max(100).optional(),
	transitionMinutes: z.number().int().min(0).max(120).optional(),
	sortOrder: z.number().int().min(0).optional(),
})

const deleteVenueInputSchema = z.object({
	venueId: z.string().min(1, "Venue ID is required"),
})

// ============================================================================
// Input Schemas
// ============================================================================

const getHeatsForCompetitionInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const getCompetitionVenuesInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const getCompetitionRegistrationsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
})

const createHeatInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	heatNumber: z.number().int().min(1),
	scheduledTime: z.coerce.date().nullable().optional(),
	venueId: z.string().nullable().optional(),
	divisionId: z.string().nullable().optional(),
	durationMinutes: z.number().int().min(1).max(180).nullable().optional(),
	notes: z.string().max(500).nullable().optional(),
})

const updateHeatInputSchema = z.object({
	heatId: z.string().min(1, "Heat ID is required"),
	scheduledTime: z.coerce.date().nullable().optional(),
	venueId: z.string().nullable().optional(),
	divisionId: z.string().nullable().optional(),
	durationMinutes: z.number().int().min(1).max(180).nullable().optional(),
	notes: z.string().max(500).nullable().optional(),
})

const deleteHeatInputSchema = z.object({
	heatId: z.string().min(1, "Heat ID is required"),
})

const reorderHeatsInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	heatIds: z
		.array(z.string().min(1))
		.min(1, "At least one heat ID is required"),
})

const getNextHeatNumberInputSchema = z.object({
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
})

const bulkCreateHeatsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	heats: z.array(
		z.object({
			scheduledTime: z.coerce.date().nullable().optional(),
			venueId: z.string().nullable().optional(),
			divisionId: z.string().nullable().optional(),
			durationMinutes: z.number().int().min(1).max(180).nullable().optional(),
		}),
	),
})

const copyHeatsFromEventInputSchema = z.object({
	sourceTrackWorkoutId: z
		.string()
		.min(1, "Source track workout ID is required"),
	targetTrackWorkoutId: z
		.string()
		.min(1, "Target track workout ID is required"),
	startTime: z.coerce.date(),
	durationMinutes: z.number().int().min(1).max(180).default(10),
	transitionMinutes: z.number().int().min(0).max(120).default(3),
	copyAssignments: z.boolean().default(true),
})

const getEventsWithHeatsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	excludeTrackWorkoutId: z.string().optional(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all heats for a competition (full schedule)
 * Returns heats with assignments, sorted by scheduled time and heat number
 */
export const getHeatsForCompetitionFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getHeatsForCompetitionInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const heats = await db
			.select()
			.from(competitionHeatsTable)
			.where(eq(competitionHeatsTable.competitionId, data.competitionId))
			.orderBy(
				asc(competitionHeatsTable.scheduledTime),
				asc(competitionHeatsTable.heatNumber),
			)

		if (heats.length === 0) {
			return { heats: [] }
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
		const registrationIds = [
			...new Set(assignments.map((a) => a.registrationId)),
		]
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

		// Fetch divisions for registrations in batches
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
		const heatsWithAssignments: HeatWithAssignments[] = heats.map((heat) => ({
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

		return { heats: heatsWithAssignments }
	})

/**
 * Get all venues for a competition
 * Returns venues sorted by sortOrder
 */
export const getCompetitionVenuesFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionVenuesInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const venues = await db
			.select()
			.from(competitionVenuesTable)
			.where(eq(competitionVenuesTable.competitionId, data.competitionId))
			.orderBy(asc(competitionVenuesTable.sortOrder))

		return { venues }
	})

/**
 * Create a new competition venue
 * Returns the created venue
 */
export const createVenueFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createVenueInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Get next sort order if not provided
		let sortOrder = data.sortOrder
		if (sortOrder === undefined) {
			const existingVenues = await db
				.select()
				.from(competitionVenuesTable)
				.where(eq(competitionVenuesTable.competitionId, data.competitionId))

			sortOrder = existingVenues.length
		}

		const [venue] = await db
			.insert(competitionVenuesTable)
			.values({
				competitionId: data.competitionId,
				name: data.name,
				laneCount: data.laneCount,
				transitionMinutes: data.transitionMinutes,
				sortOrder,
			})
			.returning()

		if (!venue) {
			throw new Error("Failed to create venue")
		}

		return { venue }
	})

/**
 * Update a competition venue
 * Returns success status
 */
export const updateVenueFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateVenueInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
		}

		if (data.name !== undefined) updateData.name = data.name
		if (data.laneCount !== undefined) updateData.laneCount = data.laneCount
		if (data.transitionMinutes !== undefined)
			updateData.transitionMinutes = data.transitionMinutes
		if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder

		await db
			.update(competitionVenuesTable)
			.set(updateData)
			.where(eq(competitionVenuesTable.id, data.venueId))

		return { success: true }
	})

/**
 * Delete a competition venue
 * Note: This will set venueId to null on any heats using this venue (cascade set null)
 * Returns success status
 */
export const deleteVenueFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteVenueInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		await db
			.delete(competitionVenuesTable)
			.where(eq(competitionVenuesTable.id, data.venueId))

		return { success: true }
	})

/**
 * Check if a venue has any heats assigned
 * Used for delete confirmation
 */
export const getVenueHeatCountFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		z.object({ venueId: z.string().min(1) }).parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		const heats = await db
			.select({ id: competitionHeatsTable.id })
			.from(competitionHeatsTable)
			.where(eq(competitionHeatsTable.venueId, data.venueId))

		return { count: heats.length }
	})

/**
 * Get all registrations for a competition
 * Returns registrations with user and division details
 */
export const getCompetitionRegistrationsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getCompetitionRegistrationsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Fetch registrations
		const registrations = await db
			.select({
				id: competitionRegistrationsTable.id,
				teamName: competitionRegistrationsTable.teamName,
				registeredAt: competitionRegistrationsTable.registeredAt,
				userId: competitionRegistrationsTable.userId,
				divisionId: competitionRegistrationsTable.divisionId,
			})
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, data.competitionId))
			.orderBy(asc(competitionRegistrationsTable.registeredAt))

		if (registrations.length === 0) {
			return { registrations: [] }
		}

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

		// Build result
		const result = registrations.map((r) => ({
			id: r.id,
			teamName: r.teamName,
			registeredAt: r.registeredAt,
			user: userMap.get(r.userId) ?? {
				id: r.userId,
				firstName: null,
				lastName: null,
			},
			division: r.divisionId ? (divisionMap.get(r.divisionId) ?? null) : null,
		}))

		return { registrations: result }
	})

// ============================================================================
// Heat CRUD Server Functions
// ============================================================================

/**
 * Create a new heat for a competition workout
 */
export const createHeatFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createHeatInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		const [heat] = await db
			.insert(competitionHeatsTable)
			.values({
				competitionId: data.competitionId,
				trackWorkoutId: data.trackWorkoutId,
				heatNumber: data.heatNumber,
				scheduledTime: data.scheduledTime ?? null,
				venueId: data.venueId ?? null,
				divisionId: data.divisionId ?? null,
				durationMinutes: data.durationMinutes ?? null,
				notes: data.notes ?? null,
			})
			.returning()

		if (!heat) {
			throw new Error("Failed to create heat")
		}

		return { heat }
	})

/**
 * Update an existing heat's properties
 */
export const updateHeatFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateHeatInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		const updateData: Record<string, unknown> = {
			updatedAt: new Date(),
		}

		if (data.scheduledTime !== undefined)
			updateData.scheduledTime = data.scheduledTime
		if (data.venueId !== undefined) updateData.venueId = data.venueId
		if (data.divisionId !== undefined) updateData.divisionId = data.divisionId
		if (data.durationMinutes !== undefined)
			updateData.durationMinutes = data.durationMinutes
		if (data.notes !== undefined) updateData.notes = data.notes

		await db
			.update(competitionHeatsTable)
			.set(updateData)
			.where(eq(competitionHeatsTable.id, data.heatId))

		return { success: true }
	})

/**
 * Delete a heat and its associated assignments
 * Note: Assignments are deleted via cascade in database
 */
export const deleteHeatFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteHeatInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		await db
			.delete(competitionHeatsTable)
			.where(eq(competitionHeatsTable.id, data.heatId))

		return { success: true }
	})

/**
 * Reorder heats within an event by updating their heatNumber
 * Uses two-pass update to avoid unique constraint violations on (trackWorkoutId, heatNumber)
 */
export const reorderHeatsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => reorderHeatsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Validate that all heat IDs belong to this workout
		const heats = await db
			.select()
			.from(competitionHeatsTable)
			.where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

		const heatIdSet = new Set(heats.map((h) => h.id))
		for (const heatId of data.heatIds) {
			if (!heatIdSet.has(heatId)) {
				throw new Error(
					`Heat ${heatId} does not belong to workout ${data.trackWorkoutId}`,
				)
			}
		}

		if (data.heatIds.length !== heats.length) {
			throw new Error(
				`Expected ${heats.length} heat IDs, received ${data.heatIds.length}`,
			)
		}

		// Use a temporary offset to avoid unique constraint conflicts
		const TEMP_OFFSET = 1000

		// First pass: set all to temporary values
		await Promise.all(
			data.heatIds.map((heatId, index) =>
				db
					.update(competitionHeatsTable)
					.set({
						heatNumber: TEMP_OFFSET + index,
						updatedAt: new Date(),
					})
					.where(eq(competitionHeatsTable.id, heatId)),
			),
		)

		// Second pass: set to final values (1-indexed)
		await Promise.all(
			data.heatIds.map((heatId, index) =>
				db
					.update(competitionHeatsTable)
					.set({
						heatNumber: index + 1,
						updatedAt: new Date(),
					})
					.where(eq(competitionHeatsTable.id, heatId)),
			),
		)

		// Return updated heats in the new order
		const updatedHeats = await db
			.select()
			.from(competitionHeatsTable)
			.where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))
			.orderBy(asc(competitionHeatsTable.heatNumber))

		return { heats: updatedHeats }
	})

/**
 * Get the next heat number for a workout
 * Returns max(heatNumber) + 1, or 1 if no heats exist
 */
export const getNextHeatNumberFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getNextHeatNumberInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		const heats = await db
			.select({ heatNumber: competitionHeatsTable.heatNumber })
			.from(competitionHeatsTable)
			.where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

		if (heats.length === 0) {
			return { nextHeatNumber: 1 }
		}

		const maxNumber = Math.max(...heats.map((h) => h.heatNumber))
		return { nextHeatNumber: maxNumber + 1 }
	})

// ============================================================================
// Heat Assignment Input Schemas
// ============================================================================

const assignToHeatInputSchema = z.object({
	heatId: z.string().min(1, "Heat ID is required"),
	registrationId: z.string().min(1, "Registration ID is required"),
	laneNumber: z.number().int().min(1, "Lane number must be at least 1"),
})

const bulkAssignToHeatInputSchema = z.object({
	heatId: z.string().min(1, "Heat ID is required"),
	registrationIds: z
		.array(z.string().min(1))
		.min(1, "At least one registration ID is required"),
	startingLane: z.number().int().min(1, "Starting lane must be at least 1"),
})

const removeFromHeatInputSchema = z.object({
	assignmentId: z.string().min(1, "Assignment ID is required"),
})

const updateAssignmentInputSchema = z.object({
	assignmentId: z.string().min(1, "Assignment ID is required"),
	laneNumber: z.number().int().min(1, "Lane number must be at least 1"),
})

const moveAssignmentInputSchema = z.object({
	assignmentId: z.string().min(1, "Assignment ID is required"),
	targetHeatId: z.string().min(1, "Target heat ID is required"),
	targetLaneNumber: z
		.number()
		.int()
		.min(1, "Target lane number must be at least 1"),
})

const getUnassignedRegistrationsInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	divisionId: z.string().optional(),
})

// ============================================================================
// Heat Assignment Types
// ============================================================================

export interface UnassignedRegistration {
	id: string
	teamName: string | null
	user: { id: string; firstName: string | null; lastName: string | null }
	division: { id: string; label: string } | null
}

// ============================================================================
// Heat Assignment Server Functions
// ============================================================================

/**
 * Assign a registration to a heat lane
 * Creates a heat assignment record linking a registration to a specific lane
 */
export const assignToHeatFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => assignToHeatInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		const [assignment] = await db
			.insert(competitionHeatAssignmentsTable)
			.values({
				heatId: data.heatId,
				registrationId: data.registrationId,
				laneNumber: data.laneNumber,
			})
			.returning()

		if (!assignment) {
			throw new Error("Failed to create heat assignment")
		}

		return { assignment }
	})

/**
 * Bulk assign registrations to a heat
 * Assigns multiple athletes to consecutive lanes starting from startingLane
 */
export const bulkAssignToHeatFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => bulkAssignToHeatInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		if (data.registrationIds.length === 0) {
			return { assignments: [] }
		}

		// Each insert row uses 7 params (id, heatId, registrationId, laneNumber, createdAt, updatedAt, updateCounter)
		// D1 has a 100 param limit, so max 14 rows per batch (14 * 7 = 98)
		// Use 10 to be safe
		const INSERT_BATCH_SIZE = 10

		const assignmentsToCreate = data.registrationIds.map(
			(registrationId, index) => ({
				heatId: data.heatId,
				registrationId,
				laneNumber: data.startingLane + index,
			}),
		)

		const results = await Promise.all(
			chunk(assignmentsToCreate, INSERT_BATCH_SIZE).map((batch) =>
				db.insert(competitionHeatAssignmentsTable).values(batch).returning(),
			),
		)

		return { assignments: results.flat() }
	})

/**
 * Remove an assignment from a heat
 * Deletes the heat assignment record
 */
export const removeFromHeatFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => removeFromHeatInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		await db
			.delete(competitionHeatAssignmentsTable)
			.where(eq(competitionHeatAssignmentsTable.id, data.assignmentId))

		return { success: true }
	})

/**
 * Update the lane number for an assignment
 */
export const updateAssignmentFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateAssignmentInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		await db
			.update(competitionHeatAssignmentsTable)
			.set({ laneNumber: data.laneNumber, updatedAt: new Date() })
			.where(eq(competitionHeatAssignmentsTable.id, data.assignmentId))

		return { success: true }
	})

/**
 * Move an assignment to a different heat and/or lane
 * If the target heat is the same as current, just updates the lane number
 * If different heat, removes from old and adds to new
 */
export const moveAssignmentFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => moveAssignmentInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Get current assignment to find registrationId and current heatId
		const currentAssignment = await db
			.select()
			.from(competitionHeatAssignmentsTable)
			.where(eq(competitionHeatAssignmentsTable.id, data.assignmentId))
			.get()

		if (!currentAssignment) {
			throw new Error("Assignment not found")
		}

		// If same heat, just update lane number
		if (currentAssignment.heatId === data.targetHeatId) {
			await db
				.update(competitionHeatAssignmentsTable)
				.set({ laneNumber: data.targetLaneNumber, updatedAt: new Date() })
				.where(eq(competitionHeatAssignmentsTable.id, data.assignmentId))
		} else {
			// Different heat: remove from old, add to new
			await db
				.delete(competitionHeatAssignmentsTable)
				.where(eq(competitionHeatAssignmentsTable.id, data.assignmentId))

			await db.insert(competitionHeatAssignmentsTable).values({
				heatId: data.targetHeatId,
				registrationId: currentAssignment.registrationId,
				laneNumber: data.targetLaneNumber,
			})
		}

		return { success: true }
	})

/**
 * Get unassigned registrations for a workout
 * Returns registrations not assigned to any heat for this specific workout
 * Optionally filter by division
 */
export const getUnassignedRegistrationsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getUnassignedRegistrationsInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Get all heat IDs for this workout
		const heats = await db
			.select({ id: competitionHeatsTable.id })
			.from(competitionHeatsTable)
			.where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

		const heatIds = heats.map((h) => h.id)

		// Get all assigned registration IDs for these heats (batched)
		const assignedBatches =
			heatIds.length > 0
				? await Promise.all(
						chunk(heatIds, BATCH_SIZE).map((batch) =>
							db
								.select({
									registrationId:
										competitionHeatAssignmentsTable.registrationId,
								})
								.from(competitionHeatAssignmentsTable)
								.where(inArray(competitionHeatAssignmentsTable.heatId, batch)),
						),
					)
				: []
		const assignedIds = [
			...new Set(assignedBatches.flat().map((a) => a.registrationId)),
		]

		// Get all registrations for this competition
		const allRegistrations = await db
			.select({
				id: competitionRegistrationsTable.id,
				teamName: competitionRegistrationsTable.teamName,
				userId: competitionRegistrationsTable.userId,
				divisionId: competitionRegistrationsTable.divisionId,
			})
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, data.competitionId))

		// Filter out assigned registrations (in JS to avoid SQLite variable limits)
		const assignedSet = new Set(assignedIds)
		let registrations = allRegistrations.filter((r) => !assignedSet.has(r.id))

		// Optionally filter by division
		if (data.divisionId) {
			registrations = registrations.filter(
				(r) => r.divisionId === data.divisionId,
			)
		}

		if (registrations.length === 0) {
			return { registrations: [] }
		}

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

		// Build result
		const result: UnassignedRegistration[] = registrations.map((r) => ({
			id: r.id,
			teamName: r.teamName,
			user: userMap.get(r.userId) ?? {
				id: r.userId,
				firstName: null,
				lastName: null,
			},
			division: r.divisionId ? (divisionMap.get(r.divisionId) ?? null) : null,
		}))

		return { registrations: result }
	})

// ============================================================================
// Bulk Heat Operations
// ============================================================================

/**
 * Get the next available heat number for a workout (internal helper)
 */
async function getNextHeatNumberInternal(
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

/**
 * Bulk create heats with auto-incrementing heat numbers
 * Creates multiple heats at once with optional scheduled times
 */
export const bulkCreateHeatsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => bulkCreateHeatsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		if (data.heats.length === 0) {
			return { heats: [] }
		}

		// Get the starting heat number
		const startNumber = await getNextHeatNumberInternal(data.trackWorkoutId)

		// Prepare heats to create
		const heatsToCreate = data.heats.map((heat, index) => ({
			competitionId: data.competitionId,
			trackWorkoutId: data.trackWorkoutId,
			heatNumber: startNumber + index,
			venueId: heat.venueId ?? null,
			scheduledTime: heat.scheduledTime ?? null,
			durationMinutes: heat.durationMinutes ?? null,
			divisionId: heat.divisionId ?? null,
			notes: null,
		}))

		// D1 has a 100 param limit, competitionHeatsTable has ~12 columns
		// Max rows per batch = floor(100/12) = 8
		const INSERT_BATCH_SIZE = 8

		const results = await Promise.all(
			chunk(heatsToCreate, INSERT_BATCH_SIZE).map((batch) =>
				db.insert(competitionHeatsTable).values(batch).returning(),
			),
		)

		return { heats: results.flat() }
	})

/**
 * Get events (track workouts) that have heats scheduled
 * Used to populate "Copy from Previous" dropdown
 */
export const getEventsWithHeatsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getEventsWithHeatsInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Get all heats for the competition
		const heats = await db
			.select({
				trackWorkoutId: competitionHeatsTable.trackWorkoutId,
				scheduledTime: competitionHeatsTable.scheduledTime,
			})
			.from(competitionHeatsTable)
			.where(eq(competitionHeatsTable.competitionId, data.competitionId))
			.orderBy(asc(competitionHeatsTable.scheduledTime))

		if (heats.length === 0) {
			return { events: [] }
		}

		// Group heats by trackWorkoutId
		const heatsByWorkout = new Map<
			string,
			Array<{ scheduledTime: Date | null }>
		>()
		for (const heat of heats) {
			const existing = heatsByWorkout.get(heat.trackWorkoutId) ?? []
			existing.push({ scheduledTime: heat.scheduledTime })
			heatsByWorkout.set(heat.trackWorkoutId, existing)
		}

		// Get unique trackWorkoutIds, excluding the target if specified
		const trackWorkoutIds = [...heatsByWorkout.keys()].filter(
			(id) => id !== data.excludeTrackWorkoutId,
		)

		if (trackWorkoutIds.length === 0) {
			return { events: [] }
		}

		// Fetch track workouts with their associated workouts (batched)
		const trackWorkoutBatches = await Promise.all(
			chunk(trackWorkoutIds, BATCH_SIZE).map((batch) =>
				db
					.select({
						id: trackWorkoutsTable.id,
						workoutId: trackWorkoutsTable.workoutId,
					})
					.from(trackWorkoutsTable)
					.where(inArray(trackWorkoutsTable.id, batch)),
			),
		)
		const trackWorkoutList = trackWorkoutBatches.flat()

		// Fetch workout names
		const workoutIds = trackWorkoutList.map((tw) => tw.workoutId)
		const workoutBatches = await Promise.all(
			chunk(workoutIds, BATCH_SIZE).map((batch) =>
				db
					.select({
						id: workouts.id,
						name: workouts.name,
					})
					.from(workouts)
					.where(inArray(workouts.id, batch)),
			),
		)
		const workoutListData = workoutBatches.flat()
		const workoutMap = new Map(workoutListData.map((w) => [w.id, w]))

		// Build result
		const events = trackWorkoutList.map((tw) => {
			const workoutHeats = heatsByWorkout.get(tw.id) ?? []
			const workout = workoutMap.get(tw.workoutId)

			// Find first and last heat times
			const times = workoutHeats
				.map((h) => h.scheduledTime)
				.filter((t): t is Date => t !== null)
			const firstHeatTime: Date | null =
				times.length > 0 ? (times[0] ?? null) : null
			const lastHeatTime: Date | null =
				times.length > 0 ? (times[times.length - 1] ?? null) : null

			return {
				trackWorkoutId: tw.id,
				workoutName: workout?.name ?? "Unknown Workout",
				heatCount: workoutHeats.length,
				firstHeatTime,
				lastHeatTime,
			}
		})

		return { events }
	})

/**
 * Helper function to get heats for a workout with assignments
 * Used internally by copyHeatsFromEventFn
 */
async function getHeatsForWorkoutInternal(
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

	// Fetch assignments in batches
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

	// Fetch divisions for registrations in batches
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
 * Copy heats from one event to another
 * Copies heat structure and optionally athlete assignments
 * Times are calculated as: startTime + (heatIndex × (duration + transition))
 */
export const copyHeatsFromEventFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => copyHeatsFromEventInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Fetch source heats with assignments (sorted by heat number)
		const sourceHeats = await getHeatsForWorkoutInternal(
			data.sourceTrackWorkoutId,
		)

		if (sourceHeats.length === 0) {
			return { heats: [] }
		}

		// Sort by heat number to ensure correct ordering
		sourceHeats.sort((a, b) => a.heatNumber - b.heatNumber)

		// Get the target workout's competition ID
		const targetWorkout = await db
			.select({
				trackId: trackWorkoutsTable.trackId,
			})
			.from(trackWorkoutsTable)
			.where(eq(trackWorkoutsTable.id, data.targetTrackWorkoutId))
			.get()

		if (!targetWorkout) {
			throw new Error("Target track workout not found")
		}

		// Get competition ID from the track
		const track = await db
			.select({
				competitionId: programmingTracksTable.competitionId,
			})
			.from(programmingTracksTable)
			.where(eq(programmingTracksTable.id, targetWorkout.trackId))
			.get()

		if (!track || !track.competitionId) {
			throw new Error("Competition not found for target track")
		}

		const competitionId = track.competitionId

		// Use the provided duration for time calculation
		// This matches the preview calculation in heat-schedule-manager.tsx
		const durationMinutes = data.durationMinutes

		// Calculate time slot: duration + transition between heats
		const timeSlotMinutes = durationMinutes + data.transitionMinutes

		// Create new heats with calculated times
		const heatsToCreate: Array<{
			competitionId: string
			trackWorkoutId: string
			heatNumber: number
			venueId: string | null
			scheduledTime: Date
			durationMinutes: number | null
			divisionId: string | null
			notes: string | null
		}> = []

		for (let i = 0; i < sourceHeats.length; i++) {
			const sourceHeat = sourceHeats[i]
			if (!sourceHeat) continue

			// Calculate time: startTime + (index × timeSlot)
			const offsetMinutes = i * timeSlotMinutes
			const newTime = new Date(
				data.startTime.getTime() + offsetMinutes * 60 * 1000,
			)

			heatsToCreate.push({
				competitionId,
				trackWorkoutId: data.targetTrackWorkoutId,
				heatNumber: sourceHeat.heatNumber,
				venueId: sourceHeat.venueId,
				scheduledTime: newTime,
				durationMinutes: durationMinutes,
				divisionId: sourceHeat.divisionId,
				notes: sourceHeat.notes,
			})
		}

		// Bulk insert heats in batches (competitionHeatsTable has 12 columns)
		const INSERT_BATCH_SIZE = 8

		const createdHeatBatches = await Promise.all(
			chunk(heatsToCreate, INSERT_BATCH_SIZE).map((batch) =>
				db.insert(competitionHeatsTable).values(batch).returning(),
			),
		)
		const createdHeats = createdHeatBatches.flat()

		// If copying assignments, create heat ID mapping and copy assignments
		if (data.copyAssignments) {
			// Create heat ID mapping (source heat number -> new heat ID)
			const heatIdMap = new Map<number, string>()
			for (const heat of createdHeats) {
				heatIdMap.set(heat.heatNumber, heat.id)
			}

			// Copy assignments
			const assignmentsToCreate: Array<{
				heatId: string
				registrationId: string
				laneNumber: number
			}> = []

			for (const sourceHeat of sourceHeats) {
				const newHeatId = heatIdMap.get(sourceHeat.heatNumber)
				if (!newHeatId) continue

				for (const assignment of sourceHeat.assignments) {
					assignmentsToCreate.push({
						heatId: newHeatId,
						registrationId: assignment.registration.id,
						laneNumber: assignment.laneNumber,
					})
				}
			}

			// Bulk insert assignments in batches (7 columns)
			const ASSIGNMENT_BATCH_SIZE = 10

			if (assignmentsToCreate.length > 0) {
				await Promise.all(
					chunk(assignmentsToCreate, ASSIGNMENT_BATCH_SIZE).map((batch) =>
						db.insert(competitionHeatAssignmentsTable).values(batch),
					),
				)
			}
		}

		// Return the newly created heats with assignments
		const result = await getHeatsForWorkoutInternal(data.targetTrackWorkoutId)
		return { heats: result }
	})
