import { asc, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
  benchmarkBatteriesTable,
  benchmarkTestsTable,
  benchmarkTierThresholdsTable,
} from "@/db/schemas/benchmarks"
import type { trackWorkoutsTable } from "@/db/schemas/programming"
import {
  type AbsoluteTierEventTable,
  type AbsoluteTierScoringContext,
  BenchmarkConfigError,
} from "@/lib/scoring/algorithms"
import type { ScoreType } from "@/lib/scoring/types"
import {
  benchmarkCategoriesSchema,
  benchmarkRatingBandsSchema,
  benchmarkVariantSchema,
  getBenchmarkCategoryCountIssues,
  type BenchmarkCategory,
  type BenchmarkRatingBand,
} from "@/schemas/benchmark.schema"
import type { ScoringConfig } from "@/types/scoring"

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
  const trackWorkoutByTestId = new Map<string, string>()

  for (const trackWorkout of trackWorkouts) {
    if (!trackWorkout.benchmarkTestId) {
      throw new BenchmarkConfigError(
        `Benchmark event ${trackWorkout.id} is missing benchmarkTestId`,
      )
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
    })
  }

  for (const test of tests) {
    if (!trackWorkoutByTestId.has(test.id)) {
      throw new BenchmarkConfigError(
        `Benchmark test ${test.id} is missing a mapped track workout`,
      )
    }
  }

  return {
    batteryId: battery.id,
    categories,
    ratingBands,
    maxTier: battery.maxTier,
    scoreMax: battery.scoreMax,
    testsByTrackWorkoutId,
    absoluteTier: { tableByEventId },
  }
}

export async function loadBenchmarkLeaderboardContext({
  competitionId,
  scoringConfig,
  trackWorkouts,
}: {
  competitionId: string
  scoringConfig: ScoringConfig
  trackWorkouts: readonly Pick<
    typeof trackWorkoutsTable.$inferSelect,
    "id" | "benchmarkTestId" | "benchmarkCategory"
  >[]
}): Promise<BenchmarkLeaderboardContext | null> {
  if (scoringConfig.algorithm !== "absolute_tier") {
    return null
  }

  const configuredBatteryId = scoringConfig.absoluteTier?.batteryId
  if (!configuredBatteryId) {
    throw new BenchmarkConfigError(
      "absolute_tier leaderboard requires a benchmark battery id",
    )
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
    throw new BenchmarkConfigError(
      "absolute_tier leaderboard is missing its benchmark battery",
    )
  }

  if (battery.id !== configuredBatteryId) {
    throw new BenchmarkConfigError(
      `absolute_tier leaderboard battery ${configuredBatteryId} does not match competition battery ${battery.id}`,
    )
  }

  const tests = await db
    .select({
      id: benchmarkTestsTable.id,
      categoryKey: benchmarkTestsTable.categoryKey,
      name: benchmarkTestsTable.name,
      position: benchmarkTestsTable.position,
      scoreType: benchmarkTestsTable.scoreType,
      includedInScoring: benchmarkTestsTable.includedInScoring,
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

  return buildBenchmarkLeaderboardContext({
    battery,
    tests,
    thresholds,
    trackWorkouts,
  })
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
