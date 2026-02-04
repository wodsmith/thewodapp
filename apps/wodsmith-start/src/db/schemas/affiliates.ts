import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, mysqlTable, varchar } from "drizzle-orm/mysql-core"
import { commonColumns, createAffiliateId } from "./common"
import { teamTable } from "./teams"

// Verification status enum for affiliates
export const affiliateVerificationStatus = [
	"unverified",
	"verified",
	"claimed",
] as const
export type AffiliateVerificationStatus =
	(typeof affiliateVerificationStatus)[number]

// Affiliates Table - Normalized gym/affiliate data
export const affiliatesTable = mysqlTable(
	"affiliates",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createAffiliateId())
			.notNull(),
		name: varchar({ length: 255 }).notNull().unique(), // "CrossFit Downtown"
		// Optional metadata
		location: varchar({ length: 255 }), // "Austin, TX"
		// Verification status: unverified (default), verified (admin verified), claimed (gym owner linked)
		verificationStatus: varchar({ enum: affiliateVerificationStatus, length: 255 })
			.default("unverified")
			.notNull(),
		// When claimed, links to the team that owns this affiliate
		ownerTeamId: varchar({ length: 255 }),
	},
	(table) => [
		index("affiliates_name_idx").on(table.name),
		index("affiliates_owner_team_idx").on(table.ownerTeamId),
	],
)

// Type exports
export type Affiliate = InferSelectModel<typeof affiliatesTable>

// Relations
export const affiliatesRelations = relations(affiliatesTable, ({ one }) => ({
	// The team that owns this affiliate (if claimed)
	ownerTeam: one(teamTable, {
		fields: [affiliatesTable.ownerTeamId],
		references: [teamTable.id],
	}),
}))
