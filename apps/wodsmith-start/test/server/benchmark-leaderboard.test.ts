import { describe, expect, it } from "vitest"
import {
  buildBenchmarkLeaderboardContext,
  findBenchmarkRatingBand,
} from "@/server/benchmark-leaderboard"

const categories = JSON.stringify([
  { key: "strength", label: "Strength", testCount: 2, weight: 1 },
  { key: "engine", label: "Engine", testCount: 1, weight: 1 },
])

const ratingBands = JSON.stringify([
  { key: "local", label: "Local", minScore: 0, maxScore: 59.9 },
  { key: "regional", label: "Regional", minScore: 60, maxScore: 100 },
])

function thresholdRows(testId: string) {
  return ["male", "female"].flatMap((variant) =>
    Array.from({ length: 10 }, (_, index) => ({
      testId,
      variant,
      tier: index + 1,
      thresholdValue: (index + 1) * (variant === "male" ? 100 : 90),
    })),
  )
}

function buildContext(overrides = {}) {
  return buildBenchmarkLeaderboardContext({
    battery: {
      id: "battery-1",
      categories,
      ratingBands,
      maxTier: 10,
      scoreMax: 100,
    },
    tests: [
      {
        id: "strict-press",
        categoryKey: "strength",
        name: "Strict Press",
        position: 1,
        scoreType: "max",
        includedInScoring: true,
      },
      {
        id: "back-squat",
        categoryKey: "strength",
        name: "Back Squat",
        position: 2,
        scoreType: "max",
        includedInScoring: true,
      },
      {
        id: "mile-run",
        categoryKey: "engine",
        name: "Mile Run",
        position: 3,
        scoreType: "min",
        includedInScoring: true,
      },
    ],
    thresholds: [
      ...thresholdRows("strict-press"),
      ...thresholdRows("back-squat"),
      ...thresholdRows("mile-run"),
    ],
    trackWorkouts: [
      {
        id: "tw-strict-press",
        benchmarkTestId: "strict-press",
        benchmarkCategory: "strength",
      },
      {
        id: "tw-back-squat",
        benchmarkTestId: "back-squat",
        benchmarkCategory: "strength",
      },
      {
        id: "tw-mile-run",
        benchmarkTestId: "mile-run",
        benchmarkCategory: "engine",
      },
    ],
    ...overrides,
  })
}

describe("benchmark leaderboard context", () => {
  it("builds absolute-tier tables and event metadata from generic benchmark rows", () => {
    const context = buildContext()

    expect(context.batteryId).toBe("battery-1")
    expect(context.absoluteTier.tableByEventId.size).toBe(3)
    expect(
      context.absoluteTier.tableByEventId
        .get("tw-strict-press")
        ?.thresholdsByVariant.get("female")?.[0],
    ).toEqual({ tier: 1, value: 90 })
    expect(context.testsByTrackWorkoutId.get("tw-mile-run")).toMatchObject({
      testId: "mile-run",
      categoryKey: "engine",
      categoryLabel: "Engine",
      scoreType: "min",
      includedInScoring: true,
    })
  })

  it("fails closed when cached category counts do not match included tests", () => {
    expect(() =>
      buildContext({
        battery: {
          id: "battery-1",
          categories: JSON.stringify([
            { key: "strength", label: "Strength", testCount: 99, weight: 1 },
          ]),
          ratingBands,
          maxTier: 10,
          scoreMax: 100,
        },
      }),
    ).toThrow(/category counts/i)
  })

  it("fails closed when an included test is missing a threshold tier", () => {
    expect(() =>
      buildContext({
        thresholds: [
          ...thresholdRows("strict-press").filter((row) => row.tier !== 10),
          ...thresholdRows("back-squat"),
          ...thresholdRows("mile-run"),
        ],
      }),
    ).toThrow(/missing tier 10/i)
  })

  it("fails closed when an included test is missing a scoring variant", () => {
    expect(() =>
      buildContext({
        thresholds: [
          ...thresholdRows("strict-press").filter(
            (row) => row.variant !== "female",
          ),
          ...thresholdRows("back-squat"),
          ...thresholdRows("mile-run"),
        ],
      }),
    ).toThrow(/missing female thresholds/i)
  })

  it("fails closed when a benchmark test is not mapped to an event", () => {
    expect(() =>
      buildContext({
        trackWorkouts: [
          {
            id: "tw-strict-press",
            benchmarkTestId: "strict-press",
            benchmarkCategory: "strength",
          },
          {
            id: "tw-back-squat",
            benchmarkTestId: "back-squat",
            benchmarkCategory: "strength",
          },
        ],
      }),
    ).toThrow(/mile-run.*missing a mapped track workout/i)
  })

  it("fails closed when one benchmark test is mapped by multiple events", () => {
    expect(() =>
      buildContext({
        trackWorkouts: [
          {
            id: "tw-strict-press",
            benchmarkTestId: "strict-press",
            benchmarkCategory: "strength",
          },
          {
            id: "tw-strict-press-duplicate",
            benchmarkTestId: "strict-press",
            benchmarkCategory: "strength",
          },
          {
            id: "tw-back-squat",
            benchmarkTestId: "back-squat",
            benchmarkCategory: "strength",
          },
          {
            id: "tw-mile-run",
            benchmarkTestId: "mile-run",
            benchmarkCategory: "engine",
          },
        ],
      }),
    ).toThrow(/mapped by multiple events/i)
  })

  it("finds the rating band for an Overall score", () => {
    const context = buildContext()

    expect(findBenchmarkRatingBand(70, context.ratingBands)?.label).toBe(
      "Regional",
    )
    expect(findBenchmarkRatingBand(101, context.ratingBands)).toBeNull()
  })
})
