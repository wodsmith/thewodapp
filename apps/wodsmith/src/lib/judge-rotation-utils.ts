/**
 * Pure utility functions for judge rotation calculations.
 * These can be used in both server and client components.
 */

import type { CompetitionJudgeRotation } from "@/db/schema"
import { LANE_SHIFT_PATTERN } from "@/db/schema"

// ============================================================================
// Types
// ============================================================================

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
}

// ============================================================================
// Expand Rotation to Assignments
// ============================================================================

/**
 * Convert a rotation pattern into virtual heat/lane assignments.
 * Does NOT create actual database records - returns the expanded schedule.
 *
 * @param rotation - The rotation configuration
 * @param heats - All heats for the event (with laneCount)
 * @returns Array of virtual assignments
 */
export function expandRotationToAssignments(
	rotation: CompetitionJudgeRotation,
	heats: HeatInfo[],
): HeatLaneAssignment[] {
	const assignments: HeatLaneAssignment[] = []
	const heatMap = new Map(heats.map((h) => [h.heatNumber, h]))

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
		for (let lane = 1; lane <= heat.laneCount; lane++) {
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
