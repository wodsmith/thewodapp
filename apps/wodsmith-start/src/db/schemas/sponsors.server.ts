import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { commonColumns, createSponsorGroupId, createSponsorId } from "./common"
import { competitionsTable } from "./competitions"
import { userTable } from "./users"

// Sponsor Groups table (for competitions only - Gold, Silver, Title Sponsor, etc.)
export const sponsorGroupsTable = sqliteTable(
	"sponsor_groups",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createSponsorGroupId())
			.notNull(),
		competitionId: text()
			.notNull()
			.references(() => competitionsTable.id, { onDelete: "cascade" }),
		name: text({ length: 100 }).notNull(),
		displayOrder: integer().default(0).notNull(),
	},
	(table) => [
		index("sponsor_groups_competition_idx").on(table.competitionId),
		index("sponsor_groups_order_idx").on(
			table.competitionId,
			table.displayOrder,
		),
	],
)

// Unified Sponsors table (for both athletes and competitions)
export const sponsorsTable = sqliteTable(
	"sponsors",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createSponsorId())
			.notNull(),
		// One of these must be set (enforced in app logic)
		competitionId: text().references(() => competitionsTable.id, {
			onDelete: "cascade",
		}),
		userId: text().references(() => userTable.id, { onDelete: "cascade" }),
		// Group is optional - null means ungrouped (only applicable for competition sponsors)
		groupId: text().references(() => sponsorGroupsTable.id, {
			onDelete: "set null",
		}),
		name: text({ length: 255 }).notNull(),
		logoUrl: text({ length: 600 }),
		website: text({ length: 600 }),
		displayOrder: integer().default(0).notNull(),
	},
	(table) => [
		index("sponsors_competition_idx").on(table.competitionId),
		index("sponsors_user_idx").on(table.userId),
		index("sponsors_group_idx").on(table.groupId),
		index("sponsors_competition_order_idx").on(
			table.competitionId,
			table.groupId,
			table.displayOrder,
		),
		index("sponsors_user_order_idx").on(table.userId, table.displayOrder),
	],
)

// Relations
export const sponsorGroupsRelations = relations(
	sponsorGroupsTable,
	({ one, many }) => ({
		competition: one(competitionsTable, {
			fields: [sponsorGroupsTable.competitionId],
			references: [competitionsTable.id],
		}),
		sponsors: many(sponsorsTable),
	}),
)

export const sponsorsRelations = relations(sponsorsTable, ({ one }) => ({
	competition: one(competitionsTable, {
		fields: [sponsorsTable.competitionId],
		references: [competitionsTable.id],
	}),
	user: one(userTable, {
		fields: [sponsorsTable.userId],
		references: [userTable.id],
	}),
	group: one(sponsorGroupsTable, {
		fields: [sponsorsTable.groupId],
		references: [sponsorGroupsTable.id],
	}),
}))

// Type exports
export type SponsorGroup = InferSelectModel<typeof sponsorGroupsTable>
export type Sponsor = InferSelectModel<typeof sponsorsTable>
