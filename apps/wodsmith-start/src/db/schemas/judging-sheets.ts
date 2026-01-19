import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
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
export const eventJudgingSheetsTable = sqliteTable(
	"event_judging_sheets",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createEventJudgingSheetId())
			.notNull(),
		// Link to the competition (for easier querying and authorization)
		competitionId: text()
			.notNull()
			.references(() => competitionsTable.id, { onDelete: "cascade" }),
		// Link to the specific event (track_workout)
		trackWorkoutId: text()
			.notNull()
			.references(() => trackWorkoutsTable.id, { onDelete: "cascade" }),
		// Display title for the judging sheet
		title: text({ length: 255 }).notNull(),
		// R2 storage key for the file
		r2Key: text({ length: 600 }).notNull(),
		// Public URL for downloading
		url: text({ length: 600 }).notNull(),
		// Original filename (for display/download)
		originalFilename: text({ length: 255 }).notNull(),
		// File size in bytes
		fileSize: integer().notNull(),
		// MIME type of the file
		mimeType: text({ length: 100 }).notNull(),
		// Who uploaded this sheet
		uploadedBy: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		// Sort order for multiple sheets per event
		sortOrder: integer().default(0).notNull(),
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
