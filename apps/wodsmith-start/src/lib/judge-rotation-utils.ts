/**
 * Pure utility functions for judge rotation calculations.
 * These can be used in both server and client components.
 */

import type { CompetitionJudgeRotation } from "@/db/schema"
import { LANE_SHIFT_PATTERN } from "@/db/schema"
import type { VolunteerAvailability } from "@/db/schemas/volunteers"
import { VOLUNTEER_AVAILABILITY } from "@/db/schemas/volunteers"

// ============================================================================
// Types
// ============================================================================

export type AvailabilityFilter = VolunteerAvailability | "all"

export interface HeatLaneAssignment {
	heatNumber: number
	laneNumber: number
	membershipId: string
	rotationId: string
}

export interface CoverageGap {
	heatNumber: number
	laneNumber: number
}

export interface CoverageOverlap {
	heatNumber: number
	laneNumber: number
	judges: Array<{
		membershipId: string
		rotationId: string
	}>
}

export interface CoverageStats {
	totalSlots: number
	coveredSlots: number
	coveragePercent: number
	gaps: CoverageGap[]
	overlaps: CoverageOverlap[]
}

export interface HeatInfo {
	heatNumber: number
	laneCount: number
	/** When set, only these lanes have athletes and should be considered for lane shifting */
	occupiedLanes?: Set<number>
}

export interface ExpandOptions {
	/**
	 * When true and occupiedLanes is set, lane shifting will cycle through
	 * only occupied lanes instead of all lanes 1..laneCount
	 */
	respectOccupiedLanes?: boolean
}

// ============================================================================
// Expand Rotation to Assignments
// ============================================================================

/**
 * Convert a rotation pattern into virtual heat/lane assignments.
 * Does NOT create actual database records - returns the expanded schedule.
 *
 * @param rotation - The rotation configuration
 * @param heats - All heats for the event (with laneCount and optional occupiedLanes)
 * @param options - Optional settings for expansion behavior
 * @returns Array of virtual assignments
 */
export function expandRotationToAssignments(
	rotation: CompetitionJudgeRotation,
	heats: HeatInfo[],
	options?: ExpandOptions,
): HeatLaneAssignment[] {
	const assignments: HeatLaneAssignment[] = []
	const heatMap = new Map(heats.map((h) => [h.heatNumber, h]))
	const respectOccupiedLanes = options?.respectOccupiedLanes ?? false

	for (let i = 0; i < rotation.heatsCount; i++) {
		const heatNumber = rotation.startingHeat + i
		const heat = heatMap.get(heatNumber)

		if (!heat) {
			// Heat doesn't exist, skip
			continue
		}

		// Calculate lane based on shift pattern
		let laneNumber = rotation.startingLane

		switch (rotation.laneShiftPattern) {
			case LANE_SHIFT_PATTERN.STAY:
				laneNumber = rotation.startingLane
				break

			case LANE_SHIFT_PATTERN.SHIFT_RIGHT:
				laneNumber = ((rotation.startingLane - 1 + i) % heat.laneCount) + 1
				break
		}

		// If respecting occupied lanes and this lane has no athlete, skip this heat entirely
		if (respectOccupiedLanes && heat.occupiedLanes && heat.occupiedLanes.size > 0) {
			if (!heat.occupiedLanes.has(laneNumber)) {
				continue // Skip this heat - no athlete in the natural lane
			}
		}

		// Validate lane number
		if (laneNumber < 1 || laneNumber > heat.laneCount) {
			continue
		}

		assignments.push({
			heatNumber,
			laneNumber,
			membershipId: rotation.membershipId,
			rotationId: rotation.id,
		})
	}

	return assignments
}

// ============================================================================
// Calculate Coverage
// ============================================================================

/**
 * Calculate judge coverage statistics for an event.
 * Identifies gaps (uncovered slots) and overlaps (multiple judges on same slot).
 *
 * @param rotations - All rotations for the event
 * @param heats - All heats for the event (with laneCount)
 * @returns Coverage statistics
 */
export function calculateCoverage(
	rotations: CompetitionJudgeRotation[],
	heats: HeatInfo[],
): CoverageStats {
	// Build coverage grid: Map<"heat:lane", array of assignments>
	const coverageGrid = new Map<string, HeatLaneAssignment[]>()

	// Initialize grid with all heat/lane combinations
	let totalSlots = 0
	for (const heat of heats) {
		// If occupiedLanes is defined, only count those lanes
		// Otherwise, count all lanes (backward compatible)
		const lanesToCount = heat.occupiedLanes
			? Array.from(heat.occupiedLanes)
			: Array.from({length: heat.laneCount}, (_, i) => i + 1)

		for (const lane of lanesToCount) {
			const key = `${heat.heatNumber}:${lane}`
			coverageGrid.set(key, [])
			totalSlots++
		}
	}

	// Expand all rotations and populate grid
	for (const rotation of rotations) {
		const assignments = expandRotationToAssignments(rotation, heats)
		for (const assignment of assignments) {
			const key = `${assignment.heatNumber}:${assignment.laneNumber}`
			const existing = coverageGrid.get(key) || []
			existing.push(assignment)
			coverageGrid.set(key, existing)
		}
	}

	// Analyze coverage
	const gaps: CoverageGap[] = []
	const overlaps: CoverageOverlap[] = []
	let coveredSlots = 0

	for (const [key, assignments] of coverageGrid.entries()) {
		const [heatStr, laneStr] = key.split(":")
		const heatNumber = Number.parseInt(heatStr ?? "0", 10)
		const laneNumber = Number.parseInt(laneStr ?? "0", 10)

		if (assignments.length === 0) {
			// Gap: no judge assigned
			gaps.push({ heatNumber, laneNumber })
		} else if (assignments.length === 1) {
			// Perfect: exactly one judge
			coveredSlots++
		} else {
			// Overlap: multiple judges
			coveredSlots++ // Still covered, but problematic
			overlaps.push({
				heatNumber,
				laneNumber,
				judges: assignments.map((a) => ({
					membershipId: a.membershipId,
					rotationId: a.rotationId,
				})),
			})
		}
	}

	const coveragePercent =
		totalSlots > 0 ? Math.round((coveredSlots / totalSlots) * 100) : 0

	return {
		totalSlots,
		coveredSlots,
		coveragePercent,
		gaps,
		overlaps,
	}
}

// ============================================================================
// Filter Rotations by Availability
// ============================================================================

/**
 * Filter rotations by volunteer availability.
 * Pure function extracted from rotation-timeline.tsx for testability.
 *
 * Filter rules:
 * - 'all': shows all volunteers
 * - 'morning': shows volunteers with availability === 'morning' OR 'all_day'
 * - 'afternoon': shows volunteers with availability === 'afternoon' OR 'all_day'
 * - 'all_day': shows ONLY volunteers with availability === 'all_day'
 *
 * @param rotationsByVolunteer - Map of membershipId to their rotations
 * @param availabilityFilter - The selected availability filter
 * @param judgeAvailabilityMap - Map of membershipId to their availability
 * @returns Filtered map of volunteers and their rotations
 */
export function filterRotationsByAvailability(
	rotationsByVolunteer: Map<string, CompetitionJudgeRotation[]>,
	availabilityFilter: AvailabilityFilter,
	judgeAvailabilityMap: Map<string, VolunteerAvailability | undefined>,
): Map<string, CompetitionJudgeRotation[]> {
	// If 'all', return everything
	if (availabilityFilter === "all") {
		return rotationsByVolunteer
	}

	// Filter based on selected availability
	const filtered = new Map<string, CompetitionJudgeRotation[]>()

	for (const [membershipId, rotations] of rotationsByVolunteer.entries()) {
		const judgeAvailability = judgeAvailabilityMap.get(membershipId)

		// Filter logic:
		// - 'morning': show volunteers with availability === 'morning' OR availability === 'all_day'
		// - 'afternoon': show volunteers with availability === 'afternoon' OR availability === 'all_day'
		// - 'all_day': show only volunteers with availability === 'all_day'
		const shouldInclude =
			availabilityFilter === VOLUNTEER_AVAILABILITY.ALL_DAY
				? judgeAvailability === VOLUNTEER_AVAILABILITY.ALL_DAY
				: judgeAvailability === availabilityFilter ||
					judgeAvailability === VOLUNTEER_AVAILABILITY.ALL_DAY

		if (shouldInclude) {
			filtered.set(membershipId, rotations)
		}
	}

	return filtered
}
