import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, int, mysqlTable, varchar } from "drizzle-orm/mysql-core"
import { commonColumns, createSponsorGroupId, createSponsorId } from "./common"
import { competitionsTable } from "./competitions"
import { userTable } from "./users"

// Sponsor Groups table (for competitions only - Gold, Silver, Title Sponsor, etc.)
export const sponsorGroupsTable = mysqlTable(
	"sponsor_groups",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createSponsorGroupId())
			.notNull(),
		competitionId: varchar({ length: 255 })
			.notNull(),
		name: varchar({ length: 100 }).notNull(),
		displayOrder: int().default(0).notNull(),
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
export const sponsorsTable = mysqlTable(
	"sponsors",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createSponsorId())
			.notNull(),
		// One of these must be set (enforced in app logic)
		competitionId: varchar({ length: 255 }),
		userId: varchar({ length: 255 }),
		// Group is optional - null means ungrouped (only applicable for competition sponsors)
		groupId: varchar({ length: 255 }),
		name: varchar({ length: 255 }).notNull(),
		logoUrl: varchar({ length: 600 }),
		website: varchar({ length: 600 }),
		displayOrder: int().default(0).notNull(),
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
