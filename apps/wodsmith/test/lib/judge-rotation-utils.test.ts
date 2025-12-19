import { describe, expect, it } from "vitest"
import {
	calculateCoverage,
	expandRotationToAssignments,
	type HeatInfo,
} from "@/lib/judge-rotation-utils"
import type { CompetitionJudgeRotation } from "@/db/schema"
import { LANE_SHIFT_PATTERN } from "@/db/schema"

// Factory to create test rotations
function createRotation(
	overrides: Partial<CompetitionJudgeRotation> = {},
): CompetitionJudgeRotation {
	return {
		id: "rot-1",
		competitionId: "comp-1",
		trackWorkoutId: "tw-1",
		membershipId: "mem-1",
		startingHeat: 1,
		startingLane: 1,
		heatsCount: 3,
		laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
		notes: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		updateCounter: null,
		...overrides,
	}
}

// Standard heats for testing
function createHeats(count: number, laneCount = 5): HeatInfo[] {
	return Array.from({ length: count }, (_, i) => ({
		heatNumber: i + 1,
		laneCount,
	}))
}

describe("expandRotationToAssignments", () => {
	describe("basic expansion", () => {
		it("expands a rotation to heat/lane assignments", () => {
			const rotation = createRotation({
				startingHeat: 1,
				startingLane: 3,
				heatsCount: 3,
				laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
			})
			const heats = createHeats(5)

			const assignments = expandRotationToAssignments(rotation, heats)

			expect(assignments).toHaveLength(3)
			expect(assignments).toEqual([
				{ heatNumber: 1, laneNumber: 3, membershipId: "mem-1", rotationId: "rot-1" },
				{ heatNumber: 2, laneNumber: 3, membershipId: "mem-1", rotationId: "rot-1" },
				{ heatNumber: 3, laneNumber: 3, membershipId: "mem-1", rotationId: "rot-1" },
			])
		})

		it("returns empty array when no heats match", () => {
			const rotation = createRotation({
				startingHeat: 10, // Beyond available heats
				heatsCount: 3,
			})
			const heats = createHeats(5)

			const assignments = expandRotationToAssignments(rotation, heats)

			expect(assignments).toHaveLength(0)
		})

		it("skips non-existent heats", () => {
			const rotation = createRotation({
				startingHeat: 4,
				heatsCount: 5, // Would need heats 4-8
			})
			const heats = createHeats(5) // Only heats 1-5 exist

			const assignments = expandRotationToAssignments(rotation, heats)

			expect(assignments).toHaveLength(2) // Only heats 4 and 5
			expect(assignments[0]?.heatNumber).toBe(4)
			expect(assignments[1]?.heatNumber).toBe(5)
		})
	})

	describe("STAY lane shift pattern", () => {
		it("keeps the same lane for all heats", () => {
			const rotation = createRotation({
				startingLane: 2,
				heatsCount: 4,
				laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
			})
			const heats = createHeats(5)

			const assignments = expandRotationToAssignments(rotation, heats)

			expect(assignments.every((a) => a.laneNumber === 2)).toBe(true)
		})
	})

	describe("SHIFT_RIGHT lane shift pattern", () => {
		it("shifts lane right each heat", () => {
			const rotation = createRotation({
				startingHeat: 1,
				startingLane: 1,
				heatsCount: 3,
				laneShiftPattern: LANE_SHIFT_PATTERN.SHIFT_RIGHT,
			})
			const heats = createHeats(5)

			const assignments = expandRotationToAssignments(rotation, heats)

			expect(assignments).toEqual([
				{ heatNumber: 1, laneNumber: 1, membershipId: "mem-1", rotationId: "rot-1" },
				{ heatNumber: 2, laneNumber: 2, membershipId: "mem-1", rotationId: "rot-1" },
				{ heatNumber: 3, laneNumber: 3, membershipId: "mem-1", rotationId: "rot-1" },
			])
		})

		it("wraps lane number around when exceeding lane count", () => {
			const rotation = createRotation({
				startingHeat: 1,
				startingLane: 4,
				heatsCount: 4,
				laneShiftPattern: LANE_SHIFT_PATTERN.SHIFT_RIGHT,
			})
			const heats = createHeats(5, 5) // 5 lanes

			const assignments = expandRotationToAssignments(rotation, heats)

			expect(assignments.map((a) => a.laneNumber)).toEqual([4, 5, 1, 2])
		})

		it("handles wrap-around starting from lane 5 of 5", () => {
			const rotation = createRotation({
				startingHeat: 1,
				startingLane: 5,
				heatsCount: 3,
				laneShiftPattern: LANE_SHIFT_PATTERN.SHIFT_RIGHT,
			})
			const heats = createHeats(5, 5)

			const assignments = expandRotationToAssignments(rotation, heats)

			expect(assignments.map((a) => a.laneNumber)).toEqual([5, 1, 2])
		})
	})

	describe("edge cases", () => {
		it("handles single heat rotation", () => {
			const rotation = createRotation({
				startingHeat: 3,
				startingLane: 2,
				heatsCount: 1,
			})
			const heats = createHeats(5)

			const assignments = expandRotationToAssignments(rotation, heats)

			expect(assignments).toHaveLength(1)
			expect(assignments[0]).toEqual({
				heatNumber: 3,
				laneNumber: 2,
				membershipId: "mem-1",
				rotationId: "rot-1",
			})
		})

		it("handles empty heats array", () => {
			const rotation = createRotation()

			const assignments = expandRotationToAssignments(rotation, [])

			expect(assignments).toHaveLength(0)
		})

		it("handles non-consecutive heats", () => {
			const rotation = createRotation({
				startingHeat: 2,
				heatsCount: 4,
			})
			// Gaps in heat numbers (1, 3, 5 only)
			const heats: HeatInfo[] = [
				{ heatNumber: 1, laneCount: 5 },
				{ heatNumber: 3, laneCount: 5 },
				{ heatNumber: 5, laneCount: 5 },
			]

			const assignments = expandRotationToAssignments(rotation, heats)

			// Heats 2 and 4 don't exist, only heat 3 and 5 match
			expect(assignments).toHaveLength(2)
			expect(assignments.map((a) => a.heatNumber)).toEqual([3, 5])
		})

		it("skips lanes beyond heat lane count", () => {
			const rotation = createRotation({
				startingHeat: 1,
				startingLane: 8, // Beyond lane count
				heatsCount: 2,
			})
			const heats = createHeats(5, 5) // Only 5 lanes

			const assignments = expandRotationToAssignments(rotation, heats)

			expect(assignments).toHaveLength(0) // All assignments invalid
		})
	})
})

describe("calculateCoverage", () => {
	describe("basic coverage", () => {
		it("calculates 100% coverage when all slots are filled", () => {
			// 3 heats, 2 lanes each = 6 total slots
			// 2 judges covering 3 heats each on different lanes = 6 slots covered
			const heats = createHeats(3, 2)
			const rotations = [
				createRotation({
					id: "rot-1",
					membershipId: "judge-1",
					startingHeat: 1,
					startingLane: 1,
					heatsCount: 3,
					laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
				}),
				createRotation({
					id: "rot-2",
					membershipId: "judge-2",
					startingHeat: 1,
					startingLane: 2,
					heatsCount: 3,
					laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
				}),
			]

			const stats = calculateCoverage(rotations, heats)

			expect(stats.totalSlots).toBe(6)
			expect(stats.coveredSlots).toBe(6)
			expect(stats.coveragePercent).toBe(100)
			expect(stats.gaps).toHaveLength(0)
			expect(stats.overlaps).toHaveLength(0)
		})

		it("identifies gaps in coverage", () => {
			// 3 heats, 2 lanes each = 6 slots
			// 1 judge covering lane 1 only = 3 slots covered
			const heats = createHeats(3, 2)
			const rotations = [
				createRotation({
					startingLane: 1,
					heatsCount: 3,
					laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
				}),
			]

			const stats = calculateCoverage(rotations, heats)

			expect(stats.totalSlots).toBe(6)
			expect(stats.coveredSlots).toBe(3)
			expect(stats.coveragePercent).toBe(50)
			expect(stats.gaps).toHaveLength(3)
			// Gaps are heat 1 lane 2, heat 2 lane 2, heat 3 lane 2
			expect(stats.gaps).toEqual(
				expect.arrayContaining([
					{ heatNumber: 1, laneNumber: 2 },
					{ heatNumber: 2, laneNumber: 2 },
					{ heatNumber: 3, laneNumber: 2 },
				]),
			)
		})

		it("identifies overlaps (double coverage)", () => {
			// 2 judges on same lane
			const heats = createHeats(2, 3)
			const rotations = [
				createRotation({
					id: "rot-1",
					membershipId: "judge-1",
					startingLane: 1,
					heatsCount: 2,
				}),
				createRotation({
					id: "rot-2",
					membershipId: "judge-2",
					startingLane: 1, // Same lane!
					heatsCount: 2,
				}),
			]

			const stats = calculateCoverage(rotations, heats)

			expect(stats.overlaps).toHaveLength(2)
			expect(stats.overlaps[0]).toEqual({
				heatNumber: 1,
				laneNumber: 1,
				judges: [
					{ membershipId: "judge-1", rotationId: "rot-1" },
					{ membershipId: "judge-2", rotationId: "rot-2" },
				],
			})
			// Overlaps still count as covered
			expect(stats.coveredSlots).toBe(2)
		})
	})

	describe("empty cases", () => {
		it("returns 0% coverage with no rotations", () => {
			const heats = createHeats(3, 2)

			const stats = calculateCoverage([], heats)

			expect(stats.totalSlots).toBe(6)
			expect(stats.coveredSlots).toBe(0)
			expect(stats.coveragePercent).toBe(0)
			expect(stats.gaps).toHaveLength(6)
		})

		it("handles empty heats array", () => {
			const rotations = [createRotation()]

			const stats = calculateCoverage(rotations, [])

			expect(stats.totalSlots).toBe(0)
			expect(stats.coveredSlots).toBe(0)
			expect(stats.coveragePercent).toBe(0)
			expect(stats.gaps).toHaveLength(0)
		})
	})

	describe("complex scenarios", () => {
		it("handles mixed STAY and SHIFT_RIGHT patterns", () => {
			const heats = createHeats(3, 3)
			const rotations = [
				createRotation({
					id: "rot-1",
					membershipId: "judge-1",
					startingLane: 1,
					heatsCount: 3,
					laneShiftPattern: LANE_SHIFT_PATTERN.SHIFT_RIGHT, // 1, 2, 3
				}),
				createRotation({
					id: "rot-2",
					membershipId: "judge-2",
					startingLane: 2,
					heatsCount: 3,
					laneShiftPattern: LANE_SHIFT_PATTERN.STAY, // 2, 2, 2
				}),
			]

			const stats = calculateCoverage(rotations, heats)

			// Judge 1: H1L1, H2L2, H3L3
			// Judge 2: H1L2, H2L2, H3L2
			// Overlap at H2L2
			expect(stats.overlaps).toHaveLength(1)
			expect(stats.overlaps[0]?.heatNumber).toBe(2)
			expect(stats.overlaps[0]?.laneNumber).toBe(2)

			// Total: 9 slots, covered: H1L1, H1L2, H2L2, H3L2, H3L3 = 5 unique
			expect(stats.coveredSlots).toBe(5)
		})

		it("calculates correct percentage for partial coverage", () => {
			const heats = createHeats(4, 4) // 16 slots
			const rotations = [
				createRotation({
					startingHeat: 1,
					startingLane: 1,
					heatsCount: 4, // 4 slots
				}),
			]

			const stats = calculateCoverage(rotations, heats)

			expect(stats.totalSlots).toBe(16)
			expect(stats.coveredSlots).toBe(4)
			expect(stats.coveragePercent).toBe(25)
		})

		it("handles varying lane counts per heat", () => {
			// Different venues with different lane counts
			const heats: HeatInfo[] = [
				{ heatNumber: 1, laneCount: 3 },
				{ heatNumber: 2, laneCount: 5 },
				{ heatNumber: 3, laneCount: 4 },
			]
			// Total slots: 3 + 5 + 4 = 12

			const rotations = [
				createRotation({
					id: "rot-1",
					membershipId: "judge-1",
					startingHeat: 1,
					startingLane: 1,
					heatsCount: 3,
					laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
				}),
			]

			const stats = calculateCoverage(rotations, heats)

			expect(stats.totalSlots).toBe(12)
			expect(stats.coveredSlots).toBe(3) // One slot per heat
			expect(stats.gaps).toHaveLength(9) // 2 + 4 + 3 gaps
		})

		it("detects triple overlaps", () => {
			const heats = createHeats(1, 2)
			const rotations = [
				createRotation({
					id: "rot-1",
					membershipId: "judge-1",
					startingLane: 1,
					heatsCount: 1,
				}),
				createRotation({
					id: "rot-2",
					membershipId: "judge-2",
					startingLane: 1,
					heatsCount: 1,
				}),
				createRotation({
					id: "rot-3",
					membershipId: "judge-3",
					startingLane: 1,
					heatsCount: 1,
				}),
			]

			const stats = calculateCoverage(rotations, heats)

			expect(stats.overlaps).toHaveLength(1)
			expect(stats.overlaps[0]?.judges).toHaveLength(3)
			expect(stats.coveredSlots).toBe(1) // Still only 1 slot covered
		})

		it("rounds coverage percentage correctly", () => {
			// 3 heats, 3 lanes = 9 slots, cover 2 = 22.22% -> 22%
			const heats = createHeats(3, 3)
			const rotations = [
				createRotation({
					startingHeat: 1,
					startingLane: 1,
					heatsCount: 2,
				}),
			]

			const stats = calculateCoverage(rotations, heats)

			expect(stats.coveragePercent).toBe(22) // Rounded from 22.22
		})
	})
})

describe("expandRotationToAssignments with varying lane counts", () => {
	it("respects different lane counts per heat with SHIFT_RIGHT", () => {
		const rotation = createRotation({
			startingHeat: 1,
			startingLane: 2,
			heatsCount: 3,
			laneShiftPattern: LANE_SHIFT_PATTERN.SHIFT_RIGHT,
		})
		// Heat 1 has 3 lanes, heat 2 has 5 lanes, heat 3 has 2 lanes
		const heats: HeatInfo[] = [
			{ heatNumber: 1, laneCount: 3 },
			{ heatNumber: 2, laneCount: 5 },
			{ heatNumber: 3, laneCount: 2 },
		]

		const assignments = expandRotationToAssignments(rotation, heats)

		// Heat 1: lane ((2-1+0) % 3) + 1 = (1 % 3) + 1 = 2
		// Heat 2: lane ((2-1+1) % 5) + 1 = (2 % 5) + 1 = 3
		// Heat 3: lane ((2-1+2) % 2) + 1 = (3 % 2) + 1 = 2
		expect(assignments.map((a) => a.laneNumber)).toEqual([2, 3, 2])
	})

	it("skips assignment when lane exceeds heat lane count with STAY", () => {
		const rotation = createRotation({
			startingHeat: 1,
			startingLane: 4,
			heatsCount: 3,
			laneShiftPattern: LANE_SHIFT_PATTERN.STAY,
		})
		const heats: HeatInfo[] = [
			{ heatNumber: 1, laneCount: 5 }, // Lane 4 valid
			{ heatNumber: 2, laneCount: 3 }, // Lane 4 invalid
			{ heatNumber: 3, laneCount: 6 }, // Lane 4 valid
		]

		const assignments = expandRotationToAssignments(rotation, heats)

		// Only heats 1 and 3 should have assignments
		expect(assignments).toHaveLength(2)
		expect(assignments.map((a) => a.heatNumber)).toEqual([1, 3])
	})
})
