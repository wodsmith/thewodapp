import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createSeriesDivisionMappingId,
  createSeriesTemplateDivisionId,
} from "./common"
import { competitionGroupsTable, competitionsTable } from "./competitions"
import { scalingLevelsTable } from "./scaling"

/**
 * Series Template Divisions
 *
 * Stores per-division metadata for the series template (description, maxSpots, feeCents).
 * The structural data (label, position, teamSize) lives on the scaling_levels table.
 * This table mirrors competition_divisions but for the series template instead of
 * a specific competition.
 *
 * When the organizer "syncs downstream", these values are copied into each
 * competition's competition_divisions rows.
 */
export const seriesTemplateDivisionsTable = mysqlTable(
  "series_template_divisions",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createSeriesTemplateDivisionId())
      .notNull(),
    // The series group this template division belongs to
    groupId: varchar({ length: 255 }).notNull(),
    // The template scaling level this config applies to
    divisionId: varchar({ length: 255 }).notNull(),
    // Fee in cents (e.g., 7500 = $75.00) — synced to competition_divisions.feeCents
    feeCents: int().default(0).notNull(),
    // Markdown description — synced to competition_divisions.description
    description: text(),
    // Max spots — synced to competition_divisions.maxSpots (null = unlimited)
    maxSpots: int(),
  },
  (table) => [
    // One config row per division per series
    uniqueIndex("std_group_division_idx").on(table.groupId, table.divisionId),
    index("std_group_idx").on(table.groupId),
  ],
)

/**
 * Series Division Mappings
 *
 * Maps each competition's divisions (scaling levels) to series-level divisions
 * (also scaling levels, from the series template scaling group).
 * This decouples the series leaderboard structure from individual competition setup.
 *
 * NOTE: PlanetScale (Vitess) does not support foreign key constraints.
 * Cascade cleanup is handled at the application level:
 * - deleteCompetitionDivisionFn cleans up mappings referencing the deleted level
 * - setSeriesTemplateFn clears all mappings when template changes
 * - saveSeriesDivisionMappingsFn does a full replace on save
 * Relations below are for Drizzle query builder only (no DB-level enforcement).
 */
export const seriesDivisionMappingsTable = mysqlTable(
  "series_division_mappings",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createSeriesDivisionMappingId())
      .notNull(),
    // The series group this mapping belongs to
    groupId: varchar({ length: 255 }).notNull(),
    // The competition whose division is being mapped
    competitionId: varchar({ length: 255 }).notNull(),
    // The competition's division (scaling level)
    competitionDivisionId: varchar({ length: 255 }).notNull(),
    // The series template division (scaling level) this maps to
    seriesDivisionId: varchar({ length: 255 }).notNull(),
  },
  (table) => [
    // Each competition division can only be mapped once per series
    uniqueIndex("sdm_group_comp_div_idx").on(
      table.groupId,
      table.competitionId,
      table.competitionDivisionId,
    ),
    index("sdm_group_idx").on(table.groupId),
    index("sdm_competition_idx").on(table.competitionId),
  ],
)

// Relations (Drizzle query builder only — no DB-level FK enforcement on PlanetScale)
export const seriesTemplateDivisionsRelations = relations(
  seriesTemplateDivisionsTable,
  ({ one }) => ({
    group: one(competitionGroupsTable, {
      fields: [seriesTemplateDivisionsTable.groupId],
      references: [competitionGroupsTable.id],
    }),
    division: one(scalingLevelsTable, {
      fields: [seriesTemplateDivisionsTable.divisionId],
      references: [scalingLevelsTable.id],
    }),
  }),
)

export const seriesDivisionMappingsRelations = relations(
  seriesDivisionMappingsTable,
  ({ one }) => ({
    group: one(competitionGroupsTable, {
      fields: [seriesDivisionMappingsTable.groupId],
      references: [competitionGroupsTable.id],
    }),
    competition: one(competitionsTable, {
      fields: [seriesDivisionMappingsTable.competitionId],
      references: [competitionsTable.id],
    }),
    competitionDivision: one(scalingLevelsTable, {
      fields: [seriesDivisionMappingsTable.competitionDivisionId],
      references: [scalingLevelsTable.id],
      relationName: "competitionDivision",
    }),
    seriesDivision: one(scalingLevelsTable, {
      fields: [seriesDivisionMappingsTable.seriesDivisionId],
      references: [scalingLevelsTable.id],
      relationName: "seriesDivision",
    }),
  }),
)

// Type exports
export type SeriesTemplateDivision = InferSelectModel<
  typeof seriesTemplateDivisionsTable
>
export type SeriesDivisionMapping = InferSelectModel<
  typeof seriesDivisionMappingsTable
>
