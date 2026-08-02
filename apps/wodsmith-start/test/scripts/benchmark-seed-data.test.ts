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
	buildBenchmarkAthleteSeedRows,
	buildBenchmarkSeedRows,
} from "../../scripts/seed/data/benchmark-training-guide"

const TEST_TS = "2026-01-01 00:00:00"

describe("benchmark seed data", () => {
	it("records the PDF provenance with every test included for scoring", () => {
		expect(BENCHMARK_SOURCE_RECEIPT.sourceArtifact.sha256).toBe(
			"a80c7ab33874ff4fb8a4eea6a044df83511d164e55588a94ec455145a8f3cc38",
		)
		expect(BENCHMARK_SOURCE_RECEIPT.designedTestCount).toBe(58)
		expect(BENCHMARK_SOURCE_RECEIPT.includedTestCount).toBe(58)
		expect(BENCHMARK_SOURCE_RECEIPT.deferredTestCount).toBe(0)

		const included = BENCHMARK_SEED_TESTS.filter(
			(test) => test.includedInScoring,
		)

		expect(BENCHMARK_SEED_TESTS).toHaveLength(58)
		expect(included).toHaveLength(58)
		expect(BENCHMARK_SEED_TESTS.every((test) => test.deferReason === null)).toBe(
			true,
		)
	})

	it("includes both hybrid reps/time tests with a time cap", () => {
		const hybrids = BENCHMARK_SEED_TESTS.filter(
			(test) => test.scoreModel === "hybrid",
		)

		expect(hybrids.map((test) => test.name)).toEqual([
			"Open 16.2 (time/reps)",
			"Open 18.4 (reps/time)",
		])
		expect(hybrids.every((test) => test.includedInScoring)).toBe(true)

		const openSixteenTwo = hybrids.find((t) => t.name === "Open 16.2 (time/reps)")
		const openEighteenFour = hybrids.find((t) => t.name === "Open 18.4 (reps/time)")
		expect(openSixteenTwo?.hybridFlipTier).toBe(9)
		expect(openSixteenTwo?.timeCapSeconds).toBe(1200)
		expect(openEighteenFour?.hybridFlipTier).toBe(7)
		expect(openEighteenFour?.timeCapSeconds).toBe(540)
	})

	it("stores the hybrid time cap in milliseconds on the benchmark test rows", () => {
		const rows = buildBenchmarkSeedRows(TEST_TS)
		const openSixteenTwo = rows.benchmarkTests.find(
			(row) => row.name === "Open 16.2 (time/reps)",
		)
		const openEighteenFour = rows.benchmarkTests.find(
			(row) => row.name === "Open 18.4 (reps/time)",
		)
		const strictPress = rows.benchmarkTests.find(
			(row) => row.name === "Strict Press",
		)

		expect(openSixteenTwo?.time_cap_ms).toBe(1_200_000)
		expect(openSixteenTwo?.score_model).toBe("hybrid")
		expect(openSixteenTwo?.hybrid_scale).toBeNull()
		expect(openEighteenFour?.time_cap_ms).toBe(540_000)
		expect(strictPress?.time_cap_ms).toBeNull()
	})

	it("keeps category counts derived from included tests", () => {
		const categories = benchmarkCategoriesSchema.parse(BENCHMARK_CATEGORIES)

		expect(categories.map(({ key, testCount }) => [key, testCount])).toEqual([
			["strength", 15],
			["gymnastics", 14],
			["engine", 14],
			["benchmark_workout", 15],
		])
		expect(
			getBenchmarkCategoryCountIssues(categories, BENCHMARK_SEED_TESTS),
		).toEqual([])
	})

	it("pre-encodes ten male and female thresholds for every included test", () => {
		const rows = buildBenchmarkSeedRows(TEST_TS)
		const includedIds = new Set(
			BENCHMARK_SEED_TESTS.filter((test) => test.includedInScoring).map(
				(test) => test.id,
			),
		)

		expect(rows.benchmarkTierThresholds).toHaveLength(58 * 2 * 10)

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
			rows.benchmarkTierThresholds.find(
				(row) =>
					row.test_id === "btst_training_guide_strict_press" &&
					row.variant === "male" &&
					row.tier === 1,
			)?.threshold_value,
		).toBe(52163)
		// Vertical jump thresholds are plain integer inches (points scheme).
		expect(
			rows.benchmarkTierThresholds.find(
				(row) =>
					row.test_id === "btst_training_guide_vertical_jump_in" &&
					row.variant === "male" &&
					row.tier === 1,
			)?.threshold_value,
		).toBe(20)
		// Added-load thresholds: "BW" encodes as 0 lb, "+5" as 5 lb.
		const weightedC2b = rows.benchmarkTierThresholds.filter(
			(row) =>
				row.test_id === "btst_training_guide_weighted_c2b_pull_up_lb" &&
				row.variant === "male",
		)
		expect(weightedC2b.find((row) => row.tier === 1)?.threshold_value).toBe(0)
		expect(weightedC2b.find((row) => row.tier === 1)?.raw_value).toBe("BW")
		expect(weightedC2b.find((row) => row.tier === 2)?.threshold_value).toBe(2268)
	})

	it("scores vertical jump in plain inches and tops the L-sit at three minutes", () => {
		const rows = buildBenchmarkSeedRows(TEST_TS)

		// The athlete score input derives its unit from the workout scheme, and
		// the only distance schemes collect meters or feet. Scoring the jump as
		// plain integer inches via the points scheme (like BikeErg watts) keeps
		// athlete entries and tier thresholds in the same number space.
		const verticalJump = BENCHMARK_SEED_TESTS.find(
			(test) => test.name === "Vertical Jump (in)",
		)
		expect(verticalJump?.scheme).toBe("points")
		expect(verticalJump?.inputUnit).toBe("inches")

		const verticalJumpMale = rows.benchmarkTierThresholds.filter(
			(row) =>
				row.test_id === "btst_training_guide_vertical_jump_in" &&
				row.variant === "male",
		)
		expect(verticalJumpMale.find((row) => row.tier === 1)?.threshold_value).toBe(
			20,
		)
		expect(
			verticalJumpMale.find((row) => row.tier === 10)?.threshold_value,
		).toBe(38)

		// The L-sit tier-10 standard is a three-minute hold for both variants;
		// tiers 1-9 keep the source progression.
		for (const variant of ["male", "female"] as const) {
			const lSitTopTier = rows.benchmarkTierThresholds.find(
				(row) =>
					row.test_id === "btst_training_guide_l_sit_hold" &&
					row.variant === variant &&
					row.tier === 10,
			)
			expect(lSitTopTier?.raw_value).toBe("00:03:00")
			expect(lSitTopTier?.threshold_value).toBe(180_000)
		}
	})

	it("encodes hybrid rep tiers as plain integers and time tiers as milliseconds", () => {
		const rows = buildBenchmarkSeedRows(TEST_TS)
		const openSixteenTwo = rows.benchmarkTierThresholds.filter(
			(row) =>
				row.test_id === "btst_training_guide_open_16_2_time_reps" &&
				row.variant === "male",
		)
		const openEighteenFour = rows.benchmarkTierThresholds.filter(
			(row) =>
				row.test_id === "btst_training_guide_open_18_4_reps_time" &&
				row.variant === "male",
		)

		// Open 16.2 flips at tier 9: tiers 1-8 are reps, tiers 9-10 are times.
		expect(openSixteenTwo.find((row) => row.tier === 1)?.threshold_value).toBe(90)
		expect(openSixteenTwo.find((row) => row.tier === 8)?.threshold_value).toBe(429)
		// "19:59" → 1,199,000 ms and "16:00" → 960,000 ms.
		expect(openSixteenTwo.find((row) => row.tier === 9)?.threshold_value).toBe(
			1_199_000,
		)
		expect(openSixteenTwo.find((row) => row.tier === 10)?.threshold_value).toBe(
			960_000,
		)

		// Open 18.4 flips at tier 7: tiers 1-6 are reps, tiers 7-10 are times.
		expect(openEighteenFour.find((row) => row.tier === 6)?.threshold_value).toBe(
			164,
		)
		// "8:30" → 510,000 ms.
		expect(openEighteenFour.find((row) => row.tier === 7)?.threshold_value).toBe(
			510_000,
		)
	})

	it("stores hybrid rep-tier athlete scores as capped with reps in secondary_value", () => {
		const { scores } = buildBenchmarkAthleteSeedRows(TEST_TS)
		const hybridTests = BENCHMARK_SEED_TESTS.filter(
			(test) => test.scoreModel === "hybrid",
		)

		let totalCap = 0
		let totalFinish = 0

		for (const test of hybridTests) {
			const capMs = (test.timeCapSeconds ?? 0) * 1000
			const testScores = scores.filter(
				(score) => score.workout_id === test.workoutId,
			)
			const capScores = testScores.filter((score) => score.status === "cap")
			const finishScores = testScores.filter(
				(score) => score.status === "scored",
			)
			totalCap += capScores.length
			totalFinish += finishScores.length

			for (const score of capScores) {
				// Capped: cap time is the primary value, reps live in secondary_value.
				expect(score.status_order).toBe(1)
				expect(score.score_value).toBe(capMs)
				expect(score.time_cap_ms).toBe(capMs)
				expect(typeof score.secondary_value).toBe("number")
				expect(score.secondary_value).not.toBeNull()
				expect(score.sort_key).toBeTruthy()
			}

			for (const score of finishScores) {
				// Finishers store their finish time in ms, still at or below the cap.
				expect(score.time_cap_ms).toBe(capMs)
				expect(score.secondary_value).toBeNull()
				expect(score.score_value).toBeLessThanOrEqual(capMs)
			}
		}

		// Both hybrid tests place lower-tier athletes at the cap and higher-tier
		// athletes at a finish time, so both buckets are populated.
		expect(totalCap).toBeGreaterThan(0)
		expect(totalFinish).toBeGreaterThan(0)

		// batchInsert derives the INSERT column list from the first row, so every
		// score row must expose the same set of keys.
		const firstKeys = Object.keys(scores[0]).sort()
		for (const score of scores) {
			expect(Object.keys(score).sort()).toEqual(firstKeys)
		}
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
		expect(settings.scoringConfig.algorithm).toBe("online")
		expect(rows.scalingLevels).toEqual([
			expect.objectContaining({ label: "Open", team_size: 1 }),
		])
		expect(rows.trackWorkouts).toHaveLength(58)
		expect(rows.trackWorkouts.every((row) => row.benchmark_test_id)).toBe(true)
		// Every benchmark track workout — included AND deferred — is published so
		// the public leaderboard read (published-only) still surfaces a 1:1
		// test↔track-workout mapping. Deferred tests stay out of scoring via
		// includedInScoring=false, not via a draft event status.
		expect(rows.trackWorkouts.every((row) => row.event_status === "published")).toBe(
			true,
		)
		// Every test is now included in scoring, so no track workout carries a
		// deferral note.
		expect(rows.trackWorkouts.every((row) => row.notes === null)).toBe(true)
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
