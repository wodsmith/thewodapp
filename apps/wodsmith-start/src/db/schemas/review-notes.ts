/**
 * Review Notes Schema
 *
 * Stores timestamped review notes from organizers on video submissions.
 * Notes can optionally be tied to a specific timestamp in the video
 * and/or a specific movement in the workout.
 */

import { relations } from "drizzle-orm"
import {
	index,
	int,
	mysqlEnum,
	mysqlTable,
	text,
	varchar,
} from "drizzle-orm/mysql-core"

export const reviewNoteTypes = ["general", "no-rep"] as const
export type ReviewNoteType = (typeof reviewNoteTypes)[number]
import { commonColumns, createReviewNoteId } from "./common"
import { videoSubmissionsTable } from "./video-submissions"
import { userTable } from "./users"
import { teamTable } from "./teams"
import { movements } from "./workouts"

export const reviewNotesTable = mysqlTable(
	"review_notes",
	{
		...commonColumns,
		id: varchar({ length: 255 }).primaryKey().$defaultFn(createReviewNoteId),
		videoSubmissionId: varchar({ length: 255 }).notNull(),
		userId: varchar({ length: 255 }).notNull(),
		teamId: varchar({ length: 255 }).notNull(),
		type: mysqlEnum("type", reviewNoteTypes).notNull().default("general"),
		content: text().notNull(),
		timestampSeconds: int(),
		movementId: varchar({ length: 255 }),
	},
	(table) => [
		index("review_notes_submission_idx").on(table.videoSubmissionId),
		index("review_notes_user_idx").on(table.userId),
		index("review_notes_team_idx").on(table.teamId),
	],
)

export const reviewNotesRelations = relations(reviewNotesTable, ({ one }) => ({
	videoSubmission: one(videoSubmissionsTable, {
		fields: [reviewNotesTable.videoSubmissionId],
		references: [videoSubmissionsTable.id],
	}),
	user: one(userTable, {
		fields: [reviewNotesTable.userId],
		references: [userTable.id],
	}),
	team: one(teamTable, {
		fields: [reviewNotesTable.teamId],
		references: [teamTable.id],
	}),
	movement: one(movements, {
		fields: [reviewNotesTable.movementId],
		references: [movements.id],
	}),
}))

export type ReviewNote = typeof reviewNotesTable.$inferSelect
export type ReviewNoteInsert = typeof reviewNotesTable.$inferInsert
