import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
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
export const organizerRequestTable = sqliteTable(
	"organizer_request",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createOrganizerRequestId())
			.notNull(),
		teamId: text()
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		userId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		reason: text({ length: 2000 }).notNull(),
		status: text({ length: 20 })
			.$type<OrganizerRequestStatus>()
			.default("pending")
			.notNull(),
		adminNotes: text({ length: 2000 }),
		reviewedBy: text().references(() => userTable.id),
		reviewedAt: integer({ mode: "timestamp" }),
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
