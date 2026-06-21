import { describe, expect, it } from "vitest"
import {
	benchmarkCategoriesSchema,
	benchmarkVariantSchema,
	getBenchmarkCategoryCountIssues,
	benchmarkRatingBandsSchema,
	benchmarkThresholdValuesSchema,
	benchmarkVideoPolicySchema,
} from "@/schemas/benchmark.schema"

describe("Benchmark schema", () => {
	it("accepts categories with validated test counts and default weights", () => {
		const result = benchmarkCategoriesSchema.safeParse([
			{ key: "strength", label: "Strength", testCount: 12 },
			{ key: "gymnastics", label: "Gymnastics", testCount: 15, weight: 2 },
		])

		expect(result.success).toBe(true)
		expect(result.data?.[0]?.weight).toBe(1)
		expect(result.data?.[1]?.testCount).toBe(15)
	})

	it("rejects duplicate category keys", () => {
		const result = benchmarkCategoriesSchema.safeParse([
			{ key: "strength", label: "Strength", testCount: 12 },
			{ key: "strength", label: "Strength Again", testCount: 3 },
		])

		expect(result.success).toBe(false)
	})

	it("rejects malformed category cache values", () => {
		const result = benchmarkCategoriesSchema.safeParse([
			{ key: "Upper Body", label: "Upper Body", testCount: -1 },
		])

		expect(result.success).toBe(false)
	})

	it("accepts only profile-gender variants for v1 scoring", () => {
		expect(benchmarkVariantSchema.safeParse("male").success).toBe(true)
		expect(benchmarkVariantSchema.safeParse("female").success).toBe(true)
		expect(benchmarkVariantSchema.safeParse("masters").success).toBe(false)
	})

	it("validates cached category counts against included tests", () => {
		const categories = benchmarkCategoriesSchema.parse([
			{ key: "strength", label: "Strength", testCount: 2 },
			{ key: "engine", label: "Engine", testCount: 1 },
		])

		expect(
			getBenchmarkCategoryCountIssues(categories, [
				{ categoryKey: "strength", includedInScoring: true },
				{ categoryKey: "strength", includedInScoring: true },
				{ categoryKey: "engine", includedInScoring: true },
				{ categoryKey: "engine", includedInScoring: false },
			]),
		).toEqual([])
	})

	it("reports stale category counts and unknown included-test categories", () => {
		const categories = benchmarkCategoriesSchema.parse([
			{ key: "strength", label: "Strength", testCount: 2 },
		])

		expect(
			getBenchmarkCategoryCountIssues(categories, [
				{ categoryKey: "strength", includedInScoring: true },
				{ categoryKey: "engine", includedInScoring: true },
			]),
		).toEqual([
			"Category strength declares testCount 2 but has 1 included tests",
			"Included test references unknown category engine",
		])
	})

	it("requires ten threshold values for a standard tier table", () => {
		expect(
			benchmarkThresholdValuesSchema.safeParse([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
				.success,
		).toBe(true)
		expect(benchmarkThresholdValuesSchema.safeParse([1, 2, 3]).success).toBe(
			false,
		)
	})

	it("accepts benchmark video policies", () => {
		expect(benchmarkVideoPolicySchema.safeParse("never").success).toBe(true)
		expect(benchmarkVideoPolicySchema.safeParse("for_top_scores").success).toBe(
			true,
		)
		expect(benchmarkVideoPolicySchema.safeParse("sometimes").success).toBe(false)
	})

	it("rejects rating bands with inverted score ranges", () => {
		const result = benchmarkRatingBandsSchema.safeParse([
			{ key: "advanced", label: "Advanced", minScore: 80, maxScore: 70 },
		])

		expect(result.success).toBe(false)
	})
})
