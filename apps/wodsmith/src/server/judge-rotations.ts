import "server-only"

import { and, eq, ne } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "@/db/schema"
import {
	type CompetitionJudgeRotation,
	competitionHeatsTable,
	competitionJudgeRotationsTable,
	competitionVenuesTable,
	competitionsTable,
	LANE_SHIFT_PATTERN,
	type LaneShiftPattern,
	trackWorkoutsTable,
} from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
// Import pure utility functions from shared module (can be used in client components)
import {
	calculateCoverage,
	expandRotationToAssignments,
} from "@/lib/judge-rotation-utils"
import { requireTeamPermission } from "@/utils/team-auth"

// Re-export pure utility functions and types from shared module
export {
	type CoverageGap,
	type CoverageOverlap,
	type CoverageStats,
	calculateCoverage,
	expandRotationToAssignments,
	type HeatInfo,
	type HeatLaneAssignment,
} from "@/lib/judge-rotation-utils"

type Db = DrizzleD1Database<typeof schema>

// ============================================================================
// Types
// ============================================================================

export interface CreateJudgeRotationParams {
	competitionId: string
	trackWorkoutId: string
	membershipId: string
	startingHeat: number
	startingLane: number
	heatsCount: number
	laneShiftPattern?: LaneShiftPattern
	notes?: string
	teamId: string // For permission check
}

export interface UpdateJudgeRotationParams {
	rotationId: string
	startingHeat?: number
	startingLane?: number
	heatsCount?: number
	laneShiftPattern?: LaneShiftPattern
	notes?: string
	teamId: string // For permission check
}

export interface UpdateEventRotationDefaultsParams {
	trackWorkoutId: string
	defaultHeatsCount?: number | null
	defaultLaneShiftPattern?: LaneShiftPattern | null
	teamId: string // For permission check
}

export interface RotationConflict {
	rotationId: string
	conflictType: "double_booking" | "invalid_lane" | "invalid_heat"
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

// ============================================================================
// 1. Create Judge Rotation
// ============================================================================

/**
 * Create a new judge rotation assignment.
 * If laneShiftPattern is not provided, inherits from event defaults or competition defaults.
 */
export async function createJudgeRotation(
	db: Db,
	params: CreateJudgeRotationParams,
): Promise<CompetitionJudgeRotation> {
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
			// Fall back to competition defaults via track
			const [track] = await db
				.select({
					competitionId: trackWorkoutsTable.trackId,
				})
				.from(trackWorkoutsTable)
				.where(eq(trackWorkoutsTable.id, params.trackWorkoutId))

			if (track?.competitionId) {
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

// ============================================================================
// 2. Update Judge Rotation
// ============================================================================

/**
 * Update an existing judge rotation.
 */
export async function updateJudgeRotation(
	db: Db,
	params: UpdateJudgeRotationParams,
): Promise<CompetitionJudgeRotation> {
	// Permission check
	await requireTeamPermission(
		params.teamId,
		TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
	)

	const updateData: Partial<CompetitionJudgeRotation> = {
		updatedAt: new Date(),
	}

	if (params.startingHeat !== undefined) {
		updateData.startingHeat = params.startingHeat
	}
	if (params.startingLane !== undefined) {
		updateData.startingLane = params.startingLane
	}
	if (params.heatsCount !== undefined) {
		updateData.heatsCount = params.heatsCount
	}
	if (params.laneShiftPattern !== undefined) {
		updateData.laneShiftPattern = params.laneShiftPattern
	}
	if (params.notes !== undefined) {
		updateData.notes = params.notes
	}

	const [updated] = await db
		.update(competitionJudgeRotationsTable)
		.set(updateData)
		.where(eq(competitionJudgeRotationsTable.id, params.rotationId))
		.returning()

	if (!updated) {
		throw new Error("Rotation not found or update failed")
	}

	return updated
}

// ============================================================================
// 3. Delete Judge Rotation
// ============================================================================

/**
 * Remove a judge rotation.
 */
export async function deleteJudgeRotation(
	db: Db,
	rotationId: string,
	teamId: string,
): Promise<void> {
	// Permission check
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_COMPETITIONS)

	await db
		.delete(competitionJudgeRotationsTable)
		.where(eq(competitionJudgeRotationsTable.id, rotationId))
}

// ============================================================================
// 4. Update Event Rotation Defaults
// ============================================================================

/**
 * Update default heats count and lane shift pattern for an event.
 * These defaults are used when creating new rotations for this event.
 */
export async function updateEventRotationDefaults(
	db: Db,
	params: UpdateEventRotationDefaultsParams,
): Promise<void> {
	// Permission check
	await requireTeamPermission(
		params.teamId,
		TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
	)

	const updateData: {
		defaultHeatsCount?: number | null
		defaultLaneShiftPattern?: string | null
		updatedAt: Date
	} = {
		updatedAt: new Date(),
	}

	if (params.defaultHeatsCount !== undefined) {
		updateData.defaultHeatsCount = params.defaultHeatsCount
	}
	if (params.defaultLaneShiftPattern !== undefined) {
		updateData.defaultLaneShiftPattern = params.defaultLaneShiftPattern
	}

	await db
		.update(trackWorkoutsTable)
		.set(updateData)
		.where(eq(trackWorkoutsTable.id, params.trackWorkoutId))
}

// ============================================================================
// 5. Get Rotations for Event
// ============================================================================

/**
 * Get all judge rotations for a specific event/workout.
 * Also returns the event's default heats count and lane shift pattern.
 */
export async function getRotationsForEvent(
	db: Db,
	trackWorkoutId: string,
): Promise<{
	rotations: CompetitionJudgeRotation[]
	eventDefaults: {
		defaultHeatsCount: number | null
		defaultLaneShiftPattern: LaneShiftPattern | null
	}
}> {
	const rotations = await db
		.select()
		.from(competitionJudgeRotationsTable)
		.where(eq(competitionJudgeRotationsTable.trackWorkoutId, trackWorkoutId))

	// Get event defaults from trackWorkout
	const [event] = await db
		.select({
			defaultHeatsCount: trackWorkoutsTable.defaultHeatsCount,
			defaultLaneShiftPattern: trackWorkoutsTable.defaultLaneShiftPattern,
		})
		.from(trackWorkoutsTable)
		.where(eq(trackWorkoutsTable.id, trackWorkoutId))

	return {
		rotations,
		eventDefaults: {
			defaultHeatsCount: event?.defaultHeatsCount ?? null,
			defaultLaneShiftPattern:
				(event?.defaultLaneShiftPattern as LaneShiftPattern) ?? null,
		},
	}
}

// ============================================================================
// 6. Get Rotations for Judge
// ============================================================================

/**
 * Get all rotations for a specific judge in a competition.
 */
export async function getRotationsForJudge(
	db: Db,
	membershipId: string,
	competitionId: string,
): Promise<CompetitionJudgeRotation[]> {
	const rotations = await db
		.select()
		.from(competitionJudgeRotationsTable)
		.where(
			and(
				eq(competitionJudgeRotationsTable.membershipId, membershipId),
				eq(competitionJudgeRotationsTable.competitionId, competitionId),
			),
		)

	return rotations
}

// ============================================================================
// 7. Validate Rotation Conflicts
// ============================================================================

/**
 * Check if a rotation creates conflicts (double-booking, invalid lanes).
 * Non-existent heats are NOT treated as conflicts - the rotation will simply
 * cover fewer heats than requested (truncated).
 *
 * @param db - Database instance
 * @param rotation - The rotation to validate (can be partial for updates)
 * @param options - Optional settings for validation
 * @param options.excludeAllForMembership - If true, excludes ALL existing rotations for this membershipId (for batch replace)
 * @returns ValidationResult with conflicts and effective heats count
 */
export async function validateRotationConflicts(
	db: Db,
	rotation: {
		id?: string // Include for update validation (to exclude self)
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

			case LANE_SHIFT_PATTERN.SHIFT_LEFT:
				laneNumber =
					((rotation.startingLane - 1 - i + heat.laneCount * 100) %
						heat.laneCount) +
					1
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

	// If no heats exist in the requested range, that's still an error
	if (effectiveHeatsCount === 0) {
		conflicts.push({
			rotationId: rotation.id ?? "new",
			conflictType: "invalid_heat",
			message: `Starting heat ${rotation.startingHeat} does not exist`,
			heatNumber: rotation.startingHeat,
		})
	}

	// Check for double-booking with existing rotations
	// Skip this check entirely if we're doing a batch replace for this membership
	// (all existing rotations for this member will be deleted anyway)
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

			// Check for overlapping assignments
			for (const current of currentAssignments) {
				for (const exist of existingAssignments) {
					if (
						current.heatNumber === exist.heatNumber &&
						current.laneNumber === exist.laneNumber
					) {
						conflicts.push({
							rotationId: existing.id,
							conflictType: "double_booking",
							message: `Judge is already assigned to heat ${current.heatNumber}, lane ${current.laneNumber}`,
							heatNumber: current.heatNumber,
							laneNumber: current.laneNumber,
						})
					}
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
