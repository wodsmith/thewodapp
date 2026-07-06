import { describe, expect, it } from "vitest"
import {
  assertBenchmarkRatingBandsWithinScoreMax,
  assertBenchmarkVariantThresholdsComplete,
  benchmarkThresholdDimension,
  buildBenchmarkMaxTierGrowthRows,
  buildBenchmarkScoringTierSummary,
  buildBenchmarkOnlineScoringConfig,
  encodeBenchmarkTestThresholds,
  encodeBenchmarkThresholdValue,
  prepareBenchmarkCategories,
  prepareBenchmarkRatingBands,
  prepareBenchmarkTierThresholdUpdates,
  recomputeCategoryTestCounts,
  resolveBenchmarkTestScoreModel,
  resolveBenchmarkTestThresholdRows,
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
        scoreModel: "standard",
        hybridFlipTier: null,
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
        scoreModel: "standard",
        hybridFlipTier: null,
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
        scoreModel: "standard",
        hybridFlipTier: null,
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

  // @lat: [[organizer-dashboard#Benchmark Tier Scoring#Test-Event Linking]]
  it("attaches linked competition events to tests and defaults to unlinked", () => {
    const summary = buildSummary({
      linkedEventsByTestId: new Map([
        [
          "strict-press",
          { trackWorkoutId: "tw-press", eventName: "Event 1 - Strict Press" },
        ],
      ]),
    })

    const tests = summary.categories.flatMap((category) => category.tests)
    expect(tests.find((test) => test.id === "strict-press")?.linkedEvent).toEqual({
      trackWorkoutId: "tw-press",
      eventName: "Event 1 - Strict Press",
    })
    expect(tests.find((test) => test.id === "mile-run")?.linkedEvent).toBeNull()

    const withoutMap = buildSummary()
    for (const test of withoutMap.categories.flatMap((c) => c.tests)) {
      expect(test.linkedEvent).toBeNull()
    }
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

  it("sorts rating bands by minScore and rejects overlaps", () => {
    expect(
      prepareBenchmarkRatingBands({
        ratingBands: [
          { key: "regional", label: "Regional", minScore: 60, maxScore: 100 },
          { key: "local", label: "Local", minScore: 0, maxScore: 59.9 },
        ],
        scoreMax: 100,
      }).map((band) => band.key),
    ).toEqual(["local", "regional"])

    expect(() =>
      prepareBenchmarkRatingBands({
        ratingBands: [
          { key: "local", label: "Local", minScore: 0, maxScore: 60 },
          { key: "regional", label: "Regional", minScore: 50, maxScore: 100 },
        ],
        scoreMax: 100,
      }),
    ).toThrow(/overlap/i)
  })

  it("rejects rating bands outside 0..scoreMax", () => {
    expect(() =>
      prepareBenchmarkRatingBands({
        ratingBands: [
          { key: "elite", label: "Elite", minScore: 0, maxScore: 120 },
        ],
        scoreMax: 100,
      }),
    ).toThrow(/within 0 and 100/i)
  })

  it("rejects duplicate rating band keys", () => {
    expect(() =>
      prepareBenchmarkRatingBands({
        ratingBands: [
          { key: "local", label: "Local", minScore: 0, maxScore: 50 },
          { key: "local", label: "Local 2", minScore: 51, maxScore: 100 },
        ],
        scoreMax: 100,
      }),
    ).toThrow(/duplicate/i)
  })

  it("rejects a smaller scoreMax when rating bands no longer fit", () => {
    expect(() =>
      assertBenchmarkRatingBandsWithinScoreMax({
        ratingBands: [
          { key: "regional", label: "Regional", minScore: 60, maxScore: 100 },
        ],
        scoreMax: 80,
      }),
    ).toThrow(/within 0 and 80/i)
  })

  it("recomputes category test counts from included tests only", () => {
    const prepared = prepareBenchmarkCategories({
      categories: [
        { key: "strength", label: "Strength", weight: 1 },
        { key: "engine", label: "Engine", weight: 2 },
      ],
      tests: [
        { categoryKey: "strength", includedInScoring: true },
        { categoryKey: "strength", includedInScoring: true },
        { categoryKey: "engine", includedInScoring: false },
      ],
    })

    expect(prepared).toEqual([
      { key: "strength", label: "Strength", weight: 1, testCount: 2 },
      { key: "engine", label: "Engine", weight: 2, testCount: 0 },
    ])
  })

  it("rejects removing a category that still has tests", () => {
    expect(() =>
      prepareBenchmarkCategories({
        categories: [{ key: "strength", label: "Strength", weight: 1 }],
        tests: [{ categoryKey: "engine", includedInScoring: true }],
      }),
    ).toThrow(/cannot remove category engine/i)
  })

  it("rejects duplicate category keys", () => {
    expect(() =>
      prepareBenchmarkCategories({
        categories: [
          { key: "strength", label: "Strength", weight: 1 },
          { key: "strength", label: "Again", weight: 1 },
        ],
        tests: [],
      }),
    ).toThrow(/duplicate/i)
  })

  it("recomputes counts for existing full categories", () => {
    expect(
      recomputeCategoryTestCounts(
        [
          { key: "strength", label: "Strength", weight: 1, testCount: 5 },
          { key: "engine", label: "Engine", weight: 1, testCount: 9 },
        ],
        [
          { categoryKey: "strength", includedInScoring: true },
          { categoryKey: "engine", includedInScoring: true },
          { categoryKey: "engine", includedInScoring: true },
        ],
      ),
    ).toEqual([
      { key: "strength", label: "Strength", weight: 1, testCount: 1 },
      { key: "engine", label: "Engine", weight: 1, testCount: 2 },
    ])
  })

  it("requires a complete threshold table across both variants", () => {
    const complete = ["male", "female"].flatMap((variant) =>
      Array.from({ length: 3 }, (_, index) => ({
        variant,
        tier: index + 1,
      })),
    )

    expect(() =>
      assertBenchmarkVariantThresholdsComplete({
        maxTier: 3,
        thresholds: complete,
      }),
    ).not.toThrow()

    expect(() =>
      assertBenchmarkVariantThresholdsComplete({
        maxTier: 3,
        thresholds: complete.filter((row) => row.variant !== "female"),
      }),
    ).toThrow(/female must have exactly 3/i)

    expect(() =>
      assertBenchmarkVariantThresholdsComplete({
        maxTier: 3,
        thresholds: complete.filter(
          (row) => !(row.variant === "male" && row.tier === 2),
        ),
      }),
    ).toThrow(/male must have exactly 3/i)
  })

  it("clones the highest tier when maxTier grows and no-ops when it shrinks", () => {
    const thresholds = ["male", "female"].flatMap((variant) =>
      Array.from({ length: 2 }, (_, index) => ({
        testId: "strict-press",
        variant,
        tier: index + 1,
        thresholdValue: (index + 1) * 100,
        rawValue: String((index + 1) * 10),
      })),
    )

    const grown = buildBenchmarkMaxTierGrowthRows({
      oldMaxTier: 2,
      newMaxTier: 4,
      thresholds,
    })

    expect(grown).toHaveLength(4)
    expect(grown).toContainEqual({
      testId: "strict-press",
      variant: "male",
      tier: 3,
      thresholdValue: 200,
      rawValue: "20",
    })
    expect(grown).toContainEqual({
      testId: "strict-press",
      variant: "male",
      tier: 4,
      thresholdValue: 200,
      rawValue: "20",
    })

    expect(
      buildBenchmarkMaxTierGrowthRows({
        oldMaxTier: 4,
        newMaxTier: 2,
        thresholds,
      }),
    ).toEqual([])
  })

  it("merges override raw values over existing rows and re-encodes", () => {
    const rows = resolveBenchmarkTestThresholdRows({
      scheme: "load",
      inputUnit: "lb",
      scoreModel: "standard",
      hybridFlipTier: null,
      existing: [
        { variant: "male", tier: 1, rawValue: "135" },
        { variant: "male", tier: 2, rawValue: "185" },
      ],
      overrides: [{ variant: "male", tier: 2, rawValue: "225" }],
    })

    const tier2 = rows.find((row) => row.tier === 2)
    expect(tier2?.rawValue).toBe("225")
    expect(tier2?.thresholdValue).toBe(
      encodeBenchmarkThresholdValue({
        rawValue: "225",
        inputUnit: "lb",
        scheme: "load",
      }),
    )
    expect(rows).toHaveLength(2)
  })

  it("builds the online scoring config while preserving tiebreaker and status handling", () => {
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

    expect(buildBenchmarkOnlineScoringConfig(existingConfig)).toEqual({
      algorithm: "online",
      tiebreaker: existingConfig.tiebreaker,
      statusHandling: existingConfig.statusHandling,
    })
  })

  it("maps hybrid tiers below the flip to cap-reps and at/above it to score", () => {
    expect(
      benchmarkThresholdDimension({
        tier: 8,
        scoreModel: "hybrid",
        hybridFlipTier: 9,
      }),
    ).toBe("cap_reps")
    expect(
      benchmarkThresholdDimension({
        tier: 9,
        scoreModel: "hybrid",
        hybridFlipTier: 9,
      }),
    ).toBe("score")
    expect(
      benchmarkThresholdDimension({
        tier: 1,
        scoreModel: "standard",
        hybridFlipTier: null,
      }),
    ).toBe("score")
  })

  it("encodes cap-reps thresholds as plain integers and rejects time strings", () => {
    expect(
      encodeBenchmarkThresholdValue({
        rawValue: "293",
        inputUnit: "time",
        scheme: "time-with-cap",
        dimension: "cap_reps",
      }),
    ).toBe(293)

    expect(() =>
      encodeBenchmarkThresholdValue({
        rawValue: "19:59",
        inputUnit: "time",
        scheme: "time-with-cap",
        dimension: "cap_reps",
      }),
    ).toThrow(/whole number of reps/i)
  })

  it("resolves hybrid score models and rejects invalid configuration", () => {
    expect(
      resolveBenchmarkTestScoreModel({
        scheme: "time-with-cap",
        scoreModel: "hybrid",
        hybridFlipTier: 9,
        maxTier: 10,
      }),
    ).toEqual({ scoreModel: "hybrid", hybridFlipTier: 9 })

    expect(
      resolveBenchmarkTestScoreModel({
        scheme: "load",
        scoreModel: undefined,
        hybridFlipTier: null,
        maxTier: 10,
      }),
    ).toEqual({ scoreModel: "standard", hybridFlipTier: null })

    // A standard model drops any stray flip tier.
    expect(
      resolveBenchmarkTestScoreModel({
        scheme: "time-with-cap",
        scoreModel: "standard",
        hybridFlipTier: 9,
        maxTier: 10,
      }),
    ).toEqual({ scoreModel: "standard", hybridFlipTier: null })

    expect(() =>
      resolveBenchmarkTestScoreModel({
        scheme: "load",
        scoreModel: "hybrid",
        hybridFlipTier: 9,
        maxTier: 10,
      }),
    ).toThrow(/time-with-cap/i)

    expect(() =>
      resolveBenchmarkTestScoreModel({
        scheme: "time-with-cap",
        scoreModel: "hybrid",
        hybridFlipTier: 1,
        maxTier: 10,
      }),
    ).toThrow(/between 2 and 10/i)
  })

  it("encodes hybrid test thresholds using each tier's dimension", () => {
    const rows = encodeBenchmarkTestThresholds({
      scheme: "time-with-cap",
      inputUnit: "time",
      scoreModel: "hybrid",
      hybridFlipTier: 3,
      thresholds: [
        { variant: "male", tier: 2, rawValue: "150" },
        { variant: "male", tier: 3, rawValue: "9:00" },
      ],
    })

    // Tier 2 is below the flip → plain reps; tier 3 is a finish time in ms.
    expect(rows.find((row) => row.tier === 2)?.thresholdValue).toBe(150)
    expect(rows.find((row) => row.tier === 3)?.thresholdValue).toBe(540_000)
  })
})
