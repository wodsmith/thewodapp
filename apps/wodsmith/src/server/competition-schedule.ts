import "server-only"

import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionFloorsTable,
	competitionHeatsTable,
	competitionRegistrationsTable,
	heatAssignmentsTable,
	scalingLevelsTable,
	trackWorkoutsTable,
	type CompetitionFloor,
	type CompetitionHeat,
	type HeatAssignment,
} from "@/db/schema"

// ============================================================================
// FLOOR MANAGEMENT
// ============================================================================

/**
 * Get all floors for a competition
 */
export async function getCompetitionFloors(
	competitionId: string,
): Promise<CompetitionFloor[]> {
	const db = getDb()

	return db.query.competitionFloorsTable.findMany({
		where: eq(competitionFloorsTable.competitionId, competitionId),
		orderBy: asc(competitionFloorsTable.position),
	})
}

/**
 * Create a new floor for a competition
 */
export async function createCompetitionFloor(params: {
	competitionId: string
	name: string
	capacity: number
}): Promise<CompetitionFloor> {
	const db = getDb()

	// Get the next position
	const existingFloors = await getCompetitionFloors(params.competitionId)
	const nextPosition = existingFloors.length

	const [floor] = await db
		.insert(competitionFloorsTable)
		.values({
			competitionId: params.competitionId,
			name: params.name,
			capacity: params.capacity,
			position: nextPosition,
		})
		.returning()

	if (!floor) {
		throw new Error("Failed to create floor")
	}

	return floor
}

/**
 * Update a competition floor
 */
export async function updateCompetitionFloor(params: {
	floorId: string
	name?: string
	capacity?: number
	position?: number
}): Promise<void> {
	const db = getDb()

	const updateData: Partial<CompetitionFloor> = {}
	if (params.name !== undefined) updateData.name = params.name
	if (params.capacity !== undefined) updateData.capacity = params.capacity
	if (params.position !== undefined) updateData.position = params.position

	await db
		.update(competitionFloorsTable)
		.set(updateData)
		.where(eq(competitionFloorsTable.id, params.floorId))
}

/**
 * Delete a competition floor
 */
export async function deleteCompetitionFloor(floorId: string): Promise<void> {
	const db = getDb()

	await db
		.delete(competitionFloorsTable)
		.where(eq(competitionFloorsTable.id, floorId))
}

// ============================================================================
// HEAT MANAGEMENT
// ============================================================================

export interface HeatWithDetails extends CompetitionHeat {
	floor: CompetitionFloor
	targetDivision: { id: string; label: string } | null
	assignments: Array<{
		id: string
		laneNumber: number | null
		checkInAt: Date | null
		registration: {
			id: string
			teamName: string | null
			user: { id: string; firstName: string | null; lastName: string | null }
			division: { id: string; label: string } | null
		}
	}>
}

/**
 * Get all heats for a competition
 */
export async function getCompetitionHeats(
	competitionId: string,
): Promise<HeatWithDetails[]> {
	const db = getDb()

	const heats = await db.query.competitionHeatsTable.findMany({
		where: eq(competitionHeatsTable.competitionId, competitionId),
		orderBy: [
			asc(competitionHeatsTable.startTime),
			asc(competitionHeatsTable.heatNumber),
		],
		with: {
			floor: true,
			targetDivision: true,
			assignments: {
				with: {
					registration: {
						with: {
							user: true,
							division: true,
						},
					},
				},
				orderBy: asc(heatAssignmentsTable.laneNumber),
			},
		},
	})

	return heats as HeatWithDetails[]
}

/**
 * Get heats for a specific workout/event
 */
export async function getHeatsForWorkout(
	trackWorkoutId: string,
): Promise<HeatWithDetails[]> {
	const db = getDb()

	const heats = await db.query.competitionHeatsTable.findMany({
		where: eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId),
		orderBy: [
			asc(competitionHeatsTable.startTime),
			asc(competitionHeatsTable.heatNumber),
		],
		with: {
			floor: true,
			targetDivision: true,
			assignments: {
				with: {
					registration: {
						with: {
							user: true,
							division: true,
						},
					},
				},
				orderBy: asc(heatAssignmentsTable.laneNumber),
			},
		},
	})

	return heats as HeatWithDetails[]
}

/**
 * Create a single heat
 */
export async function createHeat(params: {
	competitionId: string
	trackWorkoutId: string
	floorId: string
	heatNumber: number
	startTime: Date
	targetDivisionId?: string | null
}): Promise<CompetitionHeat> {
	const db = getDb()

	const [heat] = await db
		.insert(competitionHeatsTable)
		.values({
			competitionId: params.competitionId,
			trackWorkoutId: params.trackWorkoutId,
			floorId: params.floorId,
			heatNumber: params.heatNumber,
			startTime: params.startTime,
			targetDivisionId: params.targetDivisionId ?? null,
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
	heatId: string
	startTime?: Date
	floorId?: string
	targetDivisionId?: string | null
}): Promise<void> {
	const db = getDb()

	const updateData: Partial<CompetitionHeat> = {}
	if (params.startTime !== undefined) updateData.startTime = params.startTime
	if (params.floorId !== undefined) updateData.floorId = params.floorId
	if (params.targetDivisionId !== undefined)
		updateData.targetDivisionId = params.targetDivisionId

	await db
		.update(competitionHeatsTable)
		.set(updateData)
		.where(eq(competitionHeatsTable.id, params.heatId))
}

/**
 * Delete a heat
 */
export async function deleteHeat(heatId: string): Promise<void> {
	const db = getDb()

	await db
		.delete(competitionHeatsTable)
		.where(eq(competitionHeatsTable.id, heatId))
}

/**
 * Delete all heats for a workout
 */
export async function deleteHeatsForWorkout(
	trackWorkoutId: string,
): Promise<void> {
	const db = getDb()

	await db
		.delete(competitionHeatsTable)
		.where(eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId))
}

// ============================================================================
// HEAT ASSIGNMENT MANAGEMENT
// ============================================================================

/**
 * Assign a registration to a heat
 */
export async function assignToHeat(params: {
	heatId: string
	registrationId: string
	laneNumber?: number | null
}): Promise<HeatAssignment> {
	const db = getDb()

	const [assignment] = await db
		.insert(heatAssignmentsTable)
		.values({
			heatId: params.heatId,
			registrationId: params.registrationId,
			laneNumber: params.laneNumber ?? null,
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
		.delete(heatAssignmentsTable)
		.where(eq(heatAssignmentsTable.id, assignmentId))
}

/**
 * Update lane assignment
 */
export async function updateLaneAssignment(params: {
	assignmentId: string
	laneNumber: number | null
}): Promise<void> {
	const db = getDb()

	await db
		.update(heatAssignmentsTable)
		.set({ laneNumber: params.laneNumber })
		.where(eq(heatAssignmentsTable.id, params.assignmentId))
}

/**
 * Check in an athlete
 */
export async function checkInAthlete(assignmentId: string): Promise<void> {
	const db = getDb()

	await db
		.update(heatAssignmentsTable)
		.set({ checkInAt: new Date() })
		.where(eq(heatAssignmentsTable.id, assignmentId))
}

/**
 * Undo check-in
 */
export async function undoCheckIn(assignmentId: string): Promise<void> {
	const db = getDb()

	await db
		.update(heatAssignmentsTable)
		.set({ checkInAt: null })
		.where(eq(heatAssignmentsTable.id, assignmentId))
}

// ============================================================================
// HEAT GENERATION ALGORITHM
// ============================================================================

interface RegistrationForHeat {
	id: string
	divisionId: string | null
	teamName: string | null
	user: { firstName: string | null; lastName: string | null }
}

interface GeneratedHeat {
	heatNumber: number
	divisionId: string | null
	registrationIds: string[]
}

/**
 * Generate heats for a workout, keeping divisions together
 *
 * Algorithm:
 * 1. Group registrations by division
 * 2. For each division, create as many full heats as possible
 * 3. Remaining athletes from each division get their own partial heat
 * 4. Optionally, combine partial heats to maximize floor usage
 */
export function generateHeatAssignments(params: {
	registrations: RegistrationForHeat[]
	floorCapacity: number
	keepDivisionsPure?: boolean
}): GeneratedHeat[] {
	const { registrations, floorCapacity, keepDivisionsPure = true } = params

	// Group by division
	const byDivision = new Map<string | null, RegistrationForHeat[]>()
	for (const reg of registrations) {
		const key = reg.divisionId
		const existing = byDivision.get(key) ?? []
		existing.push(reg)
		byDivision.set(key, existing)
	}

	const heats: GeneratedHeat[] = []
	let heatNumber = 1

	// Create heats for each division
	for (const [divisionId, divisionRegs] of byDivision) {
		let remaining = [...divisionRegs]

		while (remaining.length > 0) {
			const heatRegs = remaining.slice(0, floorCapacity)
			remaining = remaining.slice(floorCapacity)

			heats.push({
				heatNumber: heatNumber++,
				divisionId,
				registrationIds: heatRegs.map((r) => r.id),
			})
		}
	}

	// Optional: Combine partial heats if not keeping divisions pure
	if (!keepDivisionsPure) {
		const partialHeats = heats.filter(
			(h) => h.registrationIds.length < floorCapacity,
		)
		const fullHeats = heats.filter(
			(h) => h.registrationIds.length >= floorCapacity,
		)

		// Combine partial heats
		const combined: GeneratedHeat[] = []
		let currentHeat: string[] = []
		let currentHeatNumber = fullHeats.length + 1

		for (const partial of partialHeats) {
			for (const regId of partial.registrationIds) {
				currentHeat.push(regId)
				if (currentHeat.length >= floorCapacity) {
					combined.push({
						heatNumber: currentHeatNumber++,
						divisionId: null, // Mixed division
						registrationIds: currentHeat,
					})
					currentHeat = []
				}
			}
		}

		// Add remaining partial heat
		if (currentHeat.length > 0) {
			combined.push({
				heatNumber: currentHeatNumber++,
				divisionId: null,
				registrationIds: currentHeat,
			})
		}

		// Renumber full heats
		const renumberedFull = fullHeats.map((h, i) => ({
			...h,
			heatNumber: i + 1,
		}))

		// Renumber combined heats
		const renumberedCombined = combined.map((h, i) => ({
			...h,
			heatNumber: renumberedFull.length + i + 1,
		}))

		return [...renumberedFull, ...renumberedCombined]
	}

	return heats
}

/**
 * Auto-generate heats for a workout
 */
export async function autoGenerateHeatsForWorkout(params: {
	competitionId: string
	trackWorkoutId: string
	floorId: string
	startTime: Date
	heatDurationMinutes: number
	transitionMinutes?: number
	keepDivisionsPure?: boolean
}): Promise<CompetitionHeat[]> {
	const db = getDb()
	const {
		competitionId,
		trackWorkoutId,
		floorId,
		startTime,
		heatDurationMinutes,
		transitionMinutes = 5,
		keepDivisionsPure = true,
	} = params

	// Get floor capacity
	const floor = await db.query.competitionFloorsTable.findFirst({
		where: eq(competitionFloorsTable.id, floorId),
	})

	if (!floor) {
		throw new Error("Floor not found")
	}

	// Get track workout to find the competition
	const trackWorkout = await db.query.trackWorkoutsTable.findFirst({
		where: eq(trackWorkoutsTable.id, trackWorkoutId),
		with: {
			track: true,
		},
	})

	if (!trackWorkout) {
		throw new Error("Track workout not found")
	}

	// Get all registrations for this competition
	const registrations = await db.query.competitionRegistrationsTable.findMany({
		where: eq(competitionRegistrationsTable.eventId, competitionId),
		with: {
			user: true,
			division: true,
		},
	})

	// Generate heat assignments
	const generatedHeats = generateHeatAssignments({
		registrations: registrations.map((r) => ({
			id: r.id,
			divisionId: r.divisionId,
			teamName: r.teamName,
			user: {
				firstName: r.user?.firstName ?? null,
				lastName: r.user?.lastName ?? null,
			},
		})),
		floorCapacity: floor.capacity,
		keepDivisionsPure,
	})

	// Delete existing heats for this workout
	await deleteHeatsForWorkout(trackWorkoutId)

	// Create heats with staggered start times
	const createdHeats: CompetitionHeat[] = []
	const totalMinutesPerHeat = heatDurationMinutes + transitionMinutes

	for (const genHeat of generatedHeats) {
		const heatStartTime = new Date(
			startTime.getTime() +
				(genHeat.heatNumber - 1) * totalMinutesPerHeat * 60 * 1000,
		)

		const heat = await createHeat({
			competitionId,
			trackWorkoutId,
			floorId,
			heatNumber: genHeat.heatNumber,
			startTime: heatStartTime,
			targetDivisionId: genHeat.divisionId,
		})

		// Assign registrations to heat
		for (let i = 0; i < genHeat.registrationIds.length; i++) {
			await assignToHeat({
				heatId: heat.id,
				registrationId: genHeat.registrationIds[i] as string,
				laneNumber: i + 1,
			})
		}

		createdHeats.push(heat)
	}

	return createdHeats
}

// ============================================================================
// ATHLETE SCHEDULE VIEW
// ============================================================================

export interface AthleteHeatSchedule {
	trackWorkoutId: string
	workoutName: string
	trackOrder: number
	heat: {
		id: string
		heatNumber: number
		startTime: Date
		floor: { id: string; name: string }
	}
	laneNumber: number | null
	checkInAt: Date | null
}

/**
 * Get an athlete's heat schedule for a competition
 */
export async function getAthleteSchedule(
	registrationId: string,
): Promise<AthleteHeatSchedule[]> {
	const db = getDb()

	const assignments = await db.query.heatAssignmentsTable.findMany({
		where: eq(heatAssignmentsTable.registrationId, registrationId),
		with: {
			heat: {
				with: {
					floor: true,
					trackWorkout: {
						with: {
							workout: true,
						},
					},
				},
			},
		},
	})

	return assignments
		.map((a) => ({
			trackWorkoutId: a.heat.trackWorkoutId,
			workoutName: a.heat.trackWorkout?.workout?.name ?? "Unknown",
			trackOrder: a.heat.trackWorkout?.trackOrder ?? 0,
			heat: {
				id: a.heat.id,
				heatNumber: a.heat.heatNumber,
				startTime: a.heat.startTime,
				floor: {
					id: a.heat.floor.id,
					name: a.heat.floor.name,
				},
			},
			laneNumber: a.laneNumber,
			checkInAt: a.checkInAt,
		}))
		.sort((a, b) => a.heat.startTime.getTime() - b.heat.startTime.getTime())
}

/**
 * Get schedule summary for a competition (public view)
 */
export async function getCompetitionScheduleSummary(competitionId: string) {
	const db = getDb()

	const heats = await db.query.competitionHeatsTable.findMany({
		where: eq(competitionHeatsTable.competitionId, competitionId),
		orderBy: [asc(competitionHeatsTable.startTime)],
		with: {
			floor: true,
			targetDivision: true,
			trackWorkout: {
				with: {
					workout: true,
				},
			},
			assignments: true,
		},
	})

	// Group by date
	const byDate = new Map<string, typeof heats>()
	for (const heat of heats) {
		const dateKey = heat.startTime.toISOString().split("T")[0] as string
		const existing = byDate.get(dateKey) ?? []
		existing.push(heat)
		byDate.set(dateKey, existing)
	}

	return Array.from(byDate.entries()).map(([date, dateHeats]) => ({
		date,
		heats: dateHeats.map((h) => ({
			id: h.id,
			heatNumber: h.heatNumber,
			startTime: h.startTime,
			floor: h.floor.name,
			workoutName: h.trackWorkout?.workout?.name ?? "Unknown",
			trackOrder: h.trackWorkout?.trackOrder ?? 0,
			divisionLabel: h.targetDivision?.label ?? "Mixed",
			athleteCount: h.assignments.length,
		})),
	}))
}
