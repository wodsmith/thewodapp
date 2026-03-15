import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	index,
	mysqlTable,
	uniqueIndex,
	varchar,
} from "drizzle-orm/mysql-core"
import { competitionGroupsTable, competitionsTable } from "./competitions"
import { commonColumns, createSeriesDivisionMappingId } from "./common"
import { scalingLevelsTable } from "./scaling"

/**
 * Series Division Mappings
 *
 * Maps each competition's divisions (scaling levels) to series-level divisions
 * (also scaling levels, from the series template scaling group).
 * This decouples the series leaderboard structure from individual competition setup.
 *
 * Cascade deletes ensure orphaned mappings are automatically cleaned up when:
 * - A competition is deleted from the series
 * - A competition division (scaling level) is deleted/recreated
 * - A series template division is changed
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
		groupId: varchar({ length: 255 })
			.notNull()
			.references(() => competitionGroupsTable.id, {
				onDelete: "cascade",
			}),
		// The competition whose division is being mapped
		competitionId: varchar({ length: 255 })
			.notNull()
			.references(() => competitionsTable.id, { onDelete: "cascade" }),
		// The competition's division (scaling level)
		competitionDivisionId: varchar({ length: 255 })
			.notNull()
			.references(() => scalingLevelsTable.id, { onDelete: "cascade" }),
		// The series template division (scaling level) this maps to
		seriesDivisionId: varchar({ length: 255 })
			.notNull()
			.references(() => scalingLevelsTable.id, { onDelete: "cascade" }),
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

// Relations
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
export type SeriesDivisionMapping = InferSelectModel<
	typeof seriesDivisionMappingsTable
>
