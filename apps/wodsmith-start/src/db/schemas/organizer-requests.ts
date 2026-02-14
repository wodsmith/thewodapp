import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { datetime, index, mysqlTable, varchar } from "drizzle-orm/mysql-core"
import { commonColumns, createOrganizerRequestId } from "./common"
import { teamTable } from "./teams"
import { userTable } from "./users"

// Status enum for organizer requests
export const ORGANIZER_REQUEST_STATUS = {
	PENDING: "pending",
	APPROVED: "approved",
	REJECTED: "rejected",
} as const

export type OrganizerRequestStatus =
	(typeof ORGANIZER_REQUEST_STATUS)[keyof typeof ORGANIZER_REQUEST_STATUS]

// Organizer request table - tracks requests to become a competition organizer
export const organizerRequestTable = mysqlTable(
	"organizer_requests",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createOrganizerRequestId())
			.notNull(),
		teamId: varchar({ length: 255 }).notNull(),
		userId: varchar({ length: 255 }).notNull(),
		reason: varchar({ length: 2000 }).notNull(),
		status: varchar({ length: 20 })
			.$type<OrganizerRequestStatus>()
			.default("pending")
			.notNull(),
		adminNotes: varchar({ length: 2000 }),
		reviewedBy: varchar({ length: 255 }),
		reviewedAt: datetime(),
	},
	(table) => [
		index("organizer_request_team_idx").on(table.teamId),
		index("organizer_request_user_idx").on(table.userId),
		index("organizer_request_status_idx").on(table.status),
	],
)

// Relations
export const organizerRequestRelations = relations(
	organizerRequestTable,
	({ one }) => ({
		team: one(teamTable, {
			fields: [organizerRequestTable.teamId],
			references: [teamTable.id],
		}),
		user: one(userTable, {
			fields: [organizerRequestTable.userId],
			references: [userTable.id],
			relationName: "requester",
		}),
		reviewer: one(userTable, {
			fields: [organizerRequestTable.reviewedBy],
			references: [userTable.id],
			relationName: "reviewer",
		}),
	}),
)

// Type exports
export type OrganizerRequest = InferSelectModel<typeof organizerRequestTable>
