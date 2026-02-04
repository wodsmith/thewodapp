import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, int, mysqlTable, varchar } from "drizzle-orm/mysql-core"
import { commonColumns, createEventJudgingSheetId } from "./common"
import { competitionsTable } from "./competitions"
import { trackWorkoutsTable } from "./programming"
import { userTable } from "./users"

/**
 * Event Judging Sheets Table
 *
 * Stores judging sheet uploads for competition events.
 * Organizers can upload PDF files that athletes can download.
 * Multiple sheets per event are supported with titles for organization.
 */
export const eventJudgingSheetsTable = mysqlTable(
	"event_judging_sheets",
	{
		...commonColumns,
		id: varchar({ length: 255 })
			.primaryKey()
			.$defaultFn(() => createEventJudgingSheetId())
			.notNull(),
		// Link to the competition (for easier querying and authorization)
		competitionId: varchar({ length: 255 })
			.notNull(),
		// Link to the specific event (track_workout)
		trackWorkoutId: varchar({ length: 255 })
			.notNull(),
		// Display title for the judging sheet
		title: varchar({ length: 255 }).notNull(),
		// R2 storage key for the file
		r2Key: varchar({ length: 600 }).notNull(),
		// Public URL for downloading
		url: varchar({ length: 600 }).notNull(),
		// Original filename (for display/download)
		originalFilename: varchar({ length: 255 }).notNull(),
		// File size in bytes
		fileSize: int().notNull(),
		// MIME type of the file
		mimeType: varchar({ length: 100 }).notNull(),
		// Who uploaded this sheet
		uploadedBy: varchar({ length: 255 })
			.notNull(),
		// Sort order for multiple sheets per event
		sortOrder: int().default(0).notNull(),
	},
	(table) => [
		index("event_judging_sheets_competition_idx").on(table.competitionId),
		index("event_judging_sheets_event_idx").on(table.trackWorkoutId),
		index("event_judging_sheets_uploaded_by_idx").on(table.uploadedBy),
		index("event_judging_sheets_sort_idx").on(
			table.trackWorkoutId,
			table.sortOrder,
		),
	],
)

// Relations
export const eventJudgingSheetsRelations = relations(
	eventJudgingSheetsTable,
	({ one }) => ({
		competition: one(competitionsTable, {
			fields: [eventJudgingSheetsTable.competitionId],
			references: [competitionsTable.id],
		}),
		trackWorkout: one(trackWorkoutsTable, {
			fields: [eventJudgingSheetsTable.trackWorkoutId],
			references: [trackWorkoutsTable.id],
		}),
		uploader: one(userTable, {
			fields: [eventJudgingSheetsTable.uploadedBy],
			references: [userTable.id],
		}),
	}),
)

// Type exports
export type EventJudgingSheet = InferSelectModel<typeof eventJudgingSheetsTable>
