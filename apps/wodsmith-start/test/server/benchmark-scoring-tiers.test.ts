import { describe, expect, it } from "vitest"
import {
  buildBenchmarkScoringTierSummary,
  buildBenchmarkOnlineScoringConfig,
  buildBenchmarkTierScoringConfig,
  encodeBenchmarkThresholdValue,
  prepareBenchmarkTierThresholdUpdates,
} from "@/server/benchmark-scoring-tiers"

const categories = JSON.stringify([
  { key: "strength", label: "Strength", testCount: 1, weight: 1 },
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
      rawValue: String((index + 1) * (variant === "male" ? 10 : 9)),
    })),
  )
}

function buildSummary(overrides = {}) {
  return buildBenchmarkScoringTierSummary({
    competitionId: "comp-benchmark",
    scoringConfig: {
      algorithm: "absolute_tier",
      absoluteTier: { batteryId: "battery-1" },
      tiebreaker: { primary: "countback" },
      statusHandling: { dnf: "zero", dns: "zero", withdrawn: "zero" },
    },
    battery: {
      id: "battery-1",
      name: "Benchmark Battery",
      description: "Fixed tier benchmark table.",
      status: "published",
      categories,
      ratingBands,
      maxTier: 10,
      scoreMax: 100,
      videoPolicy: "never",
      isOpenJoin: false,
    },
    tests: [
      {
        id: "strict-press",
        categoryKey: "strength",
        name: "Strict Press",
        position: 1,
        scheme: "load",
        scoreType: "max",
        inputUnit: "lb",
        includedInScoring: true,
      },
      {
        id: "mile-run",
        categoryKey: "engine",
        name: "Mile Run",
        position: 2,
        scheme: "time",
        scoreType: "min",
        inputUnit: "time",
        includedInScoring: true,
      },
      {
        id: "hybrid-deferred",
        categoryKey: "engine",
        name: "Hybrid Deferred",
        position: 3,
        scheme: "reps",
        scoreType: "max",
        inputUnit: "reps",
        includedInScoring: false,
      },
    ],
    thresholds: [...thresholdRows("strict-press"), ...thresholdRows("mile-run")],
    ...overrides,
  })
}

describe("benchmark scoring tier summaries", () => {
  // @lat: [[organizer-dashboard#Benchmark Tier Scoring]]
  it("groups raw threshold tables by category, test, and variant", () => {
    const summary = buildSummary()

    expect(summary.isActive).toBe(true)
    expect(summary.variants).toEqual(["female", "male"])
    expect(summary.includedTestCount).toBe(2)
    expect(summary.deferredTestCount).toBe(1)
    expect(summary.thresholdCount).toBe(40)
    expect(summary.categories).toEqual([
      expect.objectContaining({
        key: "strength",
        includedTestCount: 1,
        totalTestCount: 1,
        tests: [
          expect.objectContaining({
            id: "strict-press",
            variants: [
              expect.objectContaining({ variant: "male" }),
              expect.objectContaining({ variant: "female" }),
            ],
          }),
        ],
      }),
      expect.objectContaining({
        key: "engine",
        includedTestCount: 1,
        totalTestCount: 2,
      }),
    ])
  })

  it("marks the table inactive when the active scoring config points elsewhere", () => {
    const summary = buildSummary({
      scoringConfig: {
        algorithm: "online",
        tiebreaker: { primary: "countback" },
        statusHandling: { dnf: "zero", dns: "zero", withdrawn: "zero" },
      },
    })

    expect(summary.isActive).toBe(false)
  })

  it("fails closed when an included test is missing a complete variant table", () => {
    expect(() =>
      buildSummary({
        thresholds: [
          ...thresholdRows("strict-press").filter(
            (row) => !(row.variant === "female" && row.tier === 10),
          ),
          ...thresholdRows("mile-run"),
        ],
      }),
    ).toThrow(/exactly 10 thresholds/i)
  })

  it("encodes edited raw values with benchmark input-unit semantics", () => {
    expect(
      encodeBenchmarkThresholdValue({
        rawValue: "225",
        inputUnit: "lb",
        scheme: "load",
      }),
    ).toBe(102058)

    expect(
      encodeBenchmarkThresholdValue({
        rawValue: "24",
        inputUnit: "in",
        scheme: "feet",
      }),
    ).toBe(610)
  })

  it("validates every submitted threshold before persistence", () => {
    const summary = buildSummary()
    const tests = new Map(
      summary.categories
        .flatMap((category) => category.tests)
        .filter((test) => test.includedInScoring)
        .map((test) => [test.id, test]),
    )

    expect(() =>
      prepareBenchmarkTierThresholdUpdates({
        summary,
        tests,
        thresholds: [
          {
            testId: "strict-press",
            variant: "male",
            tier: 1,
            rawValue: "225",
          },
          {
            testId: "strict-press",
            variant: "male",
            tier: 2,
            rawValue: "not-a-weight",
          },
        ],
      }),
    ).toThrow(/unable to encode benchmark threshold/i)
  })

  it("builds reversible benchmark scoring mode configs", () => {
    const existingConfig = {
      algorithm: "absolute_tier" as const,
      absoluteTier: { batteryId: "battery-1" },
      tiebreaker: { primary: "head_to_head" as const, headToHeadEventId: "e1" },
      statusHandling: {
        dnf: "last_place" as const,
        dns: "zero" as const,
        withdrawn: "exclude" as const,
      },
    }

    expect(
      buildBenchmarkTierScoringConfig({
        batteryId: "battery-2",
        existingConfig,
      }),
    ).toEqual({
      algorithm: "absolute_tier",
      absoluteTier: { batteryId: "battery-2" },
      tiebreaker: existingConfig.tiebreaker,
      statusHandling: existingConfig.statusHandling,
    })

    expect(buildBenchmarkOnlineScoringConfig(existingConfig)).toEqual({
      algorithm: "online",
      tiebreaker: existingConfig.tiebreaker,
      statusHandling: existingConfig.statusHandling,
    })
  })
})
