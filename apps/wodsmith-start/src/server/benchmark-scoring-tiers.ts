import { and, asc, eq, gt, inArray } from "drizzle-orm"
import { z } from "zod"
import type { Database } from "@/db"
import {
  benchmarkBatteriesTable,
  benchmarkTestsTable,
  benchmarkTierThresholdsTable,
} from "@/db/schemas/benchmarks"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { workouts } from "@/db/schemas/workouts"
import { encodeScore } from "@/lib/scoring"
import { BenchmarkConfigError } from "@/lib/scoring/algorithms"
import type { WorkoutScheme } from "@/lib/scoring/types"
import {
  type BenchmarkBatterySettingsInput,
  type BenchmarkCategory,
  type BenchmarkCategoryInput,
  type BenchmarkRatingBand,
  type BenchmarkTestCreateInput,
  type BenchmarkTestThresholdInput,
  type BenchmarkTestUpdateInput,
  benchmarkCategoriesSchema,
  benchmarkRatingBandsSchema,
  benchmarkVariantSchema,
} from "@/schemas/benchmark.schema"

type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

interface EncodedBenchmarkTestThresholdRow {
  variant: string
  tier: number
  rawValue: string
  thresholdValue: number
}

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

export interface BenchmarkScoringTierLinkedEvent {
  trackWorkoutId: string
  eventName: string
}

export interface BenchmarkScoringTierEventOption {
  trackWorkoutId: string
  eventName: string
  linkedTestId: string | null
  linkedTestName: string | null
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
  scoreModel: string
  hybridFlipTier: number | null
  linkedEvent: BenchmarkScoringTierLinkedEvent | null
  variants: BenchmarkScoringTierVariant[]
}

export interface BenchmarkScoringTierCategory extends BenchmarkCategory {
  includedTestCount: number
  totalTestCount: number
  tests: BenchmarkScoringTierTest[]
}

export interface BenchmarkScoringTierSummary {
  competitionId: string
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
  /** Competition events (scored leaves only) with their linked test, for the event picker. */
  events: BenchmarkScoringTierEventOption[]
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
  scoreModel: string
  hybridFlipTier: number | null
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

/**
 * Which dimension a hybrid test's threshold at a given tier measures: tiers
 * below the flip are reps completed at the time cap, tiers at or above it
 * are finish times. Standard tests always use the score dimension.
 */
export function benchmarkThresholdDimension({
  tier,
  scoreModel,
  hybridFlipTier,
}: {
  tier: number
  scoreModel: string
  hybridFlipTier: number | null
}): "score" | "cap_reps" {
  if (
    scoreModel === "hybrid" &&
    hybridFlipTier !== null &&
    tier < hybridFlipTier
  ) {
    return "cap_reps"
  }
  return "score"
}

export function encodeBenchmarkThresholdValue({
  rawValue,
  inputUnit,
  scheme,
  dimension = "score",
}: {
  rawValue: string
  inputUnit: string
  scheme: WorkoutScheme
  dimension?: "score" | "cap_reps"
}): number {
  let encoded: number | null

  if (dimension === "cap_reps") {
    // parseInt would silently truncate a time like "19:59" to 19, so require
    // a plain whole number for capped-reps tiers.
    if (!/^\d+$/.test(rawValue.trim())) {
      throw new BenchmarkConfigError(
        `Capped-reps threshold ${rawValue} must be a whole number of reps`,
      )
    }
    encoded = encodeScore(rawValue, "reps")
    if (encoded === null) {
      throw new BenchmarkConfigError(
        `Unable to encode benchmark capped-reps threshold ${rawValue}`,
      )
    }
    return encoded
  }

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
  battery,
  tests,
  thresholds,
  linkedEventsByTestId,
  events,
}: {
  competitionId: string
  battery: BenchmarkBatteryTierRow
  tests: readonly BenchmarkTestTierRow[]
  thresholds: readonly BenchmarkThresholdTierRow[]
  linkedEventsByTestId?: ReadonlyMap<string, BenchmarkScoringTierLinkedEvent>
  events?: readonly BenchmarkScoringTierEventOption[]
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
      scoreModel: test.scoreModel,
      hybridFlipTier: test.hybridFlipTier,
      linkedEvent: linkedEventsByTestId?.get(test.id) ?? null,
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
    events: events ? [...events] : [],
  }
}

export async function loadBenchmarkScoringTierSummary({
  db,
  competitionId,
}: {
  db: Database
  competitionId: string
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
      "This competition's benchmark configuration has not been set up yet",
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
            rawValue: benchmarkTierThresholdsTable.rawValue,
          })
          .from(benchmarkTierThresholdsTable)
          .where(inArray(benchmarkTierThresholdsTable.testId, includedTestIds))
      : []

  const eventRows = await loadBenchmarkCompetitionEventRows({
    db,
    competitionId,
  })
  const testNameById = new Map(tests.map((test) => [test.id, test.name]))
  const events: BenchmarkScoringTierEventOption[] = eventRows.map((row) => ({
    trackWorkoutId: row.trackWorkoutId,
    eventName: row.eventName,
    linkedTestId: row.benchmarkTestId,
    linkedTestName: row.benchmarkTestId
      ? (testNameById.get(row.benchmarkTestId) ?? null)
      : null,
  }))

  return buildBenchmarkScoringTierSummary({
    competitionId,
    battery,
    tests,
    thresholds,
    linkedEventsByTestId: buildLinkedEventsByTestId(eventRows),
    events,
  })
}

export interface BenchmarkEventTestOption {
  id: string
  name: string
  categoryKey: string
  categoryLabel: string
  linkedTrackWorkoutId: string | null
  linkedEventName: string | null
}

export interface BenchmarkEventTestOptionsResult {
  battery: {
    maxTier: number
    categories: { key: string; label: string }[]
  }
  tests: BenchmarkEventTestOption[]
  events: BenchmarkScoringTierEventOption[]
}

/**
 * A benchmark competition's tests, battery config, and events for the event
 * editor's link/create UI. Lenient by design: skips threshold validation so
 * the editor works while the tier table is still incomplete. Returns null
 * when the competition has no battery yet.
 */
export async function loadBenchmarkEventTestOptions({
  db,
  competitionId,
}: {
  db: Database
  competitionId: string
}): Promise<BenchmarkEventTestOptionsResult | null> {
  const [battery] = await db
    .select({
      id: benchmarkBatteriesTable.id,
      categories: benchmarkBatteriesTable.categories,
      maxTier: benchmarkBatteriesTable.maxTier,
    })
    .from(benchmarkBatteriesTable)
    .where(eq(benchmarkBatteriesTable.competitionId, competitionId))
    .limit(1)

  if (!battery) {
    return null
  }

  const [tests, eventRows] = await Promise.all([
    db
      .select({
        id: benchmarkTestsTable.id,
        name: benchmarkTestsTable.name,
        categoryKey: benchmarkTestsTable.categoryKey,
      })
      .from(benchmarkTestsTable)
      .where(eq(benchmarkTestsTable.batteryId, battery.id))
      .orderBy(asc(benchmarkTestsTable.position)),
    loadBenchmarkCompetitionEventRows({ db, competitionId }),
  ])

  const linkedEventsByTestId = buildLinkedEventsByTestId(eventRows)
  const categories = parseBenchmarkCategories(battery.categories)
  const categoryLabelByKey = new Map(
    categories.map((category) => [category.key, category.label]),
  )
  const testNameById = new Map(tests.map((test) => [test.id, test.name]))

  return {
    battery: {
      maxTier: battery.maxTier,
      categories: categories.map((category) => ({
        key: category.key,
        label: category.label,
      })),
    },
    tests: tests.map((test) => {
      const linkedEvent = linkedEventsByTestId.get(test.id) ?? null
      return {
        id: test.id,
        name: test.name,
        categoryKey: test.categoryKey,
        categoryLabel:
          categoryLabelByKey.get(test.categoryKey) ?? test.categoryKey,
        linkedTrackWorkoutId: linkedEvent?.trackWorkoutId ?? null,
        linkedEventName: linkedEvent?.eventName ?? null,
      }
    }),
    events: eventRows.map((row) => ({
      trackWorkoutId: row.trackWorkoutId,
      eventName: row.eventName,
      linkedTestId: row.benchmarkTestId,
      linkedTestName: row.benchmarkTestId
        ? (testNameById.get(row.benchmarkTestId) ?? null)
        : null,
    })),
  }
}

interface BenchmarkCompetitionEventRow {
  trackWorkoutId: string
  eventName: string
  benchmarkTestId: string | null
}

/**
 * Scored leaf events for a competition (parents that only group sub-events
 * are excluded) with their benchmark test link, ordered by track order.
 */
async function loadBenchmarkCompetitionEventRows({
  db,
  competitionId,
}: {
  db: Database
  competitionId: string
}): Promise<BenchmarkCompetitionEventRow[]> {
  const rows = await db
    .select({
      trackWorkoutId: trackWorkoutsTable.id,
      parentEventId: trackWorkoutsTable.parentEventId,
      eventName: workouts.name,
      benchmarkTestId: trackWorkoutsTable.benchmarkTestId,
    })
    .from(trackWorkoutsTable)
    .innerJoin(
      programmingTracksTable,
      eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
    )
    .innerJoin(workouts, eq(trackWorkoutsTable.workoutId, workouts.id))
    .where(eq(programmingTracksTable.competitionId, competitionId))
    .orderBy(asc(trackWorkoutsTable.trackOrder))

  const parentIds = new Set(
    rows.map((row) => row.parentEventId).filter(Boolean),
  )
  return rows
    .filter((row) => !parentIds.has(row.trackWorkoutId))
    .map(({ trackWorkoutId, eventName, benchmarkTestId }) => ({
      trackWorkoutId,
      eventName,
      benchmarkTestId,
    }))
}

function buildLinkedEventsByTestId(
  rows: readonly BenchmarkCompetitionEventRow[],
): Map<string, BenchmarkScoringTierLinkedEvent> {
  const linkedEventsByTestId = new Map<
    string,
    BenchmarkScoringTierLinkedEvent
  >()
  for (const row of rows) {
    if (!row.benchmarkTestId) continue
    linkedEventsByTestId.set(row.benchmarkTestId, {
      trackWorkoutId: row.trackWorkoutId,
      eventName: row.eventName,
    })
  }
  return linkedEventsByTestId
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
    await upsertBenchmarkTierThresholdRows(
      tx,
      updates.map((update) => ({
        testId: update.testId,
        variant: update.variant,
        tier: update.tier,
        rawValue: update.rawValue,
        thresholdValue: update.thresholdValue,
      })),
    )
  })
}

async function upsertBenchmarkTierThresholdRows(
  tx: DbTransaction,
  rows: readonly (EncodedBenchmarkTestThresholdRow & { testId: string })[],
): Promise<void> {
  for (const row of rows) {
    await tx
      .insert(benchmarkTierThresholdsTable)
      .values({
        testId: row.testId,
        variant: row.variant,
        tier: row.tier,
        rawValue: row.rawValue,
        thresholdValue: row.thresholdValue,
      })
      .onDuplicateKeyUpdate({
        set: {
          rawValue: row.rawValue,
          thresholdValue: row.thresholdValue,
          updatedAt: new Date(),
        },
      })
  }
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
      dimension: benchmarkThresholdDimension({
        tier: threshold.tier,
        scoreModel: test.scoreModel,
        hybridFlipTier: test.hybridFlipTier,
      }),
    })

    return {
      ...threshold,
      thresholdValue: encoded,
    }
  })
}

export function assertBenchmarkRatingBandsWithinScoreMax({
  ratingBands,
  scoreMax,
}: {
  ratingBands: readonly BenchmarkRatingBand[]
  scoreMax: number
}): void {
  for (const band of ratingBands) {
    if (band.minScore < 0 || band.maxScore > scoreMax) {
      throw new BenchmarkConfigError(
        `Rating band ${band.key} must fall within 0 and ${scoreMax}`,
      )
    }
  }
}

export function prepareBenchmarkRatingBands({
  ratingBands,
  scoreMax,
}: {
  ratingBands: readonly BenchmarkRatingBand[]
  scoreMax: number
}): BenchmarkRatingBand[] {
  const seen = new Set<string>()
  for (const band of ratingBands) {
    if (seen.has(band.key)) {
      throw new BenchmarkConfigError(
        `Duplicate benchmark rating band key: ${band.key}`,
      )
    }
    seen.add(band.key)
  }

  assertBenchmarkRatingBandsWithinScoreMax({ ratingBands, scoreMax })

  const sorted = [...ratingBands].sort((a, b) => a.minScore - b.minScore)
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1]
    const current = sorted[index]
    if (current.minScore <= previous.maxScore) {
      throw new BenchmarkConfigError(
        `Rating bands ${previous.key} and ${current.key} overlap`,
      )
    }
  }

  return sorted
}

export function recomputeCategoryTestCounts(
  categories: readonly BenchmarkCategory[],
  tests: Iterable<{ categoryKey: string; includedInScoring: boolean }>,
): BenchmarkCategory[] {
  const counts = new Map<string, number>()
  for (const test of tests) {
    if (!test.includedInScoring) continue
    counts.set(test.categoryKey, (counts.get(test.categoryKey) ?? 0) + 1)
  }
  return categories.map((category) => ({
    ...category,
    testCount: counts.get(category.key) ?? 0,
  }))
}

export function prepareBenchmarkCategories({
  categories,
  tests,
}: {
  categories: readonly BenchmarkCategoryInput[]
  tests: readonly { categoryKey: string; includedInScoring: boolean }[]
}): BenchmarkCategory[] {
  const seen = new Set<string>()
  for (const category of categories) {
    if (seen.has(category.key)) {
      throw new BenchmarkConfigError(
        `Duplicate benchmark category key: ${category.key}`,
      )
    }
    seen.add(category.key)
  }

  for (const referencedKey of new Set(tests.map((test) => test.categoryKey))) {
    if (!seen.has(referencedKey)) {
      throw new BenchmarkConfigError(
        `Cannot remove category ${referencedKey} while benchmark tests still reference it`,
      )
    }
  }

  const base = categories.map((category) => ({
    key: category.key,
    label: category.label,
    weight: category.weight,
    testCount: 0,
  }))
  return recomputeCategoryTestCounts(base, tests)
}

/**
 * Validate a test's score model configuration. Hybrid tests must be
 * time-with-cap and flip between tier 2 and maxTier so both the capped-reps
 * and time dimensions have at least one threshold; standard tests carry no
 * flip tier.
 */
export function resolveBenchmarkTestScoreModel({
  scheme,
  scoreModel,
  hybridFlipTier,
  maxTier,
}: {
  scheme: string
  scoreModel: string | undefined
  hybridFlipTier: number | null | undefined
  maxTier: number
}): { scoreModel: string; hybridFlipTier: number | null } {
  const resolvedModel = scoreModel ?? "standard"

  if (resolvedModel !== "hybrid") {
    return { scoreModel: resolvedModel, hybridFlipTier: null }
  }

  if (scheme !== "time-with-cap") {
    throw new BenchmarkConfigError(
      "Hybrid reps/time scoring requires the time-with-cap scheme",
    )
  }

  if (
    hybridFlipTier === null ||
    hybridFlipTier === undefined ||
    hybridFlipTier < 2 ||
    hybridFlipTier > maxTier
  ) {
    throw new BenchmarkConfigError(
      `Hybrid benchmark tests need a flip tier between 2 and ${maxTier}`,
    )
  }

  return { scoreModel: resolvedModel, hybridFlipTier }
}

export function assertBenchmarkVariantThresholdsComplete({
  maxTier,
  thresholds,
}: {
  maxTier: number
  thresholds: readonly { variant: string; tier: number }[]
}): void {
  for (const variant of benchmarkVariantSchema.options) {
    const rows = thresholds.filter((row) => row.variant === variant)
    if (rows.length !== maxTier) {
      throw new BenchmarkConfigError(
        `Benchmark test variant ${variant} must have exactly ${maxTier} thresholds`,
      )
    }
    const tiers = new Set(rows.map((row) => row.tier))
    for (let tier = 1; tier <= maxTier; tier++) {
      if (!tiers.has(tier)) {
        throw new BenchmarkConfigError(
          `Benchmark test variant ${variant} is missing tier ${tier}`,
        )
      }
    }
  }
}

export function encodeBenchmarkTestThresholds({
  scheme,
  inputUnit,
  scoreModel,
  hybridFlipTier,
  thresholds,
}: {
  scheme: WorkoutScheme
  inputUnit: string
  scoreModel: string
  hybridFlipTier: number | null
  thresholds: readonly BenchmarkTestThresholdInput[]
}): EncodedBenchmarkTestThresholdRow[] {
  return thresholds.map((threshold) => ({
    variant: threshold.variant,
    tier: threshold.tier,
    rawValue: threshold.rawValue,
    thresholdValue: encodeBenchmarkThresholdValue({
      rawValue: threshold.rawValue,
      inputUnit,
      scheme,
      dimension: benchmarkThresholdDimension({
        tier: threshold.tier,
        scoreModel,
        hybridFlipTier,
      }),
    }),
  }))
}

export function resolveBenchmarkTestThresholdRows({
  scheme,
  inputUnit,
  scoreModel,
  hybridFlipTier,
  existing,
  overrides,
}: {
  scheme: WorkoutScheme
  inputUnit: string
  scoreModel: string
  hybridFlipTier: number | null
  existing: readonly { variant: string; tier: number; rawValue: string }[]
  overrides?: readonly BenchmarkTestThresholdInput[]
}): EncodedBenchmarkTestThresholdRow[] {
  const merged = new Map<
    string,
    { variant: string; tier: number; rawValue: string }
  >()
  for (const row of existing) {
    merged.set(`${row.variant}:${row.tier}`, {
      variant: row.variant,
      tier: row.tier,
      rawValue: row.rawValue,
    })
  }
  for (const row of overrides ?? []) {
    merged.set(`${row.variant}:${row.tier}`, {
      variant: row.variant,
      tier: row.tier,
      rawValue: row.rawValue,
    })
  }

  return [...merged.values()].map((row) => ({
    variant: row.variant,
    tier: row.tier,
    rawValue: row.rawValue,
    thresholdValue: encodeBenchmarkThresholdValue({
      rawValue: row.rawValue,
      inputUnit,
      scheme,
      dimension: benchmarkThresholdDimension({
        tier: row.tier,
        scoreModel,
        hybridFlipTier,
      }),
    }),
  }))
}

export function buildBenchmarkMaxTierGrowthRows({
  oldMaxTier,
  newMaxTier,
  thresholds,
}: {
  oldMaxTier: number
  newMaxTier: number
  thresholds: readonly BenchmarkThresholdTierRow[]
}): (EncodedBenchmarkTestThresholdRow & { testId: string })[] {
  if (newMaxTier <= oldMaxTier) return []

  const highestByKey = new Map<string, BenchmarkThresholdTierRow>()
  for (const row of thresholds) {
    const key = `${row.testId}:${row.variant}`
    const current = highestByKey.get(key)
    if (!current || row.tier > current.tier) {
      highestByKey.set(key, row)
    }
  }

  const rows: (EncodedBenchmarkTestThresholdRow & { testId: string })[] = []
  for (const source of highestByKey.values()) {
    for (let tier = oldMaxTier + 1; tier <= newMaxTier; tier++) {
      rows.push({
        testId: source.testId,
        variant: source.variant,
        tier,
        rawValue: source.rawValue,
        thresholdValue: source.thresholdValue,
      })
    }
  }
  return rows
}

async function getBenchmarkBatteryRow(db: Database, competitionId: string) {
  const [battery] = await db
    .select({
      id: benchmarkBatteriesTable.id,
      name: benchmarkBatteriesTable.name,
      description: benchmarkBatteriesTable.description,
      categories: benchmarkBatteriesTable.categories,
      ratingBands: benchmarkBatteriesTable.ratingBands,
      maxTier: benchmarkBatteriesTable.maxTier,
      scoreMax: benchmarkBatteriesTable.scoreMax,
      videoPolicy: benchmarkBatteriesTable.videoPolicy,
    })
    .from(benchmarkBatteriesTable)
    .where(eq(benchmarkBatteriesTable.competitionId, competitionId))
    .limit(1)

  if (!battery) {
    throw new BenchmarkConfigError(
      "This competition's benchmark configuration has not been set up yet",
    )
  }

  return battery
}

async function loadBenchmarkTestCategoryRows(
  db: Database | DbTransaction,
  batteryId: string,
): Promise<{ categoryKey: string; includedInScoring: boolean }[]> {
  return db
    .select({
      categoryKey: benchmarkTestsTable.categoryKey,
      includedInScoring: benchmarkTestsTable.includedInScoring,
    })
    .from(benchmarkTestsTable)
    .where(eq(benchmarkTestsTable.batteryId, batteryId))
}

async function persistRecomputedCategoryTestCounts(
  tx: DbTransaction,
  batteryId: string,
  rawCategories: string,
): Promise<void> {
  const categories = parseBenchmarkCategories(rawCategories)
  const tests = await loadBenchmarkTestCategoryRows(tx, batteryId)
  const updated = recomputeCategoryTestCounts(categories, tests)
  await tx
    .update(benchmarkBatteriesTable)
    .set({ categories: JSON.stringify(updated), updatedAt: new Date() })
    .where(eq(benchmarkBatteriesTable.id, batteryId))
}

export async function updateBenchmarkRatingBands({
  db,
  competitionId,
  ratingBands,
}: {
  db: Database
  competitionId: string
  ratingBands: readonly BenchmarkRatingBand[]
}): Promise<void> {
  const battery = await getBenchmarkBatteryRow(db, competitionId)
  const prepared = prepareBenchmarkRatingBands({
    ratingBands,
    scoreMax: battery.scoreMax,
  })

  await db
    .update(benchmarkBatteriesTable)
    .set({ ratingBands: JSON.stringify(prepared), updatedAt: new Date() })
    .where(eq(benchmarkBatteriesTable.id, battery.id))
}

export async function updateBenchmarkCategories({
  db,
  competitionId,
  categories,
}: {
  db: Database
  competitionId: string
  categories: readonly BenchmarkCategoryInput[]
}): Promise<void> {
  const battery = await getBenchmarkBatteryRow(db, competitionId)
  const tests = await loadBenchmarkTestCategoryRows(db, battery.id)
  const prepared = prepareBenchmarkCategories({ categories, tests })

  await db
    .update(benchmarkBatteriesTable)
    .set({ categories: JSON.stringify(prepared), updatedAt: new Date() })
    .where(eq(benchmarkBatteriesTable.id, battery.id))
}

export async function createBenchmarkTest({
  db,
  competitionId,
  test,
  linkTrackWorkoutId,
}: {
  db: Database
  competitionId: string
  test: BenchmarkTestCreateInput
  linkTrackWorkoutId?: string | null
}): Promise<{ testId: string }> {
  const battery = await getBenchmarkBatteryRow(db, competitionId)
  const categories = parseBenchmarkCategories(battery.categories)
  if (!categories.some((category) => category.key === test.categoryKey)) {
    throw new BenchmarkConfigError(
      `Benchmark test references unknown category ${test.categoryKey}`,
    )
  }

  if (linkTrackWorkoutId) {
    const [eventRow] = await db
      .select({
        id: trackWorkoutsTable.id,
        benchmarkTestId: trackWorkoutsTable.benchmarkTestId,
      })
      .from(trackWorkoutsTable)
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .where(
        and(
          eq(trackWorkoutsTable.id, linkTrackWorkoutId),
          eq(programmingTracksTable.competitionId, competitionId),
        ),
      )
      .limit(1)

    if (!eventRow) {
      throw new BenchmarkConfigError("Event not found in this competition")
    }
    if (eventRow.benchmarkTestId) {
      throw new BenchmarkConfigError(
        "This event is already linked to a benchmark test",
      )
    }
  }

  const existingTests = await db
    .select({ position: benchmarkTestsTable.position })
    .from(benchmarkTestsTable)
    .where(eq(benchmarkTestsTable.batteryId, battery.id))
  const nextPosition =
    existingTests.reduce((max, row) => Math.max(max, row.position), 0) + 1

  const scoreModelConfig = resolveBenchmarkTestScoreModel({
    scheme: test.scheme,
    scoreModel: test.scoreModel,
    hybridFlipTier: test.hybridFlipTier,
    maxTier: battery.maxTier,
  })

  let thresholdRows: EncodedBenchmarkTestThresholdRow[] = []
  if (test.includedInScoring) {
    if (!test.thresholds) {
      throw new BenchmarkConfigError(
        "Included benchmark tests require a complete threshold table",
      )
    }
    assertBenchmarkVariantThresholdsComplete({
      maxTier: battery.maxTier,
      thresholds: test.thresholds,
    })
    thresholdRows = encodeBenchmarkTestThresholds({
      scheme: test.scheme as WorkoutScheme,
      inputUnit: test.inputUnit,
      scoreModel: scoreModelConfig.scoreModel,
      hybridFlipTier: scoreModelConfig.hybridFlipTier,
      thresholds: test.thresholds,
    })
  } else if (test.thresholds) {
    thresholdRows = encodeBenchmarkTestThresholds({
      scheme: test.scheme as WorkoutScheme,
      inputUnit: test.inputUnit,
      scoreModel: scoreModelConfig.scoreModel,
      hybridFlipTier: scoreModelConfig.hybridFlipTier,
      thresholds: test.thresholds,
    })
  }

  let createdTestId = ""
  await db.transaction(async (tx) => {
    await tx.insert(benchmarkTestsTable).values({
      batteryId: battery.id,
      categoryKey: test.categoryKey,
      name: test.name,
      position: nextPosition,
      scheme: test.scheme,
      scoreType: test.scoreType,
      inputUnit: test.inputUnit,
      includedInScoring: test.includedInScoring,
      scoreModel: scoreModelConfig.scoreModel as "standard" | "hybrid",
      hybridFlipTier: scoreModelConfig.hybridFlipTier,
    })

    const [created] = await tx
      .select({ id: benchmarkTestsTable.id })
      .from(benchmarkTestsTable)
      .where(
        and(
          eq(benchmarkTestsTable.batteryId, battery.id),
          eq(benchmarkTestsTable.position, nextPosition),
        ),
      )
      .limit(1)

    if (!created) {
      throw new BenchmarkConfigError("Failed to create benchmark test")
    }
    createdTestId = created.id

    if (thresholdRows.length > 0) {
      await upsertBenchmarkTierThresholdRows(
        tx,
        thresholdRows.map((row) => ({ ...row, testId: created.id })),
      )
    }

    if (linkTrackWorkoutId) {
      await tx
        .update(trackWorkoutsTable)
        .set({
          benchmarkTestId: created.id,
          benchmarkCategory: test.categoryKey,
          updatedAt: new Date(),
        })
        .where(eq(trackWorkoutsTable.id, linkTrackWorkoutId))
    }

    await persistRecomputedCategoryTestCounts(
      tx,
      battery.id,
      battery.categories,
    )
  })

  return { testId: createdTestId }
}

export async function updateBenchmarkTest({
  db,
  competitionId,
  testId,
  updates,
}: {
  db: Database
  competitionId: string
  testId: string
  updates: BenchmarkTestUpdateInput
}): Promise<void> {
  const battery = await getBenchmarkBatteryRow(db, competitionId)

  const [existing] = await db
    .select({
      id: benchmarkTestsTable.id,
      categoryKey: benchmarkTestsTable.categoryKey,
      scheme: benchmarkTestsTable.scheme,
      inputUnit: benchmarkTestsTable.inputUnit,
      includedInScoring: benchmarkTestsTable.includedInScoring,
      scoreModel: benchmarkTestsTable.scoreModel,
      hybridFlipTier: benchmarkTestsTable.hybridFlipTier,
    })
    .from(benchmarkTestsTable)
    .where(
      and(
        eq(benchmarkTestsTable.id, testId),
        eq(benchmarkTestsTable.batteryId, battery.id),
      ),
    )
    .limit(1)

  if (!existing) {
    throw new BenchmarkConfigError(`Benchmark test ${testId} not found`)
  }

  const finalCategoryKey = updates.categoryKey ?? existing.categoryKey
  if (updates.categoryKey !== undefined) {
    const categories = parseBenchmarkCategories(battery.categories)
    if (!categories.some((category) => category.key === finalCategoryKey)) {
      throw new BenchmarkConfigError(
        `Benchmark test references unknown category ${finalCategoryKey}`,
      )
    }
  }

  const finalScheme = (updates.scheme ?? existing.scheme) as WorkoutScheme
  const finalInputUnit = updates.inputUnit ?? existing.inputUnit
  const finalIncluded = updates.includedInScoring ?? existing.includedInScoring

  const scoreModelConfig = resolveBenchmarkTestScoreModel({
    scheme: finalScheme,
    scoreModel: updates.scoreModel ?? existing.scoreModel,
    hybridFlipTier:
      updates.hybridFlipTier !== undefined
        ? updates.hybridFlipTier
        : existing.hybridFlipTier,
    maxTier: battery.maxTier,
  })

  const schemeChanged =
    updates.scheme !== undefined && updates.scheme !== existing.scheme
  const inputUnitChanged =
    updates.inputUnit !== undefined && updates.inputUnit !== existing.inputUnit
  const scoreModelChanged =
    scoreModelConfig.scoreModel !== existing.scoreModel ||
    scoreModelConfig.hybridFlipTier !== existing.hybridFlipTier
  const togglingOn = finalIncluded && !existing.includedInScoring
  const needsThresholdWork =
    updates.thresholds !== undefined ||
    schemeChanged ||
    inputUnitChanged ||
    scoreModelChanged ||
    togglingOn

  let thresholdRows: EncodedBenchmarkTestThresholdRow[] = []
  if (needsThresholdWork) {
    const existingThresholds = await db
      .select({
        variant: benchmarkTierThresholdsTable.variant,
        tier: benchmarkTierThresholdsTable.tier,
        rawValue: benchmarkTierThresholdsTable.rawValue,
      })
      .from(benchmarkTierThresholdsTable)
      .where(eq(benchmarkTierThresholdsTable.testId, testId))

    thresholdRows = resolveBenchmarkTestThresholdRows({
      scheme: finalScheme,
      inputUnit: finalInputUnit,
      scoreModel: scoreModelConfig.scoreModel,
      hybridFlipTier: scoreModelConfig.hybridFlipTier,
      existing: existingThresholds,
      overrides: updates.thresholds,
    })

    if (finalIncluded) {
      assertBenchmarkVariantThresholdsComplete({
        maxTier: battery.maxTier,
        thresholds: thresholdRows,
      })
    }
  }

  const testUpdates: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.name !== undefined) testUpdates.name = updates.name
  if (updates.categoryKey !== undefined)
    testUpdates.categoryKey = updates.categoryKey
  if (updates.scheme !== undefined) testUpdates.scheme = updates.scheme
  if (updates.scoreType !== undefined) testUpdates.scoreType = updates.scoreType
  if (updates.inputUnit !== undefined) testUpdates.inputUnit = updates.inputUnit
  if (updates.includedInScoring !== undefined)
    testUpdates.includedInScoring = updates.includedInScoring
  if (scoreModelChanged) {
    testUpdates.scoreModel = scoreModelConfig.scoreModel
    testUpdates.hybridFlipTier = scoreModelConfig.hybridFlipTier
  }

  const categoryChanged =
    updates.categoryKey !== undefined &&
    updates.categoryKey !== existing.categoryKey

  await db.transaction(async (tx) => {
    await tx
      .update(benchmarkTestsTable)
      .set(testUpdates)
      .where(eq(benchmarkTestsTable.id, testId))

    if (categoryChanged) {
      await tx
        .update(trackWorkoutsTable)
        .set({ benchmarkCategory: finalCategoryKey, updatedAt: new Date() })
        .where(eq(trackWorkoutsTable.benchmarkTestId, testId))
    }

    if (thresholdRows.length > 0) {
      await upsertBenchmarkTierThresholdRows(
        tx,
        thresholdRows.map((row) => ({ ...row, testId })),
      )
    }

    await persistRecomputedCategoryTestCounts(
      tx,
      battery.id,
      battery.categories,
    )
  })
}

export async function deleteBenchmarkTest({
  db,
  competitionId,
  testId,
}: {
  db: Database
  competitionId: string
  testId: string
}): Promise<void> {
  const battery = await getBenchmarkBatteryRow(db, competitionId)

  const [existing] = await db
    .select({ id: benchmarkTestsTable.id })
    .from(benchmarkTestsTable)
    .where(
      and(
        eq(benchmarkTestsTable.id, testId),
        eq(benchmarkTestsTable.batteryId, battery.id),
      ),
    )
    .limit(1)

  if (!existing) {
    throw new BenchmarkConfigError(`Benchmark test ${testId} not found`)
  }

  await db.transaction(async (tx) => {
    await tx
      .update(trackWorkoutsTable)
      .set({
        benchmarkTestId: null,
        benchmarkCategory: null,
        updatedAt: new Date(),
      })
      .where(eq(trackWorkoutsTable.benchmarkTestId, testId))
    await tx
      .delete(benchmarkTierThresholdsTable)
      .where(eq(benchmarkTierThresholdsTable.testId, testId))
    await tx
      .delete(benchmarkTestsTable)
      .where(eq(benchmarkTestsTable.id, testId))
    await persistRecomputedCategoryTestCounts(
      tx,
      battery.id,
      battery.categories,
    )
  })
}

export async function updateBenchmarkBatterySettings({
  db,
  competitionId,
  settings,
}: {
  db: Database
  competitionId: string
  settings: BenchmarkBatterySettingsInput
}): Promise<void> {
  const battery = await getBenchmarkBatteryRow(db, competitionId)
  const ratingBands = parseBenchmarkRatingBands(battery.ratingBands)
  assertBenchmarkRatingBandsWithinScoreMax({
    ratingBands,
    scoreMax: settings.scoreMax,
  })

  const oldMaxTier = battery.maxTier
  const newMaxTier = settings.maxTier

  const tests = await db
    .select({
      id: benchmarkTestsTable.id,
      includedInScoring: benchmarkTestsTable.includedInScoring,
    })
    .from(benchmarkTestsTable)
    .where(eq(benchmarkTestsTable.batteryId, battery.id))
  const testIds = tests.map((test) => test.id)
  const includedTestIds = tests
    .filter((test) => test.includedInScoring)
    .map((test) => test.id)

  let growthRows: (EncodedBenchmarkTestThresholdRow & { testId: string })[] = []
  if (newMaxTier > oldMaxTier && includedTestIds.length > 0) {
    const existingThresholds = await db
      .select({
        testId: benchmarkTierThresholdsTable.testId,
        variant: benchmarkTierThresholdsTable.variant,
        tier: benchmarkTierThresholdsTable.tier,
        thresholdValue: benchmarkTierThresholdsTable.thresholdValue,
        rawValue: benchmarkTierThresholdsTable.rawValue,
      })
      .from(benchmarkTierThresholdsTable)
      .where(inArray(benchmarkTierThresholdsTable.testId, includedTestIds))

    growthRows = buildBenchmarkMaxTierGrowthRows({
      oldMaxTier,
      newMaxTier,
      thresholds: existingThresholds,
    })
  }

  await db.transaction(async (tx) => {
    await tx
      .update(benchmarkBatteriesTable)
      .set({
        name: settings.name,
        description: settings.description ?? null,
        scoreMax: settings.scoreMax,
        maxTier: settings.maxTier,
        videoPolicy: settings.videoPolicy,
        updatedAt: new Date(),
      })
      .where(eq(benchmarkBatteriesTable.id, battery.id))

    if (newMaxTier < oldMaxTier && testIds.length > 0) {
      await tx
        .delete(benchmarkTierThresholdsTable)
        .where(
          and(
            inArray(benchmarkTierThresholdsTable.testId, testIds),
            gt(benchmarkTierThresholdsTable.tier, newMaxTier),
          ),
        )
    }

    if (growthRows.length > 0) {
      await upsertBenchmarkTierThresholdRows(tx, growthRows)
    }
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

function formatParseError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown parse error"
}
