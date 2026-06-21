import { describe, expect, it } from "vitest"
import {
	BenchmarkConfigError,
	calculateAbsoluteTier,
	calculateAbsoluteTierEventPoints,
	type AbsoluteTierEventTable,
	type AbsoluteTierScoringContext,
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

	it("calculates event points from preloaded threshold context", () => {
		const context: AbsoluteTierScoringContext = {
			tableByEventId: new Map([
				["event-1", table("max", thresholds([10, 20, 30]))],
			]),
		}

		const results = calculateAbsoluteTierEventPoints(
			"event-1",
			[
				score(5, { userId: "below" }),
				score(20, { userId: "tier-2" }),
				score(35, { userId: "tier-3" }),
			],
			"reps",
			context,
		)

		expect(results.get("below")).toEqual({ userId: "below", points: 0.5, rank: 3 })
		expect(results.get("tier-2")).toEqual({ userId: "tier-2", points: 2, rank: 2 })
		expect(results.get("tier-3")).toEqual({ userId: "tier-3", points: 3, rank: 1 })
	})

	it("fails closed when preloaded context is missing", () => {
		expect(() =>
			calculateAbsoluteTierEventPoints("event-1", [score(10)], "reps", undefined),
		).toThrow(BenchmarkConfigError)
		expect(() =>
			calculateAbsoluteTierEventPoints(
				"event-2",
				[score(10)],
				"reps",
				{ tableByEventId: new Map([["event-1", table("max", thresholds([10]))]]) },
			),
		).toThrow(BenchmarkConfigError)
	})
})
