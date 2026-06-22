import { describe, expect, it } from "vitest"
import {
	benchmarkCategoriesSchema,
	benchmarkRatingBandsSchema,
	getBenchmarkCategoryCountIssues,
} from "@/schemas/benchmark.schema"
import { scoringConfigSchema } from "@/schemas/scoring.schema"
import {
	BENCHMARK_CATEGORIES,
	BENCHMARK_SEED_IDS,
	BENCHMARK_SEED_TESTS,
	BENCHMARK_SOURCE_RECEIPT,
	buildBenchmarkSeedRows,
} from "../../scripts/seed/data/benchmark-training-guide"

const TEST_TS = "2026-01-01 00:00:00"

describe("benchmark seed data", () => {
	it("records the PDF provenance and v1 included/deferred split", () => {
		expect(BENCHMARK_SOURCE_RECEIPT.sourceArtifact.sha256).toBe(
			"a80c7ab33874ff4fb8a4eea6a044df83511d164e55588a94ec455145a8f3cc38",
		)
		expect(BENCHMARK_SOURCE_RECEIPT.designedTestCount).toBe(58)
		expect(BENCHMARK_SOURCE_RECEIPT.includedTestCount).toBe(55)
		expect(BENCHMARK_SOURCE_RECEIPT.deferredTestCount).toBe(3)

		const included = BENCHMARK_SEED_TESTS.filter(
			(test) => test.includedInScoring,
		)
		const deferred = BENCHMARK_SEED_TESTS.filter(
			(test) => !test.includedInScoring,
		)

		expect(BENCHMARK_SEED_TESTS).toHaveLength(58)
		expect(included).toHaveLength(55)
		expect(deferred.map((test) => test.name)).toEqual([
			"Weighted C2B Pull Up (lb)",
			"Open 16.2 (time/reps)",
			"Open 18.4 (reps/time)",
		])
		expect(deferred.every((test) => test.deferReason)).toBe(true)
	})

	it("keeps category counts derived from included tests", () => {
		const categories = benchmarkCategoriesSchema.parse(BENCHMARK_CATEGORIES)

		expect(categories.map(({ key, testCount }) => [key, testCount])).toEqual([
			["strength", 15],
			["gymnastics", 13],
			["engine", 14],
			["benchmark_workout", 13],
		])
		expect(
			getBenchmarkCategoryCountIssues(categories, BENCHMARK_SEED_TESTS),
		).toEqual([])
	})

	it("pre-encodes ten male and female thresholds for every included test only", () => {
		const rows = buildBenchmarkSeedRows(TEST_TS)
		const includedIds = new Set(
			BENCHMARK_SEED_TESTS.filter((test) => test.includedInScoring).map(
				(test) => test.id,
			),
		)
		const deferredIds = new Set(
			BENCHMARK_SEED_TESTS.filter((test) => !test.includedInScoring).map(
				(test) => test.id,
			),
		)

		expect(rows.benchmarkTierThresholds).toHaveLength(55 * 2 * 10)

		for (const testId of includedIds) {
			for (const variant of ["male", "female"]) {
				expect(
					rows.benchmarkTierThresholds.filter(
						(row) => row.test_id === testId && row.variant === variant,
					),
				).toHaveLength(10)
			}
		}

		expect(
			rows.benchmarkTierThresholds.some((row) => deferredIds.has(row.test_id)),
		).toBe(false)
		expect(
			rows.benchmarkTierThresholds.find(
				(row) =>
					row.test_id === "btst_training_guide_strict_press" &&
					row.variant === "male" &&
					row.tier === 1,
			)?.threshold_value,
		).toBe(52163)
		expect(
			rows.benchmarkTierThresholds.find(
				(row) =>
					row.test_id === "btst_training_guide_vertical_jump_in" &&
					row.variant === "male" &&
					row.tier === 1,
			)?.threshold_value,
		).toBe(508)
	})

	it("builds a generic benchmark competition without submission-window rows", () => {
		const rows = buildBenchmarkSeedRows(TEST_TS)
		const [competition] = rows.competitions
		const [battery] = rows.benchmarkBatteries
		const settings = JSON.parse(competition.settings)

		expect(competition.competition_type).toBe("benchmark")
		expect(settings.boardMode).toBe("perpetual")
		expect(settings.divisions.scalingGroupId).toBe(
			BENCHMARK_SEED_IDS.scalingGroupId,
		)
		expect(scoringConfigSchema.safeParse(settings.scoringConfig).success).toBe(
			true,
		)
		expect(rows.scalingLevels).toEqual([
			expect.objectContaining({ label: "Open", team_size: 1 }),
		])
		expect(rows.trackWorkouts).toHaveLength(58)
		expect(rows.trackWorkouts.every((row) => row.benchmark_test_id)).toBe(true)
		expect(rows.competitionEvents).toEqual([])
		expect(battery.video_policy).toBe("never")
		expect(battery.is_open_join).toBe(false)
	})

	it("validates battery JSON blobs and keeps seeded product strings unbranded", () => {
		const rows = buildBenchmarkSeedRows(TEST_TS)
		const [battery] = rows.benchmarkBatteries

		expect(benchmarkCategoriesSchema.safeParse(JSON.parse(battery.categories)).success)
			.toBe(true)
		expect(
			benchmarkRatingBandsSchema.safeParse(JSON.parse(battery.rating_bands))
				.success,
		).toBe(true)

		const productRows = {
			teams: rows.teams,
			competitions: rows.competitions,
			programmingTracks: rows.programmingTracks,
			workouts: rows.workouts,
			trackWorkouts: rows.trackWorkouts,
			benchmarkBatteries: rows.benchmarkBatteries,
		}

		expect(JSON.stringify(productRows)).not.toMatch(/hillerfit/i)
	})
})
