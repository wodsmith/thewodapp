import { describe, expect, it } from "vitest"
import {
	BenchmarkConfigError,
	calculateAbsoluteTier,
	type AbsoluteTierEventTable,
	type AbsoluteTierThreshold,
	type EventScoreInput,
} from "@/lib/scoring/algorithms"
import type { ScoreType, WorkoutScheme } from "@/lib/scoring/types"

function table(
	scoreType: ScoreType,
	thresholds: readonly AbsoluteTierThreshold[],
): AbsoluteTierEventTable {
	return {
		scoreType,
		thresholdsByVariant: new Map([["male", thresholds]]),
	}
}

function thresholds(values: readonly number[]): AbsoluteTierThreshold[] {
	return values.map((value, index) => ({ tier: index + 1, value }))
}

function score(
	value: number,
	overrides?: Partial<EventScoreInput>,
): EventScoreInput {
	return {
		userId: "athlete",
		value,
		status: "scored",
		variant: "male",
		...overrides,
	}
}

describe("absolute-tier scoring", () => {
	it("scores inactive, below-tier, exact-tier, and tier-10 standard scores", () => {
		const eventTable = table(
			"max",
			thresholds([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]),
		)

		expect(calculateAbsoluteTier(score(0, { status: "dnf" }), eventTable, "load")).toBe(0)
		expect(calculateAbsoluteTier(score(0, { status: "dns" }), eventTable, "load")).toBe(0)
		expect(
			calculateAbsoluteTier(score(0, { status: "withdrawn" }), eventTable, "load"),
		).toBe(0)
		expect(calculateAbsoluteTier(score(99), eventTable, "load")).toBe(0.5)
		expect(calculateAbsoluteTier(score(100), eventTable, "load")).toBe(1)
		expect(calculateAbsoluteTier(score(1000), eventTable, "load")).toBe(10)
		expect(calculateAbsoluteTier(score(1100), eventTable, "load")).toBe(10)
	})

	it.each([
		{ scheme: "time" as const, scoreType: "max" as const, value: 25, expected: 2 },
		{ scheme: "time" as const, scoreType: "min" as const, value: 250, expected: 1 },
		{ scheme: "points" as const, scoreType: "max" as const, value: 25, expected: 2 },
		{ scheme: "load" as const, scoreType: "max" as const, value: 25, expected: 2 },
		{ scheme: "reps" as const, scoreType: "max" as const, value: 25, expected: 2 },
		{ scheme: "feet" as const, scoreType: "max" as const, value: 25, expected: 2 },
		{ scheme: "meters" as const, scoreType: "max" as const, value: 25, expected: 2 },
		{ scheme: "rounds-reps" as const, scoreType: "max" as const, value: 25, expected: 2 },
	])(
		"uses getSortDirection for $scheme + $scoreType",
		({
			scheme,
			scoreType,
			value,
			expected,
		}: {
			scheme: WorkoutScheme
			scoreType: ScoreType
			value: number
			expected: number
		}) => {
			const values = scoreType === "min" ? [300, 200, 100] : [10, 20, 30]
			expect(
				calculateAbsoluteTier(score(value), table(scoreType, thresholds(values)), scheme),
			).toBe(expected)
		},
	)

	it("fails closed when variant or threshold tables are missing", () => {
		const eventTable = table("max", thresholds([10]))

		expect(() =>
			calculateAbsoluteTier(score(10, { variant: null }), eventTable, "reps"),
		).toThrow(BenchmarkConfigError)
		expect(() =>
			calculateAbsoluteTier(
				score(0, { status: "dnf", variant: null }),
				eventTable,
				"reps",
			),
		).toThrow(BenchmarkConfigError)
		expect(() =>
			calculateAbsoluteTier(
				score(0, { status: "dnf", variant: "female" }),
				eventTable,
				"reps",
			),
		).toThrow(BenchmarkConfigError)
		expect(() =>
			calculateAbsoluteTier(score(10, { variant: "female" }), eventTable, "reps"),
		).toThrow(BenchmarkConfigError)
		expect(() =>
			calculateAbsoluteTier(
				score(10),
				{ scoreType: "max", thresholdsByVariant: new Map([["male", []]]) },
				"reps",
			),
		).toThrow(BenchmarkConfigError)
	})

	function hybridTable(
		values: readonly number[],
		hybridFlipTier: number,
	): AbsoluteTierEventTable {
		return {
			scoreType: "min",
			thresholdsByVariant: new Map([["male", thresholds(values)]]),
			hybridFlipTier,
		}
	}

	it("scores hybrid reps/time tests like HillerFit Open 16.2 (flip 9, cap 20:00)", () => {
		// Tiers 1-8 are reps completed at the 20:00 cap; tiers 9-10 are finish
		// times in ms (T9 = 20:00 cap, T10 = 16:00).
		const eventTable = hybridTable(
			[100, 150, 200, 250, 290, 300, 350, 400, 1_200_000, 960_000],
			9,
		)
		const capped = (reps: number) =>
			score(0, { status: "cap", secondaryValue: reps })

		// Capped athletes are ranked purely by reps and can never reach the time tiers.
		expect(calculateAbsoluteTier(capped(293), eventTable, "time-with-cap")).toBe(5)
		expect(calculateAbsoluteTier(capped(89), eventTable, "time-with-cap")).toBe(0.5)
		expect(calculateAbsoluteTier(capped(500), eventTable, "time-with-cap")).toBe(8)

		// A finisher clears every rep tier outright and is placed by finish time.
		// 19:30 clears the T9 cap tier but not the 16:00 T10.
		expect(
			calculateAbsoluteTier(score(1_170_000), eventTable, "time-with-cap"),
		).toBe(9)
		// 15:59 clears the top time tier.
		expect(
			calculateAbsoluteTier(score(959_000), eventTable, "time-with-cap"),
		).toBe(10)

		expect(
			calculateAbsoluteTier(
				score(0, { status: "dnf" }),
				eventTable,
				"time-with-cap",
			),
		).toBe(0)
	})

	it("gives a finisher who misses every time tier the top rep tier (Open 18.4, flip 7, cap 9:00)", () => {
		// Tiers 1-6 are reps; tiers 7-10 are finish times (T7 = 8:30).
		const eventTable = hybridTable(
			[50, 100, 150, 200, 250, 300, 510_000, 480_000, 450_000, 420_000],
			7,
		)

		// An 8:45 finisher is slower than the 8:30 T7 threshold, so no time tier
		// is met — they fall back to the highest rep tier (flip - 1 = 6).
		expect(
			calculateAbsoluteTier(score(525_000), eventTable, "time-with-cap"),
		).toBe(6)
	})
})
