import { describe, expect, it } from "vitest"
import { getRelevantWorkoutIds } from "@/server/competition-leaderboard"

const DIVISION_RX = "div-rx"
const DIVISION_SCALED = "div-scaled"

const WORKOUT_FRAN = "tw-fran"
const WORKOUT_GRACE = "tw-grace"
const WORKOUT_DIANE = "tw-diane"

describe("getRelevantWorkoutIds", () => {
	it("returns null when no heats exist (backward compat)", () => {
		const result = getRelevantWorkoutIds({
			heats: [],
			mixedHeatAssignments: [],
			divisionId: DIVISION_RX,
		})

		expect(result).toBeNull()
	})

	describe("division-specific heats", () => {
		it("includes workouts with heats for the selected division", () => {
			const result = getRelevantWorkoutIds({
				heats: [
					{ id: "h1", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_RX },
					{ id: "h2", trackWorkoutId: WORKOUT_GRACE, divisionId: DIVISION_RX },
				],
				mixedHeatAssignments: [],
				divisionId: DIVISION_RX,
			})

			expect(result).toEqual(new Set([WORKOUT_FRAN, WORKOUT_GRACE]))
		})

		it("excludes workouts with heats only for other divisions", () => {
			const result = getRelevantWorkoutIds({
				heats: [
					{ id: "h1", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_RX },
					{ id: "h2", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_SCALED },
					{ id: "h3", trackWorkoutId: WORKOUT_GRACE, divisionId: DIVISION_RX },
				],
				mixedHeatAssignments: [],
				divisionId: DIVISION_SCALED,
			})

			// Scaled only has heats for Fran, not Grace
			expect(result).toEqual(new Set([WORKOUT_FRAN]))
		})

		it("returns empty set when no heats match the division", () => {
			const result = getRelevantWorkoutIds({
				heats: [
					{ id: "h1", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_RX },
					{ id: "h2", trackWorkoutId: WORKOUT_GRACE, divisionId: DIVISION_RX },
				],
				mixedHeatAssignments: [],
				divisionId: DIVISION_SCALED,
			})

			expect(result?.size).toBe(0)
		})
	})

	describe("mixed heats (divisionId=null)", () => {
		it("includes workout when mixed heat has assignment from selected division", () => {
			const result = getRelevantWorkoutIds({
				heats: [
					{ id: "h1", trackWorkoutId: WORKOUT_FRAN, divisionId: null },
				],
				mixedHeatAssignments: [
					{ heatId: "h1", divisionId: DIVISION_RX },
					{ heatId: "h1", divisionId: DIVISION_SCALED },
				],
				divisionId: DIVISION_SCALED,
			})

			expect(result).toEqual(new Set([WORKOUT_FRAN]))
		})

		it("excludes workout when mixed heat has no assignments from selected division", () => {
			const result = getRelevantWorkoutIds({
				heats: [
					{ id: "h1", trackWorkoutId: WORKOUT_FRAN, divisionId: null },
					{ id: "h2", trackWorkoutId: WORKOUT_GRACE, divisionId: null },
				],
				mixedHeatAssignments: [
					{ heatId: "h1", divisionId: DIVISION_RX },
					{ heatId: "h2", divisionId: DIVISION_RX },
				],
				divisionId: DIVISION_SCALED,
			})

			// Neither workout has Scaled athletes assigned
			expect(result?.size).toBe(0)
		})

		it("includes workout when mixed heat has no assignments at all", () => {
			const result = getRelevantWorkoutIds({
				heats: [
					{ id: "h1", trackWorkoutId: WORKOUT_FRAN, divisionId: null },
				],
				mixedHeatAssignments: [],
				divisionId: DIVISION_SCALED,
			})

			// No assignments = can't confirm division participates
			expect(result?.size).toBe(0)
		})
	})

	describe("mixed division-specific and mixed heats", () => {
		it("combines both division-specific and mixed heat matches", () => {
			const result = getRelevantWorkoutIds({
				heats: [
					// Fran: division-specific for RX
					{ id: "h1", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_RX },
					// Grace: mixed heat
					{ id: "h2", trackWorkoutId: WORKOUT_GRACE, divisionId: null },
					// Diane: division-specific for Scaled
					{ id: "h3", trackWorkoutId: WORKOUT_DIANE, divisionId: DIVISION_SCALED },
				],
				mixedHeatAssignments: [
					// Grace mixed heat has RX athletes
					{ heatId: "h2", divisionId: DIVISION_RX },
				],
				divisionId: DIVISION_RX,
			})

			// RX gets Fran (division-specific) and Grace (mixed with RX assignments)
			// Diane is Scaled-only
			expect(result).toEqual(new Set([WORKOUT_FRAN, WORKOUT_GRACE]))
		})

		it("real scenario: Scaled division should not see RX-only workouts", () => {
			// Winter Throwdown scenario: Fran for both, Grace only for RX
			const result = getRelevantWorkoutIds({
				heats: [
					// Fran heats for both divisions
					{ id: "h1", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_RX },
					{ id: "h2", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_SCALED },
					// Grace heats only for RX
					{ id: "h3", trackWorkoutId: WORKOUT_GRACE, divisionId: DIVISION_RX },
				],
				mixedHeatAssignments: [],
				divisionId: DIVISION_SCALED,
			})

			expect(result).toEqual(new Set([WORKOUT_FRAN]))
			expect(result?.has(WORKOUT_GRACE)).toBe(false)
		})
	})

	describe("multiple heats per workout", () => {
		it("handles multiple heats for same workout across divisions", () => {
			const result = getRelevantWorkoutIds({
				heats: [
					{ id: "h1", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_RX },
					{ id: "h2", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_RX },
					{ id: "h3", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_SCALED },
					{ id: "h4", trackWorkoutId: WORKOUT_GRACE, divisionId: DIVISION_RX },
					{ id: "h5", trackWorkoutId: WORKOUT_GRACE, divisionId: DIVISION_RX },
				],
				mixedHeatAssignments: [],
				divisionId: DIVISION_SCALED,
			})

			// Scaled only has heats for Fran
			expect(result).toEqual(new Set([WORKOUT_FRAN]))
		})

		it("deduplicates workout IDs from multiple matching heats", () => {
			const result = getRelevantWorkoutIds({
				heats: [
					{ id: "h1", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_RX },
					{ id: "h2", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_RX },
					{ id: "h3", trackWorkoutId: WORKOUT_FRAN, divisionId: DIVISION_RX },
				],
				mixedHeatAssignments: [],
				divisionId: DIVISION_RX,
			})

			expect(result).toEqual(new Set([WORKOUT_FRAN]))
			expect(result?.size).toBe(1)
		})
	})
})
