/**
 * Judge Rotation Server Functions for TanStack Start
 * Functions for managing judge rotations in competition events
 *
 * Ported from:
 * - apps/wodsmith/src/server/judge-rotations.ts
 * - apps/wodsmith/src/actions/judge-rotation-actions.ts
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, ne } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import type { CompetitionJudgeRotation, LaneShiftPattern } from "@/db/schema"
import {
	competitionHeatsTable,
	competitionJudgeRotationsTable,
	competitionsTable,
	competitionVenuesTable,
	judgeHeatAssignmentsTable,
	LANE_SHIFT_PATTERN,
	trackWorkoutsTable,
	workouts,
} from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { expandRotationToAssignments } from "@/lib/judge-rotation-utils"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Types
// ============================================================================

export interface RotationConflict {
	rotationId: string
	conflictType:
		| "double_booking"
		| "invalid_lane"
		| "invalid_heat"
		| "buffer_violation"
	message: string
	heatNumber?: number
	laneNumber?: number
}

export interface ValidationResult {
	conflicts: RotationConflict[]
	/** How many heats will actually be assigned (may be less than requested if some don't exist) */
	effectiveHeatsCount: number
	/** The requested heats count from the rotation */
	requestedHeatsCount: number
	/** True if some heats were skipped because they don't exist */
	truncated: boolean
}

export interface EnrichedJudgeRotation {
	rotation: CompetitionJudgeRotation
	trackWorkout: typeof trackWorkoutsTable.$inferSelect | null
	workout: { id: string; name: string } | null
	heats: Array<{
		heatNumber: number
		scheduledTime: Date | null
		durationMinutes: number | null
	}>
	/** Diagnostic info about why data might be missing */
	diagnostics: {
		missingTrackWorkout: boolean
		missingWorkout: boolean
		missingHeats: boolean
		heatsWithoutSchedule: number
	}
}

// ============================================================================
// Input Schemas
// ============================================================================

const teamIdSchema = z.string().startsWith("team_", "Invalid team ID")

const createRotationSchema = z.object({
	teamId: teamIdSchema,
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	membershipId: z.string().min(1, "Judge ID is required"),
	startingHeat: z.number().int().min(1, "Starting heat must be at least 1"),
	startingLane: z.number().int().min(1, "Starting lane must be at least 1"),
	heatsCount: z.number().int().min(1, "Must cover at least 1 heat"),
	laneShiftPattern: z
		.enum([LANE_SHIFT_PATTERN.STAY, LANE_SHIFT_PATTERN.SHIFT_RIGHT])
		.optional(),
	notes: z.string().max(500, "Notes too long").optional(),
})

const updateRotationSchema = z.object({
	teamId: teamIdSchema,
	rotationId: z.string().min(1, "Rotation ID is required"),
	startingHeat: z.number().int().min(1).optional(),
	startingLane: z.number().int().min(1).optional(),
	heatsCount: z.number().int().min(1).optional(),
	laneShiftPattern: z
		.enum([LANE_SHIFT_PATTERN.STAY, LANE_SHIFT_PATTERN.SHIFT_RIGHT])
		.optional(),
	notes: z.string().max(500).optional(),
})

const deleteRotationSchema = z.object({
	teamId: teamIdSchema,
	rotationId: z.string().min(1, "Rotation ID is required"),
})

const getEventRotationsSchema = z.object({
	trackWorkoutId: z.string().min(1, "Event ID is required"),
})

const getJudgeRotationsSchema = z.object({
	membershipId: z.string().min(1, "Judge ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
})

const getEnrichedJudgeRotationsSchema = z.object({
	membershipId: z.string().min(1, "Judge ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
	includeUnpublished: z.boolean().optional(),
})

const validateRotationSchema = z.object({
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	membershipId: z.string().min(1, "Judge ID is required"),
	startingHeat: z.number().int().min(1),
	startingLane: z.number().int().min(1),
	heatsCount: z.number().int().min(1),
	laneShiftPattern: z.enum([
		LANE_SHIFT_PATTERN.STAY,
		LANE_SHIFT_PATTERN.SHIFT_RIGHT,
	]),
	rotationId: z.string().optional(), // For update validation
	excludeAllForMembership: z.boolean().optional(),
})

const updateEventDefaultsSchema = z.object({
	teamId: teamIdSchema,
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	defaultHeatsCount: z.number().int().min(1).nullable().optional(),
	defaultLaneShiftPattern: z
		.enum([LANE_SHIFT_PATTERN.STAY, LANE_SHIFT_PATTERN.SHIFT_RIGHT])
		.nullable()
		.optional(),
	minHeatBuffer: z.number().int().min(1).max(10).nullable().optional(),
})

const batchCreateRotationsSchema = z.object({
	teamId: teamIdSchema,
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	membershipId: z.string().min(1, "Judge ID is required"),
	rotations: z
		.array(
			z.object({
				startingHeat: z
					.number()
					.int()
					.min(1, "Starting heat must be at least 1"),
				startingLane: z
					.number()
					.int()
					.min(1, "Starting lane must be at least 1"),
				heatsCount: z.number().int().min(1, "Must cover at least 1 heat"),
				notes: z.string().max(500, "Notes too long").optional(),
			}),
		)
		.min(1, "At least one rotation required"),
	laneShiftPattern: z.enum([
		LANE_SHIFT_PATTERN.STAY,
		LANE_SHIFT_PATTERN.SHIFT_RIGHT,
	]),
})

const batchUpdateVolunteerRotationsSchema = z.object({
	teamId: teamIdSchema,
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	membershipId: z.string().min(1, "Judge ID is required"),
	rotations: z
		.array(
			z.object({
				startingHeat: z
					.number()
					.int()
					.min(1, "Starting heat must be at least 1"),
				startingLane: z
					.number()
					.int()
					.min(1, "Starting lane must be at least 1"),
				heatsCount: z.number().int().min(1, "Must cover at least 1 heat"),
				notes: z.string().max(500, "Notes too long").optional(),
			}),
		)
		.min(1, "At least one rotation required"),
	laneShiftPattern: z.enum([
		LANE_SHIFT_PATTERN.STAY,
		LANE_SHIFT_PATTERN.SHIFT_RIGHT,
	]),
})

const deleteVolunteerRotationsSchema = z.object({
	teamId: teamIdSchema,
	membershipId: z.string().min(1, "Judge ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
})

const batchDeleteRotationsSchema = z.object({
	teamId: teamIdSchema,
	competitionId: z.string().min(1, "Competition ID is required"),
	rotationIds: z.array(z.string().min(1)).min(1, "At least one rotation ID required"),
})

const adjustRotationsForOccupiedLanesSchema = z.object({
	teamId: teamIdSchema,
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	/** Map of heatNumber -> array of occupied lane numbers */
	occupiedLanesByHeat: z.record(z.string(), z.array(z.number())),
	/** Rotation IDs to adjust */
	rotationIds: z.array(z.string().min(1)).min(1, "At least one rotation ID required"),
})

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Validate rotation for conflicts (double-booking, invalid lanes, buffer violations)
 * Internal function used by multiple server functions
 */
async function validateRotationConflictsInternal(
	rotation: {
		id?: string
		trackWorkoutId: string
		membershipId: string
		startingHeat: number
		startingLane: number
		heatsCount: number
		laneShiftPattern: LaneShiftPattern
	},
	options?: {
		excludeAllForMembership?: boolean
	},
): Promise<ValidationResult> {
	const db = getDb()
	const conflicts: RotationConflict[] = []

	// Get all heats for the event with venue lane count
	const heatsRaw = await db
		.select({
			heatNumber: competitionHeatsTable.heatNumber,
			venueId: competitionHeatsTable.venueId,
			venueLaneCount: competitionVenuesTable.laneCount,
		})
		.from(competitionHeatsTable)
		.leftJoin(
			competitionVenuesTable,
			eq(competitionHeatsTable.venueId, competitionVenuesTable.id),
		)
		.where(eq(competitionHeatsTable.trackWorkoutId, rotation.trackWorkoutId))

	// Map with default lane count if venue not set
	const heats = heatsRaw.map((h) => ({
		heatNumber: h.heatNumber,
		laneCount: h.venueLaneCount ?? 10, // Default to 10 lanes if no venue set
	}))

	if (heats.length === 0) {
		conflicts.push({
			rotationId: rotation.id ?? "new",
			conflictType: "invalid_heat",
			message: "No heats found for this event",
		})
		return {
			conflicts,
			effectiveHeatsCount: 0,
			requestedHeatsCount: rotation.heatsCount,
			truncated: true,
		}
	}

	const heatMap = new Map(heats.map((h) => [h.heatNumber, h]))

	// Count how many heats actually exist in the requested range
	let effectiveHeatsCount = 0

	// Validate each heat in the rotation - skip non-existent heats (don't treat as error)
	for (let i = 0; i < rotation.heatsCount; i++) {
		const heatNumber = rotation.startingHeat + i
		const heat = heatMap.get(heatNumber)

		// Skip heats that don't exist - they just won't be assigned
		if (!heat) {
			continue
		}

		effectiveHeatsCount++

		// Calculate lane for this heat
		let laneNumber = rotation.startingLane

		switch (rotation.laneShiftPattern) {
			case LANE_SHIFT_PATTERN.SHIFT_RIGHT:
				laneNumber = ((rotation.startingLane - 1 + i) % heat.laneCount) + 1
				break
		}

		// Validate lane number
		if (laneNumber < 1 || laneNumber > heat.laneCount) {
			conflicts.push({
				rotationId: rotation.id ?? "new",
				conflictType: "invalid_lane",
				message: `Lane ${laneNumber} is invalid for heat ${heatNumber} (max: ${heat.laneCount})`,
				heatNumber,
				laneNumber,
			})
		}
	}

	// Check for double-booking with existing rotations
	// Skip this check entirely if we're doing a batch replace for this membership
	if (!options?.excludeAllForMembership) {
		const existingRotations = await db
			.select()
			.from(competitionJudgeRotationsTable)
			.where(
				and(
					eq(
						competitionJudgeRotationsTable.trackWorkoutId,
						rotation.trackWorkoutId,
					),
					eq(
						competitionJudgeRotationsTable.membershipId,
						rotation.membershipId,
					),
					// Exclude self if updating a single rotation
					...(rotation.id
						? [ne(competitionJudgeRotationsTable.id, rotation.id)]
						: []),
				),
			)

		// Expand current rotation
		const currentAssignments = expandRotationToAssignments(
			{
				...rotation,
				id: rotation.id ?? "new",
				competitionId: "", // Not needed for expansion
				notes: null,
				createdAt: new Date(),
				updatedAt: new Date(),
				updateCounter: null,
			},
			heats,
		)

		// Expand existing rotations and check for overlaps
		for (const existing of existingRotations) {
			const existingAssignments = expandRotationToAssignments(existing, heats)

			// Check for overlapping heats
			for (const current of currentAssignments) {
				for (const exist of existingAssignments) {
					if (current.heatNumber === exist.heatNumber) {
						conflicts.push({
							rotationId: existing.id,
							conflictType: "double_booking",
							message: `Judge is already assigned to heat ${current.heatNumber}`,
							heatNumber: current.heatNumber,
							laneNumber: current.laneNumber,
						})
					}
				}
			}
		}

		// Get minHeatBuffer from event settings (default to 2)
		const [eventSettings] = await db
			.select({
				minHeatBuffer: trackWorkoutsTable.minHeatBuffer,
			})
			.from(trackWorkoutsTable)
			.where(eq(trackWorkoutsTable.id, rotation.trackWorkoutId))

		const minHeatBuffer = eventSettings?.minHeatBuffer ?? 2

		// Check for buffer violations
		for (const existing of existingRotations) {
			const existingAssignments = expandRotationToAssignments(existing, heats)

			if (existingAssignments.length === 0) continue

			// Get the range of the existing rotation
			const existingHeatNumbers = existingAssignments.map((a) => a.heatNumber)
			const existingStart = Math.min(...existingHeatNumbers)
			const existingEnd = Math.max(...existingHeatNumbers)

			// Calculate buffer zones
			const bufferAfterStart = existingEnd + 1
			const bufferAfterEnd = existingEnd + minHeatBuffer
			const bufferBeforeStart = existingStart - minHeatBuffer
			const bufferBeforeEnd = existingStart - 1

			// Check if any heat in the current rotation falls within buffer zones
			for (const current of currentAssignments) {
				const { heatNumber } = current

				// Check buffer zone after existing rotation
				if (heatNumber >= bufferAfterStart && heatNumber <= bufferAfterEnd) {
					conflicts.push({
						rotationId: existing.id,
						conflictType: "buffer_violation",
						message: `Heat ${heatNumber} is within the buffer zone (needs ${minHeatBuffer} heat gap after rotation ending at heat ${existingEnd})`,
						heatNumber,
					})
				}

				// Check buffer zone before existing rotation
				if (heatNumber >= bufferBeforeStart && heatNumber <= bufferBeforeEnd) {
					conflicts.push({
						rotationId: existing.id,
						conflictType: "buffer_violation",
						message: `Heat ${heatNumber} is within the buffer zone (needs ${minHeatBuffer} heat gap before rotation starting at heat ${existingStart})`,
						heatNumber,
					})
				}
			}
		}
	}

	return {
		conflicts,
		effectiveHeatsCount,
		requestedHeatsCount: rotation.heatsCount,
		truncated: effectiveHeatsCount < rotation.heatsCount,
	}
}

/**
 * Create a judge rotation (internal helper)
 */
async function createRotationInternal(params: {
	teamId: string
	competitionId: string
	trackWorkoutId: string
	membershipId: string
	startingHeat: number
	startingLane: number
	heatsCount: number
	laneShiftPattern?: LaneShiftPattern
	notes?: string
}): Promise<CompetitionJudgeRotation> {
	const db = getDb()

	// Permission check
	await requireTeamPermission(
		params.teamId,
		TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
	)

	// Determine lane shift pattern from hierarchy: param > event default > competition default > STAY
	let laneShiftPattern = params.laneShiftPattern

	if (!laneShiftPattern) {
		// Get event defaults
		const [event] = await db
			.select({
				defaultLaneShiftPattern: trackWorkoutsTable.defaultLaneShiftPattern,
				trackId: trackWorkoutsTable.trackId,
			})
			.from(trackWorkoutsTable)
			.where(eq(trackWorkoutsTable.id, params.trackWorkoutId))

		if (event?.defaultLaneShiftPattern) {
			laneShiftPattern = event.defaultLaneShiftPattern as LaneShiftPattern
		} else if (event?.trackId) {
			// Fall back to competition defaults
			const [competition] = await db
				.select({
					defaultLaneShiftPattern: competitionsTable.defaultLaneShiftPattern,
				})
				.from(competitionsTable)
				.where(eq(competitionsTable.id, params.competitionId))

			laneShiftPattern =
				(competition?.defaultLaneShiftPattern as LaneShiftPattern) ??
				LANE_SHIFT_PATTERN.STAY
		}

		// Final fallback
		if (!laneShiftPattern) {
			laneShiftPattern = LANE_SHIFT_PATTERN.STAY
		}
	}

	const [rotation] = await db
		.insert(competitionJudgeRotationsTable)
		.values({
			competitionId: params.competitionId,
			trackWorkoutId: params.trackWorkoutId,
			membershipId: params.membershipId,
			startingHeat: params.startingHeat,
			startingLane: params.startingLane,
			heatsCount: params.heatsCount,
			laneShiftPattern,
			notes: params.notes ?? null,
		})
		.returning()

	if (!rotation) {
		throw new Error("Failed to create judge rotation")
	}

	return rotation
}

/**
 * Delete a judge rotation (internal helper)
 *
 * Note: The rotationId FK on judge_heat_assignments was created without
 * ON DELETE SET NULL (migration 0060), so we must manually null it out
 * before deleting the rotation to avoid FK constraint violations.
 */
async function deleteRotationInternal(
	rotationId: string,
	teamId: string,
): Promise<void> {
	const db = getDb()

	// Permission check
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_COMPETITIONS)

	// Clear rotationId references in judge_heat_assignments before deleting
	// (the DB FK lacks ON DELETE SET NULL due to migration 0060)
	await db
		.update(judgeHeatAssignmentsTable)
		.set({ rotationId: null })
		.where(eq(judgeHeatAssignmentsTable.rotationId, rotationId))

	await db
		.delete(competitionJudgeRotationsTable)
		.where(eq(competitionJudgeRotationsTable.id, rotationId))
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all rotations for an event with defaults
 */
export const getEventRotationsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getEventRotationsSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		const rotations = await db
			.select()
			.from(competitionJudgeRotationsTable)
			.where(
				eq(competitionJudgeRotationsTable.trackWorkoutId, data.trackWorkoutId),
			)

		// Get event defaults from trackWorkout
		const [event] = await db
			.select({
				defaultHeatsCount: trackWorkoutsTable.defaultHeatsCount,
				defaultLaneShiftPattern: trackWorkoutsTable.defaultLaneShiftPattern,
				minHeatBuffer: trackWorkoutsTable.minHeatBuffer,
			})
			.from(trackWorkoutsTable)
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

		return {
			rotations,
			eventDefaults: {
				defaultHeatsCount: event?.defaultHeatsCount ?? null,
				defaultLaneShiftPattern:
					(event?.defaultLaneShiftPattern as LaneShiftPattern) ?? null,
				minHeatBuffer: event?.minHeatBuffer ?? null,
			},
		}
	})

/**
 * Get all rotations for a specific judge in a competition
 */
export const getJudgeRotationsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getJudgeRotationsSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		const rotations = await db
			.select()
			.from(competitionJudgeRotationsTable)
			.where(
				and(
					eq(competitionJudgeRotationsTable.membershipId, data.membershipId),
					eq(competitionJudgeRotationsTable.competitionId, data.competitionId),
				),
			)

		// Debug logging
		if (rotations.length === 0) {
			console.log(
				`[getJudgeRotationsFn] No rotations found for membershipId=${data.membershipId}, competitionId=${data.competitionId}`,
			)
		} else {
			console.log(
				`[getJudgeRotationsFn] Found ${rotations.length} rotation(s) for membershipId=${data.membershipId}, competitionId=${data.competitionId}`,
			)
		}

		return rotations
	})

/**
 * Get enriched rotations for a judge with trackWorkout, workout, and heats data
 */
export const getEnrichedJudgeRotationsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getEnrichedJudgeRotationsSchema.parse(data),
	)
	.handler(async ({ data }): Promise<EnrichedJudgeRotation[]> => {
		const db = getDb()

		// Get raw rotations first
		const rotations = await db
			.select()
			.from(competitionJudgeRotationsTable)
			.where(
				and(
					eq(competitionJudgeRotationsTable.membershipId, data.membershipId),
					eq(competitionJudgeRotationsTable.competitionId, data.competitionId),
				),
			)

		const enriched: EnrichedJudgeRotation[] = []

		for (const rotation of rotations) {
			const diagnostics = {
				missingTrackWorkout: false,
				missingWorkout: false,
				missingHeats: false,
				heatsWithoutSchedule: 0,
			}

			// Fetch trackWorkout
			const [trackWorkout] = await db
				.select()
				.from(trackWorkoutsTable)
				.where(eq(trackWorkoutsTable.id, rotation.trackWorkoutId))

			if (!trackWorkout) {
				console.error(
					`[getEnrichedJudgeRotationsFn] Missing trackWorkout for rotation ${rotation.id}, trackWorkoutId=${rotation.trackWorkoutId}`,
				)
				diagnostics.missingTrackWorkout = true
			}

			// Skip if filtering unpublished and event is not published
			if (
				!data.includeUnpublished &&
				trackWorkout?.eventStatus !== "published"
			) {
				console.log(
					`[getEnrichedJudgeRotationsFn] Skipping rotation ${rotation.id} - eventStatus=${trackWorkout?.eventStatus} (not published)`,
				)
				continue
			}

			// Fetch workout if trackWorkout exists
			let workout: { id: string; name: string } | null = null
			if (trackWorkout?.workoutId) {
				const [workoutResult] = await db
					.select({ id: workouts.id, name: workouts.name })
					.from(workouts)
					.where(eq(workouts.id, trackWorkout.workoutId))

				if (!workoutResult) {
					console.error(
						`[getEnrichedJudgeRotationsFn] Missing workout for rotation ${rotation.id}, workoutId=${trackWorkout.workoutId}`,
					)
					diagnostics.missingWorkout = true
				} else {
					workout = workoutResult
				}
			} else if (trackWorkout) {
				console.error(
					`[getEnrichedJudgeRotationsFn] TrackWorkout ${trackWorkout.id} has no workoutId`,
				)
				diagnostics.missingWorkout = true
			}

			// Fetch heats for this trackWorkout
			const heats = trackWorkout
				? await db
						.select({
							heatNumber: competitionHeatsTable.heatNumber,
							scheduledTime: competitionHeatsTable.scheduledTime,
							durationMinutes: competitionHeatsTable.durationMinutes,
						})
						.from(competitionHeatsTable)
						.where(
							eq(competitionHeatsTable.trackWorkoutId, rotation.trackWorkoutId),
						)
				: []

			if (heats.length === 0) {
				console.error(
					`[getEnrichedJudgeRotationsFn] No heats found for rotation ${rotation.id}, trackWorkoutId=${rotation.trackWorkoutId}`,
				)
				diagnostics.missingHeats = true
			} else {
				// Check for heats missing schedule data
				const unscheduled = heats.filter(
					(h) => !h.scheduledTime || !h.durationMinutes,
				)
				if (unscheduled.length > 0) {
					console.warn(
						`[getEnrichedJudgeRotationsFn] ${unscheduled.length}/${heats.length} heats for rotation ${rotation.id} lack scheduledTime or durationMinutes`,
					)
					diagnostics.heatsWithoutSchedule = unscheduled.length
				}
			}

			enriched.push({
				rotation,
				trackWorkout: trackWorkout ?? null,
				workout,
				heats,
				diagnostics,
			})
		}

		// Summary logging
		const withIssues = enriched.filter(
			(r) =>
				r.diagnostics.missingTrackWorkout ||
				r.diagnostics.missingWorkout ||
				r.diagnostics.missingHeats ||
				r.diagnostics.heatsWithoutSchedule > 0,
		)

		if (withIssues.length > 0) {
			console.warn(
				`[getEnrichedJudgeRotationsFn] ${withIssues.length}/${enriched.length} rotation(s) have data issues`,
			)
		}

		return enriched
	})

/**
 * Validate a rotation configuration without creating it
 */
export const validateRotationFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => validateRotationSchema.parse(data))
	.handler(async ({ data }) => {
		const validation = await validateRotationConflictsInternal(data, {
			excludeAllForMembership: data.excludeAllForMembership,
		})

		return {
			valid: validation.conflicts.length === 0,
			conflicts: validation.conflicts,
			effectiveHeatsCount: validation.effectiveHeatsCount,
			requestedHeatsCount: validation.requestedHeatsCount,
			truncated: validation.truncated,
		}
	})

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Create a new judge rotation
 */
export const createJudgeRotationFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createRotationSchema.parse(data))
	.handler(async ({ data }) => {
		// Validate rotation before creating
		const validation = await validateRotationConflictsInternal({
			trackWorkoutId: data.trackWorkoutId,
			membershipId: data.membershipId,
			startingHeat: data.startingHeat,
			startingLane: data.startingLane,
			heatsCount: data.heatsCount,
			laneShiftPattern: data.laneShiftPattern ?? LANE_SHIFT_PATTERN.STAY,
		})

		if (validation.conflicts.length > 0) {
			throw new Error(
				`Rotation has conflicts: ${validation.conflicts.map((c) => c.message).join(", ")}`,
			)
		}

		const rotation = await createRotationInternal(data)
		return { success: true, data: rotation }
	})

/**
 * Update an existing judge rotation
 */
export const updateJudgeRotationFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateRotationSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Permission check
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Get existing rotation to merge data for validation
		const existing = await db.query.competitionJudgeRotationsTable.findFirst({
			where: (table, { eq }) => eq(table.id, data.rotationId),
		})

		if (!existing) {
			throw new Error("Rotation not found")
		}

		// Validate with merged data
		const validation = await validateRotationConflictsInternal({
			id: data.rotationId,
			trackWorkoutId: existing.trackWorkoutId,
			membershipId: existing.membershipId,
			startingHeat: data.startingHeat ?? existing.startingHeat,
			startingLane: data.startingLane ?? existing.startingLane,
			heatsCount: data.heatsCount ?? existing.heatsCount,
			laneShiftPattern: data.laneShiftPattern ?? existing.laneShiftPattern,
		})

		if (validation.conflicts.length > 0) {
			throw new Error(
				`Rotation has conflicts: ${validation.conflicts.map((c) => c.message).join(", ")}`,
			)
		}

		const updateData: Partial<CompetitionJudgeRotation> = {
			updatedAt: new Date(),
		}

		if (data.startingHeat !== undefined) {
			updateData.startingHeat = data.startingHeat
		}
		if (data.startingLane !== undefined) {
			updateData.startingLane = data.startingLane
		}
		if (data.heatsCount !== undefined) {
			updateData.heatsCount = data.heatsCount
		}
		if (data.laneShiftPattern !== undefined) {
			updateData.laneShiftPattern = data.laneShiftPattern
		}
		if (data.notes !== undefined) {
			updateData.notes = data.notes
		}

		const [updated] = await db
			.update(competitionJudgeRotationsTable)
			.set(updateData)
			.where(eq(competitionJudgeRotationsTable.id, data.rotationId))
			.returning()

		if (!updated) {
			throw new Error("Rotation not found or update failed")
		}

		return { success: true, data: updated }
	})

/**
 * Delete a judge rotation
 */
export const deleteJudgeRotationFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteRotationSchema.parse(data))
	.handler(async ({ data }) => {
		await deleteRotationInternal(data.rotationId, data.teamId)
		return { success: true }
	})

/**
 * Update default heats count and lane shift pattern for an event
 */
export const updateEventDefaultsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => updateEventDefaultsSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Permission check
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const updateData: {
			defaultHeatsCount?: number | null
			defaultLaneShiftPattern?: string | null
			minHeatBuffer?: number | null
			updatedAt: Date
		} = {
			updatedAt: new Date(),
		}

		if (data.defaultHeatsCount !== undefined) {
			updateData.defaultHeatsCount = data.defaultHeatsCount
		}
		if (data.defaultLaneShiftPattern !== undefined) {
			updateData.defaultLaneShiftPattern = data.defaultLaneShiftPattern
		}
		if (data.minHeatBuffer !== undefined) {
			updateData.minHeatBuffer = data.minHeatBuffer
		}

		await db
			.update(trackWorkoutsTable)
			.set(updateData)
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

		return { success: true }
	})

/**
 * Batch create multiple rotations for the same volunteer
 * Validates ALL rotations before creating any (fail-fast)
 */
export const batchCreateRotationsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => batchCreateRotationsSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Validate that all foreign keys exist
		const [trackWorkout, membership, competition] = await Promise.all([
			db.query.trackWorkoutsTable.findFirst({
				where: (table, { eq }) => eq(table.id, data.trackWorkoutId),
			}),
			db.query.teamMembershipTable.findFirst({
				where: (table, { eq }) => eq(table.id, data.membershipId),
			}),
			db.query.competitionsTable.findFirst({
				where: (table, { eq }) => eq(table.id, data.competitionId),
			}),
		])

		if (!trackWorkout) {
			throw new Error("Event not found")
		}
		if (!membership) {
			throw new Error("Judge membership not found")
		}
		if (!competition) {
			throw new Error("Competition not found")
		}

		// Validate all rotations first (fail-fast)
		const validationPromises = data.rotations.map((rotation) =>
			validateRotationConflictsInternal({
				trackWorkoutId: data.trackWorkoutId,
				membershipId: data.membershipId,
				startingHeat: rotation.startingHeat,
				startingLane: rotation.startingLane,
				heatsCount: rotation.heatsCount,
				laneShiftPattern: data.laneShiftPattern,
			}),
		)

		const validationResults = await Promise.all(validationPromises)

		// Collect all conflicts
		const allConflicts = validationResults.flatMap((result) => result.conflicts)

		if (allConflicts.length > 0) {
			throw new Error(
				`Rotations have conflicts: ${allConflicts.map((c) => c.message).join(", ")}`,
			)
		}

		// Check for conflicts BETWEEN the new rotations being created
		for (let i = 0; i < data.rotations.length; i++) {
			for (let j = i + 1; j < data.rotations.length; j++) {
				const rot1 = data.rotations[i]
				const rot2 = data.rotations[j]

				if (!rot1 || !rot2) continue

				// Check if heat ranges overlap
				const rot1End = rot1.startingHeat + rot1.heatsCount - 1
				const rot2End = rot2.startingHeat + rot2.heatsCount - 1

				if (!(rot1End < rot2.startingHeat || rot2End < rot1.startingHeat)) {
					throw new Error(
						`Rotations ${i + 1} and ${j + 1} have overlapping heat ranges and may conflict`,
					)
				}
			}
		}

		// All validations passed - create rotations in sequence
		const createdRotations: CompetitionJudgeRotation[] = []

		for (const rotation of data.rotations) {
			const created = await createRotationInternal({
				teamId: data.teamId,
				competitionId: data.competitionId,
				trackWorkoutId: data.trackWorkoutId,
				membershipId: data.membershipId,
				startingHeat: rotation.startingHeat,
				startingLane: rotation.startingLane,
				heatsCount: rotation.heatsCount,
				laneShiftPattern: data.laneShiftPattern,
				notes: rotation.notes,
			})

			createdRotations.push(created)
		}

		return {
			success: true,
			data: {
				rotationIds: createdRotations.map((r) => r.id),
				rotations: createdRotations,
			},
		}
	})

/**
 * Replace all rotations for a volunteer with a new set
 * Deletes existing rotations, then creates new ones
 */
export const batchUpdateVolunteerRotationsFn = createServerFn({
	method: "POST",
})
	.inputValidator((data: unknown) =>
		batchUpdateVolunteerRotationsSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const db = getDb()

		// Validate that all foreign keys exist
		const [trackWorkout, membership, competition] = await Promise.all([
			db.query.trackWorkoutsTable.findFirst({
				where: (table, { eq }) => eq(table.id, data.trackWorkoutId),
			}),
			db.query.teamMembershipTable.findFirst({
				where: (table, { eq }) => eq(table.id, data.membershipId),
			}),
			db.query.competitionsTable.findFirst({
				where: (table, { eq }) => eq(table.id, data.competitionId),
			}),
		])

		if (!trackWorkout) {
			throw new Error("Event not found")
		}
		if (!membership) {
			throw new Error("Judge membership not found")
		}
		if (!competition) {
			throw new Error("Competition not found")
		}

		// Validate all NEW rotations first (fail-fast)
		// Pass excludeAllForMembership: true because we're replacing ALL rotations
		const validationPromises = data.rotations.map((rotation) =>
			validateRotationConflictsInternal(
				{
					trackWorkoutId: data.trackWorkoutId,
					membershipId: data.membershipId,
					startingHeat: rotation.startingHeat,
					startingLane: rotation.startingLane,
					heatsCount: rotation.heatsCount,
					laneShiftPattern: data.laneShiftPattern,
				},
				{ excludeAllForMembership: true },
			),
		)

		const validationResults = await Promise.all(validationPromises)

		// Check for conflicts BETWEEN the new rotations being created
		for (let i = 0; i < data.rotations.length; i++) {
			for (let j = i + 1; j < data.rotations.length; j++) {
				const rot1 = data.rotations[i]
				const rot2 = data.rotations[j]

				if (!rot1 || !rot2) continue

				// Check if heat ranges overlap
				const rot1End = rot1.startingHeat + rot1.heatsCount - 1
				const rot2End = rot2.startingHeat + rot2.heatsCount - 1

				if (!(rot1End < rot2.startingHeat || rot2End < rot1.startingHeat)) {
					throw new Error(
						`Rotations ${i + 1} and ${j + 1} have overlapping heat ranges and may conflict`,
					)
				}
			}
		}

		// Collect validation errors
		const allConflicts = validationResults.flatMap((result) => result.conflicts)

		if (allConflicts.length > 0) {
			throw new Error(
				`Rotations have conflicts: ${allConflicts.map((c) => c.message).join(", ")}`,
			)
		}

		// Delete existing rotations for this volunteer+event
		const existingRotations = await db
			.select()
			.from(competitionJudgeRotationsTable)
			.where(
				and(
					eq(
						competitionJudgeRotationsTable.trackWorkoutId,
						data.trackWorkoutId,
					),
					eq(competitionJudgeRotationsTable.membershipId, data.membershipId),
				),
			)

		for (const existing of existingRotations) {
			await deleteRotationInternal(existing.id, data.teamId)
		}

		// Create new rotations in sequence
		const createdRotations: CompetitionJudgeRotation[] = []

		for (const rotation of data.rotations) {
			const created = await createRotationInternal({
				teamId: data.teamId,
				competitionId: data.competitionId,
				trackWorkoutId: data.trackWorkoutId,
				membershipId: data.membershipId,
				startingHeat: rotation.startingHeat,
				startingLane: rotation.startingLane,
				heatsCount: rotation.heatsCount,
				laneShiftPattern: data.laneShiftPattern,
				notes: rotation.notes,
			})

			createdRotations.push(created)
		}

		return {
			success: true,
			data: {
				rotationIds: createdRotations.map((r) => r.id),
				rotations: createdRotations,
			},
		}
	})

/**
 * Delete all rotations for a specific volunteer in an event
 */
export const deleteVolunteerRotationsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => deleteVolunteerRotationsSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Permission check
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Delete all rotations for this volunteer in this event
		const result = await db
			.delete(competitionJudgeRotationsTable)
			.where(
				and(
					eq(competitionJudgeRotationsTable.membershipId, data.membershipId),
					eq(
						competitionJudgeRotationsTable.trackWorkoutId,
						data.trackWorkoutId,
					),
				),
			)
			.returning({ id: competitionJudgeRotationsTable.id })

		return {
			success: true,
			data: { deletedCount: result.length },
		}
	})

/**
 * Batch delete multiple rotations by their IDs
 */
export const batchDeleteRotationsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => batchDeleteRotationsSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Permission check
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Verify all rotations belong to this competition before deleting
		const rotations = await db.query.competitionJudgeRotationsTable.findMany({
			where: (table, { inArray }) => inArray(table.id, data.rotationIds),
		})

		for (const rotation of rotations) {
			if (rotation.competitionId !== data.competitionId) {
				throw new Error("Rotation does not belong to this competition")
			}
		}

		// Delete each rotation
		let deletedCount = 0
		for (const rotationId of data.rotationIds) {
			await deleteRotationInternal(rotationId, data.teamId)
			deletedCount++
		}

		return {
			success: true,
			data: { deletedCount },
		}
	})

/**
 * Adjust rotations to only cover lanes with athletes.
 * Splits rotations as needed to skip unoccupied lanes.
 */
export const adjustRotationsForOccupiedLanesFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => adjustRotationsForOccupiedLanesSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		// Permission check
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Get heats for expansion
		const heatsRaw = await db
			.select({
				heatNumber: competitionHeatsTable.heatNumber,
				venueLaneCount: competitionVenuesTable.laneCount,
			})
			.from(competitionHeatsTable)
			.leftJoin(
				competitionVenuesTable,
				eq(competitionHeatsTable.venueId, competitionVenuesTable.id),
			)
			.where(eq(competitionHeatsTable.trackWorkoutId, data.trackWorkoutId))

		const heats = heatsRaw.map((h) => ({
			heatNumber: h.heatNumber,
			laneCount: h.venueLaneCount ?? 10,
		}))

		// Convert occupiedLanesByHeat to a Map for easier lookup
		const occupiedMap = new Map<number, Set<number>>()
		for (const [heatStr, lanes] of Object.entries(data.occupiedLanesByHeat)) {
			occupiedMap.set(Number(heatStr), new Set(lanes))
		}

		let deletedCount = 0
		let createdCount = 0
		let unchangedCount = 0

		for (const rotationId of data.rotationIds) {
			// Get the rotation
			const rotation = await db.query.competitionJudgeRotationsTable.findFirst({
				where: (table, { eq }) => eq(table.id, rotationId),
			})

			if (!rotation) continue

			// Validate rotation belongs to this event
			if (
				rotation.trackWorkoutId !== data.trackWorkoutId ||
				rotation.competitionId !== data.competitionId
			) {
				throw new Error("Rotation does not belong to this event")
			}

			// Expand to assignments
			const assignments = expandRotationToAssignments(rotation, heats)

			// Filter to only occupied lanes
			const occupiedAssignments = assignments.filter((a) => {
				const occupied = occupiedMap.get(a.heatNumber)
				return occupied?.has(a.laneNumber)
			})

			// If all assignments are valid, skip this rotation
			if (occupiedAssignments.length === assignments.length) {
				unchangedCount++
				continue
			}

			// If no assignments are valid, just delete
			if (occupiedAssignments.length === 0) {
				await deleteRotationInternal(rotationId, data.teamId)
				deletedCount++
				continue
			}

			// Group contiguous heats into new rotations
			// Sort by heat number
			occupiedAssignments.sort((a, b) => a.heatNumber - b.heatNumber)

			const newRotations: Array<{
				startingHeat: number
				startingLane: number
				heatsCount: number
			}> = []

			let currentRun: typeof occupiedAssignments = []

			for (const assignment of occupiedAssignments) {
				if (currentRun.length === 0) {
					currentRun.push(assignment)
				} else {
					const lastAssignment = currentRun[currentRun.length - 1]!
					// Check if this is contiguous (next heat in sequence)
					if (assignment.heatNumber === lastAssignment.heatNumber + 1) {
						currentRun.push(assignment)
					} else {
						// End current run, start new one
						newRotations.push({
							startingHeat: currentRun[0]!.heatNumber,
							startingLane: currentRun[0]!.laneNumber,
							heatsCount: currentRun.length,
						})
						currentRun = [assignment]
					}
				}
			}

			// Don't forget the last run
			if (currentRun.length > 0) {
				newRotations.push({
					startingHeat: currentRun[0]!.heatNumber,
					startingLane: currentRun[0]!.laneNumber,
					heatsCount: currentRun.length,
				})
			}

			// Create new rotations FIRST to avoid data loss if creation fails
			// (D1 doesn't support transactions, so we build replacements before deleting)
			for (const newRot of newRotations) {
				await createRotationInternal({
					teamId: data.teamId,
					competitionId: data.competitionId,
					trackWorkoutId: data.trackWorkoutId,
					membershipId: rotation.membershipId,
					startingHeat: newRot.startingHeat,
					startingLane: newRot.startingLane,
					heatsCount: newRot.heatsCount,
					laneShiftPattern: rotation.laneShiftPattern,
					notes: rotation.notes ?? undefined,
				})
				createdCount++
			}

			// Delete old rotation only after new ones are created successfully
			await deleteRotationInternal(rotationId, data.teamId)
			deletedCount++
		}

		return {
			success: true,
			data: { deletedCount, createdCount, unchangedCount },
		}
	})
