import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createBenchmarkBatteryId,
  createBenchmarkTestId,
  createBenchmarkTierThresholdId,
} from "./common"
import { competitionsTable } from "./competitions"
import { scalingGroupsTable } from "./scaling"

export const BENCHMARK_VIDEO_POLICIES = [
  "never",
  "for_top_scores",
  "always",
] as const
export type BenchmarkVideoPolicy = (typeof BENCHMARK_VIDEO_POLICIES)[number]

export const BENCHMARK_BATTERY_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const
export type BenchmarkBatteryStatus =
  (typeof BENCHMARK_BATTERY_STATUS)[keyof typeof BENCHMARK_BATTERY_STATUS]

export const BENCHMARK_SCORE_MODELS = ["standard", "hybrid"] as const
export type BenchmarkScoreModel = (typeof BENCHMARK_SCORE_MODELS)[number]

// @lat: [[domain#Domain Model#Benchmark Batteries]]
export const benchmarkBatteriesTable = mysqlTable(
  "benchmark_batteries",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createBenchmarkBatteryId())
      .notNull(),
    ownerTeamId: varchar({ length: 255 }),
    ownerKey: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    categories: text().notNull(),
    ratingBands: text().notNull(),
    maxTier: int().default(10).notNull(),
    scoreMax: int().default(100).notNull(),
    videoPolicy: varchar({ length: 20 })
      .$type<BenchmarkVideoPolicy>()
      .default("never")
      .notNull(),
    isOpenJoin: boolean().default(false).notNull(),
    variantScalingGroupId: varchar({ length: 255 }),
    competitionId: varchar({ length: 255 }),
    status: varchar({ length: 20 })
      .$type<BenchmarkBatteryStatus>()
      .default("draft")
      .notNull(),
  },
  (table) => [
    uniqueIndex("benchmark_batteries_owner_key_unique").on(table.ownerKey),
    uniqueIndex("benchmark_batteries_competition_unique").on(
      table.competitionId,
    ),
    index("benchmark_batteries_owner_team_idx").on(table.ownerTeamId),
    index("benchmark_batteries_status_idx").on(table.status),
  ],
)

export const benchmarkTestsTable = mysqlTable(
  "benchmark_tests",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createBenchmarkTestId())
      .notNull(),
    batteryId: varchar({ length: 255 }).notNull(),
    categoryKey: varchar({ length: 64 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    position: int().notNull(),
    scheme: varchar({ length: 255 }).notNull(),
    scoreType: varchar({ length: 255 }).notNull(),
    inputUnit: varchar({ length: 64 }).notNull(),
    includedInScoring: boolean().default(true).notNull(),
    timeCapMs: int(),
    scoreModel: varchar({ length: 20 })
      .$type<BenchmarkScoreModel>()
      .default("standard")
      .notNull(),
    hybridFlipTier: int(),
    hybridScale: text(),
  },
  (table) => [
    uniqueIndex("benchmark_tests_battery_position_unique").on(
      table.batteryId,
      table.position,
    ),
    index("benchmark_tests_battery_idx").on(table.batteryId),
    index("benchmark_tests_category_idx").on(table.batteryId, table.categoryKey),
  ],
)

export const benchmarkTierThresholdsTable = mysqlTable(
  "benchmark_tier_thresholds",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createBenchmarkTierThresholdId())
      .notNull(),
    testId: varchar({ length: 255 }).notNull(),
    variant: varchar({ length: 64 }).notNull(),
    tier: int().notNull(),
    thresholdValue: int().notNull(),
    rawValue: varchar({ length: 255 }).notNull(),
  },
  (table) => [
    uniqueIndex("benchmark_thresholds_test_variant_tier_unique").on(
      table.testId,
      table.variant,
      table.tier,
    ),
    index("benchmark_thresholds_test_variant_idx").on(
      table.testId,
      table.variant,
    ),
  ],
)

export const benchmarkBatteriesRelations = relations(
  benchmarkBatteriesTable,
  ({ one, many }) => ({
    competition: one(competitionsTable, {
      fields: [benchmarkBatteriesTable.competitionId],
      references: [competitionsTable.id],
    }),
    variantScalingGroup: one(scalingGroupsTable, {
      fields: [benchmarkBatteriesTable.variantScalingGroupId],
      references: [scalingGroupsTable.id],
    }),
    tests: many(benchmarkTestsTable),
  }),
)

export const benchmarkTestsRelations = relations(
  benchmarkTestsTable,
  ({ one, many }) => ({
    battery: one(benchmarkBatteriesTable, {
      fields: [benchmarkTestsTable.batteryId],
      references: [benchmarkBatteriesTable.id],
    }),
    thresholds: many(benchmarkTierThresholdsTable),
  }),
)

export const benchmarkTierThresholdsRelations = relations(
  benchmarkTierThresholdsTable,
  ({ one }) => ({
    test: one(benchmarkTestsTable, {
      fields: [benchmarkTierThresholdsTable.testId],
      references: [benchmarkTestsTable.id],
    }),
  }),
)

export type BenchmarkBattery = InferSelectModel<
  typeof benchmarkBatteriesTable
>
export type BenchmarkBatteryInsert = typeof benchmarkBatteriesTable.$inferInsert
export type BenchmarkTest = InferSelectModel<typeof benchmarkTestsTable>
export type BenchmarkTestInsert = typeof benchmarkTestsTable.$inferInsert
export type BenchmarkTierThreshold = InferSelectModel<
  typeof benchmarkTierThresholdsTable
>
export type BenchmarkTierThresholdInsert =
  typeof benchmarkTierThresholdsTable.$inferInsert
