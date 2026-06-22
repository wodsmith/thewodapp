import { and, asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import type { Database } from "@/db"
import {
  benchmarkBatteriesTable,
  benchmarkTestsTable,
  benchmarkTierThresholdsTable,
} from "@/db/schemas/benchmarks"
import { competitionsTable } from "@/db/schemas/competitions"
import { encodeScore } from "@/lib/scoring"
import { BenchmarkConfigError } from "@/lib/scoring/algorithms"
import type { WorkoutScheme } from "@/lib/scoring/types"
import {
  type BenchmarkCategory,
  type BenchmarkRatingBand,
  benchmarkCategoriesSchema,
  benchmarkRatingBandsSchema,
  benchmarkVariantSchema,
} from "@/schemas/benchmark.schema"
import type { ScoringConfig } from "@/types/scoring"

export interface BenchmarkTierThresholdInput {
  testId: string
  variant: string
  tier: number
  rawValue: string
}

interface PreparedBenchmarkTierThresholdUpdate
  extends BenchmarkTierThresholdInput {
  thresholdValue: number
}

export interface BenchmarkScoringTierThreshold {
  tier: number
  value: number
  rawValue: string
}

export interface BenchmarkScoringTierVariant {
  variant: string
  thresholds: BenchmarkScoringTierThreshold[]
}

export interface BenchmarkScoringTierTest {
  id: string
  name: string
  position: number
  categoryKey: string
  categoryLabel: string
  scheme: WorkoutScheme
  scoreType: string
  inputUnit: string
  includedInScoring: boolean
  variants: BenchmarkScoringTierVariant[]
}

export interface BenchmarkScoringTierCategory extends BenchmarkCategory {
  includedTestCount: number
  totalTestCount: number
  tests: BenchmarkScoringTierTest[]
}

export interface BenchmarkScoringTierSummary {
  competitionId: string
  isActive: boolean
  scoringConfig: ScoringConfig | null
  battery: {
    id: string
    name: string
    description: string | null
    status: string
    maxTier: number
    scoreMax: number
    videoPolicy: string
    isOpenJoin: boolean
  }
  categories: BenchmarkScoringTierCategory[]
  ratingBands: BenchmarkRatingBand[]
  variants: string[]
  includedTestCount: number
  deferredTestCount: number
  thresholdCount: number
}

interface BenchmarkBatteryTierRow {
  id: string
  name: string
  description: string | null
  status: string
  categories: string
  ratingBands: string
  maxTier: number
  scoreMax: number
  videoPolicy: string
  isOpenJoin: boolean
}

interface BenchmarkTestTierRow {
  id: string
  name: string
  position: number
  categoryKey: string
  scheme: string
  scoreType: string
  inputUnit: string
  includedInScoring: boolean
}

interface BenchmarkThresholdTierRow {
  testId: string
  variant: string
  tier: number
  thresholdValue: number
  rawValue: string
}

export const benchmarkTierThresholdInputSchema = z.object({
  testId: z.string().min(1),
  variant: benchmarkVariantSchema,
  tier: z.number().int().positive(),
  rawValue: z.string().min(1).max(255),
})

export function encodeBenchmarkThresholdValue({
  rawValue,
  inputUnit,
  scheme,
}: {
  rawValue: string
  inputUnit: string
  scheme: WorkoutScheme
}): number {
  let encoded: number | null

  if (inputUnit === "in") {
    const inches = Number.parseFloat(rawValue)
    encoded = Number.isFinite(inches)
      ? encodeScore(String(inches / 12), "feet", { unit: "ft" })
      : null
  } else if (inputUnit === "ft") {
    encoded = encodeScore(rawValue, scheme, { unit: "ft" })
  } else if (inputUnit === "lb") {
    encoded = encodeScore(rawValue, scheme, { unit: "lbs" })
  } else {
    encoded = encodeScore(rawValue, scheme)
  }

  if (encoded === null) {
    throw new BenchmarkConfigError(
      `Unable to encode benchmark threshold ${rawValue}`,
    )
  }

  return encoded
}

export function buildBenchmarkScoringTierSummary({
  competitionId,
  scoringConfig,
  battery,
  tests,
  thresholds,
}: {
  competitionId: string
  scoringConfig: ScoringConfig | null
  battery: BenchmarkBatteryTierRow
  tests: readonly BenchmarkTestTierRow[]
  thresholds: readonly BenchmarkThresholdTierRow[]
}): BenchmarkScoringTierSummary {
  const categories = parseBenchmarkCategories(battery.categories)
  const ratingBands = parseBenchmarkRatingBands(battery.ratingBands)
  const categoryByKey = new Map(
    categories.map((category) => [category.key, category]),
  )
  const groupedThresholds = groupThresholds(thresholds)
  const variants = [...new Set(thresholds.map((row) => row.variant))].sort()
  const testsByCategory = new Map<string, BenchmarkScoringTierTest[]>()

  for (const test of tests) {
    const category = categoryByKey.get(test.categoryKey)
    if (!category) {
      throw new BenchmarkConfigError(
        `Benchmark test ${test.id} references unknown category ${test.categoryKey}`,
      )
    }

    const variantsForTest = benchmarkVariantSchema.options.map((variant) => {
      const rows = groupedThresholds.get(`${test.id}:${variant}`) ?? []
      const sorted = [...rows].sort((a, b) => a.tier - b.tier)

      if (test.includedInScoring) {
        validateThresholdSet({
          testId: test.id,
          variant,
          maxTier: battery.maxTier,
          rows: sorted,
        })
      }

      return {
        variant,
        thresholds: sorted.map((row) => ({
          tier: row.tier,
          value: row.thresholdValue,
          rawValue: row.rawValue,
        })),
      }
    })

    const summaryTest: BenchmarkScoringTierTest = {
      id: test.id,
      name: test.name,
      position: test.position,
      categoryKey: test.categoryKey,
      categoryLabel: category.label,
      scheme: test.scheme as WorkoutScheme,
      scoreType: test.scoreType,
      inputUnit: test.inputUnit,
      includedInScoring: test.includedInScoring,
      variants: variantsForTest,
    }

    const categoryTests = testsByCategory.get(test.categoryKey) ?? []
    categoryTests.push(summaryTest)
    testsByCategory.set(test.categoryKey, categoryTests)
  }

  const categorySummaries = categories.map((category) => {
    const categoryTests = testsByCategory.get(category.key) ?? []
    return {
      ...category,
      includedTestCount: categoryTests.filter((test) => test.includedInScoring)
        .length,
      totalTestCount: categoryTests.length,
      tests: categoryTests.sort((a, b) => a.position - b.position),
    }
  })

  return {
    competitionId,
    isActive:
      scoringConfig?.algorithm === "absolute_tier" &&
      scoringConfig.absoluteTier?.batteryId === battery.id,
    scoringConfig,
    battery: {
      id: battery.id,
      name: battery.name,
      description: battery.description,
      status: battery.status,
      maxTier: battery.maxTier,
      scoreMax: battery.scoreMax,
      videoPolicy: battery.videoPolicy,
      isOpenJoin: battery.isOpenJoin,
    },
    categories: categorySummaries,
    ratingBands,
    variants,
    includedTestCount: tests.filter((test) => test.includedInScoring).length,
    deferredTestCount: tests.filter((test) => !test.includedInScoring).length,
    thresholdCount: thresholds.length,
  }
}

export async function loadBenchmarkScoringTierSummary({
  db,
  competitionId,
  scoringConfig,
}: {
  db: Database
  competitionId: string
  scoringConfig: ScoringConfig | null
}): Promise<BenchmarkScoringTierSummary> {
  const [battery] = await db
    .select({
      id: benchmarkBatteriesTable.id,
      name: benchmarkBatteriesTable.name,
      description: benchmarkBatteriesTable.description,
      status: benchmarkBatteriesTable.status,
      categories: benchmarkBatteriesTable.categories,
      ratingBands: benchmarkBatteriesTable.ratingBands,
      maxTier: benchmarkBatteriesTable.maxTier,
      scoreMax: benchmarkBatteriesTable.scoreMax,
      videoPolicy: benchmarkBatteriesTable.videoPolicy,
      isOpenJoin: benchmarkBatteriesTable.isOpenJoin,
    })
    .from(benchmarkBatteriesTable)
    .where(eq(benchmarkBatteriesTable.competitionId, competitionId))
    .limit(1)

  if (!battery) {
    throw new BenchmarkConfigError(
      "Benchmark competition is missing its battery",
    )
  }

  const tests = await db
    .select({
      id: benchmarkTestsTable.id,
      name: benchmarkTestsTable.name,
      position: benchmarkTestsTable.position,
      categoryKey: benchmarkTestsTable.categoryKey,
      scheme: benchmarkTestsTable.scheme,
      scoreType: benchmarkTestsTable.scoreType,
      inputUnit: benchmarkTestsTable.inputUnit,
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
            rawValue: benchmarkTierThresholdsTable.rawValue,
          })
          .from(benchmarkTierThresholdsTable)
          .where(inArray(benchmarkTierThresholdsTable.testId, includedTestIds))
      : []

  return buildBenchmarkScoringTierSummary({
    competitionId,
    scoringConfig,
    battery,
    tests,
    thresholds,
  })
}

export async function saveBenchmarkTierThresholds({
  db,
  competitionId,
  thresholds,
}: {
  db: Database
  competitionId: string
  thresholds: readonly BenchmarkTierThresholdInput[]
}): Promise<void> {
  const summary = await loadBenchmarkScoringTierSummary({
    db,
    competitionId,
    scoringConfig: null,
  })
  const tests = new Map(
    summary.categories
      .flatMap((category) => category.tests)
      .filter((test) => test.includedInScoring)
      .map((test) => [test.id, test]),
  )
  const updates = prepareBenchmarkTierThresholdUpdates({
    summary,
    tests,
    thresholds,
  })

  await db.transaction(async (tx) => {
    for (const update of updates) {
      await tx
        .update(benchmarkTierThresholdsTable)
        .set({
          rawValue: update.rawValue,
          thresholdValue: update.thresholdValue,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(benchmarkTierThresholdsTable.testId, update.testId),
            eq(benchmarkTierThresholdsTable.variant, update.variant),
            eq(benchmarkTierThresholdsTable.tier, update.tier),
          ),
        )
    }
  })
}

export function prepareBenchmarkTierThresholdUpdates({
  summary,
  tests,
  thresholds,
}: {
  summary: Pick<BenchmarkScoringTierSummary, "battery">
  tests: ReadonlyMap<string, BenchmarkScoringTierTest>
  thresholds: readonly BenchmarkTierThresholdInput[]
}): PreparedBenchmarkTierThresholdUpdate[] {
  return thresholds.map((threshold) => {
    const test = tests.get(threshold.testId)
    if (!test) {
      throw new BenchmarkConfigError(
        `Threshold update references unknown included benchmark test ${threshold.testId}`,
      )
    }
    if (threshold.tier < 1 || threshold.tier > summary.battery.maxTier) {
      throw new BenchmarkConfigError(
        `Threshold update for ${threshold.testId} has unsupported tier ${threshold.tier}`,
      )
    }

    const encoded = encodeBenchmarkThresholdValue({
      rawValue: threshold.rawValue,
      inputUnit: test.inputUnit,
      scheme: test.scheme,
    })

    return {
      ...threshold,
      thresholdValue: encoded,
    }
  })
}

export async function activateBenchmarkScoring({
  db,
  competitionId,
}: {
  db: Database
  competitionId: string
}): Promise<void> {
  const summary = await loadBenchmarkScoringTierSummary({
    db,
    competitionId,
    scoringConfig: null,
  })
  const [competition] = await db
    .select({ settings: competitionsTable.settings })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  const settings = parseSettings(competition?.settings)
  const existingConfig = settings.scoringConfig as ScoringConfig | undefined

  settings.scoringConfig = buildBenchmarkTierScoringConfig({
    batteryId: summary.battery.id,
    existingConfig,
  })

  await db
    .update(competitionsTable)
    .set({
      settings: JSON.stringify(settings),
      updatedAt: new Date(),
    })
    .where(eq(competitionsTable.id, competitionId))
}

export async function activateBenchmarkOnlineScoring({
  db,
  competitionId,
}: {
  db: Database
  competitionId: string
}): Promise<void> {
  const [competition] = await db
    .select({ settings: competitionsTable.settings })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  const settings = parseSettings(competition?.settings)
  const existingConfig = settings.scoringConfig as ScoringConfig | undefined
  settings.scoringConfig = buildBenchmarkOnlineScoringConfig(existingConfig)

  await db
    .update(competitionsTable)
    .set({
      settings: JSON.stringify(settings),
      updatedAt: new Date(),
    })
    .where(eq(competitionsTable.id, competitionId))
}

export function buildBenchmarkTierScoringConfig({
  batteryId,
  existingConfig,
}: {
  batteryId: string
  existingConfig: ScoringConfig | undefined
}): ScoringConfig {
  return {
    algorithm: "absolute_tier",
    absoluteTier: { batteryId },
    tiebreaker: existingConfig?.tiebreaker ?? { primary: "countback" },
    statusHandling: existingConfig?.statusHandling ?? defaultStatusHandling(),
  }
}

export function buildBenchmarkOnlineScoringConfig(
  existingConfig: ScoringConfig | undefined,
): ScoringConfig {
  return {
    algorithm: "online",
    tiebreaker: existingConfig?.tiebreaker ?? { primary: "countback" },
    statusHandling: existingConfig?.statusHandling ?? defaultStatusHandling(),
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

function groupThresholds(
  thresholds: readonly BenchmarkThresholdTierRow[],
): Map<string, BenchmarkThresholdTierRow[]> {
  const grouped = new Map<string, BenchmarkThresholdTierRow[]>()
  for (const threshold of thresholds) {
    const key = `${threshold.testId}:${threshold.variant}`
    const rows = grouped.get(key) ?? []
    rows.push(threshold)
    grouped.set(key, rows)
  }
  return grouped
}

function validateThresholdSet({
  testId,
  variant,
  maxTier,
  rows,
}: {
  testId: string
  variant: string
  maxTier: number
  rows: readonly BenchmarkThresholdTierRow[]
}) {
  if (rows.length !== maxTier) {
    throw new BenchmarkConfigError(
      `Benchmark test ${testId} variant ${variant} must have exactly ${maxTier} thresholds`,
    )
  }

  const tiers = new Set(rows.map((row) => row.tier))
  for (let tier = 1; tier <= maxTier; tier++) {
    if (!tiers.has(tier)) {
      throw new BenchmarkConfigError(
        `Benchmark test ${testId} variant ${variant} is missing tier ${tier}`,
      )
    }
  }
}

function parseSettings(
  settings: string | null | undefined,
): Record<string, unknown> {
  if (!settings) return {}
  try {
    return JSON.parse(settings) as Record<string, unknown>
  } catch {
    return {}
  }
}

function defaultStatusHandling(): ScoringConfig["statusHandling"] {
  return {
    dnf: "zero",
    dns: "zero",
    withdrawn: "zero",
  }
}

function formatParseError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown parse error"
}
