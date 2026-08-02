import { asc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
  benchmarkBatteriesTable,
  benchmarkTestsTable,
  benchmarkTierThresholdsTable,
} from "@/db/schemas/benchmarks"
import type { trackWorkoutsTable } from "@/db/schemas/programming"
import { competitionCan } from "@/lib/competitions/capabilities"
import {
  type AbsoluteTierEventTable,
  type AbsoluteTierScoringContext,
  BenchmarkConfigError,
} from "@/lib/scoring/algorithms"
import type { ScoreType } from "@/lib/scoring/types"
import {
  type BenchmarkCategory,
  type BenchmarkRatingBand,
  benchmarkCategoriesSchema,
  benchmarkRatingBandsSchema,
  benchmarkVariantSchema,
  getBenchmarkCategoryCountIssues,
} from "@/schemas/benchmark.schema"

export interface BenchmarkLeaderboardCategoryScore {
  key: string
  label?: string
  score: number
  tierSum: number
  testCount: number
  weight: number
}

export type BenchmarkLeaderboardRatingBand = BenchmarkRatingBand

export interface BenchmarkLeaderboardTestMetadata {
  trackWorkoutId: string
  testId: string
  name: string
  position: number
  categoryKey: string
  categoryLabel: string
  includedInScoring: boolean
  scoreType: ScoreType
}

export interface BenchmarkLeaderboardContext {
  batteryId: string
  categories: BenchmarkCategory[]
  ratingBands: BenchmarkRatingBand[]
  maxTier: number
  scoreMax: number
  testsByTrackWorkoutId: ReadonlyMap<string, BenchmarkLeaderboardTestMetadata>
  absoluteTier: AbsoluteTierScoringContext
}

export interface BenchmarkTrackWorkoutRef {
  id: string
  benchmarkTestId: string | null
  benchmarkCategory: string | null
}

interface BenchmarkBatteryRow {
  id: string
  categories: string
  ratingBands: string
  maxTier: number
  scoreMax: number
}

interface BenchmarkTestRow {
  id: string
  categoryKey: string
  name: string
  position: number
  scoreType: string
  includedInScoring: boolean
  scoreModel: string
  hybridFlipTier: number | null
}

interface BenchmarkThresholdRow {
  testId: string
  variant: string
  tier: number
  thresholdValue: number
}

export function findBenchmarkRatingBand(
  score: number,
  ratingBands: readonly BenchmarkRatingBand[],
): BenchmarkRatingBand | null {
  return (
    ratingBands.find(
      (band) => score >= band.minScore && score <= band.maxScore,
    ) ?? null
  )
}

export function buildBenchmarkLeaderboardContext({
  battery,
  tests,
  thresholds,
  trackWorkouts,
}: {
  battery: BenchmarkBatteryRow
  tests: readonly BenchmarkTestRow[]
  thresholds: readonly BenchmarkThresholdRow[]
  trackWorkouts: readonly BenchmarkTrackWorkoutRef[]
}): BenchmarkLeaderboardContext {
  const categories = parseBenchmarkCategories(battery.categories)
  const ratingBands = parseBenchmarkRatingBands(battery.ratingBands)

  const categoryIssues = getBenchmarkCategoryCountIssues(
    categories,
    tests.map((test) => ({
      categoryKey: test.categoryKey,
      includedInScoring: test.includedInScoring,
    })),
  )
  if (categoryIssues.length > 0) {
    throw new BenchmarkConfigError(
      `Benchmark category counts are inconsistent: ${categoryIssues.join("; ")}`,
    )
  }

  const categoryByKey = new Map(
    categories.map((category) => [category.key, category]),
  )
  const testById = new Map(tests.map((test) => [test.id, test]))
  const thresholdsByTestVariant = groupThresholdsByTestVariant(thresholds)

  const tableByEventId = new Map<string, AbsoluteTierEventTable>()
  const testsByTrackWorkoutId = new Map<
    string,
    BenchmarkLeaderboardTestMetadata
  >()
  const mappedIncludedTestCountByCategory = new Map<string, number>()
  const trackWorkoutByTestId = new Map<string, string>()

  for (const trackWorkout of trackWorkouts) {
    if (!trackWorkout.benchmarkTestId) {
      continue
    }

    const test = testById.get(trackWorkout.benchmarkTestId)
    if (!test) {
      throw new BenchmarkConfigError(
        `Benchmark event ${trackWorkout.id} references missing test ${trackWorkout.benchmarkTestId}`,
      )
    }

    const existingTrackWorkoutId = trackWorkoutByTestId.get(test.id)
    if (existingTrackWorkoutId) {
      throw new BenchmarkConfigError(
        `Benchmark test ${test.id} is mapped by multiple events: ${existingTrackWorkoutId}, ${trackWorkout.id}`,
      )
    }
    trackWorkoutByTestId.set(test.id, trackWorkout.id)

    if (
      trackWorkout.benchmarkCategory &&
      trackWorkout.benchmarkCategory !== test.categoryKey
    ) {
      throw new BenchmarkConfigError(
        `Benchmark event ${trackWorkout.id} category ${trackWorkout.benchmarkCategory} does not match test category ${test.categoryKey}`,
      )
    }

    const category = categoryByKey.get(test.categoryKey)
    if (!category) {
      throw new BenchmarkConfigError(
        `Benchmark test ${test.id} references unknown category ${test.categoryKey}`,
      )
    }

    testsByTrackWorkoutId.set(trackWorkout.id, {
      trackWorkoutId: trackWorkout.id,
      testId: test.id,
      name: test.name,
      position: test.position,
      categoryKey: test.categoryKey,
      categoryLabel: category.label,
      includedInScoring: test.includedInScoring,
      scoreType: test.scoreType as ScoreType,
    })

    if (!test.includedInScoring) {
      continue
    }

    tableByEventId.set(trackWorkout.id, {
      scoreType: test.scoreType as ScoreType,
      thresholdsByVariant: getCompleteVariantTables({
        testId: test.id,
        maxTier: battery.maxTier,
        thresholdsByTestVariant,
      }),
      hybridFlipTier: resolveHybridFlipTier({
        testId: test.id,
        scoreModel: test.scoreModel,
        hybridFlipTier: test.hybridFlipTier,
        maxTier: battery.maxTier,
      }),
    })
    mappedIncludedTestCountByCategory.set(
      test.categoryKey,
      (mappedIncludedTestCountByCategory.get(test.categoryKey) ?? 0) + 1,
    )
  }

  // Public leaderboard reads only include visible events. A benchmark test may
  // therefore be intentionally absent while its event is still draft (or while
  // an organizer is finishing the link). Keep tier context for every complete,
  // mapped test instead of letting that one setup gap hide the whole battery.
  // Category denominators must use the same mapped subset so hidden tests do
  // not lower otherwise-valid category and Overall scores.
  // @lat: [[organizer-dashboard#Benchmark Tier Scoring#Test-Event Linking#Partial Public Tier Context]]
  const mappedCategories = categories.flatMap((category) => {
    const testCount = mappedIncludedTestCountByCategory.get(category.key) ?? 0
    return testCount > 0 ? [{ ...category, testCount }] : []
  })

  return {
    batteryId: battery.id,
    categories: mappedCategories,
    ratingBands,
    maxTier: battery.maxTier,
    scoreMax: battery.scoreMax,
    testsByTrackWorkoutId,
    absoluteTier: { tableByEventId },
  }
}

export async function loadBenchmarkLeaderboardContext({
  competitionId,
  competitionType,
  trackWorkouts,
}: {
  competitionId: string
  competitionType: string
  trackWorkouts: readonly Pick<
    typeof trackWorkoutsTable.$inferSelect,
    "id" | "benchmarkTestId" | "benchmarkCategory"
  >[]
}): Promise<BenchmarkLeaderboardContext | null> {
  // Tier context is additive display data for benchmark competitions —
  // ranking comes from the online algorithm.
  if (!competitionCan(competitionType, "benchmarkScoringTiers")) {
    return null
  }

  const db = getDb()
  const [battery] = await db
    .select({
      id: benchmarkBatteriesTable.id,
      categories: benchmarkBatteriesTable.categories,
      ratingBands: benchmarkBatteriesTable.ratingBands,
      maxTier: benchmarkBatteriesTable.maxTier,
      scoreMax: benchmarkBatteriesTable.scoreMax,
    })
    .from(benchmarkBatteriesTable)
    .where(eq(benchmarkBatteriesTable.competitionId, competitionId))
    .limit(1)

  if (!battery) {
    return null
  }

  const tests = await db
    .select({
      id: benchmarkTestsTable.id,
      categoryKey: benchmarkTestsTable.categoryKey,
      name: benchmarkTestsTable.name,
      position: benchmarkTestsTable.position,
      scoreType: benchmarkTestsTable.scoreType,
      includedInScoring: benchmarkTestsTable.includedInScoring,
      scoreModel: benchmarkTestsTable.scoreModel,
      hybridFlipTier: benchmarkTestsTable.hybridFlipTier,
    })
    .from(benchmarkTestsTable)
    .where(eq(benchmarkTestsTable.batteryId, battery.id))
    .orderBy(asc(benchmarkTestsTable.position))

  const includedTestIds = tests
    .filter((test) => test.includedInScoring)
    .map((test) => test.id)

  const thresholds =
    includedTestIds.length > 0
      ? await db
          .select({
            testId: benchmarkTierThresholdsTable.testId,
            variant: benchmarkTierThresholdsTable.variant,
            tier: benchmarkTierThresholdsTable.tier,
            thresholdValue: benchmarkTierThresholdsTable.thresholdValue,
          })
          .from(benchmarkTierThresholdsTable)
          .where(inArray(benchmarkTierThresholdsTable.testId, includedTestIds))
      : []

  try {
    return buildBenchmarkLeaderboardContext({
      battery,
      tests,
      thresholds,
      trackWorkouts,
    })
  } catch (error) {
    // Tier context degrades gracefully: an incomplete tier setup means the
    // leaderboard simply renders without tier context instead of failing.
    if (error instanceof BenchmarkConfigError) {
      return null
    }
    throw error
  }
}

function parseBenchmarkCategories(raw: string): BenchmarkCategory[] {
  try {
    return benchmarkCategoriesSchema.parse(JSON.parse(raw))
  } catch (error) {
    throw new BenchmarkConfigError(
      `Benchmark categories are malformed: ${formatParseError(error)}`,
    )
  }
}

function parseBenchmarkRatingBands(raw: string): BenchmarkRatingBand[] {
  try {
    return benchmarkRatingBandsSchema.parse(JSON.parse(raw))
  } catch (error) {
    throw new BenchmarkConfigError(
      `Benchmark rating bands are malformed: ${formatParseError(error)}`,
    )
  }
}

/**
 * Validate and resolve a test's hybrid flip tier. Hybrid tests must flip
 * between tier 2 and maxTier so both dimensions have at least one threshold.
 */
export function resolveHybridFlipTier({
  testId,
  scoreModel,
  hybridFlipTier,
  maxTier,
}: {
  testId: string
  scoreModel: string
  hybridFlipTier: number | null
  maxTier: number
}): number | null {
  if (scoreModel !== "hybrid") {
    return null
  }
  if (
    hybridFlipTier === null ||
    hybridFlipTier < 2 ||
    hybridFlipTier > maxTier
  ) {
    throw new BenchmarkConfigError(
      `Benchmark test ${testId} uses hybrid scoring but its flip tier ${hybridFlipTier} is not between 2 and ${maxTier}`,
    )
  }
  return hybridFlipTier
}

function groupThresholdsByTestVariant(
  thresholds: readonly BenchmarkThresholdRow[],
): Map<string, Map<string, BenchmarkThresholdRow[]>> {
  const grouped = new Map<string, Map<string, BenchmarkThresholdRow[]>>()

  for (const threshold of thresholds) {
    const variantMap = grouped.get(threshold.testId) ?? new Map()
    const rows = variantMap.get(threshold.variant) ?? []
    rows.push(threshold)
    variantMap.set(threshold.variant, rows)
    grouped.set(threshold.testId, variantMap)
  }

  return grouped
}

function getCompleteVariantTables({
  testId,
  maxTier,
  thresholdsByTestVariant,
}: {
  testId: string
  maxTier: number
  thresholdsByTestVariant: Map<string, Map<string, BenchmarkThresholdRow[]>>
}): ReadonlyMap<string, readonly { tier: number; value: number }[]> {
  const variantRows = thresholdsByTestVariant.get(testId)
  if (!variantRows || variantRows.size === 0) {
    throw new BenchmarkConfigError(
      `Benchmark test ${testId} is missing threshold rows`,
    )
  }

  const thresholdsByVariant = new Map<
    string,
    readonly { tier: number; value: number }[]
  >()

  for (const variant of variantRows.keys()) {
    if (!benchmarkVariantSchema.safeParse(variant).success) {
      throw new BenchmarkConfigError(
        `Benchmark test ${testId} has unsupported variant ${variant}`,
      )
    }
  }

  for (const variant of benchmarkVariantSchema.options) {
    const rows = variantRows.get(variant)
    if (!rows) {
      throw new BenchmarkConfigError(
        `Benchmark test ${testId} is missing ${variant} thresholds`,
      )
    }

    const sorted = [...rows].sort((a, b) => a.tier - b.tier)
    const tierSet = new Set(sorted.map((row) => row.tier))
    for (let tier = 1; tier <= maxTier; tier++) {
      if (!tierSet.has(tier)) {
        throw new BenchmarkConfigError(
          `Benchmark test ${testId} variant ${variant} is missing tier ${tier}`,
        )
      }
    }

    if (sorted.length !== maxTier) {
      throw new BenchmarkConfigError(
        `Benchmark test ${testId} variant ${variant} must have exactly ${maxTier} thresholds`,
      )
    }

    thresholdsByVariant.set(
      variant,
      sorted.map((row) => ({
        tier: row.tier,
        value: row.thresholdValue,
      })),
    )
  }

  return thresholdsByVariant
}

function formatParseError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown parse error"
}
